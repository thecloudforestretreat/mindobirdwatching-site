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
    if (path.endsWith("/bootstrap")) return route.fulfill({ json: { ok: true, checkedAt: "2026-10-20T15:00:00Z", actions: [{ inquiryId: record.inquiryId, type: "follow-up", priority: 0, reason: "Follow-up due", owner: "JPG" }], today: [], upcoming: [], providers: [{ name: "Test Guide", role: "guide", serviceType: "Birdwatching", isDefault: true, active: true }], recentGuests: [record], inquiries: [record], bookings: [] } });
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
      return route.fulfill({ json: { ok: true, record, journey: [{ id: "contact", label: "Contact", state: "complete", evidence: "Contacted" }, { id: "payment", label: "Payment", state: "attention", evidence: "Payment pending" }], data: { interactions: [], assignments: [], bookings: [], payments: [] } } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: "Not found" } });
  });
  try {
    await page.goto(`http://127.0.0.1:${port}/app/`);
    const card = page.locator(".actionCard").first(); await card.waitFor({ state: "visible" });
    assert.match(await card.innerText(), /Test Testerer/); assert.match(await card.innerText(), /MT/); assert.match(await card.innerText(), /🇺🇸/);
    assert.equal(await page.locator("[data-summary-filter]").count(), 3); await page.locator('[data-summary-filter="followups"]').click(); assert.equal(await page.locator(".actionCard").count(), 1);
    await page.locator('#bottomNav [data-route="guests"]').click(); const guestBox = await page.locator(".guestCard").first().boundingBox(); assert.ok(guestBox && guestBox.x + guestBox.width <= 390);
    await page.locator('#bottomNav [data-route="actions"]').click();
    await card.click();
    await page.locator(".detailLoading").waitFor({ state: "visible" });
    assert.match(await page.locator(".detailHero").innerText(), /United States/);
    await page.getByText("Next action").waitFor({ state: "visible" });
    assert.equal(await page.getByText("Services", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("Add another tour, activity, or transfer", { exact: true }).isVisible(), true);
    assert.equal(await page.getByText("Add guide, driver, or provider", { exact: true }).isVisible(), true);
    assert.equal(await page.locator(".dialogNav").isVisible(), true);
    await page.locator('.serviceStatusForm select[name="status"]').first().selectOption("completed");
    await page.locator(".serviceStatusForm button").first().click();
    await page.getByText("Service status saved and verified.", { exact: true }).waitFor({ state: "visible" });
    assert.equal(await page.locator('.serviceStatusForm select[name="status"]').first().evaluate(element => element.value), "completed");
    for (const label of ["Compose email", "Create Stripe invoice", "Create Zelle invoice", "Create confirmation"]) assert.equal(await page.getByText(label, { exact: true }).isVisible(), true);
    const sectionBox = await page.locator('[data-section="follow-up"]').boundingBox(), dateBox = await page.locator('input[name="followup_date"]').boundingBox();
    assert.ok(sectionBox && dateBox && dateBox.x >= sectionBox.x && dateBox.x + dateBox.width <= sectionBox.x + sectionBox.width + 1);
    const stripe = await page.getByText("Create Stripe invoice", { exact: true }).getAttribute("href");
    assert.match(stripe, /inquiry_id=I-MT-1/); assert.match(stripe, /guest=Test\+Testerer/);
    await page.getByText("Add guide, driver, or provider", { exact: true }).click();
    const startBox = await page.locator('input[name="start_time"]').boundingBox(), endBox = await page.locator('input[name="end_time"]').boundingBox();
    assert.ok(startBox && endBox && endBox.x - (startBox.x + startBox.width) >= 8, "Start and end time inputs need a visible gap");
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
    await page.screenshot({ path: "/tmp/mbw-mobile-pipeline-qa.png", fullPage: true });
    await page.goto(`http://127.0.0.1:${port}/guest-crm/?mobile=1`, { waitUntil: "domcontentloaded" });
    const crmWidth = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(crmWidth.scroll <= crmWidth.client + 1, `Guest CRM overflows mobile viewport: ${crmWidth.scroll}px > ${crmWidth.client}px`);
    await page.screenshot({ path: "/tmp/mbw-guest-crm-mobile-qa.png", fullPage: false });
  } finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
