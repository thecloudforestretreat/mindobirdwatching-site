import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const worker = fs.readFileSync(new URL("../mbw-stripe-checkout-worker-v44.js", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../book-tour/create/index.html", import.meta.url), "utf8");

test("Waterfall Hike uses $20 inline pricing in both languages", () => {
  for (const language of ["en", "es"]) {
    const entry = worker.match(new RegExp(`"tour_code": "MBW013",\\s+"language": "${language}"[^}]+`))?.[0];
    assert.ok(entry, language);
    assert.match(entry, /"status": "active"/);
    assert.match(entry, /"use_inline_price": true/);
    assert.match(entry, /"amount_display": "\$20\.00"/);
  }
});

test("CRM invoice mapping uses exact codes and leaves unavailable products blank", () => {
  const codes = ["MBW013", "ACT003", "ACT009", "ACT017-R2"];
  const state = { tours: codes.map(tour_code => ({ tour_code, language: "en" })) };
  const source = page.match(/  function inboundTourCode\(item, language\) \{[\s\S]*?\n  \}/)[0];
  const resolve = vm.runInNewContext(`(${source.trim()})`, { state });
  for (const code of codes) assert.equal(resolve({ product_selected: `${code} - Name` }, "en"), code);
  assert.equal(resolve({ product_selected: "ACT002 - Waterfalls" }, "en"), "");
  assert.equal(resolve({ tour: "Waterfall Hike" }, "en"), "");
  assert.equal(resolve({ product_selected: "MBW013" }, "es"), "");
});
