import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../book-tour/create/index.html", import.meta.url),
  "utf8",
);

assert.match(source, /homeCountry:\s*""/);
assert.match(source, /getInboundValue\(data, "home_country", "country"\)/);

const singlePayload = source.match(/function buildSingleItemInvoicePayload\(item\) \{[\s\S]*?\n  \}/)?.[0] || "";
const multiPayload = source.match(/function buildMultiItemInvoicePayload\(\) \{[\s\S]*?\n  \}/)?.[0] || "";

assert(singlePayload, "single-item invoice payload builder must exist");
assert(multiPayload, "multi-item invoice payload builder must exist");
assert.match(singlePayload, /home_country:\s*state\.homeCountry/);
assert.match(multiPayload, /home_country:\s*state\.homeCountry/);

console.log("invoice country handoff QA passed");
