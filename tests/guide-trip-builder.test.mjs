import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTripQuote, safeTripRequest, tripQuoteErrors } from "../functions/lib/guide-trip-builder.mjs";
import { onRequestPost as saveGuideTripQuote } from "../functions/api/guide/quotes/[assignmentId].js";

const env = {
  LOCAL_TEST_IDENTITY: "guide@example.test",
  MBW_GUIDE_ROLE_MAP: JSON.stringify({
    "guide@example.test": { role: "guide", name: "Neicer", providerName: "Neicer", providerId: "PROV-1" },
  }),
  MBW_MOBILE_WRITE_ENABLED: "true",
  N8N_CRM_ADMIN_TOKEN: "token",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
};

function validQuote() {
  return {
    guide_summary: "Recommended relaxed route.",
    options: [{
      name: "Private route",
      service_style: "private",
      days: [{
        title: "Mindo and Alambi",
        agenda: "Easy birding with vehicle access and planned rests.",
        suitability: "modified",
        accessibility_notes: "Short walks only.",
        costs: [
          { category: "guide", description: "Guide", amount: 100, quantity: 1, basis: "per_day", status: "confirmed" },
          { category: "entrance", description: "Reserve entrance", amount: 15, quantity: 2, basis: "per_person", status: "estimate" },
        ],
      }],
    }],
  };
}

test("trip quote totals are recalculated from bounded net-cost rows", () => {
  const quote = normalizeTripQuote(validQuote(), { assignmentId: "A-1", inquiryId: "I-1", studioId: "IST-1", providerId: "PROV-1", brandId: "mindo-tours" });
  assert.equal(quote.options[0].days[0].net_total, 130);
  assert.equal(quote.options[0].net_total, 130);
  assert.equal(quote.options[0].pending_cost_count, 1);
  assert.equal(quote.brand_id, "mindo-tours");
  assert.deepEqual(tripQuoteErrors(quote, true), []);
});

test("submitted trip quotes require an agenda and accessibility assessment", () => {
  const source = validQuote();
  source.options[0].days[0].agenda = "";
  source.options[0].days[0].suitability = "unknown";
  const quote = normalizeTripQuote(source);
  assert.match(tripQuoteErrors(quote, true).join(" "), /describe the agenda/i);
  assert.match(tripQuoteErrors(quote, true).join(" "), /walking suitability/i);
  assert.equal(tripQuoteErrors(quote, false).length, 0);
});

test("guide request projection excludes source messages and guest contact", () => {
  const request = safeTripRequest({
    inquiry_studio_id: "IST-1",
    source_subject: "Mindo route",
    source_message: "private@example.test +1 555 123 4567",
    request_summary: "One older traveler needs short walks.",
    guest_profile_json: JSON.stringify({ party_size: 1, age: 78, email: "private@example.test" }),
    requirements_json: JSON.stringify(["Quito pickup"]),
    proposed_days_json: JSON.stringify([{ day_number: 1, location: "Mindo", activity: "Birding" }]),
  }, { assignment_id: "A-1", inquiry_id: "I-1", internal_note: "[TRIP_BUILDER studio=IST-1 brand=mindo-tours]" });
  assert.equal(request.guestProfile.party_size, "1");
  assert.equal(request.guestProfile.age_or_group, "78");
  assert.equal(JSON.stringify(request).includes("private@example.test"), false);
  assert.equal(JSON.stringify(request).includes("555"), false);
});

test("a linked guide can save a versioned structured quote and server totals win", async () => {
  const savedFetch = globalThis.fetch;
  let studio = {
    inquiry_studio_id: "IST-1", inquiry_id: "I-1", revision: 3, guide_quotes_json: "[]", status: "awaiting_guide_quote",
  };
  let assignment = {
    assignment_id: "A-1", assignment_group_id: "QUOTE-IST-1", assignment_kind: "quote_request", inquiry_id: "I-1",
    provider_id: "PROV-1", provider_name: "Neicer", internal_note: "[TRIP_BUILDER studio=IST-1 brand=mindo-tours]", updated_at: "a1",
  };
  try {
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(new URLSearchParams(options.body).get("payload"));
      if (payload.action === "list_assignments") return Response.json({ ok: true, records: [assignment] });
      if (payload.action === "get_inquiry_studio") return Response.json({ ok: true, record: studio });
      if (payload.action === "save_inquiry_studio") { studio = payload.record; return Response.json({ ok: true, record: studio }); }
      if (payload.action === "update_assignment") { assignment = payload.assignment; return Response.json({ ok: true }); }
      throw new Error(`Unexpected action ${payload.action}`);
    };
    const supplied = validQuote();
    supplied.options[0].net_total = 99999;
    const request = new Request("http://localhost/api/guide/quotes/A-1", {
      method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "submit", studioRevision: 3, quote: supplied }),
    });
    const response = await saveGuideTripQuote({ request, env, params: { assignmentId: "A-1" } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.quote.options[0].net_total, 130);
    assert.equal(body.quote.version, 1);
    assert.equal(JSON.parse(studio.guide_quotes_json)[0].status, "submitted");
    assert.equal(assignment.guide_response, "quote_submitted");
  } finally { globalThis.fetch = savedFetch; }
});

test("guide quote save rejects stale Studio revisions", async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      const payload = JSON.parse(new URLSearchParams(options.body).get("payload"));
      if (payload.action === "list_assignments") return Response.json({ ok: true, records: [{ assignment_id: "A-1", assignment_kind: "quote_request", inquiry_id: "I-1", provider_id: "PROV-1", provider_name: "Neicer", internal_note: "[TRIP_BUILDER studio=IST-1 brand=mbw]" }] });
      if (payload.action === "get_inquiry_studio") return Response.json({ ok: true, record: { inquiry_studio_id: "IST-1", inquiry_id: "I-1", revision: 5, guide_quotes_json: "[]" } });
      throw new Error("A stale request must not write");
    };
    const request = new Request("http://localhost/api/guide/quotes/A-1", { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ mode: "draft", studioRevision: 4, quote: validQuote() }) });
    const response = await saveGuideTripQuote({ request, env, params: { assignmentId: "A-1" } });
    assert.equal(response.status, 409);
  } finally { globalThis.fetch = savedFetch; }
});

