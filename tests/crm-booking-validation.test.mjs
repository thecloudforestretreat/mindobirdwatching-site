import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const router = fs.readFileSync(new URL("deployment/multi-invoice-ledger/crm-router.gs", root), "utf8");
const bookingStatuses = '["pending", "tentative", "deposit_pending", "deposit_paid", "payment_pending", "booked", "completed", "cancelled"]';

test("booking schema and sheet validation accept every workflow booking state", () => {
  assert.ok(router.includes(`booking_status: { values: ${bookingStatuses}, fallback: "pending" }`));
  assert.ok(router.includes(`column: "booking_status", values: ${bookingStatuses}`));
});
