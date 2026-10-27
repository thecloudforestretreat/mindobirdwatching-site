import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { robertPlan } from "../functions/lib/guide-plans.mjs";

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
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixedNow = new NativeDate("2026-10-23T17:00:00Z").valueOf();
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedNow])); }
      static now() { return fixedNow; }
    }
    Object.defineProperty(window, "Date", { value: FixedDate });
  });
  const writes = [];
  let requestedProvider = "";
  const bootstrap = {
    ok: true, preview: false, identity: { role: "guide", name: "Neycer", contributorNumber: "007" }, providerId: "PROV-007", providerName: "Neycer · Night Walk Guide", features: { plans: true, opportunities: true }, checkedAt: "2026-10-21T15:00:00Z",
    availability: [{ assignmentId: "AV-1", serviceDate: "2026-10-26", startTime: "4:00 AM", endTime: "7:00 AM", note: "Personal" }],
    offers: [{ assignmentId: "O-1", serviceDate: "2026-10-30", startTime: "6:00 AM", service: "Custom birding package", pickup: "Mindo", response: "", bidAmount: "" }],
    plans: [robertPlan({ providerId: "PROV-007", name: "Neycer · Night Walk Guide" })],
    tours: [
      { assignmentId: "A-1", bookingId: "B-1", serviceDate: "2026-10-26", dateLabel: "Oct 26, 2026", startTime: "5:00 AM", endTime: "3:00 PM", service: "MBW006 - Quest for Five Toucans", guestName: "Daniel Kalmes", guestCount: "2", country: "Luxembourg", countryCode: "LU", pickup: "Mindo Lodge", status: "confirmed", accepted: false, acceptanceRequired: true, contactAvailable: true, hasConflict: true, conflictReason: "availability", providerName: "Neycer · Night Walk Guide", phone: "+352 621 492 066", whatsappUrl: "https://wa.me/352621492066", guestMessage: "Hello Daniel, I’m Neycer from Mindo Bird Watching. I’ll be your guide for the Quest for Five Toucans on October 26, 2026 at 5:00 AM. The pickup location is Mindo Lodge.\n\nPlease message me here if you have any questions before the tour.\n\nThank you." },
      { assignmentId: "A-2", bookingId: "B-2", serviceDate: "2026-11-10", startTime: "6:00 AM", service: "Night Walk", guestName: "November Guest", guestCount: "1", pickup: "Casa Mindo", status: "confirmed", accepted: true, acceptanceRequired: false, contactAvailable: true, hasConflict: false, phone: "+593 999 000 111", whatsappUrl: "https://wa.me/593999000111" },
      { assignmentId: "A-3", bookingId: "B-3", serviceDate: "2026-12-15", startTime: "7:00 AM", service: "Birdwatching", guestName: "December Guest", guestCount: "3", pickup: "Quito", status: "confirmed", accepted: true, acceptanceRequired: false, contactAvailable: true, hasConflict: false, phone: "+593 999 000 222", whatsappUrl: "https://wa.me/593999000222" },
      { assignmentId: "A-PAST", bookingId: "B-PAST", serviceDate: "2026-10-15", startTime: "6:00 AM", service: "Past Birding", guestName: "Past Guest", guestCount: "2", pickup: "Mindo", status: "completed", accepted: true, acceptanceRequired: false, contactAvailable: false, hasConflict: false, phone: "", whatsappUrl: "" },
    ],
    links: { google: "https://g.page/r/CdMlIYMGgBIvEAE/review", tripadvisor: "https://tripadvisor.example/review", instagram: "https://instagram.example/mbw", facebook: "https://facebook.example/mbw", youtube: "https://youtube.example/mbw", shop: "https://mindobirdwatching.com/shop/?utm_source=mbw_guide&utm_medium=referral&utm_campaign=post_tour&utm_content=neycer", tip: "https://mindobirdwatching.com/tip-your-guide/?utm_source=mbw_guide&utm_medium=referral&utm_campaign=guide_tip&utm_content=neycer" },
  };
  await page.route(`http://127.0.0.1:${port}/api/guide/bootstrap**`, route => {
    requestedProvider = new URL(route.request().url()).searchParams.get("provider") || "";
    return route.fulfill({ json: { ...bootstrap } });
  });
  await page.route(`http://127.0.0.1:${port}/api/guide/assignments/**`, async route => {
    writes.push({ url: route.request().url(), method: route.request().method() });
    bootstrap.tours[0].accepted = true;
    bootstrap.tours[0].acceptanceRequired = false;
    await route.fulfill({ json: { ok: true, verified: true } });
  });
  await page.route(`http://127.0.0.1:${port}/api/guide/availability`, async route => {
    if (route.request().method() === "POST") {
      writes.push({ url: route.request().url(), method: "POST", body: route.request().postDataJSON() });
      bootstrap.availability.push({ assignmentId: "AV-2", serviceDate: route.request().postDataJSON().date, startTime: "1:00 PM", endTime: "2:00 PM", note: route.request().postDataJSON().note });
      await route.fulfill({ json: { ok: true, verified: true }, status: 201 });
    } else await route.continue();
  });
  await page.route(`http://127.0.0.1:${port}/api/guide/offers/**`, async route => {
    writes.push({ url: route.request().url(), method: route.request().method(), body: route.request().postDataJSON() });
    bootstrap.offers[0].response = route.request().postDataJSON().response;
    await route.fulfill({ json: { ok: true, verified: true } });
  });
  await page.route(`http://127.0.0.1:${port}/api/guide/plans/**`, async route => {
    const body = route.request().postDataJSON();
    writes.push({ url: route.request().url(), method: route.request().method(), body });
    bootstrap.plans[0] = { ...bootstrap.plans[0], status: body.status, adjustments: body.adjustments, comments: body.comments, synthetic: false, assignmentId: "PLAN-1" };
    await route.fulfill({ json: { ok: true, verified: true, plan: bootstrap.plans[0] }, status: 201 });
  });
  await page.route(`http://127.0.0.1:${port}/api/guide/reports**`, route => route.fulfill({ json: {
    ok: true, linked: true, reports: [{ recapId: "recap-1", observedAt: "2026-10-22", location: "San Lorenzo", bookingReference: "B-1", speciesCount: 42, totalObservations: 57 }],
  } }));
  try {
    await page.goto(`http://127.0.0.1:${port}/guide/`);
    await page.getByText("Daniel Kalmes", { exact: true }).waitFor();
    assert.equal(await page.locator('[data-tour-view="upcoming"].active').count(), 1);
    assert.equal(await page.locator('[data-tour-range="7"].active').count(), 1);
    assert.equal(await page.getByText("Próximo tour", { exact: true }).count(), 1);
    assert.equal(await page.getByText("November Guest", { exact: true }).count(), 0);
    assert.equal(await page.locator('.tourCard a[href^="https://www.google.com/maps/search/"]').count(), 1);
    await page.getByRole("button", { name: "30 días" }).click();
    await page.getByText("November Guest", { exact: true }).waitFor();
    assert.equal(await page.getByText("December Guest", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Todos los tours" }).click();
    await page.getByText("Past Guest", { exact: true }).waitFor();
    assert.equal(await page.locator('.tourCard--completed [data-route="share"]').count(), 1);
    assert.equal(await page.locator("#tourSearch").isVisible(), true);
    await page.locator("#tourSearch").fill("December");
    await page.getByText("December Guest", { exact: true }).waitFor();
    assert.equal(await page.getByText("Daniel Kalmes", { exact: true }).count(), 0);
    await page.locator("#tourSearch").fill("");
    await page.getByRole("button", { name: "Próximos" }).click();
    assert.equal(await page.locator("#adminPreview").isVisible(), false);
    assert.match(await page.locator(".tourCard").first().innerText(), /Mindo Lodge/);
    assert.match(await page.locator(".tourCard").first().innerText(), /🇱🇺 Luxembourg/);
    assert.match(await page.locator(".tourCard").first().innerText(), /\+352 621 492 066/);
    assert.match(await page.locator(".tourCard").first().innerText(), /Conflicto de horario/);
    assert.match(await page.locator(".tourCard").first().innerText(), /Reporte (?:después del tour|pendiente)/i);
    assert.equal(await page.locator('.tourCard').first().locator('a[href^="https://wa.me/"]').count(), 1);
    assert.equal(await page.locator('.tourCard').first().locator('a[href^="tel:"]').count(), 0);
    const tipButton = page.locator('.tourCard').first().getByRole('button', { name: 'Propina' });
    assert.equal(await tipButton.count(), 1);
    const tipCopy = decodeURIComponent(await tipButton.getAttribute('data-copy'));
    assert.equal(tipCopy, 'It was my pleasure being your guide. Here is the tip link you requested:\n\nhttps://mindobirdwatching.com/tip-your-guide/?utm_source=mbw_guide&utm_medium=referral&utm_campaign=guide_tip&utm_content=neycer');
    const copyMessage = decodeURIComponent(await page.locator(".tourCard").first().getByRole("button", { name: "Copiar mensaje" }).getAttribute("data-copy"));
    assert.match(copyMessage, /^Hello Daniel, I’m Neycer from Mindo Bird Watching\./);
    assert.doesNotMatch(copyMessage, /Hola|MBW006/);
    assert.match(copyMessage, /\n\nThank you\.$/);
    assert.equal(await page.locator(".tourCard").first().innerText().then(text => text.includes("private@example")), false);
    assert.equal(await page.getByRole("button", { name: "Aceptar tour" }).count(), 0);
    await page.screenshot({ path: "/tmp/mbw-guide-nest-tours.png", fullPage: true });
    await page.locator('[data-route="calendar"]').click();
    assert.equal(await page.locator("#calendarMonthPanel").isVisible(), true);
    assert.match(await page.locator("#calendarMonthLabel").innerText(), /octubre (?:de )?2026/i);
    assert.equal(await page.locator('.calendarDay[aria-label*="26 oct 2026"]').count(), 1);
    assert.equal(await page.locator('.calendarDay[aria-label*="26 oct 2026"] .tourDot').count(), 1);
    assert.equal(await page.locator('.calendarDay[aria-label*="26 oct 2026"] .blockedDot').count(), 1);
    await page.screenshot({ path: "/tmp/mbw-guide-nest-calendar-month.png", fullPage: true });
    await page.locator('[data-calendar-date="2026-10-26"]').click();
    await page.getByText("Daniel Kalmes", { exact: true }).waitFor();
    assert.equal(await page.locator(".tourCard").count(), 1);
    assert.match(await page.locator("#tourSummary").innerText(), /Mostrando 26 oct 2026/i);
    await page.locator('[data-route="calendar"]').click();
    await page.getByRole("button", { name: "Mes siguiente" }).click();
    assert.match(await page.locator("#calendarMonthLabel").innerText(), /noviembre (?:de )?2026/i);
    await page.getByRole("button", { name: "Mes anterior" }).click();
    assert.match(await page.locator("#calendarMonthLabel").innerText(), /octubre (?:de )?2026/i);
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    assert.equal(await page.locator("#calendarList").isVisible(), true);
    assert.equal(await page.locator("#calendarList").getByText("Past Guest", { exact: false }).count(), 0);
    assert.match(await page.locator("#calendarList").innerText(), /26 oct 2026/i);
    await page.getByRole("button", { name: "Incluir pasados", exact: true }).click();
    await page.getByText("Past Birding · Past Guest", { exact: true }).waitFor();
    await page.locator('[data-open-tour="A-1"]').click();
    await page.getByText("Daniel Kalmes", { exact: true }).waitFor();
    assert.equal(await page.locator(".tourCard").count(), 1);
    await page.locator('[data-route="calendar"]').click();
    assert.match(await page.locator("#availabilityList").innerText(), /Personal/);
    await page.locator('#availabilityForm input[name="date"]').fill("2026-10-31");
    await page.locator('#availabilityForm input[name="startTime"]').fill("13:00");
    await page.locator('#availabilityForm input[name="endTime"]').fill("14:00");
    await page.locator('#availabilityForm input[name="note"]').fill("Cita personal");
    await page.getByRole("button", { name: "Bloquear horario" }).click();
    await page.getByText("Cita personal", { exact: false }).waitFor();
    assert.equal(writes.some(write => write.url.endsWith("/api/guide/availability") && write.method === "POST"), true);
    await page.screenshot({ path: "/tmp/mbw-guide-nest-calendar.png", fullPage: true });
    await page.locator('[data-route="sightings"]').click();
    assert.equal(await page.locator("#reportTour option").count(), 2);
    assert.equal(await page.locator('#reportTour option', { hasText: "November Guest" }).count(), 0);
    assert.equal(await page.locator('#reportTour option', { hasText: "December Guest" }).count(), 0);
    await page.locator("#reportTour").selectOption("B-1");
    const reportHref = await page.locator("#openReport").getAttribute("href");
    assert.match(reportHref, /^https:\/\/mindobirdwatching\.com\/es\/reporte-de-avistamientos\//);
    assert.match(reportHref, /booking=A-1/);
    assert.match(reportHref, /booking_id=B-1/);
    assert.match(reportHref, /date=2026-10-26/);
    assert.match(reportHref, /tour_type=full_day/);
    await page.getByText("San Lorenzo", { exact: true }).waitFor();
    assert.match(await page.locator("#reportHistory").innerText(), /San Lorenzo/);
    assert.match(await page.locator("#reportHistory").innerText(), /42 especies/);
    await page.locator('[data-route="today"]').click();
    assert.match(await page.locator(".tourCard").first().innerText(), /Reporte enviado/i);
    await page.locator('[data-route="sightings"]').click();
    await page.screenshot({ path: "/tmp/mbw-guide-nest-sightings.png", fullPage: true });
    await page.getByRole("button", { name: "EN", exact: true }).click();
    assert.match(await page.locator('.view:not([hidden]) h1').innerText(), /Sightings/);
    await page.getByRole("button", { name: "ES", exact: true }).click();
    await page.locator('[data-route="plans"]').click();
    await page.getByRole("button", { name: "Oportunidades", exact: true }).click();
    assert.match(await page.locator("#offerList").innerText(), /Custom birding package/);
    await page.locator('[data-bid="O-1"]').fill("125");
    await page.getByRole("button", { name: "Me interesa" }).click();
    await page.getByText("Me interesa", { exact: true }).waitFor();
    assert.equal(writes.some(write => write.url.endsWith("/api/guide/offers/O-1/respond") && write.body.bidAmount === "125"), true);
    await page.getByRole("button", { name: "Planes asignados", exact: true }).click();
    await page.getByText("Robert · Itinerario personalizado en Ecuador", { exact: true }).waitFor();
    assert.match(await page.locator("#planList").innerText(), /\$795[.,]00/);
    assert.match(await page.locator("#planList").innerText(), /Salida del hotel hacia Mindo/);
    assert.match(await page.locator("#planList").innerText(), /Transporte\s+\$85[.,]00/);
    assert.doesNotMatch(await page.locator("#planList").innerText(), /\$1[.,]150[.,]00/);
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.getByText("Robert · Custom Ecuador itinerary", { exact: true }).waitFor();
    assert.match(await page.locator("#planList").innerText(), /Depart from the hotel toward Mindo/);
    assert.match(await page.locator("#planList").innerText(), /Transportation\s+\$85[.,]00/);
    await page.getByRole("button", { name: "ES", exact: true }).click();
    await page.locator('[data-plan-cost-form="robert-2027"] input[name="description"]').fill("Intag lodging");
    await page.locator('[data-plan-cost-form="robert-2027"] input[name="amount"]').fill("80");
    await page.locator('[data-plan-cost-form="robert-2027"] select[name="category"]').selectOption("lodging");
    await page.locator('[data-plan-cost-form="robert-2027"] button[type="submit"]').click();
    await page.getByText("Alojamiento · Intag lodging", { exact: true }).waitFor();
    assert.match(await page.locator("#planList").innerText(), /\$875[.,]00/);
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await page.getByText("Plan guardado", { exact: true }).waitFor();
    assert.equal(writes.some(write => write.url.endsWith("/api/guide/plans/robert-2027") && write.body.adjustments[0].amount === 80), true);
    await page.screenshot({ path: "/tmp/mbw-guide-nest-plans.png", fullPage: true });
    await page.locator('[data-route="share"]').click();
    assert.equal(await page.locator(".shareCard").count(), 6);
    assert.match(await page.locator("#shareList").innerText(), /Reseña en Google/);
    assert.match(await page.locator("#shareList").innerText(), /Tripadvisor/);
    assert.match(await page.locator("#shareList").innerText(), /Tienda MBW/);
    const googleCopy = decodeURIComponent(await page.locator(".shareCard--google .copyButton").getAttribute("data-copy"));
    const shopCopy = decodeURIComponent(await page.locator(".shareCard--shop .copyButton").getAttribute("data-copy"));
    assert.match(googleCopy, /https:\/\/g\.page\/r\/CdMlIYMGgBIvEAE\/review$/);
    assert.match(googleCopy, /^Thank you for joining Mindo Bird Watching!/);
    assert.doesNotMatch(googleCopy, /¡Gracias/);
    assert.doesNotMatch(googleCopy, /utm_/);
    assert.match(shopCopy, /^Thank you for touring with us!/);
    assert.match(shopCopy, /utm_source=mbw_guide/);
    assert.match(shopCopy, /utm_content=neycer/);
    await page.screenshot({ path: "/tmp/mbw-guide-nest-share.png", fullPage: true });
    const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(width.scroll <= width.client + 1, `Guide Nest overflows: ${width.scroll}px > ${width.client}px`);
    assert.equal(await page.locator(".cards").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length), 1);
    bootstrap.preview = true;
    bootstrap.identity = { role: "owner", name: "Juan" };
    bootstrap.providerOptions = [{ providerId: "PROV-007", name: "Neycer · Night Walk Guide" }];
    await page.goto(`http://127.0.0.1:${port}/guide/?provider=PROV-007`);
    await page.getByText("Daniel Kalmes", { exact: true }).waitFor();
    assert.equal(requestedProvider, "PROV-007");
    assert.equal(new URL(page.url()).searchParams.get("provider"), "PROV-007");
    assert.equal(await page.locator("#adminPreview").isVisible(), true);
    assert.equal(await page.locator('label[for="providerSelect"]').innerText(), "Guide View");
    assert.match(await page.locator("#adminPreview").innerText(), /Modo de auditoría/i);
    assert.match(await page.locator("#adminPreview").innerText(), /planes personalizados son colaborativos/i);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const auditPosition = await page.locator("#adminPreview").evaluate(element => ({ position: getComputedStyle(element).position, top: element.getBoundingClientRect().top }));
    assert.equal(auditPosition.position, "sticky");
    assert.ok(auditPosition.top >= 80 && auditPosition.top < 120, `audit control should remain below the header, received ${auditPosition.top}px`);
    assert.equal(await page.locator("[data-accept]").count(), 0);
    await page.locator('[data-route="calendar"]').click();
    assert.equal(await page.locator("#availabilityPanel").isVisible(), false);
    assert.equal(await page.locator("[data-remove-availability]").count(), 0);
    await page.locator('[data-route="plans"]').click();
    await page.getByRole("button", { name: "Oportunidades", exact: true }).click();
    assert.equal(await page.locator("[data-offer-response]").count(), 0);
    assert.match(await page.locator("#offerList").innerText(), /solo lectura/i);
    bootstrap.preview = false;
    bootstrap.identity = { role: "guide", name: "Chicho", contributorNumber: "001" };
    bootstrap.providerId = "PROV-CHICHO";
    bootstrap.providerName = "Chicho";
    bootstrap.features = { plans: false, opportunities: false };
    bootstrap.plans = [];
    bootstrap.offers = [];
    await page.goto(`http://127.0.0.1:${port}/guide/?view=plans`);
    await page.getByText("Daniel Kalmes", { exact: true }).waitFor();
    assert.equal(await page.locator("#plansNav").isVisible(), false);
    assert.equal(new URL(page.url()).searchParams.get("view"), null);
    const reportUrl = new URL(reportHref);
    await page.goto(`http://127.0.0.1:${port}${reportUrl.pathname}${reportUrl.search}`);
    assert.equal(await page.locator("#tourDate").inputValue(), "2026-10-26");
    assert.equal(await page.locator("#tourType").inputValue(), "full_day");
    assert.equal(await page.locator("#bookingReference").inputValue(), "A-1");
    assert.equal(await page.locator("#contributorNumber").inputValue(), "007");
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
