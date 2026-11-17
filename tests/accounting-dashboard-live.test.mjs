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

test("accounting operations feed bypasses stale source caches and reports health", async () => {
  const api = await read("functions/api/admin/accounting-dashboard.js");

  assert.match(api, /cache:\s*"no-store"/);
  assert.match(api, /&_\=\$\{Date\.now\(\)\}/);
  assert.match(api, /source_health:\s*sourceHealth/);
  assert.match(api, /fee_allocation:\s*feeAllocationSummary/);
  assert.match(api, /available:\s*Boolean/);
  assert.match(api, /text\(row\.month_ky\) <= month/);
  assert.match(api, /Daily reconciliation is/);
});

test("accounting dashboard assets are cache-busted together", async () => {
  const html = await read("admin/accounting/index.html");
  const cssVersion = html.match(/accounting\.css\?v=([^"']+)/)?.[1];
  const jsVersion = html.match(/accounting\.js\?v=([^"']+)/)?.[1];

  assert.ok(cssVersion, "accounting CSS version is present");
  assert.equal(jsVersion, cssVersion);
});
