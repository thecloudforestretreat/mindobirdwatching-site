import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync(new URL('../admin/guest-crm/index.html',import.meta.url),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const CRM_API_DEFAULT'));
const record=(id,guest='G-'+id)=>({inquiry_id:id,guest_id:guest,full_name:id,status:'contacted',assigned_to:'JPG'});
const interaction=(id,guest='G-'+id)=>({interaction_id:'INT-'+id,inquiry_id:id,guest_id:guest,note:id+'_ONLY recorded message',created_by:'JPG',followup_required:'No'});
function harness(api=async()=>({ok:true,records:[]})){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},textContent:'',innerHTML:'',disabled:false,checked:false,options:[],classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return[];}});return nodes.get(id)};
 const messages=[],c={Date,Intl,URL,URLSearchParams,setTimeout,clearTimeout,console,localStorage:{getItem:()=>null,setItem(){}},location:{search:'',hostname:'localhost'},document:{getElementById:node,addEventListener(){},querySelectorAll:()=>[]},window:{scrollTo(){},addEventListener(){}}};
 vm.createContext(c);vm.runInContext(script.replace('    })();',`globalThis.qa={state,els,cache,selectRecord,resetCommunicationContext,saveInteraction,loadGuestWorkspace,interactionMatchesRecord,currentInteractionRows,renderInteractions,handleInteractionAction,install(fn,notify){api=fn;showToast=notify;render=()=>{};renderWorkspaces=()=>{};saveLocalRecords=()=>{};resetStripeDeposits=()=>{};updateQueueCursor=()=>{};fillForm=()=>{};clearAssignmentForm=()=>{};renderPaymentLedger=()=>{};setView=()=>{}}};})();`),c);
 const q=c.qa;q.cache();q.install(api,m=>messages.push(m));q.state.records=[record('A'),record('B')];return {q,node,messages};
}
test('switching guests clears unsaved text, edit identity, follow-up retry state and provider-message draft',()=>{
 const h=harness();h.q.selectRecord('A');h.node('interactionNote').value='A_ONLY unsaved';h.node('saveInteractionBtn').dataset.id='INT-A';h.node('saveInteractionBtn').dataset.pendingFollowupDate='2099-01-01';h.node('interactionFollowup').checked=true;h.node('interactionFollowupAt').value='2099-01-01T12:00';h.node('operationsMessage').value='A_ONLY provider message';h.q.state.interactions=[interaction('A')];h.q.state.interactionRetryRecord=interaction('A');
 h.q.selectRecord('B');assert.equal(h.node('interactionNote').value,'');assert.equal(h.node('saveInteractionBtn').dataset.id,'');assert.equal(h.node('saveInteractionBtn').dataset.pendingFollowupDate,'');assert.equal(h.node('interactionFollowup').checked,false);assert.equal(h.node('interactionFollowupAt').value,'');assert.equal(h.node('operationsMessage').value,'');assert.equal(h.q.state.interactions.length,0);assert.equal(h.q.state.interactionRetryRecord,null);
});
test('refreshing the same guest preserves their draft; switching inquiry or starting a new record clears it',()=>{
 const h=harness();h.q.selectRecord('A');h.node('interactionNote').value='keep A draft';h.q.resetCommunicationContext(record('A'));assert.equal(h.node('interactionNote').value,'keep A draft');h.q.resetCommunicationContext(record('A-RETURN','G-A'));assert.equal(h.node('interactionNote').value,'');h.node('interactionNote').value='return draft';h.q.resetCommunicationContext(null);assert.equal(h.node('interactionNote').value,'');
 assert.match(html,/function startNewRecord\(\)\{ resetCommunicationContext\(null\)/);assert.match(html,/function fillForm\(r\)\{ resetCommunicationContext\(r\)/);
});
test('history rejects conflicting guest identities even if inquiry or booking IDs match; same-guest history remains available',()=>{
 const h=harness(),a=record('A');a.booking_id='BOOK-A';for(const row of [{...interaction('A'),'guest_id':'G-B'},{...interaction('B'),booking_id:'BOOK-A'}])assert.equal(h.q.interactionMatchesRecord(row,a),false);
 assert.equal(h.q.interactionMatchesRecord(interaction('OLD','G-A'),a),true);assert.equal(h.q.interactionMatchesRecord({inquiry_id:'A',note:'legacy'},a),true);assert.equal(h.q.interactionMatchesRecord({note:'name only'},a),false);
 h.q.selectRecord('B');h.q.state.interactions=[interaction('A'),interaction('B')];h.q.renderInteractions();assert.ok(!h.node('interactionTimeline').innerHTML.includes('A_ONLY'));assert.match(h.node('interactionTimeline').innerHTML,/B_ONLY/);
});
test('scoped workspace requests fall back to inquiry ID without a guest ID and discard foreign response rows',async()=>{
 const calls=[],h=harness(async(action,data)=>{calls.push({action,data});return {records:action==='list_interactions'?[interaction('A'),interaction('B')]:[]}});h.q.state.records=[record('B','')];h.q.selectRecord('B');await h.q.loadGuestWorkspace();const request=calls.find(x=>x.action==='list_interactions');assert.equal(request.data.guest_id,'');assert.equal(request.data.inquiry_id,'B');assert.equal(h.q.state.interactions.length,1);assert.equal(h.q.state.interactions[0].interaction_id,'INT-B');
});
test('a failed refresh cannot retain another guest’s history',async()=>{
 const h=harness(async()=>{throw Error('offline')});h.q.selectRecord('B');h.q.state.interactions=[interaction('A')];await h.q.loadGuestWorkspace();assert.equal(h.q.state.interactions.length,0);assert.match(h.q.state.workspaceError,/could not be refreshed/);
});
test('a stale edit or delete control cannot mutate a different guest’s communication',async()=>{
 const writes=[],h=harness(async(a,d)=>{writes.push({a,d});return{ok:true,records:[]}});h.q.selectRecord('B');h.q.state.interactions=[interaction('A')];h.node('interactionNote').value='foreign edit';h.node('saveInteractionBtn').dataset.id='INT-A';await h.q.saveInteraction();assert.equal(writes.length,0);assert.match(h.messages.at(-1),/previous entry/);
 await h.q.handleInteractionAction({target:{closest:()=>({dataset:{interactionAction:'delete',id:'INT-A'}})}});assert.equal(writes.length,0);assert.match(h.messages.at(-1),/current guest/);
});
for(const failure of [false,true])test('late '+(failure?'failed':'successful')+' Alpha save does not touch Beta editor or messages',async()=>{
 let finish;const writes=[],h=harness((action,data)=>{writes.push({action,data});if(action==='create_interaction')return new Promise((resolve,reject)=>finish=()=>failure?reject(Error('A failure')):resolve({ok:true,record:{...data.interaction,interaction_id:'INT-A-SAVED'}}));return Promise.resolve({ok:true,records:[]})});
 h.q.selectRecord('A');h.node('interactionNote').value='A_ONLY saved';h.node('interactionStaff').value='JPG';const pending=h.q.saveInteraction();h.q.selectRecord('B');h.node('interactionNote').value='B_ONLY draft';h.node('saveInteractionBtn').disabled=true;finish();await pending;
 assert.equal(writes[0].data.interaction.guest_id,'G-A');assert.equal(writes[0].data.interaction.inquiry_id,'A');assert.equal(h.node('interactionNote').value,'B_ONLY draft');assert.equal(h.node('saveInteractionBtn').disabled,true);assert.equal(h.node('saveInteractionBtn').dataset.id,'');assert.equal(h.messages.length,0);
});
test('leaving and returning to Alpha still ignores completion from its previous editor session',async()=>{
 let finish;const h=harness((action,data)=>action==='create_interaction'?new Promise(resolve=>finish=()=>resolve({ok:true,record:{...data.interaction,interaction_id:'OLD-SAVE'}})):Promise.resolve({records:[]}));h.q.selectRecord('A');h.node('interactionNote').value='old A';const pending=h.q.saveInteraction();h.q.selectRecord('B');h.q.selectRecord('A');h.node('interactionNote').value='new A draft';finish();await pending;assert.equal(h.node('interactionNote').value,'new A draft');assert.equal(h.node('saveInteractionBtn').dataset.id,'');
});
test('a failed Alpha follow-up patch cannot replace Beta draft or follow-up state',async()=>{
 let rejectPatch,started;const reachedPatch=new Promise(resolve=>started=resolve);
 const h=harness((action,data)=>{if(action==='create_interaction')return Promise.resolve({ok:true,record:{...data.interaction,interaction_id:'INT-A-SAVED'}});if(action==='update_inquiry'){started();return new Promise((resolve,reject)=>rejectPatch=reject);}return Promise.resolve({records:[]});});
 h.q.selectRecord('A');h.node('interactionNote').value='A follow-up';h.node('interactionFollowup').checked=true;h.node('interactionFollowupAt').value='2099-01-01T12:00';const pending=h.q.saveInteraction();await reachedPatch;h.q.selectRecord('B');h.node('interactionNote').value='B current draft';h.node('followupInput').value='2099-02-02';rejectPatch(Error('A patch failed'));await pending;
 assert.equal(h.node('interactionNote').value,'B current draft');assert.equal(h.node('followupInput').value,'2099-02-02');assert.equal(h.q.state.interactionRetryRecord,null);assert.equal(h.messages.length,0);
});
