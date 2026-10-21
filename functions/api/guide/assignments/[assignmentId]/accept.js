import { guideIdentity } from "../../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../../lib/mobile-crm.mjs";
import { errorResponse, json, methodNotAllowed, assertSameOrigin, validId, writesEnabled } from "../../../../lib/mobile-http.mjs";

const lower = value => String(value || "").trim().toLowerCase();
const belongsToGuide = (row, identity) => identity.providerId && row.provider_id
  ? String(row.provider_id) === identity.providerId
  : lower(row.provider_name === "Other" ? row.provider_name_other : row.provider_name) === lower(identity.providerName);
const assignmentKind = row => {
  const explicit = lower(row.assignment_kind);
  if (explicit) return explicit;
  if (String(row.assignment_group_id || "").startsWith("AVAIL-") || lower(row.service_type) === "guide unavailable") return "availability";
  if (String(row.assignment_group_id || "").startsWith("OFFER-") || lower(row.service_type) === "guide offer") return "offer";
  return "assignment";
};

function assertGuideWrite(env, identity) {
  if (identity.role !== "guide") throw Object.assign(new Error("Only the assigned guide can accept this tour."), { status: 403 });
  if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Guide responses are temporarily unavailable."), { status: 503 });
}

export async function onRequestPost({ request, env, params }) {
  try {
    const identity = await guideIdentity(request, env);
    assertGuideWrite(env, identity);
    assertSameOrigin(request, env);
    const assignmentId = validId(params.assignmentId);
    const rows = await listRecords(env, "list_assignments", {});
    const current = rows.find(row => String(row.assignment_id) === assignmentId);
    if (!current || !belongsToGuide(current, identity) || assignmentKind(current) !== "assignment") {
      return json(404, { ok: false, error: "Assignment not found." });
    }
    if (["cancelled", "canceled", "completed"].includes(lower(current.assignment_status))) return json(409, { ok: false, error: "This assignment can no longer be accepted." });
    const acceptedAt = new Date().toISOString();
    const previousConfirmation = String(current.confirmation_note || "").replace(/\n?\[GUIDE_ACCEPTED[^\]]*\]/gi, "").trim();
    const acceptanceMarker = `[GUIDE_ACCEPTED ${acceptedAt}|${identity.providerId || identity.providerName}]`;
    const updated = { ...current, assignment_status: "confirmed", provider_informed: "Yes", provider_informed_by: current.provider_informed_by || current.created_by || "JPG", confirmation_note: [previousConfirmation, acceptanceMarker].filter(Boolean).join("\n"), guide_response: "accepted", guide_responded_at: acceptedAt, guide_responded_by: identity.providerId || identity.name, created_by: current.created_by || "JPG" };
    await crmCall(env, "update_assignment", { assignment: updated, expected_updated_at: current.updated_at || "" });
    const verified = (await listRecords(env, "list_assignments", {})).find(row => String(row.assignment_id) === assignmentId);
    if (!verified || lower(verified.assignment_status) !== "confirmed" || lower(verified.provider_informed) !== "yes" || !/\[GUIDE_ACCEPTED(?:\s|\])/i.test(String(verified.confirmation_note || ""))) {
      return json(202, { ok: true, verified: false, error: "The response was submitted but not verified. Refresh before retrying." });
    }
    return json(200, { ok: true, verified: true, acceptedAt });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["POST"]); }
