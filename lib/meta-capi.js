const META_EVENTS = new Set(["Lead", "Schedule", "Purchase"]);

function text(value, maxLength = 512) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLength);
}

function validEventId(value) {
  const id = text(value, 128);
  return /^[A-Za-z0-9_.:-]{4,128}$/.test(id) ? id : "";
}

function validUrl(value) {
  try {
    const url = new URL(text(value, 2048));
    return /^https:$/.test(url.protocol) && /(^|\.)mindobirdwatching\.com$/i.test(url.hostname)
      ? url.toString().slice(0, 2048)
      : "";
  } catch {
    return "";
  }
}

function normalizeEmail(value) {
  const email = text(value, 320).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizePhone(value) {
  const phone = text(value, 64).replace(/\D/g, "");
  return phone.length >= 7 && phone.length <= 15 ? phone : "";
}

async function sha256(value) {
  if (!value) return "";
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function metaClickCookie(fbc, fbclid, eventTime) {
  const supplied = text(fbc, 512);
  if (/^fb\.1\.\d{10,16}\..+$/i.test(supplied)) return supplied;
  const clickId = text(fbclid, 512);
  if (!clickId) return "";
  return `fb.1.${Number(eventTime) * 1000}.${clickId}`;
}

function browserCookie(value) {
  const supplied = text(value, 512);
  return /^fb\.1\.\d{10,16}\..+$/i.test(supplied) ? supplied : "";
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

export async function sendMetaConversion({ env, request, event, fetchImpl = fetch }) {
  const eventName = text(event && event.name, 32);
  const eventId = validEventId(event && event.id);
  if (!META_EVENTS.has(eventName) || !eventId) return { ok: false, skipped: true, reason: "invalid_event" };
  if (text(event && event.consent_status, 16) !== "accepted") return { ok: false, skipped: true, reason: "consent_not_accepted" };

  const accessToken = text(env && env.META_CAPI_ACCESS_TOKEN, 4096);
  const pixelId = text((env && env.META_PIXEL_ID) || "1403765671468161", 32);
  if (!accessToken || !/^\d+$/.test(pixelId)) return { ok: false, skipped: true, reason: "meta_capi_not_configured" };

  const now = Math.floor(Date.now() / 1000);
  const requestedTime = Number(event && event.event_time);
  const eventTime = Number.isFinite(requestedTime) && requestedTime > now - 7 * 86400 && requestedTime <= now + 300 ? Math.floor(requestedTime) : now;
  const email = normalizeEmail(event && event.email);
  const phone = normalizePhone(event && event.phone);
  const externalId = text(event && event.external_id, 128).toLowerCase();
  const userData = {};
  const [hashedEmail, hashedPhone, hashedExternalId] = await Promise.all([sha256(email), sha256(phone), sha256(externalId)]);
  if (hashedEmail) userData.em = [hashedEmail];
  if (hashedPhone) userData.ph = [hashedPhone];
  if (hashedExternalId) userData.external_id = [hashedExternalId];
  const fbc = metaClickCookie(event && event.fbc, event && event.fbclid, eventTime);
  const fbp = browserCookie(event && event.fbp);
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;
  const clientIp = text((event && event.client_ip_address) || (request && request.headers && request.headers.get("CF-Connecting-IP")), 64);
  const clientUserAgent = text((event && event.client_user_agent) || (request && request.headers && request.headers.get("user-agent")), 1024);
  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;
  if (!Object.keys(userData).length) return { ok: false, skipped: true, reason: "matching_data_unavailable" };

  const sourceUrl = validUrl(event && event.source_url);
  const customData = {};
  const value = numericValue(event && event.value);
  const currency = text((event && event.currency) || "USD", 3).toUpperCase();
  if (eventName === "Purchase" && value !== null) {
    customData.value = value;
    customData.currency = /^[A-Z]{3}$/.test(currency) ? currency : "USD";
  }
  const contentName = text(event && event.content_name, 128);
  if (contentName) customData.content_name = contentName;
  const orderId = text(event && event.order_id, 128);
  if (orderId) customData.order_id = orderId;

  const serverEvent = { event_name: eventName, event_time: eventTime, event_id: eventId, action_source: "website", user_data: userData };
  if (sourceUrl) serverEvent.event_source_url = sourceUrl;
  if (Object.keys(customData).length) serverEvent.custom_data = customData;
  const body = { data: [serverEvent] };
  const testCode = text(env && env.META_CAPI_TEST_EVENT_CODE, 64);
  if (testCode) body.test_event_code = testCode;
  const version = /^v\d+\.\d+$/.test(text(env && env.META_GRAPH_API_VERSION, 16)) ? text(env.META_GRAPH_API_VERSION, 16) : "v25.0";
  const endpoint = `https://graph.facebook.com/${version}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

  try {
    const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    let result = null;
    try { result = await response.json(); } catch {}
    if (!response.ok || (result && result.error)) {
      return { ok: false, skipped: false, reason: "meta_api_rejected", status: response.status, error_code: result && result.error ? result.error.code : null };
    }
    return { ok: true, skipped: false, event_name: eventName, event_id: eventId, events_received: Number(result && result.events_received) || 0, trace_id: text(result && result.fbtrace_id, 128) || null, test_event: Boolean(testCode) };
  } catch {
    return { ok: false, skipped: false, reason: "meta_api_unreachable" };
  }
}

export const __test = { normalizeEmail, normalizePhone, metaClickCookie, browserCookie, validEventId, validUrl };
