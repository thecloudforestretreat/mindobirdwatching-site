const ADMIN_ORIGIN = "https://admin.mindobirdwatching.com";
const ALLOWED_ACTIONS = new Set(["create_batch", "update_reel", "approve_reel", "regenerate_reel", "retry_reel"]);
const ALLOWED_MODES = new Set(["review", "auto"]);
const ALLOWED_TIMEZONES = new Set(["America/Guayaquil", "America/New_York"]);
const ALLOWED_VIDEO_HOSTS = new Set(["res.cloudinary.com"]);
const EDITABLE_FIELDS = new Set([
  "reel_description",
  "instagram_caption_final",
  "instagram_hashtags",
  "tiktok_caption",
  "tiktok_hashtags",
  "tiktok_additional_hashtags",
  "youtube_title",
  "scheduled_date",
  "scheduled_time",
  "timezone"
]);

function headers(request) {
  const origin = request.headers.get("origin") || "";
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": origin === ADMIN_ORIGIN ? origin : ADMIN_ORIGIN,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin"
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(request) });
}

function clean(value, length = 200) {
  return String(value == null ? "" : value).trim().slice(0, length);
}

function boolean(value) {
  return value === true || ["true", "1", "yes", "on"].includes(clean(value, 10).toLowerCase());
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T12:00:00Z"));
}

function validTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validVideoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_VIDEO_HOSTS.has(url.hostname) && /\.(?:mp4|mov|m4v)(?:$|[?#])/i.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

function identifier(input) {
  const reelId = clean(input.reel_id, 100);
  const postId = clean(input.post_id, 40);
  if (!reelId && !postId) return null;
  if (reelId && !/^[A-Za-z0-9_-]{3,100}$/.test(reelId)) return null;
  if (postId && !/^\d{1,20}$/.test(postId)) return null;
  return { reel_id: reelId, post_id: postId };
}

function normalizeReel(input, timezone) {
  const videoUrl = clean(input.video_url, 1000);
  const description = clean(input.reel_description, 1200);
  const scheduledDate = clean(input.scheduled_date, 10);
  const scheduledTime = clean(input.scheduled_time, 5);
  const reelTimezone = ALLOWED_TIMEZONES.has(input.timezone) ? input.timezone : timezone;
  if (!validVideoUrl(videoUrl)) throw new Error("Each reel needs a Cloudinary HTTPS video URL ending in MP4, MOV, or M4V.");
  if (description.length < 8) throw new Error("Each reel needs a factual description of at least 8 characters.");
  if (!validDate(scheduledDate) || !validTime(scheduledTime)) throw new Error("Each reel needs a valid scheduled date and time.");
  return {
    reel_id: "reel_" + crypto.randomUUID(),
    submitted_at: new Date().toISOString(),
    source: "admin_reels_studio",
    video_url: videoUrl,
    reel_description: description,
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    timezone: reelTimezone,
    location: clean(input.location, 120) || "Mindo, Ecuador",
    media_type: "REELS",
    input_status: "READY",
    post_to_instagram: boolean(input.post_to_instagram),
    post_to_facebook: boolean(input.post_to_facebook),
    post_on_youtube: boolean(input.post_on_youtube),
    post_on_tiktok: boolean(input.post_on_tiktok)
  };
}

async function callWorkflow(request, env, payload) {
  const webhook = env.N8N_ADMIN_REELS_WEBHOOK_URL;
  if (!webhook) return { response: null, error: json(request, { ok: false, message: "N8N_ADMIN_REELS_WEBHOOK_URL is not configured." }, 503) };
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json", "x-mbw-request-id": payload.request_id || crypto.randomUUID() },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });
    const text = await response.text();
    if (!response.ok) throw new Error("Reels workflow returned " + response.status + ": " + text.slice(0, 240));
    let data;
    try { data = JSON.parse(text || "{}"); } catch { throw new Error("Reels workflow returned invalid JSON."); }
    return { response: data, error: null };
  } catch (error) {
    console.error("Admin Reels workflow failed", { action: payload.action, requestId: payload.request_id, message: error?.message });
    return { response: null, error: json(request, { ok: false, message: "The Reels workflow is temporarily unavailable." }, 502) };
  }
}

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(250, Math.max(1, Number(params.get("limit")) || 150));
  const requestId = "reels_list_" + crypto.randomUUID();
  const result = await callWorkflow(request, env, {
    action: "list_reels",
    request_id: requestId,
    status: clean(params.get("status"), 30),
    query: clean(params.get("query"), 160),
    from: clean(params.get("from"), 10),
    to: clean(params.get("to"), 10),
    limit
  });
  if (result.error) return result.error;
  const body = result.response;
  const reels = Array.isArray(body) ? body : Array.isArray(body.reels) ? body.reels : Array.isArray(body.data) ? body.data : [];
  return json(request, { ok: true, count: reels.slice(0, limit).length, reels: reels.slice(0, limit), request_id: requestId });
}

export async function onRequestPost({ request, env }) {
  let input;
  try { input = await request.json(); } catch { return json(request, { ok: false, message: "Invalid JSON body." }, 400); }
  const action = clean(input.action, 40);
  if (!ALLOWED_ACTIONS.has(action)) return json(request, { ok: false, message: "Unsupported Reels action." }, 400);
  const requestId = "reels_" + crypto.randomUUID();
  let payload;

  if (action === "create_batch") {
    if (!Array.isArray(input.reels) || input.reels.length < 1 || input.reels.length > 20) return json(request, { ok: false, message: "Submit between 1 and 20 reels per batch." }, 400);
    const mode = ALLOWED_MODES.has(input.mode) ? input.mode : "review";
    const timezone = ALLOWED_TIMEZONES.has(input.timezone) ? input.timezone : "America/Guayaquil";
    let reels;
    try { reels = input.reels.map((row) => normalizeReel(row, timezone)); }
    catch (error) { return json(request, { ok: false, message: error.message }, 400); }
    if (new Set(reels.map((row) => row.video_url)).size !== reels.length) return json(request, { ok: false, message: "Video URLs must be unique within a batch." }, 400);
    if (reels.some((row) => !row.post_to_instagram && !row.post_to_facebook && !row.post_on_youtube && !row.post_on_tiktok)) return json(request, { ok: false, message: "Each reel needs at least one destination." }, 400);
    payload = { action, request_id: requestId, mode, timezone, reels };
  } else {
    const id = identifier(input);
    if (!id) return json(request, { ok: false, message: "A valid reel_id or post_id is required." }, 400);
    payload = { action, request_id: requestId, ...id };
    if (action === "update_reel") {
      const source = input.edits && typeof input.edits === "object" ? input.edits : {};
      const edits = {};
      for (const [key, value] of Object.entries(source)) {
        if (!EDITABLE_FIELDS.has(key)) continue;
        edits[key] = clean(value, key.includes("caption") || key.includes("description") ? 5000 : 1000);
      }
      if (!Object.keys(edits).length) return json(request, { ok: false, message: "No editable fields were supplied." }, 400);
      if (edits.scheduled_date && !validDate(edits.scheduled_date)) return json(request, { ok: false, message: "Invalid scheduled date." }, 400);
      if (edits.scheduled_time && !validTime(edits.scheduled_time)) return json(request, { ok: false, message: "Invalid scheduled time." }, 400);
      if (edits.timezone && !ALLOWED_TIMEZONES.has(edits.timezone)) return json(request, { ok: false, message: "Unsupported time zone." }, 400);
      payload.edits = edits;
    }
  }

  const result = await callWorkflow(request, env, payload);
  if (result.error) return result.error;
  return json(request, { ok: true, request_id: requestId, ...(result.response && typeof result.response === "object" ? result.response : {}) });
}

export async function onRequestOptions({ request }) {
  const values = headers(request);
  delete values["content-type"];
  return new Response(null, { status: 204, headers: values });
}
