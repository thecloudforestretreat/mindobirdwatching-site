const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function cleanString(value, maxLength = 255) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function cleanId(value) {
  const id = cleanString(value, 128);
  return id && /^[A-Za-z0-9_-]{12,128}$/.test(id) ? id : null;
}

function cleanTimestamp(value, fallback) {
  const raw = cleanString(value, 40);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function cleanTouch(value) {
  const touch = value && typeof value === "object" ? value : {};
  return {
    source: cleanString(touch.source),
    medium: cleanString(touch.medium),
    campaign: cleanString(touch.campaign),
    content: cleanString(touch.content),
    term: cleanString(touch.term),
    landing_page: cleanString(touch.landing_page, 2048),
    referrer: cleanString(touch.referrer, 2048),
    date: cleanTimestamp(touch.date, null),
  };
}

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.MBW_ATTRIBUTION_DB) {
      return reply(503, { ok: false, error: "attribution_database_unavailable" });
    }

    if (!isSameOrigin(request)) {
      return reply(403, { ok: false, error: "origin_not_allowed" });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return reply(415, { ok: false, error: "application_json_required" });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16384) {
      return reply(413, { ok: false, error: "payload_too_large" });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return reply(400, { ok: false, error: "invalid_json" });
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return reply(400, { ok: false, error: "invalid_payload" });
    }

    const visitor = payload.visitor && typeof payload.visitor === "object"
      ? payload.visitor
      : {};
    const session = payload.session && typeof payload.session === "object"
      ? payload.session
      : {};

    const visitorId = cleanId(visitor.visitor_id || visitor.id);
    const sessionId = cleanId(session.session_id || session.id);

    if (!visitorId || !sessionId) {
      return reply(400, { ok: false, error: "valid_visitor_and_session_ids_required" });
    }

    const now = new Date().toISOString();
    const firstSeenAt = cleanTimestamp(visitor.first_seen_at, now);
    const lastSeenAt = cleanTimestamp(visitor.last_seen_at, now);
    const sessionStartedAt = cleanTimestamp(session.session_started_at || session.started_at, now);
    const lastActivityAt = cleanTimestamp(session.last_activity_at, now);

    const allowedConsent = new Set(["unknown", "accepted", "rejected"]);
    const consentStatus = allowedConsent.has(visitor.consent_status)
      ? visitor.consent_status
      : "unknown";

    const allowedStatuses = new Set([
      "captured",
      "partial",
      "direct",
      "unavailable",
      "invalid",
    ]);
    const attributionStatus = allowedStatuses.has(session.attribution_status)
      ? session.attribution_status
      : "captured";

    const first = cleanTouch(session.first_touch);
    const last = cleanTouch(session.last_touch);
    const utm = session.utm && typeof session.utm === "object" ? session.utm : {};
    const clickIds = session.click_ids && typeof session.click_ids === "object"
      ? session.click_ids
      : {};

    const visitorStatement = env.MBW_ATTRIBUTION_DB.prepare(`
      INSERT INTO visitors (
        visitor_id,
        first_seen_at,
        last_seen_at,
        consent_status
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(visitor_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        consent_status = CASE
          WHEN excluded.consent_status = 'unknown' THEN visitors.consent_status
          ELSE excluded.consent_status
        END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).bind(visitorId, firstSeenAt, lastSeenAt, consentStatus);

    const sessionStatement = env.MBW_ATTRIBUTION_DB.prepare(`
      INSERT INTO sessions (
        session_id,
        visitor_id,
        session_started_at,
        last_activity_at,
        first_touch_source,
        first_touch_medium,
        first_touch_campaign,
        first_touch_content,
        first_touch_term,
        first_touch_landing_page,
        first_touch_referrer,
        first_touch_date,
        last_touch_source,
        last_touch_medium,
        last_touch_campaign,
        last_touch_content,
        last_touch_term,
        last_touch_landing_page,
        last_touch_referrer,
        last_touch_date,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        gclid,
        gbraid,
        wbraid,
        fbclid,
        attribution_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(session_id) DO UPDATE SET
        last_activity_at = excluded.last_activity_at,
        first_touch_source = COALESCE(sessions.first_touch_source, excluded.first_touch_source),
        first_touch_medium = COALESCE(sessions.first_touch_medium, excluded.first_touch_medium),
        first_touch_campaign = COALESCE(sessions.first_touch_campaign, excluded.first_touch_campaign),
        first_touch_content = COALESCE(sessions.first_touch_content, excluded.first_touch_content),
        first_touch_term = COALESCE(sessions.first_touch_term, excluded.first_touch_term),
        first_touch_landing_page = COALESCE(sessions.first_touch_landing_page, excluded.first_touch_landing_page),
        first_touch_referrer = COALESCE(sessions.first_touch_referrer, excluded.first_touch_referrer),
        first_touch_date = COALESCE(sessions.first_touch_date, excluded.first_touch_date),
        last_touch_source = excluded.last_touch_source,
        last_touch_medium = excluded.last_touch_medium,
        last_touch_campaign = excluded.last_touch_campaign,
        last_touch_content = excluded.last_touch_content,
        last_touch_term = excluded.last_touch_term,
        last_touch_landing_page = excluded.last_touch_landing_page,
        last_touch_referrer = excluded.last_touch_referrer,
        last_touch_date = excluded.last_touch_date,
        utm_source = excluded.utm_source,
        utm_medium = excluded.utm_medium,
        utm_campaign = excluded.utm_campaign,
        utm_content = excluded.utm_content,
        utm_term = excluded.utm_term,
        gclid = COALESCE(excluded.gclid, sessions.gclid),
        gbraid = COALESCE(excluded.gbraid, sessions.gbraid),
        wbraid = COALESCE(excluded.wbraid, sessions.wbraid),
        fbclid = COALESCE(excluded.fbclid, sessions.fbclid),
        attribution_status = excluded.attribution_status,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).bind(
      sessionId,
      visitorId,
      sessionStartedAt,
      lastActivityAt,
      first.source,
      first.medium,
      first.campaign,
      first.content,
      first.term,
      first.landing_page,
      first.referrer,
      first.date,
      last.source,
      last.medium,
      last.campaign,
      last.content,
      last.term,
      last.landing_page,
      last.referrer,
      last.date,
      cleanString(utm.source),
      cleanString(utm.medium),
      cleanString(utm.campaign),
      cleanString(utm.content),
      cleanString(utm.term),
      cleanString(clickIds.gclid, 512),
      cleanString(clickIds.gbraid, 512),
      cleanString(clickIds.wbraid, 512),
      cleanString(clickIds.fbclid, 512),
      attributionStatus,
    );

    const eventId = `evt_${sessionId}_start`.slice(0, 128);
    const eventStatement = env.MBW_ATTRIBUTION_DB.prepare(`
      INSERT OR IGNORE INTO attribution_events (
        event_id,
        visitor_id,
        session_id,
        event_name,
        event_source,
        page_url,
        event_data,
        occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventId,
      visitorId,
      sessionId,
      "session_started",
      "website",
      first.landing_page || last.landing_page,
      JSON.stringify({
        source: first.source,
        medium: first.medium,
        campaign: first.campaign,
      }),
      sessionStartedAt,
    );

    await env.MBW_ATTRIBUTION_DB.batch([
      visitorStatement,
      sessionStatement,
      eventStatement,
    ]);

    return reply(200, {
      ok: true,
      visitor_id: visitorId,
      session_id: sessionId,
    });
  } catch (error) {
    console.error("Attribution session write failed", error);
    return reply(500, { ok: false, error: "attribution_write_failed" });
  }
}

export async function onRequestGet() {
  return reply(405, { ok: false, error: "method_not_allowed" });
}

