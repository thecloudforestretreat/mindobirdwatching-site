import { guideIdentity, identityMatchesProvider } from "../../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../../lib/mobile-crm.mjs";
import { errorResponse, json, methodNotAllowed, assertSameOrigin, readJson, validId, writesEnabled } from "../../../../lib/mobile-http.mjs";
import { isNeicer } from "../../../../lib/guide-plans.mjs";

const lower = value => String(value || "").trim().toLowerCase();
const belongsToGuide = (row, identity) => identityMatchesProvider(identity, row.provider_id, row.provider_name === "Other" ? row.provider_name_other : row.provider_name);
const isOffer = row => lower(row.assignment_kind) === "offer" || String(row.assignment_group_id || "").startsWith("OFFER-") || lower(row.service_type) === "guide offer";

export async function onRequestPost({ request, env, params }) {
  try {
    const identity = await guideIdentity(request, env);
    if (identity.role !== "guide") throw Object.assign(new Error("Admin preview is read-only."), { status: 403 });
    if (!isNeicer(identity.providerName || identity.name)) return json(404, { ok: false, error: "Tour offer not found." });
    if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Offer responses are temporarily unavailable."), { status: 503 });
    assertSameOrigin(request, env);
    const assignmentId = validId(params.assignmentId), body = await readJson(request, 3000);
    const response = lower(body.response);
    if (!new Set(["interested", "pass"]).has(response)) return json(400, { ok: false, error: "Choose interested or pass." });
    const amount = String(body.bidAmount || "").trim();
    if (amount && (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)) return json(400, { ok: false, error: "Enter a valid bid amount." });
    const current = (await listRecords(env, "list_assignments", {})).find(row => String(row.assignment_id) === assignmentId);
    if (!current || !belongsToGuide(current, identity) || !isOffer(current)) return json(404, { ok: false, error: "Tour offer not found." });
    const respondedAt = new Date().toISOString(), bid = response === "interested" ? amount : "";
    const previousConfirmation = String(current.confirmation_note || "").replace(/\n?\[GUIDE_RESPONSE[^\]]*\]/gi, "").trim();
    const responseMarker = `[GUIDE_RESPONSE ${response}|${bid}|${respondedAt}|${identity.providerId || identity.providerName}]`;
    const updated = { ...current, confirmation_note: [previousConfirmation, responseMarker].filter(Boolean).join("\n"), guide_response: response, guide_bid_amount: bid, guide_responded_at: respondedAt, guide_responded_by: identity.providerId || identity.name, created_by: current.created_by || "JPG" };
    await crmCall(env, "update_assignment", { assignment: updated, expected_updated_at: current.updated_at || "" });
    const verified = (await listRecords(env, "list_assignments", {})).find(row => String(row.assignment_id) === assignmentId);
    if (!verified || !new RegExp(`\\[GUIDE_RESPONSE\\s+${response}(?:\\||\\])`, "i").test(String(verified.confirmation_note || ""))) return json(202, { ok: true, verified: false, error: "The response was submitted but not verified. Refresh before retrying." });
    return json(200, { ok: true, verified: true });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["POST"]); }
