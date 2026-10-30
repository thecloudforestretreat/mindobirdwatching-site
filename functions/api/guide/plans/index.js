import { guideIdentity } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { errorResponse, json, methodNotAllowed, assertSameOrigin, readJson, writesEnabled } from "../../../lib/mobile-http.mjs";
import { blankPlan, isNeicer, isPlanRow, parsePlanRow, planAssignment, sanitizePlan } from "../../../lib/guide-plans.mjs";

const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
const bilingual = (value, max = 1200) => {
  const text = clean(value, max);
  return { es: text, en: text };
};

function planIdFor(guestName, startDate) {
  const slug = clean(guestName, 80).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "guest";
  return `${slug}-${startDate.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function onRequestPost({ request, env }) {
  try {
    const identity = await guideIdentity(request, env);
    if (identity.role === "guide") return json(403, { ok: false, error: "Only MBW administrators can create a tour plan." });
    if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Tour plan creation is temporarily unavailable."), { status: 503 });
    assertSameOrigin(request, env);
    const body = await readJson(request, 18000);
    const providerId = clean(body.providerId, 128), providerName = clean(body.providerName, 160);
    const guestName = clean(body.guestName, 160), startDate = clean(body.startDate, 10), endDate = clean(body.endDate || body.startDate, 10);
    if (!providerId && !providerName) return json(400, { ok: false, error: "Choose the guide who will build this plan." });
    if (!isNeicer(providerName)) return json(403, { ok: false, error: "Custom planning is currently enabled only for the Neicer pilot." });
    if (!guestName || !validDate(startDate) || !validDate(endDate) || endDate < startDate) return json(400, { ok: false, error: "Guest name and a valid date range are required." });
    const dayCount = Math.round((new Date(`${endDate}T12:00:00Z`) - new Date(`${startDate}T12:00:00Z`)) / 86400000) + 1;
    if (dayCount > 24) return json(400, { ok: false, error: "A plan can contain up to 24 consecutive days." });
    const planId = planIdFor(guestName, startDate);
    const base = blankPlan({
      planId,
      inquiryId: clean(body.inquiryId, 128) || `CUSTOM-${planId}`,
      providerId,
      providerName,
      guestName,
      title: bilingual(clean(body.title, 240) || `${guestName} · Custom itinerary`, 240),
      startDate,
      endDate,
      brief: {
        guestCount: clean(body.guestCount, 12) || "1",
        traveler: bilingual(body.traveler),
        lodging: bilingual(body.lodging),
        pickup: bilingual(body.pickup),
        dropoff: bilingual(body.dropoff),
        request: bilingual(body.request, 1800),
        interests: bilingual(body.interests, 1800),
      },
    });
    const plan = sanitizePlan(base, base);
    plan.history = [{ id: crypto.randomUUID(), actor: clean(identity.name || identity.email || "MBW Admin", 120), role: "admin", action: "plan_created", fromStatus: "", toStatus: plan.status, changedAt: new Date().toISOString() }];
    await crmCall(env, "create_assignment", { guest_phone: "", assignment: await planAssignment(plan) });
    const verified = (await listRecords(env, "list_assignments", {})).find(row => isPlanRow(row) && String(row.assignment_group_id) === `PLAN-${planId}`);
    const saved = verified && await parsePlanRow(verified);
    if (!saved) return json(202, { ok: true, verified: false, error: "The plan was submitted but not verified. Refresh before retrying." });
    return json(201, { ok: true, verified: true, plan: saved });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["POST"]); }
