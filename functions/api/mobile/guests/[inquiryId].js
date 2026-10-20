import { mobileIdentity } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { MOBILE_DOMAIN_VERSION, normalizeInquiry, normalizeInteraction, normalizeAssignment, normalizePayment, normalizeBooking, enrichInquiry, guestJourney } from "../../../lib/mobile-domain.mjs";
import { json, errorResponse, methodNotAllowed, assertSameOrigin, assertMobileWriteReady, readJson, validId } from "../../../lib/mobile-http.mjs";

const STATUSES = new Set(["new", "contacted", "planning", "qualified", "quoted", "follow_up", "deposit_pending", "deposit_paid", "payment_pending", "booked", "completed", "cancelled", "did_not_book", "duplicate"]);
const PRIORITIES = new Set(["", "auto", "urgent", "high", "normal"]);

async function loadGuest(env, inquiryId) {
  const inquiryRows = await listRecords(env, "list_inquiries", { filters: {} });
  const raw = inquiryRows.find(item => String(item.inquiry_id) === inquiryId);
  if (!raw) throw Object.assign(new Error("Guest inquiry not found."), { status: 404 });
  const record = normalizeInquiry(raw);
  const scope = { guest_id: record.guestId, inquiry_id: "" };
  const interactionRows = await listRecords(env, "list_interactions", scope);
  const assignmentRows = await listRecords(env, "list_assignments", scope);
  const bookingRows = await listRecords(env, "list_bookings", scope);
  const paymentRows = await listRecords(env, "list_payments", scope);
  const interactions = interactionRows.map(normalizeInteraction);
  const assignments = assignmentRows.map(normalizeAssignment);
  const payments = paymentRows.map(normalizePayment);
  const bookings = bookingRows.map(normalizeBooking);
  const enriched = enrichInquiry(record, bookings, payments);
  return {
    raw, record: enriched, interactions, assignments, payments, bookings,
    journey: guestJourney(record, interactions, assignments, payments, bookings),
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
    const allowed = new Set(["followup_date", "status", "priority", "assigned_to"]);
    const patch = body.patch;
    if (!patch || typeof patch !== "object" || Array.isArray(patch) || !Object.keys(patch).length) return json(400, { ok: false, error: "No supported changes were supplied." });
    for (const [field, value] of Object.entries(patch)) {
      if (!allowed.has(field) || typeof value !== "string" || value.length > 100) return json(400, { ok: false, error: `Invalid field: ${field}` });
    }
    if (patch.followup_date && !/^\d{4}-\d{2}-\d{2}$/.test(patch.followup_date)) return json(400, { ok: false, error: "Use a valid follow-up date." });
    if (patch.status !== undefined && !STATUSES.has(patch.status)) return json(400, { ok: false, error: "Invalid inquiry status." });
    if (patch.priority !== undefined && !PRIORITIES.has(patch.priority)) return json(400, { ok: false, error: "Invalid inquiry priority." });
    if (patch.assigned_to !== undefined && !/^[A-Za-z0-9 _-]{0,30}$/.test(patch.assigned_to)) return json(400, { ok: false, error: "Invalid assignee." });
    const updated = { ...current.raw, ...patch, updated_at: new Date().toISOString() };
    updated.internal_notes = [current.raw.internal_notes || "", `Mobile edit by ${identity.staffCode || identity.email} · ${updated.updated_at} · fields: ${Object.keys(patch).join(", ")}`].filter(Boolean).join("\n");
    await crmCall(env, "update_inquiry", { record: updated, inquiry_row: updated, expected_updated_at: current.record.updatedAt });
    const verified = await loadGuest(env, inquiryId);
    const matches = Object.entries(patch).every(([field, value]) => String(verified.raw[field] || "") === value);
    if (!matches) return json(202, { ok: true, verified: false, error: "Save was submitted but not verified. Refresh before retrying." });
    return json(200, { ok: true, verified: true, record: verified.record, journey: verified.journey });
  } catch (error) { return errorResponse(error); }
}

export function onRequestPost() { return methodNotAllowed(["GET", "PATCH"]); }
