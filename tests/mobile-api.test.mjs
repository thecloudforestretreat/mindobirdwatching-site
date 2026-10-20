import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPatch as patchGuest } from "../functions/api/mobile/guests/[inquiryId].js";
import { onRequestPatch as patchAssignment } from "../functions/api/mobile/assignments/[assignmentId].js";
import { onRequestPost as createAssignment } from "../functions/api/mobile/assignments/index.js";
import { onRequestPost as createService } from "../functions/api/mobile/guests/[inquiryId]/services.js";
import { onRequestPatch as patchService } from "../functions/api/mobile/guests/[inquiryId]/services/[serviceId].js";

const env = {
  LOCAL_TEST_IDENTITY: "owner@example.test",
  MBW_MOBILE_ROLE_MAP: JSON.stringify({ "owner@example.test": { role: "owner", staffCode: "JPG" } }),
  MBW_MOBILE_WRITE_ENABLE: "true",
  N8N_CRM_ADMIN_TOKEN: "test-token",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
};
const request = (path, body) => new Request(`http://localhost${path}`, { method: "PATCH", headers: { Origin: "http://localhost", "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify(body) });
const postRequest = (path, body) => new Request(`http://localhost${path}`, { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify(body) });
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

test("mobile app creates and verifies a provider assignment", async () => {
  const savedFetch = globalThis.fetch; let assignment = null;
  try {
    globalThis.fetch = async (_url, options) => { const body = payload(options); if (body.action === "create_assignment") { assignment = { ...body.assignment, assignment_id: "ASN-NEW", provider_name: "Test Guide", updated_at: "new1" }; return Response.json({ ok: true }); } if (body.action === "list_assignments") return Response.json({ ok: true, records: assignment ? [assignment] : [] }); throw new Error(`Unexpected ${body.action}`); };
    const response = await createAssignment({ request: postRequest("/api/mobile/assignments", { inquiryId: "INQ-1", guestId: "G-1", guestName: "Test Guest", guestPhone: "+15550000000", guestCount: "2", assignment: { service_date: "2026-10-21", start_time: "06:00", service_type: "Birdwatching", product_selected: "MBW004", provider_role: "guide", provider_name: "Test Guide", assignment_status: "confirmed", provider_informed: "Yes" } }), env });
    const result = await response.json(); assert.equal(response.status, 201); assert.equal(result.verified, true); assert.equal(result.record.providerName, "Test Guide"); assert.equal(assignment.created_by, "JPG");
  } finally { globalThis.fetch = savedFetch; }
});

test("mobile app appends and verifies an itinerary service without replacing existing tours", async () => {
  const savedFetch = globalThis.fetch;
  let row = { inquiry_id: "INQ-SERVICE", guest_id: "G-SERVICE", full_name: "Service Guest", status: "quoted", guest_count: "2", requested_date: "2026-11-01", updated_at: "svc1", tour_items_json: JSON.stringify([{ id: "primary", tour: "Birding", product_selected: "MBW004", service_type: "Birdwatching", date: "2026-11-01", guests: "2", status: "quoted" }]) };
  try {
    globalThis.fetch = async (_url, options) => {
      const body = payload(options);
      if (body.action === "list_inquiries") return Response.json({ ok: true, records: [row] });
      if (body.action === "update_inquiry") { row = { ...body.record, updated_at: "svc2" }; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    const response = await createService({ request: postRequest("/api/mobile/guests/INQ-SERVICE/services", { expectedUpdatedAt: "svc1", service: { service_type: "Activity", tour: "Night Walk", product_selected: "MBW016 - Night Walk", date: "2026-11-02", guests: "2", status: "quoted", price_per_person: "35", pickup_location: "Mindo hotel", notes: "Added by guest" } }), env, params: { inquiryId: "INQ-SERVICE" } });
    const result = await response.json(), items = JSON.parse(row.tour_items_json);
    assert.equal(response.status, 200);
    assert.equal(result.verified, true);
    assert.equal(items.length, 2);
    assert.equal(items[0].id, "primary");
    assert.equal(items[1].tour, "Night Walk");
    assert.equal(items[1].price_per_person, "35");
    assert.match(row.internal_notes, /Mobile service added by JPG/);
  } finally { globalThis.fetch = savedFetch; }
});

test("mobile app updates one itinerary service status without changing the other services", async () => {
  const savedFetch = globalThis.fetch;
  let row = { inquiry_id: "INQ-MULTI", guest_id: "G-MULTI", full_name: "Multi Service Guest", status: "booked", updated_at: "multi1", tour_items_json: JSON.stringify([{ id: "T-PAST", tour: "Birding", date: "2026-10-20", status: "booked" }, { id: "T-FUTURE", tour: "Night Walk", date: "2026-10-21", status: "booked" }]) };
  try {
    globalThis.fetch = async (_url, options) => {
      const body = payload(options);
      if (body.action === "list_inquiries") return Response.json({ ok: true, records: [row] });
      if (body.action === "update_inquiry") { row = { ...body.record, updated_at: "multi2" }; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    const response = await patchService({ request: request("/api/mobile/guests/INQ-MULTI/services/T-PAST", { expectedUpdatedAt: "multi1", status: "completed" }), env, params: { inquiryId: "INQ-MULTI", serviceId: "T-PAST" } });
    const result = await response.json(), items = JSON.parse(row.tour_items_json);
    assert.equal(response.status, 200);
    assert.equal(result.verified, true);
    assert.equal(items[0].status, "completed");
    assert.equal(items[1].status, "booked");
    assert.match(row.internal_notes, /Mobile service status by JPG/);
  } finally { globalThis.fetch = savedFetch; }
});
