import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { guideIdentity, mobileIdentity } from "../functions/lib/mobile-auth.mjs";
import { onRequestGet } from "../functions/api/guide/bootstrap.js";
import { onRequestGet as getGuideReports } from "../functions/api/guide/reports.js";
import { onRequestPost as acceptGuideAssignment } from "../functions/api/guide/assignments/[assignmentId]/accept.js";
import { onRequestPost as createGuideAvailability } from "../functions/api/guide/availability/index.js";
import { onRequestDelete as deleteGuideAvailability } from "../functions/api/guide/availability/[assignmentId].js";
import { onRequestPost as respondToGuideOffer } from "../functions/api/guide/offers/[assignmentId]/respond.js";
import { onRequestPost as saveGuidePlan } from "../functions/api/guide/plans/[planId].js";
import { onRequestPost as createGuidePlan } from "../functions/api/guide/plans/index.js";
import { resolveAssignmentService } from "../functions/lib/guide-data.mjs";
import { robertPlan, sanitizePlan } from "../functions/lib/guide-plans.mjs";

test("Guide Nest exposes branded browser icons and an explicit read-only admin audit mode", () => {
  const index = fs.readFileSync(new URL("../admin/guide/index.html", import.meta.url), "utf8");
  const script = fs.readFileSync(new URL("../admin/guide/guide.mjs", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../admin/app/app.css", import.meta.url), "utf8");
  assert.match(index, /rel="icon"[^>]+mbw-app-gold-transparent-192\.png/);
  assert.match(index, /data-i18n="auditMode"/);
  assert.match(index, /href="\/app\/\?view=today" data-i18n="returnNest"/);
  assert.match(index, /<label for="providerSelect" data-i18n="previewGuide">Guide View<\/label>/);
  assert.match(script, /previewGuide: "Guide View"/);
  assert.match(script, /initialParams\.get\("provider"\)/);
  assert.match(css, /#actionList\{grid-template-columns:1fr\}/);
});

const env = {
  LOCAL_TEST_IDENTITY: "owner@example.test",
  MBW_MOBILE_ROLE_MAP: JSON.stringify({
    "owner@example.test": { role: "owner", staffCode: "JPG", name: "Juan" },
  }),
  MBW_GUIDE_ROLE_MAP: JSON.stringify({
    "guide@example.test": { role: "guide", name: "Neycer", providerIds: ["PROV-007", "PROV-NIGHT"], providerName: "Neycer · Night Walk Guide", contributorNumber: "7" },
  }),
  N8N_CRM_ADMIN_TOKEN: "test-token",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
};

test("guide service identity follows the linked itinerary item and rejects copied primary products", () => {
  const inquiry = { tours: [{ id: "night", product: "MBW016 - Night Walk", tour: "Night Walk" }] };
  assert.equal(resolveAssignmentService({ serviceItemId: "night", note: "", product: "MBW006 - Five Toucans", serviceType: "Night Walk" }, inquiry), "MBW016 - Night Walk");
  assert.equal(resolveAssignmentService({ note: "Service reference: night", product: "MBW006 - Five Toucans", serviceType: "Night Walk" }, inquiry), "MBW016 - Night Walk");
  assert.equal(resolveAssignmentService({ note: "", product: "MBW006 - Five Toucans", serviceType: "Transportation" }, inquiry), "Transportation");
  assert.equal(resolveAssignmentService({ note: "", product: "MBW006 - Five Toucans", serviceType: "Birdwatching" }, inquiry), "MBW006 - Five Toucans");
});

test("CRM assignments link to itinerary services, sort earliest first, and expose lifecycle states", () => {
  const crm = fs.readFileSync(new URL("../admin/guest-crm/index.html", import.meta.url), "utf8");
  assert.match(crm, /id="assignmentTourItem"/);
  assert.match(crm, /Service reference:/);
  assert.match(crm, /const rows=sortAssignmentsAscending\(state\.assignments\|\|\[\]\)/);
  assert.match(crm, /Past — verify/);
  assert.match(crm, /assignmentItem--completed/);
});

test("guide identity is available only to Guide Nest and is provider-bound", async () => {
  const request = new Request("http://localhost/api/guide/bootstrap");
  const identity = await guideIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" });
  assert.equal(identity.role, "guide");
  assert.equal(identity.providerName, "Neycer · Night Walk Guide");
  assert.equal(identity.providerId, "PROV-007");
  assert.deepEqual(identity.providerIds, ["PROV-007", "PROV-NIGHT"]);
  assert.equal(identity.contributorNumber, "007");
  await assert.rejects(() => mobileIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" }), /not enabled/);
  await assert.rejects(() => guideIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "missing@example.test" }), /not enabled/);
  await assert.rejects(() => guideIdentity(request, { ...env, LOCAL_TEST_IDENTITY: "guide@example.test", MBW_GUIDE_ROLE_MAP: JSON.stringify({ "guide@example.test": { role: "guide" } }) }), /not linked/);
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
          { assignment_id: "AV-1", assignment_group_id: "AVAIL-1", assignment_kind: "availability", service_date: "2026-10-23", start_time: "04:00", end_time: "07:00", provider_id: "PROV-007", provider_name: "Neycer · Night Walk Guide", service_type: "Guide Unavailable", assignment_status: "confirmed" },
          { assignment_id: "O-1", assignment_group_id: "OFFER-1", service_date: "2026-11-25", provider_id: "PROV-007", provider_name: "Neycer · Night Walk Guide", product_selected: "Custom birding package", assignment_status: "pending" },
          { assignment_id: "A-4", inquiry_id: "I-4", service_date: "2026-10-24", provider_id: "PROV-007", provider_name: "Neycer · Night Walk Guide", service_type: "Birdwatching", assignment_status: "completed" },
        ],
        list_inquiries: [
          { inquiry_id: "I-1", guest_id: "G-1", full_name: "Booked Guest", phone_raw: "+1 (555) 123-4567", email: "private@example.test", country: "Luxembourg", status: "booked", guest_count: "2", pickup_location: "Mindo Lodge", notes: "PRIVATE" },
          { inquiry_id: "I-2", guest_id: "G-2", full_name: "Quoted Guest", phone_raw: "+1 555 999 0000", status: "quoted" },
          { inquiry_id: "I-3", guest_id: "G-3", full_name: "Other Guest", phone_raw: "+1 555 111 0000", status: "booked" },
          { inquiry_id: "I-4", guest_id: "G-4", full_name: "Completed Guest", phone_raw: "+1 555 222 0000", status: "completed" },
        ],
        list_bookings: [],
        list_providers: [{ provider_id: "PROV-007", provider_name: "Neycer · Night Walk Guide", provider_role: "guide", active: "yes" }, { provider_id: "PROV-008", provider_name: "Other Guide", provider_role: "guide", active: "yes" }],
      };
      return Response.json({ ok: true, records: records[body.action] || [] });
    };
    const response = await onRequestGet({ request: new Request("http://localhost/api/guide/bootstrap?provider=Neycer%20%C2%B7%20Night%20Walk%20Guide"), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.tours.length, 3);
    assert.equal(body.tours.some(item => item.assignmentId === "A-4"), true);
    assert.equal(body.tours.some(item => item.assignmentId === "A-OLD"), true);
    assert.equal(body.providerId, "PROV-007");
    assert.equal(body.providerOptions[0].providerId, "PROV-007");
    assert.equal(body.links.google, "https://g.page/r/CdMlIYMGgBIvEAE/review");
    assert.equal(new URL(body.links.google).searchParams.has("utm_source"), false);
    const shopLink = new URL(body.links.shop);
    assert.equal(shopLink.searchParams.get("utm_source"), "mbw_guide");
    assert.equal(shopLink.searchParams.get("utm_medium"), "referral");
    assert.equal(shopLink.searchParams.get("utm_campaign"), "post_tour");
    assert.equal(shopLink.searchParams.get("utm_content"), "neycer-night-walk-guide");
    const tipLink = new URL(body.links.tip);
    assert.equal(tipLink.searchParams.get("utm_campaign"), "guide_tip");
    assert.equal(tipLink.searchParams.get("utm_content"), "neycer-night-walk-guide");
    const bookedTour = body.tours.find(item => item.assignmentId === "A-1"), completedTour = body.tours.find(item => item.guestName === "Completed Guest");
    assert.equal(bookedTour.phone, "+1 (555) 123-4567");
    assert.equal(bookedTour.whatsappUrl, "https://wa.me/15551234567");
    assert.equal(bookedTour.country, "Luxembourg");
    assert.equal(bookedTour.countryCode, "LU");
    assert.equal(bookedTour.hasConflict, true);
    assert.equal(bookedTour.conflictReason, "availability");
    assert.equal(bookedTour.internalNote, undefined);
    assert.equal(bookedTour.email, undefined);
    assert.match(bookedTour.guestMessage, /Mindo Lodge/);
    assert.match(bookedTour.guestMessage, /^Hello Booked, I’m Neycer from Mindo Bird Watching\./);
    assert.match(bookedTour.guestMessage, /October 23, 2026 at 5:00 AM/);
    assert.match(bookedTour.guestMessage, /\n\nPlease message me here/);
    assert.match(bookedTour.guestMessage, /\n\nThank you\.$/);
    assert.equal(completedTour.contactAvailable, false);
    assert.equal(completedTour.phone, "");
    assert.equal(body.availability.length, 1);
    assert.equal(body.offers.length, 1);
  } finally { globalThis.fetch = savedFetch; }
});

test("a linked guide can accept only their own assignment", async () => {
  const savedFetch = globalThis.fetch;
  let row = { assignment_id: "A-ACCEPT", assignment_kind: "assignment", provider_id: "PROV-NIGHT", provider_name: "Neycer", assignment_status: "pending", provider_informed: "No", updated_at: "v1" };
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(new URLSearchParams(options.body).get("payload"));
      if (body.action === "list_assignments") return Response.json({ ok: true, records: [row] });
      if (body.action === "update_assignment") { row = { ...body.assignment, updated_at: "v2" }; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    const request = new Request("http://localhost/api/guide/assignments/A-ACCEPT/accept", { method: "POST", headers: { Origin: "http://localhost" } });
    const response = await acceptGuideAssignment({ request, env: { ...env, LOCAL_TEST_IDENTITY: "guide@example.test", MBW_MOBILE_WRITE_ENABLED: "true" }, params: { assignmentId: "A-ACCEPT" } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.verified, true);
    assert.equal(row.assignment_status, "confirmed");
    assert.equal(row.provider_informed, "Yes");
    assert.equal(row.guide_response, "accepted");
    assert.match(row.confirmation_note, /\[GUIDE_ACCEPTED/);
    assert.equal(row.created_by, "JPG");
  } finally { globalThis.fetch = savedFetch; }
});

test("guide availability is stored as a separate non-tour assignment", async () => {
  const savedFetch = globalThis.fetch;
  let created;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(new URLSearchParams(options.body).get("payload"));
      if (body.action === "create_assignment") { created = { ...body.assignment, assignment_id: "AV-NEW" }; return Response.json({ ok: true }); }
      if (body.action === "list_assignments") return Response.json({ ok: true, records: created ? [created] : [] });
      throw new Error(`Unexpected ${body.action}`);
    };
    const request = new Request("http://localhost/api/guide/availability", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ date: "2026-11-02", startTime: "08:00", endTime: "12:00", note: "Personal" }) });
    const response = await createGuideAvailability({ request, env: { ...env, LOCAL_TEST_IDENTITY: "guide@example.test", MBW_MOBILE_WRITE_ENABLED: "true" } });
    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.verified, true);
    assert.equal(created.assignment_kind, "availability");
    assert.equal(created.provider_id, "PROV-007");
    assert.equal(created.inquiry_id, "GUIDE-AVAIL-PROV-007");
    assert.equal(created.created_by, "JPG");
    assert.match(created.assignment_group_id, /^AVAIL-/);
  } finally { globalThis.fetch = savedFetch; }
});

test("a guide can remove only their own availability block", async () => {
  const savedFetch = globalThis.fetch;
  let rows = [{ assignment_id: "AV-DELETE", assignment_group_id: "AVAIL-DELETE", provider_id: "PROV-007", provider_name: "Neycer", service_type: "Guide Unavailable" }];
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(new URLSearchParams(options.body).get("payload"));
      if (body.action === "list_assignments") return Response.json({ ok: true, records: rows });
      if (body.action === "delete_assignment") { rows = []; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    const request = new Request("http://localhost/api/guide/availability/AV-DELETE", { method: "DELETE", headers: { Origin: "http://localhost" } });
    const response = await deleteGuideAvailability({ request, env: { ...env, LOCAL_TEST_IDENTITY: "guide@example.test", MBW_MOBILE_WRITE_ENABLED: "true" }, params: { assignmentId: "AV-DELETE" } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).verified, true);
  } finally { globalThis.fetch = savedFetch; }
});

test("guide offer responses persist through the existing assignment schema", async () => {
  const savedFetch = globalThis.fetch;
  let row = { assignment_id: "O-RESPOND", assignment_group_id: "OFFER-1", provider_id: "PROV-007", provider_name: "Neycer", assignment_status: "pending", created_by: "SS", confirmation_note: "Admin offer note", updated_at: "v1" };
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(new URLSearchParams(options.body).get("payload"));
      if (body.action === "list_assignments") return Response.json({ ok: true, records: [row] });
      if (body.action === "update_assignment") { row = { ...body.assignment, updated_at: "v2" }; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    const request = new Request("http://localhost/api/guide/offers/O-RESPOND/respond", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ response: "interested", bidAmount: "125.50" }) });
    const response = await respondToGuideOffer({ request, env: { ...env, LOCAL_TEST_IDENTITY: "guide@example.test", MBW_MOBILE_WRITE_ENABLED: "true" }, params: { assignmentId: "O-RESPOND" } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).verified, true);
    assert.match(row.confirmation_note, /Admin offer note\n\[GUIDE_RESPONSE interested\|125\.50\|/);
    assert.equal(row.created_by, "SS");
  } finally { globalThis.fetch = savedFetch; }
});

test("a guide cannot switch to another provider with a query parameter", async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      const action = JSON.parse(new URLSearchParams(options.body).get("payload")).action;
      if (action === "list_assignments") return Response.json({ ok: true, records: [
        { assignment_id: "A-1", inquiry_id: "I-1", provider_id: "PROV-NIGHT", provider_name: "Neycer", service_date: "2026-10-23" },
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
    assert.equal(new URL(body.links.shop).searchParams.get("utm_content"), "neycer");
  } finally { globalThis.fetch = savedFetch; }
});

test("two guide identities receive only their own tours and cannot mutate each other's assignment", async () => {
  const savedFetch = globalThis.fetch;
  let writeAttempted = false;
  const pilotEnv = {
    ...env,
    MBW_GUIDE_ROLE_MAP: JSON.stringify({
      "chicho@example.test": { role: "guide", name: "Chicho", providerName: "Chicho", providerIds: ["PROV-CHICHO", "PROV-ACTIVITY-CHICHO"], contributorNumber: "001" },
      "neicer@example.test": { role: "guide", name: "Neicer", providerName: "Neicer", providerIds: ["PROV-NEICER", "PROV-NEICER-NIGHT"], contributorNumber: "002" },
    }),
    MBW_MOBILE_WRITE_ENABLED: "true",
  };
  try {
    globalThis.fetch = async (_url, options) => {
      const action = JSON.parse(new URLSearchParams(options.body).get("payload")).action;
      if (action === "list_assignments") return Response.json({ ok: true, records: [
        { assignment_id: "A-CHICHO", inquiry_id: "I-CHICHO", provider_id: "PROV-ACTIVITY-CHICHO", provider_name: "Chicho", service_date: "2026-11-01", assignment_status: "confirmed" },
        { assignment_id: "A-NEICER", inquiry_id: "I-NEICER", provider_id: "PROV-NEICER-NIGHT", provider_name: "Neicer", service_date: "2026-11-02", assignment_status: "pending" },
        { assignment_id: "O-CHICHO", assignment_kind: "offer", provider_id: "PROV-CHICHO", provider_name: "Chicho", service_date: "2026-11-03", assignment_status: "pending" },
        { assignment_id: "O-NEICER", assignment_kind: "offer", provider_id: "PROV-NEICER", provider_name: "Neicer", service_date: "2026-11-04", assignment_status: "pending" },
      ] });
      if (action === "list_inquiries") return Response.json({ ok: true, records: [
        { inquiry_id: "I-CHICHO", full_name: "Chicho Guest", status: "booked" },
        { inquiry_id: "I-NEICER", full_name: "Neicer Guest", status: "booked" },
      ] });
      if (["list_bookings", "list_providers"].includes(action)) return Response.json({ ok: true, records: [] });
      if (action === "update_assignment") { writeAttempted = true; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${action}`);
    };
    const chichoResponse = await onRequestGet({ request: new Request("http://localhost/api/guide/bootstrap?provider=Neicer"), env: { ...pilotEnv, LOCAL_TEST_IDENTITY: "chicho@example.test" } });
    const neicerResponse = await onRequestGet({ request: new Request("http://localhost/api/guide/bootstrap?provider=Chicho"), env: { ...pilotEnv, LOCAL_TEST_IDENTITY: "neicer@example.test" } });
    const chichoBody = await chichoResponse.json(), neicerBody = await neicerResponse.json();
    assert.deepEqual(chichoBody.tours.map(item => item.guestName), ["Chicho Guest"]);
    assert.deepEqual(neicerBody.tours.map(item => item.guestName), ["Neicer Guest"]);
    assert.deepEqual(chichoBody.features, { plans: false, opportunities: false });
    assert.equal(chichoBody.plans.length, 0);
    assert.equal(chichoBody.offers.length, 0);
    assert.deepEqual(neicerBody.features, { plans: true, opportunities: true });
    assert.equal(neicerBody.plans[0].planId, "robert-2027");
    assert.equal(neicerBody.offers.length, 1);

    const denied = await acceptGuideAssignment({
      request: new Request("http://localhost/api/guide/assignments/A-NEICER/accept", { method: "POST", headers: { Origin: "http://localhost" } }),
      env: { ...pilotEnv, LOCAL_TEST_IDENTITY: "chicho@example.test" },
      params: { assignmentId: "A-NEICER" },
    });
    assert.equal(denied.status, 404);
    assert.equal(writeAttempted, false);
    const deniedOffer = await respondToGuideOffer({
      request: new Request("http://localhost/api/guide/offers/O-CHICHO/respond", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ response: "interested", bidAmount: "100" }) }),
      env: { ...pilotEnv, LOCAL_TEST_IDENTITY: "chicho@example.test" },
      params: { assignmentId: "O-CHICHO" },
    });
    assert.equal(deniedOffer.status, 404);
    assert.equal(writeAttempted, false);
  } finally { globalThis.fetch = savedFetch; }
});

test("Neicer can edit guide dates and prices while the submitted total is recalculated", () => {
  const original = robertPlan({ providerId: "PROV-007", name: "Neycer" });
  const changed = sanitizePlan({
    ...original,
    days: original.days.map((day, index) => index === 0 ? { ...day, date: "2027-02-08", originalCost: 190, sourceCosts: day.sourceCosts.map((cost, costIndex) => costIndex === 0 ? { ...cost, amount: 90 } : cost) } : day),
    originalTotal: 99999,
    adjustments: [{ id: "extra-1", dayId: "day-5", category: "lodging", description: "Intag lodging", amount: 80, verification: "estimated" }],
  }, original);
  assert.equal(changed.originalTotal, 800);
  assert.equal(changed.startDate, "2027-02-08");
  assert.deepEqual(changed.days.map(day => day.originalCost), [190, 150, 225, 235, 0, 0]);
  assert.deepEqual(changed.days[0].sourceCosts.map(item => item.amount), [90, 80, 20]);
  assert.deepEqual(changed.days[2].sourceCosts.map(item => item.amount), [130, 80, 15]);
  assert.deepEqual(changed.days[3].sourceCosts.map(item => item.amount), [140, 80, 15]);
  assert.equal(changed.adjustments[0].amount, 80);
});

test("saved guide-plan briefs and reserve costs remain the source of truth", () => {
  const original = robertPlan({ providerId: "PROV-NEICER", name: "Neicer" });
  const changed = sanitizePlan({
    ...original,
    synthetic: false,
    updatedAt: "2026-10-30T00:04:36.660Z",
    brief: {
      ...original.brief,
      request: { es: "Usar solo chofer cuando no se requiera guía.", en: "Use a driver only when a guide is not required." },
      dropoff: { es: "Hora del vuelo pendiente.", en: "Flight time pending." },
    },
    days: original.days.map((day, index) => index === 0 ? {
      ...day,
      sourceCosts: [{ id: "alambi-reserve", category: "reserve", amount: 10 }],
      originalCost: 10,
    } : day),
  }, original);
  assert.equal(changed.brief.request.es, "Usar solo chofer cuando no se requiera guía.");
  assert.equal(changed.brief.dropoff.en, "Flight time pending.");
  assert.equal(changed.days[0].sourceCosts[0].category, "reserve");
  assert.equal(changed.updatedAt, "2026-10-30T00:04:36.660Z");
  assert.equal(changed.synthetic, false);
});

test("an admin can create multiple guide-scoped custom plans while guides cannot create them", async () => {
  const savedFetch = globalThis.fetch;
  let rows = [];
  const pilot = {
    ...env,
    MBW_GUIDE_ROLE_MAP: JSON.stringify({ "neicer@example.test": { role: "guide", name: "Neicer", providerName: "Neicer", providerIds: ["PROV-NEICER"] } }),
    MBW_MOBILE_WRITE_ENABLED: "true",
  };
  try {
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(new URLSearchParams(options.body).get("payload"));
      if (payload.action === "create_assignment") {
        rows.push({ ...payload.assignment, assignment_id: `PLAN-ROW-${rows.length + 1}`, updated_at: `v${rows.length + 1}` });
        return Response.json({ ok: true });
      }
      if (payload.action === "list_assignments") return Response.json({ ok: true, records: rows });
      throw new Error(`Unexpected ${payload.action}`);
    };
    const makeRequest = guestName => new Request("http://localhost/api/guide/plans", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ providerId: "PROV-NEICER", providerName: "Neicer", guestName, inquiryId: `INQ-${guestName}`, title: `${guestName} Ecuador`, startDate: "2027-03-01", endDate: "2027-03-04", guestCount: "2", request: "Long custom tour" }) });
    const first = await createGuidePlan({ request: makeRequest("Alice"), env: pilot });
    const second = await createGuidePlan({ request: makeRequest("Bruno"), env: pilot });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].assignment_group_id, rows[1].assignment_group_id);
    const firstBody = await first.json();
    assert.equal(firstBody.plan.guestName, "Alice");
    assert.equal(firstBody.plan.days.length, 4);
    assert.equal(firstBody.plan.providerId, "PROV-NEICER");
    assert.equal(firstBody.plan.inquiryId, "INQ-Alice");

    const denied = await createGuidePlan({ request: makeRequest("Denied"), env: { ...pilot, LOCAL_TEST_IDENTITY: "neicer@example.test" } });
    assert.equal(denied.status, 403);
    assert.equal(rows.length, 2);
  } finally { globalThis.fetch = savedFetch; }
});

test("Neicer can save Robert's plan but another guide cannot access it", async () => {
  const savedFetch = globalThis.fetch;
  let rows = [];
  const pilot = {
    ...env,
    MBW_GUIDE_ROLE_MAP: JSON.stringify({
      "neicer@example.test": { role: "guide", name: "Neicer", providerName: "Neicer", providerIds: ["PROV-NEICER"], contributorNumber: "002" },
      "chicho@example.test": { role: "guide", name: "Chicho", providerName: "Chicho", providerIds: ["PROV-CHICHO"], contributorNumber: "001" },
    }),
    MBW_MOBILE_WRITE_ENABLED: "true",
  };
  try {
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(new URLSearchParams(options.body).get("payload"));
      if (payload.action === "list_assignments") return Response.json({ ok: true, records: rows });
      if (payload.action === "create_assignment") { rows = [{ ...payload.assignment, assignment_id: "PLAN-ROW-1", updated_at: "v1" }]; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${payload.action}`);
    };
    const editableDays = robertPlan().days.map((day, index) => index === 0 ? { ...day, date: "2027-02-08", originalCost: 190, sourceCosts: day.sourceCosts.map((cost, costIndex) => costIndex === 0 ? { ...cost, amount: 90 } : cost) } : day);
    editableDays.push({ id: "day-7", date: "2027-02-15", title: { es: "Día adicional", en: "Additional day" }, details: { es: "Por planificar", en: "To be planned" }, sourceCosts: [], costNote: { es: "Total proporcionado; desglose pendiente.", en: "Total provided; breakdown pending." }, originalCost: 60 });
    const requestBody = { providerId: "ignored", providerName: "ignored", status: "admin_review", days: editableDays, adjustments: [{ dayId: "day-5", category: "lodging", description: "Intag lodge", amount: 80, verification: "estimated" }], comments: [{ message: "Please confirm the lodge.", author: "Neicer", role: "guide", createdAt: "2026-10-26T12:00:00.000Z" }] };
    const neicer = await saveGuidePlan({ request: new Request("http://localhost/api/guide/plans/robert-2027", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }), env: { ...pilot, LOCAL_TEST_IDENTITY: "neicer@example.test" }, params: { planId: "robert-2027" } });
    assert.equal(neicer.status, 201);
    const saved = await neicer.json();
    assert.equal(saved.plan.originalTotal, 860);
    assert.equal(saved.plan.startDate, "2027-02-08");
    assert.equal(saved.plan.endDate, "2027-02-15");
    assert.equal(saved.plan.adjustments[0].description, "Intag lodge");
    assert.equal(rows[0].provider_id, "PROV-NEICER");

    const chicho = await saveGuidePlan({ request: new Request("http://localhost/api/guide/plans/robert-2027", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }), env: { ...pilot, LOCAL_TEST_IDENTITY: "chicho@example.test" }, params: { planId: "robert-2027" } });
    assert.equal(chicho.status, 404);
  } finally { globalThis.fetch = savedFetch; }
});

test("guide plan writes enforce status, authorship, and optimistic concurrency", async () => {
  const savedFetch = globalThis.fetch;
  let rows = [];
  let writes = 0;
  const pilot = {
    ...env,
    MBW_GUIDE_ROLE_MAP: JSON.stringify({
      "neicer@example.test": { role: "guide", name: "Neicer", providerName: "Neicer", providerIds: ["PROV-NEICER"], contributorNumber: "002" },
    }),
    MBW_MOBILE_WRITE_ENABLED: "true",
  };
  try {
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(new URLSearchParams(options.body).get("payload"));
      if (payload.action === "list_assignments") return Response.json({ ok: true, records: rows });
      if (payload.action === "create_assignment") { writes += 1; rows = [{ ...payload.assignment, assignment_id: "PLAN-SECURE", updated_at: "v1" }]; return Response.json({ ok: true }); }
      if (payload.action === "update_assignment") { writes += 1; rows = [{ ...payload.assignment, updated_at: "v2" }]; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${payload.action}`);
    };
    const base = robertPlan({ providerId: "PROV-NEICER", name: "Neicer" });
    const forged = await saveGuidePlan({
      request: new Request("http://localhost/api/guide/plans/robert-2027", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved", days: base.days }) }),
      env: { ...pilot, LOCAL_TEST_IDENTITY: "neicer@example.test" }, params: { planId: "robert-2027" },
    });
    assert.equal(forged.status, 403);
    assert.equal(writes, 0);

    const created = await saveGuidePlan({
      request: new Request("http://localhost/api/guide/plans/robert-2027", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ status: "guide_drafting", days: base.days, adjustments: [{ id: "cost-new", dayId: "day-1", category: "food", description: "Lunch", amount: 15, addedBy: "MBW Admin", addedAt: "2000-01-01" }], comments: [{ id: "comment-new", message: "Question", author: "MBW Admin", role: "admin", createdAt: "2000-01-01" }] }) }),
      env: { ...pilot, LOCAL_TEST_IDENTITY: "neicer@example.test" }, params: { planId: "robert-2027" },
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.plan.comments[0].author, "Neicer");
    assert.equal(createdBody.plan.comments[0].role, "guide");
    assert.notEqual(createdBody.plan.comments[0].createdAt, "2000-01-01");
    assert.equal(createdBody.plan.adjustments[0].addedBy, "Neicer");
    assert.notEqual(createdBody.plan.adjustments[0].addedAt, "2000-01-01");

    const stale = await saveGuidePlan({
      request: new Request("http://localhost/api/guide/plans/robert-2027", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ updatedAt: "older-version", status: "guide_drafting", days: base.days }) }),
      env: { ...pilot, LOCAL_TEST_IDENTITY: "neicer@example.test" }, params: { planId: "robert-2027" },
    });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, "PLAN_STALE");
    assert.equal(writes, 1);
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
  assert.match(html, /data-view="plans"/);
  assert.match(html, /id="newPlanForm"/);
  assert.match(html, /data-i18n="createAndAssign"/);
  assert.match(js, /mutate\("\/api\/guide\/plans", "POST"/);
  assert.match(html, /data-language="es"/);
  assert.match(html, /Reportes anteriores/);
  assert.match(js, /Copy guest message/);
  assert.match(js, /Google review/);
  assert.match(js, /Tripadvisor/);
  assert.match(js, /\["confirmed", "completed"\]\.includes\(tour\.status\) && \(!tour\.serviceDate \|\| tour\.serviceDate <= today\)/);
  assert.doesNotMatch(js, /data-accept=/);
  assert.match(js, /MBW Shop/);
  assert.match(js, /Custom Ecuador itinerary|additionalCosts/);
  assert.match(js, /assets\/images\/icons\/mbw_gr\.png/);
  assert.match(js, /assets\/images\/icons\/mbw_icons_trip_advisor\.png/);
  assert.match(js, /assets\/images\/icons\/mbw_(ig|fb|yt|shop)\.png/);
  assert.match(css, /--green:#0d5925/);
  assert.match(css, /linear-gradient\(180deg,#e3edd8 0,#f8faf5 210px\)/);
  assert.match(css, /\.cards\{grid-template-columns:1fr!important\}/);
  const recap = fs.readFileSync(new URL("../assets/js/guide-tour-recap.js", import.meta.url), "utf8");
  assert.match(recap, /params\.get\("date"\)/);
  assert.match(recap, /params\.get\("tour_type"\)/);
  assert.match(recap, /params\.get\("contributor"\)/);
});
