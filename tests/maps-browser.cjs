const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/Users/jpg/Tools/site-qa/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});const findings=[];
 for(const width of [320,768,1440]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8797/analytics/maps/');await page.locator('#report').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelectorAll('#countries path').length>150);
  assert.equal(await page.locator('#table-body tr').count(),5);
  assert.match(await page.locator('#table-body').innerText(),/prior only/);
  assert.equal(await page.locator('#city-body tr').count(),5);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow at '+width);
  await page.locator('#table-body button').filter({hasText:'United States'}).click();assert.match(await page.locator('#selection').innerText(),/140/);
  await page.selectOption('#measure','engagedSessions');assert.match(await page.locator('#legend-max').innerText(),/Engaged sessions/);
  await page.selectOption('#scale','linear');await page.click('#zoom-in');assert.notEqual(await page.locator('#map').getAttribute('viewBox'),'0 0 900 405');await page.click('#reset');
  await page.click('#clear-scope');await page.fill('#search','Canada');assert.equal(await page.locator('#table-body tr').count(),1);await page.fill('#search','');
  await page.selectOption('#palette','blue');
  await page.selectOption('#geography','cities');assert.ok(await page.locator('#city-markers circle').count()>=4);
  await page.selectOption('#city-style','glow');assert.ok(await page.locator('#map-defs radialGradient').count()>=4);
  await page.selectOption('#country','US');assert.equal(await page.locator('#city-body tr').count(),2);
  await page.locator('#city-body button').filter({hasText:'New York City'}).click();assert.match(await page.locator('#trend-title').innerText(),/New York City/);assert.match(await page.locator('#sources').innerText(),/google/);assert.doesNotMatch(await page.locator('#sources').innerText(),/partner/);
  await page.click('#clear-city');assert.match(await page.locator('#sources').innerText(),/partner/);
  await page.click('#presentation');assert.equal(await page.locator('#briefing').isVisible(),true);
  const briefDownload=page.waitForEvent('download');await page.click('#download-brief');const brief=await briefDownload;const file=require('node:fs').readFileSync(await brief.path(),'utf8');assert.match(file,/Demand briefing/);assert.doesNotMatch(file,/<script|private@example.com|<iframe|fetch\(/i);assert.match(file,/New York/);
  await page.click('#presentation');await page.click('#clear-scope');
  await page.click('#guests');await page.locator('#report').waitFor({state:'visible'});assert.match(await page.locator('#metrics').innerText(),/Booking records/);assert.match(await page.locator('#warning').innerText(),/completion/);
  await page.selectOption('#stage','upcoming');await page.waitForFunction(()=>document.querySelector('#report').hidden===false&&document.querySelectorAll('#table-body tr').length===1);assert.match(await page.locator('#table-body').innerText(),/Canada/);
  const download=page.waitForEvent('download');await page.click('#export');assert.match((await download).suggestedFilename(),/markets.csv/);
  await page.selectOption('#stage','current');await page.waitForFunction(()=>!document.querySelector('#report').hidden);assert.match(await page.locator('#table-body').innerText(),/No country rows/);
  await page.route('**/api/maps?**',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({ok:false,error:'Synthetic outage'})}));await page.click('#refresh');await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#report').isVisible(),false);
  await page.unroute('**/api/maps?**');await page.click('#website');await page.locator('#report').waitFor({state:'visible'});
  await page.screenshot({path:'/private/tmp/mbw-maps-'+width+'.png',fullPage:true});
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>localStorage.length),0);
  findings.push({width,passed:true,countries:await page.locator('#countries path').count()});await page.close();
 }
 await browser.close();console.log(JSON.stringify(findings));
})().catch(error=>{console.error(error);process.exit(1)});
