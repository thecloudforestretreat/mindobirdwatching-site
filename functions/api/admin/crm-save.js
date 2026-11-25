import { authorize } from "../whatsapp/index.js";
import { extractRecords } from "../../lib/mobile-crm.mjs";

const CRM = "https://n8n.mindobirdwatching.com/webhook/mbw-crm-admin-api";
const actions = new Set(["update_inquiry", "create_guest_and_inquiry", "create_returning_inquiry"]);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const inquiryId = /^INQ-[A-Z0-9-]{3,70}$/i;
const reply = (status, body) => Response.json(body, {status, headers: {"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
const clean = value => String(value ?? "").trim();
const volatile = new Set(["updated_at", "stage_changed_at", "last_contacted_at", "promo_applied_at", "created_at"]);

function database(env) { return env.MBW_PORTFOLIO_DB || env.MBW_ATTRIBUTION_DB; }
const enabled = env => env.MBW_CRM_VERIFIED_SAVE_ENABLED === "true";

export async function onRequestGet({request,env}) {
  const denied = await authorize(request);
  if (denied) return denied;
  return reply(200, {ok:true,enabled:enabled(env)&&Boolean(database(env))});
}

async function fingerprint(action, record, guestRow) {
  const stable = value => Object.entries(value || {}).filter(([key]) => !volatile.has(key)).sort(([a], [b]) => a.localeCompare(b));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([action, stable(record), stable(guestRow)])));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function callCrm(payload, timeout) {
  const response = await fetch(CRM, {
    method: "POST",
    headers: {"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
    body: new URLSearchParams({payload:JSON.stringify(payload)}),
    redirect: "error",
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error("crm_upstream_unavailable");
  return response.json();
}

export async function onRequestPost({request, env}) {
  const denied = await authorize(request);
  if (denied) return denied;
  if (request.headers.get("Origin") !== new URL(request.url).origin) return reply(403, {ok:false,error:"same_origin_required"});
  if (!enabled(env)) return reply(503, {ok:false,error:"save_guard_unavailable"});
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type") || "")) return reply(415, {ok:false,error:"json_required"});
  if (Number(request.headers.get("Content-Length")) > 131072) return reply(413, {ok:false,error:"save_payload_too_large"});
  const raw = await request.text();
  if (raw.length > 131072) return reply(413, {ok:false,error:"save_payload_too_large"});
  let body;
  try { body = JSON.parse(raw); } catch { return reply(400, {ok:false,error:"invalid_json"}); }
  const {action, request_id: requestId, record, guest_row: guestRow} = body || {};
  if (!actions.has(action) || !uuid.test(requestId || "") || !record || !inquiryId.test(record.inquiry_id || "") ||
      (action !== "update_inquiry" && (!guestRow || !record.guest_id || guestRow.guest_id !== record.guest_id))) {
    return reply(400, {ok:false,error:"invalid_save_request"});
  }
  const db = database(env);
  const result = (status, data) => reply(status, {request_id:requestId, inquiry_id:record.inquiry_id, ...data});
  let claimed, entry;
  try {
    const digest = await fingerprint(action, record, action==="create_guest_and_inquiry"?guestRow:null);
    const startedAt = new Date().toISOString();
    if (!db) throw new Error("missing_store");
    await db.prepare("CREATE TABLE IF NOT EXISTS crm_save_requests (request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, started_at TEXT NOT NULL, verified_at TEXT)").run();
    claimed = (await db.prepare("INSERT INTO crm_save_requests (request_id, fingerprint, started_at) VALUES (?, ?, ?) ON CONFLICT(request_id) DO NOTHING").bind(requestId, digest, startedAt).run()).meta.changes === 1;
    entry = claimed ? {fingerprint:digest, started_at:startedAt} : await db.prepare("SELECT fingerprint, started_at, verified_at FROM crm_save_requests WHERE request_id = ?").bind(requestId).first();
    if (!entry || entry.fingerprint !== digest) return result(409, {ok:false,error:"save_request_conflict"});
  } catch {
    return result(503, {ok:false,error:"save_guard_unavailable"});
  }

  // Only the owner of the durable claim may write. A timeout or duplicate
  // request can only read the source, including after a worker restart.
  if (claimed) {
    try { await callCrm({action, record, inquiry_row:record, guest_row:guestRow, request_id:requestId}, 17000); }
    catch { /* An ambiguous write may already have committed. */ }
  }
  try {
    const read = await callCrm({action:"list_inquiries", filters:{inquiry_id:record.inquiry_id}, verification_only:true}, 8500);
    if (read?.ok === false || read?.success === false) throw new Error("read_failed");
    const rows = extractRecords(read).filter(row => clean(row.inquiry_id) === clean(record.inquiry_id));
    const saved = rows.length === 1 ? rows[0] : null;
    const updatedAt = Date.parse(saved?.updated_at);
    // A previous version of the same inquiry is not proof that this save ran.
    if (!saved || !Number.isFinite(updatedAt) || updatedAt < Date.parse(entry.started_at)) throw new Error("not_confirmed");
    if (entry.verified_at && updatedAt > Date.parse(entry.verified_at)) throw new Error("saved_record_changed");
    for (const field of ["guest_id","status","first_name","last_name","email","product_selected","promo_code","internal_notes"]) {
      if (Object.hasOwn(record, field) && clean(record[field]).toLowerCase() !== clean(saved[field]).toLowerCase()) throw new Error("record_mismatch");
    }
    try {
      await db.prepare("UPDATE crm_save_requests SET verified_at = COALESCE(verified_at, ?) WHERE request_id = ?").bind(new Date().toISOString(), requestId).run();
    } catch { /* A telemetry failure does not invalidate the canonical read. */ }
    return result(200, {ok:true, updated_at:saved.updated_at, record:saved});
  } catch {
    return result(409, {ok:false,error:"save_outcome_unverified"});
  }
}
