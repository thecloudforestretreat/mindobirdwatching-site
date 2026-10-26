const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  const page=await browser.newPage();
  const actions=[];
  const errors=[];
  const requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>errors.push(`${request.url()}: ${request.failure()?.errorText||'request failed'}`));
  await page.route('**/*',async route=>{
    const request=route.request();
    const url=new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}`);
    if(url.pathname==='/webhook/mbw-crm-admin-api'){
      const payload=JSON.parse(new URLSearchParams(request.postData()).get('payload'));
      actions.push(payload.action);
      if(payload.action==='list_inquiries')return route.fulfill({json:{ok:true,records:[{
        inquiry_id:'INQ-REFERENCE-QA',guest_id:'G-REFERENCE-QA',full_name:'Robert QA',first_name:'Robert',last_name:'QA',
        status:'new',source_type:'site_book_tour',contact_intent_id:'ci_missing_reference_qa',requested_date:'2027-02-09',
        tour_type:'Other',service_type:'Custom',guest_count:'1',email:'robert@example.test'
      }]}});
      if(payload.action==='lookup_reference')return route.fulfill({json:{ok:false,error:'contact_intent_not_found'}});
      if(payload.action==='update_inquiry'){
        assert.equal(payload.record.status,'planning');
        assert.equal(payload.record.contact_intent_id,'ci_missing_reference_qa');
        return route.fulfill({json:{ok:true,record:payload.record}});
      }
      return route.fulfill({json:{ok:true,records:[]}});
    }
    const file=url.pathname==='/guest-crm/'?'admin/guest-crm/index.html':url.pathname.startsWith('/assets/')?'admin'+url.pathname:url.pathname.slice(1);
    const full=path.join(root,file);
    if(!fs.existsSync(full)||fs.statSync(full).isDirectory())return route.fulfill({status:404,body:''});
    return route.fulfill({body:fs.readFileSync(full),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });

  await page.goto('http://localhost/guest-crm/?inquiry_id=INQ-REFERENCE-QA');
  try{await page.waitForFunction(()=>document.querySelector('#fullNameInput')?.value==='Robert QA',null,{timeout:10000});}
  catch(error){throw new Error(`${error.message}\nRequests: ${requests.join(', ')}\nActions: ${actions.join(', ')}\nPage errors: ${errors.join(', ')}`);}
  await page.locator('[data-view="intake"]').click();
  await page.locator('#recordStatusInput').selectOption('planning');
  await page.locator('#saveBtn').click();
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('reference preserved but unavailable'));

  assert.equal(actions.filter(action=>action==='lookup_reference').length,1);
  assert.equal(actions.filter(action=>action==='update_inquiry').length,1);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Existing CRM record saved with missing attribution reference preserved');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
