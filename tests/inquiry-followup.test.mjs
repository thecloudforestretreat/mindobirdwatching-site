import test from 'node:test';import assert from 'node:assert/strict';
import {aggregateFollowup,followupFilter,inquiryFlags} from '../admin/assets/js/inquiry-followup.mjs';
import {reportHealth} from '../admin/assets/js/report-health.mjs';
const options={start:'2026-09-01',end:'2026-09-30',today:'2026-10-03'};
const base={created_at:'2026-09-25',country:'USA',status:'new'};
test('follow-up cohorts exclude duplicate/archive rows, retain cancellations and separate queues',()=>{
 const rows=[{...base,inquiry_id:'a'}, {...base,inquiry_id:'a'}, {...base,inquiry_id:'b',status:'cancelled'}, {...base,inquiry_id:'c',is_archived:'Yes'}, {...base,inquiry_id:'d',status:'quoted',quote_sent_at:'2026-09-25',last_contacted_at:'2026-09-25',followup_date:'2026-10-02'}, {...base,inquiry_id:'e',status:'booked',payment_status:'unpaid'}, {...base,inquiry_id:'f',status:'completed',payment_status:'unpaid'}, {...base,inquiry_id:'g',status:'new',created_at:''}];
 const p=aggregateFollowup(rows,options),g=p.rows[0];assert.equal(p.duplicates,1);assert.equal(p.excluded,1);assert.equal(p.missingCreatedDates,1);assert.equal(g.cohort,5);assert.equal(g.contact,1);assert.equal(g.cancelled,1);assert.equal(g.quotes,1);assert.equal(g.overdue,1);assert.equal(g.payment,1);assert.equal(g.responseRecorded,0);
 assert.doesNotMatch(JSON.stringify(p),/inquiry_id|guest_email|email/);
});
test('calendar day boundaries and newer contact prevent misleading aging flags',()=>{
 assert.equal(inquiryFlags({...base,created_at:'2026-10-01'},options.today).contact,true);
 assert.equal(inquiryFlags({...base,created_at:'2026-10-02'},options.today).contact,false);
 assert.equal(inquiryFlags({...base,followup_date:'2026-10-03'},options.today).overdue,false);
 assert.equal(inquiryFlags({...base,status:'quoted',quote_sent_at:'2026-09-26'},options.today).quotes,true);
 assert.equal(inquiryFlags({...base,status:'quoted',quote_sent_at:'2026-09-27'},options.today).quotes,false);
 assert.equal(inquiryFlags({...base,status:'quoted',quote_sent_at:'2026-09-20',last_contacted_at:'2026-09-30'},options.today).quotes,false);
 assert.equal(inquiryFlags({...base,created_at:'bad'},options.today).contact,false);
});
test('CRM queue predicates match aggregates and preserve geographic/date scope',()=>{
 const rows=[{...base,inquiry_id:'us'},{...base,inquiry_id:'ec',country:'Ecuador'},{...base,inquiry_id:'unknown',country:'(not set)'},{...base,inquiry_id:'other',created_at:'2026-08-31T23:00:00Z'}];
 const params=new URLSearchParams({review:'contact',start:options.start,end:options.end,asOf:options.today,audience:'international'}),filter=followupFilter(params);
 assert.deepEqual(rows.filter(filter).map(r=>r.inquiry_id),['us']);
 params.set('audience','all');params.set('countries','EC');assert.deepEqual(rows.filter(followupFilter(params)).map(r=>r.inquiry_id),['ec']);
 params.set('start','2026-02-30');assert.equal(followupFilter(params),null);
});
test('first response requires explicit timestamps, never last-contact or date-only estimates',()=>{
 const p=aggregateFollowup([{...base,created_at:'2026-09-25T12:00:00Z',first_response_at:'2026-09-25T14:30:00Z'},{...base,created_at:'2026-09-25T12:00:00Z',last_contacted_at:'2026-09-25T14:00:00Z'},{...base,first_response_at:'2026-09-26'},{...base,created_at:'2026-09-25T12:00:00Z',first_response_at:'2026-09-25T10:00:00Z'}],options).rows[0];
 assert.equal(p.responseRecorded,1);assert.equal(p.responseHoursTotal,2.5);assert.equal(p.responseMissing,3);
});
test('health separates stale, unavailable and verified zero without optimistic defaults',()=>{
 const now=Date.parse('2026-10-03T12:00:00Z'),d={updated_at:'2026-10-01T12:00:00Z',details:{landing_pages:{status:'connected'},cities:{status:'connected'}},prior:{updated_at:'2026-10-03T11:00:00Z'},demand:{status:'connected',updated_at:'bad',pipeline:{status:'connected'},reconciliation:{ambiguousMatches:2}}};
 const c=reportHealth(d,{now,rows:[{code:'',sessions:5}],pages:[{page:'(not set)',sessions:3}],cities:[{city:'(not set)',sessions:2}]});
 assert.equal(c.find(c=>c.title==='Website source freshness').status,'review');assert.equal(c.find(c=>c.title==='Comparison source freshness').status,'good');assert.equal(c.find(c=>c.title==='CRM / accounting source freshness').status,'unavailable');assert.equal(c.find(c=>c.title==='Reporting connections').status,'unavailable');assert.equal(c.find(c=>c.title==='Invoice reconciliation').status,'review');assert.equal(c.find(c=>c.title==='Entry-page identification').status,'review');
 assert.equal(reportHealth({updated_at:'2099-01-01'}, {now,website:false})[0].status,'unavailable');
});

test('overdue sales and guest queues partition the legacy queue without double counting',()=>{
 const rows=['quoted','booked','confirmed','deposit_paid','completed','cancelled'].map((status,i)=>({...base,inquiry_id:String(i),status,followup_date:'2026-10-01'}));
 const p=aggregateFollowup(rows,options),g=p.rows[0];assert.equal(g.overdue,4);assert.equal(g.prospectOverdue,1);assert.equal(g.guestOverdue,3);assert.equal(g.overdue,g.prospectOverdue+g.guestOverdue);
 for(const review of ['overdue','prospectOverdue','guestOverdue'])assert.equal(rows.filter(followupFilter(new URLSearchParams({review,start:options.start,end:options.end,asOf:options.today}))).length,g[review]);
});
test('historical date review retains geographic scope, excludes duplicates and never invents dates',()=>{
 const rows=[{...base,inquiry_id:'a',created_at:'',requested_date:'2026-09-25',updated_at:'2026-09-25',invoice_date:'2026-09-25'}, {...base,inquiry_id:'a',created_at:''},{...base,inquiry_id:'b',created_at:'2026-09-25 13:10:00'},{...base,inquiry_id:'c',created_at:'2026-02-30 13:10:00'}, {...base,inquiry_id:'d',created_at:'2026-09-25 29:10:00'}, {...base,inquiry_id:'e',country:'Ecuador',created_at:''}, {...base,inquiry_id:'f',status:'duplicate',created_at:''}];
 const p=aggregateFollowup(rows,options);assert.equal(p.missingCreatedDates,4);assert.equal(p.recoveredCreatedDates,1);assert.equal(p.rows.find(r=>r.code==='US').cohort,1);assert.equal(p.rows.find(r=>r.code==='US').missingDate,3);
 const filter=followupFilter(new URLSearchParams({review:'missingDate',start:'2020-01-01',end:'2020-01-31',asOf:options.today,market:'USA'}));assert.deepEqual(rows.filter(filter).map(r=>r.inquiry_id),['a','a','c','d']);assert.equal(inquiryFlags(rows[0],options.today).created,'');
});
