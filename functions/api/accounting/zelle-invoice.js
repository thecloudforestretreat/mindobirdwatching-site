const ADMIN_ORIGIN = "https://admin.mindobirdwatching.com";
const MAX_BODY_BYTES = 65536;
const MAX_ITEMS = 12;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": ADMIN_ORIGIN,
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  vary: "Origin",
};

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function clean(value, maxLength = 500) {
  return String(value == null ? "" : value).trim().slice(0, maxLength);
}

function validId(value) {
  const id = clean(value, 128);
  return /^[A-Za-z0-9_.-]{1,128}$/.test(id) ? id : "";
}

function validDate(value) {
  const date = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function moneyToCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100);
}

function dollars(cents) {
  return (cents / 100).toFixed(2);
}

function productCode(description) {
  const match = clean(description, 160).match(/^([A-Z]+[A-Z0-9-]*)\s+-\s+/);
  return match ? match[1] : "OTHER";
}

function serviceType(code) {
  if (code.startsWith("TRANS")) return "Transportation";
  if (code.startsWith("ACT")) return "Activity";
  if (code.startsWith("ACCOM")) return "Accommodation";
  if (code.startsWith("OSO")) return "Wildlife";
  return "Birdwatching";
}

function splitName(fullName) {
  const parts = clean(fullName, 180).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] || "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1) };
}

function todayInNewYork() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function allocateTotal(items, adjustmentCents) {
  const gross = items.map((item) => item.qty * item.unitCents);
  const subtotal = gross.reduce((sum, value) => sum + value, 0);
  const total = subtotal + adjustmentCents;
  if (subtotal <= 0 || total <= 0) throw new Error("invoice_total_must_be_positive");
  if (!adjustmentCents) return gross;

  let assigned = 0;
  return gross.map((value, index) => {
    if (index === gross.length - 1) return total - assigned;
    const share = Math.round((value / subtotal) * total);
    assigned += share;
    return share;
  });
}

async function postJson(url, body, attempts = 3, headers = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch { result = { ok: false, error: "invalid_server_response" }; }
      if (!response.ok || result.ok === false) throw new Error(result.error || `upstream_${response.status}`);
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError || new Error("upstream_request_failed");
}

function validateInput(input) {
  const invoiceNo = validId(input.invoice_no);
  const inquiryId = validId(input.inquiry_id);
  const guestId = validId(input.guest_id);
  const invoiceDate = validDate(input.invoice_date);
  const tourDate = validDate(input.tour_date);
  const guestName = clean(input.guest_name, 180);
  const guestEmail = clean(input.guest_email, 254).toLowerCase();
  const items = Array.isArray(input.items) ? input.items : [];

  if (!invoiceNo || /^(xxxx|draft)$/i.test(invoiceNo)) throw new Error("valid_invoice_number_required");
  if (!inquiryId) throw new Error("valid_inquiry_id_required");
  if (!guestId) throw new Error("valid_guest_id_required");
  if (!invoiceDate) throw new Error("valid_invoice_date_required");
  if (!tourDate) throw new Error("valid_tour_date_required");
  if (!guestName) throw new Error("guest_name_required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) throw new Error("valid_guest_email_required");
  if (!items.length || items.length > MAX_ITEMS) throw new Error("one_to_twelve_items_required");

  const normalizedItems = items.map((item, index) => {
    const description = clean(item.description, 180);
    const qty = Number(item.qty);
    const unitCents = moneyToCents(item.price);
    if (!description) throw new Error(`item_${index + 1}_description_required`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error(`item_${index + 1}_quantity_invalid`);
    if (unitCents === null || unitCents < 0) throw new Error(`item_${index + 1}_price_invalid`);
    return { description, qty, unitCents, note: clean(item.note, 1000) };
  });

  const adjustmentCents = moneyToCents(input.adjustment_amount);
  if (adjustmentCents === null) throw new Error("adjustment_amount_invalid");
  const adjustmentType = clean(input.adjustment_type, 30) || "price_adjustment";
  if (!["price_adjustment", "prior_payment"].includes(adjustmentType)) throw new Error("adjustment_type_invalid");
  let priorPaymentCents = moneyToCents(input.prior_payment_amount == null ? 0 : input.prior_payment_amount);
  if (priorPaymentCents === null || priorPaymentCents < 0) throw new Error("prior_payment_amount_invalid");
  // Backward compatibility for invoices prepared before the dedicated prior-payment field existed.
  if (adjustmentType === "prior_payment" && adjustmentCents) {
    if (adjustmentCents > 0) throw new Error("prior_payment_adjustment_must_be_zero_or_negative");
    priorPaymentCents += Math.abs(adjustmentCents);
  }
  const priceAdjustmentCents = adjustmentType === "price_adjustment" ? adjustmentCents : 0;
  let paymentMethod = clean(input.payment_method, 60) || "Zelle";
  const allowedPaymentMethods = ["Zelle", "Zelle + Bank Transfer", "Bank Transfer US", "Bank Transfer EC", "Other"];
  if (!allowedPaymentMethods.includes(paymentMethod)) throw new Error("payment_method_invalid");
  const allocated = allocateTotal(normalizedItems, priceAdjustmentCents);
  const invoiceTotalCents = allocated.reduce((sum, value) => sum + value, 0);
  if (priorPaymentCents > invoiceTotalCents) throw new Error("prior_payment_exceeds_invoice_total");
  if (priorPaymentCents > 0 && paymentMethod === "Zelle") paymentMethod = "Zelle + Bank Transfer";
  const paymentDate = validDate(input.payment_date) || invoiceDate;

  return {
    invoiceNo, inquiryId, guestId, invoiceDate, tourDate, guestName, guestEmail,
    guestPhone: clean(input.guest_phone, 40),
    bookingId: validId(input.booking_id),
    quoteId: validId(input.quote_id),
    pickup: clean(input.pickup_location, 500),
    notes: clean(input.notes, 2000),
    adjustmentLabel: clean(input.adjustment_label, 160) || "Adjustment",
    adjustmentCents: priceAdjustmentCents,
    adjustmentType,
    priorPaymentCents,
    currentPaymentCents: invoiceTotalCents - priorPaymentCents,
    paymentDate,
    paymentMethod,
    paymentReference: clean(input.payment_reference, 500),
    allocated,
    items: normalizedItems,
    itineraryVersion: clean(input.itinerary_version, 20),
    itineraryTitle: clean(input.itinerary_title, 300),
  };
}

export async function onRequestPost({ request, env }) {
  try {
    const origin = request.headers.get("origin") || "";
    if (origin !== ADMIN_ORIGIN) return reply(403, { ok: false, error: "origin_not_allowed" });
    const fetchSite = (request.headers.get("sec-fetch-site") || "").toLowerCase();
    if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
      return reply(403, { ok: false, error: "cross_site_request_rejected" });
    }
    if (!env.GSHEET_WEBAPP_URL) return reply(503, { ok: false, error: "accounting_logger_unavailable" });
    if (!env.GSHEET_WEBAPP_TOKEN) return reply(503, { ok: false, error: "accounting_logger_token_unavailable" });
    if (!env.CF_SHARED_SECRET) return reply(503, { ok: false, error: "shared_secret_unavailable" });
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      return reply(415, { ok: false, error: "application_json_required" });
    }
    if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
      return reply(413, { ok: false, error: "payload_too_large" });
    }

    let input;
    try { input = await request.json(); } catch { return reply(400, { ok: false, error: "invalid_json" }); }
    let invoice;
    try { invoice = validateInput(input); } catch (error) { return reply(400, { ok: false, error: error.message }); }

    const loggerUrl = `${env.GSHEET_WEBAPP_URL}${env.GSHEET_WEBAPP_URL.includes("?") ? "&" : "?"}token=${encodeURIComponent(env.GSHEET_WEBAPP_TOKEN)}`;
    const name = splitName(invoice.guestName);
    const completed = invoice.tourDate < todayInNewYork() ? "Yes" : "No";
    const invoiceId = `ZELLE-${invoice.invoiceNo}`;
    const totalCents = invoice.allocated.reduce((sum, value) => sum + value, 0);
    const paymentSummary = invoice.priorPaymentCents
      ? `Prior payment ${dollars(invoice.priorPaymentCents)}; current payment ${dollars(invoice.currentPaymentCents)}; invoice total ${dollars(totalCents)}`
      : `Payment received ${dollars(invoice.currentPaymentCents)}; invoice total ${dollars(totalCents)}`;
    const rows = invoice.items.map((item, index) => {
      const code = productCode(item.description);
      const chargedCents = invoice.allocated[index];
      const rowKey = `${invoiceId}|${index + 1}|${code}|${invoice.tourDate}|${item.qty}`;
      return {
        created_at_iso: new Date().toISOString(),
        stripe_environment: "manual",
        stripe_event_id: `zelle_${invoice.invoiceNo}_${index + 1}`,
        invoice_no: invoice.invoiceNo,
        invoice_no_txt: invoice.invoiceNo,
        date_paid: invoice.paymentDate,
        tour_date: invoice.tourDate,
        tour_completed: completed,
        guest_first_name: name.first,
        guest_last_name: name.last,
        guest_email: invoice.guestEmail,
        guest_phone: invoice.guestPhone,
        party_size: String(item.qty),
        service_type: serviceType(code),
        product_selected: code,
        tour_title: item.description.replace(/^[A-Z]+[A-Z0-9-]*\s+-\s+/, ""),
        payment_method: invoice.paymentMethod,
        invoice_id: invoiceId,
        transaction_id: invoiceId,
        payment_reference_note: [
          invoice.paymentReference,
          paymentSummary,
          invoice.adjustmentCents ? `${invoice.adjustmentLabel}: ${dollars(invoice.adjustmentCents)} (price adjustment)` : "",
        ].filter(Boolean).join(" | "),
        guest_rate_override: dollars(item.unitCents),
        standard_price_per_person: dollars(item.unitCents),
        final_price_per_person: dollars(Math.round(chargedCents / item.qty)),
        pricing_reason: invoice.adjustmentCents ? "MANUAL_OVERRIDE_AND_INVOICE_ADJUSTMENT" : "MANUAL_OVERRIDE",
        pricing_notes: [
          "Manual invoice rate; do not replace with catalog pricing",
          invoice.adjustmentCents ? `${invoice.adjustmentLabel}: ${dollars(invoice.adjustmentCents)}` : "",
        ].filter(Boolean).join(" | "),
        amount_received: dollars(chargedCents),
        transaction_fee_total: "0.00",
        pickup_location: invoice.pickup,
        pickup_address_or_hotel: invoice.pickup,
        notes: [item.note, invoice.notes].filter(Boolean).join(" | ").slice(0, 2000),
        subtotal_guest: dollars(item.qty * item.unitCents),
        discount_amount: invoice.adjustmentType === "price_adjustment" ? dollars(item.qty * item.unitCents - chargedCents) : "0.00",
        final_invoice_total: dollars(chargedCents),
        expected_total_with_tip: dollars(chargedCents),
        tour_key: rowKey,
        inquiry_id: invoice.inquiryId,
        guest_id: invoice.guestId,
        booking_id: invoice.bookingId,
        quote_id: invoice.quoteId,
        currency: "USD",
        gross_payment_amount: index === 0 ? dollars(totalCents) : "",
        amount_before_deposit: index === 0 ? dollars(totalCents) : "",
        deposit_applied_amount: index === 0 && invoice.priorPaymentCents ? dollars(invoice.priorPaymentCents) : "",
        deposit_payment_method: index === 0 && invoice.priorPaymentCents ? "Bank Transfer" : "",
        amount_remaining: index === 0 ? "0.00" : "",
        record_type: "zelle_invoice",
        record_status: "active",
      };
    });

    let accountingResult;
    try {
      accountingResult = await postJson(loggerUrl, {
        rows,
        upsert_existing: true,
        invoice_id: invoiceId,
      });
    } catch (error) {
      return reply(502, {
        ok: false,
        error: "accounting_batch_write_failed",
        detail: clean(error.message, 200),
        invoice_no: invoice.invoiceNo,
        rows_total: rows.length,
        retry_safe: true,
      });
    }
    const recorded = Number(accountingResult.rows_appended) || 0;
    const updated = Number(accountingResult.rows_updated) || 0;
    const skipped = Number(accountingResult.rows_skipped) || 0;

    let attribution = { ok: false, error: "not_attempted" };
    try {
      attribution = await postJson("https://mindobirdwatching.com/api/attribution/link", {
        inquiry_id: invoice.inquiryId,
        guest_id: invoice.guestId,
        booking_id: invoice.bookingId,
        quote_id: invoice.quoteId,
        invoice_id: invoice.invoiceNo,
        payment_method: invoice.paymentMethod.toLowerCase().includes("zelle") ? "zelle" : "bank_transfer",
      }, 3, { authorization: `Bearer ${env.CF_SHARED_SECRET}` });
    } catch (error) {
      attribution = { ok: false, error: clean(error.message, 200) };
    }

    return reply(200, {
      ok: true,
      invoice_no: invoice.invoiceNo,
      rows_total: invoice.items.length,
      rows_recorded: recorded,
      rows_updated: updated,
      rows_skipped: skipped,
      duplicate_safe: true,
      accounting_destination: "stripe_invoices",
      invoices_sync_eta_minutes: 5,
      attribution_linked: attribution.ok === true,
      attribution_link_id: attribution.attribution_link_id || "",
      attribution_error: attribution.ok === true ? "" : (attribution.error || "attribution_link_failed"),
    });
  } catch (error) {
    console.error("Zelle accounting write failed", error);
    return reply(500, { ok: false, error: "zelle_accounting_write_failed" });
  }
}

export async function onRequestGet() {
  return reply(405, { ok: false, error: "method_not_allowed" });
}

export async function onRequestOptions({ request }) {
  if ((request.headers.get("origin") || "") !== ADMIN_ORIGIN) {
    return reply(403, { ok: false, error: "origin_not_allowed" });
  }
  return new Response(null, { status: 204, headers: JSON_HEADERS });
}

export const __test = { allocateTotal, productCode, serviceType, splitName, validateInput };
