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
      await context.addInitScript(record=>localStorage.setItem('mbwSelectedCrmRecord',JSON.stringify(record)),{
        inquiry_id:'QA-CUSTOM',guest_id:'G-CUSTOM',full_name:'Custom Guest',guest_count:4,
        tour_items_json:JSON.stringify([{product_selected:'TOUR002 - Custom Full-Day Tour',price:725}])
      });
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('https://**/*',route=>route.fulfill({status:200,body:'',contentType:'application/octet-stream'}));
      await page.goto(origin+'/custom-email-generator/?inquiry_id=QA-CUSTOM&guest_id=G-CUSTOM');
      await page.locator('[data-block-id="tour-custom-full-day"]').waitFor();
      assert.equal(await page.locator('[data-block-id="tour-custom-half-day"]').count(),1);
      assert.equal(await page.locator('[data-block-id="tour-custom-full-day"] input[type=checkbox]').isChecked(),true);
      assert.equal(await page.locator('[data-block-id="tour-custom-full-day"] [data-override=price]').inputValue(),'US$725 total');
      assert.match(await page.locator('#emailPreview').innerText(),/Custom Full-Day Tour/);
      assert.match(await page.locator('#emailPreview').innerText(),/US\$725 total/);
      await page.locator('#languageInput').selectOption('es');
      assert.match(await page.locator('#emailPreview').innerText(),/Tour Personalizado de Día Completo/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);
      await context.close();
    }
    console.log('Custom tour email cards, CRM quote handoff, bilingual copy and responsive layout passed');
  }finally{
    await browser.close();
    server.close();
  }
})().catch(error=>{console.error(error);server.close();process.exit(1);});
