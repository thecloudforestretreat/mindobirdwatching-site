import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createHmac, webcrypto } from "node:crypto";

const source = fs.readFileSync(new URL("../mbw-stripe-checkout-worker-v44.js", import.meta.url), "utf8");

function harness() {
  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    const pathname = new URL(url).pathname;
    const form = new URLSearchParams(init.body || "");
    calls.push({ pathname, form });
    let data;
    if (pathname === "/v1/customers") data = { id: "cus_test" };
    else if (pathname === "/v1/invoiceitems") data = { id: "ii_test" };
    else if (pathname === "/v1/invoices" || /^\/v1\/invoices\/in_test\/(finalize|send)$/.test(pathname)) {
      const total = calls
        .filter((call) => call.pathname === "/v1/invoiceitems")
        .reduce((sum, call) => sum + Number(call.form.get("price_data[unit_amount]")) * Number(call.form.get("quantity")), 0);
      data = {
        id: "in_test",
        number: "TEST-1",
        status: "open",
        currency: "usd",
        amount_remaining: total,
        amount_due: total,
        total,
        hosted_invoice_url: "https://example.test/invoice",
      };
    } else throw new Error(`Unexpected external request: ${url}`);
    return Response.json(data);
  };
  const context = vm.createContext({
    fetch: fakeFetch,
    Request,
    Response,
    Headers,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    console,
    crypto: webcrypto,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(source.replace("const worker = {", "globalThis.worker = {").replace("export default worker;", ""), context);
  const env = { STRIPE_SECRET_KEY: "sk_live_qa", STRIPE_SECRET_KEY_TEST: "sk_test_qa" };
  const call = async (path, payload) => {
    const request = new Request(`https://example.test/stripe/api/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const response = await context.worker.fetch(request, env, {});
    return { response, body: await response.json() };
  };
  return { call, calls, context, env };
}

const base = {
  language: "en",
  stripe_environment: "live",
  tour_code: "TOUR002",
  number_of_people: 3,
  main_contact_name: "QA Guest",
  main_contact_email: "qa@example.test",
  main_contact_phone: "+15555550100",
  whatsapp_number: "+15555550100",
  pickup_location_label: "Hotel",
  pickup_address_or_hotel: "QA Hotel",
  tour_date: "2027-02-09",
};

test("custom products are bilingual, flat priced and marked quote-only", async () => {
  const { context, env } = harness();
  for (const language of ["en", "es"]) {
    const response = await context.worker.fetch(new Request(`https://example.test/stripe/api/tours?lang=${language}`), env, {});
    const body = await response.json();
    for (const code of ["TOUR001", "TOUR002"]) {
      const tour = body.tours.find((item) => item.tour_code === code);
      assert(tour, `${code}:${language} missing`);
      assert.equal(tour.pricing_model, "flat");
      assert.equal(tour.quote_only, true);
      assert.equal(tour.requires_price_override, true);
    }
  }
});

test("meal add-ons are staff-only, bilingual, and invoice at the catalog price per guest", async () => {
  const h = harness();
  for (const language of ["en", "es"]) {
    const publicResponse = await h.context.worker.fetch(new Request(`https://example.test/stripe/api/tours?lang=${language}`), h.env, {});
    const publicBody = await publicResponse.json();
    assert.equal(publicBody.tours.some((item) => item.tour_code.startsWith("MEAL")), false);

    const staffResponse = await h.context.worker.fetch(new Request(`https://example.test/stripe/api/tours?lang=${language}&scope=staff`), h.env, {});
    const staffBody = await staffResponse.json();
    for (const [code, amount] of [["MEAL001", "$5.00"], ["MEAL002", "$15.00"]]) {
      const item = staffBody.tours.find((tour) => tour.tour_code === code);
      assert(item, `${code}:${language} missing`);
      assert.equal(item.amount_display, amount);
      assert.equal(item.pricing_model, "per_person");
      assert.equal(item.invoice_only, true);
    }
  }

  const checkout = await h.call("create-checkout-session", { ...base, tour_code: "MEAL001" });
  assert.equal(checkout.response.status, 400);
  assert.match(checkout.body.error, /staff-issued invoice/i);
  assert.equal(h.calls.length, 0);

  const invoice = await h.call("create-invoice", { ...base, tour_code: "MEAL001" });
  assert.equal(invoice.response.status, 200, JSON.stringify(invoice.body));
  const line = h.calls.find((call) => call.pathname === "/v1/invoiceitems").form;
  assert.equal(line.get("pricing[price]"), "price_1UaesJ0wAAlYwqaV2fxXapUZ");
  assert.equal(line.get("quantity"), "3");
});

test("manual Stripe catalog lines recover complete accounting metadata", () => {
  const { context } = harness();
  const breakfast = {
    amount: 1000,
    quantity: 2,
    price: {
      id: "price_1UaesJ0wAAlYwqaV2fxXapUZ",
      product: { id: "prod_VbsdvHlaLF57CX" },
    },
    metadata: {},
  };
  assert.equal(context.isAccountingServiceLine(breakfast, false), true);
  const metadata = context.accountingLineMetadata(breakfast, {
    inquiry_id: "INQ-QA",
    guest_id: "G-QA",
    invoice_context: "additional_services",
  }, false);
  assert.equal(metadata.tour_code, "MEAL001");
  assert.equal(metadata.tour_title, "Breakfast");
  assert.equal(metadata.service_type, "meal");
  assert.equal(metadata.number_of_people, "2");
  assert.equal(metadata.standard_price_per_person, "5.00");
  assert.equal(metadata.final_price_per_person, "5.00");
  assert.equal(metadata.guide_rate_per_person, "5.00");
  assert.equal(metadata.guide_payout_total, "10.00");
  assert.equal(metadata.default_provider, "Other");
  assert.equal(metadata.inquiry_id, "INQ-QA");
  assert.equal(metadata.guest_id, "G-QA");
  assert.equal(metadata.invoice_context, "additional_services");
});

test("meal catalog records expose the approved images and internal vendor costs", async () => {
  const { context, env } = harness();
  const response = await context.worker.fetch(new Request("https://example.test/stripe/api/tours?lang=en&scope=staff"), env, {});
  const body = await response.json();
  const breakfast = body.tours.find((tour) => tour.tour_code === "MEAL001");
  const lunch = body.tours.find((tour) => tour.tour_code === "MEAL002");
  assert.equal(breakfast.hero_image_url, "https://mindobirdwatching.com/assets/images/food/mbw_breakfast_001.jpeg");
  assert.equal(lunch.hero_image_url, "https://mindobirdwatching.com/assets/images/food/mbw_lunch_chicken_001.jpeg");
  assert.equal(breakfast.guide_cost_per_person, 5);
  assert.equal(lunch.guide_cost_per_person, 15);
});

test("within-Mindo transportation is staff-only and cannot bill the US$1 reference amount", async () => {
  const h = harness();
  for (const language of ["en", "es"]) {
    const publicResponse = await h.context.worker.fetch(new Request(`https://example.test/stripe/api/tours?lang=${language}`), h.env, {});
    const publicBody = await publicResponse.json();
    assert.equal(publicBody.tours.some((item) => item.tour_code === "TRANS007"), false);

    const staffResponse = await h.context.worker.fetch(new Request(`https://example.test/stripe/api/tours?lang=${language}&scope=staff`), h.env, {});
    const staffBody = await staffResponse.json();
    const item = staffBody.tours.find((tour) => tour.tour_code === "TRANS007");
    assert(item, `TRANS007:${language} missing`);
    assert.equal(item.amount_display, "$1.00");
    assert.equal(item.pricing_model, "flat");
    assert.equal(item.invoice_only, true);
    assert.equal(item.requires_price_override, true);
  }

  const missingPrice = await h.call("create-invoice", { ...base, tour_code: "TRANS007" });
  assert.equal(missingPrice.response.status, 400);
  assert.match(missingPrice.body.error, /guest-approved final price/i);
  assert.equal(h.calls.length, 0);

  const invoice = await h.call("create-invoice", {
    ...base,
    tour_code: "TRANS007",
    price_override_per_person: 18,
    price_adjustment_per_person: 17,
    pricing_reason: "within_mindo_transportation",
  });
  assert.equal(invoice.response.status, 200, JSON.stringify(invoice.body));
  assert.equal(invoice.body.amount_before_deposit, 18);
  const line = h.calls.find((call) => call.pathname === "/v1/invoiceitems").form;
  assert.equal(line.get("price_data[product]"), "prod_VbtFWOohDnGtww");
  assert.equal(line.get("price_data[unit_amount]"), "1800");
  assert.equal(line.get("quantity"), "1");
});

test("additional-services invoices preserve the prior paid invoice context", async () => {
  const h = harness();
  const result = await h.call("create-invoice-multi", {
    ...base,
    invoice_context: "additional_services",
    prior_invoice_no: "MBW-0143",
    prior_payment_status: "paid",
    original_accepted_total: 198,
    items: [
      { tour_code: "MEAL001", language: "en", quantity: 2, tour_date: "2026-11-12" },
      {
        tour_code: "TRANS007",
        language: "en",
        quantity: 2,
        tour_date: "2026-11-12",
        price_override_per_person: 5,
        price_adjustment_per_person: 4,
        pricing_reason: "within_mindo_transportation",
      },
    ],
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.amount_before_deposit, 15);
  assert.equal(result.body.invoice_context, "additional_services");
  assert.equal(result.body.prior_invoice_no, "MBW-0143");

  const invoice = h.calls.find((call) => call.pathname === "/v1/invoices").form;
  assert.equal(invoice.get("metadata[invoice_context]"), "additional_services");
  assert.equal(invoice.get("metadata[prior_invoice_no]"), "MBW-0143");
  assert.equal(invoice.get("metadata[prior_payment_status]"), "paid");
  assert.equal(invoice.get("metadata[original_accepted_total]"), "198.00");

  const lines = h.calls.filter((call) => call.pathname === "/v1/invoiceitems").map((call) => call.form);
  assert.equal(lines.length, 2);
  assert(lines.every((line) => line.get("metadata[prior_invoice_no]") === "MBW-0143"));
});

test("additional-services invoices reject an unpaid or missing prior invoice before Stripe writes", async () => {
  for (const invalid of [
    { prior_invoice_no: "", prior_payment_status: "paid", original_accepted_total: 198 },
    { prior_invoice_no: "MBW-0143", prior_payment_status: "payment_pending", original_accepted_total: 198 },
    { prior_invoice_no: "MBW-0143", prior_payment_status: "paid", original_accepted_total: "" },
  ]) {
    const h = harness();
    const result = await h.call("create-invoice-multi", {
      ...base,
      invoice_context: "additional_services",
      ...invalid,
      items: [{ tour_code: "MEAL001", language: "en", quantity: 2, tour_date: "2026-11-12" }],
    });
    assert.equal(result.response.status, 400);
    assert.equal(h.calls.length, 0);
  }
});

test("public checkout cannot charge a custom tour starting amount", async () => {
  const h = harness();
  const result = await h.call("create-checkout-session", base);
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /staff-issued invoice/i);
  assert.equal(h.calls.length, 0);
});

test("custom invoice requires the approved final price", async () => {
  const h = harness();
  const result = await h.call("create-invoice", base);
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /guest-approved final price/i);
  assert.equal(h.calls.length, 0);
});

test("custom full-day invoice charges the approved total once and preserves brand", async () => {
  const h = harness();
  const result = await h.call("create-invoice", {
    ...base,
    marketing_brand_id: "mindo-tours",
    price_override_per_person: 380,
    price_adjustment_per_person: 280,
    pricing_reason: "custom_quote",
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.amount_before_deposit, 380);
  const line = h.calls.find((call) => call.pathname === "/v1/invoiceitems").form;
  assert.equal(line.get("price_data[product]"), "prod_Va1Z7287eckknz");
  assert.equal(line.get("price_data[unit_amount]"), "38000");
  assert.equal(line.get("quantity"), "1");
  assert.equal(line.get("metadata[service_type]"), "custom_tour");
  assert.equal(line.get("metadata[billing_brand_id]"), "mbw");
  assert.equal(line.get("metadata[marketing_brand_id]"), "mindo-tours");
});

test("multi-item custom invoices require an approved price on every custom line", async () => {
  const h = harness();
  const payload = {
    ...base,
    items: [{ tour_code: "TOUR001", language: "en", quantity: 2, tour_date: "2027-02-10" }],
  };
  const missing = await h.call("create-invoice-multi", payload);
  assert.equal(missing.response.status, 400);
  assert.match(missing.body.error, /guest-approved final price/i);
  assert.equal(h.calls.length, 0);
});

test("queue consumer verifies and acknowledges a durable Stripe delivery", async () => {
  const h = harness();
  const secret = "whsec_qa";
  h.env.STRIPE_WEBHOOK_SECRET = secret;
  const event = { id: "evt_queue_qa", type: "customer.created", created: Math.floor(Date.now() / 1000), livemode: false, data: { object: {} } };
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;
  let acknowledged = 0;
  let retried = 0;
  await h.context.worker.queue({ messages: [{ id: "msg_qa", body: { payload, stripe_signature: signature, stripe_event_id: event.id, stripe_event_type: event.type }, ack() { acknowledged += 1; }, retry() { retried += 1; } }] }, h.env, {});
  assert.equal(acknowledged, 1);
  assert.equal(retried, 0);
});

test("verified public webhooks enqueue once before processing", async () => {
  const h = harness();
  const secret = "whsec_queue_qa";
  const event = { id: "evt_enqueue_qa", type: "customer.created", created: Math.floor(Date.now() / 1000), livemode: false, data: { object: {} } };
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;
  const queued = [];
  const response = await h.context.worker.fetch(new Request("https://example.test/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body: payload }), { ...h.env, STRIPE_WEBHOOK_SECRET: secret, STRIPE_WEBHOOK_QUEUE: { async send(message) { queued.push(message); } } }, {});
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "queued");
  assert.equal(queued.length, 1);
  assert.equal(queued[0].stripe_event_id, event.id);
});
