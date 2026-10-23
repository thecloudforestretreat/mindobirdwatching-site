import { mobileIdentity } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { MOBILE_DOMAIN_VERSION, normalizeInquiry, normalizeInteraction, normalizeAssignment, normalizePayment, normalizeBooking, enrichInquiry, guestJourney, serviceReadiness } from "../../../lib/mobile-domain.mjs";
import { json, errorResponse, methodNotAllowed, assertSameOrigin, assertMobileWriteReady, readJson, validId } from "../../../lib/mobile-http.mjs";

const STATUSES = new Set(["new", "contacted", "planning", "qualified", "quoted", "follow_up", "deposit_pending", "deposit_paid", "payment_pending", "booked", "completed", "cancelled", "did_not_book", "duplicate"]);
const PRIORITIES = new Set(["", "auto", "urgent", "high", "normal"]);

async function loadGuest(env, inquiryId) {
  const inquiryRows = await listRecords(env, "list_inquiries", { filters: {} });
  const raw = inquiryRows.find(item => String(item.inquiry_id) === inquiryId);
  if (!raw) throw Object.assign(new Error("Guest inquiry not found."), { status: 404 });
  const record = normalizeInquiry(raw);
  const scope = { guest_id: record.guestId, inquiry_id: "" };
  const warnings = [];
  const related = async (action, section) => {
    try { return await listRecords(env, action, scope); }
    catch { warnings.push(section); return []; }
  };
  // Keep these reads sequential to avoid a burst of concurrent n8n executions.
  // A failed history section must not hide the canonical guest record.
  const interactionRows = await related("list_interactions", "communications");
  const assignmentRows = await related("list_assignments", "assignments");
  const bookingRows = await related("list_bookings", "bookings");
  const paymentRows = await related("list_payments", "payments");
  const interactions = interactionRows.map(normalizeInteraction);
  const assignments = assignmentRows.map(normalizeAssignment);
  const payments = paymentRows.map(normalizePayment);
  const bookings = bookingRows.map(normalizeBooking);
  const enriched = enrichInquiry(record, bookings, payments);
  return {
    raw, record: enriched, interactions, assignments, payments, bookings, warnings,
    journey: guestJourney(record, interactions, assignments, payments, bookings),
    readiness: serviceReadiness(record, assignments, payments, bookings, interactions),
  };
}

export async function onRequestGet({ request, env, params }) {
  try {
    await mobileIdentity(request, env);
    const inquiryId = validId(params.inquiryId);
    const data = await loadGuest(env, inquiryId);
    return json(200, {
      ok: true,
      dataVersion: MOBILE_DOMAIN_VERSION,
      record: data.record,
      journey: data.journey,
      readiness: data.readiness,
      warnings: data.warnings,
      data: { interactions: data.interactions, assignments: data.assignments, bookings: data.bookings, payments: data.payments },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) { return errorResponse(error); }
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const identity = await mobileIdentity(request, env);
    assertMobileWriteReady(env, identity);
    assertSameOrigin(request, env);
    const inquiryId = validId(params.inquiryId);
    const body = await readJson(request, 6000);
    const current = await loadGuest(env, inquiryId);
    if (body.expectedUpdatedAt && String(body.expectedUpdatedAt) !== current.record.updatedAt) {
      return json(409, { ok: false, error: "This record changed since it was loaded. Refresh and review before saving." });
    }
    const limits = new Map([["followup_date", 10], ["status", 40], ["priority", 20], ["assigned_to", 30], ["first_name", 80], ["last_name", 80], ["full_name", 160], ["phone_number", 60], ["email", 254], ["country", 120], ["guest_count", 3], ["requested_date", 10], ["pickup_location", 500], ["notes", 3000]]);
    const patch = body.patch;
    if (!patch || typeof patch !== "object" || Array.isArray(patch) || !Object.keys(patch).length) return json(400, { ok: false, error: "No supported changes were supplied." });
    for (const [field, value] of Object.entries(patch)) {
      if (!limits.has(field) || typeof value !== "string" || value.length > limits.get(field)) return json(400, { ok: false, error: `Invalid field: ${field}` });
    }
    if (patch.followup_date && !/^\d{4}-\d{2}-\d{2}$/.test(patch.followup_date)) return json(400, { ok: false, error: "Use a valid follow-up date." });
    if (patch.status !== undefined && !STATUSES.has(patch.status)) return json(400, { ok: false, error: "Invalid inquiry status." });
    if (patch.priority !== undefined && !PRIORITIES.has(patch.priority)) return json(400, { ok: false, error: "Invalid inquiry priority." });
    if (patch.assigned_to !== undefined && !/^[A-Za-z0-9 _-]{0,30}$/.test(patch.assigned_to)) return json(400, { ok: false, error: "Invalid assignee." });
    if (patch.first_name !== undefined && !patch.first_name.trim()) return json(400, { ok: false, error: "First name is required." });
    if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) return json(400, { ok: false, error: "Enter a valid email address." });
    if (patch.guest_count && (!/^\d{1,2}$/.test(patch.guest_count) || Number(patch.guest_count) < 1 || Number(patch.guest_count) > 99)) return json(400, { ok: false, error: "Guests must be between 1 and 99." });
    if (patch.requested_date && !/^\d{4}-\d{2}-\d{2}$/.test(patch.requested_date)) return json(400, { ok: false, error: "Use a valid tour date." });
    const updated = { ...current.raw, ...patch, updated_at: new Date().toISOString() };
    if (patch.full_name !== undefined) {
      const names = patch.full_name.trim().split(/\s+/); updated.first_name = names[0] || ""; updated.last_name = names.slice(1).join(" ");
    }
    if (patch.first_name !== undefined || patch.last_name !== undefined) {
      updated.first_name = String(updated.first_name || "").trim(); updated.last_name = String(updated.last_name || "").trim(); updated.full_name = [updated.first_name, updated.last_name].filter(Boolean).join(" ");
    }
    if (patch.phone_number !== undefined) { updated.phone_raw = patch.phone_number; updated.phone_normalized = patch.phone_number.replace(/\D/g, ""); }
    if (patch.email !== undefined) updated.email_normalized = patch.email.trim().toLowerCase();
    if (patch.country !== undefined) updated.home_country = patch.country;
    if (patch.guest_count !== undefined) updated.guest_count_text = patch.guest_count;
    if (patch.requested_date !== undefined) { updated.requested_date_start = patch.requested_date; updated.requested_date_end = patch.requested_date; }
    updated.internal_notes = [current.raw.internal_notes || "", `Mobile edit by ${identity.staffCode || identity.email} · ${updated.updated_at} · fields: ${Object.keys(patch).join(", ")}`].filter(Boolean).join("\n");
    await crmCall(env, "update_inquiry", { record: updated, inquiry_row: updated, expected_updated_at: current.record.updatedAt });
    const verified = await loadGuest(env, inquiryId);
    const matches = Object.entries(patch).every(([field, value]) => String(verified.raw[field] || "") === value);
    if (!matches) return json(202, { ok: true, verified: false, error: "Save was submitted but not verified. Refresh before retrying." });
    return json(200, { ok: true, verified: true, record: verified.record, journey: verified.journey });
  } catch (error) { return errorResponse(error); }
}

export function onRequestPost() { return methodNotAllowed(["GET", "PATCH"]); }
