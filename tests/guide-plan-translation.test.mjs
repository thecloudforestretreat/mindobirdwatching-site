import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { onRequestPost as translateGuidePlan } from "../functions/api/guide/plans/[planId]/translate.js";
import { parsePlanRow, planAssignment, robertPlan } from "../functions/lib/guide-plans.mjs";
import { planTranslationSource, validatePlanTranslation } from "../functions/lib/guide-plan-translation.mjs";

const env = {
  LOCAL_TEST_IDENTITY: "owner@example.test",
  MBW_MOBILE_ROLE_MAP: JSON.stringify({ "owner@example.test": { role: "owner", name: "Juan Pablo" } }),
  MBW_GUIDE_ROLE_MAP: JSON.stringify({ "neicer@example.test": { role: "guide", name: "Neicer", providerName: "Neicer", providerIds: ["PROV-NEICER"] } }),
  N8N_CRM_ADMIN_TOKEN: "test-token",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
  CRM_SUMMARY_TOKEN: "local-ai-test-token",
};

const translated = source => ({
  title: "Robert · Updated custom itinerary",
  brief: {
    traveler: "Age 78 · reasonably healthy · no long hikes",
    lodging: "2–3 star lodging",
    pickup: "Airport hotel",
    dropoff: "Quito airport",
    request: "Spend the first three days in Mindo and the following two days farther north.",
    interests: "Birding, Mindo, Intag, and Otavalo",
  },
  days: source.days.map(day => ({
    id: day.id,
    title: `Translated ${day.title}`,
    details: `Translated ${day.details}`,
    pickupLocation: `Translated ${day.pickupLocation}`,
    dropoffLocation: `Translated ${day.dropoffLocation}`,
    overnightCity: `Translated ${day.overnightCity}`,
    costNote: day.costNote ? `Translated ${day.costNote}` : "",
  })),
});

test("Robert's guest revision keeps two nights each in Mindo and Intag before Otavalo", () => {
  const plan = robertPlan({ providerId: "PROV-NEICER", name: "Neicer" });
  assert.deepEqual(plan.days.map(day => day.overnightCity.en), ["Mindo", "Mindo", "Intag", "Intag", "Otavalo", "Quito · guest-arranged lodging"]);
  assert.match(plan.days[2].details.en, /Las Cotingas/);
  assert.equal(plan.days[2].originalCost, 0);
  assert.equal(plan.days[3].overnightCity.es, "Intag");
  assert.equal(plan.days[3].originalCost, 0);
  assert.match(plan.days[3].costNote.es, /pendientes de cotización/);
  assert.equal(plan.days[4].overnightCity.es, "Otavalo");
  assert.equal(plan.days[4].originalCost, 0);
  assert.match(plan.days[4].costNote.en, /Do not quote a train/);
  assert.equal(plan.guestRevisions[0].status, "sent_to_guide");
  assert.match(plan.brief.lodging.en, /maximum \$70/);
});

test("translation validation requires exactly the saved day IDs", () => {
  const source = planTranslationSource(robertPlan());
  const result = validatePlanTranslation(translated(source), source.days.map(day => day.id));
  assert.equal(result.days.length, 6);
  assert.throws(() => validatePlanTranslation({ ...translated(source), days: translated(source).days.slice(1) }, source.days.map(day => day.id)), /translated days/);
});

test("the saved Robert draft receives the guest route revision and invalidates affected prices", async () => {
  const legacy = robertPlan({ providerId: "PROV-NEICER", name: "Neicer" });
  legacy.routeRevision = "";
  legacy.days[2] = { ...legacy.days[2], title: { es: "Ruta anterior", en: "Previous route" }, originalCost: 415 };
  legacy.mbwPricing = { currency: "USD", days: legacy.days.map(day => ({ dayId: day.id, sellPrice: day.id === "day-3" ? 555 : 0, lodgingPrice: 0, guestLines: [] })) };
  const row = { ...await planAssignment(legacy), assignment_id: "PLAN-LEGACY", updated_at: "v-old" };
  const migrated = await parsePlanRow(row);
  assert.equal(migrated.routeRevision, "guest-2026-10-31-v3");
  assert.match(migrated.days[2].title.es, /Intag/);
  assert.equal(migrated.days[2].originalCost, 0);
  assert.equal(migrated.mbwPricing.days.find(item => item.dayId === "day-3").sellPrice, 0);
  assert.equal(migrated.status, "changes_requested");
  assert.equal(migrated.comments.filter(item => item.id === "neicer-robert-route-2026-10-30-v2").length, 1);
  assert.equal(migrated.guestRevisions.filter(item => item.id === "guest-robert-route-2026-10-31-v1").length, 1);
});

test("only an administrator can request a read-only local translation", async t => {
  const plan = robertPlan({ providerId: "PROV-NEICER", name: "Neicer" });
  const assignment = await planAssignment(plan);
  const row = { ...assignment, assignment_id: "PLAN-ROW", updated_at: "v1" };
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push(String(url));
    if (String(url).endsWith("mbw-guide-plan-local-translate")) {
      const source = JSON.parse(options.body).source;
      return Response.json({ result: translated(source), model: "gpt-oss:20b" });
    }
    const payload = JSON.parse(new URLSearchParams(options.body).get("payload"));
    assert.equal(payload.action, "list_assignments");
    return Response.json({ ok: true, records: [row] });
  });
  const request = new Request("http://localhost/api/guide/plans/robert-2027/translate", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ updatedAt: "v1" }) });
  const response = await translateGuidePlan({ request, env, params: { planId: "robert-2027" } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.model, "gpt-oss:20b");
  assert.equal(body.reviewRequired, true);
  assert.equal(body.translation.days[2].id, "day-3");
  assert.equal(calls.filter(url => url.endsWith("mbw-guide-plan-local-translate")).length, 1);

  const denied = await translateGuidePlan({ request: new Request("http://localhost/api/guide/plans/robert-2027/translate", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: "{}" }), env: { ...env, LOCAL_TEST_IDENTITY: "neicer@example.test" }, params: { planId: "robert-2027" } });
  assert.equal(denied.status, 403);
});

test("Guide Nest automatically refreshes stale English only inside admin review", () => {
  const script = fs.readFileSync(new URL("../admin/guide/guide.mjs", import.meta.url), "utf8");
  assert.match(script, /function englishTranslationNeeded/);
  assert.match(script, /function maybeAutoTranslatePlans/);
  assert.match(script, /if \(!isAdminReview\(\) \|\| language !== "en"\) return/);
  assert.doesNotMatch(script, /data-translate-plan="/);
  assert.match(script, /\/translate`,/);
});
