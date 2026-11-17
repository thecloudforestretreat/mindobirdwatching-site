import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

test("accounting dashboard uses dynamic periods and exposes decision support", async () => {
  const [html, client] = await Promise.all([
    read("admin/accounting/index.html"),
    read("admin/assets/js/accounting.js"),
  ]);

  assert.doesNotMatch(client, /October profit forecast/);
  assert.match(client, /monthTitle\(p\.month\)/);
  assert.match(html, /id="opportunityGrid"/);
  assert.match(html, /id="feeAllocationMetrics"/);
  assert.match(html, /id="sourceHealthMetrics"/);
  assert.match(client, /Source lag detected/);
  assert.match(client, /Who bears Stripe fees|feeAllocationStatus/);
  assert.match(client, /AbortController/);
  assert.match(client, /20000/);
});

test("accounting operations feed uses a private pushed snapshot and reports health", async () => {
  const [api, sync, logger, middleware] = await Promise.all([
    read("functions/api/admin/accounting-dashboard.js"),
    read("functions/api/admin/accounting-dashboard-sync.js"),
    read("deployment/multi-invoice-ledger/accounting-dashboard-source-v1.0.0.gs"),
    read("functions/_middleware.js"),
  ]);

  assert.match(api, /accounting_dashboard_snapshots/);
  assert.match(api, /MBW_PORTFOLIO_DB/);
  assert.doesNotMatch(api, /docs\.google\.com\/spreadsheets\/d\/.*gviz/);
  assert.doesNotMatch(api, /ACCOUNTING_DASHBOARD_SOURCE_URL/);
  assert.match(api, /source_health:\s*sourceHealth/);
  assert.match(api, /fee_allocation:\s*feeAllocationSummary/);
  assert.match(api, /available:\s*Boolean/);
  assert.match(api, /text\(row\.month_ky\) <= month/);
  assert.match(api, /Daily reconciliation is/);
  assert.match(api, /snapshot_generated_at/);
  assert.match(sync, /authorization/);
  assert.match(sync, /GSHEET_WEBAPP_TOKEN/);
  assert.match(sync, /invalid_snapshot/);
  assert.match(sync, /ON CONFLICT\(snapshot_id\)/);
  assert.match(middleware, /accounting-dashboard-sync/);
  assert.match(logger, /buildAccountingDashboardSource_/);
  assert.match(logger, /ACCOUNTING_DASHBOARD_FIELDS/);
  assert.match(logger, /pushAccountingDashboardSnapshot/);
  assert.match(logger, /configureAccountingDashboardPush/);
  assert.match(logger, /everyMinutes\(15\)/);
  assert.match(logger, /PropertiesService\.getScriptProperties/);
  assert.doesNotMatch(logger, /function doPost/);
  assert.doesNotMatch(logger, /ACCOUNTING_DASHBOARD_TOKEN\s*=/);
});

test("accounting dashboard remains renderable while the operations feed is unavailable", async () => {
  const client = await read("admin/assets/js/accounting.js");

  assert.match(client, /availableCash=num\(ops\?\.cash\?\.available_operating_cash\)/);
  assert.match(client, /guideDue=num\(ops\?\.guide_totals\?\.due_completed\)/);
  assert.doesNotMatch(client, /ops\.cash\.available_operating_cash/);
  assert.doesNotMatch(client, /ops\.guide_totals\.due_completed/);
});

test("accounting dashboard assets are cache-busted together", async () => {
  const html = await read("admin/accounting/index.html");
  const cssVersion = html.match(/accounting\.css\?v=([^"']+)/)?.[1];
  const jsVersion = html.match(/accounting\.js\?v=([^"']+)/)?.[1];

  assert.ok(cssVersion, "accounting CSS version is present");
  assert.equal(jsVersion, cssVersion);
});
