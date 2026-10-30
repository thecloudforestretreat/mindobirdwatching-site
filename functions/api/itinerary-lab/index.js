import { mobileIdentity } from "../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../lib/mobile-crm.mjs";
import { errorResponse, json, methodNotAllowed, assertSameOrigin, readJson, writesEnabled } from "../../lib/mobile-http.mjs";
import { isKnowledgeRow, knowledgeAssignment, knowledgeValidation, parseKnowledgeRow, sanitizeKnowledge, seedKnowledge } from "../../lib/itinerary-knowledge.mjs";

const owner = async (request, env) => {
  const identity = await mobileIdentity(request, env);
  if (identity.role !== "owner") throw Object.assign(new Error("Itinerary Lab is available only to the MBW owner."), { status: 403 });
  return identity;
};

async function records(env) {
  const rows = await listRecords(env, "list_assignments", {});
  const saved = rows.filter(isKnowledgeRow).map(parseKnowledgeRow).filter(Boolean);
  const ids = new Set(saved.map(item => item.sourceId));
  return [...saved, ...seedKnowledge().filter(item => !ids.has(item.sourceId)).map(item => sanitizeKnowledge(item, item))].sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
}

export async function onRequestGet({ request, env }) {
  try {
    const identity = await owner(request, env);
    return json(200, { ok: true, identity: { name: identity.name, role: identity.role }, records: await records(env), checkedAt: new Date().toISOString() });
  } catch (error) { return errorResponse(error); }
}

export async function onRequestPost({ request, env }) {
  try {
    const identity = await owner(request, env);
    if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Knowledge saves are temporarily unavailable."), { status: 503 });
    assertSameOrigin(request, env);
    const body = await readJson(request, 48000), input = body.record || {};
    const currentRows = await listRecords(env, "list_assignments", {});
    const currentRow = currentRows.find(row => isKnowledgeRow(row) && String(row.assignment_group_id) === `KNOW-${String(input.sourceId || "")}`);
    const current = currentRow ? parseKnowledgeRow(currentRow) : seedKnowledge().find(item => item.sourceId === input.sourceId) || {};
    if (currentRow && String(body.expectedUpdatedAt || "") !== String(currentRow.updated_at || "")) return json(409, { ok: false, code: "KNOWLEDGE_STALE", error: "This source changed after you opened it. Refresh before saving." });
    const now = new Date().toISOString();
    const generatedId = `${String(input.title || "source").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "source"}-${crypto.randomUUID().slice(0, 8)}`;
    const record = sanitizeKnowledge({ ...current, ...input, sourceId: input.sourceId || generatedId, createdAt: current.createdAt || now, updatedAt: now, synthetic: false }, current);
    if (record.status === "approved") {
      const errors = knowledgeValidation(record);
      if (errors.length) return json(400, { ok: false, code: "KNOWLEDGE_VALIDATION", error: "Complete the required evidence before approval.", validationErrors: errors });
      record.approvedAt = now; record.approvedBy = identity.name || identity.email;
    } else { record.approvedAt = ""; record.approvedBy = ""; }
    const assignment = { ...(currentRow || {}), ...knowledgeAssignment(record) };
    if (currentRow) await crmCall(env, "update_assignment", { assignment, expected_updated_at: currentRow.updated_at || "" });
    else await crmCall(env, "create_assignment", { guest_phone: "", assignment });
    const verifiedRow = (await listRecords(env, "list_assignments", {})).find(row => isKnowledgeRow(row) && String(row.assignment_group_id) === `KNOW-${record.sourceId}`);
    const verified = verifiedRow && parseKnowledgeRow(verifiedRow);
    if (!verified) return json(202, { ok: true, verified: false, error: "The source was submitted but not verified. Refresh before retrying." });
    return json(currentRow ? 200 : 201, { ok: true, verified: true, record: verified });
  } catch (error) { return errorResponse(error); }
}

export function onRequestPut() { return methodNotAllowed(["GET", "POST"]); }
