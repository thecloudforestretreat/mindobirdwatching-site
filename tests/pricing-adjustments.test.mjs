import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const root=new URL('../',import.meta.url);
const worker=fs.readFileSync(new URL('deployment/multi-invoice-ledger/stripe-checkout-worker-v39.js',root),'utf8');
const html=fs.readFileSync(new URL('book-tour/create/index.html',root),'utf8');
const context=vm.createContext({});
vm.runInContext(worker.replace('export default {','const workerExport = {')+'\nthis.parseMoney=optionalWholeDollarAmount;this.lineTotal=calculatedLineTotalCents;',context);
function extract(name){
 const start=html.indexOf(`function ${name}(`);let opening=html.indexOf('{',start),depth=1,i=opening+1;
 while(depth){if(html[i]==='{')depth++;if(html[i]==='}')depth--;i++;}
 return html.slice(start,i);
}
const pricing=new Function(extract('parseTourAmount')+extract('getFinalAdjustedPrice')+extract('hasOverridePrice')+extract('formatAdjustmentDisplay')+'return {getFinalAdjustedPrice,hasOverridePrice,formatAdjustmentDisplay};')();
test('discount preserves final per-person price and party total',()=>{
 const item={price_override_per_person:-5},tour={amount_display:'$85.00'};
 assert.equal(pricing.getFinalAdjustedPrice(item,tour),80);
 assert.equal(pricing.hasOverridePrice(item),true);
 assert.equal(context.parseMoney(-5,true),-5);
 assert.equal(context.parseMoney(80),80);
 assert.equal(context.lineTotal({pricing_model:'per_person'},8000,2),16000);
 assert.equal(pricing.formatAdjustmentDisplay(-5),'-$5 USD');
});
test('fractional prices and adjustments are rejected',()=>{
 for(const value of [8.5,28.5,-5.5,0.01]) assert.throws(()=>context.parseMoney(value,true));
 assert.throws(()=>context.parseMoney(28.5));
 assert.equal(context.parseMoney(10,true),10);
});
test('transport discount applies once per booking',()=>{
 assert.equal(context.lineTotal({pricing_model:'flat'},17000,4),17000);
 assert.equal(context.parseMoney(-10,true),-10);
});
test('invalid or nonpositive final prices are rejected',()=>{
 for(const value of [-5,0,Infinity,'bad',10.001])assert.throws(()=>context.parseMoney(value));
 assert.throws(()=>context.parseMoney(-0.001,true));
 assert.equal(context.parseMoney(null),null);
 assert.equal(context.parseMoney(0,true),0);
});
test('checkout embedded scripts parse',()=>{
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))if(m[1].trim())new Function(m[1]);
});

test('quad billing keeps guest count separate and requires explicit equipment count',()=>{
 assert.equal(context.lineTotal({pricing_model:'per_quad'},3000,4,2),6000);
 assert.throws(()=>context.lineTotal({pricing_model:'per_quad'},3000,4));
 assert.throws(()=>context.lineTotal({pricing_model:'per_quad'},3000,4,1.5));
 assert.equal(context.lineTotal({pricing_model:'flat_amount'},10000,4),10000);
});

async function callWorker(path, payload) {
 const calls=[];
 const fakeFetch=async(url,init={})=>{
  const pathname=new URL(url).pathname;
  const form=new URLSearchParams(init.body||'');
  calls.push({pathname,form});
  let data;
  if(pathname==='/v1/customers')data={id:'cus_test'};
  else if(pathname==='/v1/invoiceitems')data={id:'ii_test'};
  else if(pathname==='/v1/checkout/sessions')data={id:'cs_test',url:'https://example.test/pay'};
  else if(pathname==='/v1/invoices'||/^\/v1\/invoices\/in_test\/(finalize|send)$/.test(pathname)) {
   const total=calls.filter(c=>c.pathname==='/v1/invoiceitems').reduce((sum,c)=>sum+Number(c.form.get('price_data[unit_amount]'))*Number(c.form.get('quantity')),0);
   data={id:'in_test',number:'TEST-1',status:'open',currency:'usd',amount_remaining:total,amount_due:total,total,hosted_invoice_url:'https://example.test/invoice'};
  } else throw new Error(`Unexpected external request: ${url}`);
  return new Response(JSON.stringify(data),{status:200});
 };
 const ctx=vm.createContext({fetch:fakeFetch,Request,Response,URL,URLSearchParams,console,crypto:globalThis.crypto});
 vm.runInContext(worker.replace('export default {','const workerExport = {')+'\nthis.handler=workerExport;',ctx);
 const req=new Request(`https://example.test/stripe/api/${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 const response=await ctx.handler.fetch(req,{STRIPE_SECRET_KEY:'fake_local_test_key'},{});
 return {status:response.status,result:await response.json(),calls};
}
const basePayload={language:'en',stripe_environment:'live',tour_code:'MBW005',number_of_people:2,main_contact_name:'Test Guest',main_contact_email:'guest@example.test',main_contact_phone:'+15555550100',whatsapp_number:'+15555550100',pickup_location_label:'Hotel',pickup_address_or_hotel:'Test Hotel',tour_date:'2026-11-10'};

test('standard checkout charges approved price despite old Stripe price mapping',async()=>{
 const r=await callWorker('create-checkout-session',basePayload);
 assert.equal(r.status,200,JSON.stringify(r.result));
 const form=r.calls.find(c=>c.pathname==='/v1/checkout/sessions').form;
 assert.equal(form.get('line_items[0][price_data][unit_amount]'),'8500');
 assert.equal(form.get('line_items[0][quantity]'),'2');
 assert.equal(form.has('line_items[0][price]'),false);
});
test('single invoice sends a signed discount and exact final amount to Stripe',async()=>{
 const r=await callWorker('create-invoice',{...basePayload,price_override_per_person:80,price_adjustment_per_person:-5,pricing_reason:'manual_adjustment'});
 assert.equal(r.status,200,JSON.stringify(r.result));
 const form=r.calls.find(c=>c.pathname==='/v1/invoiceitems').form;
 assert.equal(form.get('price_data[unit_amount]'),'8000');
 assert.equal(form.get('quantity'),'2');
 assert.equal(form.get('metadata[price_adjustment_per_person]'),'-5.00');
 assert.equal(r.result.amount_before_deposit,160);
});
test('multi-item invoice charges quads and flat transport with accurate guest metadata',async()=>{
 const r=await callWorker('create-invoice-multi',{...basePayload,items:[{tour_code:'ACT004',language:'en',quantity:4,quad_count:2,tour_date:'2026-11-10'},{tour_code:'TRANS06',language:'en',quantity:4,tour_date:'2026-11-10',price_override_per_person:170,price_adjustment_per_person:-10,pricing_reason:'manual_adjustment'}]});
 assert.equal(r.status,200,JSON.stringify(r.result));
 const lines=r.calls.filter(c=>c.pathname==='/v1/invoiceitems').map(c=>c.form);
 assert.equal(lines[0].get('quantity'),'2');
 assert.equal(lines[0].get('price_data[unit_amount]'),'3000');
 assert.equal(lines[0].get('metadata[number_of_people]'),'4');
 assert.equal(lines[0].get('metadata[quad_count]'),'2');
 assert.equal(lines[1].get('quantity'),'1');
 assert.equal(lines[1].get('price_data[unit_amount]'),'17000');
 assert.equal(r.result.amount_before_deposit,230);
});
test('invalid price mismatch and missing quad count fail before any Stripe write',async()=>{
 for(const payload of [{...basePayload,price_override_per_person:80.5,price_adjustment_per_person:-4.5,pricing_reason:'manual_adjustment'},{...basePayload,price_override_per_person:80,price_adjustment_per_person:5,pricing_reason:'manual_adjustment'},{...basePayload,tour_code:'ACT004',number_of_people:4},{...basePayload,tour_code:'ACT016',number_of_people:4}]){
  const r=await callWorker('create-invoice',payload);
  assert.equal(r.status,400);
  assert.equal(r.calls.length,0,JSON.stringify(r.result));
 }
});

test('active catalog matches every approved price, unit and consolidation',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('deployment/multi-invoice-ledger/approved-pricing-2026-10-05.json',root),'utf8'));
 const ctx=vm.createContext({});
 vm.runInContext(worker.replace('export default {','const workerExport = {')+'\nthis.tours=TOURS;',ctx);
 const active=ctx.tours.filter(t=>t.status==='active');
 assert.equal(new Set(active.map(t=>`${t.tour_code}:${t.language}`)).size,active.length);
 for(const [code,p]of Object.entries(manifest.products))for(const language of ['en','es']){
  const tour=active.find(t=>t.tour_code===code&&t.language===language);
  assert(tour,`${code}:${language} missing`);
  assert.equal(Number(tour.amount_display.replace(/[^0-9.]/g,'')),p.price,`${code}:${language} price`);
  assert.equal(tour.pricing_model,p.unit,`${code}:${language} billing unit`);
  assert.equal(tour.use_inline_price,true);
 }
 for(const code of manifest.retired_from_new_sales)assert(!active.some(t=>t.tour_code===code),`${code} remains active`);
 assert.deepEqual(Array.from(new Set(active.filter(t=>t.tour_code.startsWith('TRANS')).map(t=>t.tour_code))).sort(),['TRANS01','TRANS02','TRANS05','TRANS06']);
});
test('unmapped new products fail before creating duplicate Stripe products',async()=>{
 const r=await callWorker('create-invoice',{...basePayload,tour_code:'TRANS05'});
 assert.equal(r.status,400);
 assert.match(r.result.error,/product mapping is required/);
 assert.equal(r.calls.length,0);
});

test('biking route plus Butterfly Garden bills $30 per person with no old surcharge',async()=>{
 const r=await callWorker('create-invoice-multi',{...basePayload,items:[{tour_code:'ACT017',language:'en',quantity:2,tour_date:'2026-11-10'},{tour_code:'ACT017-BF',language:'en',quantity:2,tour_date:'2026-11-10'}]});
 assert.equal(r.status,200,JSON.stringify(r.result));
 const lines=r.calls.filter(c=>c.pathname==='/v1/invoiceitems').map(c=>c.form);
 assert.equal(lines[0].get('price_data[unit_amount]'),'2000');
 assert.equal(lines[1].get('price_data[unit_amount]'),'1000');
 assert.equal(r.result.amount_before_deposit,60);
 assert.equal(lines[0].get('metadata[pricing_mode]'),'standard');
 assert.equal(lines[1].get('metadata[pricing_mode]'),'standard');
});

test('test and live Stripe keys never fall back to the other environment',()=>{
 const ctx=vm.createContext({});
 vm.runInContext(worker.replace('export default {','const workerExport = {')+'\nthis.getKey=getStripeKey;',ctx);
 assert.equal(ctx.getKey({STRIPE_SECRET_KEY:'live-key'},true),null);
 assert.equal(ctx.getKey({STRIPE_SECRET_KEY_TEST:'test-key'},false),null);
 assert.equal(ctx.getKey({STRIPE_SECRET_KEY:'live-key',STRIPE_SECRET_KEY_TEST:'test-key'},true),'test-key');
 assert.equal(ctx.getKey({STRIPE_SECRET_KEY:'live-key',STRIPE_SECRET_KEY_TEST:'test-key'},false),'live-key');
});
