import assert from "node:assert/strict";
import test from "node:test";
import { summarizeCommitments } from "../admin/guide/supplier-commitments.mjs";

test("client summary keeps unknown and nonrefundable exposure separate", () => {
  const result = summarizeCommitments([
    { committed_cost: 100, amount_paid: 50, refundability: "unknown", payment_status: "partially_paid" },
    { committed_cost: 200, amount_paid: 100, refundability: "nonrefundable", payment_status: "paid" },
  ], 500, 250);
  assert.equal(result.unknown, 50);
  assert.equal(result.exposure, 100);
  assert.equal(result.profit, 200);
  assert.equal(result.unallocated, 100);
});
