import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSupplierCommitment, summarizeSupplierCommitments } from "../functions/lib/supplier-commitments.mjs";
import { renderSupplierCommitments } from "../admin/guide/supplier-commitments.mjs";

test("normalizes a supplier commitment without inventing refundability", () => {
  const record = normalizeSupplierCommitment({
    plan_id: "robert-2027", supplier_name: "El Refugio", category: "lodging", description: "Two Intag nights",
    quoted_cost: 200, committed_cost: 200, amount_paid: 100, payment_status: "partially_paid", refundability: "unknown",
  }, { actor: "Juan" });
  assert.match(record.commitment_id, /^SC-/);
  assert.equal(record.entered_by, "Juan");
  assert.equal(record.refundability, "unknown");
});

test("rejects refund amounts greater than supplier payments", () => {
  assert.throws(() => normalizeSupplierCommitment({
    plan_id: "p1", supplier_name: "Hotel", description: "Room", amount_paid: 50, refundable_amount: 60,
  }), /cannot exceed/);
});

test("supports a confirmed reservation that does not require a supplier deposit", () => {
  const record = normalizeSupplierCommitment({
    plan_id: "robert-2027", supplier_name: "Mindo Glambird", category: "lodging", description: "Two Mindo nights",
    committed_cost: 120, amount_paid: 0, payment_status: "confirmed_no_deposit", confirmation_reference: "Reservation confirmed",
  }, { actor: "Juan" });
  assert.equal(record.payment_status, "confirmed_no_deposit");
  assert.equal(record.amount_paid, 0);
  assert.equal(record.confirmation_reference, "Reservation confirmed");
  assert.throws(() => normalizeSupplierCommitment({ ...record, amount_paid: 1 }), /no-deposit/);
});

test("renders supplier confirmation fields and saved references", () => {
  const html = renderSupplierCommitments({
    plan: { planId: "robert-2027", inquiryId: "INQ-ROBERT" },
    records: [{
      supplier_name: "Mindo Glambird", category: "lodging", description: "Two nights",
      payment_status: "confirmed_no_deposit", refundability: "unknown", confirmation_reference: "Reservation confirmed",
    }],
    esc: value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  });
  assert.match(html, /Confirmed No Deposit/);
  assert.match(html, /Reservation confirmed/);
  assert.match(html, /name="confirmation_reference"/);
  assert.match(html, /name="evidence_url"/);
});

test("summarizes committed cost, exposure, guest funds, and projected profit", () => {
  const summary = summarizeSupplierCommitments([
    { committed_cost: 200, amount_paid: 100, refundability: "nonrefundable", refundable_amount: 0, payment_status: "partially_paid" },
    { committed_cost: 80, amount_paid: 80, refundability: "partially_refundable", refundable_amount: 30, payment_status: "paid" },
    { committed_cost: 150, amount_paid: 0, refundability: "unknown", payment_status: "quoted" },
  ], { guestTotal: 800, guestPaid: 500 });
  assert.deepEqual(summary, {
    count: 3, quotedCost: 0, committedCost: 430, supplierPaid: 180, refundableAmount: 30,
    nonrefundableExposure: 150, unknownExposure: 0, guestTotal: 800, guestPaid: 500,
    unallocatedGuestFunds: 320, expectedGrossProfit: 370,
  });
});
