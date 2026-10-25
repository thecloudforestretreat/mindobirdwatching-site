import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHmac,webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../mbw-stripe-checkout-worker-v44.js',import.meta.url),'utf8');
function harness({status='void',fail=false,mismatch=false}={}){
 const row={payment_id:'PAY-in_QA',invoice_id:'in_QA',invoice_no:'QA-1',inquiry_id:'INQ-QA',guest_id:'G-QA',payment_status:'unpaid',total_booking_price:125,total_amount_paid:0,balance_remaining:125,notes:'Original audit note'};
 const calls=[],writes=[];let failing=fail;const invoice={id:'in_QA',livemode:true,status,metadata:{inquiry_id:'INQ-QA',guest_id:mismatch?'G-WRONG':'G-QA'}};
 const c={Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,crypto:webcrypto,Date,console:{log(){}},setTimeout,clearTimeout,fetch:async(url,opt={})=>{
  calls.push({url:String(url),method:opt.method});
  if(String(url).startsWith('https://api.stripe.com/v1/invoices/')){assert.equal(opt.method,'GET');return Response.json(invoice);}
  if(url==='https://qa.invalid/crm'){
   const payload=JSON.parse(new URLSearchParams(opt.body).get('payload'));
   if(payload.action==='list_payments')return Response.json({ok:true,records:[structuredClone(row),{...row,inquiry_id:'INQ-OTHER',invoice_id:'in_OTHER'}]});
   assert.equal(payload.action,'upsert_payment');writes.push(payload);if(failing)return Response.json({ok:false,error:'QA failure'});
   Object.assign(row,payload.payment);return Response.json({ok:true,record:row});
  }throw Error('Unexpected destination '+url);
 }};vm.createContext(c);vm.runInContext(source.replace('export default {','globalThis.worker = {'),c);
 const env={CF_SHARED_SECRET:'QA-secret',STRIPE_SECRET_KEY:'sk_QA',STRIPE_WEBHOOK_SECRET:'QA-signature',CRM_API_URL:'https://qa.invalid/crm'};
 return {row,calls,writes,invoice,recover(){failing=false;},manual:(token='QA-secret',id='INQ-QA')=>c.worker.fetch(new Request('https://qa.invalid/api/invoices/reconcile',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({inquiry_id:id})}),env,{}),event:(type='invoice.voided',live=true)=>{const t=Math.floor(Date.now()/1000),body=JSON.stringify({id:'evt_QA',created:t,type,livemode:live,data:{object:{object:'invoice',id:'in_QA'}}}),sig=createHmac('sha256','QA-signature').update(t+'.'+body).digest('hex');return c.worker.fetch(new Request('https://qa.invalid/webhook',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${sig}`},body}),env,{waitUntil(){throw Error('Must be synchronous');}});}};
}
test('private reconciliation rejects unauthorized and malformed requests before lookup',async()=>{const h=harness();assert.equal((await h.manual('bad')).status,401);assert.equal((await h.manual('QA-secret','bad')).status,400);assert.equal(h.calls.length,0);});
for(const status of ['void','uncollectible'])test(status+' updates the existing payment once, preserving amounts and booking/deposit state',async()=>{const h=harness({status});assert.equal((await h.manual()).status,200);assert.equal(h.row.payment_status,status);assert.equal(h.row.payment_id,'PAY-in_QA');assert.equal(h.row.balance_remaining,125);assert.equal(h.row.total_amount_paid,0);assert.match(h.row.notes,/Original audit note/);assert.equal((await h.manual()).status,200);assert.equal(h.writes.length,1);assert.ok(h.calls.every(x=>x.url==='https://qa.invalid/crm'||x.method==='GET'));});
for(const status of ['open','paid','draft'])test('manual refresh does not change '+status+' invoice',async()=>{const h=harness({status});assert.equal((await h.manual()).status,200);assert.equal(h.writes.length,0);});
for(const type of ['invoice.voided','invoice.marked_uncollectible'])test(type+' is awaited and retries failed CRM writes',async()=>{const h=harness({fail:true,status:type.includes('uncollectible')?'uncollectible':'void'});assert.equal((await h.event(type)).status,500);h.recover();assert.equal((await h.event(type)).status,200);assert.equal((await h.event(type)).status,200);assert.equal(h.row.payment_status,h.invoice.status);assert.equal(h.writes.length,2);});
test('sandbox invoice status events cannot write live CRM',async()=>{const h=harness();assert.equal((await h.event('invoice.voided',false)).status,200);assert.equal(h.calls.length,0);});
test('late void event cannot overwrite a currently paid invoice',async()=>{const h=harness({status:'paid'});assert.equal((await h.event()).status,200);assert.equal(h.writes.length,0);});
test('mismatched guest fails closed without a write',async()=>{const h=harness({mismatch:true});assert.equal((await h.manual()).status,503);assert.equal(h.writes.length,0);});
test('sandbox invoice is rejected by live reconciliation',async()=>{const h=harness();h.invoice.livemode=false;assert.equal((await h.manual()).status,503);assert.equal(h.writes.length,0);});
