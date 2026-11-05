const TYPES = new Set(["deposit", "balance", "full_payment", "refund", "credit"]);
const METHODS = new Set(["bank_transfer", "credit_card", "cash", "zelle", "other"]);
const CURRENCIES = new Set(["USD", "EUR", "GBP"]);

const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const amount = value => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) throw Object.assign(new Error("Transaction amount must be greater than zero."), { status: 400 });
  return Math.round(parsed * 100) / 100;
};
const date = value => {
  const clean = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw Object.assign(new Error("Transaction date must use YYYY-MM-DD."), { status: 400 });
  return clean;
};

export function normalizeSupplierTransaction(input = {}, { actor = "", existing = null } = {}) {
  const now = new Date().toISOString();
  const transactionId = text(input.supplier_transaction_id || existing?.supplier_transaction_id || `ST-${crypto.randomUUID()}`, 128);
  const commitmentId = text(input.commitment_id ?? existing?.commitment_id, 128);
  const supplierName = text(input.supplier_name ?? existing?.supplier_name, 180);
  const type = text(input.transaction_type || existing?.transaction_type || "deposit", 40).toLowerCase();
  const method = text(input.payment_method || existing?.payment_method || "bank_transfer", 40).toLowerCase();
  const currency = text(input.currency || existing?.currency || "USD", 3).toUpperCase();
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(transactionId)) throw Object.assign(new Error("Invalid supplier transaction ID."), { status: 400 });
  if (!commitmentId || !supplierName) throw Object.assign(new Error("A supplier commitment and supplier name are required."), { status: 400 });
  if (!TYPES.has(type)) throw Object.assign(new Error("Choose a valid transaction type."), { status: 400 });
  if (!METHODS.has(method)) throw Object.assign(new Error("Choose a valid payment method."), { status: 400 });
  if (!CURRENCIES.has(currency)) throw Object.assign(new Error("Choose a supported currency."), { status: 400 });
  const confirmationNumber = text(input.confirmation_number ?? existing?.confirmation_number, 240);
  if (["bank_transfer", "credit_card", "zelle"].includes(method) && !confirmationNumber) throw Object.assign(new Error("A confirmation number is required for electronic payments."), { status: 400 });
  const evidenceUrl = text(input.evidence_url ?? existing?.evidence_url, 1000);
  if (evidenceUrl) {
    let parsed;
    try { parsed = new URL(evidenceUrl); } catch { throw Object.assign(new Error("Evidence must be a valid HTTPS URL."), { status: 400 }); }
    if (parsed.protocol !== "https:") throw Object.assign(new Error("Evidence must use HTTPS."), { status: 400 });
  }
  return {
    supplier_transaction_id: transactionId,
    commitment_id: commitmentId,
    inquiry_id: text(input.inquiry_id ?? existing?.inquiry_id, 128),
    booking_id: text(input.booking_id ?? existing?.booking_id, 128),
    plan_id: text(input.plan_id ?? existing?.plan_id, 128),
    supplier_id: text(input.supplier_id ?? existing?.supplier_id, 128),
    supplier_name: supplierName,
    transaction_type: type,
    payment_method: method,
    transaction_date: date(input.transaction_date ?? existing?.transaction_date),
    currency,
    amount: amount(input.amount ?? existing?.amount),
    confirmation_number: confirmationNumber,
    evidence_url: evidenceUrl,
    internal_notes: text(input.internal_notes ?? existing?.internal_notes, 2000),
    entered_by: text(actor || existing?.entered_by, 160),
    created_at: text(existing?.created_at || input.created_at || now, 80),
    updated_at: now,
  };
}

export function summarizeSupplierTransactions(records = []) {
  const total = type => records.filter(item => item.transaction_type === type).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const cashPaid = total("deposit") + total("balance") + total("full_payment") - total("refund");
  const credits = total("credit");
  return { cashPaid: Math.round(cashPaid * 100) / 100, credits: Math.round(credits * 100) / 100, settled: Math.round((cashPaid + credits) * 100) / 100, count: records.length };
}

export function attachSupplierTransactions(commitments = [], transactions = []) {
  return commitments.map(commitment => {
    const history = transactions.filter(item => item.commitment_id === commitment.commitment_id).sort((a, b) => String(b.transaction_date || b.created_at).localeCompare(String(a.transaction_date || a.created_at)));
    const summary = summarizeSupplierTransactions(history);
    return { ...commitment, amount_paid: history.length ? summary.cashPaid : Number(commitment.amount_paid || 0), credit_applied: summary.credits, transaction_count: history.length, transactions: history };
  });
}

export const supplierTransactionOptions = { types: [...TYPES], methods: [...METHODS], currencies: [...CURRENCIES] };

export async function supplierTransactionCrmCall(env, action, data = {}, timeoutMs = 25000) {
  const url = String(env.N8N_SUPPLIER_TRANSACTION_URL || "https://n8n.mindobirdwatching.com/webhook/mbw-supplier-transactions-api").trim();
  const token = String(env.N8N_CRM_ADMIN_TOKEN || "").trim();
  if (!url.startsWith("https://") || !token) throw Object.assign(new Error("Supplier transaction storage is not configured."), { status: 503 });
  let response;
  try {
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "X-MBW-CRM-Key": token }, body: new URLSearchParams({ payload: JSON.stringify({ action, ...data }) }).toString(), signal: AbortSignal.timeout(timeoutMs) });
  } catch { throw Object.assign(new Error("Supplier transaction storage is unavailable. No change was confirmed."), { status: 503 }); }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || body.ok === false) throw Object.assign(new Error(body?.error || "Supplier transaction storage rejected the request."), { status: response.status === 409 ? 409 : 502 });
  return body;
}

export async function listSupplierTransactions(env, filters = {}) {
  const result = await supplierTransactionCrmCall(env, "list_supplier_transactions", filters);
  return Array.isArray(result.records) ? result.records : Array.isArray(result.data) ? result.data : [];
}
