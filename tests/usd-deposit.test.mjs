import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,createHmac} from 'node:crypto';
const source=fs.readFileSync(new URL('../mbw-stripe-checkout-worker-v44.js',import.meta.url),'utf8');
function harness({status='quoted',payment='unpaid',existing=false,crmFailure=false}={}){
 const calls=[],logged=new Map();const secret='qa-webhook-secret';
 const record={inquiry_id:'INQ-QA-USD',guest_id:'G-QA-USD',status,payment_status:payment,guest_count:'2',requested_date:'2027-01-15',quoted_amount:480};
 const context={Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,Date,crypto:webcrypto,console:{log(){}},setTimeout,clearTimeout,fetch:async(url,options={})=>{
  const address=String(url);calls.push({url:address,...options});
  if(address==='https://qa.invalid/crm'){
   const payload=JSON.parse(new URLSearchParams(options.body).get('payload'));
   if(payload.action==='list_inquiries')return Response.json({records:[record]});
   if(crmFailure)return Response.json({ok:false,error:'QA fail'});
   assert.equal(payload.action,'update_inquiry');assert.equal(payload.record.payment_status,payment==='paid'?'paid':'deposit_paid');assert.equal(payload.record.status,undefined);
   return Response.json({ok:true});
  }
  if(address.startsWith('https://api.stripe.com/v1/payment_intents/search'))return Response.json({data:existing?[{id:'pi_existing',metadata:{}}]:[]});
  if(address==='https://api.stripe.com/v1/checkout/sessions')return Response.json({id:'cs_test_QA123',url:'https://checkout.stripe.com/c/pay/cs_test_QA123',currency:'usd',amount_total:10000,adaptive_pricing:{enabled:false}});
  if(address.startsWith('https://api.stripe.com/v1/payment_intents/pi_QA'))return Response.json({id:'pi_QA',latest_charge:{id:'ch_QA',receipt_url:'https://pay.stripe.com/receipts/QA',balance_transaction:{fee:320}}});
  if(address==='https://qa.invalid/logger'){const body=JSON.parse(options.body);logged.set(body.fields.stripe_payment_intent,body.fields);return Response.json({ok:true});}
  throw Error('Unexpected destination '+address);
 }};
 vm.createContext(context);vm.runInContext(source.replace('export default {','globalThis.worker = {'),context);
 const env={STRIPE_SECRET_KEY:'sk_QA',STRIPE_SECRET_KEY_TEST:'sk_test_QA',STRIPE_WEBHOOK_SECRET:secret,STRIPE_WEBHOOK_SECRET_TEST:secret,CRM_API_URL:'https://qa.invalid/crm',GSHEET_WEBAPP_URL:'https://qa.invalid/logger'};
 const create=body=>context.worker.fetch(new Request('https://qa.invalid/stripe/api/create-deposit-session',{method:'POST',body:JSON.stringify({inquiry_id:record.inquiry_id,...body})}),env,{});
 const webhook=async({live=true,paid=true,currency='usd',amount=10000}={})=>{
  const timestamp=Math.floor(Date.now()/1000),event={id:'evt_QA',type:'checkout.session.completed',created:timestamp,livemode:live,data:{object:{id:'cs_QA',currency,amount_total:amount,payment_status:paid?'paid':'unpaid',payment_intent:'pi_QA',client_reference_id:record.inquiry_id,customer:'cus_QA',metadata:{source_system:'mbw_usd_deposit',payment_purpose:'tour_deposit',inquiry_id:record.inquiry_id,guest_id:record.guest_id}}}};
  const body=JSON.stringify(event),sig=createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
  return context.worker.fetch(new Request('https://qa.invalid/stripe/webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${sig}`},body}),env,{waitUntil(){throw Error('Deposit webhook must be awaited');}});
 };
 return {create,webhook,calls,logged,context,env};
}
test('fixed USD deposit ignores browser amounts and identity; preserves CRM metadata on Session and PaymentIntent',async()=>{
 const h=harness();const response=await h.create({amount:1,currency:'cad',guest_id:'G-WRONG',brand_id:'mindo-tours'});assert.equal(response.status,200);
 const call=h.calls.find(c=>c.url.endsWith('/checkout/sessions'));const f=new URLSearchParams(call.body);
 assert.equal(f.get('adaptive_pricing[enabled]'),'false');assert.equal(f.get('line_items[0][price_data][currency]'),'usd');assert.equal(f.get('line_items[0][price_data][unit_amount]'),'10000');assert.equal(f.get('line_items[0][quantity]'),'1');assert.equal(f.get('customer_creation'),'always');assert.equal(f.get('metadata[guest_id]'),'G-QA-USD');assert.equal(f.get('payment_intent_data[metadata][inquiry_id]'),'INQ-QA-USD');assert.equal(f.get('metadata[billing_brand_id]'),'mbw');assert.equal(f.get('metadata[marketing_brand_id]'),'mindo-tours');assert.equal(f.get('customer_email'),null);assert.ok(call.headers['Idempotency-Key']);
});
test('sandbox checkout only contacts Stripe and requires fictional QA identifiers',async()=>{
 const h=harness();assert.equal((await h.create({stripe_environment:'sandbox'})).status,200);assert.ok(h.calls.every(c=>c.url.startsWith('https://api.stripe.com/')));assert.equal((await h.create({inquiry_id:'INQ-REAL',stripe_environment:'sandbox'})).status,400);
});
for(const status of ['completed','cancelled','duplicate','did_not_book'])test('closed '+status+' inquiry cannot create deposit',async()=>{const h=harness({status});assert.equal((await h.create({})).status,409);assert.ok(!h.calls.some(c=>c.url.endsWith('/checkout/sessions')));});
test('already paid inquiry and recorded deposit are blocked',async()=>{assert.equal((await harness({payment:'paid'}).create({})).status,409);assert.equal((await harness({existing:true}).create({})).status,409);});
test('sandbox payment events never touch live CRM/accounting',async()=>{const h=harness();assert.equal((await h.webhook({live:false})).status,200);assert.equal(h.calls.length,0);});
test('unpaid checkout is not recorded as a deposit',async()=>{const h=harness();assert.equal((await h.webhook({paid:false})).status,200);assert.equal(h.calls.length,0);});
test('paid deposit retries without duplicate accounting and does not confirm a tour or create invoice ledger revenue',async()=>{
 const h=harness();assert.equal((await h.webhook()).status,200);assert.equal((await h.webhook()).status,200);assert.equal(h.logged.size,1);const row=h.logged.get('pi_QA');assert.equal(row.gross_payment_amount,'100.00');assert.equal(row.deposit_status,'available');assert.equal(row.stripe_customer_id,'cus_QA');assert.equal(row.record_type,'deposit');assert.ok(!h.calls.some(c=>c.url.includes('booking_confirmation')));
});
test('deposit cannot downgrade an already paid CRM record',async()=>{const h=harness({payment:'paid'});assert.equal((await h.webhook()).status,200);});
test('CRM failure returns retryable error rather than acknowledging lost update',async()=>{const h=harness({crmFailure:true});assert.equal((await h.webhook()).status,500);});
for(const opts of [{currency:'cad'},{amount:9999}])test('wrong amount/currency cannot reach accounting '+JSON.stringify(opts),async()=>{const h=harness();assert.equal((await h.webhook(opts)).status,500);assert.equal(h.calls.length,0);});
test('invoice deposit attachment preserves original credit and marks it applied',async()=>{
 const h=harness();const calls=[];h.context.stripeRequest=async(env,isTest,method,path,form)=>{calls.push({method,path,form});return {id:'in_QA',amount_due:38000};};
 await h.context.attachDepositToInvoice(h.env,false,{id:'in_QA',amount_due:48000},{id:'pi_QA',customer:'cus_QA',amount_received:10000},'INQ-QA-USD','G-QA-USD');
 assert.ok(calls.some(c=>c.path==='/v1/invoices/in_QA/attach_payment'&&c.form.get('payment_intent')==='pi_QA'));const applied=calls.find(c=>c.path==='/v1/payment_intents/pi_QA');assert.equal(applied.form.get('metadata[applied_invoice_id]'),'in_QA');assert.equal(applied.form.get('metadata[deposit_status]'),'applied');
});
