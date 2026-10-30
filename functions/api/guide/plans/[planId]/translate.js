import { guideIdentity } from "../../../../lib/mobile-auth.mjs";
import { listRecords } from "../../../../lib/mobile-crm.mjs";
import { errorResponse, json, methodNotAllowed, assertSameOrigin, readJson, validId } from "../../../../lib/mobile-http.mjs";
import { isPlanRow, parsePlanRow } from "../../../../lib/guide-plans.mjs";
import { planTranslationSource, validatePlanTranslation } from "../../../../lib/guide-plan-translation.mjs";

export async function onRequestPost({ request, env, params }) {
  try {
    const identity = await guideIdentity(request, env);
    if (!['owner', 'agent'].includes(identity.role)) throw Object.assign(new Error("Only MBW administrators can translate itinerary drafts."), { status: 403 });
    assertSameOrigin(request, env);
    if (!env.CRM_SUMMARY_TOKEN) throw Object.assign(new Error("Local translation is not configured."), { status: 503 });
    const planId = validId(params.planId);
    const body = await readJson(request, 2000);
    const rows = await listRecords(env, "list_assignments", {});
    const row = rows.find(item => isPlanRow(item) && String(item.assignment_group_id) === `PLAN-${planId}`);
    if (!row) return json(404, { ok: false, error: "Tour plan not found." });
    if (body.updatedAt && String(body.updatedAt) !== String(row.updated_at || "")) return json(409, { ok: false, code: "PLAN_STALE", error: "This plan changed after you opened it. Refresh before translating." });
    const plan = await parsePlanRow(row);
    if (!plan) throw Object.assign(new Error("The saved plan could not be read safely."), { status: 409 });
    const source = planTranslationSource(plan);
    const response = await fetch("https://n8n.mindobirdwatching.com/webhook/mbw-guide-plan-local-translate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CRM-Summary-Key": env.CRM_SUMMARY_TOKEN, "User-Agent": "Mozilla/5.0 Guide Plan Translation" },
      body: JSON.stringify({ source }),
      signal: AbortSignal.timeout(55000),
    });
    if (!response.ok) throw new Error("Translation bridge unavailable.");
    const data = await response.json();
    const translation = validatePlanTranslation(data.result, source.days.map(day => day.id));
    return json(200, { ok: true, translation, model: typeof data.model === "string" ? data.model.slice(0, 100) : "local", generatedAt: new Date().toISOString(), reviewRequired: true });
  } catch (error) {
    console.error("guide_plan_translation_failed", { status: Number(error?.status || 500), message: String(error?.message || "Unknown translation error") });
    return errorResponse(error, "Local itinerary translation is unavailable. No plan was changed.");
  }
}

export function onRequestGet() { return methodNotAllowed(["POST"]); }
