import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { guideIdentity, mobileIdentity } from "../functions/lib/mobile-auth.mjs";
import { onRequestGet } from "../functions/api/guide/bootstrap.js";

const env = {
  LOCAL_TEST_IDENTITY: "owner@example.test",
  MBW_MOBILE_ROLE_MAP: JSON.stringify({
    "owner@example.test": { role: "owner", staffCode: "JPG", name: "Juan" },
    "guide@example.test": { role: "guide", name: "Neycer", providerName: "Neycer · Night Walk Guide" },
  }),
  N8N_CRM_ADMIN_TOKEN: "test-token",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
};

test("guide identity is available only to Guide Nest and is provider-bound", async () => {
  const request = new Request("http://localhost/api/guide/bootstrap");
  const identity = await guideIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" });
  assert.equal(identity.role, "guide");
  assert.equal(identity.providerName, "Neycer · Night Walk Guide");
  await assert.rejects(() => mobileIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" }), /not enabled/);
  await assert.rejects(() => guideIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "missing@example.test" }), /not enabled/);
  await assert.rejects(() => guideIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "guide@example.test", MBW_MOBILE_ROLE_MAP: JSON.stringify({ "guide@example.test": { role: "guide" } }) }), /not linked/);
});

test("guide bootstrap returns only booked assignments for the selected guide and only the allowed guest contact", async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(new URLSearchParams(options.body).get("payload"));
      const records = {
        list_assignments: [
          { assignment_id: "A-1", inquiry_id: "I-1", service_date: "2026-10-23", start_time: "05:00", provider_name: "Neycer · Night Walk Guide", service_type: "Birdwatching", product_selected: "Five Toucans", pickup_location: "Mindo Lodge", assignment_status: "confirmed", internal_note: "PRIVATE NOTE" },
          { assignment_id: "A-2", inquiry_id: "I-2", service_date: "2026-10-24", provider_name: "Neycer · Night Walk Guide", service_type: "Birdwatching", assignment_status: "pending" },
          { assignment_id: "A-3", inquiry_id: "I-3", service_date: "2026-10-24", provider_name: "Other Guide", service_type: "Birdwatching", assignment_status: "confirmed" },
          { assignment_id: "A-OLD", inquiry_id: "I-1", service_date: "2026-09-01", provider_name: "Neycer · Night Walk Guide", service_type: "Birdwatching", assignment_status: "confirmed" },
        ],
        list_inquiries: [
          { inquiry_id: "I-1", guest_id: "G-1", full_name: "Booked Guest", phone_raw: "+1 (555) 123-4567", email: "private@example.test", status: "booked", guest_count: "2", pickup_location: "Mindo Lodge", notes: "PRIVATE" },
          { inquiry_id: "I-2", guest_id: "G-2", full_name: "Quoted Guest", phone_raw: "+1 555 999 0000", status: "quoted" },
          { inquiry_id: "I-3", guest_id: "G-3", full_name: "Other Guest", phone_raw: "+1 555 111 0000", status: "booked" },
        ],
        list_bookings: [],
        list_providers: [{ provider_name: "Neycer · Night Walk Guide", provider_role: "guide", active: "yes" }, { provider_name: "Other Guide", provider_role: "guide", active: "yes" }],
      };
      return Response.json({ ok: true, records: records[body.action] || [] });
    };
    const response = await onRequestGet({ request: new Request("http://localhost/api/guide/bootstrap?provider=Neycer%20%C2%B7%20Night%20Walk%20Guide"), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.tours.length, 1);
    assert.equal(body.tours[0].guestName, "Booked Guest");
    assert.equal(body.tours[0].phone, "+1 (555) 123-4567");
    assert.equal(body.tours[0].whatsappUrl, "https://wa.me/15551234567");
    assert.equal(body.tours[0].internalNote, undefined);
    assert.equal(body.tours[0].email, undefined);
    assert.match(body.tours[0].guestMessage, /Mindo Lodge/);
  } finally { globalThis.fetch = savedFetch; }
});

test("a guide cannot switch to another provider with a query parameter", async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      const action = JSON.parse(new URLSearchParams(options.body).get("payload")).action;
      if (action === "list_assignments") return Response.json({ ok: true, records: [
        { assignment_id: "A-1", inquiry_id: "I-1", provider_name: "Neycer · Night Walk Guide", service_date: "2026-10-23" },
        { assignment_id: "A-2", inquiry_id: "I-2", provider_name: "Other Guide", service_date: "2026-10-23" },
      ] });
      if (action === "list_inquiries") return Response.json({ ok: true, records: [
        { inquiry_id: "I-1", full_name: "Allowed", status: "booked" },
        { inquiry_id: "I-2", full_name: "Blocked", status: "booked" },
      ] });
      return Response.json({ ok: true, records: [] });
    };
    const response = await onRequestGet({ request: new Request("http://localhost/api/guide/bootstrap?provider=Other%20Guide"), env: { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" } });
    const body = await response.json();
    assert.deepEqual(body.tours.map(item => item.guestName), ["Allowed"]);
    assert.equal(body.providerName, "Neycer · Night Walk Guide");
    assert.equal(body.preview, false);
  } finally { globalThis.fetch = savedFetch; }
});

test("Guide Nest static shell includes the required restricted workflows", () => {
  const html = fs.readFileSync(new URL("../admin/guide/index.html", import.meta.url), "utf8");
  const js = fs.readFileSync(new URL("../admin/guide/guide.mjs", import.meta.url), "utf8");
  assert.match(html, /My Tours/);
  assert.match(html, /Calendar/);
  assert.match(html, /Sightings/);
  assert.match(html, /Share MBW/);
  assert.match(js, /Copy guest message/);
  assert.match(js, /Google review/);
  assert.match(js, /Tripadvisor/);
  assert.match(js, /MBW Shop/);
});
