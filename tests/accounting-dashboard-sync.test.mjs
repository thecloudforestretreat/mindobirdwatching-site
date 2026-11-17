import assert from "node:assert/strict";
import test from "node:test";
import { onRequestPost } from "../functions/api/admin/accounting-dashboard-sync.js";

const tabs = Object.fromEntries([
  "daily_recon", "guide_payment_queue", "guide_settlements", "guide_ledger",
  "expenses", "growth_dashboard", "invoices", "report_income_summary",
  "deposits", "recon_meta_ads_import",
].map(name => [name, []]));

function fakeDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const statement = {
        bind(...values) { calls.push({ sql, values }); return statement; },
        async run() { calls.push({ sql, run: true }); return { success: true }; },
      };
      return statement;
    },
  };
}

test("snapshot receiver rejects unauthenticated writes", async () => {
  const response = await onRequestPost({
    request: new Request("https://admin.mindobirdwatching.com/api/admin/accounting-dashboard-sync", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
    env: { GSHEET_WEBAPP_TOKEN: "secret", MBW_PORTFOLIO_DB: fakeDb() },
  });
  assert.equal(response.status, 401);
});

test("snapshot receiver validates and stores the current snapshot", async () => {
  const db = fakeDb();
  const payload = { ok: true, generated_at: "2026-11-17T20:00:00.000Z", tabs };
  const response = await onRequestPost({
    request: new Request("https://admin.mindobirdwatching.com/api/admin/accounting-dashboard-sync", {
      method: "POST",
      headers: { "authorization": "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    env: { GSHEET_WEBAPP_TOKEN: "secret", MBW_PORTFOLIO_DB: db },
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.ok(db.calls.some(call => /ON CONFLICT\(snapshot_id\)/.test(call.sql)));
  assert.ok(db.calls.some(call => call.values?.[0] === "current"));
});

test("snapshot receiver uses the existing attribution database binding", async () => {
  const db = fakeDb();
  const payload = { ok: true, generated_at: "2026-11-17T20:00:00.000Z", tabs };
  const response = await onRequestPost({
    request: new Request("https://admin.mindobirdwatching.com/api/admin/accounting-dashboard-sync", {
      method: "POST",
      headers: { "authorization": "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    env: { GSHEET_WEBAPP_TOKEN: "secret", MBW_ATTRIBUTION_DB: db },
  });
  assert.equal(response.status, 200);
  assert.ok(db.calls.some(call => /accounting_dashboard_snapshots/.test(call.sql)));
});
