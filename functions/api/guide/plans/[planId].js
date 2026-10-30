import { guideIdentity, identityMatchesProvider } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { errorResponse, json, methodNotAllowed, assertSameOrigin, readJson, validId, writesEnabled } from "../../../lib/mobile-http.mjs";
import { ROBERT_PLAN_ID, isNeicer, isPlanRow, parsePlanRow, planAssignment, planForGuide, robertPlan, sanitizePlan, validatePlanForReview } from "../../../lib/guide-plans.mjs";

const providerName = row => String(row.provider_name === "Other" ? row.provider_name_other : row.provider_name || "").trim();

export async function onRequestPost({ request, env, params }) {
  try {
    const identity = await guideIdentity(request, env);
    if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Tour plan updates are temporarily unavailable."), { status: 503 });
    assertSameOrigin(request, env);
    const planId = validId(params.planId), body = await readJson(request, 24000);
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
      if (currentRow && requestedProvider.providerId && !identityMatchesProvider({ providerId: requestedProvider.providerId, providerIds: [requestedProvider.providerId], providerName: requestedProvider.providerName }, currentRow.provider_id, providerName(currentRow))) return json(404, { ok: false, error: "Tour plan not found." });
    }
    const current = currentRow ? parsePlanRow(currentRow) : planId === ROBERT_PLAN_ID ? robertPlan({ providerId: requestedProvider.providerId, providerName: requestedProvider.providerName }) : null;
    if (!current) return json(409, { ok: false, error: "The saved plan could not be read safely." });
    if (currentRow && String(body.updatedAt || "") !== String(currentRow.updated_at || "")) {
      return json(409, { ok: false, code: "PLAN_STALE", error: "This plan changed after you opened it. Refresh before saving so no work is overwritten." });
    }
    const actor = { name: String(identity.name || identity.providerName || identity.email || "MBW Admin").slice(0, 120), role: identity.role === "guide" ? "guide" : "admin" };
    const allowedStatuses = actor.role === "guide" ? new Set(["guide_drafting", "admin_review"]) : new Set(["guide_drafting", "admin_review", "changes_requested", "approved"]);
    const requestedStatus = String(body.status || current.status);
    if (!allowedStatuses.has(requestedStatus)) return json(403, { ok: false, error: "You cannot move this plan to that status." });
    if (actor.role === "guide" && current.status === "approved") return json(409, { ok: false, code: "PLAN_LOCKED", error: "This approved plan is locked. Ask MBW to reopen it before editing." });
    if (actor.role === "admin" && requestedStatus === "approved" && current.status !== "admin_review") return json(409, { ok: false, code: "PLAN_TRANSITION", error: "The guide must submit the plan for review before it can be approved." });
    const currentComments = new Map((current.comments || []).map(item => [item.id, item]));
    const submittedComments = Array.isArray(body.comments) ? body.comments : current.comments;
    const comments = [...(current.comments || [])];
    for (const item of submittedComments) {
      if (currentComments.has(item?.id) || !String(item?.message || "").trim()) continue;
      comments.push({ ...item, author: actor.name, role: actor.role, createdAt: new Date().toISOString() });
    }
    const currentAdjustments = new Map((current.adjustments || []).map(item => [item.id, item]));
    const adjustments = (Array.isArray(body.adjustments) ? body.adjustments : current.adjustments).map(item => {
      const saved = currentAdjustments.get(item?.id);
      return saved ? { ...item, addedBy: saved.addedBy, addedAt: saved.addedAt } : { ...item, addedBy: actor.name, addedAt: new Date().toISOString() };
    });
    const incoming = {
      ...current,
      adjustments,
      comments,
      days: Array.isArray(body.days) ? body.days : current.days,
      status: requestedStatus,
      providerId: current.providerId || requestedProvider.providerId,
      providerName: current.providerName || requestedProvider.providerName,
      mbwPricing: actor.role === "admin" ? (body.mbwPricing || current.mbwPricing) : current.mbwPricing,
    };
    const plan = sanitizePlan(incoming, current);
    if (actor.role === "admin" && requestedStatus === "approved") {
      plan.mbwPricing.approvedAt = new Date().toISOString();
      plan.mbwPricing.approvedBy = actor.name;
    }
    if (current.status === "approved" && requestedStatus === "approved" && actor.role === "admin") {
      return json(409, { ok: false, code: "PLAN_LOCKED", error: "This approved plan is locked. Reopen it before making more changes." });
    }
    if (["admin_review", "approved"].includes(requestedStatus)) {
      const validationErrors = validatePlanForReview(plan);
      if (validationErrors.length) return json(400, { ok: false, code: "PLAN_VALIDATION", error: "Complete the highlighted itinerary details before submitting for review.", validationErrors });
    }
    if (requestedStatus === "approved" && plan.days.some(day => Number(plan.mbwPricing?.days?.find(item => item.dayId === day.id)?.sellPrice || 0) <= 0)) {
      return json(400, { ok: false, code: "PLAN_PRICING", error: "Enter the MBW price for every day before approving the itinerary." });
    }
    if (requestedStatus === "approved" && plan.days.some(day => {
      const pricing = plan.mbwPricing?.days?.find(item => item.dayId === day.id) || {};
      const lines = Array.isArray(pricing.guestLines) ? pricing.guestLines : [];
      const total = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
      return !lines.length || Math.abs(total - Number(pricing.sellPrice || 0)) > 0.009;
    })) {
      return json(400, { ok: false, code: "PLAN_GUEST_BREAKDOWN", error: "Complete the guest-facing price breakdown for every day. Each breakdown must equal that day's final price." });
    }
    if (!plan.providerId && !plan.providerName) return json(400, { ok: false, error: "The plan needs an assigned guide." });
    const changed = JSON.stringify(current.days) !== JSON.stringify(plan.days) || JSON.stringify(current.adjustments) !== JSON.stringify(plan.adjustments) || JSON.stringify(current.mbwPricing || {}) !== JSON.stringify(plan.mbwPricing || {}) || comments.length !== (current.comments || []).length || current.status !== plan.status;
    if (changed) {
      const action = current.status !== plan.status ? "status_changed" : comments.length !== (current.comments || []).length ? "comment_added" : "plan_updated";
      plan.history = [...(current.history || []), { id: crypto.randomUUID(), actor: actor.name, role: actor.role, action, fromStatus: current.status, toStatus: plan.status, changedAt: new Date().toISOString() }].slice(-100);
      if (["es", "en"].includes(body.editLanguage)) plan.localeUpdatedAt = { ...(current.localeUpdatedAt || {}), [body.editLanguage]: new Date().toISOString() };
    }
    const assignment = { ...(currentRow || {}), ...planAssignment(plan) };
    if (currentRow) await crmCall(env, "update_assignment", { assignment, expected_updated_at: currentRow.updated_at || "" });
    else await crmCall(env, "create_assignment", { guest_phone: "", assignment });
    const verified = (await listRecords(env, "list_assignments", {})).find(row => isPlanRow(row) && String(row.assignment_group_id) === `PLAN-${planId}`);
    const saved = verified && parsePlanRow(verified);
    if (!saved) return json(202, { ok: true, verified: false, error: "The plan was submitted but not verified. Refresh before retrying." });
    return json(currentRow ? 200 : 201, { ok: true, verified: true, plan: actor.role === "guide" ? planForGuide(saved) : saved });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["POST"]); }
