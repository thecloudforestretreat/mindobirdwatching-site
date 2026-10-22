import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl =
  new URL("../src/index.js", import.meta.url);
const source =
  await readFile(sourceUrl, "utf8");
const exportsForTest = `
export {
  buildAdminOrderEmailHtml,
  buildAdminTourDepositEmailHtml,
  buildAdminTourDepositEmailText,
  buildCustomerOrderEmailHtml,
  buildCustomerTourDepositEmailHtml,
  buildCustomerTourDepositEmailText,
  buildGuideTipEmailHtml,
  buildGuideTipEmailText,
  createPrintifyOrderIfEnabled,
  getOrderPaymentContext
};`;
const moduleUrl =
  `data:text/javascript;base64,${Buffer.from(`${source}\n${exportsForTest}`).toString("base64")}`;
const worker =
  await import(moduleUrl);

const depositOrder = {
  id: 17,
  mbw_order_id:
    "INQ-20260813125953-6459",
  stripe_mode: "live",
  payment_status: "paid",
  currency: "usd",
  subtotal_cents: 10000,
  discount_cents: 0,
  shipping_cents: 0,
  tax_cents: 0,
  total_cents: 10000,
  customer_email: "guest@example.com",
  customer_first_name: "Remko",
  customer_last_name: "Koenen",
  customer_phone: "+31624876459",
  raw_stripe_session_json:
    JSON.stringify({
      metadata: {
        tour_code: "DEP001",
        service_type:
          "reservation_deposit",
        tour_title:
          "Tour Reservation Deposit",
        tour_date: "2026-10-22",
        number_of_people: "2",
        pickup_location_label:
          "Mindo hotel"
      }
    })
};

const depositItems = [
  {
    product_title:
      "Tour Reservation Deposit",
    quantity: 1,
    unit_amount_cents: 10000,
    line_total_cents: 10000
  }
];

const depositContext =
  worker.getOrderPaymentContext(
    depositOrder,
    depositItems
  );

assert.equal(
  depositContext.isTourDeposit,
  true
);
assert.equal(
  depositContext.tourCode,
  "DEP001"
);

const adminDepositHtml =
  worker.buildAdminTourDepositEmailHtml(
    depositOrder,
    depositItems,
    depositContext
  );
const adminDepositText =
  worker.buildAdminTourDepositEmailText(
    depositOrder,
    depositItems,
    depositContext
  );
const customerDepositHtml =
  worker.buildCustomerTourDepositEmailHtml(
    depositOrder,
    depositItems,
    depositContext
  );
const customerDepositText =
  worker.buildCustomerTourDepositEmailText(
    depositOrder,
    depositItems,
    depositContext
  );

for (const body of [
  adminDepositHtml,
  adminDepositText,
  customerDepositHtml,
  customerDepositText
]) {
  assert.match(
    body,
    /Tour deposit received/i
  );
  assert.match(
    body,
    /Deposit received/i
  );
  assert.doesNotMatch(body, /Printify/i);
  assert.doesNotMatch(body, /Shipping/i);
  assert.doesNotMatch(body, /Delivery/i);
  assert.doesNotMatch(body, /MBW Shop/i);
}

assert.match(
  customerDepositText,
  /credited toward the total booking cost/i
);
assert.match(
  adminDepositText,
  /Guest CRM/i
);

const merchandiseOrder = {
  ...depositOrder,
  raw_stripe_session_json:
    JSON.stringify({
      metadata: {
        source: "mbw_shop"
      }
    })
};
const merchandiseItems = [
  {
    product_title: "Toucan T-shirt",
    variant_label: "Large",
    quantity: 1,
    unit_amount_cents: 3200,
    line_total_cents: 3200
  }
];
const merchandiseContext =
  worker.getOrderPaymentContext(
    merchandiseOrder,
    merchandiseItems
  );

assert.equal(
  merchandiseContext.isTourDeposit,
  false
);
assert.match(
  worker.buildAdminOrderEmailHtml(
    merchandiseOrder,
    merchandiseItems
  ),
  /Mindo Bird Watching Shop/i
);
assert.match(
  worker.buildCustomerOrderEmailHtml(
    merchandiseOrder,
    merchandiseItems
  ),
  /prepare it for fulfillment/i
);

function createDb(order, orderItems = []) {
  const updates = [];
  const columns = [
    "printify_order_id",
    "raw_printify_order_json",
    "printify_status",
    "fulfillment_status",
    "printify_order_created_at",
    "printify_sent_to_production_at",
    "printify_order_error"
  ];

  return {
    updates,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              return order;
            },
            async all() {
              if (/FROM order_items/i.test(sql)) {
                return {
                  results: orderItems
                };
              }

              return {
                results:
                  columns.map((name) => ({
                    name
                  }))
              };
            },
            async run() {
              updates.push({
                sql,
                values
              });

              return {
                meta: {
                  changes: 1
                }
              };
            }
          };
        },
        async all() {
          return {
            results:
              columns.map((name) => ({
                name
              }))
          };
        },
        async run() {
          updates.push({
            sql,
            values: []
          });

          return {
            meta: {
              changes: 1
            }
          };
        }
      };
    }
  };
}

const depositDb =
  createDb(depositOrder, depositItems);
const depositPrintifyResult =
  await worker.createPrintifyOrderIfEnabled(
    {
      DB: depositDb,
      PRINTIFY_ORDER_CREATION_ENABLED:
        "true"
    },
    "cs_deposit"
  );

assert.deepEqual(
  depositPrintifyResult,
  {
    ok: true,
    status: "not_applicable",
    skipped: true,
    fulfillment_status:
      "tour_deposit_received"
  }
);
assert.equal(depositDb.updates.length, 1);
assert.match(
  depositDb.updates[0].sql,
  /printify_status = 'not_applicable'/
);

const legacyDepositOrder = {
  ...depositOrder,
  raw_stripe_session_json:
    JSON.stringify({
      metadata: {}
    })
};
const legacyDepositDb =
  createDb(
    legacyDepositOrder,
    depositItems
  );
const legacyDepositPrintifyResult =
  await worker.createPrintifyOrderIfEnabled(
    {
      DB: legacyDepositDb,
      PRINTIFY_ORDER_CREATION_ENABLED:
        "true"
    },
    "cs_legacy_deposit"
  );

assert.equal(
  legacyDepositPrintifyResult.status,
  "not_applicable"
);
assert.equal(
  legacyDepositPrintifyResult.fulfillment_status,
  "tour_deposit_received"
);

const guideTipOrder = {
  ...depositOrder,
  id: 18,
  mbw_order_id: "TIP-TEST-001",
  total_cents: 3500,
  raw_stripe_session_json:
    JSON.stringify({
      metadata: {},
      custom_fields: [
        {
          key: "guide_name",
          text: {
            value: "Example Guide"
          }
        }
      ]
    })
};
const guideTipItems = [
  {
    product_title:
      "Tip for Your Mindo Bird Watching Guide",
    quantity: 1,
    unit_amount_cents: 3500,
    line_total_cents: 3500
  }
];
const guideTipContext =
  worker.getOrderPaymentContext(
    guideTipOrder,
    guideTipItems
  );

assert.equal(guideTipContext.isGuideTip, true);
assert.equal(guideTipContext.kind, "guide_tip");
assert.equal(
  guideTipContext.guideName,
  "Example Guide"
);

for (const body of [
  worker.buildGuideTipEmailHtml(
    guideTipOrder,
    guideTipContext,
    "customer"
  ),
  worker.buildGuideTipEmailHtml(
    guideTipOrder,
    guideTipContext,
    "admin"
  ),
  worker.buildGuideTipEmailText(
    guideTipOrder,
    guideTipContext,
    "customer"
  ),
  worker.buildGuideTipEmailText(
    guideTipOrder,
    guideTipContext,
    "admin"
  )
]) {
  assert.match(body, /Guide tip received/i);
  assert.match(body, /\$35\.00/);
  assert.doesNotMatch(body, /Printify/i);
  assert.doesNotMatch(body, /tour deposit/i);
}

const guideTipDb =
  createDb(guideTipOrder, guideTipItems);
const guideTipPrintifyResult =
  await worker.createPrintifyOrderIfEnabled(
    {
      DB: guideTipDb,
      PRINTIFY_ORDER_CREATION_ENABLED:
        "true"
    },
    "cs_guide_tip"
  );

assert.equal(
  guideTipPrintifyResult.status,
  "not_applicable"
);
assert.equal(
  guideTipPrintifyResult.fulfillment_status,
  "guide_tip_received"
);

const merchandiseDb =
  createDb(merchandiseOrder);
const merchandisePrintifyResult =
  await worker.createPrintifyOrderIfEnabled(
    {
      DB: merchandiseDb,
      PRINTIFY_ORDER_CREATION_ENABLED:
        "true"
    },
    "cs_merchandise"
  );

assert.equal(
  merchandisePrintifyResult.ok,
  false
);
assert.equal(
  merchandisePrintifyResult.error,
  "Printify configuration is incomplete"
);

console.log(
  "Deposit email and fulfillment QA passed."
);

assert.match(
  source,
  /requires_fulfillment_review:\s*true[\s\S]*?\},\s*200,\s*request\s*\);/
);
