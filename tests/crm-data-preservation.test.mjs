import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("CRM keeps saved add-on dates and unknown service metadata", () => {
  const crm = fs.readFileSync(path.join(root, "admin/guest-crm/index.html"), "utf8");
  assert.doesNotMatch(crm, /inheritedWebsiteDate/);
  assert.doesNotMatch(crm, /const itemDate=inheritedWebsiteDate\?"":"/);
  assert.match(crm, /return Object\.assign\(\{\},item,\{id:/);
  assert.match(crm, /const original=\(state\.tourItems\|\|\[\]\)\.find/);
});

test("recurring website merges fill blanks without replacing canonical tour planning", () => {
  const router = fs.readFileSync(path.join(root, "deployment/multi-invoice-ledger/crm-router.gs"), "utf8");
  for (const field of ["requested_date_start", "requested_date_end", "requested_date_text", "tour_items", "tour_items_json", "tour_count", "tour_content", "product_selected", "service_type", "duration_preference", "requested_date"]) {
    assert.match(router, new RegExp(`${field}: keepBest_\\(existing\\.${field}, incoming\\.${field}\\)`), `${field} must preserve the current CRM value`);
  }
});

test("contact intent remains one canonical reference during imports and D1 backfills", () => {
  const router = fs.readFileSync(path.join(root, "deployment/multi-invoice-ledger/crm-router.gs"), "utf8");
  assert.match(router, /contact_intent_id: canonicalContactIntentId_\(incoming\.contact_intent_id, existing\.contact_intent_id\)/);
  assert.match(router, /merged\[key\] = canonicalContactIntentId_\(value, merged\[key\]\)/);
  assert.match(router, /"INQ-20260909013136-0000": "ci_uj8mjpirfnh"/);
  assert.doesNotMatch(router, /"INQ-20260909013136-0000": "ci_tdr46r6pqb4 \| ci_uj8mjpirfnh"/);
});

test("new website add-ons record which values were inherited", () => {
  const handler = fs.readFileSync(path.join(root, "functions/api/book-tour/index.js"), "utf8");
  assert.match(handler, /inherit_date:true, inherit_guests:true, inherit_pickup:true/);
});
