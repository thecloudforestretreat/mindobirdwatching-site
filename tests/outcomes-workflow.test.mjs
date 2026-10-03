import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const auth=new AsyncFunction('$json','require','Buffer',fs.readFileSync(new URL('../integrations/n8n/authorize-outcomes.js',import.meta.url),'utf8'));
const aggregate=new Function('$','$input',fs.readFileSync(new URL('../integrations/n8n/aggregate-outcomes.js',import.meta.url),'utf8'));
const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...publicKey.export({format:'jwk'}),kid:'test'};
const claims={iss:'https://tcfr-mbw.cloudflareaccess.com',aud:['62ad79ee3af18f90b4827d5a84be038d4df901a56cbc21abda1ac5991ea89060'],exp:Math.floor(Date.now()/1000)+60,email:'admin@example.com'};
function token(c=claims){const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url'),b=Buffer.from(JSON.stringify(c)).toString('base64url');return h+'.'+b+'.'+crypto.sign('RSA-SHA256',Buffer.from(h+'.'+b),privateKey).toString('base64url');}
const {onRequestGet:verifyCallback}=await import('../functions/api/outcomes-identity.js');
globalThis.fetch=async()=>new Response(JSON.stringify({keys:[jwk]}));
const context={helpers:{httpRequest:async({url,headers})=>{
  assert.equal(url,'https://admin.mindobirdwatching.com/api/outcomes-identity');
  assert.equal(headers.Cookie,'CF_Authorization='+headers['Cf-Access-Jwt-Assertion']);
  const r=await verifyCallback({request:new Request(url,{headers})});
  if(!r.ok)throw new Error('Denied');return r.json();
}}};
const invoke=(t,body={source:'website',start:'2026-09-01',end:'2026-09-30'})=>auth.call(context,{headers:{'cf-access-jwt-assertion':t},body},()=>{throw new Error('Modules unavailable');},Buffer);
test('upstream gate verifies signature through existing origin verifier without n8n modules',async()=>{
  const r=await invoke(token());assert.equal(r[0].json.authorized,true);assert.equal(r[0].json.source,'website');assert.doesNotMatch(JSON.stringify(r),/admin@example|jwt|headers/);
  for(const t of ['',token({...claims,email:'faustoandrade635@gmail.com'}),token({...claims,exp:0}),token({...claims,aud:['other']}),token().slice(0,-8)+'invalid!'])assert.equal((await invoke(t))[0].json.authorized,false);
  assert.equal((await invoke(token(),{source:'website',start:'bad',end:'bad'}))[0].json.authorized,false);
  assert.equal((await verifyCallback({request:new Request('https://other.example/api/outcomes-identity',{headers:{'Cf-Access-Jwt-Assertion':token()}})})).status,401);
  assert.equal((await auth.call({helpers:{httpRequest:async()=>({authorized:false})}},{headers:{'cf-access-jwt-assertion':token()},body:{source:'guests'}}))[0].json.authorized,false);
});
test('published aggregate code returns only counts, preserving historical bookings without invented inquiry dates',()=>{const options={source:'website',start:'2026-09-01',end:'2026-09-30',today:'2026-10-03'};const crm=[{inquiry_id:'a',email:'guest@example.com',country:'Spain',created_at:'2026-09-01',requested_date:'2026-09-10',status:'completed'}],invoices=[{invoice_no:'old1',guest_email:'guest@example.com',tour_date:'2026-09-10',tour_completed:'Yes',home_country:'Spain',party_size:2},{invoice_no:'old2',guest_email:'guest@example.com',tour_date:'2026-09-20',tour_completed:'Yes',home_country:'Spain',party_size:2}];const result=aggregate(name=>({first:()=>({json:name==='Authorize Administrator'?options:{records:crm}})}),{all:()=>invoices.map(json=>({json}))});assert.equal(result[0].json.demand.rows[0].completedTours,2);assert.equal(result[0].json.demand.rows[0].inquiries,1);assert.equal(result[0].json.demand.pipeline.rows[0].cohort,1);assert.doesNotMatch(JSON.stringify(result),/guest@example|old1|old2|inquiry_id|guest_email/);});
