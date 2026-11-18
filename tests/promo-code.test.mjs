import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const source = fs.readFileSync(new URL("../mbw-stripe-checkout-worker-v44.js", import.meta.url), "utf8");
const campaignNow = Date.parse("2026-11-25T12:00:00-05:00");

function harness(nowMs = campaignNow) {
  const calls = [];
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [nowMs]));
    }
    static now() { return nowMs; }
  }
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
        number: "TEST-PROMO",
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
    Date: FixedDate,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(
    source.replace("const worker = {", "globalThis.worker = {").replace("export default worker;", ""),
    context,
  );
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
  number_of_people: 2,
  main_contact_name: "Promo Guest",
  main_contact_email: "promo@example.test",
  main_contact_phone: "+15555550100",
  whatsapp_number: "+15555550100",
  pickup_location_label: "Hotel",
  pickup_address_or_hotel: "Promo Hotel",
  tour_date: "2027-02-09",
  promo_code: "MINDOFLY",
};

test("MINDOFLY eligibility is exposed only for the approved seven tour products", async () => {
  const { context, env } = harness();
  const response = await context.worker.fetch(new Request("https://example.test/stripe/api/tours?lang=en&scope=staff"), env, {});
  const body = await response.json();
  const eligible = body.tours.filter((tour) => tour.promo_eligible).map((tour) => tour.tour_code).sort();
  assert.deepEqual(eligible, ["MBW002", "MBW004", "MBW005", "MBW006", "MBW007", "MBW008", "MBW010"]);
  for (const code of ["DEP001", "MEAL001", "MEAL002", "TRANS007", "TOUR001", "TOUR002"]) {
    assert.equal(body.tours.find((tour) => tour.tour_code === code)?.promo_eligible, false, code);
  }
});

test("single eligible invoice records exact whole-dollar MINDOFLY metadata", async () => {
  const h = harness();
  const result = await h.call("create-invoice", {
    ...base,
    tour_code: "MBW005",
    price_override_per_person: 80,
    price_adjustment_per_person: -5,
    pricing_reason: "promo_discount",
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const line = h.calls.find((call) => call.pathname === "/v1/invoiceitems").form;
  assert.equal(line.get("price_data[unit_amount]"), "8000");
  assert.equal(line.get("metadata[promo_code]"), "MINDOFLY");
  assert.equal(line.get("metadata[promo_discount_total]"), "10.00");
  assert.equal(line.get("metadata[promo_discount_per_guest]"), "5.00");
  assert.equal(line.get("metadata[promo_eligible_guests]"), "2");
  assert.equal(line.get("metadata[promo_campaign]"), "cyber_monday_2026");
});

test("multi-item invoice applies MINDOFLY to one eligible line without discounting add-ons", async () => {
  const h = harness();
  const result = await h.call("create-invoice-multi", {
    ...base,
    items: [
      { tour_code: "MBW005", language: "en", quantity: 2, tour_date: "2027-02-09" },
      { tour_code: "MBW006", language: "en", quantity: 2, tour_date: "2027-02-10", price_override_per_person: 105, price_adjustment_per_person: -10, pricing_reason: "promo_discount" },
      { tour_code: "MEAL001", language: "en", quantity: 2, tour_date: "2027-02-10" },
    ],
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const invoice = h.calls.find((call) => call.pathname === "/v1/invoices").form;
  assert.equal(invoice.get("metadata[promo_code]"), "MINDOFLY");
  assert.equal(invoice.get("metadata[promo_discount_total]"), "20.00");
  assert.equal(invoice.get("metadata[promo_discount_per_guest]"), "10.00");
  assert.equal(invoice.get("metadata[promo_eligible_guests]"), "2");
  const lines = h.calls.filter((call) => call.pathname === "/v1/invoiceitems").map((call) => call.form);
  assert.equal(lines[0].has("metadata[promo_code]"), false);
  assert.equal(lines[1].get("metadata[promo_discount_total]"), "20.00");
  assert.equal(lines[2].has("metadata[promo_code]"), false);
});

test("MINDOFLY rejects wrong discounts, ineligible-only invoices, campaign expiry, and late tour dates", async () => {
  const h = harness();
  const wrong = await h.call("create-invoice", {
    ...base,
    tour_code: "MBW005",
    price_override_per_person: 79,
    price_adjustment_per_person: -6,
    pricing_reason: "promo_discount",
  });
  assert.equal(wrong.response.status, 400);
  assert.match(wrong.body.error, /requires a -\$5 whole-dollar adjustment/i);
  assert.equal(h.calls.length, 0);

  const ineligible = await h.call("create-invoice", { ...base, tour_code: "MEAL001" });
  assert.equal(ineligible.response.status, 400);
  assert.match(ineligible.body.error, /not eligible/i);

  assert.throws(
    () => h.context.promotionLineMetadata("MINDOFLY", { tour_code: "MBW005", duration_label: "Half Day" }, 2, -500, "2027-02-09", Date.parse("2026-12-01T00:00:00-05:00")),
    /not active/i,
  );

  const lateTour = await h.call("create-invoice", {
    ...base,
    tour_code: "MBW005",
    tour_date: "2027-03-01",
    price_override_per_person: 80,
    price_adjustment_per_person: -5,
    pricing_reason: "promo_discount",
  });
  assert.equal(lateTour.response.status, 400);
  assert.match(lateTour.body.error, /tour to occur by 2027-02-28/i);
});

test("MINDOFLY rejects more than one discounted tour line per reservation", async () => {
  const h = harness();
  const result = await h.call("create-invoice-multi", {
    ...base,
    items: [
      { tour_code: "MBW005", language: "en", quantity: 2, tour_date: "2027-02-09", price_override_per_person: 80, price_adjustment_per_person: -5, pricing_reason: "promo_discount" },
      { tour_code: "MBW006", language: "en", quantity: 2, tour_date: "2027-02-10", price_override_per_person: 105, price_adjustment_per_person: -10, pricing_reason: "promo_discount" },
    ],
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /only one eligible tour line/i);
});

test("a CRM reservation timestamp preserves MINDOFLY eligibility when invoiced after the campaign closes", async () => {
  const h = harness(Date.parse("2026-12-15T12:00:00-05:00"));
  const result = await h.call("create-invoice", {
    ...base,
    promo_applied_at: "2026-11-30T22:00:00-05:00",
    tour_code: "MBW005",
    price_override_per_person: 80,
    price_adjustment_per_person: -5,
    pricing_reason: "promo_discount",
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
});

test("MINDOFLY rejects a reservation timestamp outside the campaign window", async () => {
  const h = harness(Date.parse("2026-12-15T12:00:00-05:00"));
  const result = await h.call("create-invoice", {
    ...base,
    promo_applied_at: "2026-12-01T00:00:00-05:00",
    tour_code: "MBW005",
    price_override_per_person: 80,
    price_adjustment_per_person: -5,
    pricing_reason: "promo_discount",
  });
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /not active/i);
});
