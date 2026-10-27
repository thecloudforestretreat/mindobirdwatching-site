import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=fs.readFileSync(process.env.MBW_ROUTER_QA_SOURCE || new URL('../deployment/multi-invoice-ledger/crm-router.gs',import.meta.url),'utf8');
function context(){const c={Utilities:{formatDate:d=>d.toISOString().slice(0,10)}};vm.createContext(c);vm.runInContext(source,c);c.todayIso_=()=> '2026-10-27';return c;}
const service=(date,status='booked')=>({date,status});
const row={status:'booked',payment_status:'paid',requested_date_start:'2026-10-26',tour_items_json:JSON.stringify([service('2026-10-26','completed'),service('2026-10-29')])};
test('paid multi-tour inquiry stays booked until its last confirmed service date passes',()=>{
 const c=context();assert.equal(c.alignInquiryStatusFromSubstatuses_(row,{start:'2026-10-26',end:'2026-10-26'}).status,'booked');
});
test('a prematurely completed inquiry cannot produce a review while a confirmed service is ahead',()=>{
 const c=context();const action=c.nextActionForInquiry_({...row,status:'completed',completed_date:'2026-10-26'},{start:'2026-10-26',end:'2026-10-26'});assert.equal(action.followupType,'');assert.equal(action.followupDate,'');
});
test('review date uses final service rather than the primary completion date',()=>{
 const c=context();c.todayIso_=()=> '2026-10-30';const action=c.nextActionForInquiry_({...row,status:'completed',completed_date:'2026-10-26',tour_items_json:JSON.stringify([service('2026-10-26','completed'),service('2026-10-29','completed')])},{start:'2026-10-26',end:'2026-10-26'});assert.equal(action.followupType,'review_request');assert.equal(action.followupDate,'2026-10-30');
});
test('cancelled and unselected future alternatives do not postpone a finished trip',()=>{
 const c=context();const done={...row,status:'completed',completed_date:'2026-10-26',tour_items_json:JSON.stringify([service('2026-10-26','completed'),service('2026-11-30','cancelled'),service('2026-12-01','quoted')])};const action=c.nextActionForInquiry_(done,{start:'2026-10-26',end:'2026-10-26'});assert.equal(action.followupDate,'2026-10-27');
});
test('multi-day range and legacy single-tour data remain supported',()=>{
 const c=context();assert.equal(c.alignInquiryStatusFromSubstatuses_({status:'booked',payment_status:'paid'},{start:'2026-10-26',end:'2026-10-29'}).status,'booked');assert.equal(c.alignInquiryStatusFromSubstatuses_({status:'booked',payment_status:'paid',tour_items_json:'invalid'},{start:'2026-10-26',end:'2026-10-26'}).status,'completed');
});
test('future service dates do not reactivate archived or lost inquiries',()=>{
 const c=context();for(const status of ['duplicate','did_not_book','cancelled'])assert.equal(c.alignInquiryStatusFromSubstatuses_({...row,status},{start:'2026-10-26'}).status,status);
});
