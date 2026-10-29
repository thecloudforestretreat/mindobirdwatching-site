import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync("admin/assets/js/reels-studio.js", "utf8");
const page = fs.readFileSync("admin/media/reels/index.html", "utf8");

assert.match(script, /media-insights\?period=90d/);
assert.match(script, /minimum_posts_per_slot \|\| 5/);
assert.match(script, /comparable first-seven-day performance/);
assert.match(script, /\["instagram", "facebook", "youtube"\]/);
assert.match(script, /!\$\("batchTime"\)\.dataset\.userEdited/);
assert.match(script, /No evidence-qualified/);
assert.match(page, /id="timingGuidance"/);

console.log("reels timing guidance QA passed");
