import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const workflow=JSON.parse(fs.readFileSync(new URL('../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json',import.meta.url),'utf8'));
const node=name=>workflow.nodes.find(n=>n.name===name);
function run(name,{request={},rows=[],base={},result={}}={}){
 const $=name=>({first:()=>({json:request}),item:{json:base},all:()=>rows.map(json=>({json}))});
 return new Function('$','$input','$json',node(name).parameters.jsCode)($,{all:()=>rows.map(json=>({json}))},result)[0].json;
}
const original={assignment_id:'QA-ASSIGNMENT',guest_id:'QA-GUEST',inquiry_id:'QA-INQUIRY',service_type:'Transportation',provider_name:'QA Driver',provider_id:'P1',service_date:'2099-11-26',start_time:'03:00',end_time:'05:00',assignment_status:'confirmed',created_by:'JPG',provider_informed:'Yes',provider_informed_by:'JPG',google_calendar_event_id:'event-keep',google_calendar_id:'qa@example.invalid',calendar_event_url:'https://calendar.google.com/calendar/event?eid=qa',calendar_sync_status:'guide_invited'};
function edit(responseStatus,patch={},eventPatch={}){
 const updated=run('Process CRM Assignments',{rows:[original],request:{action:'update_assignment',assignment:{assignment_id:original.assignment_id,...patch}}});
 assert.equal(updated.calendar_sync_status,'pending_update');
 const base=run('Prepare Assignment Calendar Sync',{base:updated});
 const result={id:'event-keep',htmlLink:original.calendar_event_url,...(responseStatus?{attendees:[{email:'driver@example.invalid',responseStatus}]}:{}),...eventPatch};
 return run('Build Assignment Calendar Update State',{base,rows:[original],result});
}
for(const [response,status] of [['needsAction','guide_invited'],['accepted','guide_accepted'],['declined','guide_declined'],['tentative','guide_tentative']])test(response+' survives normal edit without another invitation',()=>{
 const snapshot=JSON.stringify(original),out=edit(response);assert.equal(out.calendar_sync_status,status);assert.equal(out.google_calendar_event_id,'event-keep');assert.equal(out.calendar_event_url,original.calendar_event_url);assert.equal(JSON.stringify(original),snapshot);
});
test('uninvited event remains synced rather than acquiring invitation from manual informed flag',()=>assert.equal(edit(null).calendar_sync_status,'synced'));
test('Google empty attendees clears an old invited status',()=>assert.equal(edit(null,{}, {attendees:[]}).calendar_sync_status,'synced'));
test('accepted status retains temporary end-time warning',()=>assert.equal(edit('accepted',{end_time:''}).calendar_sync_status,'guide_accepted_end_tbd'));
test('new provider cannot inherit old attendee acceptance',()=>assert.equal(edit('accepted',{provider_name:'Another Driver',provider_id:'P2'}).calendar_sync_status,'guide_invitation_review'));
test('multiple or omitted attendees require review rather than duplicate invite',()=>{
 assert.equal(edit('accepted',{}, {attendees:[{email:'one@example.invalid'},{email:'two@example.invalid'}]}).calendar_sync_status,'guide_invitation_review');
 assert.equal(edit(null,{}, {attendeesOmitted:true}).calendar_sync_status,'guide_invitation_review');
});
test('organizer is excluded from provider attendee count',()=>assert.equal(edit('accepted',{}, {attendees:[{email:'owner@example.invalid',organizer:true},{email:'driver@example.invalid',responseStatus:'accepted'}]}).calendar_sync_status,'guide_accepted'));
test('calendar errors and invalid event responses are never accepted states',()=>{
 for(const patch of [{error:{message:'calendar unavailable'}},{id:''},{id:'wrong-event'}])assert.equal(edit('accepted',{},patch).calendar_sync_status,'error');
});
for(const status of ['cancelled','completed'])test(status+' rejects explicit guide invite on backend',()=>assert.throws(()=>run('Process CRM Assignments',{rows:[{...original,assignment_status:status}],request:{action:'invite_assignment_provider',assignment_id:original.assignment_id}}),/closed assignment/));
test('cancellation still follows existing event deletion route',()=>{
 const updated=run('Process CRM Assignments',{rows:[original],request:{action:'update_assignment',assignment:{assignment_id:original.assignment_id,assignment_status:'cancelled'}}});
 const prepared=run('Prepare Assignment Calendar Sync',{base:updated});assert.equal(prepared.calendar_action,'delete');assert.equal(prepared.calendar_event_id,'event-keep');
});
test('normal calendar update does not modify attendees or send updates',()=>{
 const fields=node('Google Calendar - Update Assignment Event').parameters.updateFields;
 assert.equal(fields.sendUpdates,'none');assert.equal(Object.hasOwn(fields,'attendees'),false);assert.equal(Object.hasOwn(fields,'responseStatus'),false);
});
