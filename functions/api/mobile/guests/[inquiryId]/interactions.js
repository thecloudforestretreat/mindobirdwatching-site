import { mobileIdentity } from "../../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../../lib/mobile-crm.mjs";
import { normalizeInteraction } from "../../../../lib/mobile-domain.mjs";
import { json, errorResponse, methodNotAllowed, assertSameOrigin, assertMobileWriteReady, readJson, validId } from "../../../../lib/mobile-http.mjs";

async function inquiry(env, inquiryId) {
  const records = await listRecords(env, "list_inquiries", { filters: {} });
  const record = records.find(item => String(item.inquiry_id) === inquiryId);
  if (!record) throw Object.assign(new Error("Guest inquiry not found."), { status: 404 });
  return record;
}

export async function onRequestGet({ request, env, params }) {
  try {
    await mobileIdentity(request, env);
    const inquiryId = validId(params.inquiryId);
    const record = await inquiry(env, inquiryId);
    const rows = await listRecords(env, "list_interactions", { guest_id: record.guest_id || "", inquiry_id: "" });
    return json(200, { ok: true, records: rows.map(normalizeInteraction), checkedAt: new Date().toISOString() });
  } catch (error) { return errorResponse(error); }
}

export async function onRequestPost({ request, env, params }) {
  try {
    const identity = await mobileIdentity(request, env);
    assertMobileWriteReady(env, identity);
    assertSameOrigin(request, env);
    const inquiryId = validId(params.inquiryId);
    const guest = await inquiry(env, inquiryId);
    const body = await readJson(request, 8000);
    const direction = String(body.direction || "internal").toLowerCase();
    const channel = String(body.channel || "other").toLowerCase();
    const type = String(body.type || "other").toLowerCase();
    const note = String(body.note || "").trim();
    if (!["incoming", "outgoing", "internal"].includes(direction)) return json(400, { ok: false, error: "Invalid communication direction." });
    if (!["whatsapp", "email", "phone", "website", "in_person", "other"].includes(channel)) return json(400, { ok: false, error: "Invalid communication channel." });
    if (!["guest_message", "staff_reply", "quote_sent", "itinerary_sent", "invoice_sent", "deposit_link_sent", "payment_received", "confirmation_sent", "follow_up", "internal_note", "other"].includes(type)) return json(400, { ok: false, error: "Invalid communication type." });
    if (!note || note.length > 4000) return json(400, { ok: false, error: "Enter a note up to 4,000 characters." });
    const followupAt = String(body.followupAt || "").trim();
    if (followupAt && Number.isNaN(Date.parse(followupAt))) return json(400, { ok: false, error: "Use a valid follow-up date and time." });
    const interaction = {
      interaction_id: "",
      guest_id: guest.guest_id || "",
      inquiry_id: inquiryId,
      booking_id: guest.booking_id || "",
      occurred_at: body.occurredAt && !Number.isNaN(Date.parse(body.occurredAt)) ? new Date(body.occurredAt).toISOString() : new Date().toISOString(),
      direction,
      channel,
      interaction_type: type,
      note,
      created_by: identity.staffCode,
      followup_required: followupAt ? "Yes" : "No",
      followup_at: followupAt ? new Date(followupAt).toISOString() : "",
    };
    const result = await crmCall(env, "create_interaction", { interaction });
    const saved = normalizeInteraction(result.record || interaction);
    if (!saved.interactionId) return json(202, { ok: true, verified: false, error: "Communication was submitted but its saved ID was not returned." });
    return json(201, { ok: true, verified: true, record: saved });
  } catch (error) { return errorResponse(error); }
}

export function onRequestPatch() { return methodNotAllowed(["GET", "POST"]); }
