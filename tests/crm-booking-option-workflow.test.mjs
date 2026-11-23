import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const workflow = JSON.parse(fs.readFileSync(new URL("../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json", import.meta.url), "utf8"));
const byName = name => workflow.nodes.find(node => node.name === name);

test("workflow routes booking-option synchronization", () => {
  const rules = byName("Switch - Action").parameters.rules.values;
  assert.ok(rules.some(rule => rule.conditions.conditions[0].rightValue === "sync_booking_options"));
  assert.ok(byName("Read Booking Options"));
  assert.ok(byName("Read Booking Option Guests"));
  assert.ok(byName("Write Booking Options"));
  assert.ok(byName("Write Booking Option Guests"));
});

test("booking options use deterministic append-or-update keys", () => {
  const options = byName("Write Booking Options");
  const guests = byName("Write Booking Option Guests");
  assert.equal(options.parameters.operation, "appendOrUpdate");
  assert.deepEqual(options.parameters.columns.matchingColumns, ["option_id"]);
  assert.equal(guests.parameters.operation, "appendOrUpdate");
  assert.deepEqual(guests.parameters.columns.matchingColumns, ["option_guest_id"]);
});

test("booking-option sync covers approved products and stale-row cancellation", () => {
  const optionCode = byName("Prepare Booking Option Sync").parameters.jsCode;
  const guestCode = byName("Prepare Booking Option Guest Sync").parameters.jsCode;
  for (const product of ["MBW005", "MBW006", "MBW007", "MBW008", "MBW010"]) {
    assert.match(optionCode, new RegExp(product));
    assert.match(guestCode, new RegExp(product));
  }
  assert.match(optionCode, /record_status:'cancelled'/);
  assert.match(guestCode, /record_status:'cancelled'/);
});

test("sync response returns independently verifiable counts", () => {
  const code = byName("Finalize Booking Option Sync").parameters.jsCode;
  assert.match(code, /option_count:optionCount/);
  assert.match(code, /option_guest_count:guestCount/);
  assert.match(code, /verified:true/);
});
