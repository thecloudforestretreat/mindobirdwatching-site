import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { __test } from "../functions/api/accounting/zelle-invoice.js";

const campaignNow = Date.parse("2026-11-25T12:00:00-05:00");
const afterCampaign = Date.parse("2026-12-15T12:00:00-05:00");

const eligibleItems = [
  { description: "MBW006 - Quest for Five Toucans & the Andean Cock-of-the-Rock", qty: 2, unitCents: 11500, note: "" },
  { description: "MEAL001 - Breakfast", qty: 2, unitCents: 500, note: "" },
];

test("Zelle MINDOFLY selects one eligible line and never discounts add-ons", () => {
  const plan = __test.promotionPlan("MINDOFLY", eligibleItems, "2027-02-28", campaignNow);
  assert.equal(plan.itemIndex, 0);
  assert.equal(plan.discountPerGuestCents, 1000);
  assert.equal(plan.eligibleGuests, 2);
  assert.equal(plan.discountTotalCents, 2000);
  assert.equal(plan.campaign, "cyber_monday_2026");
});

test("Zelle MINDOFLY honors a saved CRM reservation timestamp after campaign close", () => {
  const plan = __test.promotionPlan(
    "MINDOFLY",
    eligibleItems,
    "2027-02-28",
    afterCampaign,
    "2026-11-30T22:00:00-05:00",
  );
  assert.equal(plan.discountTotalCents, 2000);
});

test("Zelle MINDOFLY rejects late reservations, late travel, and ineligible-only invoices", () => {
  assert.throws(
    () => __test.promotionPlan("MINDOFLY", eligibleItems, "2027-02-28", afterCampaign, "2026-12-01T00:00:00-05:00"),
    /not_active/,
  );
  assert.throws(
    () => __test.promotionPlan("MINDOFLY", eligibleItems, "2027-03-01", campaignNow),
    /tour_by_2027-02-28/,
  );
  assert.throws(
    () => __test.promotionPlan("MINDOFLY", [{ description: "MEAL001 - Breakfast", qty: 2, unitCents: 500 }], "2027-02-28", campaignNow),
    /has_no_eligible_item/,
  );
});

test("CRM, Stripe, and Zelle handoffs retain promo selection and reservation time", () => {
  const crm = fs.readFileSync(new URL("../admin/guest-crm/index.html", import.meta.url), "utf8");
  const stripe = fs.readFileSync(new URL("../book-tour/create/index.html", import.meta.url), "utf8");
  const zelle = fs.readFileSync(new URL("../admin/zelle-invoice-generator/index.html", import.meta.url), "utf8");
  const workflow = fs.readFileSync(new URL("../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json", import.meta.url), "utf8");

  assert.match(crm, /promo_applied_at:promoAppliedAt/);
  assert.match(crm, /promo_applied_at:r\.promo_applied_at\|\|""/);
  assert.match(stripe, /promo_applied_at: state\.promoAppliedAt/);
  assert.match(zelle, /promo_applied_at:state\.promoAppliedAt/);
  assert.equal((workflow.match(/"id": "promo_applied_at"/g) || []).length, 3);
});

test("direct CRM Zelle posting refuses promo rows so metadata cannot be silently lost", () => {
  const crm = fs.readFileSync(new URL("../admin/guest-crm/index.html", import.meta.url), "utf8");
  assert.match(crm, /Open the Zelle Invoice Generator to validate and record promotional pricing/);
});
