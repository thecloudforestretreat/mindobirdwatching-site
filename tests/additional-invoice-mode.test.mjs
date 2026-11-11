import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../book-tour/create/index.html", import.meta.url), "utf8");

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} missing`);
  const opening = html.indexOf("{", start);
  let depth = 1;
  let index = opening + 1;
  while (depth && index < html.length) {
    if (html[index] === "{") depth += 1;
    if (html[index] === "}") depth -= 1;
    index += 1;
  }
  return html.slice(start, index);
}

function harness() {
  const state = {
    acceptedQuoteTotal: 198,
    additionalInvoiceEligible: false,
    additionalInvoiceMode: false,
    priorInvoiceNo: "",
    priorPaymentStatus: "",
    items: [],
  };
  const els = {
    additionalInvoiceMode: { checked: false },
    additionalInvoicePanel: { hidden: true },
    priorInvoiceDetails: { textContent: "" },
    applyDeposit: { checked: true, disabled: false },
  };
  const context = vm.createContext({
    state,
    els,
    currentBookingSubtotal: () => 75,
  });
  vm.runInContext(`
    function getInboundValue(data, ...keys) {
      for (const key of keys) {
        if (data[key] !== undefined && data[key] !== null && String(data[key]).trim() !== "") return String(data[key]).trim();
      }
      return "";
    }
    ${extractFunction("applyPriorInvoiceContext")}
    ${extractFunction("rawAcceptedQuoteMismatch")}
    ${extractFunction("acceptedQuoteMismatch")}
    ${extractFunction("additionalInvoiceMetadata")}
    ${extractFunction("isPriorInvoiceStatus")}
    ${extractFunction("isPreviouslyBookedImportedItem")}
    ${extractFunction("isPreviouslyBookedInboundItem")}
    ${extractFunction("enableVerifiedAdditionalInvoice")}
    ${extractFunction("additionalInvoiceHasPriorBookedItems")}
    globalThis.qa = { applyPriorInvoiceContext, rawAcceptedQuoteMismatch, acceptedQuoteMismatch, additionalInvoiceMetadata, isPreviouslyBookedImportedItem, isPreviouslyBookedInboundItem, enableVerifiedAdditionalInvoice, additionalInvoiceHasPriorBookedItems };
  `, context);
  return context;
}

test("paid CRM invoices are eligible for a separate additional invoice", () => {
  const context = harness();
  context.qa.applyPriorInvoiceContext({ payment_status: "paid", invoice_no: "MBW-0143" });
  assert.equal(context.state.additionalInvoiceEligible, true);
  assert.equal(context.els.additionalInvoicePanel.hidden, false);
  assert.equal(context.qa.rawAcceptedQuoteMismatch(), true);
  assert.equal(context.qa.acceptedQuoteMismatch(), true);

  context.state.additionalInvoiceMode = true;
  assert.equal(context.qa.acceptedQuoteMismatch(), false);
  assert.deepEqual(JSON.parse(JSON.stringify(context.qa.additionalInvoiceMetadata())), {
    invoice_context: "additional_services",
    prior_invoice_no: "MBW-0143",
    prior_payment_status: "paid",
    original_accepted_total: 198,
  });
});

test("verified paid bookings auto-enable only when old items were excluded and new items remain", () => {
  const context = harness();
  context.qa.applyPriorInvoiceContext({ payment_status: "paid", invoice_no: "MBW-0143" });

  assert.equal(context.qa.enableVerifiedAdditionalInvoice([{ status: "booked" }], [{ status: "quoted" }]), true);
  assert.equal(context.state.additionalInvoiceMode, true);
  assert.equal(context.els.additionalInvoiceMode.checked, true);
  assert.equal(context.els.applyDeposit.checked, false);
  assert.equal(context.els.applyDeposit.disabled, true);
  assert.equal(context.qa.acceptedQuoteMismatch(), false);

  assert.equal(context.qa.enableVerifiedAdditionalInvoice([], [{ status: "quoted" }]), false);
  assert.equal(context.state.additionalInvoiceMode, false);
  assert.equal(context.els.additionalInvoiceMode.checked, false);
  assert.equal(context.els.applyDeposit.disabled, false);
});

test("unpaid CRM quotes cannot use additional-invoice mode", () => {
  const context = harness();
  context.qa.applyPriorInvoiceContext({ payment_status: "payment_pending", invoice_no: "MBW-0143" });
  assert.equal(context.state.additionalInvoiceEligible, false);
  assert.equal(context.els.additionalInvoicePanel.hidden, true);
  assert.equal(context.qa.acceptedQuoteMismatch(), true);
  assert.deepEqual(JSON.parse(JSON.stringify(context.qa.additionalInvoiceMetadata())), {});
});

test("additional invoices reject items already booked on the paid invoice", () => {
  const context = harness();
  context.qa.applyPriorInvoiceContext({ payment_status: "paid", invoice_no: "MBW-0143" });
  context.state.additionalInvoiceMode = true;
  context.state.items = [
    { tour_code: "MBW006", source_status: "booked" },
    { tour_code: "MBW011", source_status: "quoted" },
  ];

  assert.equal(context.qa.isPreviouslyBookedImportedItem(context.state.items[0]), true);
  assert.equal(context.qa.isPreviouslyBookedImportedItem(context.state.items[1]), false);
  assert.equal(context.qa.additionalInvoiceHasPriorBookedItems(), true);

  context.state.items.shift();
  assert.equal(context.qa.additionalInvoiceHasPriorBookedItems(), false);
});

test("paid-booking imports distinguish prior services from new quoted add-ons", () => {
  const context = harness();
  const inbound = [
    { product_selected: "MBW006", status: "booked" },
    { product_selected: "MBW011", status: "quoted" },
    { product_selected: "MEAL001", status: "quoted" },
  ];

  const excluded = inbound.filter(context.qa.isPreviouslyBookedInboundItem);
  const newItems = inbound.filter(item => !context.qa.isPreviouslyBookedInboundItem(item));

  assert.deepEqual(JSON.parse(JSON.stringify(excluded.map(item => item.product_selected))), ["MBW006"]);
  assert.deepEqual(JSON.parse(JSON.stringify(newItems.map(item => item.product_selected))), ["MBW011", "MEAL001"]);
});

test("checkout scripts parse with the additional-invoice control", () => {
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (match[1].trim()) new Function(match[1]);
  }
  assert.match(html, /Create a separate invoice for approved additional services/);
  assert.match(html, /Prior paid invoice/);
  assert.match(html, /excluded automatically/);
});
