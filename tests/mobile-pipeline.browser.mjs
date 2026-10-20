import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const root = join(process.cwd(), "admin");
let record = {
  inquiryId: "I-MT-1", guestId: "G-MT-1", name: "Test Testerer", country: "United States", countryCode: "US", brand: "MT",
  phone: "+13055550123", email: "test@example.test", partySize: "2", status: "payment_pending", effectiveStatus: "payment_pending",
  paymentStatus: "payment_pending", requestedDate: "2026-10-22", requestedDateEnd: "2026-10-22", followupDate: "2026-10-21", updatedAt: "2026-10-20T14:00:00Z",
  tours: [{ id: "T-1", tour: "Mindo Tours Test", product: "MT-TEST", date: "2026-10-22", guests: "2", status: "payment_pending" }],
};
const completedRecord = { ...record, inquiryId: "I-CLOSED-1", guestId: "G-CLOSED-1", name: "Completed Guest", status: "completed", effectiveStatus: "completed", requestedDate: "2026-10-19", tours: [{ id: "C-1", tour: "Completed Tour", date: "2026-10-19", guests: "2", status: "completed" }] };
let createdRecord = null;
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
      return route.fulfill({ json: { ok: true, checkedAt: "2026-10-20T15:00:00Z", actions: [{ inquiryId: record.inquiryId, type: "follow-up", priority: 0, reason: "Follow-up due", owner: "JPG" }], today: [], upcoming: schedule, providers: [{ name: "Test Guide", role: "guide", serviceType: "Birdwatching", isDefault: true, active: true }], recentGuests: [record, completedRecord], inquiries: [record, completedRecord], bookings: [] } });
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
    if (path.endsWith(`/guests/${record.inquiryId}`)) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return route.fulfill({ json: { ok: true, record, readiness: readiness(), journey: [{ id: "contact", label: "Contact", state: "complete", evidence: "Contacted" }, { id: "payment", label: "Payment", state: "attention", evidence: "Payment pending" }], data: { interactions: [], assignments: [], bookings: [], payments: [] } } });
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
    await page.screenshot({ path: "/tmp/mbw-loader-mobile-qa.png", fullPage: false });
    const card = page.locator(".actionCard").first(); await card.waitFor({ state: "visible" });
    assert.match(await card.innerText(), /Test Testerer/); assert.match(await card.innerText(), /MT/); assert.match(await card.innerText(), /🇺🇸/);
    assert.match(await card.innerText(), /F\/U\s+Tomorrow/i); assert.doesNotMatch(await card.innerText(), /\bSOON\b|\bNURTURE\b/);
    assert.equal(await page.locator("[data-summary-filter]").count(), 3); await page.locator('[data-summary-filter="followups"]').click(); assert.equal(await page.locator(".actionCard").count(), 1);
    await page.locator('#bottomNav [data-route="guests"]').click();
    assert.equal(await page.locator(".guestCard").count(), 1, "closed guests should stay out of the default list");
    await page.locator("#newGuestButton").click();
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
    await page.locator('[data-guest-status-filter="active"]').click();
    await page.locator('#bottomNav [data-route="today"]').click();
    assert.equal(await page.locator("#todayList .todayCard").count(), 2, "completed services should be hidden from operations");
    const todayText = await page.locator("#todayList").innerText(); assert.match(todayText, /Oct 22, 2026/); assert.match(todayText, /Oct 23, 2026/); assert.doesNotMatch(todayText, /Completed Tour/);
    assert.equal(await page.locator("#todayList .statusBadge.status-quoted").count(), 1); assert.equal(await page.locator("#todayList .statusBadge.status-confirmed").count(), 1);
    await page.screenshot({ path: "/tmp/mbw-today-mobile-qa.png", fullPage: true });
    await page.locator('#bottomNav [data-route="actions"]').click();
    await card.click();
    await page.locator(".detailLoading").waitFor({ state: "visible" });
    await page.locator(".detailContactMeta").waitFor({ state: "visible" });
    assert.match(await page.locator(".detailHero").innerText(), /United States/);
    for (const value of ["Payment Pending", "Mindo Tours Test", "2 guests · 1 service", "Tour Oct 22, 2026", "F/U"]) assert.match(await page.locator(".detailHero").innerText(), new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await page.getByText("Edit guest details", { exact: true }).click();
    assert.equal(await page.locator('#profileForm input[name="first_name"]').inputValue(), "Test");
    assert.equal(await page.locator('#profileForm input[name="last_name"]').inputValue(), "Testerer");
    const emailWidth = (await page.locator('#profileForm input[name="email"]').boundingBox()).width, phoneWidth = (await page.locator('#profileForm input[name="phone_number"]').boundingBox()).width;
    assert.ok(emailWidth > phoneWidth * 1.7, "email should use the full form width");
    for (const pair of [["first_name","last_name"],["phone_number","country"],["assigned_to","guest_count"]]) { const left = await page.locator(`#profileForm [name="${pair[0]}"]`).boundingBox(), right = await page.locator(`#profileForm [name="${pair[1]}"]`).boundingBox(); assert.equal(left.y, right.y, `${pair.join(" / ")} should share a row`); }
    await page.locator('#profileForm input[name="email"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/mbw-guest-profile-qa.png", fullPage: false });
    await page.getByText("Next action").waitFor({ state: "visible" });
    assert.equal(await page.getByText("Services & readiness", { exact: true }).isVisible(), true);
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
    assert.match(stripe, /inquiry_id=I-MT-1/); assert.match(stripe, /guest=Test\+Testerer/);
    const emailHref = await page.locator(".pipelineSection").getByText("Generate Email", { exact: true }).getAttribute("href");
    const itineraryHref = await page.getByText("Generate Itinerary", { exact: true }).getAttribute("href");
    const confirmationHref = await page.getByText("Create Confirmation", { exact: true }).getAttribute("href");
    for (const href of [emailHref, itineraryHref, confirmationHref]) { const params = new URL(href, page.url()).searchParams; assert.equal(params.get("inquiry_id"), "I-MT-1"); assert.equal(params.get("guest"), "Test Testerer"); assert.equal(JSON.parse(params.get("tour_items_json")).length, 1); }
    assert.equal(new URL(itineraryHref, page.url()).searchParams.get("source"), "guest_crm");
    const itineraryPage = await context.newPage(); await itineraryPage.goto(new URL(itineraryHref, page.url()).href); await itineraryPage.locator("#guestName").waitFor({ state: "visible" });
    assert.equal(await itineraryPage.locator("#guestName").inputValue(), "Test Testerer"); assert.equal(await itineraryPage.locator("#guestEmail").inputValue(), "test@example.test"); assert.equal(await itineraryPage.locator("#startDate").inputValue(), "2026-10-22"); assert.ok(await itineraryPage.locator(".itemEditor").count() > 0); await itineraryPage.close();
    await page.getByText("Add guide, driver, or provider", { exact: true }).click();
    const startBox = await page.locator('input[name="start_time"]').boundingBox(), endBox = await page.locator('input[name="end_time"]').boundingBox();
    assert.ok(startBox && endBox && endBox.y - (startBox.y + startBox.height) >= 8, "Start and end time inputs need separate mobile rows");
    await page.locator('input[name="start_time"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/mbw-assignment-times-qa.png", fullPage: false });
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
    await page.locator("#closeGuest").click();
    assert.equal(await page.locator("#moreStatusFilter option").count(), 9);
    assert.equal(await page.locator("#moreStatusFilter").isVisible(), true);
    await page.locator('#bottomNav [data-route="more"]').click();
    assert.ok(await page.locator(".toolGrid a").count() >= 15, "mobile tool launcher should expose the Admin Hub workflows");
    assert.equal(await page.locator("[data-owner-only]").isVisible(), true);
    await page.screenshot({ path: "/tmp/mbw-mobile-tools-qa.png", fullPage: true });
    await page.locator('#bottomNav [data-route="actions"]').click();
    await page.screenshot({ path: "/tmp/mbw-mobile-pipeline-qa.png", fullPage: true });
    await page.goto(`http://127.0.0.1:${port}/guest-crm/?mobile=1`, { waitUntil: "domcontentloaded" });
    const crmWidth = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(crmWidth.scroll <= crmWidth.client + 1, `Guest CRM overflows mobile viewport: ${crmWidth.scroll}px > ${crmWidth.client}px`);
    await page.screenshot({ path: "/tmp/mbw-guest-crm-mobile-qa.png", fullPage: false });
  } finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
