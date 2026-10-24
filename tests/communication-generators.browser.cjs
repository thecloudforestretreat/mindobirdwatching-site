const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.cwd();
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');let rel=decodeURIComponent(u.pathname).replace(/^\//,'');if(rel.endsWith('/'))rel+='index.html';const files=[path.join(root,'admin',rel),path.join(root,rel)];const file=files.find(p=>p.startsWith(root)&&fs.existsSync(p)&&fs.statSync(p).isFile());if(!file){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':file.endsWith('.jpeg')?'image/jpeg':'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});try{
for(const width of [390,1440])for(const tool of ['custom-email-generator','itinerary-generator']){
 const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',async route=>{const u=new URL(route.request().url());if(u.pathname==='/api/reviews')return route.fulfill({json:{ok:true,summary:{rating:4.9,review_count:20},place:{maps_url:'https://example.com/reviews'}}});if(u.pathname.startsWith('/assets/images/')){const p=path.join(root,u.pathname);if(fs.existsSync(p))return route.fulfill({path:p});}if(u.pathname.includes('logo')){const name=u.hostname==='mindotours.com'?'mindotours.com':u.hostname==='chocoandinotours.com'?'chocoandinotours.com':'mindobirdwatching.com';return route.fulfill({path:path.join(root,'admin/portfolio/brands',name+'.png')});}return route.fulfill({status:200,body:'',contentType:'application/javascript'});});
 await page.goto(origin+'/'+tool+'/');await page.locator('#communicationBrand').waitFor();await page.waitForTimeout(200);
 if(errors.length)throw Error(tool+': '+JSON.stringify(errors));
 const email=tool==='custom-email-generator',preview=email?'#emailPreview':'#guestPreview';
 
 await page.locator(email?'#guestNameInput':'#guestName').fill('Test Guest');
 if(email){
  const ids=['tour-hummingbird','tour-bear-half-day','activity-canopy','activity-canyoning','activity-coffee','activity-flora','activity-horseback','activity-macro','activity-orchid','activity-paintball','activity-quad','activity-tubing','activity-mountain-biking','activity-mountain-biking-waterfalls'];
  for(const id of ids){
   await page.locator('[data-block-id="'+id+'"] input[type=checkbox]').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
  }
  const images=await page.locator(preview+' img').evaluateAll(xs=>xs.map(x=>x.getAttribute('src')));
  for(const suffix of ['hummingbirds','spectacled-bear'])assert(images.some(x=>x.includes('mbw-tour-'+suffix+'-001.jpeg')));
  for(const suffix of ['canopy-001','canyoning-001','coffee-tour-002','flora-excursion-001','horseback-riding-001','macro-001','orchid-tour-001','paintball-001','quad-tour-001','tubing-001','mountain-biking-001'])assert(images.some(x=>x.includes('mbw-activities-'+suffix+'.jpeg')),suffix);
  await page.locator('[data-block-id="activity-canopy"] [data-override="price"]').evaluate(el=>{el.value='Agreed rate: $28';el.dispatchEvent(new Event('input',{bubbles:true}));});
 }else{
  assert.equal(await page.locator('#showImages').isChecked(),false);
  assert.equal(await page.locator(preview+' img[src*="/assets/images/pages/"],'+preview+' img[src*="/assets/images/activities/"]').count(),0);
  assert(await page.locator(preview+' img').count()>0,'Brand logo must remain visible');
  await page.locator('#showImages').check();
  await page.locator('#guestCount').fill('1');
  await page.locator('#addItemBtn').click();const last=page.locator('.itemEditor').last();
  await last.locator('[data-field=productPreset]').selectOption({label:'MBW019 - Hummingbird Tour'});assert.equal(await last.locator('[data-field=unitPrice]').inputValue(),'75');assert.equal(await last.locator('[data-field=quantity]').inputValue(),'1');
  await last.locator('[data-field=productPreset]').selectOption({label:'ACT011 - Mindo River Tubing'});assert.equal(await last.locator('[data-field=unitPrice]').inputValue(),'10');assert.equal(await last.locator('[data-field=quantity]').inputValue(),'4');
  await last.locator('[data-field=productPreset]').selectOption('ACT017 - Mountain Biking');assert.equal(await last.locator('[data-field=unitPrice]').inputValue(),'20');assert.equal(await last.locator('[data-field=duration]').inputValue(),'2 Hours');
  await last.locator('[data-field=productPreset]').selectOption('ACT017-R2 - Mountain Biking - Cable Car and Waterfalls Route');assert.equal(await last.locator('[data-field=unitPrice]').inputValue(),'50');
  await last.locator('[data-field=productPreset]').selectOption('MBW013 - Waterfall Hike');assert.equal(await page.locator(preview+' img[src*="mbw_waterfall_003.jpg"]').count(),1);
  await page.locator('#addItemBtn').click();
  await page.locator('#guestCount').fill('2');
  await last.locator('[data-field=productPreset]').selectOption({label:'ACT021 - Private Insect & Macro Wildlife Search'});await last.locator('[data-field=unitPrice]').fill('105');
 }
 const before=email?null:await page.locator('#subtotalValue').innerText();
 for(const [id,name]of [['mindo-tours','Mindo Tours'],['choco-andino','Chocó Andino Tours'],['mbw','Mindo Bird Watching']]){
  await page.locator('#communicationBrand').selectOption(id);await page.waitForTimeout(50);
  const html=await page.locator('#htmlOutput').inputValue();assert(html.includes(name));if(id!=='mbw')assert(html.includes('https://www.instagram.com/'+(id==='mindo-tours'?'mindo.tours':'chocoandino.tours')+'/'));assert((await page.locator(preview).innerText()).includes(name));
  if(email){assert(html.includes('Agreed rate: $28'));const wa=await page.locator(preview+' a[href*="wa.me"]').first().getAttribute('href');assert(decodeURIComponent(wa).includes(name));}
  if(!email){assert.equal(await page.locator('.itemEditor').last().locator('[data-field=unitPrice]').inputValue(),'105');assert.equal(await page.locator('#subtotalValue').innerText(),before);}
 }
 await page.locator('#communicationBrand').selectOption('choco-andino');
 await page.locator(email?'#languageInput':'#language').selectOption('es');
 assert((await page.locator('#htmlOutput').inputValue()).includes('Experiencias en el Chocó Andino'));
 if(email){assert((await page.locator('#htmlOutput').inputValue()).includes('Paseo en cuatrimoto'));assert((await page.locator('#htmlOutput').inputValue()).includes('$110 por persona por sesión privada'));}
 else assert((await page.locator('#htmlOutput').inputValue()).includes('mbw-activities-macro-001.jpeg'));
 if(!email){
  const total=await page.locator('#totalValue').innerText();await page.locator('#showImages').uncheck();const compact=await page.locator('#htmlOutput').inputValue();assert(!compact.includes('mbw_waterfall_003.jpg'));assert(!compact.includes('mbw-activities-macro-001.jpeg'));assert.equal(await page.locator('#totalValue').innerText(),total);
 }
 const download=page.waitForEvent('download');await page.locator(email?'#downloadHtmlBtn':'#downloadBtn').click();const file=await download;assert(file.suggestedFilename().startsWith('choco-andino-'));const downloaded=fs.readFileSync(await file.path(),'utf8');assert(downloaded.includes('Chocó Andino Tours'));assert(downloaded.includes('Experiencias en el Chocó Andino'));if(!email){assert(!downloaded.includes('mbw_waterfall_003.jpg'));assert(!downloaded.includes('mbw-activities-macro-001.jpeg'));}
 await page.reload();await page.waitForTimeout(200);assert.equal(await page.locator('#communicationBrand').inputValue(),'choco-andino');
 assert.equal(await page.locator(email?'#guestNameInput':'#guestName').inputValue(),email?'Test Guest':'Test Guest');
 if(!email){assert.equal(await page.locator('.itemEditor').last().locator('[data-field=unitPrice]').inputValue(),'105');assert.equal(await page.locator('#showImages').isChecked(),false);await page.locator('#showImages').check();await page.reload();await page.waitForTimeout(150);assert.equal(await page.locator('#showImages').isChecked(),true);assert.equal(await page.locator(preview+' img[src*="mbw_waterfall_003.jpg"]').count(),1);}
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow,tool+' overflow at '+width);
 if(errors.length)throw Error(JSON.stringify(errors));
 await page.screenshot({path:'/tmp/mbw-'+tool+'-'+width+'.png',fullPage:true});console.log(JSON.stringify({tool,width,brandSwitch:true,draftRestored:true,overflow,errors}));
 if(email){
  await page.goto(origin+'/'+tool+'/?guest=New%20Guest&inquiry_id=QA-new');await page.waitForTimeout(150);assert.equal(await page.locator('#guestNameInput').inputValue(),'New Guest');assert.equal(await page.locator('#communicationBrand').inputValue(),'mbw');assert(!(await page.locator('#htmlOutput').inputValue()).includes('Agreed rate: $28'));
 }
 await context.close();
}
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exit(1)});
