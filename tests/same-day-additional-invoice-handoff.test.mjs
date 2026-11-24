import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const stripe = fs.readFileSync(new URL("../book-tour/create/index.html", import.meta.url), "utf8");
const crm = fs.readFileSync(new URL("../admin/guest-crm/index.html", import.meta.url), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} missing`);
  const opening = source.indexOf("{", start);
  let depth = 1;
  let index = opening + 1;
  while (depth && index < source.length) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    index += 1;
  }
  return source.slice(start, index);
}

test("same-day services use Mindo's date and one-day invoice terms", () => {
  const context = vm.createContext({ Intl, Date, Object });
  vm.runInContext(`${extractFunction(stripe, "getTodayInMindoISO")}\n${extractFunction(stripe, "recommendedInvoiceDueDays")}`, context);
  const instant = new Date("2026-11-24T04:30:00.000Z");
  assert.equal(context.getTodayInMindoISO(instant), "2026-11-23");
  assert.equal(context.recommendedInvoiceDueDays([{ tour_date: "2026-11-23" }], "2026-11-23"), 1);
  assert.equal(context.recommendedInvoiceDueDays([{ tour_date: "2026-11-24" }], "2026-11-23"), 2);
});

test("CRM representative codes map to invoice agent IDs", () => {
  const context = vm.createContext({ clean: value => String(value ?? "").trim() });
  vm.runInContext(`${extractFunction(crm, "normalizeRep")}\n${extractFunction(crm, "assignedAgentId")}`, context);
  assert.equal(context.assignedAgentId({ assigned_to: "Juan" }), "003");
  assert.equal(context.assignedAgentId({ assigned_to: "SS" }), "002");
  assert.equal(context.assignedAgentId({ assigned_to: "" }), "");
});

test("invoice handoff excludes stale CRM notes and redundant pickup label UI", () => {
  assert.doesNotMatch(stripe, /id="pickupLocationLabel"/);
  assert.match(stripe, /const invoiceNotes = getInboundValue\(data, "invoice_notes"\)/);
  assert.doesNotMatch(stripe, /getInboundValue\(data, "notes", "message_questions", "guest_notes"\)/);
  assert.match(stripe, /pickup_location_label: els\.pickupAddress\.value\.trim\(\)/);
  assert.match(crm, /agent_id:assignedAgentId\(r\)/);
  assert.match(crm, /invoice_notes:""/);
});

test("date picker permits today's Mindo service date", () => {
  assert.match(stripe, /dateInput\.min = getTodayInMindoISO\(\)/);
  assert.doesNotMatch(stripe, /dateInput\.min = getDefaultTomorrowISO\(\)/);
});
