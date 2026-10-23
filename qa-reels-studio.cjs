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
assert(html.includes('reels-studio.js?v=12'), "Reels Studio asset cache key must expose recovery controls");
assert(html.includes('reels-studio.css?v=5'), "Reels Studio CSS cache key must expose service health styles");
assert(ui.includes('Number(row.quality_score || 0) >= 92'), "Reels Studio must not present copy below quality 92 as approved");
assert(ui.includes('group === "review" || group === "upcoming"'), "Scheduled reels must remain eligible for explicit copy regeneration");
assert(ui.includes(': copyIsApproved(row) ? ""'), "Approved reels must not show stale generation warnings");
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
assert(api.includes('"replace_media"'), "Reels API must expose a dedicated media-only replacement action");
assert(api.includes("payload.video_url = videoUrl"), "Reels API must forward only the validated replacement URL");
assert(ui.includes('request("replace_media"'), "Reels Studio must call the media-only replacement action");
assert(ui.includes("Captions, hashtags, title, schedule, quality score, and approval remain exactly as they are."), "The replacement UI must clearly describe preserved fields");
assert(ui.includes("mediaCanBeReplaced"), "Reels Studio must lock media replacement after publishing starts");
assert(ui.includes('activeStatus: "review"'), "Reels Studio must open on the actionable approval queue");
assert(html.indexOf('data-status="review"') < html.indexOf('data-status="upcoming"'), "Needs approval must appear before Upcoming");
assert(html.includes('data-status="review">Needs approval'), "The review queue must use action-oriented wording");
assert(html.includes('data-status="failed">Needs attention'), "Publishing failures must use the same Needs attention wording as the summary");
assert(ui.includes('It is currently '), "Past-time guidance must show the current Eastern time");
assert(api.includes('"publish_overdue"'), "Reels API must expose the protected overdue recovery action");
assert(api.includes('action: "health"'), "Reels API must expose a dependency health check");
assert(ui.includes('function isOverdue(row)'), "Reels Studio must identify approved posts that missed their publishing window");
assert(ui.includes('request(action === "save" ? "update_reel" : action === "publish-overdue" ? "publish_overdue"'), "Overdue recovery must use its dedicated API action");
assert(ui.includes('platforms already published will be skipped'), "Recovery confirmation must explain destination idempotency");
assert(html.includes('id="systemHealth"'), "Reels Studio must display publishing service health");

console.log(JSON.stringify({
  ok: true,
  api: "https://mindobirdwatching.com/api/admin/reels",
  cacheKey: "v12",
  handlers: ["GET", "POST", "OPTIONS"]
}, null, 2));
