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

function cleanTimestamp(value) {
  const parsed = new Date(cleanString(value, 40) || "");
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
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

function cleanPageUrl(value, requestUrl) {
  const raw = cleanString(value, 2048);
  if (!raw) return null;

  try {
    const page = new URL(raw);
    if (page.host !== new URL(requestUrl).host) return null;
    return page.toString().slice(0, 2048);
  } catch {
    return null;
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

    const contactIntentId = cleanId(payload.contact_intent_id);
    const visitorId = cleanId(payload.visitor_id);
    const sessionId = cleanId(payload.session_id);

    if (!contactIntentId || !visitorId || !sessionId) {
      return reply(400, {
        ok: false,
        error: "valid_contact_intent_visitor_and_session_ids_required",
      });
    }

    const channels = new Set([
      "whatsapp",
      "email_link",
      "email_form",
      "phone",
      "other",
    ]);
    const channel = cleanString(payload.channel, 32);
    if (!channels.has(channel)) {
      return reply(400, { ok: false, error: "invalid_contact_channel" });
    }

    const statuses = new Set([
      "created",
      "opened",
      "submitted",
      "matched_to_crm",
      "abandoned",
    ]);
    const intentStatus = statuses.has(payload.intent_status)
      ? payload.intent_status
      : "created";

    const qualities = new Set([
      "verified",
      "partial",
      "unverified",
      "unavailable",
    ]);
    const attributionQuality = qualities.has(payload.attribution_quality)
      ? payload.attribution_quality
      : "unverified";

    const pageUrl = cleanPageUrl(payload.page_url, request.url);
    if (!pageUrl) {
      return reply(400, { ok: false, error: "valid_same_origin_page_url_required" });
    }

    const sessionOwner = await env.MBW_ATTRIBUTION_DB.prepare(`
      SELECT visitor_id
      FROM sessions
      WHERE session_id = ?
      LIMIT 1
    `).bind(sessionId).first();

    if (!sessionOwner) {
      return reply(409, { ok: false, error: "session_not_found" });
    }

    if (sessionOwner.visitor_id !== visitorId) {
      return reply(409, { ok: false, error: "visitor_session_mismatch" });
    }

    const occurredAt = cleanTimestamp(payload.occurred_at);
    const agentId = cleanString(payload.agent_id, 64);
    const destination = cleanString(payload.destination, 320);
    const messageKey = cleanString(payload.message_key, 128);
    const tourInterest = cleanString(payload.tour_interest, 320);
    const ctaLocation = cleanString(payload.cta_location, 128);
    const ctaLabel = cleanString(payload.cta_label, 320);
    const pageLanguage = cleanString(payload.page_language, 12);

    const intentStatement = env.MBW_ATTRIBUTION_DB.prepare(`
      INSERT INTO contact_intents (
        contact_intent_id,
        visitor_id,
        session_id,
        channel,
        agent_id,
        destination,
        message_key,
        tour_interest,
        page_url,
        cta_location,
        cta_label,
        page_language,
        intent_status,
        attribution_quality,
        occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(contact_intent_id) DO UPDATE SET
        agent_id = COALESCE(excluded.agent_id, contact_intents.agent_id),
        destination = COALESCE(excluded.destination, contact_intents.destination),
        message_key = COALESCE(excluded.message_key, contact_intents.message_key),
        tour_interest = COALESCE(excluded.tour_interest, contact_intents.tour_interest),
        cta_location = COALESCE(excluded.cta_location, contact_intents.cta_location),
        cta_label = COALESCE(excluded.cta_label, contact_intents.cta_label),
        intent_status = excluded.intent_status,
        attribution_quality = excluded.attribution_quality,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).bind(
      contactIntentId,
      visitorId,
      sessionId,
      channel,
      agentId,
      destination,
      messageKey,
      tourInterest,
      pageUrl,
      ctaLocation,
      ctaLabel,
      pageLanguage,
      intentStatus,
      attributionQuality,
      occurredAt,
    );

    const eventId = `evt_${contactIntentId}_created`.slice(0, 128);
    const eventStatement = env.MBW_ATTRIBUTION_DB.prepare(`
      INSERT OR IGNORE INTO attribution_events (
        event_id,
        visitor_id,
        session_id,
        contact_intent_id,
        event_name,
        event_source,
        page_url,
        event_data,
        occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      eventId,
      visitorId,
      sessionId,
      contactIntentId,
      "contact_intent_created",
      "website",
      pageUrl,
      JSON.stringify({
        channel,
        agent_id: agentId,
        cta_location: ctaLocation,
      }),
      occurredAt,
    );

    await env.MBW_ATTRIBUTION_DB.batch([
      intentStatement,
      eventStatement,
    ]);

    return reply(200, {
      ok: true,
      contact_intent_id: contactIntentId,
      visitor_id: visitorId,
      session_id: sessionId,
    });
  } catch (error) {
    console.error("Contact-intent write failed", error);
    return reply(500, { ok: false, error: "contact_intent_write_failed" });
  }
}

export async function onRequestGet() {
  return reply(405, { ok: false, error: "method_not_allowed" });
}

