import { guideIdentity } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { errorResponse, json, methodNotAllowed, assertSameOrigin, readJson, writesEnabled } from "../../../lib/mobile-http.mjs";

const dateValue = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
const timeValue = value => !value || /^\d{2}:\d{2}$/.test(String(value)) ? String(value || "") : null;

function assertGuideWrite(env, identity) {
  if (identity.role !== "guide") throw Object.assign(new Error("Admin preview is read-only."), { status: 403 });
  if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Availability updates are temporarily unavailable."), { status: 503 });
}

export async function onRequestPost({ request, env }) {
  try {
    const identity = await guideIdentity(request, env);
    assertGuideWrite(env, identity);
    assertSameOrigin(request, env);
    const body = await readJson(request, 4000);
    const serviceDate = dateValue(body.date);
    const startTime = timeValue(body.startTime), endTime = timeValue(body.endTime);
    if (!serviceDate) return json(400, { ok: false, error: "Choose a valid date." });
    if (startTime === null || endTime === null || (startTime && endTime && startTime >= endTime)) return json(400, { ok: false, error: "Choose a valid time range." });
    const groupId = `AVAIL-${crypto.randomUUID()}`;
    const assignment = {
      assignment_id: "", assignment_group_id: groupId, assignment_kind: "availability", inquiry_id: `GUIDE-AVAIL-${identity.providerId || "GUIDE"}`, guest_id: "", booking_id: "",
      service_date: serviceDate, start_time: startTime, end_time: endTime, service_type: "Guide Unavailable", product_selected: "Guide availability",
      provider_id: identity.providerId, provider_role: "guide", provider_name: identity.providerName, provider_name_other: "", assignment_status: "confirmed",
      provider_informed: "Yes", provider_informed_by: "JPG", confirmation_note: `[GUIDE_AVAILABILITY ${identity.providerId || identity.providerName}]`, internal_note: String(body.note || "").trim().slice(0, 500), created_by: "JPG",
    };
    await crmCall(env, "create_assignment", { guest_phone: "", assignment });
    const verified = (await listRecords(env, "list_assignments", {})).find(row => String(row.assignment_group_id) === groupId);
    if (!verified) return json(202, { ok: true, verified: false, error: "Availability was submitted but not verified. Refresh before retrying." });
    return json(201, { ok: true, verified: true, assignmentId: String(verified.assignment_id || "") });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["POST"]); }
