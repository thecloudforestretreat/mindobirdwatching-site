import { mobileIdentity } from "../../../lib/mobile-auth.mjs";
import { listRecords } from "../../../lib/mobile-crm.mjs";
import { isPlanRow, parsePlanRow } from "../../../lib/guide-plans.mjs";
import { errorResponse, json, methodNotAllowed } from "../../../lib/mobile-http.mjs";

export async function onRequestGet({ request, env }) {
  try {
    // mobileIdentity accepts only MBW owner/agent roles. Guide accounts are
    // rejected before any CRM data is read, so guides can never enumerate plans.
    const identity = await mobileIdentity(request, env);
    if (!["owner", "agent"].includes(identity.role)) {
      throw Object.assign(new Error("This review queue is available only to MBW administrators."), { status: 403 });
    }
    const rows = await listRecords(env, "list_assignments", {});
    const plans = (await Promise.all(rows.filter(isPlanRow).map(parsePlanRow))).filter(Boolean).map(plan => {
      const latestActivity = [...(plan.history || [])].sort((left, right) => String(right.changedAt || "").localeCompare(String(left.changedAt || "")))[0] || null;
      return ({
        planId: plan.planId,
        inquiryId: plan.inquiryId,
        providerId: plan.providerId,
        providerName: plan.providerName,
        guestName: plan.guestName,
        title: plan.title,
        startDate: plan.startDate,
        endDate: plan.endDate,
        status: plan.status,
        updatedAt: plan.updatedAt,
        dayCount: plan.days?.length || 0,
        latestActivity: latestActivity ? { actor: latestActivity.actor, action: latestActivity.action, changedAt: latestActivity.changedAt } : null,
        openGuestRevisionCount: (plan.guestRevisions || []).filter(item => item.status !== "resolved").length,
      });
    }).sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
    return json(200, { ok: true, checkedAt: new Date().toISOString(), plans });
  } catch (error) { return errorResponse(error, "Custom itinerary reviews are unavailable."); }
}

export function onRequestPost() { return methodNotAllowed(["GET"]); }
