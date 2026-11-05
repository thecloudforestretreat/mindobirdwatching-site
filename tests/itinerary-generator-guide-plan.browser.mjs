import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const root = join(process.cwd(), "admin");
const mime = path => ({ ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".mjs":"text/javascript", ".png":"image/png", ".svg":"image/svg+xml" })[extname(path)] || "application/octet-stream";

test("approved guide plan carries CRM contact data, compact view, clean title, and US$500 payment button", { timeout:20000 }, async () => {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const pathName = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
      const path = normalize(join(root, decodeURIComponent(pathName)));
      if (!path.startsWith(root) || !(await stat(path)).isFile()) throw new Error("missing");
      response.writeHead(200, { "content-type": mime(path) });
      response.end(await readFile(path));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless:true, executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
  const context = await browser.newContext({ viewport:{ width:1440, height:1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  let depositRequest;
  page.on("pageerror", error => errors.push(error.message));
  const draft = {
    source:"guide_plan", sourcePlanId:"robert-2027", inquiryId:"INQ-ROBERT",
    guestName:"Robert Kirberger", guestEmail:"robert@example.test", whatsappNumber:"+1 305 555 0107",
    guestCount:1, tripTitle:"Custom Ecuador itinerary", startDate:"2027-02-09", endDate:"2027-02-14",
    language:"en", brandId:"mindo-tours", itineraryStage:"approved_pending", depositAmount:500,
    guestPriceView:"daily", dailyContentView:"summary", lodgingDisplay:"location_only", showItemPrices:false,
    items:[
      { id:"guide", date:"2027-02-09", type:"Custom", productPreset:"Other", name:"Private guide service", quantity:1, unitPrice:300, showZeroPrice:true, dayTitle:"Quito area to Mindo", dayDetails:"Visit Catequilla, Pululahua and Alambi before continuing to Mindo.", pickupLocation:"Quito airport hotel", dropoffLocation:"Mindo Glambird", overnightCity:"Mindo Glambird" },
      { id:"lodging", date:"2027-02-09", type:"Accommodation", productPreset:"Other", name:"Mindo Glambird", quantity:1, unitPrice:80, showZeroPrice:true, dayTitle:"Quito area to Mindo", dayDetails:"Visit Catequilla, Pululahua and Alambi before continuing to Mindo.", pickupLocation:"Quito airport hotel", dropoffLocation:"Mindo Glambird", overnightCity:"Mindo Glambird" }
    ]
  };
  await page.route("**/api/mobile/plans/robert-2027/itinerary-draft", route => route.fulfill({ json:{ ok:true, draft } }));
  await page.route("https://mbw-shop-api.thecloudforestretreat.workers.dev/deposits/link", route => {
    depositRequest = route.request().postDataJSON();
    return route.fulfill({ json:{ ok:true, amount:500, currency:"USD", deposit_url:"https://mbw-shop-api.thecloudforestretreat.workers.dev/deposits/start?token=qa" } });
  });
  try {
    await page.goto(`http://127.0.0.1:${port}/itinerary-generator/?source=guide_plan&plan=robert-2027`);
    await page.locator("#guestName").waitFor();
    await page.waitForFunction(() => document.querySelector("#guestName")?.value === "Robert Kirberger");
    assert.equal(await page.locator("#guestEmail").inputValue(), "robert@example.test");
    assert.equal(await page.locator("#whatsappNumber").inputValue(), "+1 305 555 0107");
    assert.equal(await page.locator("#tripTitle").inputValue(), "Custom Ecuador itinerary");
    assert.equal(await page.locator("#dailyContentView").inputValue(), "summary");
    assert.equal(await page.locator("#guestPriceView").inputValue(), "daily");
    assert.doesNotMatch(await page.locator("#guestPreview").innerText(), /Private guide service/);
    assert.match(await page.locator("#guestPreview").innerText(), /Quito area to Mindo/);
    assert.match(await page.locator("#guestPreview").innerText(), /Daily package\s+\$380\.00/);
    await page.locator("#dailyContentView").selectOption("services");
    const detailedPreview = await page.evaluate(() => ({ value:document.querySelector("#dailyContentView")?.value, text:document.querySelector("#guestPreview")?.innerText }));
    assert.equal(detailedPreview.value, "services");
    assert.match(detailedPreview.text, /Private guide service/);
    await page.locator("#dailyContentView").selectOption("summary");
    assert.doesNotMatch(await page.locator("#guestPreview").innerText(), /Private guide service/);
    assert.equal(await page.locator("#generateDepositLinkBtn").innerText(), "Create US$500 Payment Button");
    await page.locator("#generateDepositLinkBtn").click();
    await page.waitForFunction(() => document.querySelector("#depositLink")?.value.includes("/deposits/start?token=qa"));
    assert.deepEqual(depositRequest, { amount:500, inquiry_id:"INQ-ROBERT", language:"en" });
    assert.match(await page.locator("#guestPreview").innerText(), /Pay Tour Deposit/);
    assert.equal(errors.length, 0, errors.join("\n"));
    await page.screenshot({ path:"/tmp/mbw-itinerary-generator-guide-plan-qa.png", fullPage:true });
  } finally {
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
});
