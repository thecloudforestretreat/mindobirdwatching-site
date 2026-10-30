import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const root = join(process.cwd(), "services/inquiry-studio/public");

test("Inquiry Studio surfaces the admin itinerary review queue on desktop and mobile", async () => {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === "/api/mobile/plans") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true, plans: [
        { planId: "robert-2027", providerId: "PROV-NEICER", providerName: "Neicer", guestName: "Robert", startDate: "2027-02-09", endDate: "2027-02-14", status: "admin_review", updatedAt: "2026-10-30T12:00:00Z" },
        { planId: "alice-2027", providerId: "PROV-CHICHO", providerName: "Chicho", guestName: "Alice", startDate: "2027-03-01", endDate: "2027-03-04", status: "guide_drafting", updatedAt: "2026-10-29T12:00:00Z" },
      ] }));
      return;
    }
    if (url.pathname === "/inquiry-studio/api/session") {
      response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ token: "test" })); return;
    }
    if (url.pathname === "/inquiry-studio/api/inquiries") {
      response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ records: [], source: { imported_at: new Date().toISOString() }, sync: { ok: true } })); return;
    }
    const relative = url.pathname === "/inquiry-studio/" ? "index.html" : url.pathname.replace(/^\/inquiry-studio\//, "");
    try {
      const body = await readFile(join(root, relative));
      response.setHeader("content-type", relative.endsWith(".css") ? "text/css" : relative.endsWith(".js") ? "text/javascript" : "text/html");
      response.end(body);
    } catch { response.statusCode = 404; response.end("Not found"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`http://127.0.0.1:${port}/inquiry-studio/`);
      await page.getByText("Custom itinerary reviews", { exact: true }).waitFor();
      assert.equal(await page.locator(".planReviewCard").count(), 2);
      assert.equal(await page.locator("#planReviewCount").innerText(), "1");
      const link = new URL(await page.getByRole("link", { name: "Review itinerary" }).first().getAttribute("href"), `http://127.0.0.1:${port}`);
      assert.equal(link.pathname, "/guide/");
      assert.equal(link.searchParams.get("provider"), "PROV-NEICER");
      assert.equal(link.searchParams.get("plan"), "robert-2027");
      const sizing = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(sizing.scroll <= sizing.client + 1, `Inquiry Studio overflows at ${width}px`);
      await page.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
