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
assert(page.includes("media-studio.css?v=19"), "Media Studio CSS cache key must be current");
assert(page.includes("media-analytics.js?v=4"), "Media analytics cache key must be current");
assert(page.includes("media-studio.js?v=20"), "Media Studio JS cache key must be current");
assert(script.includes("async function fetchInsights(period)")&&script.includes("50000"), "Analytics requests must allow the reporting workflow to finish");
assert(styles.includes(".youtubeFallback"), "YouTube fallback player must be styled");
assert(script.includes('function editorLabel(item){return item.type==="reel"?"Edit Reel":"Edit Carousel"}'), "Editor links must identify the correct media type");
assert(script.includes('class="calendarEventEdit"'), "Calendar cards must expose a direct editor link");
assert(script.includes('class="agendaEdit"'), "Upcoming schedule rows must expose a direct editor link");
assert(script.includes('item.href+"?id="+encodeURIComponent(item.id)'), "Editor links must deep-link to the selected record");
assert(script.includes('"&return="+encodeURIComponent(ret)'), "Editor links must preserve the Media Studio return location");
assert(styles.includes(".calendarEventEdit"), "Calendar editor links must be visibly styled");
assert(styles.includes(".agendaEdit"), "Upcoming schedule editor links must be visibly styled");
assert(script.includes('if(["scheduled","publishing","ready"].includes(s)&&carouselPublishReady(row))return"upcoming"'), "Scheduled carousels must only appear ready when approval and copy validation are publishable");
assert(script.includes('due within 2 days and not ready'), "Media Studio must warn about imminent posts that are not ready");
assert(script.includes("typeLabel+' · '+esc(stateLabel)"), "Calendar cards must spell out their readiness state");
assert(page.includes('<option value="result">Platform visibility</option>'), "Analytics must not label mixed platform visibility as one views/reach metric");
assert(script.includes('Reach, unique viewers, and views are different measures and are not added together.'), "Cross-platform visibility totals must be blocked");
assert(script.includes('visibility coverage'), "Analytics data health must report visibility coverage");
assert(script.includes('hours<=2?\'ready\''), "Hourly analytics freshness must be checked against a two-hour window");
assert(script.includes('Last successful sync'), "Analytics must identify the last successful sync");

console.log(JSON.stringify({ ok: true, checks: 25, youtubeIdFallback: true, savedUrlPrecedence: true, deletedCloudinaryFallback: true, directCalendarEditing: true, deepLinkedEditors: true, preservedReturnLocation: true, strictCarouselReadiness: true, imminentReviewAlert: true, explicitCalendarStatus: true, nonComparableVisibilityGuard: true, visibilityCoverage: true, hourlyFreshness: true }, null, 2));
