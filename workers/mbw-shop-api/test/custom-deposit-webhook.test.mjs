import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/index.js", import.meta.url),
  "utf8"
);
const exportsForTest = `
export {
  handleStripeWebhook,
  isCustomItineraryDepositSession,
  processCustomItineraryDepositCompleted
};`;
const moduleUrl =
  `data:text/javascript;base64,${Buffer.from(`${source}\n${exportsForTest}`).toString("base64")}`;
const worker = await import(moduleUrl);

const secret = "whsec_QA_custom_deposit";

function fixture({
  crmFailure = "",
  quotedAmount = 2380,
  status = "approved",
  paymentStatus = "payment_pending",
  livemode = true
} = {}) {
  let inquiry = {
    inquiry_id: "INQ-QA-CUSTOM",
    guest_id: "G-QA-CUSTOM",
    full_name: "QA Guest",
    email: "guest@example.test",
    quoted_amount: quotedAmount,
    status,
    payment_status: paymentStatus,
    internal_notes: "Existing internal history"
  };
  const payments = new Map();
  const actions = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options = {}) => {
    assert.equal(String(url), "https://qa.invalid/crm");
    const payload = JSON.parse(
      new URLSearchParams(options.body).get("payload")
    );
    actions.push(payload.action);

    if (payload.action === "list_inquiries") {
      return Response.json({ ok: true, records: [inquiry] });
    }

    if (payload.action === crmFailure) {
      return Response.json({ ok: false, error: "QA forced failure" });
    }

    if (payload.action === "upsert_payment") {
      payments.set(payload.payment.payment_id, structuredClone(payload.payment));
      return Response.json({ ok: true, record: payload.payment });
    }

    if (payload.action === "update_inquiry") {
      inquiry = { ...inquiry, ...payload.record };
      return Response.json({ ok: true, record: inquiry });
    }

    throw new Error(`Unexpected CRM action ${payload.action}`);
  };

  const event = {
    id: "evt_QA_CUSTOM_DEPOSIT",
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    livemode,
    data: {
      object: {
        id: "cs_live_QACUSTOM",
        payment_status: "paid",
        payment_intent: "pi_QACUSTOM",
        amount_total: 50000,
        currency: "usd",
        customer_email: "guest@example.test",
        customer_details: {
          email: "guest@example.test",
          name: "QA Guest"
        },
        metadata: {
          payment_purpose: "tour_deposit",
          source_system: "mbw_itinerary_generator",
          inquiry_id: "INQ-QA-CUSTOM",
          deposit_amount: "500",
          terms_version: "2026-11-05"
        }
      }
    }
  };

  const env = {
    DB: {},
    STRIPE_MODE: "live",
    STRIPE_WEBHOOK_SECRET: secret,
    CRM_API_URL: "https://qa.invalid/crm"
  };

  const send = async () => {
    const raw = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${raw}`)
      .digest("hex");

    return worker.handleStripeWebhook(
      new Request("https://qa.invalid/webhooks/stripe", {
        method: "POST",
        headers: {
          "Stripe-Signature": `t=${timestamp},v1=${signature}`
        },
        body: raw
      }),
      env
    );
  };

  return {
    send,
    payments,
    actions,
    inquiry: () => inquiry,
    restore: () => {
      globalThis.fetch = originalFetch;
    }
  };
}

test("custom itinerary deposit is recorded once and advances the CRM", async () => {
  const harness = fixture();

  try {
    const first = await harness.send();
    assert.equal(first.status, 200);
    assert.equal((await first.json()).payment_recorded, true);

    const second = await harness.send();
    assert.equal(second.status, 200);
    assert.equal(harness.payments.size, 1);

    const payment = harness.payments.get("PAY-pi_QACUSTOM");
    assert.equal(payment.deposit_amount_paid, 500);
    assert.equal(payment.total_booking_price, 2380);
    assert.equal(payment.balance_remaining, 1880);
    assert.equal(payment.payment_status, "deposit_paid");
    assert.equal(payment.transaction_id, "pi_QACUSTOM");

    const inquiry = harness.inquiry();
    assert.equal(inquiry.status, "deposit_paid");
    assert.equal(inquiry.payment_status, "deposit_paid");
    assert.equal(inquiry.payment_method, "Stripe");
    assert.equal(
      inquiry.internal_notes.match(/PaymentIntent pi_QACUSTOM/g).length,
      1
    );
    assert.deepEqual(
      harness.actions,
      [
        "list_inquiries",
        "upsert_payment",
        "update_inquiry",
        "list_inquiries",
        "upsert_payment",
        "update_inquiry"
      ]
    );
  } finally {
    harness.restore();
  }
});

test("custom deposit never downgrades a booked or fully paid inquiry", async () => {
  const harness = fixture({ status: "booked", paymentStatus: "paid" });

  try {
    assert.equal((await harness.send()).status, 200);
    assert.equal(harness.inquiry().status, "booked");
    assert.equal(harness.inquiry().payment_status, "paid");
  } finally {
    harness.restore();
  }
});

test("missing quoted total keeps payment evidence without a false balance", async () => {
  const harness = fixture({ quotedAmount: "" });

  try {
    const response = await harness.send();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.payment_recorded, false);
    assert.equal(
      body.payment_record_skipped_reason,
      "quoted_total_missing_or_not_above_deposit"
    );
    assert.equal(harness.payments.size, 0);
    assert.match(harness.inquiry().internal_notes, /500\.00 USD/);
    assert.match(harness.inquiry().internal_notes, /cs_live_QACUSTOM/);
  } finally {
    harness.restore();
  }
});

test("CRM failure returns a retryable Stripe webhook response", async () => {
  const harness = fixture({ crmFailure: "update_inquiry" });

  try {
    const response = await harness.send();
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.retry_required, true);
    assert.equal(harness.payments.size, 1);
  } finally {
    harness.restore();
  }
});

test("sandbox custom deposits never touch the live CRM", async () => {
  const harness = fixture({ livemode: false });

  try {
    const response = await harness.send();
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.sandbox, true);
    assert.deepEqual(harness.actions, []);
  } finally {
    harness.restore();
  }
});
