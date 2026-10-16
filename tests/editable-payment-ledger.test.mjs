import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../admin/guest-crm/index.html", import.meta.url), "utf8");

test("CRM exposes an editable per-invoice payment ledger", () => {
  assert.match(html, /Invoice &amp; payment history/);
  assert.match(html, /data-payment-action="edit"/);
  assert.match(html, /data-payment-action="save"/);
  assert.match(html, /Save Invoice Changes/);
  assert.match(html, /api\("list_payments"/);
  assert.match(html, /api\("upsert_payment"/);
  assert.match(html, /syncLatestPaymentSummary/);
});

test("ledger edits preserve the selected payment identity", () => {
  assert.match(html, /payment_id:clean\(original\.payment_id\)\|\|id/);
  assert.match(html, /state\.payments=\(state\.payments\|\|\[\]\)\.map/);
  assert.match(html, /without replacing other invoices/);
});

test("ledger loads all payments for a guest, including prior bookings", () => {
  assert.match(html, /api\("list_payments",\{guest_id:record\.guest_id\|\|"",inquiry_id:""\}\)/);
  assert.match(html, /Prior booking/);
  assert.match(html, /This booking/);
});
