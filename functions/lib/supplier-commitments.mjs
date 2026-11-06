const CATEGORIES = new Set(["lodging", "guide", "transportation", "reserve", "activity", "meal", "flight", "other"]);
const CURRENCIES = new Set(["USD", "EUR", "GBP"]);
const PAYMENT_STATUSES = new Set(["not_committed", "quoted", "confirmed_no_deposit", "deposit_due", "partially_paid", "paid", "refunded", "credited", "cancelled"]);
const REFUNDABILITY = new Set(["unknown", "refundable", "partially_refundable", "nonrefundable"]);

const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const amount = value => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw Object.assign(new Error("Amounts must be zero or greater."), { status: 400 });
  return Math.round(parsed * 100) / 100;
};
const date = value => {
  const clean = text(value, 10);
  if (clean && !/^\d{4}-\d{2}-\d{2}$/.test(clean)) throw Object.assign(new Error("Dates must use YYYY-MM-DD."), { status: 400 });
  return clean;
};

export function normalizeSupplierCommitment(input = {}, { actor = "", existing = null } = {}) {
  const now = new Date().toISOString();
  const commitmentId = text(input.commitment_id || existing?.commitment_id || `SC-${crypto.randomUUID()}`, 128);
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(commitmentId)) throw Object.assign(new Error("Invalid commitment ID."), { status: 400 });
  const category = text(input.category || existing?.category || "other", 40).toLowerCase();
  const currency = text(input.currency || existing?.currency || "USD", 3).toUpperCase();
  const paymentStatus = text(input.payment_status || existing?.payment_status || "not_committed", 40).toLowerCase();
  const refundability = text(input.refundability || existing?.refundability || "unknown", 40).toLowerCase();
  if (!CATEGORIES.has(category)) throw Object.assign(new Error("Choose a valid supplier category."), { status: 400 });
  if (!CURRENCIES.has(currency)) throw Object.assign(new Error("Choose a supported currency."), { status: 400 });
  if (!PAYMENT_STATUSES.has(paymentStatus)) throw Object.assign(new Error("Choose a valid payment status."), { status: 400 });
  if (!REFUNDABILITY.has(refundability)) throw Object.assign(new Error("Choose a valid refundability status."), { status: 400 });

  const quotedCost = amount(input.quoted_cost ?? existing?.quoted_cost);
  const committedCost = amount(input.committed_cost ?? existing?.committed_cost);
  const amountPaid = amount(input.amount_paid ?? existing?.amount_paid);
  const refundableAmount = amount(input.refundable_amount ?? existing?.refundable_amount);
  if (committedCost > 0 && amountPaid > committedCost + 0.009) throw Object.assign(new Error("Amount paid cannot exceed the committed supplier cost."), { status: 400 });
  if (refundableAmount > amountPaid + 0.009) throw Object.assign(new Error("Refundable amount cannot exceed the amount paid."), { status: 400 });
  if (refundability === "nonrefundable" && refundableAmount > 0) throw Object.assign(new Error("A nonrefundable commitment cannot have a refundable amount."), { status: 400 });
  if (["partially_paid", "paid"].includes(paymentStatus) && amountPaid <= 0) throw Object.assign(new Error("A paid status requires an amount paid."), { status: 400 });
  if (paymentStatus === "confirmed_no_deposit" && amountPaid > 0) throw Object.assign(new Error("A no-deposit confirmation cannot include an amount paid."), { status: 400 });

  const evidenceUrl = text(input.evidence_url ?? existing?.evidence_url, 1000);
  if (evidenceUrl) {
    let parsed;
    try { parsed = new URL(evidenceUrl); } catch { throw Object.assign(new Error("Evidence must be a valid HTTPS URL."), { status: 400 }); }
    if (parsed.protocol !== "https:") throw Object.assign(new Error("Evidence must use HTTPS."), { status: 400 });
  }
  const supplierName = text(input.supplier_name ?? existing?.supplier_name, 180);
  const description = text(input.description ?? existing?.description, 600);
  const planId = text(input.plan_id ?? existing?.plan_id, 128);
  const inquiryId = text(input.inquiry_id ?? existing?.inquiry_id, 128);
  if (!supplierName || !description || (!planId && !inquiryId)) {
    throw Object.assign(new Error("Supplier, description, and a plan or inquiry reference are required."), { status: 400 });
  }

  return {
    commitment_id: commitmentId,
    inquiry_id: inquiryId,
    booking_id: text(input.booking_id ?? existing?.booking_id, 128),
    plan_id: planId,
    supplier_id: text(input.supplier_id ?? existing?.supplier_id, 128),
    supplier_name: supplierName,
    category,
    description,
    service_date_start: date(input.service_date_start ?? existing?.service_date_start),
    service_date_end: date(input.service_date_end ?? existing?.service_date_end),
    currency,
    quoted_cost: quotedCost,
    committed_cost: committedCost,
    amount_paid: amountPaid,
    payment_status: paymentStatus,
    refundability,
    refundable_amount: refundableAmount,
    cancellation_deadline: date(input.cancellation_deadline ?? existing?.cancellation_deadline),
    confirmation_reference: text(input.confirmation_reference ?? existing?.confirmation_reference, 240),
    evidence_url: evidenceUrl,
    internal_notes: text(input.internal_notes ?? existing?.internal_notes, 2000),
    entered_by: text(actor || existing?.entered_by, 160),
    created_at: text(existing?.created_at || input.created_at || now, 80),
    updated_at: now,
  };
}

export function summarizeSupplierCommitments(records = [], { guestTotal = 0, guestPaid = 0 } = {}) {
  const active = records.filter(item => !["cancelled", "refunded"].includes(String(item.payment_status || "").toLowerCase()));
  const sum = key => active.reduce((total, item) => total + Number(item[key] || 0), 0);
  const quotedCost = sum("quoted_cost");
  const committedCost = sum("committed_cost");
  const supplierPaid = sum("amount_paid");
  const refundable = active.reduce((total, item) => total + Number(item.refundable_amount || 0), 0);
  const nonrefundableExposure = active.reduce((total, item) => {
    const paid = Number(item.amount_paid || 0), knownRefundable = Number(item.refundable_amount || 0);
    return total + (item.refundability === "nonrefundable" ? paid : item.refundability === "partially_refundable" ? Math.max(0, paid - knownRefundable) : 0);
  }, 0);
  const unknownExposure = active.filter(item => item.refundability === "unknown").reduce((total, item) => total + Number(item.amount_paid || 0), 0);
  return {
    count: active.length,
    quotedCost: Math.round(quotedCost * 100) / 100,
    committedCost: Math.round(committedCost * 100) / 100,
    supplierPaid: Math.round(supplierPaid * 100) / 100,
    refundableAmount: Math.round(refundable * 100) / 100,
    nonrefundableExposure: Math.round(nonrefundableExposure * 100) / 100,
    unknownExposure: Math.round(unknownExposure * 100) / 100,
    guestTotal: amount(guestTotal),
    guestPaid: amount(guestPaid),
    unallocatedGuestFunds: Math.max(0, Math.round((Number(guestPaid || 0) - supplierPaid) * 100) / 100),
    expectedGrossProfit: Math.round((Number(guestTotal || 0) - committedCost) * 100) / 100,
  };
}

export const supplierCommitmentOptions = {
  categories: [...CATEGORIES], currencies: [...CURRENCIES], paymentStatuses: [...PAYMENT_STATUSES], refundability: [...REFUNDABILITY],
};
