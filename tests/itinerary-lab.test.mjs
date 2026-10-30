import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/itinerary-lab/index.js";
import { knowledgeAssignment, knowledgeValidation, parseKnowledgeRow, seedKnowledge } from "../functions/lib/itinerary-knowledge.mjs";

const env = {
  LOCAL_TEST_IDENTITY: "owner@example.test",
  MBW_MOBILE_ROLE_MAP: JSON.stringify({ "owner@example.test": { role: "owner", staffCode: "JPG", name: "Juan" }, "agent@example.test": { role: "agent", staffCode: "SS" } }),
  MBW_MOBILE_WRITE_ENABLE: "true", N8N_CRM_ADMIN_TOKEN: "test-token", N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
};
const payload = options => JSON.parse(new URLSearchParams(options.body).get("payload"));
const post = body => new Request("http://localhost/api/itinerary-lab/", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify(body) });

test("Itinerary Lab seeds Robert and the reviewed Ecuador PDF as structured private sources", () => {
  const seeds = seedKnowledge(), pdf = seeds.find(item => item.sourceId === "ecuador-inmersion-voyages-de-reve");
  assert.equal(seeds.length, 2); assert.equal(pdf.durationDays, 23); assert.equal(pdf.blocks.length, 17); assert.equal(pdf.rights, "public_facts_only");
  assert.ok(pdf.blocks.some(item => item.dayStart === "19" && item.dayEnd === "23"));
  assert.match(pdf.gaps.join(" "), /No prices/);
});

test("knowledge records serialize evidence without customer prices or guide-plan margins", () => {
  const record = seedKnowledge()[1], assignment = knowledgeAssignment(record), parsed = parseKnowledgeRow({ ...assignment, assignment_id: "KNOW-1", updated_at: "k1" });
  assert.equal(parsed.title, "Ecuador en Inmersion"); assert.equal(parsed.blocks.length, 17); assert.doesNotMatch(assignment.internal_note, /markup|sellPrice|mbwPricing/i);
  assert.deepEqual(knowledgeValidation(parsed), []);
});

test("Itinerary Lab is owner-only and persists one verified final save", async () => {
  const savedFetch = globalThis.fetch; let rows = []; let writes = 0;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = payload(options);
      if (body.action === "list_assignments") return Response.json({ ok: true, records: rows });
      if (body.action === "create_assignment") { writes += 1; rows = [{ ...body.assignment, assignment_id: "KNOW-1", updated_at: "k1" }]; return Response.json({ ok: true }); }
      throw new Error(`Unexpected ${body.action}`);
    };
    let response = await onRequestGet({ request: new Request("http://localhost/api/itinerary-lab/"), env });
    let result = await response.json(); assert.equal(response.status, 200); assert.equal(result.records.length, 2);
    const record = { ...result.records[1], status: "needs_review" };
    response = await onRequestPost({ request: post({ expectedUpdatedAt: "", record }), env }); result = await response.json();
    assert.equal(response.status, 201); assert.equal(result.verified, true); assert.equal(writes, 1); assert.equal(result.record.synthetic, false);
    response = await onRequestGet({ request: new Request("http://localhost/api/itinerary-lab/"), env: { ...env, LOCAL_TEST_IDENTITY: "agent@example.test" } });
    assert.equal(response.status, 403);
  } finally { globalThis.fetch = savedFetch; }
});

test("approval requires rights, itinerary blocks and source evidence", () => {
  const record = { ...seedKnowledge()[1], rights: "unverified", blocks: [{ ...seedKnowledge()[1].blocks[0], evidence: "" }] };
  assert.deepEqual(knowledgeValidation(record), ["Confirm how MBW may use this source.", "Block 1 needs a source reference."]);
});
