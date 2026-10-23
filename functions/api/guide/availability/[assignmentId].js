import { guideIdentity, identityMatchesProvider } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { errorResponse, json, methodNotAllowed, assertSameOrigin, validId, writesEnabled } from "../../../lib/mobile-http.mjs";

const lower = value => String(value || "").trim().toLowerCase();
const belongsToGuide = (row, identity) => identityMatchesProvider(identity, row.provider_id, row.provider_name === "Other" ? row.provider_name_other : row.provider_name);
const isAvailability = row => lower(row.assignment_kind) === "availability" || String(row.assignment_group_id || "").startsWith("AVAIL-") || lower(row.service_type) === "guide unavailable";

export async function onRequestDelete({ request, env, params }) {
  try {
    const identity = await guideIdentity(request, env);
    if (identity.role !== "guide") throw Object.assign(new Error("Admin preview is read-only."), { status: 403 });
    if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Availability updates are temporarily unavailable."), { status: 503 });
    assertSameOrigin(request, env);
    const assignmentId = validId(params.assignmentId);
    const current = (await listRecords(env, "list_assignments", {})).find(row => String(row.assignment_id) === assignmentId);
    if (!current || !belongsToGuide(current, identity) || !isAvailability(current)) return json(404, { ok: false, error: "Availability block not found." });
    await crmCall(env, "delete_assignment", { assignment: current });
    const remaining = (await listRecords(env, "list_assignments", {})).find(row => String(row.assignment_id) === assignmentId && lower(row.is_deleted) !== "yes");
    if (remaining) return json(202, { ok: true, verified: false, error: "Removal was submitted but not verified. Refresh before retrying." });
    return json(200, { ok: true, verified: true });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["DELETE"]); }
