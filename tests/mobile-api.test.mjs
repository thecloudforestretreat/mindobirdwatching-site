import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPatch as patchGuest } from "../functions/api/mobile/guests/[inquiryId].js";
import { onRequestPatch as patchAssignment } from "../functions/api/mobile/assignments/[assignmentId].js";

const env = {
  LOCAL_TEST_IDENTITY: "owner@example.test",
  MBW_MOBILE_ROLE_MAP: JSON.stringify({ "owner@example.test": { role: "owner", staffCode: "JPG" } }),
  MBW_MOBILE_WRITE_ENABLE: "true",
  N8N_CRM_ADMIN_TOKEN: "test-token",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
};
const request = (path, body) => new Request(`http://localhost${path}`, { method: "PATCH", headers: { Origin: "http://localhost", "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify(body) });
const payload = options => JSON.parse(new URLSearchParams(options.body).get("payload"));

test("guest mutation uses server identity, optimistic concurrency, and verified readback", async () => {
  const savedFetch = globalThis.fetch; let row = { inquiry_id: "INQ-1", guest_id: "G-1", full_name: "Test Guest", status: "contacted", followup_date: "2026-10-20", updated_at: "v1" }; const actions = [];
  try {
    globalThis.fetch = async (_url, options) => { const body = payload(options); actions.push(body.action); assert.equal(options.headers["X-MBW-CRM-Key"], "test-token"); if (body.action === "list_inquiries") return Response.json({ ok: true, records: [row] }); if (["list_interactions", "list_assignments", "list_bookings", "list_payments"].includes(body.action)) return Response.json({ ok: true, records: [] }); if (body.action === "update_inquiry") { assert.match(body.record.internal_notes, /Mobile edit by JPG/); row = { ...body.record, updated_at: "v2" }; return Response.json({ ok: true }); } throw new Error(`Unexpected ${body.action}`); };
    const response = await patchGuest({ request: request("/api/mobile/guests/INQ-1", { expectedUpdatedAt: "v1", patch: { followup_date: "2026-10-21" } }), env, params: { inquiryId: "INQ-1" } });
    assert.equal(response.status, 200); assert.equal((await response.json()).verified, true); assert.equal(actions.filter(value => value === "update_inquiry").length, 1);
  } finally { globalThis.fetch = savedFetch; }
});

test("status mutation persists and verifies the canonical CRM status", async () => {
  const savedFetch = globalThis.fetch; let row = { inquiry_id: "INQ-STATUS", guest_id: "G-STATUS", full_name: "Status Guest", status: "new", updated_at: "s1" };
  try {
    globalThis.fetch = async (_url, options) => {
      const body = payload(options);
      if (body.action === "list_inquiries") return Response.json({ ok: true, records: [row] });
      if (["list_interactions", "list_assignments", "list_bookings", "list_payments"].includes(body.action)) return Response.json({ ok: true, records: [] });
      if (body.action === "update_inquiry") { row = { ...body.record, updated_at: "s2" }; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    const response = await patchGuest({ request: request("/api/mobile/guests/INQ-STATUS", { expectedUpdatedAt: "s1", patch: { status: "completed" } }), env, params: { inquiryId: "INQ-STATUS" } });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.verified, true);
    assert.equal(result.record.status, "completed");
    assert.match(row.internal_notes, /fields: status/);
  } finally { globalThis.fetch = savedFetch; }
});

test("stale guest mutation returns 409 without writing", async () => {
  const savedFetch = globalThis.fetch; let writes = 0;
  try {
    globalThis.fetch = async (_url, options) => { const body = payload(options); if (body.action === "update_inquiry") writes += 1; return Response.json({ ok: true, records: body.action === "list_inquiries" ? [{ inquiry_id: "INQ-1", guest_id: "G-1", updated_at: "current" }] : [] }); };
    const response = await patchGuest({ request: request("/api/mobile/guests/INQ-1", { expectedUpdatedAt: "stale", patch: { followup_date: "2026-10-21" } }), env, params: { inquiryId: "INQ-1" } });
    assert.equal(response.status, 409); assert.equal(writes, 0);
  } finally { globalThis.fetch = savedFetch; }
});

test("assignment mutation verifies the CRM result before reporting success", async () => {
  const savedFetch = globalThis.fetch; let assignment = { assignment_id: "ASN-1", inquiry_id: "INQ-1", service_date: "2026-10-21", service_type: "Birdwatching", assignment_status: "pending", provider_informed: "No", created_by: "JPG", updated_at: "a1" };
  try {
    globalThis.fetch = async (_url, options) => { const body = payload(options); if (body.action === "list_assignments") return Response.json({ ok: true, records: [assignment] }); if (body.action === "update_assignment") { assignment = { ...body.assignment, updated_at: "a2" }; return Response.json({ ok: true }); } throw new Error(`Unexpected ${body.action}`); };
    const response = await patchAssignment({ request: request("/api/mobile/assignments/ASN-1", { expectedUpdatedAt: "a1", patch: { assignment_status: "confirmed", provider_informed: "Yes" } }), env, params: { assignmentId: "ASN-1" } });
    const result = await response.json(); assert.equal(response.status, 200); assert.equal(result.verified, true); assert.equal(result.record.providerInformed, true);
  } finally { globalThis.fetch = savedFetch; }
});
