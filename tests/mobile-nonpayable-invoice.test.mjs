import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePayment,normalizeInquiry,enrichInquiry,guestJourney} from '../functions/lib/mobile-domain.mjs';
for(const status of ['void','uncollectible'])test('mobile '+status+' invoice has no payable balance and cannot confirm a booking',()=>{
 const payment=normalizePayment({invoice_no:'QA-VOID',inquiry_id:'INQ-QA',guest_id:'G-QA',payment_status:status,balance_remaining:125,total_amount_paid:0,is_fully_paid:'Yes'});
 assert.equal(payment.balance,0);assert.equal(payment.historicalBalance,125);assert.equal(payment.nonPayable,true);assert.equal(payment.fullyPaid,false);
 const record=normalizeInquiry({inquiry_id:'INQ-QA',guest_id:'G-QA',status:'planning',payment_status:'deposit_paid',requested_date:'2026-11-24'});
 assert.equal(enrichInquiry(record,[],[payment],new Date('2026-10-24')).effectiveStatus,'planning');
 assert.notEqual(guestJourney(record,[],[],[payment],[],new Date('2026-10-24')).find(x=>x.id==='payment').state,'complete');
});
test('an active unpaid mobile invoice retains its collectible balance',()=>{const p=normalizePayment({payment_status:'unpaid',balance_remaining:125});assert.equal(p.balance,125);assert.equal(p.nonPayable,false);});
