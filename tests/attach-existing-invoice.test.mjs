import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=fs.readFileSync(new URL('../mbw-stripe-checkout-worker-v44.js',import.meta.url),'utf8');

function harness({invoiceStatus='paid',invoiceInquiry='INQ-QA',invoiceGuest='G-QA'}={}){
  const writes=[];
  const invoice={id:'in_OLD',number:'MBW-0093',livemode:true,status:invoiceStatus,created:1788985961,status_transitions:{paid_at:1788985961},currency:'usd',total:10800,amount_paid:invoiceStatus==='paid'?10800:0,amount_remaining:invoiceStatus==='paid'?0:10800,metadata:{inquiry_id:invoiceInquiry,guest_id:invoiceGuest},payments:{data:[{payment:{payment_intent:'pi_OLD'}}]},lines:{data:[{amount:10800,quantity:1,metadata:{inquiry_id:invoiceInquiry,guest_id:invoiceGuest,tour_code:'MBW006',tour_title:'Quest for Five Toucans',service_type:'Birdwatching',tour_date:'2026-11-30',number_of_people:'1',pickup_location_label:'Mindo Park'}}]}};
  const c={Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,crypto:webcrypto,Date,console:{log(){}},setTimeout,clearTimeout,fetch:async(url,opt={})=>{
    const value=String(url);
    if(value==='https://qa.invalid/crm'){
      const payload=JSON.parse(new URLSearchParams(opt.body).get('payload'));
      if(payload.action==='list_inquiries')return Response.json({ok:true,records:[{inquiry_id:'INQ-QA',guest_id:'G-QA',guest_count:'1'}]});
      if(['upsert_booking','upsert_payment'].includes(payload.action)){writes.push(payload);return Response.json({ok:true,record:payload.record});}
      throw Error('Unexpected CRM action '+payload.action);
    }
    if(value.includes('/v1/invoices/search'))return Response.json({data:[{id:'in_OLD',number:'MBW-0093'}]});
    if(value.includes('/v1/invoices/in_OLD'))return Response.json(invoice);
    throw Error('Unexpected destination '+value);
  }};
  vm.createContext(c);vm.runInContext(source.replace('const worker = {','globalThis.worker = {').replace('export default worker;',''),c);
  const env={CF_SHARED_SECRET:'QA-secret',STRIPE_SECRET_KEY:'sk_QA',CRM_API_URL:'https://qa.invalid/crm'};
  const attach=(invoiceRef='MBW-0093')=>c.worker.fetch(new Request('https://qa.invalid/api/invoices/reconcile',{method:'POST',headers:{Authorization:'Bearer QA-secret','Content-Type':'application/json'},body:JSON.stringify({inquiry_id:'INQ-QA',invoice_ref:invoiceRef})}),env,{});
  return {attach,writes};
}

test('exact historical paid invoice is attached to the authoritative CRM inquiry',async()=>{
  const h=harness();
  const response=await h.attach();
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.invoice_no,'MBW-0093');
  assert.equal(body.total_amount_paid,108);
  assert.deepEqual(h.writes.map(item=>item.action),['upsert_payment']);
  const payment=h.writes.find(item=>item.action==='upsert_payment').payment;
  assert.equal(payment.inquiry_id,'INQ-QA');
  assert.equal(payment.guest_id,'G-QA');
  assert.equal(payment.invoice_id,'in_OLD');
  assert.equal(payment.invoice_no,'MBW-0093');
  assert.equal(payment.total_amount_paid,108);
  assert.equal(payment.balance_remaining,0);
});

test('attachment rejects unpaid or mismatched invoices without writes',async()=>{
  for(const options of [{invoiceStatus:'open'},{invoiceInquiry:'INQ-OTHER'},{invoiceGuest:'G-OTHER'}]){
    const h=harness(options);
    assert.equal((await h.attach()).status,400);
    assert.equal(h.writes.length,0);
  }
});

test('attachment rejects loose references before Stripe lookup',async()=>{
  const h=harness();
  assert.equal((await h.attach('0093')).status,400);
  assert.equal(h.writes.length,0);
});
