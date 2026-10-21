import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const projectRoot = process.cwd();
const root = join(projectRoot, "admin");
const mime = path => ({ ".html": "text/html", ".css": "text/css", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" })[extname(path)] || "application/octet-stream";

test("Guide Nest keeps booked tour actions, calendar, sightings, and sharing usable on mobile", async () => {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const staticRoot = url.pathname.startsWith("/guide/") || url.pathname.startsWith("/assets/images/app/") ? root : projectRoot;
      let path = normalize(join(staticRoot, decodeURIComponent(url.pathname)));
      if (url.pathname.endsWith("/")) path = join(path, "index.html");
      if (!path.startsWith(staticRoot) || !(await stat(path)).isFile()) throw new Error("missing");
      response.writeHead(200, { "content-type": mime(path) }); response.end(await readFile(path));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route(`http://127.0.0.1:${port}/api/guide/bootstrap**`, route => route.fulfill({ json: {
    ok: true, preview: true, providerName: "Neycer · Night Walk Guide", providers: ["Neycer · Night Walk Guide", "Chicho"], checkedAt: "2026-10-21T15:00:00Z",
    tours: [{ assignmentId: "A-1", bookingId: "B-1", serviceDate: "2026-10-23", dateLabel: "Oct 23, 2026", startTime: "5:00 AM", endTime: "3:00 PM", service: "Quest for Five Toucans", guestName: "Daniel Kalmes", guestCount: "2", pickup: "Mindo Lodge", status: "confirmed", phone: "+352 621 492 066", whatsappUrl: "https://wa.me/352621492066", guestMessage: "Hi Daniel, this is Neycer from Mindo Bird Watching." }],
    links: { google: "https://google.example/review", tripadvisor: "https://tripadvisor.example/review", instagram: "https://instagram.example/mbw", facebook: "https://facebook.example/mbw", youtube: "https://youtube.example/mbw", shop: "https://shop.example/mbw" },
  } }));
  await page.route(`http://127.0.0.1:${port}/api/guide/reports**`, route => route.fulfill({ json: {
    ok: true, linked: true, reports: [{ recapId: "recap-1", observedAt: "2026-10-22", location: "San Lorenzo", bookingReference: "B-1", speciesCount: 42, totalObservations: 57 }],
  } }));
  try {
    await page.goto(`http://127.0.0.1:${port}/guide/`);
    await page.getByText("Daniel Kalmes", { exact: true }).waitFor();
    assert.equal(await page.locator("#adminPreview").isVisible(), true);
    assert.match(await page.locator(".tourCard").innerText(), /Mindo Lodge/);
    assert.match(await page.locator(".tourCard").innerText(), /\+352 621 492 066/);
    assert.equal(await page.locator('.tourCard a[href^="https://wa.me/"]').count(), 1);
    assert.equal(await page.locator(".tourCard").innerText().then(text => text.includes("private@example")), false);
    await page.screenshot({ path: "/tmp/mbw-guide-nest-tours.png", fullPage: true });
    await page.locator('[data-route="calendar"]').click();
    assert.match(await page.locator("#calendarList").innerText(), /23 oct 2026/i);
    await page.screenshot({ path: "/tmp/mbw-guide-nest-calendar.png", fullPage: true });
    await page.locator('[data-route="sightings"]').click();
    const reportHref = await page.locator("#openReport").getAttribute("href");
    assert.match(reportHref, /^https:\/\/mindobirdwatching\.com\/es\/reporte-de-avistamientos\//);
    assert.match(reportHref, /booking=B-1/);
    assert.match(reportHref, /date=2026-10-23/);
    assert.match(reportHref, /tour_type=full_day/);
    await page.getByText("San Lorenzo", { exact: true }).waitFor();
    assert.match(await page.locator("#reportHistory").innerText(), /San Lorenzo/);
    assert.match(await page.locator("#reportHistory").innerText(), /42 especies/);
    await page.screenshot({ path: "/tmp/mbw-guide-nest-sightings.png", fullPage: true });
    await page.getByRole("button", { name: "EN", exact: true }).click();
    assert.match(await page.locator('.view:not([hidden]) h1').innerText(), /Sightings/);
    await page.getByRole("button", { name: "ES", exact: true }).click();
    await page.locator('[data-route="share"]').click();
    assert.equal(await page.locator(".shareCard").count(), 6);
    assert.match(await page.locator("#shareList").innerText(), /Reseña en Google/);
    assert.match(await page.locator("#shareList").innerText(), /Tripadvisor/);
    assert.match(await page.locator("#shareList").innerText(), /Tienda MBW/);
    await page.screenshot({ path: "/tmp/mbw-guide-nest-share.png", fullPage: true });
    const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(width.scroll <= width.client + 1, `Guide Nest overflows: ${width.scroll}px > ${width.client}px`);
    assert.equal(await page.locator(".cards").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), 1);
    const reportUrl = new URL(reportHref);
    await page.goto(`http://127.0.0.1:${port}${reportUrl.pathname}${reportUrl.search}`);
    assert.equal(await page.locator("#tourDate").inputValue(), "2026-10-23");
    assert.equal(await page.locator("#tourType").inputValue(), "full_day");
    assert.equal(await page.locator("#bookingReference").inputValue(), "B-1");
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
