import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const root = join(process.cwd(), "services/inquiry-studio/public");
const mime = path => ({ ".html": "text/html", ".css": "text/css", ".js": "text/javascript" })[extname(path)] || "application/octet-stream";

test("Inquiry Studio separates guide costs from private admin pricing and shows the approval workflow", async () => {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const relative = url.pathname.replace(/^\/inquiry-studio\/?/, "") || "index.html";
      const path = normalize(join(root, relative));
      if (!path.startsWith(root) || !(await stat(path)).isFile()) throw new Error("missing");
      response.writeHead(200, { "content-type": mime(path) }); response.end(await readFile(path));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const quote = {
    quote_id: "GQ-1", version: 1, status: "submitted", admin_status: "approved", provider_name: "Neicer", brand_id: "mindo-tours",
    options: [{ option_id: "OPT-1", name: "Private route", net_total: 175, days: [{
      day_id: "DAY-1", day_number: 1, date: "2027-02-09", title: "Mindo", agenda: "Easy birding", start_location: "Quito", end_location: "Mindo",
      walking_minutes: 30, longest_walk_minutes: 10, suitability: "yes", costs: [
        { cost_id: "C-G", category: "guide", description: "Guide", amount: 100, quantity: 1, basis: "per_day", status: "confirmed" },
        { cost_id: "C-H", category: "accommodation", description: "Mindo lodging", amount: 75, quantity: 1, basis: "per_room_night", status: "confirmed" },
      ],
    }]}],
  };
  const record = {
    inquiry_studio_id: "IST-1", inquiry_id: "INQ-1", guest_id: "G-1", revision: 4, status: "guide_quote_approved",
    inquiry_complexity: "custom_tour", request_summary: "One traveler needs a private Mindo itinerary.", guest_profile_json: JSON.stringify({ party_size: 1 }),
    requested_dates_json: JSON.stringify(["2027-02-09"]), requirements_json: "[]", unknowns_json: "[]", assumptions_json: "[]", validation_flags_json: "[]",
    proposed_days_json: JSON.stringify([{ day_number: 1, date: "2027-02-09", location: "Mindo", activity: "Easy birding", pricing_needed: ["guide", "lodging"] }]),
    guide_quotes_json: JSON.stringify([quote]), final_plan_json: JSON.stringify({
      quote_id: "GQ-1", quote_version: 1, net_options: quote.options, pricing_status: "ready",
      selected_option_id: "OPT-1", sell_prices: { "C-G": 130, "C-H": 75 },
      admin_days: [{ day_id: "DAY-1", date: "2027-02-09", title: "Mindo", agenda: "Easy birding" }],
      workflow: { stage: "admin_proposal", events: [] },
    }),
    handoff_json: JSON.stringify({ case_context: {
      case_owner: { name: "Juan", phone: "+1 555 0100" }, guest_timezone: "Australia/Perth",
      budget_ceiling: 2500, confirmed_facts: ["Two nights in Mindo"], open_decisions: ["Choose Mindo room"],
      commitments: ["Juan will confirm lodging"], next_action: "Call Robert",
      accommodations: [{ location: "Intag", property: "El Refugio", check_in: "2027-02-11", check_out: "2027-02-13", net_total: 200, deposit_percent: 50, status: "available" }],
      suppliers: [{ supplier_id: "SUP-1", name: "Neicer", role: "guide", service: "Private guiding", service_date: "2027-02-09", net_cost: 80, availability: "available", status: "quoted", verified_at: "2026-11-04", valid_until: "2026-12-04", evidence_source: "WhatsApp 2026-11-04" }],
    }, sent_artifacts: [{ action: "mark_preliminary_sent", created_at: "2026-11-04T12:00:00Z", sell_total: 205, quote_id: "GQ-1", quote_version: 1, sha256: "abc123" }] }), guide_responses_json: "[]", guest_reply_draft: "Reply", guide_brief_draft: "Brief",
  };
  await page.route(`http://127.0.0.1:${port}/inquiry-studio/api/session`, route => route.fulfill({ json: { token: "test" } }));
  await page.route(`http://127.0.0.1:${port}/inquiry-studio/api/inquiries`, route => route.fulfill({ json: { source: { imported_at: new Date().toISOString() }, sync: { ok: true }, records: [{ inquiry_id: "INQ-1", inquiry_studio_id: "IST-1", full_name: "Robert", status: "planning", message_questions: "Custom Mindo trip" }] } }));
  await page.route(`http://127.0.0.1:${port}/inquiry-studio/api/providers`, route => route.fulfill({ json: { providers: [{ provider_id: "P-1", provider_name: "Neicer" }] } }));
  await page.route(`http://127.0.0.1:${port}/inquiry-studio/api/studio/INQ-1`, route => route.fulfill({ json: record }));
  await page.route(`http://127.0.0.1:${port}/inquiry-studio/api/interactions`, route => route.fulfill({ json: { ok: true, records: [{ interaction_id: "INT-1", occurred_at: "2026-11-04T10:00:00Z", direction: "incoming", channel: "email", interaction_type: "guest_message", note: "Robert confirmed the lodging sequence.", external_message_id: "gmail-1" }] } }));
  await page.route(`http://127.0.0.1:${port}/inquiry-studio/api/knowledge`, route => route.fulfill({ json: { ok: true, items: [{ name: "Neicer", role: "guide", service: "Private guiding", net_cost: 80, verified_at: "2026-11-04", valid_until: "2026-12-04", reuse_rule: "Reverify price and availability before every proposal" }] } }));
  try {
    await page.goto(`http://127.0.0.1:${port}/inquiry-studio/`);
    await page.getByRole("button", { name: /Robert/ }).click();
    await page.getByRole("button", { name: "Analyze full request" }).click();
    await page.getByText("Admin proposal and handoff").waitFor();
    assert.match(await page.locator("#tourWorkflow").innerText(), /Tourist inquiry[\s\S]*Deposit[\s\S]*Operations[\s\S]*Completed/);
    assert.equal(await page.locator('[data-cost-id="C-G"] [data-sell-price]').inputValue(), "130.00");
    assert.equal(await page.locator('[data-cost-id="C-H"] [data-sell-price]').inputValue(), "75.00");
    assert.equal(await page.locator("#adminNetTotal").innerText(), "$175.00");
    assert.equal(await page.locator("#adminSellTotal").innerText(), "$205.00");
    assert.match(await page.locator("#adminProposal").innerText(), /Gross profit[\s\S]*\$30\.00/);
    assert.equal(await page.locator("#caseOwnerName").inputValue(), "Juan");
    assert.equal(await page.locator("#guestTimezone").inputValue(), "Australia/Perth");
    assert.equal(await page.locator("#budgetCeiling").inputValue(), "2500");
    assert.equal(await page.locator('[data-lodging="property"]').inputValue(), "El Refugio");
    assert.equal(await page.locator(".depositPreview").innerText(), "Deposit $100.00");
    assert.equal(await page.locator('[data-supplier="name"]').inputValue(), "Neicer");
    await page.locator("#knowledgeItems .knowledgeItem").waitFor({ state: "attached" });
    assert.match(await page.locator("#interactionRows").innerText(), /Robert confirmed the lodging sequence/);
    assert.match(await page.locator("#sentArtifacts").innerText(), /Immutable sent snapshots[\s\S]*SHA-256 abc123/);
    assert.match(await page.locator("#knowledgeItems").textContent(), /Private guiding[\s\S]*Reverify/);
    await assert.doesNotReject(() => page.getByRole("button", { name: "Open in itinerary generator" }).waitFor());
    await page.getByRole("button", { name: "Open in itinerary generator" }).click();
    const handoff = await page.evaluate(() => JSON.parse(localStorage.getItem("mbwItineraryGeneratorDraft")));
    assert.deepEqual(handoff.items.map(item => [item.type, item.unitPrice]), [["Custom", 130], ["Accommodation", 200]]);
    assert.doesNotMatch(await page.locator("#tripGuideStatus").count().then(() => page.locator("body").innerText()), /private@example/);
    await page.screenshot({ path: "/tmp/mbw-inquiry-studio-workflow.png", fullPage: true });
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
