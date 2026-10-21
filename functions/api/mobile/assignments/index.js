import { mobileIdentity } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { normalizeAssignment } from "../../../lib/mobile-domain.mjs";
import { json, errorResponse, methodNotAllowed, assertSameOrigin, assertMobileWriteReady, readJson, validId } from "../../../lib/mobile-http.mjs";

const text = (value, max) => String(value ?? "").trim().slice(0, max);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
const time = value => !value || /^\d{2}:\d{2}$/.test(String(value)) ? String(value || "") : null;

export async function onRequestPost({ request, env }) {
  try {
    const identity = await mobileIdentity(request, env);
    assertMobileWriteReady(env, identity);
    assertSameOrigin(request, env);
    const body = await readJson(request, 10000);
    const inquiryId = validId(body.inquiryId);
    const assignment = body.assignment;
    if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) return json(400, { ok: false, error: "Assignment details are required." });
    const serviceDate = date(assignment.service_date);
    if (!serviceDate) return json(400, { ok: false, error: "Choose a valid service date." });
    if (time(assignment.start_time) === null || time(assignment.end_time) === null) return json(400, { ok: false, error: "Use a valid service time." });
    const providerName = text(assignment.provider_name, 160);
    if (!providerName) return json(400, { ok: false, error: "Choose or enter a provider." });
    const status = text(assignment.assignment_status || "pending", 20).toLowerCase();
    if (!["pending", "confirmed"].includes(status)) return json(400, { ok: false, error: "Invalid assignment status." });
    const informed = assignment.provider_informed === "Yes" ? "Yes" : "No";
    const record = {
      assignment_id: "",
      assignment_group_id: "",
      inquiry_id: inquiryId,
      guest_id: text(body.guestId, 128),
      booking_id: text(body.bookingId, 128),
      guest_name: text(body.guestName, 180),
      guest_phone: text(body.guestPhone, 40),
      guest_count: text(body.guestCount, 20),
      service_date: serviceDate,
      start_time: time(assignment.start_time),
      end_time: time(assignment.end_time),
      service_type: text(assignment.service_type || "Other", 120),
      product_selected: text(assignment.product_selected, 240),
      provider_id: text(assignment.provider_id, 128),
      provider_role: text(assignment.provider_role || "other", 60).toLowerCase(),
      provider_name: providerName === "Other" ? "Other" : providerName,
      provider_name_other: providerName === "Other" ? text(assignment.provider_name_other, 160) : "",
      pickup_location: text(assignment.pickup_location, 500),
      dropoff_location: text(assignment.dropoff_location, 500),
      trip_direction: text(assignment.trip_direction, 40),
      round_trip: "No",
      currency: "USD",
      assignment_status: status,
      provider_informed: informed,
      provider_informed_by: informed === "Yes" ? identity.staffCode : "",
      internal_note: text(assignment.internal_note, 2000),
      created_by: identity.staffCode,
    };
    if (providerName === "Other" && !record.provider_name_other) return json(400, { ok: false, error: "Enter the provider name." });
    await crmCall(env, "create_assignment", { guest_phone: record.guest_phone, assignment: record });
    const rows = await listRecords(env, "list_assignments", { guest_id: record.guest_id, inquiry_id: inquiryId });
    const verified = rows.map(normalizeAssignment).filter(item => item.inquiryId === inquiryId && item.serviceDate === serviceDate && item.providerName === (record.provider_name_other || providerName)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
    if (!verified) return json(202, { ok: true, verified: false, error: "Assignment was submitted but not verified. Refresh before retrying." });
    return json(201, { ok: true, verified: true, record: verified });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["POST"]); }
