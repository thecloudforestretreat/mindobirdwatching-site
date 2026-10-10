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
assert(html.includes('reels-studio.js?v=5'), "Reels Studio asset cache key must expose the API-host fix");
assert(api.includes("export async function onRequestGet"), "Reels API GET handler is missing");
assert(api.includes("export async function onRequestPost"), "Reels API POST handler is missing");
assert(api.includes('"access-control-allow-origin"'), "Reels API CORS header is missing");
assert(api.includes("ADMIN_ORIGIN"), "Reels API must explicitly allow the protected admin origin");

console.log(JSON.stringify({
  ok: true,
  api: "https://mindobirdwatching.com/api/admin/reels",
  cacheKey: "v5",
  handlers: ["GET", "POST", "OPTIONS"]
}, null, 2));
