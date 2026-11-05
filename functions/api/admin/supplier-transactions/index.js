import { guideIdentity } from "../../../lib/mobile-auth.mjs";
import { assertSameOrigin, errorResponse, json, methodNotAllowed, readJson, writesEnabled } from "../../../lib/mobile-http.mjs";
import { listSupplierTransactions, normalizeSupplierTransaction, supplierTransactionCrmCall, supplierTransactionOptions } from "../../../lib/supplier-transactions.mjs";

async function adminIdentity(request, env) {
  const identity = await guideIdentity(request, env);
  if (!["owner", "agent"].includes(identity.role)) throw Object.assign(new Error("Supplier transactions are available only to MBW administrators."), { status: 403 });
  return identity;
}

export async function onRequestGet({ request, env }) {
  try {
    await adminIdentity(request, env);
    const url = new URL(request.url);
    const filters = Object.fromEntries(["commitment_id", "plan_id", "inquiry_id", "booking_id", "supplier_id"].map(key => [key, String(url.searchParams.get(key) || "").trim()]).filter(([, value]) => value));
    if (!Object.keys(filters).length) return json(400, { ok: false, error: "A commitment, plan, inquiry, booking, or supplier reference is required." });
    const records = await listSupplierTransactions(env, filters);
    return json(200, { ok: true, records, options: supplierTransactionOptions });
  } catch (error) { return errorResponse(error); }
}

export async function onRequestPost({ request, env }) {
  try {
    const identity = await adminIdentity(request, env);
    if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Supplier transaction updates are temporarily unavailable."), { status: 503 });
    assertSameOrigin(request, env);
    const body = await readJson(request, 24000);
    const record = normalizeSupplierTransaction(body.transaction || body.record || body, { actor: identity.name || identity.email });
    if (record.confirmation_number) {
      const existing = await listSupplierTransactions(env, { supplier_id: record.supplier_id, confirmation_number: record.confirmation_number });
      if (existing.some(item => item.supplier_transaction_id !== record.supplier_transaction_id)) throw Object.assign(new Error("That supplier confirmation number is already recorded."), { status: 409 });
    }
    const result = await supplierTransactionCrmCall(env, "upsert_supplier_transaction", { transaction: record });
    return json(200, { ok: true, verified: true, record: result.record || record });
  } catch (error) { return errorResponse(error); }
}

export function onRequestPut() { return methodNotAllowed(["GET", "POST"]); }
export function onRequestDelete() { return methodNotAllowed(["GET", "POST"]); }
