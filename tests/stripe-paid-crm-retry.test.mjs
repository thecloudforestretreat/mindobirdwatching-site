import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHmac,webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../mbw-stripe-checkout-worker-v44.js',import.meta.url),'utf8');
async function scenario({fail='none',eventType='invoice.paid',identity=true}={}){
  const calls=[],payments=new Map(),secret='QA-webhook-secret';let failing=fail;
  const invoice={id:'in_QA',number:'QA-0137',status:'paid',amount_paid:27500,amount_remaining:0,currency:'usd',customer_name:'QA ONLY',status_transitions:{paid_at:1792600000},metadata:identity==='partial'?{inquiry_id:'INQ-QA'}:identity?{inquiry_id:'INQ-QA',guest_id:'G-QA'}:{},lines:{data:[]}};
  const context={Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,crypto:webcrypto,Date,console:{log(){}},setTimeout,clearTimeout,fetch:async(url,options={})=>{
    const address=String(url);
    if(address.startsWith('https://api.stripe.com/v1/invoices/'))return Response.json(invoice);
    if(address.startsWith('https://qa.invalid/sheets'))return Response.json({ok:true,duplicate:true});
    if(address==='https://qa.invalid/crm'){
      const payload=JSON.parse(new URLSearchParams(options.body).get('payload'));calls.push(payload);
      if((payload.action==='upsert_payment'&&failing!=='none'&&failing!=='booking')||(payload.action==='upsert_booking'&&failing==='booking')){
        if(failing==='network')throw Error('QA network failure');
        if(failing==='invalid')return new Response('not JSON');
        if(failing==='http')return Response.json({error:'QA unavailable'},{status:503});
        return Response.json({ok:false,error:'QA rejected'});
      }
      if(payload.payment)payments.set(payload.payment.payment_id,payload.payment);
      return Response.json({ok:true,record:payload.record});
    }
    throw Error('Unexpected test destination '+address);
  }};
  vm.createContext(context);vm.runInContext(source.replace('export default {','globalThis.worker = {'),context);
  const env={STRIPE_SECRET_KEY:'sk_QA_ONLY',STRIPE_WEBHOOK_SECRET:secret,GSHEET_WEBAPP_URL:'https://qa.invalid/sheets',CRM_API_URL:'https://qa.invalid/crm'};
  const send=async()=>{const timestamp=Math.floor(Date.now()/1000),event={id:'evt_QA',created:timestamp,livemode:true,type:eventType,data:{object:eventType==='invoice_payment.paid'?{object:'invoice_payment',invoice:'in_QA'}:{object:'invoice',id:'in_QA'}}};const body=JSON.stringify(event);const signature=createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');return context.worker.fetch(new Request('https://qa.invalid/webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body}),env,{waitUntil(){throw Error('Paid event must be awaited');}});};
  return {send,calls,payments,recover(){failing='none';}};
}
for(const fail of ['rejected','network','invalid','http','booking'])test('paid webhook returns retryable failure for CRM '+fail,async()=>{const h=await scenario({fail});const response=await h.send();assert.equal(response.status,500);assert.match(await response.text(),/retry/i);assert.equal(h.payments.size,fail==='booking'?1:0);});
for(const eventType of ['invoice.paid','invoice.payment_succeeded','invoice_payment.paid'])test(eventType+' updates the same invoice with $275 after a retry',async()=>{const h=await scenario({fail:'rejected',eventType});assert.equal((await h.send()).status,500);h.recover();assert.equal((await h.send()).status,200);assert.equal((await h.send()).status,200);assert.equal(h.payments.size,1);const payment=h.payments.get('PAY-in_QA');assert.equal(payment.total_amount_paid,275);assert.equal(payment.balance_remaining,0);assert.equal(payment.is_fully_paid,'Yes');assert.equal(payment.payment_status,'paid');assert.ok(h.calls.every(call=>call.record.invoice_id==='in_QA'||call.action==='upsert_booking'));});
test('legacy invoices without CRM identifiers can still complete accounting',async()=>{const h=await scenario({identity:false});assert.equal((await h.send()).status,200);assert.equal(h.calls.length,0);});

test('a partially linked invoice cannot be silently treated as a legacy unlinked invoice',async()=>{const h=await scenario({identity:'partial'});assert.equal((await h.send()).status,500);assert.equal(h.calls.length,0);});
