import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet as getGuest, onRequestPatch as patchGuest } from "../functions/api/mobile/guests/[inquiryId].js";
import { onRequestPost as createGuest } from "../functions/api/mobile/guests/index.js";
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

test("guest detail keeps the canonical record visible when one related CRM section fails", async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = payload(options);
      if (body.action === "list_inquiries") return Response.json({ ok: true, records: [{ inquiry_id: "INQ-PARTIAL", guest_id: "G-PARTIAL", full_name: "Partial Guest", status: "quoted" }] });
      if (body.action === "list_payments") throw new Error("upstream unavailable");
      if (["list_interactions", "list_assignments", "list_bookings"].includes(body.action)) return Response.json({ ok: true, records: [] });
      throw new Error(`Unexpected ${body.action}`);
    };
    const response = await getGuest({ request: new Request("http://localhost/api/mobile/guests/INQ-PARTIAL"), env, params: { inquiryId: "INQ-PARTIAL" } });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.record.name, "Partial Guest");
    assert.deepEqual(result.warnings, ["payments"]);
    assert.deepEqual(result.data.payments, []);
  } finally { globalThis.fetch = savedFetch; }
});

test("mobile app creates a new guest and verifies the canonical CRM inquiry", async () => {
  const savedFetch = globalThis.fetch; let row = null; const actions = [];
  try {
    globalThis.fetch = async (_url, options) => {
      const body = payload(options); actions.push(body.action);
      if (body.action === "list_inquiries") return Response.json({ ok: true, records: row ? [row] : [] });
      if (body.action === "create_guest_and_inquiry") { row = body.record; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    const response = await createGuest({ request: postRequest("/api/mobile/guests", { guest: { full_name: "New Guest", phone_number: "+1 305 555 0101", email: "new@example.test", country: "United States", tour: "Night Walk", requested_date: "2026-11-10", guest_count: "2" } }), env });
    const result = await response.json();
    assert.equal(response.status, 201); assert.equal(result.verified, true); assert.equal(result.returningGuest, false);
    assert.equal(row.source_type, "manual_app"); assert.equal(row.status, "new"); assert.equal(row.assigned_to, ""); assert.equal(JSON.parse(row.tour_items_json)[0].tour, "Night Walk");
    assert.deepEqual(actions, ["list_inquiries", "create_guest_and_inquiry", "list_inquiries"]);
  } finally { globalThis.fetch = savedFetch; }
});

test("mobile guest creation reuses a returning guest and rejects the same trip", async () => {
  const savedFetch = globalThis.fetch; const existing = { inquiry_id: "OLD-1", guest_id: "G-RETURN", full_name: "Returning Guest", email: "return@example.test", requested_date: "2026-11-01", status: "completed" }; let created = null;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = payload(options);
      if (body.action === "list_inquiries") return Response.json({ ok: true, records: created ? [existing, created] : [existing] });
      if (body.action === "create_returning_inquiry") { created = body.record; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    let response = await createGuest({ request: postRequest("/api/mobile/guests", { guest: { full_name: "Returning Guest", email: "return@example.test", requested_date: "2026-12-01", guest_count: "1" } }), env });
    let result = await response.json(); assert.equal(response.status, 201); assert.equal(result.returningGuest, true); assert.equal(created.guest_id, "G-RETURN");
    created = null; existing.status = "quoted";
    response = await createGuest({ request: postRequest("/api/mobile/guests", { guest: { full_name: "Returning Guest", email: "return@example.test", requested_date: "2026-11-01", guest_count: "1" } }), env });
    result = await response.json(); assert.equal(response.status, 409); assert.equal(result.inquiryId, "OLD-1");
  } finally { globalThis.fetch = savedFetch; }
});

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

test("mobile profile editing preserves CRM identity helpers", async () => {
  const savedFetch = globalThis.fetch; let row = { inquiry_id: "INQ-PROFILE", guest_id: "G-PROFILE", first_name: "Old", last_name: "Name", full_name: "Old Name", phone_number: "123", email: "old@example.test", status: "planning", updated_at: "p1" };
  try {
    globalThis.fetch = async (_url, options) => {
      const body = payload(options);
      if (body.action === "list_inquiries") return Response.json({ ok: true, records: [row] });
      if (["list_interactions", "list_assignments", "list_bookings", "list_payments"].includes(body.action)) return Response.json({ ok: true, records: [] });
      if (body.action === "update_inquiry") { row = { ...body.record, updated_at: "p2" }; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    const response = await patchGuest({ request: request("/api/mobile/guests/INQ-PROFILE", { expectedUpdatedAt: "p1", patch: { first_name: "Updated", last_name: "Guest", phone_number: "+1 305 555 0199", email: "updated@example.test", country: "United States", guest_count: "3" } }), env, params: { inquiryId: "INQ-PROFILE" } });
    assert.equal(response.status, 200); assert.equal((await response.json()).verified, true); assert.equal(row.first_name, "Updated"); assert.equal(row.last_name, "Guest"); assert.equal(row.full_name, "Updated Guest"); assert.equal(row.phone_normalized, "13055550199"); assert.equal(row.email_normalized, "updated@example.test"); assert.equal(row.home_country, "United States");
  } finally { globalThis.fetch = savedFetch; }
});

test("itinerary date reconciliation updates the canonical CRM range once and verifies it", async () => {
  const savedFetch = globalThis.fetch;
  let row = { inquiry_id: "INQ-DATES", guest_id: "G-DATES", full_name: "Date Guest", status: "planning", requested_date: "2027-02-09", requested_date_start: "2027-02-09", requested_date_end: "2027-02-13", updated_at: "d1" };
  let writes = 0;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = payload(options);
      if (body.action === "list_inquiries") return Response.json({ ok: true, records: [row] });
      if (["list_interactions", "list_assignments", "list_bookings", "list_payments"].includes(body.action)) return Response.json({ ok: true, records: [] });
      if (body.action === "update_inquiry") { writes += 1; row = { ...body.record, updated_at: "d2" }; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    const response = await patchGuest({ request: request("/api/mobile/guests/INQ-DATES", { expectedUpdatedAt: "d1", patch: { requested_date: "2027-02-09", requested_date_start: "2027-02-09", requested_date_end: "2027-02-14" } }), env, params: { inquiryId: "INQ-DATES" } });
    const result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.verified, true); assert.equal(writes, 1);
    assert.equal(row.requested_date, "2027-02-09"); assert.equal(row.requested_date_start, "2027-02-09"); assert.equal(row.requested_date_end, "2027-02-14");
    assert.match(row.internal_notes, /requested_date, requested_date_start, requested_date_end/);
  } finally { globalThis.fetch = savedFetch; }
});

test("itinerary date reconciliation rejects an end date before its start without writing", async () => {
  const savedFetch = globalThis.fetch; let writes = 0;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = payload(options);
      if (body.action === "list_inquiries") return Response.json({ ok: true, records: [{ inquiry_id: "INQ-DATES-BAD", guest_id: "G-DATES-BAD", full_name: "Date Guest", requested_date: "2027-02-09", updated_at: "b1" }] });
      if (["list_interactions", "list_assignments", "list_bookings", "list_payments"].includes(body.action)) return Response.json({ ok: true, records: [] });
      if (body.action === "update_inquiry") writes += 1;
      return Response.json({ ok: true });
    };
    const response = await patchGuest({ request: request("/api/mobile/guests/INQ-DATES-BAD", { expectedUpdatedAt: "b1", patch: { requested_date_start: "2027-02-14", requested_date_end: "2027-02-09" } }), env, params: { inquiryId: "INQ-DATES-BAD" } });
    assert.equal(response.status, 400); assert.equal(writes, 0);
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
    const response = await createAssignment({ request: postRequest("/api/mobile/assignments", { inquiryId: "INQ-1", guestId: "G-1", guestName: "Test Guest", guestPhone: "+15550000000", guestCount: "2", assignment: { service_item_id: "tour-1", service_date: "2026-10-21", start_time: "06:00", service_type: "Birdwatching", product_selected: "MBW004", provider_id: "PROV-TEST", provider_role: "guide", provider_name: "Test Guide", assignment_status: "confirmed", provider_informed: "Yes" } }), env });
    const result = await response.json(); assert.equal(response.status, 201); assert.equal(result.verified, true); assert.equal(result.record.providerId, "PROV-TEST"); assert.equal(result.record.providerName, "Test Guide"); assert.equal(result.record.serviceItemId, "tour-1"); assert.equal(assignment.created_by, "JPG");
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
