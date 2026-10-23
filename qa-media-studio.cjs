const fs = require("node:fs");
const assert = require("node:assert/strict");

const script = fs.readFileSync("admin/assets/js/media-studio.js", "utf8");
const page = fs.readFileSync("admin/media/index.html", "utf8");
const styles = fs.readFileSync("admin/assets/css/media-studio.css", "utf8");

assert(script.includes("function youtubeId(row)"), "Media Studio must derive a YouTube ID from stored reel data");
assert(script.indexOf("values=[row.youtube_url,row.youtube_permalink]") < script.indexOf('return/^[A-Za-z0-9_-]{11}$/.test(id)?id:""'), "A valid saved YouTube URL must override a stale post ID");
assert(script.includes('"https://www.youtube.com/watch?v="+encodeURIComponent(id)'), "Missing YouTube URLs must be rebuilt from youtube_post_id");
assert(script.includes("www.youtube-nocookie.com/embed/"), "Broken Cloudinary previews must fall back to the published YouTube video");
assert(script.includes('matches(".detailPreview video")'), "Video load failures must trigger the preview fallback");
assert(script.includes("The original preview file is no longer available."), "Records without any fallback must explain the missing preview");
assert(page.includes("media-studio.css?v=17"), "Media Studio CSS cache key must be current");
assert(page.includes("media-studio.js?v=15"), "Media Studio JS cache key must be current");
assert(styles.includes(".youtubeFallback"), "YouTube fallback player must be styled");

console.log(JSON.stringify({ ok: true, checks: 9, youtubeIdFallback: true, savedUrlPrecedence: true, deletedCloudinaryFallback: true }, null, 2));
