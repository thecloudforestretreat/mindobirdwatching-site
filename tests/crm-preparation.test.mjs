import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../admin/assets/js/crm-preparation.js',import.meta.url),'utf8'),context);const api=context.MbwCrmPreparation;
const record={inquiry_id:'QA',full_name:'QA Guest',status:'booked',assigned_to:'JPG',phone_number:'QA phone',followup_date:'2026-10-24',payment_status:'unpaid'};
const service={id:'bear',label:'Spectacled Bear Tour',date:'2026-10-29',selected:true,status:'booked',guests:'3',start:'5:00',end:'13:00',pickup:'QA Lodge',requiresProvider:true,providerName:'QA Guide',providerPhone:'QA Contact',providerInformed:true,providerStatus:'confirmed'};
const build=(r={},services=[service],verified=true)=>api.build({record:{...record,...r},services,today:'2026-10-27',verified});
test('remaining services survive completed primary tours; dates are Mindo-calendar preparation dates',()=>{const m=build({requested_date:'2026-10-26'},[{...service,id:'bird',date:'2026-10-26',status:'completed'},service]);assert.equal(m.remaining.length,1);assert.equal(m.earlier.length,1);assert.equal(m.reminderDate,'2026-10-27');assert.equal(m.followupDate,'2026-10-24');assert.equal(m.urgency,'overdue');assert.equal(m.ready,true);assert.equal(m.remaining[0].start,'05:00')});
test('payment remains separate from details readiness and no source data is mutated',()=>{const input={record:{...record},services:[{...service}],today:'2026-10-27',verified:true},before=JSON.stringify(input),m=api.build(input);assert.equal(m.payment,'unpaid');assert.equal(m.ready,true);assert.equal(JSON.stringify(input),before)});
test('closed and archived records stay out; inconsistent Completed bookings with future tours are flagged',()=>{for(const status of ['cancelled','did_not_book','duplicate','spam'])assert.equal(build({status}),null);for(const is_archived of ['Yes','true','1','Y'])assert.equal(build({is_archived}),null);const m=build({status:'completed'});assert.ok(m);assert.equal(m.ready,false);assert.ok(m.missing.some(s=>s.includes('booking status')));assert.equal(build({},[{...service,status:'completed'}]),null)});
test('unselected options never enter the reminder or message; services are chronological',()=>{const m=build({},[{...service,id:'later',date:'2026-11-01'},{...service,id:'unselected',selected:false,date:'2026-10-28'},service]);assert.deepEqual(JSON.parse(JSON.stringify(m.remaining.map(s=>s.id))),['bear','later']);assert.ok(!api.message(m).includes('2026-10-28'))});
test('unknown dates, guest counts, provider details and invalid schedules are actionable',()=>{const m=build({assigned_to:'',phone_number:''},[{...service,date:'2026-02-30',guests:'6+',start:'25:00',providerName:'',pickup:''}]);assert.equal(m.ready,false);for(const issue of ['Assign a rep','Add guest phone','Confirm tour date','guest count','start and end','assignment','meeting location'])assert.ok(m.missing.some(v=>v.includes(issue)),issue);assert.equal(m.reminderDate,'')});
test('unverified provider data can never show Details complete',()=>{const m=build({},[service],false);assert.equal(m.ready,false);assert.ok(m.missing.some(v=>v.includes('verify provider')))});
test('flexible activities do not invent times or guide requirements, but fixed tours require schedules',()=>{const m=build({},[{...service,label:'Coffee Tour',requiresProvider:false,flexible:true,start:'',end:''}]);assert.equal(m.ready,true);assert.match(api.message(m),/Flexible/);assert.equal(build({},[{...service,start:'',end:''}]).ready,false)});
test('transport drop-off and provider informed/contact checks are explicit',()=>{for(const patch of [{transport:true,dropoff:''},{providerInformed:false},{providerPhone:''},{providerStatus:'pending'}])assert.equal(build({},[{...service,...patch}]).ready,false);const m=build({},[{...service,dropoff:'Quito hotel'}]);assert.match(api.message(m),/Drop-off: Quito hotel/);assert.match(api.message(m),/local Mindo/)});
test('filter counts and queue order use independent saved follow-up and rep values',()=>{const a=build(),b=build({inquiry_id:'B',assigned_to:'SS',followup_date:'2026-10-27'},[{...service,date:'2026-10-28'}]);const rows=api.queue([a,b]);assert.equal(rows[0].id,'B');assert.equal(api.filter(rows,'overdue','JPG').length,1);assert.equal(api.filter(rows,'today','SS').length,1);assert.equal(api.filter(rows,'needs_details','all').length,0);assert.equal(api.filter(rows,'all','unassigned').length,0)});
test('drafts preserve each service route and omit completed history',()=>{const m=build({},[{...service,label:'Completed birding',date:'2026-10-26',status:'completed'},{...service,label:'Bear tour',dropoff:'Quito'}]);const draft=api.message(m);assert.match(draft,/Bear tour/);assert.ok(!draft.includes('Completed birding'));assert.match(draft,/05:00/);assert.match(draft,/Quito/)});

test('generic transportation uses its recorded route without changing source records',()=>{
 const transport={...service,label:'Transportation',transport:true,pickup:'Quito hotel',dropoff:'Mindo Park'};
 const before=JSON.stringify(transport),m=build({},[transport]);
 assert.equal(m.ready,true);assert.equal(m.remaining[0].label,'Transportation · Quito hotel → Mindo Park');
 assert.match(api.message(m),/Quito hotel → Mindo Park/);assert.equal(JSON.stringify(transport),before);
});
test('incomplete or placeholder routes cannot resolve a generic transportation name',()=>{
 for(const patch of [{pickup:''},{dropoff:''},{pickup:'TBD'},{dropoff:'Unknown'},{dropoff:'Quito hotel'},{transport:false}]){
  const m=build({},[{...service,label:'Transportation',transport:true,pickup:'Quito hotel',dropoff:'Mindo Park',...patch}]);
  assert.equal(m.ready,false);assert.ok(m.missing.some(v=>v.includes('Confirm service name')));
 }
 const named=build({},[{...service,label:'Quito to Mindo private transfer',transport:true,dropoff:'Mindo Park'}]);
 assert.equal(named.remaining[0].label,'Quito to Mindo private transfer');
});

test('placeholder pickup and drop-off locations remain missing for named services',()=>{
 for(const value of ['PENDING','TBD','Unknown','To be confirmed','Not set','N/A','-']){
  const m=build({},[{...service,transport:true,pickup:value,dropoff:value}]);
  assert.equal(m.ready,false);assert.ok(m.missing.some(v=>v.includes('pickup / meeting')));assert.ok(m.missing.some(v=>v.includes('drop-off')));
 }
});

test('linked assignment date conflicts block copying and remain visible after the old date passes',()=>{
 const input={...service,date:'2026-10-26',itineraryDate:'2026-11-20'},before=JSON.stringify(input);
 const m=build({},[input]);assert.equal(m.remaining.length,1);assert.equal(m.earlier.length,0);assert.equal(m.ready,false);
 assert.ok(m.missing.some(v=>v.includes('scheduled 2026-10-26; itinerary 2026-11-20')));assert.equal(m.reminderDate,'2026-11-18');assert.equal(JSON.stringify(input),before);
 assert.equal(build({},[{...service,itineraryDate:service.date}]).ready,true);
 const done=build({},[{...input,status:'completed'},service]);assert.equal(done.remaining.length,1);assert.equal(done.ready,true);
});
