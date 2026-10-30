import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const root = join(process.cwd(), "admin");
let record = {
  inquiryId: "INQ-20261023224230-9029", guestId: "G-MT-1", name: "Test Testerer", country: "United States", countryCode: "US", brand: "MT",
  phone: "+13055550123", email: "test@example.test", partySize: "2", assignedTo: "JPG", status: "payment_pending", effectiveStatus: "payment_pending",
  paymentStatus: "payment_pending", requestedDate: "2026-10-22", requestedDateEnd: "2026-10-22", followupDate: "2026-10-21", updatedAt: "2026-10-20T14:00:00Z",
  tours: [{ id: "T-1", tour: "Mindo Tours Test", product: "MBW006 - Quest for Five Toucans & the Andean Cock-of-the-Rock", date: "2026-10-22", guests: "2", status: "payment_pending" }],
};
const completedRecord = { ...record, inquiryId: "I-CLOSED-1", guestId: "G-CLOSED-1", name: "Completed Guest", status: "completed", effectiveStatus: "completed", requestedDate: "2026-10-19", tours: [{ id: "C-1", tour: "Completed Tour", date: "2026-10-19", guests: "2", status: "completed" }] };
let createdRecord = null;
let interactions = [];
const schedule = [
  { inquiryId: record.inquiryId, guest: record.name, date: "2026-10-22", startTime: "05:00", tour: "Quoted Birding", partySize: "2", pickup: "Mindo", source: "itinerary", status: "quoted", risk: "No assignment" },
  { inquiryId: record.inquiryId, guest: record.name, date: "2026-10-23", startTime: "19:00", tour: "Confirmed Night Walk", partySize: "2", pickup: "Mindo", source: "assignment", status: "confirmed", risk: "" },
  { inquiryId: completedRecord.inquiryId, guest: completedRecord.name, date: "2026-10-24", startTime: "08:00", tour: "Completed Tour", partySize: "2", pickup: "Mindo", source: "assignment", status: "completed", risk: "" },
];
const readiness = () => record.tours.map(item => ({
  serviceId: item.id, status: item.status, ready: false, readyCount: 1, totalCount: item.status === "booked" ? 5 : 2,
  nextAction: item.status === "booked" ? "$ needed" : item.status === "payment_pending" ? "$ needed" : "After quote", nextSection: "payments",
  checks: item.status === "booked"
    ? [{ id: "date", label: "Date", state: "complete", evidence: "Set" }, { id: "payment", label: "Payment", state: "attention", evidence: "$ needed" }, { id: "provider", label: "Provider", state: "attention", evidence: "Assign" }, { id: "time", label: "Time", state: "attention", evidence: "Set time" }, { id: "confirmation", label: "Confirmation", state: "attention", evidence: "Send" }]
    : [{ id: "date", label: "Date", state: "complete", evidence: "Set" }, { id: "payment", label: "Payment", state: "attention", evidence: "$ needed" }],
}));

const mime = path => ({ ".html": "text/html", ".css": "text/css", ".mjs": "text/javascript", ".js": "text/javascript", ".png": "image/png", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" })[extname(path)] || "application/octet-stream";

test("mobile pipeline keeps context, navigation and payment tools usable", async () => {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      let path = normalize(join(root, decodeURIComponent(url.pathname)));
      if (url.pathname.endsWith("/")) path = join(path, "index.html");
      if (!path.startsWith(root) || !(await stat(path)).isFile()) throw new Error("missing");
      response.writeHead(200, { "content-type": mime(path) }); response.end(await readFile(path));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port, browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }), context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), page = await context.newPage();
  await context.route("https://mindobirdwatching.com/book-tour/create/**", route => route.fulfill({ contentType: "text/html", body: "<title>Mock Stripe invoice builder</title>" }));
  await page.route(`http://127.0.0.1:${port}/api/mobile/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/session")) return route.fulfill({ json: { ok: true, identity: { email: "owner@example.test", name: "Juan", role: "owner" }, capabilities: { write: true } } });
    if (path.endsWith("/bootstrap")) {
      await new Promise(resolve => setTimeout(resolve, 700));
      return route.fulfill({ json: { ok: true, checkedAt: "2026-10-20T15:00:00Z", actions: [{ inquiryId: record.inquiryId, type: "follow-up", priority: 0, reason: "Follow-up due", owner: "JPG" }], today: [], upcoming: schedule, providers: [{ providerId: "PROV-CHICHO", name: "Chicho", role: "guide", serviceType: "Birdwatching", isDefault: true, active: true }, { providerId: "PROV-NEICER", name: "Neicer", role: "guide", serviceType: "Birdwatching", active: true }], customPlans: [{ planId: "robert-2027", inquiryId: record.inquiryId, providerId: "PROV-NEICER", providerName: "Neicer", guestName: "Robert", title: { en: "Robert’s private Ecuador itinerary", es: "Robert · Itinerario personalizado en Ecuador" }, startDate: "2027-02-09", endDate: "2027-02-14", status: "admin_review", updatedAt: "2026-10-29T20:00:00Z" }], recentGuests: [record, completedRecord], inquiries: [record, completedRecord], bookings: [] } });
    }
    if (path.endsWith("/guests") && route.request().method() === "POST") {
      const payload = route.request().postDataJSON().guest;
      createdRecord = { inquiryId: "I-MANUAL-1", guestId: "G-MANUAL-1", name: payload.full_name, phone: payload.phone_number || "", email: payload.email || "", country: payload.country || "", partySize: payload.guest_count, status: "new", effectiveStatus: "new", followupDate: payload.followup_date, requestedDate: payload.requested_date, updatedAt: "manual1", tours: payload.tour ? [{ id: "M-1", tour: payload.tour, date: payload.requested_date, guests: payload.guest_count, status: "planning" }] : [] };
      return route.fulfill({ status: 201, json: { ok: true, verified: true, returningGuest: false, record: createdRecord } });
    }
    if (path.endsWith(`/guests/${record.inquiryId}/services`) && route.request().method() === "POST") {
      const payload = route.request().postDataJSON(), service = { id: "T-2", tour: payload.service.tour, product: payload.service.product_selected, serviceType: payload.service.service_type, date: payload.service.date, guests: payload.service.guests, status: payload.service.status, pickup: payload.service.pickup_location };
      record = { ...record, tours: [...record.tours, service], updatedAt: "2026-10-20T15:02:00Z" };
      return route.fulfill({ json: { ok: true, verified: true, record, service } });
    }
    if (path.endsWith(`/guests/${record.inquiryId}/services/T-1`) && route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON();
      record = { ...record, tours: record.tours.map(item => item.id === "T-1" ? { ...item, status: payload.status } : item), updatedAt: "2026-10-20T15:01:00Z" };
      return route.fulfill({ json: { ok: true, verified: true, record, service: record.tours[0] } });
    }
    if (path.endsWith(`/guests/${record.inquiryId}/interactions`) && route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      const interaction = { interactionId: `INT-${interactions.length + 1}`, channel: payload.channel, direction: payload.direction, type: payload.type, note: payload.note, occurredAt: payload.occurredAt, createdBy: "JPG" };
      interactions.push(interaction);
      return route.fulfill({ status: 201, json: { ok: true, verified: true, record: interaction } });
    }
    if (path.endsWith(`/guests/${record.inquiryId}`) && route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON();
      record = { ...record, requestedDate: payload.patch.requested_date_start, requestedDateEnd: payload.patch.requested_date_end, updatedAt: "2026-10-20T15:03:00Z" };
      return route.fulfill({ json: { ok: true, verified: true, record } });
    }
    if (path.endsWith(`/guests/${record.inquiryId}`)) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return route.fulfill({ json: { ok: true, record, readiness: readiness(), journey: [{ id: "contact", label: "Contact", state: "complete", evidence: "Contacted" }, { id: "payment", label: "Payment", state: "attention", evidence: "Payment pending" }], data: { interactions, assignments: [], bookings: [], payments: [] } } });
    }
    if (createdRecord && path.endsWith(`/guests/${createdRecord.inquiryId}`)) return route.fulfill({ json: { ok: true, record: createdRecord, journey: [{ id: "contact", label: "Contact", state: "attention", evidence: "Response not logged" }], data: { interactions: [], assignments: [], bookings: [], payments: [] } } });
    return route.fulfill({ status: 404, json: { ok: false, error: "Not found" } });
  });
  try {
    await page.goto(`http://127.0.0.1:${port}/app/`);
    await page.locator(".loadingReveal").waitFor({ state: "visible" });
    assert.equal(await page.locator(".loadingBird").count(), 0);
    assert.match(await page.locator(".loadingReveal img").evaluate(element => getComputedStyle(element).clipPath), /^inset\(0px 0px /, "gold logo should reveal from top to bottom");
    assert.equal(await page.locator(".loadingReveal img").isVisible(), true);
    assert.match(await page.locator(".appHeader .brand img").getAttribute("src"), /mbw-header-logo-160\.png/);
    assert.ok((await page.locator(".appHeader .brand img").boundingBox()).width >= 60, "header logo should have a strong mobile presence");
    assert.equal(await page.locator(".appHeader .brand small").innerText(), "NEST");
    await page.screenshot({ path: "/tmp/mbw-loader-mobile-qa.png", fullPage: false });
    const card = page.locator(".actionCard").first(); await card.waitFor({ state: "visible" });
    assert.deepEqual(await page.locator("#actionRepFilter option").allTextContents(), ["Rep: All", "Unassigned", "JPG", "SS"]);
    assert.match(await page.locator("#connectionState").innerText(), /Synced now/);
    assert.match(await card.innerText(), /Test Testerer/); assert.match(await card.innerText(), /MT/); assert.match(await card.innerText(), /🇺🇸/);
    assert.equal(await page.getByRole("heading", { name: "Plans needing attention", exact: true }).isVisible(), true);
    assert.match(await page.locator("#planAttentionPanel").innerText(), /Guide submitted this itinerary for admin review/);
    assert.doesNotMatch(await page.locator("#planAttentionPanel").innerText(), /markup|margin|price|cost/i);
    const reviewPlanUrl = new URL(await page.getByText("Review plan", { exact: true }).getAttribute("href"), page.url());
    assert.equal(reviewPlanUrl.searchParams.get("plan"), "robert-2027");
    assert.match(await card.innerText(), /F\/U\s+Tomorrow/i); assert.doesNotMatch(await card.innerText(), /\bSOON\b|\bNURTURE\b/);
    assert.equal(await page.locator("[data-summary-filter]").count(), 3); await page.locator('[data-summary-filter="followups"]').click(); assert.equal(await page.locator(".actionCard").count(), 1);
    await page.locator('#bottomNav [data-route="guests"]').click();
    assert.deepEqual(await page.locator("#guestRepFilter option").allTextContents(), ["Rep: All", "Unassigned", "JPG", "SS"]);
    assert.equal(await page.locator(".guestCard").count(), 1, "closed guests should stay out of the default list");
    await page.locator("#newGuestButton").click();
    assert.equal(await page.locator('#newGuestForm select[name="assigned_to"]').inputValue(), "", "new leads should default to Unassigned");
    await page.screenshot({ path: "/tmp/mbw-new-guest-mobile-qa.png", fullPage: false });
    await page.locator('#newGuestForm input[name="full_name"]').fill("Manual Guest");
    await page.locator('#newGuestForm input[name="email"]').fill("manual@example.test");
    await page.locator('#newGuestForm input[name="tour"]').fill("Night Walk");
    await page.locator('#newGuestForm input[name="requested_date"]').fill("2026-11-12");
    await page.locator('#newGuestForm button[type="submit"]').click();
    await page.getByText("Guest created and verified.", { exact: true }).waitFor({ state: "visible" });
    await page.getByText("Manual Guest", { exact: true }).first().waitFor({ state: "visible" });
    assert.equal(await page.locator("#profileForm").count(), 1);
    await page.locator("#closeGuest").click();
    const guestBox = await page.locator(".guestCard").first().boundingBox(); assert.ok(guestBox && guestBox.x + guestBox.width <= 390);
    await page.locator("#guestMoreStatusFilter").selectOption("completed");
    assert.equal(await page.locator(".guestCard").count(), 1); assert.match(await page.locator(".guestCard").innerText(), /Completed Guest/);
    await page.screenshot({ path: "/tmp/mbw-guests-mobile-qa.png", fullPage: false });
    await page.locator("#guestRepFilter").selectOption("all");
    await page.locator('#bottomNav [data-route="today"]').click();
    assert.equal(await page.getByRole("heading", { name: "Guide View", exact: true }).isVisible(), true);
    assert.deepEqual(await page.locator("#guideViewSelect option").allTextContents(), ["Select a guide", "Chicho", "Neicer"]);
    assert.equal(await page.locator("#guideViewLink").getAttribute("aria-disabled"), "true");
    await page.locator("#guideViewSelect").selectOption("PROV-NEICER");
    const guideViewUrl = new URL(await page.locator("#guideViewLink").getAttribute("href"), page.url());
    assert.equal(guideViewUrl.pathname, "/guide/");
    assert.equal(guideViewUrl.searchParams.get("provider"), "PROV-NEICER");
    assert.equal(await page.locator("#todayList .todayCard").count(), 2, "completed services should be hidden from operations");
    const todayText = await page.locator("#todayList").innerText(); assert.match(todayText, /Oct 22, 2026/); assert.match(todayText, /Oct 23, 2026/); assert.doesNotMatch(todayText, /Completed Tour/);
    assert.equal(await page.locator("#todayList .statusBadge.status-quoted").count(), 1); assert.equal(await page.locator("#todayList .statusBadge.status-confirmed").count(), 1);
    await page.screenshot({ path: "/tmp/mbw-today-mobile-qa.png", fullPage: true });
    await page.locator('#bottomNav [data-route="actions"]').click();
    await card.click();
    assert.equal(await page.locator("#guestQueuePosition").innerText(), "1 of 1");
    assert.equal(await page.locator("#previousGuest").isDisabled(), true);
    assert.equal(await page.locator("#nextGuest").isDisabled(), true);
    await page.locator(".detailLoading").waitFor({ state: "visible" });
    await page.locator(".detailContactMeta").waitFor({ state: "visible" });
    assert.match(await page.locator(".detailHero").innerText(), /United States/);
    for (const value of ["Payment Pending", "Mindo Tours Test", "2 guests · 1 service", "Tour Oct 22, 2026", "F/U"]) assert.match(await page.locator(".detailHero").innerText(), new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await page.getByText("Edit guest details", { exact: true }).click();
    assert.equal(await page.locator('#profileForm input[name="first_name"]').inputValue(), "Test");
    assert.equal(await page.locator('#profileForm input[name="last_name"]').inputValue(), "Testerer");
    assert.deepEqual(await page.locator('#profileForm select[name="assigned_to"] option').allTextContents(), ["Unassigned", "SS", "JPG"]);
    assert.equal(await page.locator('#profileForm select[name="assigned_to"]').inputValue(), "JPG");
    const emailWidth = (await page.locator('#profileForm input[name="email"]').boundingBox()).width, phoneWidth = (await page.locator('#profileForm input[name="phone_number"]').boundingBox()).width;
    assert.ok(emailWidth > phoneWidth * 1.7, "email should use the full form width");
    for (const pair of [["first_name","last_name"],["phone_number","country"],["assigned_to","guest_count"]]) { const left = await page.locator(`#profileForm [name="${pair[0]}"]`).boundingBox(), right = await page.locator(`#profileForm [name="${pair[1]}"]`).boundingBox(); assert.equal(left.y, right.y, `${pair.join(" / ")} should share a row`); }
    await page.locator('#profileForm input[name="email"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/mbw-guest-profile-qa.png", fullPage: false });
    await page.getByText("Next action").waitFor({ state: "visible" });
    assert.equal(await page.getByText("Services & readiness", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("Custom itinerary", { exact: true }).isVisible(), true);
    const customPlanHref = await page.getByText("Open itinerary workspace", { exact: true }).getAttribute("href");
    const customPlanUrl = new URL(customPlanHref, page.url());
    assert.equal(customPlanUrl.pathname, "/guide/");
    assert.equal(customPlanUrl.searchParams.get("provider"), "PROV-NEICER");
    assert.equal(customPlanUrl.searchParams.get("plan"), "robert-2027");
    assert.doesNotMatch(await page.locator(".customPlanCard").innerText(), /markup|margin|price|cost/i);
    assert.match(await page.locator(".customPlanCard").innerText(), /Dates need review/);
    assert.equal(await page.locator(".serviceReadiness").count(), 1);
    assert.match(await page.locator(".serviceReadiness").innerText(), /Payment.*\$ needed/s);
    assert.equal(await page.getByText("Add another tour, activity, or transfer", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("Add guide, driver, or provider", { exact: true }).count(), 0, "provider assignment should stay locked until a service is booked");
    assert.equal(await page.getByText("Provider assignments become available when a service is Booked.", { exact: true }).isVisible(), true);
    assert.equal(await page.locator(".dialogNav").isVisible(), true);
    const journeySection = page.locator("details", { hasText: "Guest Journey" });
    assert.equal(await journeySection.getAttribute("open"), "");
    await journeySection.locator("summary").click(); assert.equal(await journeySection.getAttribute("open"), null);
    await journeySection.locator("summary").click(); assert.equal(await journeySection.getAttribute("open"), "");
    await page.screenshot({ path: "/tmp/mbw-guest-journey-actions-qa.png", fullPage: false });
    await page.locator('.serviceStatusForm select[name="status"]').first().selectOption("booked");
    await page.locator(".serviceStatusForm button").first().click();
    await page.getByText("Service status saved and verified.", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await page.locator('.serviceStatusForm select[name="status"]').first().evaluate(element => element.value), "booked");
    assert.match(await page.locator(".serviceReadiness").first().innerText(), /Provider.*Assign/s);
    for (const label of ["WhatsApp", "Generate Email", "Create Stripe Invoice", "Create Zelle Invoice"]) assert.equal(await page.locator(".pipelineSection").getByText(label, { exact: true }).isVisible(), true);
    const sectionBox = await page.locator('[data-section="follow-up"]').boundingBox(), dateBox = await page.locator('#followupForm input[name="followup_date"]').boundingBox();
    assert.ok(sectionBox && dateBox && dateBox.x >= sectionBox.x && dateBox.x + dateBox.width <= sectionBox.x + sectionBox.width + 1);
    const stripe = await page.locator(".pipelineSection").getByText("Create Stripe Invoice", { exact: true }).getAttribute("href");
    assert.match(stripe, /inquiry_id=INQ-20261023224230-9029/); assert.match(stripe, /guest=Test\+Testerer/);
    const emailHref = await page.locator(".pipelineSection").getByText("Generate Email", { exact: true }).getAttribute("href");
    const itineraryHref = await page.getByText("Generate Itinerary", { exact: true }).getAttribute("href");
    const confirmationHref = await page.getByText("Create Confirmation", { exact: true }).getAttribute("href");
    for (const href of [emailHref, itineraryHref, confirmationHref]) { const params = new URL(href, page.url()).searchParams; assert.equal(params.get("inquiry_id"), "INQ-20261023224230-9029"); assert.equal(params.get("guest"), "Test Testerer"); assert.equal(JSON.parse(params.get("tour_items_json")).length, 1); }
    assert.equal(new URL(itineraryHref, page.url()).searchParams.get("source"), "guest_crm");
    const itineraryPage = await context.newPage(); await itineraryPage.goto(new URL(itineraryHref, page.url()).href); await itineraryPage.locator("#guestName").waitFor({ state: "visible" });
    assert.equal(await itineraryPage.locator("#guestName").inputValue(), "Test Testerer"); assert.equal(await itineraryPage.locator("#guestEmail").inputValue(), "test@example.test"); assert.equal(await itineraryPage.locator("#startDate").inputValue(), "2026-10-22"); assert.ok(await itineraryPage.locator(".itemEditor").count() > 0); await itineraryPage.close();
    await page.getByText("Add guide, driver, or provider", { exact: true }).click();
    assert.equal(await page.locator('input[name="start_time"]').inputValue(), "05:00", "known tour start should prefill from the MBW catalog");
    assert.equal(await page.locator('input[name="end_time"]').inputValue(), "15:00", "known tour end should prefill from the MBW catalog");
    await page.locator('input[name="start_time"]').fill("05:30");
    assert.equal(await page.locator('input[name="start_time"]').inputValue(), "05:30", "prefilled service time must remain editable");
    const startBox = await page.locator('input[name="start_time"]').boundingBox(), endBox = await page.locator('input[name="end_time"]').boundingBox();
    assert.ok(startBox && endBox && endBox.y - (startBox.y + startBox.height) >= 8, "Start and end time inputs need separate mobile rows");
    await page.locator('input[name="start_time"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/mbw-assignment-times-qa.png", fullPage: false });
    await page.getByText("Add another tour, activity, or transfer", { exact: true }).click();
    assert.equal(await page.locator('#serviceCreateForm .cancelAction').isVisible(), true);
    await page.locator(".serviceCreateActions").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/mbw-service-create-actions-qa.png", fullPage: false });
    await page.locator('#serviceCreateForm input[name="tour"]').fill("Do not save");
    await page.locator('#serviceCreateForm .cancelAction').click();
    assert.equal(await page.locator(".serviceCreate").getAttribute("open"), null);
    assert.equal(await page.locator('#serviceCreateForm input[name="tour"]').inputValue(), "");
    await page.getByText("Add another tour, activity, or transfer", { exact: true }).click();
    await page.locator('#serviceCreateForm input[name="tour"]').fill("Night Walk");
    await page.locator('#serviceCreateForm input[name="product_selected"]').fill("MBW016 - Night Walk");
    await page.locator('#serviceCreateForm input[name="date"]').fill("2026-10-23");
    await page.locator('#serviceCreateForm select[name="service_type"]').selectOption("Activity");
    const popupPromise = context.waitForEvent("page");
    await page.locator('#serviceCreateForm button[data-intent="invoice"]').click();
    const invoicePage = await popupPromise;
    await page.getByText("Service added and verified.", { exact: true }).waitFor({ state: "visible" });
    await page.locator(".serviceRecord").nth(1).waitFor({ state: "visible" });
    assert.equal(await page.locator(".serviceRecord").count(), 2);
    await invoicePage.waitForURL(/mindobirdwatching\.com\/book-tour\/create/);
    const invoiceParams = new URL(invoicePage.url()).searchParams, invoiceTours = JSON.parse(invoiceParams.get("tour_items_json"));
    assert.equal(invoiceTours.length, 1); assert.equal(invoiceTours[0].tour, "Night Walk"); assert.equal(invoiceParams.get("tour_date"), "2026-10-23");
    await page.locator('[data-section="communication"]').scrollIntoViewIfNeeded();
    await page.locator('#interactionForm select[name="channel"]').selectOption("email");
    await page.locator('#interactionForm textarea[name="guest_note"]').fill("Guest asked whether pickup is included.");
    await page.locator('#interactionForm textarea[name="staff_note"]').fill("Confirmed pickup is included and sent the invoice.");
    await page.locator('#interactionForm button[type="submit"]').click();
    await page.getByText("Guest message and response logged.", { exact: true }).waitFor({ state: "visible" });
    assert.deepEqual(interactions.map(item => item.direction), ["incoming", "outgoing"]);
    assert.deepEqual(interactions.map(item => item.type), ["guest_message", "staff_reply"]);
    const communicationText = await page.locator('[data-section="communication"] .recordList').innerText();
    assert.match(communicationText, /Email · Incoming[\s\S]*Guest asked whether pickup is included\./);
    assert.match(communicationText, /Email · Outgoing[\s\S]*Confirmed pickup is included/);
    await page.locator(".planDateWarning summary").click();
    const dateWarningText = await page.locator(".planDateWarning").innerText();
    assert.match(dateWarningText, /Current CRM[\s\S]*Oct 22, 2026/i);
    assert.match(dateWarningText, /Itinerary[\s\S]*Feb 9, 2027–Feb 14, 2027/i);
    await page.getByText("Confirm CRM date update", { exact: true }).click();
    await page.getByText("CRM dates reconciled and verified.", { exact: true }).waitFor({ state: "visible" });
    await page.locator(".planDateWarning").waitFor({ state: "detached" });
    await page.locator("#closeGuest").click();
    assert.equal(await page.locator("#moreStatusFilter option").count(), 9);
    assert.equal(await page.locator("#moreStatusFilter").isVisible(), true);
    await page.locator('#bottomNav [data-route="more"]').click();
    assert.ok(await page.locator(".toolGrid a").count() >= 15, "mobile tool launcher should expose the Admin Hub workflows");
    assert.equal(await page.locator(".ownerTools[data-owner-only]").isVisible(), true);
    await page.screenshot({ path: "/tmp/mbw-mobile-tools-qa.png", fullPage: true });
    await page.locator('#bottomNav [data-route="actions"]').click();
    await page.screenshot({ path: "/tmp/mbw-mobile-pipeline-qa.png", fullPage: true });
    await page.goto(`http://127.0.0.1:${port}/guest-crm/?mobile=1`, { waitUntil: "domcontentloaded" });
    const crmWidth = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(crmWidth.scroll <= crmWidth.client + 1, `Guest CRM overflows mobile viewport: ${crmWidth.scroll}px > ${crmWidth.client}px`);
    await page.screenshot({ path: "/tmp/mbw-guest-crm-mobile-qa.png", fullPage: false });
  } finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
