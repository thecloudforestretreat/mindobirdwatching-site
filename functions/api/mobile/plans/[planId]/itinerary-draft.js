import { mobileIdentity } from "../../../../lib/mobile-auth.mjs";
import { listRecords } from "../../../../lib/mobile-crm.mjs";
import { guestItineraryDraft, isPlanRow, parsePlanRow } from "../../../../lib/guide-plans.mjs";
import { errorResponse, json, methodNotAllowed, validId } from "../../../../lib/mobile-http.mjs";

export async function onRequestGet({ request, env, params }) {
  try {
    const identity = await mobileIdentity(request, env);
    if (!["owner", "agent"].includes(identity.role)) {
      throw Object.assign(new Error("Only MBW administrators can prepare a guest itinerary."), { status: 403 });
    }
    const planId = validId(params.planId);
    const rows = await listRecords(env, "list_assignments", {});
    const plan = rows.filter(isPlanRow).map(parsePlanRow).find(item => item?.planId === planId);
    if (!plan) throw Object.assign(new Error("The itinerary plan was not found."), { status: 404 });
    return json(200, { ok: true, draft: guestItineraryDraft(plan) });
  } catch (error) {
    return errorResponse(error, "The guest itinerary draft is unavailable.");
  }
}

export function onRequestPost() { return methodNotAllowed(["GET"]); }
