const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

const ALERT_THRESHOLD = 3;
const ALERT_WINDOW_MINUTES = 15;
const ALERT_COOLDOWN_MINUTES = 60;
const TRACKING_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "meta_campaign_id",
  "meta_adset_id",
  "meta_ad_id",
]);

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
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

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const source = origin || referer;
  if (!source) return false;
  try {
    return new URL(source).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function safePageUrl(value, requestUrl) {
  try {
    const requestOrigin = new URL(requestUrl).origin;
    const page = new URL(cleanString(value, 2048) || "", requestOrigin);
    if (page.origin !== requestOrigin) return null;
    const safe = new URL(page.pathname, requestOrigin);
    page.searchParams.forEach((item, key) => {
      if (TRACKING_KEYS.has(key)) safe.searchParams.set(key, item.slice(0, 512));
    });
    return safe.toString().slice(0, 2048);
  } catch {
    return null;
  }
}

function deviceClass(userAgent) {
  const value = String(userAgent || "").toLowerCase();
  if (/ipad|tablet/.test(value)) return "tablet";
  if (/mobile|android|iphone/.test(value)) return "mobile";
  return "desktop";
}

function validWebhook(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function ensureTables(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS attribution_client_failures (
        failure_id TEXT PRIMARY KEY,
        error_type TEXT NOT NULL,
        page_url TEXT,
        cta_location TEXT,
        cta_label TEXT,
        message_key TEXT,
        device_class TEXT,
        occurred_at TEXT NOT NULL,
        notified_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_attribution_client_failures_occurred
      ON attribution_client_failures (occurred_at)
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS attribution_failure_alerts (
        alert_bucket TEXT PRIMARY KEY,
        failure_count INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        delivered_at TEXT
      )
    `),
  ]);
}

async function deliverAlert(env, db, alertBucket, details) {
  const webhook = validWebhook(env.MBW_ATTRIBUTION_ALERT_WEBHOOK_URL);
  if (!webhook) return;

  const headers = { "content-type": "application/json" };
  if (env.MBW_ATTRIBUTION_ALERT_WEBHOOK_SECRET) {
    headers["x-mbw-alert-secret"] = env.MBW_ATTRIBUTION_ALERT_WEBHOOK_SECRET;
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type: "mbw_attribution_failure_alert",
        severity: "warning",
        title: "Mindo Bird Watching attribution failures detected",
        message: `${details.failure_count} WhatsApp attribution failures occurred within ${ALERT_WINDOW_MINUTES} minutes. Guests were sent to WhatsApp using the fail-open fallback.`,
        failure_count: details.failure_count,
        threshold: ALERT_THRESHOLD,
        window_minutes: ALERT_WINDOW_MINUTES,
        cooldown_minutes: ALERT_COOLDOWN_MINUTES,
        latest_error_type: details.error_type,
        latest_page_url: details.page_url,
        latest_cta_location: details.cta_location,
        occurred_at: details.occurred_at,
        dashboard_url: "https://admin.mindobirdwatching.com/marketing/",
      }),
    });

    if (!response.ok) throw new Error(`alert_webhook_status_${response.status}`);

    await db.batch([
      db.prepare(`
        UPDATE attribution_failure_alerts
        SET delivered_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE alert_bucket = ?
      `).bind(alertBucket),
      db.prepare(`
        UPDATE attribution_client_failures
        SET notified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE failure_id = ?
      `).bind(details.failure_id),
    ]);
  } catch (error) {
    console.error("Attribution failure alert delivery failed", error);
    await db.prepare(`
      DELETE FROM attribution_failure_alerts
      WHERE alert_bucket = ? AND delivered_at IS NULL
    `).bind(alertBucket).run();
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    if (!env.MBW_ATTRIBUTION_DB) {
      return reply(503, { ok: false, error: "attribution_database_unavailable" });
    }
    if (!sameOrigin(request)) {
      return reply(403, { ok: false, error: "origin_not_allowed" });
    }
    if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
      return reply(415, { ok: false, error: "application_json_required" });
    }
    if (Number(request.headers.get("content-length") || 0) > 8192) {
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

    const failureId = cleanId(payload.failure_id);
    const allowedTypes = new Set([
      "timeout",
      "script_load_failure",
      "initialization_failure",
      "reference_generation_failure",
      "attribution_unavailable",
    ]);
    const errorType = cleanString(payload.error_type, 64);
    const pageUrl = safePageUrl(payload.page_url, request.url);
    if (!failureId || !allowedTypes.has(errorType) || !pageUrl) {
      return reply(400, { ok: false, error: "invalid_failure_record" });
    }

    const details = {
      failure_id: failureId,
      error_type: errorType,
      page_url: pageUrl,
      cta_location: cleanString(payload.cta_location, 128),
      cta_label: cleanString(payload.cta_label, 320),
      message_key: cleanString(payload.message_key, 128),
      device_class: deviceClass(request.headers.get("user-agent")),
      occurred_at: new Date().toISOString(),
    };

    await ensureTables(env.MBW_ATTRIBUTION_DB);
    await env.MBW_ATTRIBUTION_DB.prepare(`
      INSERT OR IGNORE INTO attribution_client_failures (
        failure_id, error_type, page_url, cta_location, cta_label,
        message_key, device_class, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      details.failure_id,
      details.error_type,
      details.page_url,
      details.cta_location,
      details.cta_label,
      details.message_key,
      details.device_class,
      details.occurred_at,
    ).run();

    const recent = await env.MBW_ATTRIBUTION_DB.prepare(`
      SELECT COUNT(*) AS failure_count
      FROM attribution_client_failures
      WHERE datetime(occurred_at) >= datetime('now', '-' || ? || ' minutes')
    `).bind(ALERT_WINDOW_MINUTES).first();
    const failureCount = Number(recent && recent.failure_count || 0);
    const webhookConfigured = Boolean(validWebhook(env.MBW_ATTRIBUTION_ALERT_WEBHOOK_URL));
    let alertQueued = false;

    if (failureCount >= ALERT_THRESHOLD && webhookConfigured) {
      const cooldownBucket = String(Math.floor(Date.now() / (ALERT_COOLDOWN_MINUTES * 60 * 1000)));
      const claim = await env.MBW_ATTRIBUTION_DB.prepare(`
        INSERT OR IGNORE INTO attribution_failure_alerts (alert_bucket, failure_count)
        VALUES (?, ?)
      `).bind(cooldownBucket, failureCount).run();

      if (claim.meta && claim.meta.changes === 1) {
        alertQueued = true;
        const delivery = deliverAlert(env, env.MBW_ATTRIBUTION_DB, cooldownBucket, {
          ...details,
          failure_count: failureCount,
        });
        if (typeof context.waitUntil === "function") context.waitUntil(delivery);
        else await delivery;
      }
    }

    return reply(202, {
      ok: true,
      fail_open: true,
      failure_count_window: failureCount,
      alert_threshold: ALERT_THRESHOLD,
      alert_queued: alertQueued,
      notification_configured: webhookConfigured,
    });
  } catch (error) {
    console.error("Attribution client failure write failed", error);
    return reply(500, { ok: false, error: "failure_record_write_failed" });
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    if (url.hostname !== "admin.mindobirdwatching.com") {
      return reply(404, { ok: false, error: "not_found" });
    }
    if (!env.MBW_ATTRIBUTION_DB) {
      return reply(503, { ok: false, error: "attribution_database_unavailable" });
    }

    await ensureTables(env.MBW_ATTRIBUTION_DB);
    const [recent, daily, latest, latestAlert] = await Promise.all([
      env.MBW_ATTRIBUTION_DB.prepare(`
        SELECT COUNT(*) AS count
        FROM attribution_client_failures
        WHERE datetime(occurred_at) >= datetime('now', '-' || ? || ' minutes')
      `).bind(ALERT_WINDOW_MINUTES).first(),
      env.MBW_ATTRIBUTION_DB.prepare(`
        SELECT COUNT(*) AS count
        FROM attribution_client_failures
        WHERE datetime(occurred_at) >= datetime('now', '-24 hours')
      `).first(),
      env.MBW_ATTRIBUTION_DB.prepare(`
        SELECT error_type, page_url, cta_location, device_class, occurred_at, notified_at
        FROM attribution_client_failures
        ORDER BY datetime(occurred_at) DESC
        LIMIT 1
      `).first(),
      env.MBW_ATTRIBUTION_DB.prepare(`
        SELECT failure_count, created_at, delivered_at
        FROM attribution_failure_alerts
        ORDER BY datetime(created_at) DESC
        LIMIT 1
      `).first(),
    ]);

    return reply(200, {
      ok: true,
      fail_open_enabled: true,
      notification_configured: Boolean(validWebhook(env.MBW_ATTRIBUTION_ALERT_WEBHOOK_URL)),
      alert_threshold: ALERT_THRESHOLD,
      alert_window_minutes: ALERT_WINDOW_MINUTES,
      alert_cooldown_minutes: ALERT_COOLDOWN_MINUTES,
      failures_last_15_minutes: Number(recent && recent.count || 0),
      failures_last_24_hours: Number(daily && daily.count || 0),
      latest_failure: latest || null,
      latest_alert: latestAlert || null,
    });
  } catch (error) {
    console.error("Attribution failure health read failed", error);
    return reply(500, { ok: false, error: "failure_health_read_failed" });
  }
}
