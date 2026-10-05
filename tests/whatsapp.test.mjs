import test from 'node:test';import assert from 'node:assert/strict';
import {sampleThreads,filterThreads,mutateSample,firstResponse,normalizeKnowledge,restoreSamples} from '../admin/assets/js/whatsapp-model.mjs';
import {onRequestGet,onRequestPost} from '../functions/api/whatsapp/index.js';
const now=Date.parse('2026-10-04T15:00:00Z');
test('staff response does not count an automated acknowledgment, pending or failed send',()=>{
 const t=sampleThreads(now)[0];assert.equal(firstResponse(t),null);assert.equal(firstResponse(t,'automation').minutes,1);
 t.messages.push({id:'bad',direction:'out',kind:'human',delivery:'pending',at:new Date(now).toISOString()});assert.equal(firstResponse(t),null);
 t.messages.at(-1).delivery='failed';assert.equal(firstResponse(t),null);
 t.messages.at(-1).delivery='accepted';assert.equal(firstResponse(t).minutes,95);
});
test('response timing sorts event timestamps and separates sample evidence',()=>{
 const t=sampleThreads(now)[1];t.messages.reverse();assert.equal(firstResponse(t).minutes,13);assert.equal(firstResponse(t).sample,true);
 t.messages.push({direction:'out',kind:'human',delivery:'accepted',at:'invalid'});assert.equal(firstResponse(t).minutes,13);
});
test('handoff and notes remain separate from replies and never mutate the original',()=>{
 const t=sampleThreads(now)[0],assigned=mutateSample(t,{type:'assign',owner:'Susana'},'Juan',now);assert.equal(t.owner,'');assert.equal(assigned.owner,'Susana');assert.equal(assigned.messages.length,t.messages.length);assert.equal(assigned.notes[0].actor,'Juan');
 const noted=mutateSample(assigned,{type:'note',text:'Ask about target birds'},'Susana',now);assert.equal(noted.notes.length,2);assert.equal(firstResponse(noted),null);
 const replied=mutateSample(noted,{type:'reply',text:'What date are you considering?'},'Susana',now);assert.equal(replied.messages.at(-1).delivery,'sample');assert.equal(firstResponse(replied).minutes,95);assert.equal(replied.status,'open');
});
test('only sample records and allowed staff can be changed; CRM linkage does not create a booking',()=>{
 const t=sampleThreads(now)[0];assert.throws(()=>mutateSample({...t,id:'live-1'},{type:'reply',text:'Hi'},'Juan'));
 assert.throws(()=>mutateSample(t,{type:'reply',text:'Hi'},'Other'));assert.throws(()=>mutateSample(t,{type:'reply',text:' '} ,'Juan'));
 assert.throws(()=>mutateSample(t,{type:'assign',owner:'Other'},'Juan'));assert.throws(()=>mutateSample(t,{type:'status',status:'booked'},'Juan'));
 assert.throws(()=>mutateSample(t,{type:'link',text:'<script>'},'Juan'));assert.equal(mutateSample(t,{type:'link',text:'INQ-123'},'Juan').inquiryId,'INQ-123');
});
test('queue filters retain assignment and active/resolved meaning',()=>{
 const threads=sampleThreads(now);assert.equal(filterThreads(threads,{queue:'mine',agent:'Susana'}).length,1);assert.equal(filterThreads(threads,{queue:'unassigned'}).length,1);assert.equal(filterThreads(threads,{queue:'needs_staff'}).length,2);assert.equal(filterThreads(threads,{search:'transporte'}).length,1);assert.equal(filterThreads(threads,{queue:'resolved'}).length,1);
});
test('knowledge allowlist omits staff notes, private fields and inactive source content',()=>{
 const rows=normalizeKnowledge({items:[{content_id:'1',language:'en',title:'Tour',cost:'Reference only',whatsapp_ready:'Guest-facing reply',staff_notes:'SECRET',phone:'PRIVATE',is_active:'yes'},{title:'Inactive',message_short:'NO',is_active:'no'}]});assert.equal(rows.length,1);assert.equal(rows[0].text,'Guest-facing reply');assert.doesNotMatch(JSON.stringify(rows),/SECRET|PRIVATE|staff_notes|phone/);
 assert.equal(normalizeKnowledge({languages:{es:{Tours:[{title:'Tour',message_short:'Hola'}]}}})[0].language,'es');
});
test('sample restoration rejects live records, corrupted state and duplicate thread IDs',()=>{
 const threads=sampleThreads(now);assert.equal(restoreSamples({version:1,threads}).length,4);assert.equal(restoreSamples({version:2,threads}),null);assert.equal(restoreSamples({version:1,threads:[...threads.slice(0,3),threads[0]]}),null);threads[0].messages[0].delivery='delivered';assert.equal(restoreSamples({version:1,threads}),null);
});
test('disconnected API never sends, even if POST contains a message',async()=>{
 const original=globalThis.fetch;let fetched=false;globalThis.fetch=async()=>{fetched=true;throw new Error('Unexpected outbound request');};try{const response=await onRequestPost({request:new Request('http://localhost/api/whatsapp',{method:'POST',body:JSON.stringify({text:'Do not send'})})});assert.equal(response.status,409);assert.equal(fetched,false);assert.equal(response.headers.get('cache-control'),'private, no-store');}finally{globalThis.fetch=original;}
});
test('API rejects public host and missing administrator identity',async()=>{
 assert.equal((await onRequestGet({request:new Request('https://mindobirdwatching.com/api/whatsapp')})).status,403);
 assert.equal((await onRequestGet({request:new Request('https://admin.mindobirdwatching.com/api/whatsapp')})).status,401);
});
test('live reference connection does not imply WhatsApp or CRM connection; failure has no guessed prices',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async()=>Response.json({items:[{title:'Tour',message_short:'Review this tour',staff_notes:'secret'}]});const response=await onRequestGet({request:new Request('http://localhost/api/whatsapp')});const body=await response.json();assert.equal(body.connected,false);assert.equal(body.sendingEnabled,false);assert.equal(body.knowledge.status,'connected');assert.equal(body.integrations.crm,'not_connected');assert.doesNotMatch(JSON.stringify(body),/secret/);
 globalThis.fetch=async()=>{throw new Error('Offline');};const unavailable=await (await onRequestGet({request:new Request('http://localhost/api/whatsapp')})).json();assert.equal(unavailable.knowledge.status,'unavailable');assert.deepEqual(unavailable.knowledge.items,[]);
 }finally{globalThis.fetch=original;}
});

test('note editing retains authorship and history; deletion never changes guest messages',()=>{
 const original=sampleThreads(now)[0];const added=mutateSample(original,{type:'note',text:'Pickup pending'},'Juan',now);
 const id=added.notes[0].id;const edited=mutateSample(added,{type:'edit_note',id,text:'Pickup confirmed'},'Susana',now+60000);
 assert.equal(edited.notes[0].actor,'Juan');assert.equal(edited.notes[0].updatedBy,'Susana');assert.equal(edited.notes[0].history[0].text,'Pickup pending');assert.equal(added.notes[0].text,'Pickup pending');
 const deleted=mutateSample(edited,{type:'delete_note',id},'Juan',now+120000);assert.equal(deleted.notes.length,0);assert.deepEqual(deleted.messages,original.messages);assert.equal(deleted.noteEvents[0].note.text,'Pickup confirmed');assert.throws(()=>mutateSample(deleted,{type:'edit_note',id,text:'Missing'},'Juan'));
});
test('saved pricing replies resolve the latest provided reference and reject missing sources or fixed prices',async()=>{
 const {validateSavedReply,expandSavedReply,restoreSavedReplies}=await import('../admin/assets/js/whatsapp-model.mjs');
 const r=validateSavedReply({title:'Jewels',language:'en',category:'Tours',text:'Hello {{guest_name}}!\n{{reference}}',sourceId:'jewels'});
 assert.match(expandSavedReply(r,[{id:'jewels',language:'en',text:'Jewels $60/person'}],'Alex · sample guest'),/Hello Alex!\nJewels \$60/);
 assert.match(expandSavedReply(r,[{id:'jewels',language:'en',text:'Jewels $65/person'}],'Alex'),/\$65/);
 assert.throws(()=>expandSavedReply(r,[],'Alex'));assert.throws(()=>validateSavedReply({...r,text:'Jewels $60/person'}));assert.throws(()=>validateSavedReply({...r,sourceId:''}));assert.throws(()=>expandSavedReply(r,[{id:'jewels',language:'es',text:'Español'}],'Alex'));
 assert.equal(restoreSavedReplies({version:1,replies:[r,r,{title:'Invalid'}]}).length,1);
});

test('short and detailed variants prefer canonical fields and saved replies retain version choice',async()=>{
 const {normalizeKnowledge,expandSavedReply,validateSavedReply}=await import('../admin/assets/js/whatsapp-model.mjs');
 const rows=normalizeKnowledge({items:[{content_id:'tour',language:'en',message_short:'Short $60',message_long:'Detailed $60 with inclusions',whatsapp_ready:'Wrong image link',staff_notes:'Private'}]});
 assert.equal(rows[0].text,'Short $60');assert.equal(rows[0].longText,'Detailed $60 with inclusions');assert.doesNotMatch(JSON.stringify(rows),/Private|Wrong image/);
 const r=validateSavedReply({title:'Details',language:'en',text:'{{reference}}',sourceId:'tour',sourceVariant:'long'});
 assert.equal(expandSavedReply(r,rows,'Alex'),'Detailed $60 with inclusions');assert.equal(expandSavedReply({...r,sourceVariant:'short'},rows,'Alex'),'Short $60');
 assert.throws(()=>expandSavedReply(r,[{id:'tour',language:'en',text:'Only short'}],'Alex'));
});
