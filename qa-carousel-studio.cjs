const fs = require("fs");
const assert = require("assert");
const { pathToFileURL } = require("url");
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

const root = __dirname;
const read = (path) => fs.readFileSync(`${root}/${path}`, "utf8");
const json = (path) => JSON.parse(read(path));

function compileWorkflow(path) {
  const workflow = json(path);
  const names = new Set(workflow.nodes.map((node) => node.name));
  for (const node of workflow.nodes) {
    if (node.parameters && node.parameters.jsCode) new AsyncFunction(node.parameters.jsCode);
  }
  for (const [source, groups] of Object.entries(workflow.connections || {})) {
    assert(names.has(source), `${path}: missing source node ${source}`);
    for (const group of Object.values(groups)) for (const list of group) for (const target of list) {
      assert(names.has(target.node), `${path}: missing target node ${target.node}`);
    }
  }
  return workflow;
}

(async () => {
  const html = read("admin/media/carousels/index.html");
  const ui = read("admin/assets/js/carousel-studio.js");
  const css = read("admin/assets/css/carousel-studio.css");
  for (const id of [...ui.matchAll(/\$\("([A-Za-z][A-Za-z0-9_-]*)"\)/g)].map((match) => match[1])) {
    assert(html.includes(`id="${id}"`), `UI references missing #${id}`);
  }
  assert(html.includes("2–10"), "UI must state the supported slide count");
  assert(html.includes("1080 × 1350"), "UI must disclose the output dimensions");
  assert(html.includes("carousel-studio.css?v=8") && html.includes("carousel-studio.js?v=14"), "Carousel asset cache keys must expose reliable schedule editing");
  assert(ui.includes('c==="HUMAN_EDITED"?"Human edited"'), "Approved human edits must not be presented as a failing legacy quality score");
  assert(html.includes("Carousel subject") && html.includes("recent night walks") && !html.includes("Bird name</span>"), "Intake must accept birds, trips, tours, and open-ended subjects");
  assert(ui.includes("America/New_York"), "UI must use the fixed Eastern timezone");
  assert(html.includes('id="scheduledDate"') && html.includes('id="scheduledTime"'), "Carousel intake must expose editable date and time fields");
  assert(ui.includes("function defaultSchedule(){return{date:addDays(today(),1),time:\"07:00\"}}"), "New carousels must default to tomorrow at 7:00 AM Eastern");
  assert(ui.includes('$("scheduledDate").min=today()'), "Carousel intake must still allow a future time today");
  assert(!ui.includes("Date.now()+15*60000"), "Carousel intake must not default to the next 15-minute slot");
  assert(ui.includes("already 1 carousel") && ui.includes("scheduled for this date"), "UI must warn about same-date scheduling");
  assert(ui.includes("Save date &amp; time") && ui.includes('act("schedule")'), "Carousel review must expose a dedicated schedule save control");
  const actionFlow = ui.match(/async function act[\s\S]*?function copyValue/)[0];
  assert(actionFlow.indexOf("var captured=currentEdits()") < actionFlow.indexOf("renderReview(true)"), "Review edits must be captured before the busy-state render replaces form values");
  assert(actionFlow.includes('action==="schedule"?{scheduled_date:captured.scheduled_date,scheduled_time:captured.scheduled_time}:captured'), "Schedule-only saves must not overwrite caption fields");
  assert(actionFlow.includes("Saved for ") && css.includes("scheduleSaveRow"), "Successful schedule saves need visible confirmation");
  assert(ui.includes("x[-_ ]?ray") && ui.includes("sticky|graphic|infographic|notes"), "UI must identify educational graphics for fit/pad treatment");
  assert(/aspect-ratio\s*:\s*4\s*\/\s*5/.test(css), "Previews must use the Instagram 4:5 aspect ratio");
  assert(html.includes('id="showSafeGuide"') && html.includes('id="showProfileGuide"'), "Preview guide controls are missing");
  assert(ui.includes("data-drag-handle") && ui.includes("ondrop"), "Drag-to-reorder support is missing");
  assert(ui.includes("data-review-drag") && ui.includes("data-review-move") && ui.includes("reorderReview"), "Existing carousel review must support drag and arrow reordering");
  const reorderFlow = ui.match(/async function reorderReview[\s\S]*?async function replaceImage/)[0];
  assert(reorderFlow.includes('api("update_carousel_images"') && !reorderFlow.includes('api("regenerate_carousel"'), "Review reordering must save the image manifest without regenerating copy");
  assert(reorderFlow.includes("title, captions, hashtags, quality score, approval, date, and time were kept unchanged"), "Review reordering must explain that copy, approval, and scheduling are preserved");
  assert(css.includes("reviewSlideControls") && css.includes("reviewDragHandle"), "Review reorder controls are not styled");
  assert(ui.includes("crop_gravity") && ui.includes("data-gravity"), "Per-slide crop focus is missing");
  assert(html.includes('id="replaceImageFile"') && ui.includes('data-replace-image') && ui.includes('update_carousel_images'), "Unpublished slide replacement is missing");
  const replacementFlow = ui.match(/async function replaceImage[\s\S]*?function currentEdits/)[0];
  assert(!replacementFlow.includes('api("regenerate_carousel"'), "Replacing an image must not regenerate or erase approved copy");
  assert(replacementFlow.includes("quality score, approval, date, and time were kept unchanged"), "Image replacement must explain that copy and scheduling were preserved");
  assert(ui.includes("startReviewPolling") && ui.includes("refreshSelected") && ui.includes("AI review in progress"), "Live review status refresh is missing");
  assert(ui.includes("startRecoveryPolling") && ui.includes("Recover missing platform") && ui.includes("Only platforms without a saved post ID are eligible"), "Safe recovery progress UI is missing");
  assert(ui.includes("platformComplete") && ui.indexOf('["failed","partial","error","recovery_required"]') < ui.indexOf('if(s==="published"&&platformComplete'), "Partial publication must remain recoverable instead of appearing published");
  assert(css.includes("publishingProgress") && css.includes("platformProgress"), "Publishing recovery progress is not styled");
  assert(ui.includes("HUMAN_EDITED"), "Human-edited review state is missing");
  assert(ui.includes("quality_score||0)<92") && ui.includes("Regenerate copy"), "Legacy sub-92 copy must be routed to regeneration, not approval");
  assert(!ui.includes('value="manual"'), "New carousel slides must not bypass 4:5 normalization");
  assert(css.includes("editorialSafeGuide") && css.includes("profileCropGuide"), "Safe-area and profile-crop overlays are missing");

  const main = compileWorkflow("MBW - AI Carousels - IMPORT.json");
  const intake = compileWorkflow("MBW - Carousel Intake - IMPORT.json");
  const gateway = compileWorkflow("n8n/generated/MBW - Carousel Admin Gateway - IMPORT.json");
  const adminMain = compileWorkflow("n8n/generated/MBW - AI Carousels - Admin Trigger - IMPORT.json");
  assert(main.nodes.length === 67, "Unexpected main workflow node count");
  assert(intake.nodes.some((node) => node.name === "[INTAKE] Validate and Split Images"), "Legacy intake must support variable slide counts");
  assert(gateway.nodes.some((node) => node.name === "Plan Carousel Action"), "Admin gateway planner is missing");
  assert(adminMain.nodes.some((node) => node.name === "[ADMIN] Trigger Carousel Processing"), "Admin processing webhook is missing");
  const schedule = adminMain.nodes.find((node) => node.name === "[CORE] Scheduled Trigger");
  assert(schedule, "Carousel schedule trigger is missing");
  assert.deepStrictEqual(schedule.parameters.rule.interval, [{ field: "hours", hoursInterval: 1, triggerAtMinute: 10 }], "Carousel production queue must run hourly at minute 10");
  assert(JSON.stringify(adminMain).includes("Beyond the Portrait") && JSON.stringify(adminMain).includes("contentMode === 'experience'"), "Admin-trigger workflow must contain both bird and experience copy modes");
  const allMainText = JSON.stringify(main);
  assert(!allMainText.includes("generativelanguage.googleapis.com"), "Carousel copy must remain local-first");
  assert(allMainText.includes("gpt-oss:20b intent engine + independent repair editor | en-US v10"), "Intent-aware two-pass local editor identity is missing");
  assert(main.nodes.some((node) => node.name === "[GEN] Final Local Repair Editor"), "Final local repair editor is missing");
  assert(main.nodes.some((node) => node.name === "[GEN] Mark Generation Started"), "Generation concurrency lock is missing");
  assert(allMainText.includes("editorial score below 92") && allMainText.includes("HUMAN_EDITED"), "Quality threshold or validated human-edit path is missing");
  assert(allMainText.includes("Beyond the Portrait") && allMainText.includes("contentMode === 'experience'") && allMainText.includes("Never treat an activity phrase as a species"), "Adaptive bird, experience, and general copy routing is missing");
  assert(allMainText.includes("shift perspectives|distinct visual formats|different kind of attention|designed for slower looking"), "Mechanical carousel language must be rejected during local review");
  assert(allMainText.includes("PUBLISH BLOCKED: approved copy must pass both local reviews or contain validated human edits"), "Approval publishing gate is missing");
  assert(allMainText.includes("={{ $json.instagram_permalink }}") && allMainText.includes("={{ $json.facebook_permalink }}"), "Published post permalinks must be saved");
  const instagramParent = main.nodes.find((node) => node.name === "[IG] Create Parent Carousel");
  assert(instagramParent && !JSON.stringify(instagramParent).includes("location_id"), "Instagram parent payload must not send an unverified location Page ID");
  const instagramVerifier = main.nodes.find((node) => node.name === "[IG] Verify Published Caption");
  const facebookVerifier = main.nodes.find((node) => node.name === "[FB] Verify Published Caption");
  assert(instagramVerifier.parameters.jsCode.includes("/#(?:[\\p{L}\\p{N}_]+)/u.test(publishedCaption)") && !instagramVerifier.parameters.jsCode.includes("firstHashtag"), "Instagram post-read verification must accept platform-normalized hashtags");
  assert(facebookVerifier.parameters.jsCode.includes("/#(?:[\\p{L}\\p{N}_]+)/u.test(publishedMessage)") && !facebookVerifier.parameters.jsCode.includes("firstHashtag"), "Facebook post-read verification must accept platform-normalized hashtags");
  assert(allMainText.includes("between two and ten image URLs"), "2–10 URL validation is missing");
  const transformText = allMainText + JSON.stringify(intake) + read("functions/api/admin/carousels/index.js");
  assert(transformText.includes("c_pad,b_rgb:f7f4e8"), "Fit/pad transform is missing");
  assert(transformText.includes("c_fill,g_auto"), "Photo crop transform is missing");
  assert(!JSON.stringify(intake).match(/Exactly 9|exactly nine|length !== 9/), "Legacy nine-image enforcement remains");

  const copyParser = main.nodes.find((node) => node.name === "[GEN] Parse and Validate Copy");
  assert(copyParser, "Final carousel copy parser is missing");
  const canonicalParser = read("n8n/carousel-copy-parser.js").trim();
  assert.strictEqual(copyParser.parameters.jsCode.trim(), canonicalParser, "Main workflow parser must match the canonical source");
  assert.strictEqual(adminMain.nodes.find((node) => node.name === "[GEN] Parse and Validate Copy").parameters.jsCode.trim(), canonicalParser, "Admin-trigger parser must match the canonical source");
  assert(allMainText.includes("community or family invitation") && allMainText.includes("bird_profile|trip_recap|tour_experience|community|wildlife_encounter|educational|general"), "Local prompts must recognize community and family content as a first-class mode");
  const runParser = async (row) => {
    const select = (name) => ({ item: { json: name === "Classify Carousel" ? row : { message: { content: "{}" } } } });
    const fakeDateTime = { now: () => ({ setZone: () => ({ toISO: () => "2026-10-12T12:00:00.000-04:00" }) }) };
    const fn = new AsyncFunction("$", "$json", "DateTime", copyParser.parameters.jsCode);
    return (await fn(select, { message: { content: "{}" } }, fakeDateTime))[0].json;
  };
  const imageUrls = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`image_${index + 1}_url`, `https://res.cloudinary.com/dd25hpdx3/image/upload/night-${index + 1}.jpg`]));
  const experienceCopy = await runParser({
    ...imageUrls,
    featured_birds: "Some recent night walks",
    location: "Mindo, Ecuador",
    images_json: JSON.stringify(Array.from({ length: 10 }, (_, index) => ({ order: index + 1, content_type: index < 2 ? "guest" : "photo" }))),
    admin_mode: "review",
  });
  assert.strictEqual(experienceCopy.copy_review_status, "PASS", "A grounded trip/night-walk fallback should pass local validation");
  assert(!/\b(bird|species|portrait|x-ray)\b/i.test([experienceCopy.carousel_title, experienceCopy.caption, experienceCopy.facebook_caption, experienceCopy.reddit_title, experienceCopy.reddit_caption].join(" ")), "Experience copy must never be forced into a bird-profile template");
  assert(/night walks/i.test(experienceCopy.carousel_title) && experienceCopy.instagram_hashtags.includes("#MindoNightWalk"), "Experience copy must retain the submitted subject and receive contextual hashtags");
  assert.strictEqual(experienceCopy.quality_score, 92, "Minimal-input experience copy must use the validated safe fallback rather than inherit an inflated model score");
  assert(/After Dark in Mindo/.test(experienceCopy.carousel_title) && /recent evenings out/.test(experienceCopy.caption), "Night-walk fallback must sound like an experience, not a mechanical image inventory");

  const recentHighlightsCopy = await runParser({
    ...imageUrls,
    featured_birds: "A couple of recent tour highlights.",
    location: "Mindo, Ecuador",
    images_json: JSON.stringify(Array.from({ length: 10 }, (_, index) => ({ order: index + 1, content_type: index < 2 ? "guest" : "photo" }))),
    admin_mode: "review",
  });
  assert.strictEqual(recentHighlightsCopy.copy_review_status, "PASS", "A sentence-style recent-tour subject should produce validated copy");
  assert(!/[.!?]\s+in Mindo/i.test(recentHighlightsCopy.caption), "Trailing subject punctuation must not create a broken sentence before the location");
  assert(recentHighlightsCopy.caption.startsWith("A couple of recent tour highlights in Mindo, Ecuador"), "The normalized subject should flow naturally into the location");

  const quitoTripCopy = await runParser({
    ...imageUrls,
    featured_birds: "In Quito, enjoy a day trip to witness the magic of Mindo",
    location: "Mindo, Ecuador",
    images_json: JSON.stringify(Array.from({ length: 10 }, (_, index) => ({ order: index + 1, content_type: index < 2 ? "guest" : "photo" }))),
    admin_mode: "review",
  });
  const quitoTripText = [quitoTripCopy.carousel_title, quitoTripCopy.caption, quitoTripCopy.facebook_caption, quitoTripCopy.reddit_title, quitoTripCopy.reddit_caption].join(" ");
  assert.strictEqual(quitoTripCopy.copy_review_status, "PASS", "A sentence-style Quito-to-Mindo trip prompt should produce validated copy");
  assert.strictEqual(quitoTripCopy.carousel_title, "From Quito to Mindo: A Day Trip in 10 Photos", "Sentence-style trip prompts must be normalized into a natural title");
  assert(!/\b(?:from in|Mindo(?:,\s*Ecuador)?\s+in\s+Mindo)\b/i.test(quitoTripText), "Trip copy must reject broken prepositions and repeated locations");
  assert(!quitoTripText.includes("In Quito, enjoy a day trip to witness the magic of Mindo in Mindo"), "Raw sentence-style prompts must not be pasted into copy templates");

  const familyCopy = await runParser({
    image_1_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/family-walk.jpg",
    image_2_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/family-scope.jpg",
    image_3_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/bird.jpg",
    featured_birds: "Join the Mindo Bird Watching family",
    location: "Mindo, Ecuador",
    images_json: JSON.stringify([{ content_type: "guest" }, { content_type: "guest" }, { content_type: "photo" }]),
    admin_mode: "review",
  });
  const familyText = [familyCopy.carousel_title, familyCopy.caption, familyCopy.facebook_caption, familyCopy.reddit_title, familyCopy.reddit_caption].join(" ");
  assert.strictEqual(familyCopy.content_mode, "community", "Join/family prompts must use the community content mode");
  assert.strictEqual(familyCopy.copy_review_status, "PASS", "Grounded community copy should pass deterministic validation");
  assert.strictEqual(familyCopy.carousel_title, "Birdwatching Is Better Together in Mindo", "Community copy must use a people-centered title");
  assert(/\b(family|together|shared|people|guests)\b/i.test(familyText), "Community copy must remain aligned with people and belonging");
  assert(familyCopy.instagram_hashtags.includes("#FamilyBirding") && !/visual journey|subtle shifts|invites contemplation|natural beauty/i.test(familyText), "Community copy must use contextual hashtags and reject generic AI filler");
  assert.strictEqual(familyCopy.error_message, "", "Passing community copy must not retain misleading review errors");
  assert(canonicalParser.includes("!/^ready$/i") && canonicalParser.includes("editorial score below 92"), "Review errors must exclude READY notes and explain sub-threshold scores");

  const birdCopy = await runParser({
    image_1_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/bird.jpg",
    image_2_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/xray.jpg",
    image_3_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/guide.jpg",
    featured_birds: "Rufous Motmot",
    scientific_name: "Baryphthengus martii",
    location: "Mindo, Ecuador",
    images_json: JSON.stringify([{ content_type: "photo" }, { content_type: "xray" }, { content_type: "infographic" }]),
    admin_mode: "review",
  });
  assert.strictEqual(birdCopy.copy_review_status, "PASS", "Bird-profile fallback should continue to pass local validation");
  assert(/Rufous Motmot/.test(birdCopy.carousel_title) && /X-ray study/.test(birdCopy.caption), "Bird-profile mode must retain educational carousel support");

  const moduleUrl = pathToFileURL(`${root}/functions/api/admin/carousels/index.js`).href + `?qa=${Date.now()}`;
  const api = await import(moduleUrl);
  const call = (body, env = {}) => api.onRequestPost({
    request: new Request("https://mindobirdwatching.com/api/admin/carousels", {
      method: "POST", headers: { origin: "https://admin.mindobirdwatching.com", "content-type": "application/json" }, body: JSON.stringify(body),
    }), env,
  });
  let response = await call({ action: "create_carousel", carousel: { images: [] } });
  assert.strictEqual(response.status, 400, "One-image/empty carousels must fail");
  response = await call({ action: "create_carousel", carousel: {
    featured_birds: "Rufous Motmot", carousel_description: "A factual three-slide Rufous Motmot feature.", scheduled_date: "2000-01-01", scheduled_time: "07:00",
    post_to_instagram: true, images: [{ original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/a.jpg" }, { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/b.jpg" }],
  }});
  assert.strictEqual(response.status, 400, "Past dates must fail at the API boundary");
  const easternParts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const eastern = Object.fromEntries(easternParts.map((part) => [part.type, part.value]));
  response = await call({ action: "create_carousel", carousel: {
    featured_birds: "Rufous Motmot", carousel_description: "A factual three-slide Rufous Motmot feature.", scheduled_date: `${eastern.year}-${eastern.month}-${eastern.day}`, scheduled_time: "00:00",
    post_to_instagram: true, images: [{ original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/a.jpg" }, { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/b.jpg" }],
  }});
  assert.strictEqual(response.status, 400, "A time that already passed today must fail at the API boundary");

  const originalFetch = global.fetch;
  let gatewayPayload;
  global.fetch = async (_url, options) => {
    gatewayPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
  response = await call({ action: "create_carousel", mode: "review", carousel: {
    featured_birds: "Rufous Motmot", scientific_name: "Baryphthengus martii", carousel_description: "A factual three-slide Rufous Motmot feature.",
    scheduled_date: "2099-10-10", scheduled_time: "07:00", post_to_instagram: true, post_to_facebook: false,
    images: [
      { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/v1/photo.jpg", fit_mode: "fill", crop_gravity: "north", content_type: "photo", width: 4284, height: 5712 },
      { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/v1/xray.jpg", fit_mode: "fit", content_type: "xray", width: 928, height: 1152 },
      { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/v1/notes.jpg", fit_mode: "fit", content_type: "infographic", width: 928, height: 1152 },
    ],
  }}, { N8N_ADMIN_CAROUSELS_WEBHOOK_URL: "https://n8n.example.test/webhook/carousels" });
  assert.strictEqual(response.status, 200, "Valid three-slide carousel must pass the API");
  assert(gatewayPayload.carousel.images[0].delivery_url.includes("c_fill,g_north,h_1350,w_1080"), "Photo must honor its selected crop focus");
  assert.strictEqual(gatewayPayload.carousel.images[0].crop_gravity, "north", "Crop focus must be preserved in the image manifest");
  assert(gatewayPayload.carousel.images[1].delivery_url.includes("c_pad,b_rgb:f7f4e8,h_1350,w_1080"), "X-ray must receive fit/pad treatment");
  assert(gatewayPayload.carousel.images[2].delivery_url.includes("c_pad,b_rgb:f7f4e8,h_1350,w_1080"), "Infographic must receive fit/pad treatment");

  response = await call({ action: "update_carousel_images", carousel_id: "CAR-QA-REPLACE", images: [
    { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/v2/replacement.jpg", fit_mode: "fill", crop_gravity: "auto", content_type: "photo", width: 2400, height: 3000 },
    { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/v1/xray.jpg", fit_mode: "fit", crop_gravity: "center", content_type: "xray", width: 928, height: 1152 },
  ]}, { N8N_ADMIN_CAROUSELS_WEBHOOK_URL: "https://n8n.example.test/webhook/carousels" });
  global.fetch = originalFetch;
  assert.strictEqual(response.status, 200, "Valid replacement image manifest must pass the API");
  assert.strictEqual(gatewayPayload.action, "update_carousel_images", "Replacement must use the dedicated safe action");
  assert(gatewayPayload.images[0].delivery_url.includes("c_fill,g_auto,h_1350,w_1080"), "Replacement cover must receive the exact 4:5 crop");
  const gatewayPlanner = gateway.nodes.find((node) => node.name === "Plan Carousel Action").parameters.jsCode;
  assert(!gatewayPlanner.includes("IMAGE_REPLACED_REVIEW_REQUIRED"), "Gateway must preserve existing copy and approval state during image replacement");
  assert(JSON.stringify(gateway).includes("mbw-carousels-process-v14"), "Gateway must call the stable v14 publisher webhook");
  assert(gateway.nodes.find((node) => node.name === "Trigger Carousel Processing").onError === "continueRegularOutput", "Hourly recovery fallback must survive an unavailable immediate handoff");
  assert(gatewayPlanner.includes("staleLock") && gatewayPlanner.includes("Automatic retry is blocked to prevent a duplicate post"), "Retry planner must guard active locks and ambiguous platform artifacts");
  assert(!gatewayPlanner.includes("instagram_container_id:ig?'':") && !gatewayPlanner.includes("facebook_photo_ids:fb?'':"), "Retry must never erase platform artifacts automatically");
  const runGatewayPlanner = async (body, rows) => {
    const select = () => ({ first: () => ({ json: { body } }) });
    const input = { all: () => rows.map((row) => ({ json: row })) };
    return new AsyncFunction("$", "$input", "DateTime", gatewayPlanner)(select, input, {});
  };
  const retryRow = {
    carousel_id: "CAR-QA-RETRY", approval_status: "APPROVED", copy_review_status: "HUMAN_EDITED", quality_score: 92,
    status: "Partial", post_to_instagram: true, post_to_facebook: true, instagram_post_id: "IG-SAVED", facebook_post_id: "",
    instagram_container_id: "IG-CONTAINER-SAVED", facebook_photo_ids: "", publishing_lock: "", image_1_url: "https://example.test/1.jpg", image_2_url: "https://example.test/2.jpg",
  };
  let planned = await runGatewayPlanner({ action: "retry_carousel", carousel_id: retryRow.carousel_id, request_id: "qa-safe" }, [retryRow]);
  assert.strictEqual(planned[0].json._route, "update_trigger", "A missing platform without ambiguous artifacts should be retried immediately");
  assert.strictEqual(planned[0].json.post_to_instagram, true, "Retry must preserve the original destination selection");
  assert.strictEqual(planned[0].json.instagram_post_id, "IG-SAVED", "Retry must preserve an existing platform post ID");
  planned = await runGatewayPlanner({ action: "retry_carousel", carousel_id: retryRow.carousel_id, request_id: "qa-artifact" }, [{ ...retryRow, facebook_photo_ids: '["FB-UPLOAD"]' }]);
  assert.strictEqual(planned[0].json.ok, false, "Ambiguous Facebook uploads must block automatic retry");
  planned = await runGatewayPlanner({ action: "retry_carousel", carousel_id: retryRow.carousel_id, request_id: "qa-lock" }, [{ ...retryRow, publishing_lock: `execution-qa-${new Date().toISOString()}` }]);
  assert.strictEqual(planned[0].json.ok, false, "A current publishing lock must block concurrent retry");
  planned = await runGatewayPlanner({ action: "retry_carousel", carousel_id: retryRow.carousel_id, request_id: "qa-stale" }, [{ ...retryRow, publishing_lock: "execution-qa-2026-01-01T00:00:00.000-05:00" }]);
  assert.strictEqual(planned[0].json._route, "update_trigger", "A stale lock without unfinished artifacts should recover safely");
  assert.strictEqual(planned[0].json.publishing_lock, "", "Safe stale-lock recovery must clear the obsolete lock");

  console.log(JSON.stringify({
    ok: true,
    ui: "DOM references, timezone, scheduling, guides, reordering, crop focus, and 4:5 previews verified",
    api: "validation plus crop-focus-aware fill/pad Cloudinary delivery transforms verified",
    workflows: { mainNodes: main.nodes.length, intakeNodes: intake.nodes.length, gatewayNodes: gateway.nodes.length, adminMainNodes: adminMain.nodes.length },
    samplePolicy: ["photo: fill", "x-ray: fit", "sticky-notes: fit"],
  }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
