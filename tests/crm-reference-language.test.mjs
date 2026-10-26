import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../admin/guest-crm/index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('      let referenceMatch=null'),html.indexOf('      document.addEventListener("focusout",event=>{if(event.target.id==="referenceIdInput")'));
function harness(raw){
 const calls=[],status={textContent:''},els={referenceIdInput:{value:raw},sourceInput:{value:'manual_whatsapp'}};
 const c={els,clean:v=>String(v||'').trim(),getSelected:()=>null,document:{getElementById:()=>status},api:async(action,payload)=>{calls.push({action,...payload});return{ok:true,attribution:{contact_intent_id:payload.contact_intent_id,last_touch_source:'google'}};}};
 vm.createContext(c);vm.runInContext(code+';globalThis.testReference={referenceId,resolveReference};',c);return{...c.testReference,calls,els,status};
}
test('bare, English and Spanish references resolve to the same ID',async()=>{
 for(const raw of ['ci_test12345','Reference: ci_test12345','Referencia: ci_test12345','  referencia: ci_test12345  ']){
  const h=harness(raw);await h.resolveReference();assert.equal(h.calls[0].contact_intent_id,'ci_test12345');assert.equal(h.els.referenceIdInput.value,'ci_test12345');
 }
});
test('a whole guest message sends only its unique labelled ID to lookup',async()=>{
 for(const raw of ['Hello, I would like a tour.\nReference: ci_test12345','Hola, mi correo es private@example.invalid. Referencia: ci_test12345']){
  const h=harness(raw);await h.resolveReference();assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0],{action:'lookup_reference',contact_intent_id:'ci_test12345'});assert.equal(h.els.referenceIdInput.value,'ci_test12345');assert.ok(!JSON.stringify(h.calls).includes('private'));
 }
});
test('different labelled references and malformed IDs never trigger a guessed lookup',async()=>{
 for(const raw of ['Reference: ci_first123 Referencia: ci_second123','Reference: ci_ab','Nothing identifiable','ci_first123 | ci_second123','Reference: ci_'+ 'a'.repeat(121)]){
  const h=harness(raw);await assert.rejects(h.resolveReference(),/Invalid Reference/);assert.equal(h.calls.length,0);
 }
});
test('repeated copies of the same labelled ID are unambiguous',async()=>{
 const h=harness('Reference: ci_test12345 Referencia: ci_test12345');await h.resolveReference();assert.equal(h.calls.length,1);
});
