const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function cleanCampaign(value) {
  const campaign = String(value || "").trim().slice(0, 128);
  return /^[A-Za-z0-9_.-]{1,128}$/.test(campaign) ? campaign : null;
}

function cleanDate(value) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.MBW_ATTRIBUTION_DB) {
      return reply(503, { ok: false, error: "attribution_database_unavailable" });
    }

    const url = new URL(request.url);
    const campaign = cleanCampaign(url.searchParams.get("campaign"));
    const start = cleanDate(url.searchParams.get("start"));
    const end = cleanDate(url.searchParams.get("end"));
    if (!campaign || !start || !end || start > end) {
      return reply(400, { ok: false, error: "valid_campaign_start_and_end_required" });
    }

    const rows = await env.MBW_ATTRIBUTION_DB.prepare(`
      SELECT
        substr(session_started_at, 1, 10) AS date,
        COALESCE(utm_content, last_touch_content, first_touch_content, 'unassigned') AS content,
        COALESCE(utm_term, last_touch_term, first_touch_term, 'unassigned') AS market,
        COUNT(*) AS sessions,
        SUM(CASE WHEN fbclid IS NOT NULL OR meta_ad_id IS NOT NULL THEN 1 ELSE 0 END) AS meta_identified_sessions
      FROM sessions
      WHERE lower(COALESCE(utm_campaign, last_touch_campaign, first_touch_campaign, '')) = lower(?)
        AND date(session_started_at) >= date(?)
        AND date(session_started_at) <= date(?)
      GROUP BY 1, 2, 3
      ORDER BY 1, 2, 3
    `).bind(campaign, start, end).all();

    const intent = await env.MBW_ATTRIBUTION_DB.prepare(`
      SELECT COUNT(DISTINCT ci.contact_intent_id) AS contact_intents
      FROM contact_intents ci
      JOIN sessions s ON s.session_id = ci.session_id
      WHERE lower(COALESCE(s.utm_campaign, s.last_touch_campaign, s.first_touch_campaign, '')) = lower(?)
        AND date(ci.occurred_at) >= date(?)
        AND date(ci.occurred_at) <= date(?)
    `).bind(campaign, start, end).first();

    const resultRows = Array.isArray(rows.results) ? rows.results : [];
    const totals = resultRows.reduce((total, row) => {
      total.sessions += Number(row.sessions) || 0;
      total.meta_identified_sessions += Number(row.meta_identified_sessions) || 0;
      return total;
    }, { sessions: 0, meta_identified_sessions: 0 });

    return reply(200, {
      ok: true,
      campaign,
      start,
      end,
      updated_at: new Date().toISOString(),
      total_sessions: totals.sessions,
      meta_identified_sessions: totals.meta_identified_sessions,
      contact_intents: Number(intent && intent.contact_intents) || 0,
      rows: resultRows,
    });
  } catch (error) {
    console.error("Attribution report failed", error);
    return reply(500, { ok: false, error: "attribution_report_failed" });
  }
}
