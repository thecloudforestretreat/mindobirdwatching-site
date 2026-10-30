import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";
import { seedKnowledge } from "../functions/lib/itinerary-knowledge.mjs";

const root = join(process.cwd(), "admin");
const mime = path => ({ ".html":"text/html", ".css":"text/css", ".mjs":"text/javascript", ".png":"image/png", ".ico":"image/x-icon", ".svg":"image/svg+xml" })[extname(path)] || "application/octet-stream";

test("Itinerary Lab keeps intake simple while exposing evidence review and one final save", async () => {
  const server = createServer(async (request, response) => { try { const url = new URL(request.url,"http://127.0.0.1"), pathName = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname, path = normalize(join(root, decodeURIComponent(pathName))); if (!path.startsWith(root) || !(await stat(path)).isFile()) throw new Error("missing"); response.writeHead(200,{"content-type":mime(path)}); response.end(await readFile(path)); } catch { response.writeHead(404); response.end("Not found"); } });
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  const port = server.address().port, browser = await chromium.launch({ headless:true, executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }), context = await browser.newContext({ viewport:{width:390,height:844} }), page = await context.newPage();
  let records = seedKnowledge(), writes = 0;
  await page.route(`http://127.0.0.1:${port}/api/itinerary-lab/**`, async route => {
    if (route.request().method() === "GET") return route.fulfill({ json:{ok:true,identity:{name:"Juan",role:"owner"},records} });
    const body = route.request().postDataJSON(); writes += 1; const saved = { ...body.record, sourceId: body.record.sourceId || "new-source", assignmentId:"KNOW-NEW", synthetic:false, updatedAt:"2026-10-30T12:00:00Z" }; records = [saved,...records.filter(item=>item.sourceId!==saved.sourceId)]; return route.fulfill({status:201,json:{ok:true,verified:true,record:saved}});
  });
  try {
    await page.goto(`http://127.0.0.1:${port}/itinerary-lab/`);
    await page.getByRole("heading",{name:"Itinerary Lab",exact:true}).waitFor({state:"visible"});
    assert.deepEqual(await page.locator(".stat strong").allTextContents(), ["2","0","2","0"]);
    await page.getByText("Ecuador en Inmersion",{exact:true}).click();
    assert.equal(await page.locator(".block").count(),17); assert.match(await page.locator("#knowledgeForm").innerText(),/No prices/);
    await page.getByRole("button",{name:"+ Add source",exact:true}).click();
    await page.locator('#sourceForm input[name="title"]').fill("Two day test route");
    await page.locator('#sourceForm select[name="sourceType"]').selectOption("text");
    await page.locator('#sourceForm select[name="rights"]').selectOption("private");
    await page.locator('#sourceForm textarea[name="rawText"]').fill("Día 1: Quito a Mindo\nParada en Alambi.\nDía 2: Mindo\nObservación de aves.");
    await page.getByRole("button",{name:"Prepare intake",exact:true}).click();
    assert.equal(await page.locator(".block").count(),2); assert.match(await page.locator("#dirtyState").innerText(),/Unsaved changes/); assert.equal(writes,0);
    await page.getByRole("button",{name:"Save knowledge record",exact:true}).click();
    await page.getByText("Knowledge record saved once and verified in the CRM.",{exact:true}).waitFor({state:"visible"});
    assert.equal(writes,1); assert.match(await page.locator("#dirtyState").innerText(),/All changes saved/);
    const overflow = await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})); assert.ok(overflow.scroll<=overflow.client+1);
    await page.screenshot({path:"/tmp/mbw-itinerary-lab-qa.png",fullPage:true});
  } finally { await context.close(); await browser.close(); await new Promise(resolve=>server.close(resolve)); }
});
