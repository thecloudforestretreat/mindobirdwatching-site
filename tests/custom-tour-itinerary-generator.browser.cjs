const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const root=process.cwd();
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  let rel=decodeURIComponent(url.pathname).replace(/^\//,'');
  if(rel.endsWith('/'))rel+='index.html';
  const candidates=[path.join(root,'admin',rel),path.join(root,rel)];
  const file=candidates.find(candidate=>candidate.startsWith(root)&&fs.existsSync(candidate)&&fs.statSync(candidate).isFile());
  if(!file){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/octet-stream');
  res.end(fs.readFileSync(file));
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
  try{
    for(const width of [390,1440]){
      const context=await browser.newContext({viewport:{width,height:1000}});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('https://**/*',route=>route.fulfill({status:200,body:'',contentType:'application/octet-stream'}));
      await page.goto(origin+'/itinerary-generator/');
      await page.locator('#communicationBrand').waitFor();
      await page.locator('#guestPriceView').selectOption('itemized');
      await page.locator('#dailyContentView').selectOption('services');
      while(await page.locator('.itemEditor').count())await page.locator('.itemEditor').first().locator('[data-action=remove]').click();
      await page.locator('#guestCount').fill('4');
      await page.locator('#addItemBtn').click();
      const item=page.locator('.itemEditor').last();
      await item.locator('[data-field=productPreset]').selectOption('TOUR002 - Custom Full-Day Tour');
      assert.equal(await item.locator('[data-field=type]').inputValue(),'Custom');
      assert.equal(await item.locator('[data-field=duration]').inputValue(),'Full Day');
      assert.equal(await item.locator('[data-field=quantity]').inputValue(),'1');
      assert.equal(await item.locator('[data-field=unitPrice]').inputValue(),'100');
      assert.match(await item.locator('[data-catalog-meta]').innerText(),/Needs quote/);
      assert.match(await item.locator('[data-catalog-meta]').innerText(),/Starting reference \$100\.00/);
      await item.locator('[data-field=unitPrice]').fill('725');
      assert.match(await item.locator('[data-catalog-meta]').innerText(),/Approved quote/);
      assert.equal(Number((await page.locator('#subtotalValue').innerText()).replace(/[^0-9.-]/g,'')),725);
      assert.doesNotMatch(await page.locator('#guestPreview').innerText(),/× 4/);
      await page.locator('#language').selectOption('es');
      assert.match(await page.locator('#guestPreview').innerText(),/Tour Personalizado de Día Completo/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);
      await context.close();
    }
    console.log('Custom itinerary package pricing, approved quote, bilingual output and responsive layout passed');
  }finally{
    await browser.close();
    server.close();
  }
})().catch(error=>{console.error(error);server.close();process.exit(1);});
