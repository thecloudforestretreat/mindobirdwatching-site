import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../functions/api/crm/balances.js',import.meta.url),'utf8');
async function handler(mode){let code=source.replace("import {authorize} from '../whatsapp/index.js';",`const authorize=async()=>${mode==='denied'?"new Response('Denied',{status:401})":"undefined"};`)
.replace("import {listRecords} from '../../lib/mobile-crm.mjs';",`const listRecords=async(env,action)=>{${mode==='failure'?"throw Error('offline');":"if(action==='list_inquiries')return [{inquiry_id:'INQ-1'}];if(action==='list_accounting_deposits')return [{inquiry_id:'INQ-1',deposit_id:'D1',total_booking_price:198,deposit_amount_paid:100,balance_due_date:'2026-10-29'}];return [];"}};`)
.replace("import {buildBalances} from '../../lib/crm-balances.mjs';",`import {buildBalances} from '${new URL('../functions/lib/crm-balances.mjs',import.meta.url).href}';`);return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).onRequestGet;}
test('balance endpoint denies unauthenticated requests',async()=>assert.equal((await(await handler('denied'))({request:new Request('https://admin.mindobirdwatching.com/api/crm/balances'),env:{}})).status,401));
test('accounting failure is explicit with no cached financial response',async()=>{const r=await(await handler('failure'))({request:new Request('https://admin.mindobirdwatching.com/api/crm/balances'),env:{}});assert.equal(r.status,503);assert.equal(r.headers.get('Cache-Control'),'private, no-store');assert.equal((await r.json()).ok,false);});
test('read-only endpoint returns deduplicated summary',async()=>{const r=await(await handler('ok'))({request:new Request('https://admin.mindobirdwatching.com/api/crm/balances'),env:{}});assert.equal(r.status,200);assert.equal((await r.json()).records[0].balance,98);assert.equal(source.includes('onRequestPost'),false);});

test('applied deposit plus cumulative invoice snapshot is counted once',async()=>{
  const {buildBalances}=await import('../functions/lib/crm-balances.mjs');
  const inquiry={inquiry_id:'INQ-DEP',full_name:'Deposit Guest',status:'booked',quote_status:'accepted',accepted_quote_total:250};
  const deposit={inquiry_id:'INQ-DEP',deposit_id:'DEP-1',stripe_payment_intent_id:'pi_dep',total_booking_price:250,deposit_amount_paid:100,total_amount_paid:100};
  const invoice={inquiry_id:'INQ-DEP',payment_id:'INV-MBW-0149',invoice_no:'MBW-0149',invoice_id:'in_149',total_booking_price:250,total_amount_paid:250,payment_status:'paid'};
  const [row]=buildBalances({inquiries:[inquiry],payments:[invoice],deposits:[deposit],now:new Date('2026-11-11T12:00:00Z')}).records;
  assert.equal(row.total,250);assert.equal(row.deposit,100);assert.equal(row.paid,250);assert.equal(row.balance,0);assert.equal(row.status,'paid');assert.deepEqual(row.issues,[]);
});

test('deposit plus net balance payment still totals the full booking',async()=>{
  const {buildBalances}=await import('../functions/lib/crm-balances.mjs');
  const inquiry={inquiry_id:'INQ-NET',full_name:'Net Guest',status:'booked',quote_status:'accepted',accepted_quote_total:250};
  const deposit={inquiry_id:'INQ-NET',deposit_id:'DEP-2',stripe_payment_intent_id:'pi_dep_2',total_booking_price:250,deposit_amount_paid:100,total_amount_paid:100};
  const invoice={inquiry_id:'INQ-NET',payment_id:'INV-MBW-0150',invoice_no:'MBW-0150',invoice_id:'in_150',total_booking_price:250,total_amount_paid:150,payment_status:'paid'};
  const [row]=buildBalances({inquiries:[inquiry],payments:[invoice],deposits:[deposit],now:new Date('2026-11-11T12:00:00Z')}).records;
  assert.equal(row.paid,250);assert.equal(row.balance,0);assert.equal(row.status,'paid');
});
