import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { guideIdentity, mobileIdentity } from "../functions/lib/mobile-auth.mjs";
import { onRequestGet } from "../functions/api/guide/bootstrap.js";
import { onRequestGet as getGuideReports } from "../functions/api/guide/reports.js";

const env = {
  LOCAL_TEST_IDENTITY: "owner@example.test",
  MBW_MOBILE_ROLE_MAP: JSON.stringify({
    "owner@example.test": { role: "owner", staffCode: "JPG", name: "Juan" },
    "guide@example.test": { role: "guide", name: "Neycer", providerId: "PROV-007", providerName: "Neycer · Night Walk Guide", contributorNumber: "7" },
  }),
  N8N_CRM_ADMIN_TOKEN: "test-token",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
};

test("guide identity is available only to Guide Nest and is provider-bound", async () => {
  const request = new Request("http://localhost/api/guide/bootstrap");
  const identity = await guideIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" });
  assert.equal(identity.role, "guide");
  assert.equal(identity.providerName, "Neycer · Night Walk Guide");
  assert.equal(identity.providerId, "PROV-007");
  assert.equal(identity.contributorNumber, "007");
  await assert.rejects(() => mobileIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" }), /not enabled/);
  await assert.rejects(() => guideIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "missing@example.test" }), /not enabled/);
  await assert.rejects(() => guideIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "guide@example.test", MBW_MOBILE_ROLE_MAP: JSON.stringify({ "guide@example.test": { role: "guide" } }) }), /not linked/);
});

test("guide report history is grouped and restricted to the linked contributor", async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ ok: true, sightings: [
      { source: "guide", recap_id: "recap-1", guide_id: "contributor_007", observed_at: "2026-10-20", location_name: "San Lorenzo", tour_id: "B-1", quantity: 2 },
      { source: "guide", recap_id: "recap-1", guide_id: "contributor_007", observed_at: "2026-10-20", location_name: "San Lorenzo", tour_id: "B-1", quantity: 1 },
      { source: "guide", recap_id: "recap-private", guide_id: "contributor_008", observed_at: "2026-10-19", location_name: "Other", quantity: 9 },
    ] });
    const response = await getGuideReports({ request: new Request("http://localhost/api/guide/reports"), env: { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.reports.length, 1);
    assert.equal(body.reports[0].recapId, "recap-1");
    assert.equal(body.reports[0].speciesCount, 2);
    assert.equal(body.reports[0].totalObservations, 3);
  } finally { globalThis.fetch = savedFetch; }
});

test("guide bootstrap returns only booked assignments for the selected guide and only the allowed guest contact", async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(new URLSearchParams(options.body).get("payload"));
      const records = {
        list_assignments: [
          { assignment_id: "A-1", inquiry_id: "I-1", service_date: "2026-10-23", start_time: "05:00", provider_id: "PROV-007", provider_name: "Neycer renamed", service_type: "Birdwatching", product_selected: "Five Toucans", pickup_location: "Mindo Lodge", assignment_status: "confirmed", internal_note: "PRIVATE NOTE" },
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
        list_providers: [{ provider_id: "PROV-007", provider_name: "Neycer · Night Walk Guide", provider_role: "guide", active: "yes" }, { provider_id: "PROV-008", provider_name: "Other Guide", provider_role: "guide", active: "yes" }],
      };
      return Response.json({ ok: true, records: records[body.action] || [] });
    };
    const response = await onRequestGet({ request: new Request("http://localhost/api/guide/bootstrap?provider=Neycer%20%C2%B7%20Night%20Walk%20Guide"), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.tours.length, 1);
    assert.equal(body.providerId, "PROV-007");
    assert.equal(body.providerOptions[0].providerId, "PROV-007");
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
        { assignment_id: "A-1", inquiry_id: "I-1", provider_id: "PROV-007", provider_name: "Neycer renamed", service_date: "2026-10-23" },
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
  const css = fs.readFileSync(new URL("../admin/guide/guide.css", import.meta.url), "utf8");
  assert.match(html, /Mis tours/);
  assert.match(html, /Calendario/);
  assert.match(html, /Avistamientos/);
  assert.match(html, /Share MBW/);
  assert.match(html, /data-language="es"/);
  assert.match(html, /Reportes anteriores/);
  assert.match(js, /Copy guest message/);
  assert.match(js, /Google review/);
  assert.match(js, /Tripadvisor/);
  assert.match(js, /MBW Shop/);
  assert.match(js, /assets\/images\/icons\/mbw_gr\.png/);
  assert.match(js, /assets\/images\/icons\/mbw_icons_trip_advisor\.png/);
  assert.match(js, /assets\/images\/icons\/mbw_(ig|fb|yt|shop)\.png/);
  assert.match(css, /--green:#0d5925/);
  assert.match(css, /linear-gradient\(180deg,#e3edd8 0,#f8faf5 210px\)/);
  assert.match(css, /\.cards\{grid-template-columns:1fr!important\}/);
  const recap = fs.readFileSync(new URL("../assets/js/guide-tour-recap.js", import.meta.url), "utf8");
  assert.match(recap, /params\.get\("date"\)/);
  assert.match(recap, /params\.get\("tour_type"\)/);
});
