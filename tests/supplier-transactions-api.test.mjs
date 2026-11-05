import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSupplierTransaction, summarizeSupplierTransactions } from "../functions/lib/supplier-transactions.mjs";
import { onRequestGet, onRequestPost } from "../functions/api/admin/supplier-transactions/index.js";

const env = { LOCAL_TEST_IDENTITY: "owner@example.test", MBW_MOBILE_ROLE_MAP: JSON.stringify({ "owner@example.test": { role: "owner", name: "Juan" } }), MBW_MOBILE_WRITE_ENABLED: "true", N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook", N8N_CRM_ADMIN_TOKEN: "secret" };

test("supplier transactions preserve separate deposit and balance references", () => {
  const deposit = normalizeSupplierTransaction({ commitment_id: "SC-1", supplier_name: "Hotel", transaction_type: "deposit", payment_method: "bank_transfer", transaction_date: "2027-02-01", amount: 50, confirmation_number: "DEP-1" });
  const balance = normalizeSupplierTransaction({ commitment_id: "SC-1", supplier_name: "Hotel", transaction_type: "balance", payment_method: "credit_card", transaction_date: "2027-02-09", amount: 50, confirmation_number: "BAL-2" });
  assert.notEqual(deposit.supplier_transaction_id, balance.supplier_transaction_id);
  assert.deepEqual(summarizeSupplierTransactions([deposit, balance]), { cashPaid: 100, credits: 0, settled: 100, count: 2 });
});

test("refunds reduce supplier cash paid and credits reduce balance", () => {
  assert.deepEqual(summarizeSupplierTransactions([{ transaction_type: "full_payment", amount: 200 }, { transaction_type: "refund", amount: 25 }, { transaction_type: "credit", amount: 10 }]), { cashPaid: 175, credits: 10, settled: 185, count: 3 });
});

test("electronic supplier transactions require confirmation numbers", () => {
  assert.throws(() => normalizeSupplierTransaction({ commitment_id: "SC-1", supplier_name: "Hotel", payment_method: "bank_transfer", transaction_date: "2027-02-01", amount: 50 }), /confirmation number/i);
});

test("admin endpoint lists and saves supplier transactions", async () => {
  const original = global.fetch;
  global.fetch = async (_url, init) => {
    const payload = JSON.parse(new URLSearchParams(init.body).get("payload"));
    if (payload.action === "list_supplier_transactions") return Response.json({ ok: true, records: [] });
    if (payload.action === "upsert_supplier_transaction") return Response.json({ ok: true, record: payload.transaction });
    throw new Error(`Unexpected action ${payload.action}`);
  };
  try {
    const listed = await onRequestGet({ request: new Request("http://localhost/api/admin/supplier-transactions?commitment_id=SC-1"), env });
    assert.equal(listed.status, 200);
    const saved = await onRequestPost({ request: new Request("http://localhost/api/admin/supplier-transactions", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ commitment_id: "SC-1", supplier_name: "Hotel", transaction_type: "deposit", payment_method: "cash", transaction_date: "2027-02-01", amount: 25 }) }), env });
    assert.equal(saved.status, 200);
  } finally { global.fetch = original; }
});
