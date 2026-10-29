(function () {
  "use strict";

  // The admin Pages project is static; its API is deployed with the main site
  // and explicitly allows requests from the protected admin origin.
  var API = "https://mindobirdwatching.com/api/admin/reels";
  var INSIGHTS_API = "https://mindobirdwatching.com/api/admin/media-insights?period=90d";
  var state = { rows: [], activeStatus: "review", query: "", selected: null, loading: false, generationPoll: null, timing: null };
  var routeParams = new URLSearchParams(window.location.search), pendingOpenId = cleanRoute(routeParams.get("id"));
  var demoMode = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) && routeParams.get("demo") === "1";

  function cleanRoute(value) { return String(value == null ? "" : value).trim(); }

  function $(id) { return document.getElementById(id); }
  function clean(value) { return String(value == null ? "" : value).trim(); }
  function esc(value) { return clean(value).replace(/[&<>'"]/g, function (char) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]; }); }
  function truthy(value) { return value === true || ["true", "1", "yes", "on"].includes(clean(value).toLowerCase()); }
  function has(value) { return clean(value) !== ""; }
  // Empty future schedule slots are not actionable reels. Published platform
  // URLs are intentionally not required because real drafts do not have them yet.
  function isActionableReel(row) { return Boolean(row && has(row.video_url)); }
  function field(row) { for (var i = 1; i < arguments.length; i += 1) if (has(row[arguments[i]])) return row[arguments[i]]; return ""; }
  function rowId(row) { return clean(field(row, "reel_id", "post_id", "row_number")); }
  function youtubeUrl(row) { var direct = clean(row.youtube_url); var id = clean(row.youtube_post_id); return direct || (id ? "https://www.youtube.com/watch?v=" + encodeURIComponent(id) : ""); }
  function scheduledValue(row) { return [clean(row.scheduled_date), clean(row.scheduled_time)].filter(Boolean).join(" · "); }
  function isoDate(value) {
    var text = clean(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    var match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return match ? match[3] + "-" + match[1].padStart(2, "0") + "-" + match[2].padStart(2, "0") : "";
  }
  function time24(value) {
    var text = clean(value);
    if (/^\d{2}:\d{2}$/.test(text)) return text;
    var match = text.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!match) return "";
    var hour = Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
    return String(hour).padStart(2, "0") + ":" + match[2];
  }
  function easternNow() {
    var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    var values = {}; parts.forEach(function (part) { values[part.type] = part.value; });
    return { date: values.year + "-" + values.month + "-" + values.day, time: values.hour + ":" + values.minute };
  }
  function scheduleIsPast(date, time) {
    var now = easternNow();
    return isoDate(date) + "T" + time24(time) <= now.date + "T" + now.time;
  }
  function isOverdue(row) {
    if (!row || bucketBase(row) !== "upcoming") return false;
    if (reconciliationPlatforms(row).length) return false;
    return scheduleIsPast(row.scheduled_date, row.scheduled_time) && !automatedPlatforms(row).every(function (platform) { return Boolean(platformId(row, platform)); });
  }
  function platformSelected(row, platform) {
    var key = platform === "youtube" ? "post_on_youtube" : platform === "tiktok" ? "post_on_tiktok" : "post_to_" + platform;
    return truthy(row[key]);
  }
  function platformId(row, platform) { return clean(row[platform + "_post_id"]); }
  function platformState(row, platform) { return clean(row[platform + "_publish_state"]).toUpperCase(); }
  var AUTOMATED_PLATFORMS = ["instagram", "facebook", "youtube"];
  var COPY_ONLY_PLATFORMS = ["tiktok"];
  function selectedPlatforms(row) { return AUTOMATED_PLATFORMS.concat(COPY_ONLY_PLATFORMS).filter(function (platform) { return platformSelected(row, platform); }); }
  function automatedPlatforms(row) { return AUTOMATED_PLATFORMS.filter(function (platform) { return platformSelected(row, platform); }); }
  function needsReconciliation(row, platform) {
    if (!AUTOMATED_PLATFORMS.includes(platform) || !platformSelected(row, platform) || platformId(row, platform)) return false;
    return Boolean(clean(row[platform + "_publish_claim_id"])) || ["CLAIMED", "PUBLISHING", "UNKNOWN", "RECONCILE"].includes(platformState(row, platform));
  }
  function reconciliationPlatforms(row) { return AUTOMATED_PLATFORMS.filter(function (platform) { return needsReconciliation(row, platform); }); }
  function mediaCanBeReplaced(row) {
    if (!row || bucket(row) === "published") return false;
    if (AUTOMATED_PLATFORMS.some(function (platform) { return platformId(row, platform); })) return false;
    return !AUTOMATED_PLATFORMS.some(function (platform) {
      return clean(row[platform + "_publish_claim_id"]) || ["CLAIMED", "PUBLISHING", "UNKNOWN", "RECONCILE"].includes(platformState(row, platform));
    });
  }
  function failedPlatforms(row) {
    var value = clean(row.failed_platforms || row.publish_failed_platforms).toLowerCase();
    return AUTOMATED_PLATFORMS.filter(function (platform) { return value.includes(platform); });
  }
  function copyIsGenerated(row) {
    if (!has(row.instagram_caption_final)) return false;
    if (platformSelected(row, "youtube") && !has(row.youtube_title)) return false;
    if (platformSelected(row, "tiktok") && (!has(row.tiktok_caption) || !has(row.tiktok_hashtags))) return false;
    return true;
  }
  function copyValidationIssues(row) {
    var issues = [];
    var instagramSelected = platformSelected(row, "instagram") || platformSelected(row, "facebook");
    var captionBody = clean(row.instagram_caption_final || row.instagram_caption_raw).split(/\n\s*\n(?=#)/)[0];
    var wordCount = captionBody ? captionBody.split(/\s+/).filter(Boolean).length : 0;
    if (instagramSelected && (wordCount < 35 || wordCount > 100)) issues.push("Instagram/Facebook caption must contain 35–100 words (currently " + wordCount + ").");
    if (instagramSelected) {
      var tags = clean(row.instagram_hashtags).split(/\s+/).filter(Boolean);
      if (tags.length !== 5 || tags.some(function (tag) { return !/^#[A-Za-z0-9_]+$/.test(tag); })) issues.push("Instagram requires exactly five valid hashtags.");
    }
    var selectedCopy = [instagramSelected ? captionBody : "", platformSelected(row, "youtube") ? row.youtube_title : "", platformSelected(row, "tiktok") ? row.tiktok_caption : ""].join(" ");
    var source = clean([row.reel_description, row.featured_birds, row.activity_name, row.location, row.verified_details].join(" ")).toLowerCase();
    var sceneTerms = ["trail", "river", "rapids", "current", "garden", "feeder", "bridge", "road", "lodge", "breakfast", "dawn", "sunrise", "nest", "feeding", "habitat", "rainforest"];
    var inventedTerms = sceneTerms.filter(function (term) { return selectedCopy.toLowerCase().includes(term) && !source.includes(term); });
    if (inventedTerms.length) issues.push("The copy includes scene details not found in the supplied description: " + inventedTerms.join(", ") + ".");
    return issues;
  }
  function copyIsApproved(row) {
    return clean(row.approval_status).toUpperCase() === "APPROVED" && Number(row.quality_score || 0) >= 92 && copyIsGenerated(row) && copyValidationIssues(row).length === 0;
  }
  function copyIsGenerating(row) {
    return ["testing", "generating"].includes(clean(row.status).toLowerCase()) && !copyIsGenerated(row);
  }
  function isStaleGeneration(row) {
    if (clean(row.status).toLowerCase() !== "generating") return false;
    var started = Date.parse(clean(row.draft_generated_at));
    return Number.isFinite(started) && started <= Date.now() - (15 * 60 * 1000);
  }
  function bucketBase(row) {
    var status = clean(row.status).toLowerCase();
    var approval = clean(row.approval_status).toUpperCase();
    var selected = automatedPlatforms(row);
    var posted = selected.filter(function (platform) { return platformId(row, platform); });
    var failed = failedPlatforms(row);
    if (status === "published" || (selected.length && posted.length === selected.length)) return "published";
    if (isStaleGeneration(row) || reconciliationPlatforms(row).length || ["failed", "partial", "error", "recovery_required", "needs attention"].includes(status) || failed.length || (posted.length && posted.length < selected.length)) return "failed";
    if (["scheduled", "publishing", "ready"].includes(status) && approval === "APPROVED" && copyIsApproved(row)) return "upcoming";
    return "review";
  }
  function bucket(row) { return isOverdue(row) ? "failed" : bucketBase(row); }
  function statusLabel(row) {
    var group = bucket(row);
    if (group === "published") return { label: "Published", tone: "live" };
    if (isOverdue(row)) return { label: "Overdue", tone: "error" };
    if (isStaleGeneration(row)) return { label: "Generation timed out", tone: "error" };
    if (reconciliationPlatforms(row).length) return { label: "Reconciliation required", tone: "error" };
    if (group === "failed") return { label: clean(row.status) || "Partial", tone: "error" };
    if (group === "upcoming") return { label: clean(row.status) || "Scheduled", tone: "scheduled" };
    if (copyIsGenerating(row)) return { label: "Generating copy", tone: "pending" };
    if (copyIsApproved(row)) return { label: "Copy ready", tone: "scheduled" };
    return { label: clean(row.status) === "Draft" ? "Draft" : "Needs review", tone: "pending" };
  }
  function formatQuality(row) { var score = Number(row.quality_score); return Number.isFinite(score) && score > 0 ? "Quality " + score : "Not scored"; }

  function demoRows() {
    var common = { post_to_instagram: true, post_to_facebook: true, post_on_youtube: true, post_on_tiktok: true, location: "Mindo, Ecuador", media_type: "REELS" };
    return [
      Object.assign({}, common, { reel_id: "REEL-20261012-01", post_id: 18, video_url: "https://res.cloudinary.com/dd25hpdx3/video/upload/v1791332944/1080X1920_7_hgirtw.mp4", reel_description: "Hummingbirds join us for breakfast with a view over Mindo.", scheduled_date: "10/12/2026", scheduled_time: "7:00 AM", status: "Scheduled", approval_status: "APPROVED", quality_score: 100, instagram_caption_final: "Breakfast in Mindo sometimes comes with a few special guests. Hummingbirds moved through the garden while the morning view opened over the cloud forest. Join us for a guided birding experience in Mindo.\n\n#mindobirdwatching #mindo #ecuador #Hummingbirds #MindoBirding", instagram_hashtags: "#mindobirdwatching #mindo #ecuador #Hummingbirds #MindoBirding", tiktok_caption: "Breakfast views in Mindo came with hummingbirds this morning.", tiktok_hashtags: "#mindobirdwatching #mindo #ecuador", tiktok_additional_hashtags: "#Hummingbirds #CloudForest #BirdingTour #EcuadorWildlife #NatureTravel", youtube_title: "Hummingbirds at Breakfast in Mindo, Ecuador" }),
      Object.assign({}, common, { reel_id: "REEL-20261013-02", post_id: 19, video_url: "https://res.cloudinary.com/dd25hpdx3/video/upload/v1791243592/1080X1920_6_c8wb6a.mp4", reel_description: "Several hummingbirds encountered during a recent tour.", scheduled_date: "10/13/2026", scheduled_time: "7:00 AM", status: "Draft", approval_status: "NEEDS_REVIEW", quality_score: 70, error_message: "TikTok caption needs review before scheduling.", instagram_caption_final: "A recent birdwatching tour in Mindo brought several hummingbird encounters.", instagram_hashtags: "#mindobirdwatching #mindo #ecuador #Hummingbirds #BirdingTour", youtube_title: "Hummingbirds on a Birdwatching Tour in Mindo" }),
      Object.assign({}, common, { reel_id: "REEL-20261007-14", post_id: 14, video_url: "https://res.cloudinary.com/dd25hpdx3/video/upload/v1791332944/1080X1920_7_hgirtw.mp4", reel_description: "Most of the times these views come with special guests. Hummingbirds join us for breakfast.", scheduled_date: "10/7/2026", scheduled_time: "7:00 AM", status: "Published", approval_status: "APPROVED", quality_score: 100, instagram_post_id: "17900000000000014", facebook_post_id: "1067000000000014", youtube_post_id: "dQw4w9WgXcQ", youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", instagram_published_date: "10/7/2026 7:06 AM", facebook_published_date: "10/7/2026 7:05 AM", youtube_published_date: "10/7/2026 7:09 AM", instagram_caption_final: "Breakfast views in Mindo came with hummingbirds this morning.\n\n#mindobirdwatching #mindo #ecuador #Hummingbirds #MindoBirding", instagram_hashtags: "#mindobirdwatching #mindo #ecuador #Hummingbirds #MindoBirding", tiktok_caption: "Hummingbirds joined breakfast in Mindo.", tiktok_hashtags: "#mindobirdwatching #mindo #ecuador", tiktok_additional_hashtags: "#Hummingbirds #CloudForest #EcuadorWildlife", youtube_title: "Hummingbirds Join Breakfast in Mindo, Ecuador" }),
      Object.assign({}, common, { reel_id: "REEL-20261008-15", post_id: 15, video_url: "https://res.cloudinary.com/dd25hpdx3/video/upload/v1791159813/1080X1920_5_gsfyjj.mp4", reel_description: "Birdwatching highlights featuring toucans and barbets.", scheduled_date: "10/8/2026", scheduled_time: "7:00 AM", status: "Needs Attention", approval_status: "APPROVED", quality_score: 100, instagram_post_id: "17900000000000015", facebook_post_id: "1067000000000015", youtube_publish_state: "RECONCILE", youtube_publish_claim_id: "demo:youtube:claim", error_message: "YouTube outcome is uncertain. Verify the channel before any retry." })
    ];
  }

  async function request(action, payload) {
    if (demoMode) {
      await new Promise(function (resolve) { window.setTimeout(resolve, 180); });
      if (action === "list_reels") return { ok: true, reels: state.rows.length ? state.rows : demoRows() };
      if (action === "create_batch") {
        var created = payload.reels.map(function (row, index) { return Object.assign({}, row, { reel_id: "DEMO-" + Date.now() + "-" + (index + 1), status: payload.mode === "auto" ? "Scheduled" : "Draft", approval_status: payload.mode === "auto" ? "APPROVED" : "NEEDS_REVIEW", quality_score: payload.mode === "auto" ? 100 : 0 }); });
        state.rows = created.concat(state.rows);
        return { ok: true, created: created, count: created.length };
      }
      return { ok: true };
    }
    var options = action === "list_reels" ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ action: action }, payload || {})) };
    var url = action === "list_reels" ? API + "?limit=150" : API;
    var response = await fetch(url, options);
    var text = await response.text();
    var data;
    try { data = JSON.parse(text || "{}"); } catch (_) { data = { ok: false, message: "The Reels service returned an unreadable response." }; }
    if (!response.ok || data.ok === false) throw new Error(data.message || "Reels service returned " + response.status + ".");
    return data;
  }

  async function loadHealth() {
    var panel = $("systemHealth"), button = $("refreshHealth");
    if (!panel || !button) return;
    panel.dataset.tone = "checking";
    $("healthHeadline").textContent = "Checking publishing services…";
    $("healthDetails").textContent = "Confirming n8n, Google Sheets, and the Mac mini writing service.";
    button.disabled = true;
    try {
      if (demoMode) throw new Error("Health checks use the production service.");
      var response = await fetch(API + "?health=1", { cache: "no-store" });
      var data = await response.json();
      if (!response.ok || data.ok === false) throw new Error(data.message || "Publishing services did not answer.");
      var services = data.services || {}, unavailable = Object.keys(services).filter(function (name) { return services[name] && services[name].ok === false; });
      var checked = data.checked_at ? new Date(data.checked_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "just now";
      panel.dataset.tone = unavailable.length ? "warning" : "healthy";
      $("healthHeadline").textContent = unavailable.length ? "Publishing needs attention" : "Publishing services are ready";
      $("healthDetails").textContent = unavailable.length ? unavailable.join(", ") + " did not pass the latest check. Scheduled posts remain queued." : "n8n, Google Sheets, and Ollama responded at " + checked + ".";
    } catch (error) {
      panel.dataset.tone = "offline";
      $("healthHeadline").textContent = "Publishing service is unreachable";
      $("healthDetails").textContent = error.message + " Scheduled posts remain safely queued.";
    } finally { button.disabled = false; }
  }

  async function loadRows() {
    if (state.loading) return;
    state.loading = true;
    setQueueStatus("Loading reels…", "");
    $("refreshQueue").disabled = true;
    try {
      var data = await request("list_reels");
      var incoming = Array.isArray(data.reels) ? data.reels : Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      state.rows = incoming.filter(isActionableReel);
      render();
      if (pendingOpenId) { var openId = pendingOpenId; pendingOpenId = ""; openReview(openId); }
      setQueueStatus((demoMode ? "Preview data loaded" : "Live queue updated") + " · " + state.rows.length + " reel" + (state.rows.length === 1 ? "" : "s"), "success");
    } catch (error) {
      state.rows = [];
      render();
      setQueueStatus(error.message + " The studio is ready; connect the Reels admin webhook to load live records.", "error");
    } finally {
      state.loading = false;
      $("refreshQueue").disabled = false;
    }
  }

  function setQueueStatus(message, tone) { $("queueStatus").textContent = message; $("queueStatus").dataset.tone = tone || ""; }
  function counts() {
    return state.rows.reduce(function (result, row) { result[bucket(row)] += 1; result.all += 1; return result; }, { upcoming: 0, review: 0, published: 0, failed: 0, all: 0 });
  }
  function renderCounts() {
    var value = counts();
    ["Upcoming", "Review", "Published", "Failed", "All"].forEach(function (name) { $("count" + name).textContent = value[name.toLowerCase()] || 0; });
    $("statReview").textContent = value.review;
    $("statUpcoming").textContent = value.upcoming;
    $("statPublished").textContent = value.published;
    $("statAttention").textContent = value.failed;
  }
  function matchesQuery(row) {
    if (!state.query) return true;
    var haystack = [rowId(row), row.reel_description, row.featured_birds, row.activity_name, row.instagram_caption_final, row.youtube_title, row.status].join(" ").toLowerCase();
    return haystack.includes(state.query.toLowerCase());
  }
  function platformMarkup(row) {
    var failed = failedPlatforms(row);
    var labels = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok copy" };
    return selectedPlatforms(row).map(function (platform) {
      var copyOnly = COPY_ONLY_PLATFORMS.includes(platform);
      var live = Boolean(platformId(row, platform));
      var broken = failed.includes(platform) || needsReconciliation(row, platform);
      return '<span class="platformPill' + (copyOnly ? " isCopy" : live ? " isLive" : broken ? " isError" : "") + '">' + esc(labels[platform]) + (copyOnly ? "" : live ? " ✓" : broken ? " !" : "") + "</span>";
    }).join("") || '<span class="platformPill isError">No destinations</span>';
  }
  function cardMarkup(row) {
    var info = statusLabel(row);
    var group = bucket(row);
    var id = rowId(row);
    var primaryAction = isOverdue(row) ? "Publish overdue reel" : group === "review" ? (copyIsGenerating(row) ? "View progress" : copyIsApproved(row) ? "Open copy" : "Review copy") : isStaleGeneration(row) ? "Review & regenerate" : reconciliationPlatforms(row).length ? "Inspect status" : group === "failed" ? "Inspect & retry" : group === "published" ? "View details" : "Review schedule";
    var youtube = youtubeUrl(row);
    return '<article class="reelCard" data-reel-id="' + esc(id) + '">' +
      '<div class="videoShell"><video src="' + esc(row.video_url) + '" preload="metadata" muted playsinline controls aria-label="Preview ' + esc(id) + '"></video><div class="videoMeta"><span>REEL</span><span>' + esc(clean(row.location) || "Mindo") + "</span></div></div>" +
      '<div class="reelBody"><header class="reelHeader"><div><h3>' + esc(clean(row.activity_name) || clean(row.reel_description) || "Untitled reel") + '</h3><span class="reelId">' + esc(id ? "#" + id : "Unassigned") + '</span></div><span class="statusBadge" data-tone="' + info.tone + '">' + esc(info.label) + '</span></header>' +
      '<div class="reelSummary"><div class="scheduleLine">' + esc(scheduledValue(row) || "No schedule yet") + '</div><p class="descriptionClamp">' + esc(row.reel_description || row.blurb || "No description supplied.") + '</p><div class="platformRow">' + platformMarkup(row) + '</div></div>' +
      '<footer class="reelFooter"><span class="qualityScore">' + esc(formatQuality(row)) + '</span><div class="cardActions">' + (youtube ? '<a class="smallButton" href="' + esc(youtube) + '" target="_blank" rel="noopener noreferrer">YouTube ↗</a>' : "") + '<button class="smallButton primary" type="button" data-review-id="' + esc(id) + '">' + esc(primaryAction) + '</button></div></footer></div></article>';
  }
  function renderCards() {
    var rows = state.rows.filter(function (row) { return (state.activeStatus === "all" || bucket(row) === state.activeStatus) && matchesQuery(row); });
    rows.sort(function (a, b) { return clean(b.scheduled_date).localeCompare(clean(a.scheduled_date)) || Number(b.post_id || 0) - Number(a.post_id || 0); });
    $("reelsGrid").innerHTML = rows.length ? rows.map(cardMarkup).join("") : '<div class="emptyState"><div><strong>No matching reels</strong><span>' + (state.query ? "Try a different search." : "Add a reel or choose another status view.") + "</span></div></div>";
  }
  function render() { renderCounts(); renderCards(); }

  function openComposer() { setDefaultBatchSchedule(false); $("composerBackdrop").hidden = false; document.body.style.overflow = "hidden"; if (!$("batchItems").children.length) addBatchRow(); applyTimingGuidance(); }
  function closeComposer() { $("composerBackdrop").hidden = true; document.body.style.overflow = ""; }
  function todayInEastern() { return easternNow().date; }
  function defaultStartDate() { return addDays(todayInEastern(), 1, false); }
  function addDays(dateString, offset, weekdaysOnly) {
    var date = new Date(dateString + "T12:00:00Z");
    var remaining = offset;
    while (remaining > 0) { date.setUTCDate(date.getUTCDate() + 1); if (!weekdaysOnly || ![0,6].includes(date.getUTCDay())) remaining -= 1; }
    return date.toISOString().slice(0, 10);
  }
  function setDefaultBatchSchedule(force) {
    var start = $("batchStartDate");
    start.min = todayInEastern();
    if (force || !start.value || start.value < start.min) start.value = defaultStartDate();
    if (force) { $("batchTime").value = "07:00"; delete $("batchTime").dataset.userEdited; }
  }
  function weekdayName(dateString) {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(dateString + "T12:00:00Z").getUTCDay()];
  }
  function setTimingGuidance(message, tone) {
    var panel = $("timingGuidance");
    if (!panel) return;
    panel.textContent = message;
    panel.dataset.tone = tone || "";
  }
  function useTimingRecommendation(data) {
    var recommendations = data && data.recommendations || {};
    var date = $("batchStartDate").value || defaultStartDate();
    var day = weekdayName(date);
    var slots = Array.isArray(recommendations.slots) ? recommendations.slots.filter(function (slot) { return Array.isArray(slot.days) && slot.days.includes(day); }) : [];
    var priorities = ["instagram", "facebook", "youtube"];
    var slot = priorities.map(function (platform) { return slots.find(function (candidate) { return clean(candidate.platform).toLowerCase() === platform; }); }).find(Boolean);
    if (!recommendations.configured || !slot) {
      var count = Number(recommendations.sample_size || 0), minimum = Number(recommendations.minimum_posts_per_slot || 5);
      setTimingGuidance("7:00 AM ET baseline · No evidence-qualified " + day + " slot yet (" + count + " comparable sample" + (count === 1 ? "" : "s") + "; at least " + minimum + " per slot required).", "baseline");
      return;
    }
    var recommendedTime = time24(slot.time);
    if (recommendedTime && !$("batchTime").dataset.userEdited) {
      $("batchTime").value = recommendedTime;
      refreshBatchDates();
    }
    setTimingGuidance(clean(slot.platform) + " evidence recommends " + clean(slot.time) + " ET on " + day + " · " + clean(slot.basis) + ". You can still choose another time.", "recommended");
  }
  async function applyTimingGuidance() {
    if (demoMode) { setTimingGuidance("7:00 AM ET baseline · Analytics recommendations are unavailable in preview mode.", "baseline"); return; }
    if (state.timing) { useTimingRecommendation(state.timing); return; }
    setTimingGuidance("Checking comparable first-seven-day performance…", "checking");
    try {
      var response = await fetch(INSIGHTS_API, { cache: "no-store" });
      var data = await response.json();
      if (!response.ok || data.ok === false) throw new Error("Timing analytics did not answer.");
      state.timing = data;
      useTimingRecommendation(data);
    } catch (_) { setTimingGuidance("7:00 AM ET baseline · Timing analytics are temporarily unavailable, so no unsupported recommendation was applied.", "warning"); }
  }
  function refreshBatchDates() {
    var start = $("batchStartDate").value || defaultStartDate();
    var time = $("batchTime").value || "07:00";
    var pattern = $("batchPattern").value;
    Array.from($("batchItems").children).forEach(function (item, index) {
      item.querySelector('[data-field="scheduled_date"]').value = pattern === "same" ? start : addDays(start, index, pattern === "weekdays");
      item.querySelector('[data-field="scheduled_time"]').value = time;
    });
  }
  function numberBatchRows() {
    Array.from($("batchItems").children).forEach(function (item, index) { item.querySelector("[data-row-number]").textContent = index + 1; item.querySelector("[data-remove-row]").hidden = $("batchItems").children.length === 1; });
  }
  function addBatchRow() {
    if ($("batchItems").children.length >= 20) { setBatchStatus("A batch can contain up to 20 reels.", "error"); return; }
    var fragment = $("batchItemTemplate").content.cloneNode(true);
    $("batchItems").appendChild(fragment);
    numberBatchRows(); refreshBatchDates();
  }
  function setBatchStatus(message, tone) { $("batchStatus").textContent = message; $("batchStatus").dataset.tone = tone || ""; }
  function selectedDefaults() { var result = {}; document.querySelectorAll('input[name="platform"]').forEach(function (input) { result[input.value] = input.checked; }); return result; }
  function batchPayload() {
    var defaults = selectedDefaults();
    var timezone = $("batchTimezone").value;
    var rows = Array.from($("batchItems").children).map(function (item) {
      return { video_url: clean(item.querySelector('[data-field="video_url"]').value), reel_description: clean(item.querySelector('[data-field="reel_description"]').value), scheduled_date: item.querySelector('[data-field="scheduled_date"]').value, scheduled_time: item.querySelector('[data-field="scheduled_time"]').value, timezone: timezone, location: "Mindo, Ecuador", post_to_instagram: defaults.instagram, post_to_facebook: defaults.facebook, post_on_youtube: defaults.youtube, post_on_tiktok: defaults.tiktok };
    });
    return { mode: $("batchMode").value, timezone: timezone, reels: rows };
  }
  function scheduleConflicts(reels, excludeId) {
    var conflicts = [];
    reels.forEach(function (candidate, index) {
      var date = isoDate(candidate.scheduled_date);
      if (!date) return;
      reels.slice(0, index).forEach(function (other) { if (isoDate(other.scheduled_date) === date) conflicts.push(date + " (twice in this batch)"); });
      state.rows.forEach(function (row) {
        if (rowId(row) !== clean(excludeId) && isoDate(row.scheduled_date) === date) conflicts.push(date + " (already used by #" + rowId(row) + ")");
      });
    });
    return Array.from(new Set(conflicts));
  }
  function confirmSchedule(reels, excludeId) {
    var invalid = reels.find(function (row) { return !isoDate(row.scheduled_date) || !time24(row.scheduled_time) || scheduleIsPast(row.scheduled_date, row.scheduled_time); });
    if (invalid) {
      var now = easternNow();
      window.alert("Choose a future Eastern date and time. It is currently " + now.date + " at " + now.time + " ET, and the selected publishing time has already passed.");
      return false;
    }
    var conflicts = scheduleConflicts(reels, excludeId);
    return !conflicts.length || window.confirm("Another reel is already scheduled on this date:\n\n" + conflicts.join("\n") + "\n\nSchedule more than one reel that day anyway?");
  }
  async function submitBatch(event) {
    event.preventDefault();
    var payload = batchPayload();
    var duplicate = payload.reels.some(function (row, index) { return payload.reels.findIndex(function (candidate) { return candidate.video_url === row.video_url; }) !== index; });
    if (duplicate) { setBatchStatus("Each video URL in the batch must be unique.", "error"); return; }
    var destinations = selectedDefaults();
    if (!destinations.instagram && !destinations.facebook && !destinations.youtube) { setBatchStatus("Select Instagram, Facebook, or YouTube for automated publishing. TikTok currently generates copy only.", "error"); return; }
    if (!confirmSchedule(payload.reels, "")) return;
    $("submitBatch").disabled = true; setBatchStatus("Sending " + payload.reels.length + " reel" + (payload.reels.length === 1 ? "" : "s") + " for generation…", "");
    try {
      var data = await request("create_batch", payload);
      var createdIds = (Array.isArray(data.created) ? data.created : []).map(rowId).filter(Boolean);
      setBatchStatus((data.count || payload.reels.length) + " reel" + ((data.count || payload.reels.length) === 1 ? "" : "s") + " saved. The Mac mini is generating copy now.", "success");
      window.setTimeout(function () {
        closeComposer();
        $("batchItems").innerHTML = "";
        setDefaultBatchSchedule(true);
        addBatchRow();
        state.activeStatus = "review";
        syncTabs();
        startGenerationPolling(createdIds, payload.mode);
      }, 650);
    } catch (error) { setBatchStatus(error.message, "error"); }
    finally { $("submitBatch").disabled = false; }
  }

  function startGenerationPolling(reelIds, mode) {
    if (state.generationPoll) window.clearTimeout(state.generationPoll);
    var attempts = 0;
    async function poll() {
      attempts += 1;
      await loadRows();
      var tracked = reelIds.map(function (id) { return state.rows.find(function (row) { return rowId(row) === id; }); }).filter(Boolean);
      var complete = reelIds.length ? tracked.length === reelIds.length && tracked.every(function (row) { return copyIsGenerated(row) || bucket(row) === "failed"; }) : state.rows.some(copyIsGenerated);
      if (complete) {
        if (mode === "auto") { state.activeStatus = "upcoming"; syncTabs(); renderCards(); }
        setQueueStatus(mode === "auto" ? "Copy generated and validated. The reel is waiting for its scheduled publish time." : "Copy generated and ready to open. Publishing still requires your approval.", "success");
        state.generationPoll = null;
        return;
      }
      if (attempts >= 24) {
        setQueueStatus("Copy generation is still running on the Mac mini. Use refresh to check again; the scheduled publish time does not control generation.", "");
        state.generationPoll = null;
        return;
      }
      setQueueStatus("Mac mini is generating captions, titles, and hashtags now…", "");
      state.generationPoll = window.setTimeout(poll, 5000);
    }
    poll();
  }

  function copyField(label, key, value, multiline) {
    var control = multiline ? '<textarea data-review-field="' + esc(key) + '">' + esc(value) + '</textarea>' : '<input data-review-field="' + esc(key) + '" value="' + esc(value) + '" />';
    return '<label class="copyField"><span class="copyFieldHeader"><strong>' + esc(label) + '</strong><button class="textButton" type="button" data-copy-field="' + esc(key) + '">Copy</button></span>' + control + "</label>";
  }
  function scheduleEditor(row) {
    return '<section class="scheduleEditor"><div class="scheduleEditorHeader"><strong>Publishing schedule</strong><span>Eastern time (EST/EDT)</span></div><div class="scheduleEditorFields">' +
      '<label><span>Date</span><input type="date" min="' + esc(todayInEastern()) + '" data-review-field="scheduled_date" value="' + esc(isoDate(row.scheduled_date)) + '" required /></label>' +
      '<label><span>Time</span><input type="time" data-review-field="scheduled_time" value="' + esc(time24(row.scheduled_time)) + '" required /></label>' +
      '</div><small>Publishing uses New York Eastern time and automatically follows daylight saving time.</small></section>';
  }
  function mediaEditor(row) {
    if (!mediaCanBeReplaced(row)) return '<section class="mediaEditor isLocked"><div class="mediaEditorHeader"><strong>Video source</strong><span>Locked after publishing begins</span></div><p>The media URL cannot be replaced because this reel has a platform post or an unresolved publishing claim.</p></section>';
    return '<section class="mediaEditor"><div class="mediaEditorHeader"><strong>Replace video only</strong><span>Copy stays unchanged</span></div>' +
      '<label><span>Cloudinary video URL</span><input type="url" data-replacement-video-url value="' + esc(row.video_url) + '" placeholder="https://res.cloudinary.com/…/video/upload/…mp4" /></label>' +
      '<div class="mediaEditorFooter"><small>This changes only the video file. Captions, hashtags, title, schedule, quality score, and approval remain exactly as they are.</small><button class="button buttonGhost" type="button" data-action="replace-media">Replace video</button></div>' +
      '<p class="mediaEditorStatus" data-media-status role="status" aria-live="polite"></p></section>';
  }
  function openReview(id) {
    var row = state.rows.find(function (candidate) { return rowId(candidate) === clean(id); });
    if (!row) return;
    state.selected = row;
    var youtube = youtubeUrl(row);
    var validationIssues = copyValidationIssues(row);
    var reviewNotice = reconciliationPlatforms(row).length
      ? "Do not retry yet. The previous run may already have posted to " + reconciliationPlatforms(row).join(", ") + ". Verify the live platform first; automatic retry is disabled to prevent duplicates."
      : isOverdue(row) ? "This approved reel missed its scheduled publishing window. Its original schedule will be preserved in the record; use Publish now to start one protected recovery attempt."
      : validationIssues.length ? validationIssues.join(" ")
      : copyIsApproved(row) ? ""
      : isStaleGeneration(row)
        ? "Copy generation timed out before it finished. The reel was not approved or published. Regenerate it to start one protected attempt."
        : clean(row.error_message || row.supervision_notes);
    var links = [row.instagram_url && ["Instagram", row.instagram_url], row.facebook_url && ["Facebook", row.facebook_url], youtube && ["Watch on YouTube", youtube], row.tiktok_url && ["TikTok", row.tiktok_url]].filter(Boolean);
    $("reviewTitle").textContent = clean(row.activity_name) || "Review reel " + rowId(row);
    $("reviewContent").innerHTML = '<video class="reviewVideo" src="' + esc(row.video_url) + '" preload="metadata" muted playsinline controls></video>' +
      mediaEditor(row) +
      '<section class="reviewMeta"><article><small>Status</small><strong>' + esc(statusLabel(row).label) + '</strong></article><article><small>Schedule</small><strong>' + esc(scheduledValue(row) || "Not scheduled") + '</strong></article><article><small>Quality</small><strong>' + esc(formatQuality(row)) + '</strong></article></section>' +
      (reviewNotice ? '<div class="warningBox">' + esc(reviewNotice) + "</div>" : "") +
      (platformSelected(row, "tiktok") ? '<div class="infoBox"><strong>TikTok copy only.</strong> The caption and hashtags are prepared here, but this workflow does not publish to TikTok.</div>' : "") +
      scheduleEditor(row) +
      copyField("Original description", "reel_description", row.reel_description, true) +
      copyField("Instagram / Facebook caption", "instagram_caption_final", row.instagram_caption_final, true) +
      copyField("Instagram hashtags", "instagram_hashtags", row.instagram_hashtags, false) +
      copyField("TikTok caption", "tiktok_caption", row.tiktok_caption, true) +
      copyField("TikTok hashtags", "tiktok_hashtags", row.tiktok_hashtags, false) +
      copyField("Additional discovery hashtags", "tiktok_additional_hashtags", row.tiktok_additional_hashtags, false) +
      copyField("YouTube title", "youtube_title", row.youtube_title, false) +
      (links.length ? '<div class="copyLinkRow">' + links.map(function (entry) { return '<a class="externalLink" href="' + esc(entry[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(entry[0]) + " ↗</a>"; }).join("") + "</div>" : "");
    var group = bucket(row);
    $("reviewContent").querySelectorAll("[data-review-field]").forEach(function (control) { control.disabled = group === "published" || isOverdue(row); });
    $("reviewActions").innerHTML = (group === "published" || isOverdue(row) ? "" : '<button class="button buttonGhost" type="button" data-action="save">Save edits</button>') +
      (group === "review" || group === "upcoming" ? '<button class="button buttonGhost" type="button" data-action="regenerate">Regenerate</button>' : "") +
      (group === "review" ? '<button class="button buttonPrimary" type="button" data-action="approve">Approve & schedule</button>' : "") +
      (isOverdue(row) ? '<button class="button buttonPrimary" type="button" data-action="publish-overdue">Publish now</button>' : isStaleGeneration(row) ? '<button class="button buttonPrimary" type="button" data-action="regenerate">Regenerate copy</button>' : group === "failed" && !reconciliationPlatforms(row).length ? '<button class="button buttonPrimary" type="button" data-action="retry">Retry missing platforms</button>' : "") +
      (youtube ? '<button class="button buttonGhost" type="button" data-copy-youtube>Copy YouTube URL</button>' : "");
    $("reviewBackdrop").hidden = false; document.body.style.overflow = "hidden";
  }
  function closeReview() { $("reviewBackdrop").hidden = true; document.body.style.overflow = ""; state.selected = null; }
  function reviewEdits() {
    var edits = {}; document.querySelectorAll("[data-review-field]").forEach(function (input) { edits[input.dataset.reviewField] = clean(input.value); });
    if (has(edits.instagram_hashtags)) {
      var captionBody = clean(edits.instagram_caption_final).split(/\n\s*\n(?=#)/)[0];
      edits.instagram_caption_final = captionBody + "\n\n" + edits.instagram_hashtags;
    }
    edits.timezone = "America/New_York";
    return edits;
  }
  function validateReviewEdits(edits, action) {
    if (!confirmSchedule([{ scheduled_date: edits.scheduled_date, scheduled_time: edits.scheduled_time }], rowId(state.selected))) return false;
    if (platformSelected(state.selected, "instagram")) {
      var tags = clean(edits.instagram_hashtags).split(/\s+/).filter(Boolean);
      if (tags.length !== 5 || tags.some(function (tag) { return !/^#[A-Za-z0-9_]+$/.test(tag); })) {
        window.alert("Instagram requires exactly five hashtags. Replace hashtags as needed, but keep five valid #hashtags.");
        return false;
      }
      if (action === "approve") {
        var captionBody = clean(edits.instagram_caption_final).split(/\n\s*\n(?=#)/)[0];
        var wordCount = captionBody.split(/\s+/).filter(Boolean).length;
        if (wordCount < 35 || wordCount > 100) {
          window.alert("Instagram/Facebook caption must contain 35–100 words. It currently contains " + wordCount + ".");
          return false;
        }
        var source = clean([edits.reel_description, state.selected.featured_birds, state.selected.activity_name, state.selected.location, state.selected.verified_details].join(" ")).toLowerCase();
        var sceneTerms = ["trail", "river", "rapids", "current", "garden", "feeder", "bridge", "road", "lodge", "breakfast", "dawn", "sunrise", "nest", "feeding", "habitat", "rainforest"];
        var inventedTerms = sceneTerms.filter(function (term) { return captionBody.toLowerCase().includes(term) && !source.includes(term); });
        if (inventedTerms.length) {
          window.alert("The caption includes scene details not found in the supplied description: " + inventedTerms.join(", ") + ". Remove them or add verified context before approval.");
          return false;
        }
      }
    }
    return true;
  }
  async function reviewAction(action) {
    if (!state.selected) return;
    if (action === "replace-media") {
      var mediaInput = $("reviewContent").querySelector("[data-replacement-video-url]");
      var mediaStatus = $("reviewContent").querySelector("[data-media-status]");
      var replacementUrl = clean(mediaInput && mediaInput.value);
      if (!mediaCanBeReplaced(state.selected)) { if (mediaStatus) mediaStatus.textContent = "This reel is locked because publishing has already started."; return; }
      if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/.+\.(?:mp4|mov|m4v)(?:[?#].*)?$/i.test(replacementUrl)) { if (mediaStatus) mediaStatus.textContent = "Enter a valid Cloudinary video URL ending in MP4, MOV, or M4V."; return; }
      if (replacementUrl === clean(state.selected.video_url)) { if (mediaStatus) mediaStatus.textContent = "Paste the adjusted video's new Cloudinary URL first."; return; }
      var replaceButton = $("reviewActions").querySelector('[data-action="replace-media"]') || $("reviewContent").querySelector('[data-action="replace-media"]');
      if (replaceButton) replaceButton.disabled = true;
      if (mediaInput) mediaInput.disabled = true;
      if (mediaStatus) mediaStatus.textContent = "Replacing the video URL without changing copy…";
      try {
        await request("replace_media", { reel_id: rowId(state.selected), post_id: state.selected.post_id, video_url: replacementUrl });
        state.selected.video_url = replacementUrl;
        var preview = $("reviewContent").querySelector(".reviewVideo");
        if (preview) { preview.src = replacementUrl; preview.load(); }
        if (mediaStatus) mediaStatus.textContent = "Video replaced. Copy, hashtags, schedule, and approval were preserved.";
        if (!demoMode) await loadRows();
      } catch (error) {
        if (mediaStatus) mediaStatus.textContent = error.message;
      } finally {
        if (replaceButton) replaceButton.disabled = false;
        if (mediaInput) mediaInput.disabled = false;
      }
      return;
    }
    if (action === "publish-overdue" && !window.confirm("Publish this approved overdue reel now? The original scheduled time will remain in its record, and platforms already published will be skipped.")) return;
    var edits = reviewEdits();
    if (["save", "approve"].includes(action) && !validateReviewEdits(edits, action)) return;
    var buttons = Array.from($("reviewActions").querySelectorAll("button")); buttons.forEach(function (button) { button.disabled = true; });
    try {
      var payload = { reel_id: rowId(state.selected), post_id: state.selected.post_id };
      if (action === "save" || action === "approve") {
        payload.edits = edits;
        payload.scheduled_date = edits.scheduled_date;
        payload.scheduled_time = edits.scheduled_time;
      }
      await request(action === "save" ? "update_reel" : action === "publish-overdue" ? "publish_overdue" : action + "_reel", payload);
      if (demoMode) {
        Object.assign(state.selected, payload.edits || {});
        if (action === "approve") { state.selected.status = "Scheduled"; state.selected.approval_status = "APPROVED"; state.selected.quality_score = Math.max(92, Number(state.selected.quality_score) || 100); }
        if (action === "retry") { state.selected.status = "Scheduled"; state.selected.failed_platforms = ""; state.selected.error_message = "Retry queued for missing platforms only."; }
        if (action === "publish-overdue") { state.selected.status = "Publishing"; state.selected.error_message = "Protected recovery started."; }
      }
      closeReview(); render(); if (!demoMode) await loadRows();
    } catch (error) { window.alert(error.message); buttons.forEach(function (button) { button.disabled = false; }); }
  }

  function syncTabs() { document.querySelectorAll(".statusTab").forEach(function (button) { var active = button.dataset.status === state.activeStatus; button.classList.toggle("isActive", active); button.setAttribute("aria-selected", active ? "true" : "false"); }); }
  function bindEvents() {
    $("openComposer").addEventListener("click", openComposer);
    document.querySelectorAll("[data-close-modal]").forEach(function (button) { button.addEventListener("click", closeComposer); });
    document.querySelectorAll("[data-close-review]").forEach(function (button) { button.addEventListener("click", closeReview); });
    $("composerBackdrop").addEventListener("click", function (event) { if (event.target === event.currentTarget) closeComposer(); });
    $("reviewBackdrop").addEventListener("click", function (event) { if (event.target === event.currentTarget) closeReview(); });
    $("addReelRow").addEventListener("click", addBatchRow);
    $("batchItems").addEventListener("click", function (event) { var button = event.target.closest("[data-remove-row]"); if (!button) return; button.closest(".batchItem").remove(); numberBatchRows(); refreshBatchDates(); });
    $("batchStartDate").addEventListener("change", function () { refreshBatchDates(); applyTimingGuidance(); });
    $("batchPattern").addEventListener("change", refreshBatchDates);
    $("batchTime").addEventListener("change", function () { this.dataset.userEdited = "true"; refreshBatchDates(); });
    $("batchForm").addEventListener("submit", submitBatch);
    $("refreshQueue").addEventListener("click", loadRows);
    $("refreshHealth").addEventListener("click", loadHealth);
    $("searchInput").addEventListener("input", function (event) { state.query = clean(event.target.value); renderCards(); });
    document.querySelectorAll(".statusTab").forEach(function (button) { button.addEventListener("click", function () { state.activeStatus = button.dataset.status; syncTabs(); renderCards(); }); });
    $("reelsGrid").addEventListener("click", function (event) { var button = event.target.closest("[data-review-id]"); if (button) openReview(button.dataset.reviewId); });
    $("reviewContent").addEventListener("click", async function (event) {
      var action = event.target.closest("[data-action]");
      if (action) { await reviewAction(action.dataset.action); return; }
      var button = event.target.closest("[data-copy-field]");
      if (!button) return;
      var input = document.querySelector('[data-review-field="' + button.dataset.copyField + '"]');
      if (input) { await navigator.clipboard.writeText(input.value); button.textContent = "Copied"; window.setTimeout(function () { button.textContent = "Copy"; }, 900); }
    });
    $("reviewActions").addEventListener("click", async function (event) { var action = event.target.closest("[data-action]"); if (action) await reviewAction(action.dataset.action); var copy = event.target.closest("[data-copy-youtube]"); if (copy && state.selected) { await navigator.clipboard.writeText(youtubeUrl(state.selected)); copy.textContent = "Copied"; } });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") { if (!$("reviewBackdrop").hidden) closeReview(); else if (!$("composerBackdrop").hidden) closeComposer(); } });
  }

  function init() {
    var returnPath = clean(routeParams.get("return"));
    if (returnPath.indexOf("/media/") === 0) {
      $("backToMedia").href = returnPath;
      $("backToMedia").textContent = returnPath.includes("view=queue") ? "← Back to queue" : returnPath.includes("view=analytics") ? "← Back to analytics" : "← Back to calendar";
    }
    if (routeParams.get("new") === "1") window.setTimeout(openComposer, 0);
    setDefaultBatchSchedule(true);
    bindEvents(); addBatchRow(); loadRows(); loadHealth();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
