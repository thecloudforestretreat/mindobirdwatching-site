import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {escape,flag,filtered,followupDue,isUpcoming,sampleData} from '../admin/guest-crm-lab/lab.mjs';
test('Lab filters do not confuse closed journeys or pending bookings with lead follow-up',()=>{
 const today='2026-11-03',base={inquiryId:'1',name:'Guest',country:'Peru',assignedTo:'SS',requestedDate:'2026-11-05',followupDate:'2026-11-01',tours:[{tour:'Toucan tour'}]};
 const rows=[{...base,status:'quoted'},{...base,inquiryId:'2',status:'completed'},{...base,inquiryId:'3',status:'booked'},{...base,inquiryId:'4',status:'new',archived:true}];
 assert.equal(followupDue(rows[0],today),true);assert.equal(followupDue(rows[2],today),false);assert.equal(isUpcoming(rows[2],today),true);
 assert.deepEqual(filtered(rows,{today}).map(r=>r.inquiryId),['1','3']);
 assert.deepEqual(filtered(rows,{today,scope:'followup'}).map(r=>r.inquiryId),['1']);
 assert.deepEqual(filtered(rows,{today,scope:'upcoming'}).map(r=>r.inquiryId),['3']);
 assert.equal(filtered(rows,{today,scope:'all',q:'toucan',rep:'SS'}).length,4);
 assert.equal(filtered(rows,{today,scope:'all',rep:'JPG'}).length,0);
});
test('Untrusted CRM text is escaped; country flags require a valid code',()=>{
 assert.equal(escape('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');assert.equal(flag('PE'),'🇵🇪');assert.equal(flag('<x>'),'');
 assert.equal(sampleData('2026-11-03').inquiries.length,6);
});
test('Lab is an additive read-only client under existing admin protection',async()=>{
 const js=await readFile(new URL('../admin/guest-crm-lab/lab.mjs',import.meta.url),'utf8');
 const html=await readFile(new URL('../admin/guest-crm-lab/index.html',import.meta.url),'utf8');
 const headers=await readFile(new URL('../admin/_headers',import.meta.url),'utf8');
 assert.match(js,/method:'GET'/);assert.doesNotMatch(js,/method:\s*['"](?:POST|PATCH|PUT|DELETE)/);assert.doesNotMatch(js,/localStorage|sessionStorage|setInterval/);
 assert.match(html,/href="\/guest-crm\/"/);assert.match(html,/Experimental · Read only/);assert.match(headers,/\/guest-crm-lab\/\*/);
 assert.doesNotMatch(html,/<script>(?!\s*$)|<style>/);
});
