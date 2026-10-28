const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"});
  try{
    for(const width of [1440,1024,390]){
      const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      await page.route("**/*",route=>{
        const url=new URL(route.request().url());
        const relative=url.pathname==="/media/"?"admin/media/index.html":url.pathname.startsWith("/assets/")?"admin"+url.pathname:url.pathname.slice(1);
        const file=path.join(process.cwd(),relative);
        if(!fs.existsSync(file)||fs.statSync(file).isDirectory())return route.fulfill({status:404,body:""});
        return route.fulfill({body:fs.readFileSync(file),contentType:relative.endsWith(".js")?"application/javascript":relative.endsWith(".css")?"text/css":"text/html"});
      });
      await page.goto("http://localhost/media/?demo=1&view=analytics&month=2026-10&range=month");
      await page.locator(".platformTagTable").waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}px document overflow`);
      assert.equal(await page.locator('.platformComparisonSet[data-layout="stacked"] .platformComparisonGrid').count(),4);
      assert.equal(await page.locator(".platformTagRow").count(),5);
      assert.deepEqual(errors,[]);
      if(width>=1024)assert.equal(await page.locator(".platformTagTable").evaluate(element=>element.scrollWidth>element.clientWidth),false,`${width}px topic matrix should fit without clipping`);
      else assert.equal(await page.locator(".platformTagTable").evaluate(element=>element.scrollWidth>element.clientWidth),true,"Mobile topic matrix should scroll inside its card");
      await page.screenshot({path:`/tmp/mbw-media-analytics-${width}.png`,fullPage:true});
      console.log(`${width}px: full-width platform rows, topic matrix, and page overflow passed`);
      await page.close();
    }
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
