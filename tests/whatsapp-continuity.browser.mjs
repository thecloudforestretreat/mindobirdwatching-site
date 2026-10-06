import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
import {sampleThreads} from '../admin/assets/js/whatsapp-model.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));let writes=0;
 const snapshot={ok:true,mode:'shared_test',sendingEnabled:false,metaConnected:false,identity:'Juan',threads:sampleThreads().map(t=>({...t,revision:1})),staff:[{email:'Juan',name:'Juan'},{email:'Susana',name:'Susana'}],replies:[],learning:[],events:[],learningHistory:[],exportedAt:new Date().toISOString()};
 await page.route('**/*',async route=>{const u=new URL(route.request().url());
  if(u.pathname==='/api/whatsapp/workspace'){if(route.request().method()==='POST')writes++;return route.fulfill({json:snapshot});}
  if(u.pathname==='/api/whatsapp')return route.fulfill({json:{knowledge:{status:'connected',items:[]}}});
  if(u.pathname.includes('/inquiry-studio/'))return route.fulfill({status:503,json:{ok:false,error:'Offline test'}});
  const file=u.pathname==='/whatsapp/'?'admin/whatsapp/index.html':u.pathname.startsWith('/assets/')?'admin'+u.pathname:u.pathname.slice(1),full=path.join(process.cwd(),file);
  return route.fulfill(fs.existsSync(full)?{body:fs.readFileSync(full),contentType:file.endsWith('.css')?'text/css':/\.(js|mjs)$/.test(file)?'application/javascript':'text/html'}:{status:404,body:''});
 });
 await page.goto('http://localhost/whatsapp/');await page.locator('[data-thread="sample-1"]').click();await page.locator('.reply-shortcuts button').filter({hasText:'Handoff'}).click();
 if(!await page.locator('#handoff-summary').evaluate(el=>el.open))throw Error('Handoff not accessible');
 if(!await page.locator('#handoff-content').textContent().then(s=>s.includes('Latest guest request')))throw Error('Handoff context missing');
 await page.locator('.workspace-support').evaluate(el=>el.open=true);await page.locator('#connect-shared').click();await page.locator('#export-shared').waitFor({state:'visible'});await page.locator('#export-shared').click();
 await page.locator('#backup-password').fill('a long test passphrase');const downloadPromise=page.waitForEvent('download');await page.locator('#backup-download').click();const download=await downloadPromise,file=await download.path();
 const encrypted=fs.readFileSync(file,'utf8');if(encrypted.includes('Alex'))throw Error('Backup was not encrypted');
 await page.locator('#backup-password').fill('a long test passphrase');const before=writes;await page.locator('#backup-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(encrypted)});
 await page.waitForFunction(()=>document.querySelector('#backup-state').textContent.includes('Backup verified'));
 if(writes!==before)throw Error('Recovery preview wrote shared state');
 if(!await page.locator('#backup-preview').textContent().then(s=>s.includes('4 conversations')))throw Error('Recovery counts absent');
 await page.locator('#backup-password').fill('incorrect password');await page.locator('#backup-file').setInputFiles({name:'bad-password.json',mimeType:'application/json',buffer:Buffer.from(encrypted)});
 await page.waitForFunction(()=>document.querySelector('#backup-state').textContent.includes('Cannot unlock'));
 if(await page.locator('#backup-preview').textContent())throw Error('Failed unlock retained preview');
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)||errors.length)throw Error(JSON.stringify(errors));
 console.log(JSON.stringify({width,handoff:true,encryptedExport:true,recoveryPreview:true,wrongPasswordRejected:true,noRestoreWrites:true}));await page.close();
}}finally{await browser.close();}
