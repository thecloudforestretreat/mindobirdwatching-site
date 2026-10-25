import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../mbw-stripe-checkout-worker-v44.js',import.meta.url),'utf8');
function harness({customer=null,refunded=0,applied='',wrongGuest=false,wrongInquiry=false,failCreditOnce=false}={}){
 const calls=[],idempotent=new Map(),items=new Map();let creditFail=failCreditOnce,invoiceCount=0,customerCount=0;
 const deposit={id:'pi_QA',status:'succeeded',amount_received:10000,currency:'usd',customer,metadata:{inquiry_id:wrongInquiry?'INQ-other':'INQ-QA',guest_id:wrongGuest?'G-other':'G-QA',payment_purpose:'tour_deposit',applied_invoice_id:applied},latest_charge:{amount_refunded:refunded}};
 const total=()=>[...items.values()].reduce((sum,f)=>sum+(f.has('amount')?Number(f.get('amount')):Number(f.get('price_data[unit_amount]'))*Number(f.get('quantity'))),0);
 const invoice=()=>({id:'in_QA',number:'QA-1',currency:'usd',status:'open',amount_due:total(),amount_remaining:total()-(customer?10000:0),amount_paid:customer?10000:0,hosted_invoice_url:'https://example.invalid/qa'});
 const ctx={Request,Response,URL,URLSearchParams,TextEncoder,TextDecoder,Date,crypto:webcrypto,console:{log(){}},fetch:async(url,init={})=>{
  const p=new URL(url).pathname,f=new URLSearchParams(init.body),key=init.headers?.['Idempotency-Key'];calls.push({p,f,key,method:init.method});
  if(p==='/v1/payment_intents/pi_QA'&&init.method==='GET')return Response.json(deposit);
  if(key&&idempotent.has(key))return Response.json(idempotent.get(key));
  let out;
  if(p==='/v1/customers'){out={id:'cus_QA'};customerCount++;}
  else if(p==='/v1/customers/cus_QA')out={id:'cus_QA'};
  else if(p==='/v1/invoices'){assert.equal(f.get('pending_invoice_items_behavior'),'exclude');assert.equal(f.get('auto_advance'),'false');out={id:'in_QA',status:'draft'};invoiceCount++;}
  else if(p==='/v1/invoiceitems'){assert.equal(f.get('invoice'),'in_QA','Every line must be bound to a specific invoice');if(f.has('amount')&&creditFail){creditFail=false;return Response.json({error:{message:'Transient mock failure'}},{status:503});}items.set(key||'item-'+items.size,f);out={id:'ii_'+items.size};}
  else if(p==='/v1/invoices/in_QA/attach_payment')out={id:'in_QA'};
  else if(p==='/v1/payment_intents/pi_QA')out={id:'pi_QA'};
  else if(p.startsWith('/v1/invoices/in_QA'))out=invoice();
  else throw Error('Unexpected external destination '+p);
  if(key)idempotent.set(key,out);return Response.json(out);
 }};vm.createContext(ctx);vm.runInContext(source.replace('export default {','globalThis.worker = {'),ctx);
 // Local-only QA stubs: these tests never contact accounting, CRM or guest email services.
 ctx.postToAgentActivityLogger=async()=>({ok:true});ctx.syncRevenueAttribution=async()=>({ok:true});ctx.syncCrmInvoiceLedger=async()=>({ok:true});
 const base={language:'en',stripe_environment:'sandbox',tour_code:'MBW004',number_of_people:2,price_override_per_person:99,price_adjustment_per_person:39,pricing_reason:'Historical agreed rate',main_contact_name:'QA Guest',main_contact_email:'qa@example.invalid',main_contact_phone:'+15555550100',whatsapp_number:'+15555550100',pickup_location_label:'QA hotel',pickup_address_or_hotel:'QA hotel',tour_date:'2026-11-12',inquiry_id:'INQ-QA',guest_id:'G-QA',deposit_payment_intent_id:'pi_QA'};
 const run=async(multi=false,withoutDeposit=false)=>{const payload=multi?{...base,items:[{tour_code:'MBW004',language:'en',number_of_people:2,quantity:2,tour_date:base.tour_date,price_override_per_person:99,price_adjustment_per_person:39,pricing_reason:'Historical agreed rate'}]}:base;if(withoutDeposit)delete payload.deposit_payment_intent_id;const r=await ctx.worker.fetch(new Request('https://example.invalid/stripe/api/create-invoice'+(multi?'-multi':''),{method:'POST',body:JSON.stringify(payload)}),{STRIPE_SECRET_KEY_TEST:'sk_mock'},{});return {status:r.status,body:await r.json()};};
 return {ctx,calls,run,stats:()=>({invoiceCount,customerCount,items:items.size,total:total()})};
}
for(const multi of [false,true])for(const customer of [null,'cus_QA'])test(`${multi?'multi':'single'} invoice credits $100 once against $198 (${customer?'attached payment':'historical credit'})`,async()=>{const h=harness({customer});const r=await h.run(multi);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.amount_before_deposit,198);assert.equal(r.body.deposit_applied_amount,100);assert.equal(r.body.amount_remaining,98);assert.equal(h.stats().invoiceCount,1);assert.equal(h.calls.some(c=>c.p.endsWith('/send')),false);});
for(const opts of [{refunded:10000},{refunded:100},{applied:'in_existing'},{wrongGuest:true},{wrongInquiry:true}])test('unsafe deposit rejected before invoice/customer creation '+JSON.stringify(opts),async()=>{const h=harness(opts),r=await h.run();assert.notEqual(r.status,200);assert.equal(h.stats().invoiceCount,0);assert.equal(h.stats().customerCount,0);});
test('retry after credit failure cannot duplicate draft, line or $100 credit',async()=>{const h=harness({failCreditOnce:true});assert.notEqual((await h.run()).status,200);const r=await h.run();assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.amount_remaining,98);assert.deepEqual(h.stats(),{invoiceCount:1,customerCount:1,items:2,total:9800});});
test('paid webhook totals count attached and historical deposits exactly once',()=>{const h=harness();for(const [method,paid] of [['stripe_attach_payment',19800],['historical_invoice_credit',9800]]){const r=h.ctx.invoiceDepositTotals({amount_paid:paid,metadata:{deposit_applied_amount:'100',deposit_application_method:method}});assert.equal(r.total,19800);assert.equal(r.additional,9800);assert.equal(r.deposit,10000);}});

for(const multi of [false,true])test(`Invoice without deposit remains isolated (${multi?"multi":"single"})`,async()=>{const h=harness(),r=await h.run(multi,true);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.amount_remaining,198);assert.equal(r.body.deposit_applied_amount,0);assert.equal(h.stats().items,1);});

test('paid invoice accounting selects the balance payment before the attached deposit',()=>{const h=harness(),inv={metadata:{deposit_payment_intent_id:'pi_deposit'},payments:{data:[{payment:{payment_intent:{id:'pi_deposit'}}},{payment:{payment_intent:'pi_balance'}}]}};assert.equal(h.ctx.getInvoicePaymentIntentId(inv,{object:'invoice_payment',payment:{payment_intent:{id:'pi_deposit'}}}),'pi_balance');});
test('deposit-only fully paid invoice retains its only payment identity',()=>{const h=harness();assert.equal(h.ctx.getInvoicePaymentIntentId({metadata:{deposit_payment_intent_id:'pi_deposit'},payments:{data:[{payment:{payment_intent:'pi_deposit'}}]}},{}),'pi_deposit');});
