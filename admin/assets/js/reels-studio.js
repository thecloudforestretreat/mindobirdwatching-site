(function () {
  "use strict";

  // Keep reads and writes on the Access-protected admin origin.
  var API = "/api/admin/reels";
  var state = { rows: [], activeStatus: "upcoming", query: "", selected: null, loading: false };
  var demoMode = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) && new URLSearchParams(window.location.search).get("demo") === "1";

  function $(id) { return document.getElementById(id); }
  function clean(value) { return String(value == null ? "" : value).trim(); }
  function esc(value) { return clean(value).replace(/[&<>'"]/g, function (char) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]; }); }
  function truthy(value) { return value === true || ["true", "1", "yes", "on"].includes(clean(value).toLowerCase()); }
  function has(value) { return clean(value) !== ""; }
  function field(row) { for (var i = 1; i < arguments.length; i += 1) if (has(row[arguments[i]])) return row[arguments[i]]; return ""; }
  function rowId(row) { return clean(field(row, "reel_id", "post_id", "row_number")); }
  function youtubeUrl(row) { var direct = clean(row.youtube_url); var id = clean(row.youtube_post_id); return direct || (id ? "https://www.youtube.com/watch?v=" + encodeURIComponent(id) : ""); }
  function scheduledValue(row) { return [clean(row.scheduled_date), clean(row.scheduled_time)].filter(Boolean).join(" · "); }
  function platformSelected(row, platform) {
    var key = platform === "youtube" ? "post_on_youtube" : platform === "tiktok" ? "post_on_tiktok" : "post_to_" + platform;
    return truthy(row[key]);
  }
  function platformId(row, platform) { return clean(row[platform + "_post_id"]); }
  function selectedPlatforms(row) { return ["instagram", "facebook", "youtube", "tiktok"].filter(function (platform) { return platformSelected(row, platform); }); }
  function failedPlatforms(row) {
    var value = clean(row.failed_platforms || row.publish_failed_platforms).toLowerCase();
    return ["instagram", "facebook", "youtube", "tiktok"].filter(function (platform) { return value.includes(platform); });
  }
  function bucket(row) {
    var status = clean(row.status).toLowerCase();
    var approval = clean(row.approval_status).toUpperCase();
    var selected = selectedPlatforms(row);
    var posted = selected.filter(function (platform) { return platformId(row, platform); });
    var failed = failedPlatforms(row);
    if (status === "published" || (selected.length && posted.length === selected.length)) return "published";
    if (["failed", "partial", "error", "recovery_required"].includes(status) || failed.length || (posted.length && posted.length < selected.length)) return "failed";
    if (["scheduled", "publishing", "ready"].includes(status) && approval === "APPROVED") return "upcoming";
    return "review";
  }
  function statusLabel(row) {
    var group = bucket(row);
    if (group === "published") return { label: "Published", tone: "live" };
    if (group === "failed") return { label: clean(row.status) || "Partial", tone: "error" };
    if (group === "upcoming") return { label: clean(row.status) || "Scheduled", tone: "scheduled" };
    return { label: clean(row.status) === "Draft" ? "Draft" : "Needs review", tone: "pending" };
  }
  function formatQuality(row) { var score = Number(row.quality_score); return Number.isFinite(score) && score > 0 ? "Quality " + score : "Not scored"; }

  function demoRows() {
    var common = { post_to_instagram: true, post_to_facebook: true, post_on_youtube: true, post_on_tiktok: true, location: "Mindo, Ecuador", media_type: "REELS" };
    return [
      Object.assign({}, common, { reel_id: "REEL-20261012-01", post_id: 18, video_url: "https://res.cloudinary.com/dd25hpdx3/video/upload/v1791332944/1080X1920_7_hgirtw.mp4", reel_description: "Hummingbirds join us for breakfast with a view over Mindo.", scheduled_date: "10/12/2026", scheduled_time: "7:00 AM", status: "Scheduled", approval_status: "APPROVED", quality_score: 100, instagram_caption_final: "Breakfast in Mindo sometimes comes with a few special guests. Hummingbirds moved through the garden while the morning view opened over the cloud forest. Join us for a guided birding experience in Mindo.\n\n#mindobirdwatching #mindo #ecuador #Hummingbirds #MindoBirding", instagram_hashtags: "#mindobirdwatching #mindo #ecuador #Hummingbirds #MindoBirding", tiktok_caption: "Breakfast views in Mindo came with hummingbirds this morning.", tiktok_hashtags: "#mindobirdwatching #mindo #ecuador", tiktok_additional_hashtags: "#Hummingbirds #CloudForest #BirdingTour #EcuadorWildlife #NatureTravel", youtube_title: "Hummingbirds at Breakfast in Mindo, Ecuador" }),
      Object.assign({}, common, { reel_id: "REEL-20261013-02", post_id: 19, video_url: "https://res.cloudinary.com/dd25hpdx3/video/upload/v1791243592/1080X1920_6_c8wb6a.mp4", reel_description: "Several hummingbirds encountered during a recent tour.", scheduled_date: "10/13/2026", scheduled_time: "7:00 AM", status: "Draft", approval_status: "NEEDS_REVIEW", quality_score: 70, error_message: "TikTok caption needs review before scheduling.", instagram_caption_final: "A recent birdwatching tour in Mindo brought several hummingbird encounters.", instagram_hashtags: "#mindobirdwatching #mindo #ecuador #Hummingbirds #BirdingTour", youtube_title: "Hummingbirds on a Birdwatching Tour in Mindo" }),
      Object.assign({}, common, { reel_id: "REEL-20261007-14", post_id: 14, video_url: "https://res.cloudinary.com/dd25hpdx3/video/upload/v1791332944/1080X1920_7_hgirtw.mp4", reel_description: "Most of the times these views come with special guests. Hummingbirds join us for breakfast.", scheduled_date: "10/7/2026", scheduled_time: "7:00 AM", status: "Published", approval_status: "APPROVED", quality_score: 100, instagram_post_id: "17900000000000014", facebook_post_id: "1067000000000014", youtube_post_id: "dQw4w9WgXcQ", youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", instagram_published_date: "10/7/2026 7:06 AM", facebook_published_date: "10/7/2026 7:05 AM", youtube_published_date: "10/7/2026 7:09 AM", instagram_caption_final: "Breakfast views in Mindo came with hummingbirds this morning.\n\n#mindobirdwatching #mindo #ecuador #Hummingbirds #MindoBirding", instagram_hashtags: "#mindobirdwatching #mindo #ecuador #Hummingbirds #MindoBirding", tiktok_caption: "Hummingbirds joined breakfast in Mindo.", tiktok_hashtags: "#mindobirdwatching #mindo #ecuador", tiktok_additional_hashtags: "#Hummingbirds #CloudForest #EcuadorWildlife", youtube_title: "Hummingbirds Join Breakfast in Mindo, Ecuador" }),
      Object.assign({}, common, { reel_id: "REEL-20261008-15", post_id: 15, video_url: "https://res.cloudinary.com/dd25hpdx3/video/upload/v1791159813/1080X1920_5_gsfyjj.mp4", reel_description: "Birdwatching highlights featuring toucans and barbets.", scheduled_date: "10/8/2026", scheduled_time: "7:00 AM", status: "Partial", approval_status: "APPROVED", quality_score: 100, instagram_post_id: "17900000000000015", facebook_post_id: "1067000000000015", failed_platforms: "youtube", error_message: "YouTube upload timed out. Instagram and Facebook were not retried." })
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

  async function loadRows() {
    if (state.loading) return;
    state.loading = true;
    setQueueStatus("Loading reels…", "");
    $("refreshQueue").disabled = true;
    try {
      var data = await request("list_reels");
      state.rows = Array.isArray(data.reels) ? data.reels : Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      render();
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
    var labels = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok" };
    return selectedPlatforms(row).map(function (platform) {
      var live = Boolean(platformId(row, platform));
      var broken = failed.includes(platform);
      return '<span class="platformPill' + (live ? " isLive" : broken ? " isError" : "") + '">' + esc(labels[platform]) + (live ? " ✓" : broken ? " !" : "") + "</span>";
    }).join("") || '<span class="platformPill isError">No destinations</span>';
  }
  function cardMarkup(row) {
    var info = statusLabel(row);
    var group = bucket(row);
    var id = rowId(row);
    var primaryAction = group === "review" ? "Review copy" : group === "failed" ? "Inspect & retry" : group === "published" ? "View details" : "Review schedule";
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

  function openComposer() { $("composerBackdrop").hidden = false; document.body.style.overflow = "hidden"; if (!$("batchItems").children.length) addBatchRow(); }
  function closeComposer() { $("composerBackdrop").hidden = true; document.body.style.overflow = ""; }
  function todayInMindo() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  function addDays(dateString, offset, weekdaysOnly) {
    var date = new Date(dateString + "T12:00:00Z");
    var remaining = offset;
    while (remaining > 0) { date.setUTCDate(date.getUTCDate() + 1); if (!weekdaysOnly || ![0,6].includes(date.getUTCDay())) remaining -= 1; }
    return date.toISOString().slice(0, 10);
  }
  function refreshBatchDates() {
    var start = $("batchStartDate").value || todayInMindo();
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
  async function submitBatch(event) {
    event.preventDefault();
    var payload = batchPayload();
    var duplicate = payload.reels.some(function (row, index) { return payload.reels.findIndex(function (candidate) { return candidate.video_url === row.video_url; }) !== index; });
    if (duplicate) { setBatchStatus("Each video URL in the batch must be unique.", "error"); return; }
    if (!Object.values(selectedDefaults()).some(Boolean)) { setBatchStatus("Select at least one destination.", "error"); return; }
    $("submitBatch").disabled = true; setBatchStatus("Sending " + payload.reels.length + " reel" + (payload.reels.length === 1 ? "" : "s") + " for generation…", "");
    try {
      var data = await request("create_batch", payload);
      setBatchStatus((data.count || payload.reels.length) + " reel drafts created successfully.", "success");
      window.setTimeout(function () { closeComposer(); $("batchItems").innerHTML = ""; addBatchRow(); state.activeStatus = payload.mode === "auto" ? "upcoming" : "review"; syncTabs(); loadRows(); }, 650);
    } catch (error) { setBatchStatus(error.message, "error"); }
    finally { $("submitBatch").disabled = false; }
  }

  function copyField(label, key, value, multiline) {
    var control = multiline ? '<textarea data-review-field="' + esc(key) + '">' + esc(value) + '</textarea>' : '<input data-review-field="' + esc(key) + '" value="' + esc(value) + '" />';
    return '<label class="copyField"><span class="copyFieldHeader"><strong>' + esc(label) + '</strong><button class="textButton" type="button" data-copy-field="' + esc(key) + '">Copy</button></span>' + control + "</label>";
  }
  function openReview(id) {
    var row = state.rows.find(function (candidate) { return rowId(candidate) === clean(id); });
    if (!row) return;
    state.selected = row;
    var youtube = youtubeUrl(row);
    var links = [row.instagram_url && ["Instagram", row.instagram_url], row.facebook_url && ["Facebook", row.facebook_url], youtube && ["Watch on YouTube", youtube], row.tiktok_url && ["TikTok", row.tiktok_url]].filter(Boolean);
    $("reviewTitle").textContent = clean(row.activity_name) || "Review reel " + rowId(row);
    $("reviewContent").innerHTML = '<video class="reviewVideo" src="' + esc(row.video_url) + '" preload="metadata" muted playsinline controls></video>' +
      '<section class="reviewMeta"><article><small>Status</small><strong>' + esc(statusLabel(row).label) + '</strong></article><article><small>Schedule</small><strong>' + esc(scheduledValue(row) || "Not scheduled") + '</strong></article><article><small>Quality</small><strong>' + esc(formatQuality(row)) + '</strong></article></section>' +
      (clean(row.error_message || row.supervision_notes) ? '<div class="warningBox">' + esc(row.error_message || row.supervision_notes) + "</div>" : "") +
      copyField("Original description", "reel_description", row.reel_description, true) +
      copyField("Instagram / Facebook caption", "instagram_caption_final", row.instagram_caption_final, true) +
      copyField("Instagram hashtags", "instagram_hashtags", row.instagram_hashtags, false) +
      copyField("TikTok caption", "tiktok_caption", row.tiktok_caption, true) +
      copyField("TikTok hashtags", "tiktok_hashtags", row.tiktok_hashtags, false) +
      copyField("Additional discovery hashtags", "tiktok_additional_hashtags", row.tiktok_additional_hashtags, false) +
      copyField("YouTube title", "youtube_title", row.youtube_title, false) +
      (links.length ? '<div class="copyLinkRow">' + links.map(function (entry) { return '<a class="externalLink" href="' + esc(entry[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(entry[0]) + " ↗</a>"; }).join("") + "</div>" : "");
    var group = bucket(row);
    $("reviewContent").querySelectorAll("[data-review-field]").forEach(function (control) { control.disabled = group === "published"; });
    $("reviewActions").innerHTML = (group === "published" ? "" : '<button class="button buttonGhost" type="button" data-action="save">Save edits</button>') +
      (group === "review" ? '<button class="button buttonGhost" type="button" data-action="regenerate">Regenerate</button><button class="button buttonPrimary" type="button" data-action="approve">Approve & schedule</button>' : "") +
      (group === "failed" ? '<button class="button buttonPrimary" type="button" data-action="retry">Retry missing platforms</button>' : "") +
      (youtube ? '<button class="button buttonGhost" type="button" data-copy-youtube>Copy YouTube URL</button>' : "");
    $("reviewBackdrop").hidden = false; document.body.style.overflow = "hidden";
  }
  function closeReview() { $("reviewBackdrop").hidden = true; document.body.style.overflow = ""; state.selected = null; }
  function reviewEdits() { var edits = {}; document.querySelectorAll("[data-review-field]").forEach(function (input) { edits[input.dataset.reviewField] = clean(input.value); }); return edits; }
  async function reviewAction(action) {
    if (!state.selected) return;
    var buttons = Array.from($("reviewActions").querySelectorAll("button")); buttons.forEach(function (button) { button.disabled = true; });
    try {
      var payload = { reel_id: rowId(state.selected), post_id: state.selected.post_id };
      if (action === "save") payload.edits = reviewEdits();
      await request(action === "save" ? "update_reel" : action + "_reel", payload);
      if (demoMode) {
        Object.assign(state.selected, payload.edits || {});
        if (action === "approve") { state.selected.status = "Scheduled"; state.selected.approval_status = "APPROVED"; state.selected.quality_score = Math.max(85, Number(state.selected.quality_score) || 100); }
        if (action === "retry") { state.selected.status = "Scheduled"; state.selected.failed_platforms = ""; state.selected.error_message = "Retry queued for missing platforms only."; }
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
    ["batchStartDate", "batchTime", "batchPattern"].forEach(function (id) { $(id).addEventListener("change", refreshBatchDates); });
    $("batchForm").addEventListener("submit", submitBatch);
    $("refreshQueue").addEventListener("click", loadRows);
    $("searchInput").addEventListener("input", function (event) { state.query = clean(event.target.value); renderCards(); });
    document.querySelectorAll(".statusTab").forEach(function (button) { button.addEventListener("click", function () { state.activeStatus = button.dataset.status; syncTabs(); renderCards(); }); });
    $("reelsGrid").addEventListener("click", function (event) { var button = event.target.closest("[data-review-id]"); if (button) openReview(button.dataset.reviewId); });
    $("reviewContent").addEventListener("click", async function (event) { var button = event.target.closest("[data-copy-field]"); if (!button) return; var input = document.querySelector('[data-review-field="' + button.dataset.copyField + '"]'); if (input) { await navigator.clipboard.writeText(input.value); button.textContent = "Copied"; window.setTimeout(function () { button.textContent = "Copy"; }, 900); } });
    $("reviewActions").addEventListener("click", async function (event) { var action = event.target.closest("[data-action]"); if (action) await reviewAction(action.dataset.action); var copy = event.target.closest("[data-copy-youtube]"); if (copy && state.selected) { await navigator.clipboard.writeText(youtubeUrl(state.selected)); copy.textContent = "Copied"; } });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") { if (!$("reviewBackdrop").hidden) closeReview(); else if (!$("composerBackdrop").hidden) closeComposer(); } });
  }

  function init() {
    $("batchStartDate").value = todayInMindo();
    bindEvents(); addBatchRow(); loadRows();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
