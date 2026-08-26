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
  return id && /^[A-Za-z0-9_-]{4,128}$/.test(id) ? id : null;
}

function secureEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (!a || !b || a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function requestSecret(request) {
  const authorization = request.headers.get("authorization") || "";
  if (/^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, "").trim();
  }
  return (request.headers.get("x-mbw-shared-secret") || "").trim();
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.MBW_ATTRIBUTION_DB) {
      return reply(503, { ok: false, error: "attribution_database_unavailable" });
    }

    if (!env.CF_SHARED_SECRET) {
      return reply(503, { ok: false, error: "shared_secret_unavailable" });
    }

    if (!secureEqual(requestSecret(request), env.CF_SHARED_SECRET)) {
      return reply(401, { ok: false, error: "unauthorized" });
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

    const inquiryId = cleanId(payload.inquiry_id);
    const guestId = cleanId(payload.guest_id);
    const contactIntentId = cleanId(payload.contact_intent_id);

    if (!inquiryId || !contactIntentId) {
      return reply(400, {
        ok: false,
        error: "valid_inquiry_and_contact_intent_ids_required",
      });
    }

    const channels = new Set([
      "whatsapp",
      "email_link",
      "email_form",
      "direct_email",
      "phone",
      "other",
    ]);
    const requestedChannel = cleanString(payload.contact_channel, 32);

    const contactIntent = await env.MBW_ATTRIBUTION_DB.prepare(`
      SELECT contact_intent_id, visitor_id, session_id, channel, attribution_quality
      FROM contact_intents
      WHERE contact_intent_id = ?
      LIMIT 1
    `).bind(contactIntentId).first();

    if (!contactIntent) {
      return reply(409, { ok: false, error: "contact_intent_not_found" });
    }

    const contactChannel = channels.has(requestedChannel)
      ? requestedChannel
      : (channels.has(contactIntent.channel) ? contactIntent.channel : "other");

    const qualities = new Set([
      "verified",
      "partial",
      "unverified",
      "unavailable",
    ]);
    const requestedQuality = cleanString(payload.attribution_quality, 32);
    const attributionQuality = qualities.has(requestedQuality)
      ? requestedQuality
      : (qualities.has(contactIntent.attribution_quality)
        ? contactIntent.attribution_quality
        : "unverified");

    const crmContactId = `crm_${inquiryId}`.slice(0, 128);
    const now = new Date().toISOString();

    const crmStatement = env.MBW_ATTRIBUTION_DB.prepare(`
      INSERT INTO crm_contacts (
        crm_contact_id,
        contact_intent_id,
        visitor_id,
        session_id,
        inquiry_id,
        guest_id,
        contact_channel,
        match_status,
        attribution_quality,
        matched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'matched', ?, ?)
      ON CONFLICT(inquiry_id) DO UPDATE SET
        contact_intent_id = excluded.contact_intent_id,
        visitor_id = excluded.visitor_id,
        session_id = excluded.session_id,
        guest_id = COALESCE(excluded.guest_id, crm_contacts.guest_id),
        contact_channel = excluded.contact_channel,
        match_status = 'matched',
        attribution_quality = excluded.attribution_quality,
        matched_at = excluded.matched_at,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).bind(
      crmContactId,
      contactIntentId,
      contactIntent.visitor_id,
      contactIntent.session_id,
      inquiryId,
      guestId,
      contactChannel,
      attributionQuality,
      now,
    );

    const intentStatement = env.MBW_ATTRIBUTION_DB.prepare(`
      UPDATE contact_intents
      SET
        intent_status = 'matched_to_crm',
        attribution_quality = ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE contact_intent_id = ?
    `).bind(attributionQuality, contactIntentId);

    const eventId = `evt_${crmContactId}_matched`.slice(0, 128);
    const eventStatement = env.MBW_ATTRIBUTION_DB.prepare(`
      INSERT OR IGNORE INTO attribution_events (
        event_id,
        visitor_id,
        session_id,
        contact_intent_id,
        crm_contact_id,
        event_name,
        event_source,
        event_data,
        occurred_at
      ) VALUES (?, ?, ?, ?, ?, 'crm_contact_matched', 'google_sheets_crm', ?, ?)
    `).bind(
      eventId,
      contactIntent.visitor_id,
      contactIntent.session_id,
      contactIntentId,
      crmContactId,
      JSON.stringify({
        inquiry_id: inquiryId,
        guest_id: guestId,
        contact_channel: contactChannel,
      }),
      now,
    );

    await env.MBW_ATTRIBUTION_DB.batch([
      crmStatement,
      intentStatement,
      eventStatement,
    ]);

    return reply(200, {
      ok: true,
      crm_contact_id: crmContactId,
      contact_intent_id: contactIntentId,
      inquiry_id: inquiryId,
      guest_id: guestId,
      match_status: "matched",
    });
  } catch (error) {
    console.error("CRM-contact attribution write failed", error);
    return reply(500, { ok: false, error: "crm_contact_write_failed" });
  }
}

export async function onRequestGet() {
  return reply(405, { ok: false, error: "method_not_allowed" });
}
