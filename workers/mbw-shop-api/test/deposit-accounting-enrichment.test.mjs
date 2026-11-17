import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/index.js", import.meta.url),
  "utf8"
);
const moduleUrl =
  `data:text/javascript;base64,${Buffer.from(`${source}\nexport { buildDepositCrmSnapshot, createStripeDepositCheckoutSession };`).toString("base64")}`;
const worker = await import(moduleUrl);

const crm = worker.buildDepositCrmSnapshot({
  inquiry_id: "INQ-QA-DEPOSIT",
  guest_id: "G-QA-DEPOSIT",
  booking_id: "B-QA-DEPOSIT",
  first_name: "Ada",
  last_name: "Birder",
  email: "ada@example.test",
  phone_number: "+593999000111",
  country: "Ecuador",
  guest_count: "4",
  requested_date_start: "2027-01-20",
  service_type: "Birdwatching",
  product_selected: "MBW006",
  tour_guide: "Chicho",
  quoted_amount: "$620.00",
  marketing_brand_id: "mbw",
  billing_brand_id: "mbw"
});

assert.deepEqual(crm, {
  inquiry_id: "INQ-QA-DEPOSIT",
  guest_id: "G-QA-DEPOSIT",
  booking_id: "B-QA-DEPOSIT",
  guest_first_name: "Ada",
  guest_last_name: "Birder",
  guest_email: "ada@example.test",
  guest_phone: "+593999000111",
  home_country: "Ecuador",
  party_size: "4",
  tour_date: "2027-01-20",
  balance_due_date: "2027-01-06",
  booked_service_type: "Birdwatching",
  product_selected: "MBW006",
  tour_guide: "Chicho",
  total_booking_price: "$620.00",
  marketing_brand_id: "mbw",
  billing_brand_id: "mbw"
});

const originalFetch = globalThis.fetch;
let stripeBody;

globalThis.fetch = async (_url, options) => {
  stripeBody = new URLSearchParams(options.body);
  return new Response(
    JSON.stringify({
      id: "cs_test_deposit",
      url: "https://checkout.stripe.test/deposit"
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" }
    }
  );
};

try {
  const result = await worker.createStripeDepositCheckoutSession(
    { STRIPE_SECRET_KEY: "sk_test_mock" },
    {
      amount: 100,
      referenceId: "INQ-QA-DEPOSIT",
      inquiryId: "INQ-QA-DEPOSIT",
      language: "en",
      crm
    }
  );

  assert.equal(result.ok, true);
  assert.equal(stripeBody.get("customer_email"), "ada@example.test");
  assert.equal(stripeBody.get("metadata[guest_first_name]"), "Ada");
  assert.equal(stripeBody.get("metadata[guest_last_name]"), "Birder");
  assert.equal(stripeBody.get("metadata[guest_phone]"), "+593999000111");
  assert.equal(stripeBody.get("metadata[home_country]"), "Ecuador");
  assert.equal(stripeBody.get("metadata[number_of_people]"), "4");
  assert.equal(stripeBody.get("metadata[tour_date]"), "2027-01-20");
  assert.equal(stripeBody.get("metadata[balance_due_date]"), "2027-01-06");
  assert.equal(stripeBody.get("metadata[service_type]"), "Birdwatching");
  assert.equal(stripeBody.get("metadata[product_selected]"), "MBW006");
  assert.equal(stripeBody.get("metadata[tour_guide]"), "Chicho");
  assert.equal(stripeBody.get("payment_intent_data[metadata][number_of_people]"), "4");
  assert.equal(stripeBody.get("payment_intent_data[metadata][balance_due_date]"), "2027-01-06");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("deposit accounting enrichment tests passed");
