import test from 'node:test';import assert from 'node:assert/strict';
import {handoffSummary,packBackup,unpackBackup,encryptBackup,decryptBackup} from '../admin/assets/js/whatsapp-continuity.mjs';
import {sampleThreads,mutateSample} from '../admin/assets/js/whatsapp-model.mjs';
import {matchRecords} from '../functions/api/whatsapp/crm.js';
test('exact phone and email matches preserve separate inquiries and do not guess a country prefix',()=>{
 const records=[{inquiry_id:'A',phone_number:'+44 (7884) 411771',email:'Guest@Example.test'},{inquiry_id:'B',phone_normalized:'447884411771'},{inquiry_id:'C',phone_number:'7884411771'}];
 assert.deepEqual(matchRecords(records,'+44 7884 411771').map(m=>m.record.inquiry_id),['A','B']);
 assert.deepEqual(matchRecords(records,'guest@example.test').map(m=>m.match),['Exact email']);
 assert.equal(matchRecords(records,'+44 7884 411772').length,0);
});
test('handoff uses linked or reviewed details and separates guest requests from staff replies',()=>{
 const t=sampleThreads()[1],h=handoffSummary(t,{tour:'Transfer',date:'2026-10-12',guests:'3'});
 assert.equal(h.guests,'3');assert.equal(h.source,'Linked CRM');assert.match(h.lastGuest,/decidiendo/);assert.match(h.lastStaff,/cuántas/);
});
test('review retains original and final reply but does not approve it for reuse',()=>{
 const t=sampleThreads()[0];t.lastSuggestion={text:'Original draft',lastMessageId:t.messages[0].id};
 const updated=mutateSample(t,{type:'reply',text:'My improved reply'},'Juan');
 assert.equal(updated.replyReviews[0].original,'Original draft');assert.equal(updated.replyReviews[0].final,'My improved reply');assert.equal(updated.replyReviews[0].status,'conversation_only');assert.equal(updated.replyReviews[0].changed,true);
 updated.lastSuggestion={text:'Stale',lastMessageId:'old'};assert.equal(mutateSample(updated,{type:'reply',text:'Another reply'},'Juan').replyReviews.at(-1).original,'');
});
test('encrypted export supports isolated recovery with messages notes and audit; corruption and wrong password fail',async()=>{
 const snapshot={mode:'shared_test',sendingEnabled:false,metaConnected:false,threads:sampleThreads(),replies:[],learning:[],events:[],learningHistory:[],exportedAt:new Date().toISOString()};
 const packed=await packBackup(snapshot),encrypted=await encryptBackup(packed,'a long test passphrase');assert.equal(JSON.stringify(encrypted).includes('Alex'),false);
 const restored=await unpackBackup(await decryptBackup(encrypted,'a long test passphrase'));assert.equal(restored.summary.conversations,4);assert.deepEqual(restored.snapshot,JSON.parse(JSON.stringify(snapshot)));
 await assert.rejects(decryptBackup(encrypted,'incorrect password'),/Cannot unlock/);
 packed.snapshot.threads[0].name='Altered';await assert.rejects(unpackBackup(packed),/integrity/);
 await assert.rejects(packBackup({...snapshot,threads:[snapshot.threads[0],snapshot.threads[0]]}),/duplicate/);
 await assert.rejects(packBackup({...snapshot,sendingEnabled:true}),/disconnected/);
});
