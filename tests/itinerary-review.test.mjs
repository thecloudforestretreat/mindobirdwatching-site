import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { onRequestGet } from "../functions/api/mobile/plans/index.js";
import { onRequestGet as getGuestItineraryDraft } from "../functions/api/mobile/plans/[planId]/itinerary-draft.js";
import { guestItineraryDraft, parsePlanRow, planAssignment, robertPlan, sanitizePlan, sortPlanCosts } from "../functions/lib/guide-plans.mjs";

const env = {
  LOCAL_TEST_IDENTITY: "owner@example.test",
  MBW_MOBILE_ROLE_MAP: JSON.stringify({ "owner@example.test": { role: "owner", staffCode: "JPG", name: "Juan" } }),
  MBW_GUIDE_ROLE_MAP: JSON.stringify({ "guide@example.test": { role: "guide", providerName: "Neicer", providerId: "PROV-NEICER" } }),
  N8N_CRM_ADMIN_TOKEN: "test-token",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
};

test("daily cost order always ends with transportation then lodging when present", () => {
  const ordered = sortPlanCosts([
    { category: "lodging", amount: 100 }, { category: "transportation", amount: 80 },
    { category: "guide", amount: 75 }, { category: "entrance", amount: 20 },
  ]);
  assert.deepEqual(ordered.map(item => item.category), ["guide", "entrance", "transportation", "lodging"]);
  const plan = sanitizePlan({ ...robertPlan(), days: [{ ...robertPlan().days[0], sourceCosts: ordered.reverse() }] });
  assert.deepEqual(plan.days[0].sourceCosts.slice(-2).map(item => item.category), ["transportation", "lodging"]);
});

test("explicit zero-dollar guide and guest cost lines remain visible", () => {
  const base = robertPlan();
  const day = { ...base.days[0], sourceCosts: [...base.days[0].sourceCosts, { id: "no-reserve-fee", category: "reserve", amount: 0 }] };
  const plan = sanitizePlan({ ...base, days: [day, ...base.days.slice(1)], mbwPricing: { days: [{ dayId: day.id, sellPrice: 420, guestLines: [{ id: "guest-no-reserve-fee", category: "reserve", label: { en: "Reserve fee", es: "Tarifa de reserva" }, amount: 0 }] }] } });
  assert.equal(plan.days[0].sourceCosts.find(item => item.id === "no-reserve-fee")?.amount, 0);
  assert.equal(plan.mbwPricing.days[0].guestLines.find(item => item.id === "guest-no-reserve-fee")?.amount, 0);
});

test("itemized guest lines are the authoritative final and lodging totals", () => {
  const base = robertPlan();
  const plan = sanitizePlan({ ...base, mbwPricing: { days: [{
    dayId: base.days[0].id,
    sellPrice: 999,
    lodgingPrice: 999,
    guestLines: [
      { category: "guide", label: { en: "Private guiding" }, amount: 125 },
      { category: "reserve", label: { en: "Reserve fee" }, amount: 0 },
      { category: "transportation", label: { en: "Private transportation" }, amount: 130 },
      { category: "lodging", label: { en: "Lodging" }, amount: 150 },
    ],
  }] } }, base);
  assert.equal(plan.mbwPricing.days[0].sellPrice, 405);
  assert.equal(plan.mbwPricing.days[0].lodgingPrice, 150);
});

test("Robert plan carries the dated lodging and route review without exposing MBW pricing to guides", () => {
  const plan = robertPlan({ providerId: "PROV-NEICER", name: "Neicer" });
  assert.match(plan.comments[0].message, /primeros 3 días en Mindo/);
  assert.match(plan.comments[0].message, /desglose del alojamiento/);
  assert.match(plan.guestRevisions[0].summary.en, /2 nights in Mindo/);
  assert.match(plan.guestRevisions[0].rawMessage, /Tren de la Libertad/);
});

test("Inquiry Studio plan queue is admin-only and returns plan summaries", async () => {
  const savedFetch = globalThis.fetch;
  try {
    const plan = { ...robertPlan({ providerId: "PROV-NEICER", name: "Neicer" }), status: "admin_review", mbwPricing: { days: [{ dayId: "day-1", sellPrice: 999 }], notes: "private" } };
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(new URLSearchParams(options.body).get("payload"));
      assert.equal(payload.action, "list_assignments");
      return Response.json({ ok: true, records: [{ assignment_id: "PLAN-1", assignment_kind: "tour_plan", assignment_group_id: "PLAN-robert-2027", provider_id: "PROV-NEICER", provider_name: "Neicer", internal_note: JSON.stringify(plan), updated_at: "2026-10-30T12:00:00Z" }] });
    };
    const response = await onRequestGet({ request: new Request("http://localhost/api/mobile/plans"), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.plans.length, 1);
    assert.equal(body.plans[0].guestName, "Robert");
    assert.equal(body.plans[0].dayCount, 6);
    assert.equal(body.plans[0].openGuestRevisionCount, 1);
    assert.equal(JSON.stringify(body.plans).includes("999"), false);
    const denied = await onRequestGet({ request: new Request("http://localhost/api/mobile/plans"), env: { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" } });
    assert.equal(denied.status, 403);
  } finally { globalThis.fetch = savedFetch; }
});

test("Guide Nest and Inquiry Studio expose the standard review handoff", () => {
  const guide = fs.readFileSync(new URL("../admin/guide/guide.mjs", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../admin/guide/guide.css", import.meta.url), "utf8");
  const guideHtml = fs.readFileSync(new URL("../admin/guide/index.html", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../services/inquiry-studio/public/index.html", import.meta.url), "utf8");
  const studioJs = fs.readFileSync(new URL("../services/inquiry-studio/public/app.js", import.meta.url), "utf8");
  assert.match(guide, /Send preliminary itinerary to MBW/);
  assert.match(guide, /actionWarning/);
  assert.match(guide, /data-lodging-price/);
  assert.match(guide, /recordGuideConfirmation: "Confirm guide review"/);
  assert.match(guide, /function rebuildGuestBreakdown/);
  assert.match(guide, /function backfillMissingGuestBreakdowns/);
  assert.match(guide, /guestAboveGuideQuote: "Profit above guide quote"/);
  assert.match(guide, /data-guest-total-for/);
  assert.match(guide, /lodgingAmount\.value = edited\.value/);
  assert.match(guide, /Their sum automatically becomes the final daily price/);
  assert.match(guide, /Lodging that night/);
  assert.match(guide, /summarizeGuestItinerary/);
  assert.match(guide, /guestBelowGuideQuote/);
  assert.match(guide, /pricing\.sellPrice = guestTotal/);
  assert.match(guide, /savePricingDay: "Save day & continue"/);
  assert.match(guide, /data-finish-pricing-day/);
  assert.match(guide, /function renderPlanWorkflow/);
  assert.match(guide, /guestBelowGuideQuote/);
  assert.match(guide, /resetGuestBreakdownConfirm/);
  assert.match(css, /--gold:#d3a126/);
  assert.match(guideHtml, /guide-20261031-v45/);
  assert.match(guide, /function renderPlanChecklist/);
  assert.match(guide, /data-shift-plan-dates/);
  assert.match(guide, /data-discard-plan/);
  assert.match(guide, /data-drag-plan-day/);
  assert.match(guide, /adminReviewWorkspace/);
  assert.match(guide, /function renderGuestRevisions/);
  assert.match(guide, /data-guest-revision-form/);
  assert.match(studio, /Custom itinerary reviews/);
  assert.match(studioJs, /\/api\/mobile\/plans/);
  assert.match(studioJs, /Prepare Guest Itinerary/);
});

test("large collaborative plans remain bounded but saveable and CRM uses the linked plan workflow", () => {
  const endpoint = fs.readFileSync(new URL("../functions/api/guide/plans/[planId].js", import.meta.url), "utf8");
  const guidePlans = fs.readFileSync(new URL("../functions/lib/guide-plans.mjs", import.meta.url), "utf8");
  const guide = fs.readFileSync(new URL("../admin/guide/guide.mjs", import.meta.url), "utf8");
  const crm = fs.readFileSync(new URL("../admin/guest-crm/index.html", import.meta.url), "utf8");
  assert.match(endpoint, /readJson\(request, 128000\)/);
  assert.doesNotMatch(endpoint, /const verified = \(await listRecords/);
  assert.match(endpoint, /crmCall\(env, "update_assignment"/);
  assert.match(guidePlans, /provider_informed:\s*"No"/);
  assert.match(guide, /Reset proportional allocation/);
  assert.match(guide, /suggestedGuestLines/);
  assert.match(crm, /Custom itinerary workflow/);
  assert.match(crm, /guidePlanForRecord/);
  assert.match(crm, /guidePlanTitle/);
  assert.match(crm, /source:\s*"guide_plan"/);
  const app = fs.readFileSync(new URL("../admin/app/app.mjs", import.meta.url), "utf8");
  assert.match(app, /planAttentionMeta/);
  assert.match(app, /Last activity:/);
  assert.match(app, /Waiting on guide/);
});

test("stored plans remain complete while staying below the guarded n8n form limit", async () => {
  const base = robertPlan({ providerId: "PROV-NEICER", providerName: "Neicer" });
  const plan = sanitizePlan({
    ...base,
    comments: [...base.comments, ...Array.from({ length: 8 }, (_, index) => ({
      id: `comment-${index}`,
      message: `Detailed bilingual planning feedback ${index}: ${"transport lodging activities and accessibility ".repeat(10)}`,
      author: "Juan",
      role: "admin",
      createdAt: "2026-10-30T12:00:00.000Z",
    }))],
  }, base);
  const assignment = await planAssignment(plan);
  const payload = JSON.stringify({ action: "update_assignment", assignment, expected_updated_at: "2026-10-30T12:00:00.000Z" });
  const wireBody = new URLSearchParams({ payload }).toString();
  assert.ok(wireBody.length < 16000, `encoded form body was ${wireBody.length} bytes`);
  const restored = await parsePlanRow({ ...assignment, updated_at: "2026-10-30T12:00:00.000Z" });
  assert.equal(restored.comments.length, plan.comments.length);
  assert.equal(restored.comments.at(-1).message, plan.comments.at(-1).message);
});

test("approved plans produce a guest-only generator draft and guides cannot fetch it", async () => {
  const base = robertPlan({ providerId: "PROV-NEICER", name: "Neicer" });
  const plan = sanitizePlan({ ...base, status: "approved", comments: [{ message: "PRIVATE COMMENT", author: "Juan", role: "admin" }], mbwPricing: {
    notes: "PRIVATE MARKUP NOTE",
    days: base.days.map(day => ({ dayId: day.id, sellPrice: 100, lodgingPrice: 25, guestLines: [
      { category: "reserve", label: { en: "Reserve fee", es: "Tarifa de reserva" }, amount: 0 },
      { category: "activity", label: { en: "Private daily activities", es: "Actividades privadas del día" }, amount: 60 },
      { category: "transportation", label: { en: "Private transportation", es: "Transporte privado" }, amount: 20 },
      { category: "lodging", label: { en: "Lodging allowance", es: "Alojamiento provisional" }, amount: 20 },
    ] })),
  } }, base);
  const draft = guestItineraryDraft(plan);
  assert.equal(draft.showItemPrices, true);
  assert.equal(draft.items.length, base.days.length * 4);
  assert.deepEqual(draft.items.slice(0, 4).map(item => item.name), ["Reserve fee", "Private daily activities", "Private transportation", "Lodging allowance"]);
  assert.equal(draft.items[0].showZeroPrice, true);
  assert.equal(draft.items[0].dayTitle, base.days[0].title.en);
  assert.equal(draft.items[0].dayDetails, base.days[0].details.en);
  assert.equal(draft.items[0].pickupLocation, base.days[0].pickupLocation.en);
  assert.equal(draft.items[0].dropoffLocation, base.days[0].dropoffLocation.en);
  assert.equal(draft.items[0].overnightCity, base.days[0].overnightCity.en);
  const serialized = JSON.stringify(draft);
  assert.equal(serialized.includes("PRIVATE COMMENT"), false);
  assert.equal(serialized.includes("PRIVATE MARKUP NOTE"), false);
  assert.equal(serialized.includes("sourceCosts"), false);

  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ ok: true, records: [{ assignment_id: "PLAN-1", assignment_kind: "tour_plan", assignment_group_id: "PLAN-robert-2027", provider_id: "PROV-NEICER", provider_name: "Neicer", internal_note: JSON.stringify(plan), updated_at: "2026-10-30T12:00:00Z" }] });
    const response = await getGuestItineraryDraft({ request: new Request("http://localhost/api/mobile/plans/robert-2027/itinerary-draft"), env, params: { planId: "robert-2027" } });
    assert.equal(response.status, 200);
    const denied = await getGuestItineraryDraft({ request: new Request("http://localhost/api/mobile/plans/robert-2027/itinerary-draft"), env: { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" }, params: { planId: "robert-2027" } });
    assert.equal(denied.status, 403);
  } finally { globalThis.fetch = savedFetch; }
});

test("itinerary generator preserves approved daily structure and itemized subtotals", () => {
  const generator = fs.readFileSync(new URL("../admin/itinerary-generator/index.html", import.meta.url), "utf8");
  assert.match(generator, /function groupMeta/);
  assert.match(generator, /function itemPriceIsVisible/);
  assert.match(generator, /dayTitleEs/);
  assert.match(generator, /dayDetailsEs/);
  assert.match(generator, /Daily subtotal/);
  assert.match(generator, /showZeroPrice/);
});
