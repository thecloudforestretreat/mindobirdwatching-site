import { guideIdentity, identityMatchesProvider } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { errorResponse, json, methodNotAllowed, assertSameOrigin, readJson, validId, writesEnabled } from "../../../lib/mobile-http.mjs";
import { ROBERT_PLAN_ID, isNeicer, isPlanRow, parsePlanRow, planAssignment, robertPlan, sanitizePlan } from "../../../lib/guide-plans.mjs";

const providerName = row => String(row.provider_name === "Other" ? row.provider_name_other : row.provider_name || "").trim();

export async function onRequestPost({ request, env, params }) {
  try {
    const identity = await guideIdentity(request, env);
    if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Tour plan updates are temporarily unavailable."), { status: 503 });
    assertSameOrigin(request, env);
    const planId = validId(params.planId), body = await readJson(request, 24000);
    if (planId !== ROBERT_PLAN_ID) return json(404, { ok: false, error: "Tour plan not found." });
    const rows = await listRecords(env, "list_assignments", {});
    const currentRow = rows.find(row => isPlanRow(row) && String(row.assignment_group_id) === `PLAN-${planId}`);
    const requestedProvider = { providerId: String(body.providerId || "").trim(), providerName: String(body.providerName || "").trim() };
    if (identity.role === "guide") {
      if (!isNeicer(identity.providerName || identity.name)) return json(404, { ok: false, error: "Tour plan not found." });
      if (currentRow && !identityMatchesProvider(identity, currentRow.provider_id, providerName(currentRow))) return json(404, { ok: false, error: "Tour plan not found." });
      requestedProvider.providerId = identity.providerId;
      requestedProvider.providerName = identity.providerName || identity.name;
    } else {
      if (!isNeicer(requestedProvider.providerName) && !(currentRow && isNeicer(providerName(currentRow)))) return json(403, { ok: false, error: "Choose Neicer in Guide View before editing this plan." });
      if (currentRow && requestedProvider.providerId && String(currentRow.provider_id || "") !== requestedProvider.providerId) return json(404, { ok: false, error: "Tour plan not found." });
    }
    const current = currentRow ? parsePlanRow(currentRow) : robertPlan({ providerId: requestedProvider.providerId, providerName: requestedProvider.providerName });
    if (!current) return json(409, { ok: false, error: "The saved plan could not be read safely." });
    const incoming = {
      ...current,
      adjustments: Array.isArray(body.adjustments) ? body.adjustments : current.adjustments,
      comments: Array.isArray(body.comments) ? body.comments : current.comments,
      status: body.status || current.status,
      providerId: current.providerId || requestedProvider.providerId,
      providerName: current.providerName || requestedProvider.providerName,
    };
    const plan = sanitizePlan(incoming, current);
    if (!plan.providerId && !plan.providerName) return json(400, { ok: false, error: "The plan needs an assigned guide." });
    const assignment = { ...(currentRow || {}), ...planAssignment(plan) };
    if (currentRow) await crmCall(env, "update_assignment", { assignment, expected_updated_at: currentRow.updated_at || "" });
    else await crmCall(env, "create_assignment", { guest_phone: "", assignment });
    const verified = (await listRecords(env, "list_assignments", {})).find(row => isPlanRow(row) && String(row.assignment_group_id) === `PLAN-${planId}`);
    const saved = verified && parsePlanRow(verified);
    if (!saved) return json(202, { ok: true, verified: false, error: "The plan was submitted but not verified. Refresh before retrying." });
    return json(currentRow ? 200 : 201, { ok: true, verified: true, plan: saved });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["POST"]); }
