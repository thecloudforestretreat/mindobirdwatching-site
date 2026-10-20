import { mobileIdentity } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { normalizeAssignment } from "../../../lib/mobile-domain.mjs";
import { json, errorResponse, methodNotAllowed, assertSameOrigin, assertMobileWriteReady, readJson, validId } from "../../../lib/mobile-http.mjs";

export async function onRequestPatch({ request, env, params }) {
  try {
    const identity = await mobileIdentity(request, env);
    assertMobileWriteReady(env, identity);
    assertSameOrigin(request, env);
    const assignmentId = validId(params.assignmentId);
    const rows = await listRecords(env, "list_assignments", {});
    const current = rows.find(item => String(item.assignment_id) === assignmentId);
    if (!current) return json(404, { ok: false, error: "Assignment not found." });
    const body = await readJson(request, 8000);
    if (body.expectedUpdatedAt && String(body.expectedUpdatedAt) !== String(current.updated_at || "")) {
      return json(409, { ok: false, error: "This assignment changed since it was loaded. Refresh before saving." });
    }
    const allowed = new Set(["assignment_status", "provider_informed", "start_time", "end_time", "pickup_location", "dropoff_location", "internal_note"]);
    const patch = body.patch;
    if (!patch || typeof patch !== "object" || Array.isArray(patch) || !Object.keys(patch).length) return json(400, { ok: false, error: "No supported assignment changes were supplied." });
    for (const [field, value] of Object.entries(patch)) {
      if (!allowed.has(field) || typeof value !== "string" || value.length > (field === "internal_note" ? 2000 : 500)) return json(400, { ok: false, error: `Invalid field: ${field}` });
    }
    if (patch.assignment_status && !["pending", "confirmed", "cancelled", "completed"].includes(patch.assignment_status)) return json(400, { ok: false, error: "Invalid assignment status." });
    if (patch.provider_informed && !["Yes", "No"].includes(patch.provider_informed)) return json(400, { ok: false, error: "Invalid provider informed state." });
    const updated = { ...current, ...patch, created_by: current.created_by || identity.staffCode };
    if (patch.provider_informed === "Yes") updated.provider_informed_by = identity.staffCode;
    await crmCall(env, "update_assignment", { assignment: updated, expected_updated_at: current.updated_at || "" });
    const verifiedRows = await listRecords(env, "list_assignments", {});
    const verified = verifiedRows.find(item => String(item.assignment_id) === assignmentId);
    const matches = verified && Object.entries(patch).every(([field, value]) => String(verified[field] || "") === value);
    if (!matches) return json(202, { ok: true, verified: false, error: "Save was submitted but not verified. Refresh before retrying." });
    return json(200, { ok: true, verified: true, record: normalizeAssignment(verified) });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["PATCH"]); }
