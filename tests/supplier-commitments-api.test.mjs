import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet, onRequestPost } from "../functions/api/admin/supplier-commitments/index.js";

const env = {
  LOCAL_TEST_IDENTITY: "owner@example.test",
  MBW_MOBILE_ROLE_MAP: JSON.stringify({ "owner@example.test": { role: "owner", name: "Juan", staffCode: "JP" } }),
  MBW_MOBILE_WRITE_ENABLED: "true",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook",
  N8N_CRM_ADMIN_TOKEN: "secret",
};

test("admin endpoint combines supplier commitments with received guest funds", async () => {
  const original = global.fetch;
  global.fetch = async (_url, init) => {
    const payload = JSON.parse(new URLSearchParams(init.body).get("payload"));
    if (payload.action === "list_supplier_commitments") return Response.json({ ok: true, records: [{ committed_cost: 200, amount_paid: 100, refundability: "nonrefundable", payment_status: "partially_paid" }] });
    if (payload.action === "list_payments") return Response.json({ ok: true, records: [{ total_amount_paid: 500 }] });
    throw new Error("Unexpected CRM action");
  };
  try {
    const request = new Request("http://localhost/api/admin/supplier-commitments?plan_id=p1&inquiry_id=i1");
    const response = await onRequestGet({ request, env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.summary.guestPaid, 500);
    assert.equal(body.summary.nonrefundableExposure, 100);
  } finally { global.fetch = original; }
});

test("admin endpoint validates and confirms an upsert", async () => {
  const original = global.fetch;
  global.fetch = async (_url, init) => {
    const payload = JSON.parse(new URLSearchParams(init.body).get("payload"));
    assert.equal(payload.action, "upsert_supplier_commitment");
    return Response.json({ ok: true, record: payload.commitment });
  };
  try {
    const request = new Request("http://localhost/api/admin/supplier-commitments", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ plan_id: "p1", supplier_name: "Hotel", description: "Room", committed_cost: 100 }) });
    const response = await onRequestPost({ request, env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.verified, true);
    assert.equal(body.record.entered_by, "Juan");
  } finally { global.fetch = original; }
});

test("guide accounts cannot read the private supplier ledger", async () => {
  const guideEnv = { ...env, LOCAL_TEST_IDENTITY: "guide@example.test", MBW_MOBILE_ROLE_MAP: JSON.stringify({ "guide@example.test": { role: "guide", providerName: "Neicer" } }) };
  const response = await onRequestGet({ request: new Request("http://localhost/api/admin/supplier-commitments?plan_id=p1"), env: guideEnv });
  assert.equal(response.status, 403);
});
