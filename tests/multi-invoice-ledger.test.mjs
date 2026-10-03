import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");

const html = read("admin/guest-crm/index.html");
assert.match(html, /Create Another Booking for This Guest/);
assert.match(html, /list_bookings/);
assert.match(html, /list_payments/);
assert.match(html, /function renderPaymentLedger/);
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
  if (match[1].trim()) new Function(match[1]);
}

const workflow = JSON.parse(read("deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json"));
const actions = workflow.nodes.find(node => node.name === "Switch - Action").parameters.rules.values.map(rule => rule.conditions.conditions[0].rightValue);
for (const action of ["list_bookings","upsert_booking","list_payments","upsert_payment"]) assert(actions.includes(action), `missing workflow action ${action}`);
for (const name of ["Read CRM Bookings","Process CRM Bookings","Write CRM Booking","Read CRM Payments","Process CRM Payments","Write CRM Payment"]) {
  assert(workflow.nodes.some(node => node.name === name), `missing node ${name}`);
  assert(workflow.connections[name], `missing connection ${name}`);
}
const paymentWrite = workflow.nodes.find(node => node.name === "Write CRM Payment");
assert.equal(paymentWrite.parameters.sheetName.value, "crm_payments");
assert(paymentWrite.parameters.columns.schema.some(column => column.id === "invoice_no"));

const paymentProcessor = workflow.nodes.find(node => node.name === "Process CRM Payments").parameters.jsCode;
const executePayment = (request, rows=[]) => new Function("$", "$input", paymentProcessor)(
  name => ({ first: () => ({ json: name === "Normalize Request" ? request : {} }) }),
  { all: () => rows.map(json => ({ json })) },
);
const sample = {inquiry_id:"INQ-2",guest_id:"G-1",invoice_id:"in_2",invoice_no:"MBW-0115",total_booking_price:55,total_amount_paid:55,balance_remaining:0};
const first = executePayment({action:"upsert_payment",payment:sample})[0].json;
const second = executePayment({action:"upsert_payment",payment:sample},[first])[0].json;
assert.equal(first.payment_id,"PAY-in_2");
assert.equal(second.payment_id,first.payment_id,"same Stripe invoice must upsert, not duplicate");
assert.equal(first.payment_status,"paid");
assert.equal(first.is_fully_paid,"Yes");

const worker = read("deployment/multi-invoice-ledger/stripe-checkout-worker-v39.js");
assert.match(worker,/syncCrmInvoiceLedger/);
assert.match(worker,/payment_id: `PAY-\$\{invoiceId\}`/);
assert.match(worker,/crm_ledger_linked/);

console.log("multi-invoice ledger QA passed");
