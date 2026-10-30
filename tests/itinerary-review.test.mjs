import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { onRequestGet } from "../functions/api/mobile/plans/index.js";
import { robertPlan, sanitizePlan, sortPlanCosts } from "../functions/lib/guide-plans.mjs";

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

test("Robert plan carries the dated lodging and route review without exposing MBW pricing to guides", () => {
  const plan = robertPlan({ providerId: "PROV-NEICER", name: "Neicer" });
  assert.match(plan.comments[0].message, /primeros 3 días en Mindo/);
  assert.match(plan.comments[0].message, /desglose del alojamiento/);
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
    assert.equal(JSON.stringify(body.plans).includes("999"), false);
    const denied = await onRequestGet({ request: new Request("http://localhost/api/mobile/plans"), env: { ...env, LOCAL_TEST_IDENTITY: "guide@example.test" } });
    assert.equal(denied.status, 403);
  } finally { globalThis.fetch = savedFetch; }
});

test("Guide Nest and Inquiry Studio expose the standard review handoff", () => {
  const guide = fs.readFileSync(new URL("../admin/guide/guide.mjs", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../admin/guide/guide.css", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../services/inquiry-studio/public/index.html", import.meta.url), "utf8");
  const studioJs = fs.readFileSync(new URL("../services/inquiry-studio/public/app.js", import.meta.url), "utf8");
  assert.match(guide, /Send preliminary itinerary to MBW/);
  assert.match(guide, /actionWarning/);
  assert.match(guide, /data-lodging-price/);
  assert.match(css, /--gold:#d3a126/);
  assert.match(studio, /Custom itinerary reviews/);
  assert.match(studioJs, /\/api\/mobile\/plans/);
});
