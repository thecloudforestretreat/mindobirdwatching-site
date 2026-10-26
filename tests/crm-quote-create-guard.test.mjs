import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const code=fs.readFileSync(new URL('../deployment/crm-quote-date-guard/validate-create-against-crm.js',import.meta.url),'utf8');
const template=JSON.parse(fs.readFileSync(new URL('../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json',import.meta.url),'utf8'));
const codes=[code,template.nodes.find(n=>n.name==='Validate Create Against CRM').parameters.jsCode];
function run(code,action,record,rows=[]){
  return new Function('$','$input',code)(()=>({first:()=>({json:{action,record,inquiry_row:record,guest_row:{guest_id:'QA-GUEST'}}})}),{all:()=>rows.map(json=>({json}))})[0].json;
}
const base={inquiry_id:'QA-QUOTE-GUARD',guest_id:'QA-GUEST',status:'quoted',created_at:'2026-10-25T20:02:02.911Z',quote_status:'not_sent',quote_sent_at:'2026-09-08T12:48:00.000Z'};
test('creation rejects contradictory sent metadata before any append route',()=>{
  for(const c of codes)for(const action of ['create_guest_and_inquiry','create_returning_inquiry'])for(const status of ['', 'not_sent',' NOT_SENT ']){
    const r=run(c,action,{...base,quote_status:status});assert.equal(r.ok,false);assert.equal(r._route,'respond');assert.match(r.error,/Not Sent/);assert.equal(r.record,undefined);
  }
});
test('normal blank-date inquiries and explicitly sent quotes keep their intended create route',()=>{
  for(const c of codes)for(const action of ['create_guest_and_inquiry','create_returning_inquiry'])for(const record of [{...base,quote_sent_at:''},{...base,quote_sent_at:null},{...base,quote_sent_at:'   '},{...base,quote_status:'sent'},{...base,quote_status:'accepted'}]){
    const r=run(c,action,record);assert.equal(r.ok,true);assert.equal(r._route,action==='create_returning_inquiry'?'append_returning':'append_new');assert.equal(r.record.quote_sent_at,record.quote_sent_at);
  }
});
test('historical conflicts remain readable and identity-based returning matching is preserved',()=>{
  for(const c of codes){
    const history={...base,email:'qa@example.invalid'};
    const listed=run(c,'list_inquiries',{},[history]);assert.equal(listed.records[0].quote_sent_at,base.quote_sent_at);
    const r=run(c,'create_guest_and_inquiry',{...base,inquiry_id:'QA-SECOND',quote_sent_at:'',email:history.email},[history]);assert.equal(r._route,'append_returning');assert.equal(r.reused_guest,true);
  }
});
