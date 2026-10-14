const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("admin/media/reels/index.html", "utf8");
const ui = fs.readFileSync("admin/assets/js/reels-studio.js", "utf8");
const api = fs.readFileSync("functions/api/admin/reels/index.js", "utf8");

assert(
  ui.includes('var API = "https://mindobirdwatching.com/api/admin/reels";'),
  "Reels Studio must use the main-site Pages Function, not the static admin host"
);
assert(!ui.includes('var API = "/api/admin/reels";'), "Relative Reels API URL would resolve to the static admin host");
assert(html.includes('reels-studio.js?v=7'), "Reels Studio asset cache key must expose the publishing-safety update");
assert(html.includes('reels-studio.css?v=3'), "Reels Studio CSS cache key must expose copy-only and outage styles");
assert(ui.includes('Number(row.quality_score || 0) >= 92'), "Reels Studio must not present copy below quality 92 as approved");
assert(ui.includes('group === "review" || group === "upcoming"'), "Scheduled reels must remain eligible for explicit copy regeneration");
assert(ui.includes('var reviewNotice = copyIsApproved(row) ? ""'), "Approved reels must not show stale generation warnings");
assert(api.includes("export async function onRequestGet"), "Reels API GET handler is missing");
assert(api.includes("export async function onRequestPost"), "Reels API POST handler is missing");
assert(api.includes('"access-control-allow-origin"'), "Reels API CORS header is missing");
assert(api.includes("ADMIN_ORIGIN"), "Reels API must explicitly allow the protected admin origin");
assert(ui.includes('var AUTOMATED_PLATFORMS = ["instagram", "facebook", "youtube"]'), "Only implemented uploaders may count as automated destinations");
assert(ui.includes('var COPY_ONLY_PLATFORMS = ["tiktok"]'), "TikTok must be represented as copy-only");
assert(ui.includes('reconciliationPlatforms(row).length'), "Ambiguous publication claims must appear as reconciliation work");
assert(!ui.includes('group === "failed" ? \'<button class="button buttonPrimary" type="button" data-action="retry">'), "Reconciliation rows must not expose an automatic retry");
assert(api.includes('code: "MAC_MINI_WORKFLOW_UNAVAILABLE"'), "Mac mini outages need a stable API error code");
assert(api.includes('}, 503)'), "Mac mini outages must return HTTP 503");

console.log(JSON.stringify({
  ok: true,
  api: "https://mindobirdwatching.com/api/admin/reels",
  cacheKey: "v7",
  handlers: ["GET", "POST", "OPTIONS"]
}, null, 2));
