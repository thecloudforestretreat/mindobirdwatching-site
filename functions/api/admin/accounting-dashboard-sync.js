const reply = (status, body) => Response.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
});

function bearer(request) {
  const value = String(request.headers.get("authorization") || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

export async function onRequestPost({ request, env }) {
  const expected = String(env.ACCOUNTING_DASHBOARD_SYNC_TOKEN || env.GSHEET_WEBAPP_TOKEN || "").trim();
  if (!expected || bearer(request) !== expected) return reply(401, { ok: false, error: "unauthorized" });
  if (!String(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return reply(415, { ok: false, error: "json_required" });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 2_500_000) return reply(413, { ok: false, error: "snapshot_too_large" });
  const raw = await request.text();
  if (!raw || raw.length > 2_500_000) return reply(413, { ok: false, error: "snapshot_too_large" });
  let payload;
  try { payload = JSON.parse(raw); }
  catch { return reply(400, { ok: false, error: "invalid_json" }); }
  const required = ["daily_recon", "guide_payment_queue", "guide_settlements", "guide_ledger", "expenses", "growth_dashboard", "invoices", "report_income_summary", "deposits", "recon_meta_ads_import"];
  if (!payload?.ok || !payload.generated_at || !payload.tabs || required.some(name => !Array.isArray(payload.tabs[name]))) return reply(400, { ok: false, error: "invalid_snapshot" });
  const db = env.MBW_PORTFOLIO_DB;
  if (!db) return reply(503, { ok: false, error: "snapshot_store_unavailable" });
  const receivedAt = new Date().toISOString();
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS accounting_dashboard_snapshots (snapshot_id TEXT PRIMARY KEY, generated_at TEXT NOT NULL, payload TEXT NOT NULL, received_at TEXT NOT NULL)").run();
    await db.prepare("INSERT INTO accounting_dashboard_snapshots (snapshot_id, generated_at, payload, received_at) VALUES (?, ?, ?, ?) ON CONFLICT(snapshot_id) DO UPDATE SET generated_at = excluded.generated_at, payload = excluded.payload, received_at = excluded.received_at")
      .bind("current", String(payload.generated_at), JSON.stringify(payload), receivedAt).run();
    return reply(200, { ok: true, generated_at: String(payload.generated_at), received_at: receivedAt });
  } catch (error) {
    console.error("Accounting dashboard snapshot write failed", error);
    return reply(503, { ok: false, error: "snapshot_store_unavailable" });
  }
}
