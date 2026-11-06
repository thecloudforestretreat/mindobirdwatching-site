const CATEGORY = ["lodging", "guide", "transportation", "reserve", "activity", "meal", "flight", "other"];
const STATUS = ["not_committed", "quoted", "confirmed_no_deposit", "deposit_due", "partially_paid", "paid", "refunded", "credited", "cancelled"];
const REFUNDABILITY = ["unknown", "refundable", "partially_refundable", "nonrefundable"];
const TRANSACTION_TYPES = ["deposit", "balance", "full_payment", "refund", "credit"];
const PAYMENT_METHODS = ["bank_transfer", "credit_card", "cash", "zelle", "other"];

const labels = {
  en: {
    title: "Supplier commitments", help: "Private MBW ledger for hotel, guide, transport, reserve, and activity costs. Nothing here is visible to the guide or guest.",
    quoted: "Quoted", committed: "Committed", paid: "Paid to suppliers", exposure: "Nonrefundable exposure", unknown: "Refundability unknown", profit: "Expected gross profit", guestPaid: "Guest funds received", unallocated: "Guest funds not yet paid to suppliers",
    empty: "No supplier commitments recorded for this plan.", add: "Add supplier commitment", edit: "Edit record", save: "Save commitment", saving: "Saving…", supplier: "Supplier", category: "Category", description: "Service or reservation", start: "Service start", end: "Service end", quotedCost: "Quoted cost", committedCost: "Committed cost", amountPaid: "Amount paid", paymentStatus: "Payment status", refundability: "Refundability", refundableAmount: "Refundable amount", deadline: "Cancellation deadline", reference: "Confirmation number", evidence: "Evidence URL", notes: "Internal notes", openEvidence: "Open evidence", close: "Close", currency: "Currency", saved: "Supplier commitment saved.", retry: "Retry", addTransaction: "Record supplier payment or adjustment", transactionType: "Transaction type", paymentMethod: "Payment method", transactionDate: "Transaction date", transactionAmount: "Amount", transactionHistory: "Transaction history", noTransactions: "No payments or adjustments recorded yet.", saveTransaction: "Record transaction", transactionSaved: "Supplier transaction recorded.", credits: "Credits applied", remaining: "Remaining to pay",
  },
  es: {
    title: "Compromisos con proveedores", help: "Registro privado de MBW para hoteles, guías, transporte, reservas y actividades. El guía y el huésped no ven esta información.",
    quoted: "Cotizado", committed: "Comprometido", paid: "Pagado a proveedores", exposure: "Exposición no reembolsable", unknown: "Reembolsabilidad pendiente", profit: "Ganancia bruta esperada", guestPaid: "Fondos recibidos del huésped", unallocated: "Fondos del huésped aún no pagados a proveedores",
    empty: "No hay compromisos de proveedores para este itinerario.", add: "Agregar compromiso", edit: "Editar registro", save: "Guardar compromiso", saving: "Guardando…", supplier: "Proveedor", category: "Categoría", description: "Servicio o reserva", start: "Inicio del servicio", end: "Fin del servicio", quotedCost: "Costo cotizado", committedCost: "Costo comprometido", amountPaid: "Monto pagado", paymentStatus: "Estado de pago", refundability: "Reembolsabilidad", refundableAmount: "Monto reembolsable", deadline: "Fecha límite de cancelación", reference: "Número de confirmación", evidence: "URL de respaldo", notes: "Notas internas", openEvidence: "Abrir respaldo", close: "Cerrar", currency: "Moneda", saved: "Compromiso guardado.", retry: "Reintentar", addTransaction: "Registrar pago o ajuste del proveedor", transactionType: "Tipo de transacción", paymentMethod: "Método de pago", transactionDate: "Fecha de transacción", transactionAmount: "Monto", transactionHistory: "Historial de transacciones", noTransactions: "Aún no hay pagos ni ajustes registrados.", saveTransaction: "Registrar transacción", transactionSaved: "Transacción del proveedor registrada.", credits: "Créditos aplicados", remaining: "Saldo por pagar",
  },
};

const t = (language, key) => labels[language]?.[key] || labels.en[key] || key;
const selected = (value, expected) => value === expected ? " selected" : "";
const field = (esc, value) => esc(value ?? "");
const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const optionLabel = value => value.replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase());

function form(record, plan, language, esc, open = false) {
  const item = record || {};
  return `<details class="supplierFormDisclosure" ${open ? "open" : ""}><summary>${esc(record ? t(language, "edit") : t(language, "add"))}</summary><form class="supplierCommitmentForm" data-supplier-commitment-form data-plan-id="${esc(plan.planId)}">
    <input type="hidden" name="commitment_id" value="${field(esc, item.commitment_id)}"><input type="hidden" name="plan_id" value="${esc(plan.planId)}"><input type="hidden" name="inquiry_id" value="${field(esc, plan.inquiryId)}">
    <label><span>${esc(t(language, "supplier"))}</span><input name="supplier_name" maxlength="180" value="${field(esc, item.supplier_name)}" required></label>
    <label><span>${esc(t(language, "category"))}</span><select name="category">${CATEGORY.map(value => `<option value="${value}"${selected(value, item.category || "other")}>${esc(optionLabel(value))}</option>`).join("")}</select></label>
    <label class="wide"><span>${esc(t(language, "description"))}</span><input name="description" maxlength="600" value="${field(esc, item.description)}" required></label>
    <label><span>${esc(t(language, "start"))}</span><input name="service_date_start" type="date" value="${field(esc, item.service_date_start)}"></label>
    <label><span>${esc(t(language, "end"))}</span><input name="service_date_end" type="date" value="${field(esc, item.service_date_end)}"></label>
    <label><span>${esc(t(language, "currency"))}</span><select name="currency">${["USD", "EUR", "GBP"].map(value => `<option value="${value}"${selected(value, item.currency || "USD")}>${value}</option>`).join("")}</select></label>
    <label><span>${esc(t(language, "quotedCost"))}</span><input name="quoted_cost" type="number" min="0" step="0.01" value="${field(esc, item.quoted_cost || 0)}"></label>
    <label><span>${esc(t(language, "committedCost"))}</span><input name="committed_cost" type="number" min="0" step="0.01" value="${field(esc, item.committed_cost || 0)}"></label>
    <label><span>${esc(t(language, "paymentStatus"))}</span><select name="payment_status">${STATUS.map(value => `<option value="${value}"${selected(value, item.payment_status || "not_committed")}>${esc(optionLabel(value))}</option>`).join("")}</select></label>
    <label><span>${esc(t(language, "refundability"))}</span><select name="refundability">${REFUNDABILITY.map(value => `<option value="${value}"${selected(value, item.refundability || "unknown")}>${esc(optionLabel(value))}</option>`).join("")}</select></label>
    <label><span>${esc(t(language, "refundableAmount"))}</span><input name="refundable_amount" type="number" min="0" step="0.01" value="${field(esc, item.refundable_amount || 0)}"></label>
    <label><span>${esc(t(language, "deadline"))}</span><input name="cancellation_deadline" type="date" value="${field(esc, item.cancellation_deadline)}"></label>
    <label><span>${esc(t(language, "reference"))}</span><input name="confirmation_reference" maxlength="240" value="${field(esc, item.confirmation_reference)}"></label>
    <label class="wide"><span>${esc(t(language, "evidence"))}</span><input name="evidence_url" type="url" inputmode="url" placeholder="https://" value="${field(esc, item.evidence_url)}"></label>
    <label class="wide"><span>${esc(t(language, "notes"))}</span><textarea name="internal_notes" maxlength="2000">${field(esc, item.internal_notes)}</textarea></label>
    <div class="supplierFormActions wide"><button type="submit">${esc(t(language, "save"))}</button></div><p class="supplierFormStatus wide" aria-live="polite"></p>
  </form></details>`;
}

function transactionForm(item, plan, language, esc) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
  return `<details class="supplierFormDisclosure supplierTransactionDisclosure"><summary>${esc(t(language, "addTransaction"))}</summary><form class="supplierCommitmentForm" data-supplier-transaction-form data-plan-id="${esc(plan.planId)}">
    <input type="hidden" name="commitment_id" value="${field(esc, item.commitment_id)}"><input type="hidden" name="plan_id" value="${esc(plan.planId)}"><input type="hidden" name="inquiry_id" value="${field(esc, plan.inquiryId)}"><input type="hidden" name="supplier_id" value="${field(esc, item.supplier_id)}"><input type="hidden" name="supplier_name" value="${field(esc, item.supplier_name)}"><input type="hidden" name="currency" value="${field(esc, item.currency || "USD")}">
    <label><span>${esc(t(language, "transactionType"))}</span><select name="transaction_type">${TRANSACTION_TYPES.map(value => `<option value="${value}">${esc(optionLabel(value))}</option>`).join("")}</select></label>
    <label><span>${esc(t(language, "paymentMethod"))}</span><select name="payment_method">${PAYMENT_METHODS.map(value => `<option value="${value}">${esc(optionLabel(value))}</option>`).join("")}</select></label>
    <label><span>${esc(t(language, "transactionDate"))}</span><input name="transaction_date" type="date" value="${today}" required></label>
    <label><span>${esc(t(language, "transactionAmount"))}</span><input name="amount" type="number" min="0.01" step="0.01" required></label>
    <label><span>${esc(t(language, "reference"))}</span><input name="confirmation_number" maxlength="240"></label>
    <label><span>${esc(t(language, "evidence"))}</span><input name="evidence_url" type="url" inputmode="url" placeholder="https://"></label>
    <label class="wide"><span>${esc(t(language, "notes"))}</span><textarea name="internal_notes" maxlength="2000"></textarea></label>
    <div class="supplierFormActions wide"><button type="submit">${esc(t(language, "saveTransaction"))}</button></div><p class="supplierFormStatus wide" aria-live="polite"></p>
  </form></details>`;
}

function transactionHistory(item, language, esc) {
  const records = item.transactions || [];
  if (!records.length) return `<div class="supplierTransactionHistory"><strong>${esc(t(language, "transactionHistory"))}</strong><p>${esc(t(language, "noTransactions"))}</p></div>`;
  return `<div class="supplierTransactionHistory"><strong>${esc(t(language, "transactionHistory"))}</strong>${records.map(record => `<div class="supplierTransactionRow"><span><b>${field(esc, optionLabel(record.transaction_type))}</b><small>${field(esc, record.transaction_date)} · ${field(esc, optionLabel(record.payment_method))}</small></span><span><b>${esc(money(record.amount))}</b><small>${field(esc, record.confirmation_number || "No reference")}</small></span>${record.evidence_url ? `<a href="${field(esc, record.evidence_url)}" target="_blank" rel="noopener">${esc(t(language, "openEvidence"))}</a>` : ""}</div>`).join("")}</div>`;
}

export function summarizeCommitments(records, guestTotal = 0, guestPaid = 0) {
  const active = records.filter(item => !["cancelled", "refunded"].includes(item.payment_status));
  const total = key => active.reduce((sum, item) => sum + Number(item[key] || 0), 0);
  const committed = total("committed_cost"), paid = total("amount_paid");
  const exposure = active.reduce((sum, item) => sum + (item.refundability === "nonrefundable" ? Number(item.amount_paid || 0) : item.refundability === "partially_refundable" ? Math.max(0, Number(item.amount_paid || 0) - Number(item.refundable_amount || 0)) : 0), 0);
  const unknown = active.filter(item => item.refundability === "unknown").reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
  return { quoted: total("quoted_cost"), committed, paid, exposure, unknown, guestPaid, unallocated: Math.max(0, guestPaid - paid), profit: guestTotal - committed };
}

export function renderSupplierCommitments({ plan, records = [], remoteSummary = {}, state = "ready", error = "", language = "en", esc, guestTotal = 0 }) {
  if (state === "loading") return `<section class="planSection supplierCommitments" data-supplier-section="${esc(plan.planId)}"><h3>${esc(t(language, "title"))}</h3><p class="pricingPrivacy">${esc(t(language, "help"))}</p><div class="supplierLoading" aria-live="polite">Loading…</div></section>`;
  if (error) return `<section class="planSection supplierCommitments" data-supplier-section="${esc(plan.planId)}"><h3>${esc(t(language, "title"))}</h3><p class="pricingPrivacy">${esc(t(language, "help"))}</p><div class="supplierError">${esc(error)} <button type="button" data-retry-suppliers="${esc(plan.planId)}">${esc(t(language, "retry"))}</button></div></section>`;
  const summary = summarizeCommitments(records, guestTotal, Number(remoteSummary.guestPaid || 0));
  const cards = records.length ? records.map(item => `<article class="supplierCommitmentCard"><div><strong>${field(esc, item.supplier_name)}</strong><span>${field(esc, optionLabel(item.category || "other"))} · ${field(esc, item.description)}</span><small>${field(esc, item.service_date_start || "Date pending")} · ${field(esc, optionLabel(item.payment_status || "not_committed"))} · ${field(esc, optionLabel(item.refundability || "unknown"))}</small>${item.confirmation_reference ? `<small><b>${esc(t(language, "reference"))}:</b> ${field(esc, item.confirmation_reference)}</small>` : ""}${item.evidence_url ? `<small><a href="${field(esc, item.evidence_url)}" target="_blank" rel="noopener">${esc(t(language, "openEvidence"))}</a></small>` : ""}</div><dl><div><dt>${esc(t(language, "committed"))}</dt><dd>${esc(money(item.committed_cost))}</dd></div><div><dt>${esc(t(language, "paid"))}</dt><dd>${esc(money(item.amount_paid))}</dd></div><div><dt>${esc(t(language, "credits"))}</dt><dd>${esc(money(item.credit_applied))}</dd></div><div><dt>${esc(t(language, "remaining"))}</dt><dd>${esc(money(Math.max(0, Number(item.committed_cost || 0) - Number(item.amount_paid || 0) - Number(item.credit_applied || 0))))}</dd></div></dl>${transactionHistory(item, language, esc)}${transactionForm(item, plan, language, esc)}${form(item, plan, language, esc)}</article>`).join("") : `<div class="empty">${esc(t(language, "empty"))}</div>`;
  const metrics = [["quoted", summary.quoted], ["committed", summary.committed], ["paid", summary.paid], ["guestPaid", summary.guestPaid], ["unallocated", summary.unallocated], ["exposure", summary.exposure], ["unknown", summary.unknown], ["profit", summary.profit]];
  return `<section class="planSection supplierCommitments" data-supplier-section="${esc(plan.planId)}"><h3>${esc(t(language, "title"))}</h3><p class="pricingPrivacy">${esc(t(language, "help"))}</p><div class="supplierMetrics">${metrics.map(([key, value]) => `<div><span>${esc(t(language, key))}</span><strong>${esc(money(value))}</strong></div>`).join("")}</div><div class="supplierCommitmentList">${cards}</div>${form(null, plan, language, esc, !records.length)}</section>`;
}

export async function saveSupplierCommitment(formElement) {
  const commitment = Object.fromEntries(new FormData(formElement));
  for (const key of ["quoted_cost", "committed_cost", "amount_paid", "refundable_amount"]) commitment[key] = Number(commitment[key] || 0);
  const response = await fetch("/api/admin/supplier-commitments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commitment }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Supplier commitment could not be saved.");
  return payload.record;
}

export async function saveSupplierTransaction(formElement) {
  const transaction = Object.fromEntries(new FormData(formElement));
  transaction.amount = Number(transaction.amount || 0);
  const response = await fetch("/api/admin/supplier-transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transaction }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Supplier transaction could not be recorded.");
  return payload.record;
}

export async function loadSupplierCommitments(plan) {
  const query = new URLSearchParams({ plan_id: plan.planId });
  if (plan.inquiryId) query.set("inquiry_id", plan.inquiryId);
  const response = await fetch(`/api/admin/supplier-commitments?${query}`, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Supplier commitments could not be loaded.");
  return payload;
}
