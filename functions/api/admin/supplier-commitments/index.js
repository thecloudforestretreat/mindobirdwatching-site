import { guideIdentity } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { assertSameOrigin, errorResponse, json, methodNotAllowed, readJson, writesEnabled } from "../../../lib/mobile-http.mjs";
import { normalizeSupplierCommitment, summarizeSupplierCommitments, supplierCommitmentOptions } from "../../../lib/supplier-commitments.mjs";
import { attachSupplierTransactions, listSupplierTransactions, summarizeSupplierTransactions } from "../../../lib/supplier-transactions.mjs";

async function adminIdentity(request, env) {
  const identity = await guideIdentity(request, env);
  if (!["owner", "agent"].includes(identity.role)) throw Object.assign(new Error("Supplier commitments are available only to MBW administrators."), { status: 403 });
  return identity;
}

export async function onRequestGet({ request, env }) {
  try {
    await adminIdentity(request, env);
    const url = new URL(request.url);
    const filters = Object.fromEntries(["plan_id", "inquiry_id", "booking_id"].map(key => [key, String(url.searchParams.get(key) || "").trim()]).filter(([, value]) => value));
    if (!Object.keys(filters).length) return json(400, { ok: false, error: "A plan, inquiry, or booking reference is required." });
    const rawRecords = await listRecords(env, "list_supplier_commitments", filters);
    const transactions = await listSupplierTransactions(env, filters);
    const records = attachSupplierTransactions(rawRecords, transactions);
    const payments = filters.inquiry_id ? await listRecords(env, "list_payments", { inquiry_id: filters.inquiry_id }) : [];
    const guestPaid = payments.reduce((total, item) => total + Number(item.total_amount_paid || item.additional_amount_paid || item.deposit_amount_paid || 0), 0);
    return json(200, { ok: true, records, transactions, transactionSummary: summarizeSupplierTransactions(transactions), summary: summarizeSupplierCommitments(records, { guestPaid }), options: supplierCommitmentOptions });
  } catch (error) { return errorResponse(error); }
}

export async function onRequestPost({ request, env }) {
  try {
    const identity = await adminIdentity(request, env);
    if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Supplier commitment updates are temporarily unavailable."), { status: 503 });
    assertSameOrigin(request, env);
    const body = await readJson(request, 24000);
    const record = normalizeSupplierCommitment(body.commitment || body.record || body, { actor: identity.name || identity.email });
    const result = await crmCall(env, "upsert_supplier_commitment", { commitment: record });
    return json(200, { ok: true, verified: true, record: result.record || record });
  } catch (error) { return errorResponse(error); }
}

export function onRequestPut() { return methodNotAllowed(["GET", "POST"]); }
export function onRequestDelete() { return methodNotAllowed(["GET", "POST"]); }
