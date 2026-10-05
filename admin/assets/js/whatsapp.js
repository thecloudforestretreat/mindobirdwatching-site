import {conversationSource} from './whatsapp-source.mjs?v=20261005-source';
import {sampleThreads,filterThreads,mutateSample,firstResponse,restoreSamples,validateSavedReply,expandSavedReply,restoreSavedReplies,referenceText} from './whatsapp-model.mjs?v=20261005-variants';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),KEY='mbw.whatsapp.samples.v1';
const REPLIES_KEY='mbw.whatsapp.savedReplies.v1';
let savedReplies=[],editingReply='',editingNote='';
try{savedReplies=restoreSavedReplies(JSON.parse(localStorage.getItem(REPLIES_KEY)));}catch{}
let threads=sampleThreads(),selected='sample-1',knowledge=[],knowledgeStatus='loading',knowledgeCheckedAt='',storageAvailable=true;
try{const restored=restoreSamples(JSON.parse(localStorage.getItem(KEY)||sessionStorage.getItem(KEY)));if(restored)threads=restored;}catch{storageAvailable=false;}
const current=()=>threads.find(t=>t.id===selected),agent=()=>$('agent').value,time=v=>new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function notice(text){$('notice').textContent=text;}
function save(){try{localStorage.setItem(KEY,JSON.stringify({version:1,threads}));}catch{storageAvailable=false;notice('Browser storage unavailable. Sample changes will last only while this page is open.');}}
function setPane(pane){
 if(!['inbox','chat','context'].includes(pane))return;
 document.querySelector('.wa-workspace').dataset.pane=pane;
 document.querySelectorAll('.mobile-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pane===pane)));
 if(matchMedia('(max-width:1199px)').matches){
  const panel=$('wa-'+pane);panel.scrollIntoView({block:'start'});panel.focus({preventScroll:true});
 }
}
$('back-inbox').onclick=()=>setPane('inbox');
$('open-references').onclick=()=>{
 setPane('context');
 const search=$('knowledge-search');search.closest('details').open=true;search.focus({preventScroll:true});
};
const navigation=document.querySelector('[data-admin-nav]');
if(navigation&&typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{
 document.documentElement.style.setProperty('--wa-nav-offset',Math.ceil(navigation.getBoundingClientRect().height+8)+'px');
}).observe(navigation);
function update(action){try{const index=threads.findIndex(t=>t.id===selected);threads[index]=mutateSample(current(),action,agent());save();render();return true;}catch(error){notice(error.message);return false;}}
const resolvedReferences=new Map();let referenceController=null;
function renderInquirySource(){const source=conversationSource(current().messages);document.querySelector('.inquiry-source').dataset.empty=String(!source.reference&&!source.landingPage&&!source.invalidPage);$('inquiry-intent').textContent=source.bookingIntent?'Booking intent · not confirmed':'Inquiry';$('inquiry-intent').className='pill '+(source.bookingIntent?'pending':'active');
 const fields=[['Campaign source',source.label],['Landing page',source.landingPage?.url||'Not supplied'],['Website reference',source.reference||'Not supplied']];$('inquiry-source-fields').innerHTML='<dl class="guest-fields">'+fields.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>'+(Object.keys(source.tracking).length?'<details><summary>Campaign &amp; ad details</summary><dl class="tracking-fields">'+Object.entries(source.tracking).map(([k,v])=>'<div><dt>'+esc(k.replaceAll('_',' '))+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl></details>':'')+'<p class="small">'+esc(source.evidence)+(source.hasClickId?'. Facebook click ID present; this alone does not identify a paid ad.':'.')+'</p>'+(source.invalidPage?'<p class="source-warning">Page URL is outside the MBW website or invalid; not used for attribution.</p>':'')+(source.duplicateTracking.length?'<p class="source-warning">Repeated tracking parameters: '+esc(source.duplicateTracking.join(', '))+'. Review the original message.</p>':'')+(source.references.length>1?'<p class="source-warning">Multiple references supplied. The latest is selected; review before linking.</p>':'')+(source.bookingIntent&&!linkedRecords.get(current().inquiryId)?'<p class="small">Booking details to review: specific tour, date, party size and pickup. A general tours page does not select a tour.</p>':'');
 $('verify-reference').hidden=!source.reference;$('verify-reference').disabled=!!referenceController;const resolved=resolvedReferences.get(source.reference);$('reference-state').textContent=resolved?'Saved website reference matched · retrieved '+time(resolved.checkedAt):source.reference?'Website reference not checked. Lookup is read-only.':'No website reference to look up.';
 $('reference-details').innerHTML=resolved?'<details><summary>Saved website attribution</summary><dl class="tracking-fields">'+Object.entries(resolved.attribution).filter(([k])=>k!=='contact_intent_id').map(([k,v])=>'<div><dt>'+esc(k.replaceAll('_',' '))+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl><p class="small">A matched reference is a website contact intent, not a confirmed booking or an automatically linked CRM guest.</p></details>':'';
 if(resolved){const url=source.tracking,c=resolved.attribution;const conflicts=['source','medium','campaign'].filter(k=>url['utm_'+k]&&(c['last_touch_'+k]||c['utm_'+k])&&url['utm_'+k]!==String(c['last_touch_'+k]||c['utm_'+k]));if(conflicts.length)$('reference-state').textContent+=' · URL and saved '+conflicts.join(', ')+' differ; review both sources.';}
}
$('sample-incoming-form').onsubmit=e=>{e.preventDefault();clearSuggestion();referenceController?.abort();referenceController=null;if(update({type:'incoming',text:$('sample-incoming').value})){$('sample-incoming').value='';$('sample-incoming-form').closest('details').open=false;notice('Sample incoming message added. No guest, inquiry or booking was created.');}};
$('verify-reference').onclick=async()=>{referenceController?.abort();const controller=new AbortController();referenceController=controller;const id=conversationSource(current().messages).reference,threadId=current().id;const timer=setTimeout(()=>controller.abort(),30000);$('verify-reference').disabled=true;$('reference-state').textContent='Looking up the website reference…';try{const response=await fetch('/api/whatsapp/reference',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference:id}),signal:controller.signal});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Lookup unavailable.');if(referenceController!==controller||current().id!==threadId||conversationSource(current().messages).reference!==id)return;resolvedReferences.set(id,data);renderInquirySource();}catch(error){if(referenceController===controller){$('reference-state').textContent=error.name==='AbortError'?'Reference lookup timed out. No CRM record changed.':error.message;notice($('reference-state').textContent);}}finally{clearTimeout(timer);if(referenceController===controller){referenceController=null;$('verify-reference').disabled=false;}}};
const linkedRecords=new Map();let crmController=null;
function renderGuestContext(){const t=current(),record=linkedRecords.get(t.inquiryId),state=$('guest-context-state');state.dataset.error='false';$('guest-next-action').textContent='Next action: '+(t.nextAction||'Not recorded');$('crm-refresh').disabled=!t.inquiryId;$('crm-unlink').disabled=!t.inquiryId;$('crm-record-link').href='/guest-crm/'+(t.inquiryId?'?inquiry_id='+encodeURIComponent(t.inquiryId):'');
 if(!record){state.textContent=t.inquiryId?'Linked ID: '+t.inquiryId+' · refresh to verify current CRM data.':'No CRM record linked. Tour, date and payment details are unverified.';$('guest-context-fields').innerHTML='';return;}
 state.textContent='CRM record: '+record.name+' · test association · retrieved '+time(record.checkedAt);const label=v=>String(v||'Not recorded').replaceAll('_',' ');const color=v=>['booked','confirmed','completed','paid','deposit_paid'].includes(v)?'confirmed':['cancelled','did_not_book'].includes(v)?'closed':'pending';
 const fields=[['Tour / interest',record.tour],['Requested / tour date',record.date],['Party size',record.guests],['Booking / inquiry status',record.status],['Payment status',record.payment],['Pickup',record.pickup],['CRM assigned staff',record.assignedTo]];$('guest-context-fields').innerHTML='<dl class="guest-fields">'+fields.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+(k.includes('status')?'<span class="pill '+color(v)+'">'+esc(label(v))+'</span>':esc(label(v)))+'</dd></div>').join('')+'</dl>'+(record.items?.length?'<details><summary>'+record.items.length+' recorded tour / activity items</summary><ul>'+record.items.map(i=>'<li>'+esc(i.date||'Date missing')+' · '+esc(i.tour||'Tour missing')+' · '+esc(label(i.status))+'</li>').join('')+'</ul></details>':'');
}
async function lookupCrm(payload,link=false){if(!payload.inquiryId&&(!payload.query||payload.query.length<3)){notice('Enter at least 3 characters to search CRM.');return;}crmController?.abort();const controller=new AbortController();crmController=controller;const threadId=current().id;const timer=setTimeout(()=>controller.abort(),30000);$('crm-search-button').disabled=true;$('crm-state').dataset.error='false';$('crm-state').textContent='Checking CRM…';$('crm-results').innerHTML='';
 try{const response=await fetch('/api/whatsapp/crm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'CRM lookup unavailable.');if(controller!==crmController||current().id!==threadId)return;const records=data.records||[];if(link){if(records.length!==1)throw Error('No exact record found. The existing link was not changed.');linkCrmRecord({...records[0],checkedAt:data.checkedAt});}else{$('crm-state').textContent=records.length+' matches'+(data.more?' · refine your search for more':'')+' · select the correct inquiry; trips stay separate.';$('crm-results').innerHTML=records.map((r,i)=>'<button type="button" data-crm-result="'+i+'"><strong>'+esc(r.name||'Guest')+'</strong><br>'+esc(r.inquiryId)+' · '+esc(r.date||'No date')+' · '+esc(r.tour||'No tour')+'<br>Link this record for review</button>').join('');$('crm-results').querySelectorAll('[data-crm-result]').forEach(b=>b.onclick=()=>linkCrmRecord({...records[Number(b.dataset.crmResult)],checkedAt:data.checkedAt}));}}
 catch(error){if(controller===crmController){$('crm-state').dataset.error='true';$('crm-state').textContent=error.name==='AbortError'?'CRM lookup timed out. Retry; no record changed.':error.message;notice($('crm-state').textContent);}}
 finally{clearTimeout(timer);if(controller===crmController){crmController=null;$('crm-search-button').disabled=false;}}
}
function linkCrmRecord(record){linkedRecords.set(record.inquiryId,record);if(update({type:'link',text:record.inquiryId})){$('crm-state').textContent='Linked for local review. No CRM record changed.';$('crm-results').innerHTML='';notice('CRM record linked for review; sample association only.');}}
$('crm-search-form').onsubmit=e=>{e.preventDefault();lookupCrm({query:$('crm-query').value.trim()});};
$('crm-refresh').onclick=()=>lookupCrm({inquiryId:current().inquiryId},true);
$('crm-unlink').onclick=()=>{crmController?.abort();crmController=null;$('crm-search-button').disabled=false;update({type:'link',text:''});$('crm-state').textContent='Unlinked locally. CRM record unchanged.';};
$('open-crm-context').onclick=()=>{setPane('context');$('crm-section').open=true;$('crm-query').focus();};
$('open-saved').onclick=()=>{setPane('context');$('saved-section').open=true;$('saved-search').focus();};
$('open-ai').onclick=()=>{document.querySelector('.suggest-tools').open=true;$('suggest-reply').focus();};
function sourceBadge(thread){const source=conversationSource(thread.messages);return source.paidTracking||source.hasMetaIds?'<span class="pill campaign">'+esc(source.label)+'</span>':'';}
function renderList(){const visible=filterThreads(threads,{search:$('search').value,queue:$('queue').value,agent:agent()});$('thread-list').innerHTML=visible.map(t=>'<button type="button" class="thread" data-thread="'+t.id+'" aria-current="'+(t.id===selected)+'"><strong>'+esc(t.name)+'</strong><small>'+esc(t.topic)+' · '+esc(t.owner||'Unassigned')+'</small><small class="snippet">'+esc((t.messages.at(-1)?.text||'').split(/\n\s*(?:Page|Reference):/i)[0])+'</small><span class="pill '+({needs_staff:'amber',resolved:'resolved',open:'active'}[t.status])+'">'+esc({open:'Open',needs_staff:'Needs staff',resolved:'Resolved'}[t.status])+'</span>'+sourceBadge(t)+'</button>').join('')||'<p class="small">No sample conversations match these filters. Your selected conversation remains available in Conversation.</p>';
 $('summary').textContent=threads.filter(t=>t.status!=='resolved').length+' active samples · '+threads.filter(t=>t.status==='needs_staff').length+' need staff · '+threads.filter(t=>!t.owner&&t.status!=='resolved').length+' unassigned';
}
function messageDisplay(text){const cut=text.search(/\n\s*(?:Page|Reference):/i);return cut<0?'<p>'+esc(text)+'</p>':'<p>'+esc(text.slice(0,cut))+'</p><details class="message-source-details"><summary>Original page &amp; reference</summary><p>'+esc(text.slice(cut).trim())+'</p></details>';}
function renderConversation(){renderGuestContext();renderInquirySource();const t=current();$('guest-name').textContent=t.name;$('guest-topic').textContent=t.topic+' · '+(t.language==='es'?'Spanish':'English')+' · sample conversation';$('owner').value=t.owner;$('thread-status').value=t.status;$('next-action').value=t.nextAction;$('inquiry-id').value=t.inquiryId;$('reply').value=t.draft;$('note').value=t.noteDraft||'';
 const human=firstResponse(t),auto=firstResponse(t,'automation'),label=r=>r?Math.round(r.minutes)+' min · simulated':'Awaiting recorded reply';$('response-times').innerHTML='<div><strong>First staff reply:</strong> '+esc(label(human))+'</div><div><strong>Automated acknowledgment:</strong> '+esc(auto?label(auto):'None in sample')+'</div>';
 $('messages').innerHTML=t.messages.map(m=>'<article class="bubble '+(m.direction==='out'?'out ':'')+(m.kind==='automation'?'automation':'')+'">'+messageDisplay(m.text)+'<small>'+esc(m.direction==='in'?'Sample guest':m.kind==='automation'?'Automated acknowledgment':(m.actor||t.owner||'Staff')+' · staff reply')+' · '+esc(time(m.at))+(m.direction==='out'?' · Simulated, not delivered':'')+'</small></article>').join('');$('messages').scrollTop=$('messages').scrollHeight;
 $('notes').innerHTML=t.notes.map(n=>'<article class="note">'+esc(n.text)+'<small>'+esc(n.actor)+' · '+esc(time(n.at))+' · internal sample note'+(n.updatedAt?' · edited by '+esc(n.updatedBy)+' '+esc(time(n.updatedAt)):'')+'</small><div class="note-actions"><button type="button" data-note-edit="'+esc(n.id)+'">Edit</button><button type="button" data-note-delete="'+esc(n.id)+'">Delete</button></div></article>').join('')||'<p class="small">No internal notes yet.</p>';draftCount();
}
function draftCount(){$('draft-count').textContent=$('reply').value.length+' / 4,000 characters';$('sample-reply').disabled=!$('reply').value.trim();}
function render(){renderList();renderConversation();renderGuestContext();}
function renderKnowledge(){const language=$('knowledge-language').value,category=$('knowledge-category').value,q=$('knowledge-search').value.trim().toLowerCase(),rows=knowledge.filter(r=>r.language===language&&(!category||r.subject===category)&&(!q||[r.title,r.text,r.longText,r.price].join(' ').toLowerCase().includes(q)));
 $('knowledge-state').textContent=knowledgeStatus==='connected'?rows.length+' source items · insert as a draft and review before replying':knowledgeStatus==='loading'?'Loading Staff Info Library…':'Reference feed unavailable. Open the Staff Info Library; no fallback prices are guessed.';
 $('knowledge-list').innerHTML=rows.map((r,i)=>'<article class="knowledge-card"><h3>'+esc(r.title)+'</h3>'+(r.price?'<p><strong>Price reference: '+esc(r.price)+'</strong></p>':'')+'<details class="reply-preview" open><summary>Short reply</summary><p>'+esc(r.shortText||r.text)+'</p></details>'+(r.longText?'<details class="reply-preview"><summary>Detailed reply</summary><p>'+esc(r.longText)+'</p></details>':'')+'<p class="small">'+esc(r.subject)+' · source updated '+esc(r.updated||'date unavailable')+' · review required</p><div class="note-actions"><button type="button" data-knowledge="'+i+'" data-variant="short">Insert short reply</button>'+(r.longText?'<button type="button" data-knowledge="'+i+'" data-variant="long">Insert detailed reply</button>':'')+'</div></article>').join('');
 $('knowledge-list').querySelectorAll('[data-knowledge]').forEach(b=>b.onclick=()=>{const item=rows[Number(b.dataset.knowledge)],t=current(),draft=[t.draft,referenceText(item,b.dataset.variant)].filter(Boolean).join('\n\n');if(draft.length>4000){notice('This reference would exceed the reply limit. Shorten the draft first.');return;}t.draft=draft;save();$('reply').value=draft;draftCount();setPane('chat');$('reply').focus();notice('Reference inserted into a sample draft. Review pricing, conditions and dates before using it.');});
}
$('thread-list').addEventListener('click',event=>{const b=event.target.closest('[data-thread]');if(!b)return;clearSuggestion();referenceController?.abort();referenceController=null;crmController?.abort();crmController=null;$('crm-search-button').disabled=false;$('crm-results').innerHTML='';$('crm-state').textContent='';selected=b.dataset.thread;$('suggest-language').value=current().language;suggestSources();cancelNoteEdit();renderConversation();renderList();$('knowledge-language').value=current().language;renderKnowledge();setPane('chat');});
for(const id of ['search','queue','agent'])$(id).addEventListener(id==='search'?'input':'change',renderList);
$('owner').addEventListener('change',()=>{if(update({type:'assign',owner:$('owner').value}))notice('Sample assignment recorded. This handoff is local to this browser.');});
$('thread-status').addEventListener('change',()=>{if(update({type:'status',status:$('thread-status').value}))notice('Sample conversation state updated.');});
$('reply').addEventListener('input',()=>{current().draft=$('reply').value;save();draftCount();});
$('reply-form').addEventListener('submit',event=>{event.preventDefault();if(update({type:'reply',text:$('reply').value}))notice('Sample reply added. Nothing was sent to WhatsApp.');});
$('note').addEventListener('input',()=>{if(!editingNote){current().noteDraft=$('note').value;save();}});
$('note-form').addEventListener('submit',event=>{event.preventDefault();if(update({type:editingNote?'edit_note':'note',id:editingNote,text:$('note').value})){current().noteDraft='';cancelNoteEdit();save();notice('Internal sample note saved; guest messages are unchanged.');}});
function cancelNoteEdit(){editingNote='';$('save-note').textContent='Add sample note';$('cancel-note-edit').hidden=true;$('note').value=current().noteDraft||'';}
$('cancel-note-edit').onclick=cancelNoteEdit;
$('add-internal-note').onclick=()=>{setPane('context');$('notes-section').open=true;$('note').focus();};
$('notes').onclick=event=>{
 const edit=event.target.closest('[data-note-edit]'),del=event.target.closest('[data-note-delete]');
 if(edit){const note=current().notes.find(n=>n.id===edit.dataset.noteEdit);if(!note)return;editingNote=note.id;$('note').value=note.text;$('save-note').textContent='Save changes';$('cancel-note-edit').hidden=false;$('note').focus();}
 if(del&&confirm('Delete this internal note? Guest messages and CRM records will remain unchanged.')){if(update({type:'delete_note',id:del.dataset.noteDelete})){cancelNoteEdit();notice('Internal sample note deleted.');}}
};
$('next-form').addEventListener('submit',event=>{event.preventDefault();if(update({type:'next',text:$('next-action').value}))notice('Sample next action saved.');});
$('link-form').addEventListener('submit',event=>{event.preventDefault();lookupCrm({inquiryId:$('inquiry-id').value.trim()},true);});
$('setup-toggle').onclick=()=>{const expanded=$('setup-toggle').getAttribute('aria-expanded')==='true';$('setup-toggle').setAttribute('aria-expanded',String(!expanded));$('setup-panel').hidden=expanded;};
$('reset').onclick=()=>{if(!confirm('Reset all sample replies, drafts, assignments and notes in this browser?'))return;clearSuggestion();threads=sampleThreads();selected='sample-1';cancelNoteEdit();$('search').value='';$('queue').value='all';save();render();notice('Sample conversations reset.');};
document.querySelectorAll('.mobile-tabs button').forEach(b=>b.onclick=()=>setPane(b.dataset.pane));
for(const id of ['knowledge-language','knowledge-category','knowledge-search'])$(id).addEventListener(id==='knowledge-search'?'input':'change',renderKnowledge);
function insertDraft(text){const draft=[current().draft,text].filter(Boolean).join('\n\n');if(draft.length>4000)throw new Error('The combined draft exceeds 4,000 characters.');current().draft=draft;save();$('reply').value=draft;draftCount();setPane('chat');$('reply').focus();}
function renderSaved(){
 const q=$('saved-search').value.trim().toLowerCase();
 $('saved-list').innerHTML=savedReplies.filter(r=>!q||[r.title,r.category,r.text].join(' ').toLowerCase().includes(q)).map(r=>'<article class="knowledge-card"><h3>'+esc(r.title)+'</h3><p class="small">'+esc(r.category)+' · '+(r.language==='es'?'Español':'English')+(r.sourceId?' · '+(r.sourceVariant==='long'?'detailed':'short')+' live reference':'')+'</p><p>'+esc(r.text)+'</p><div class="note-actions"><button type="button" data-saved-insert="'+esc(r.id)+'">Insert into draft</button><button type="button" data-saved-edit="'+esc(r.id)+'">Edit</button><button type="button" data-saved-delete="'+esc(r.id)+'">Delete</button></div></article>').join('')||'<p class="small">No saved replies yet, or no matches. Create a reply to reuse across conversations.</p>';
}
function sourceOptions(selected=''){
 const language=$('saved-language').value;
 $('saved-source').innerHTML='<option value="">No linked reference</option>'+knowledge.filter(r=>r.language===language).map(r=>'<option value="'+esc(r.id)+'">'+esc(r.title)+'</option>').join('');
 $('saved-source').value=selected;
}
function openSaved(reply){$('saved-error').hidden=true;$('saved-error').textContent='';editingReply=reply?.id||'';$('saved-form').hidden=false;$('saved-form-title').textContent=editingReply?'Edit saved reply':'New saved reply';$('saved-title').value=reply?.title||'';$('saved-language').value=reply?.language||current().language;$('saved-category').value=reply?.category||'General';$('saved-text').value=reply?.text||'';$('saved-variant').value=reply?.sourceVariant||'short';sourceOptions(reply?.sourceId||'');setPane('context');$('saved-section').open=true;$('saved-title').focus();}
function persistReplies(){localStorage.setItem(REPLIES_KEY,JSON.stringify({version:1,replies:savedReplies}));}
$('new-saved').onclick=()=>openSaved();
$('save-current-draft').onclick=()=>openSaved({text:current().draft});
$('cancel-saved').onclick=()=>{$('saved-form').hidden=true;editingReply='';};
$('saved-language').onchange=()=>sourceOptions();
$('saved-source').onchange=()=>{if($('saved-source').value&&!$('saved-text').value.includes('{{reference}}'))$('saved-text').value=[$('saved-text').value,'{{reference}}'].filter(Boolean).join('\n\n');};
$('saved-search').oninput=renderSaved;
$('saved-form').onsubmit=event=>{event.preventDefault();try{
 if($('saved-source').value&&!$('saved-text').value.includes('{{reference}}')){
  const combined=[$('saved-text').value.trim(),'{{reference}}'].filter(Boolean).join('\n\n');
  if(combined.length>4000)throw new Error('Leave room for the selected tour reference, or choose No linked reference.');
  $('saved-text').value=combined;
 }
 if(!editingReply&&savedReplies.length>=200)throw new Error('The local library supports up to 200 replies.');
 const reply={...validateSavedReply({id:editingReply,title:$('saved-title').value,category:$('saved-category').value,language:$('saved-language').value,text:$('saved-text').value,sourceId:$('saved-source').value,sourceVariant:$('saved-variant').value}),updatedBy:agent(),updatedAt:new Date().toISOString()};
 const previous=savedReplies;savedReplies=editingReply?savedReplies.map(r=>r.id===editingReply?reply:r):[...savedReplies,reply];try{persistReplies();}catch{savedReplies=previous;throw new Error('Browser storage is unavailable; this reply was not saved.');}
 $('saved-form').hidden=true;editingReply='';$('saved-search').value='';renderSaved();$('saved-status').textContent='Saved: '+reply.title+' · on this browser only.';$('saved-status').scrollIntoView({block:'center'});notice('Saved reply stored on this browser. Review before sending.');
 }catch(error){$('saved-error').textContent=error.message;$('saved-error').hidden=false;$('saved-error').focus();$('saved-error').scrollIntoView({block:'center'});notice(error.message);}};
$('saved-list').onclick=event=>{const b=event.target.closest('button');if(!b)return;const id=b.dataset.savedInsert||b.dataset.savedEdit||b.dataset.savedDelete,reply=savedReplies.find(r=>r.id===id);if(!reply)return;
 try{if(b.dataset.savedInsert){insertDraft(expandSavedReply(reply,knowledge,current().name));notice('Saved reply inserted into draft; nothing sent. Review before use.');}
 if(b.dataset.savedEdit)openSaved(reply);
 if(b.dataset.savedDelete&&confirm('Delete this saved reply from this browser? Existing messages will remain unchanged.')){const previous=savedReplies;savedReplies=savedReplies.filter(r=>r.id!==id);try{persistReplies();}catch{savedReplies=previous;throw new Error('Browser storage is unavailable; reply was not deleted.');}if(editingReply===id){editingReply='';$('saved-form').hidden=true;}renderSaved();notice('Saved reply deleted.');}
 }catch(error){notice(error.message);}
};
let suggestionThread='',suggestController=null;
function suggestSources(){const selected=$('suggest-source').value;$('suggest-source').innerHTML='<option value="">No reference · ask or answer from conversation</option>'+knowledge.filter(r=>r.language===$('suggest-language').value).map(r=>'<option value="'+esc(r.id)+'">'+esc(r.title)+'</option>').join('');if(knowledge.some(r=>r.id===selected&&r.language===$('suggest-language').value))$('suggest-source').value=selected;}
function clearSuggestion(){suggestController?.abort();suggestController=null;suggestionThread='';$('suggest-preview').hidden=true;$('suggest-status').textContent='';$('suggest-reply').disabled=false;}
$('suggest-language').onchange=suggestSources;
$('discard-suggestion').onclick=clearSuggestion;
$('suggest-reply').onclick=async()=>{
 clearSuggestion();const threadId=current().id;const source=knowledge.find(r=>r.id===$('suggest-source').value&&r.language===$('suggest-language').value);
 $('suggest-reference-state').textContent=source?'Reference: '+source.title+' · retrieved '+(knowledgeCheckedAt?time(knowledgeCheckedAt):'time unavailable')+' · source updated '+(source.updated||'date unavailable')+' · review required':'No tour reference selected. No prices or booking facts will be invented.';
 let reference='';try{if(source)reference=referenceText(source,$('suggest-variant').value);}catch(error){$('suggest-status').textContent=error.message;return;}
 const controller=new AbortController();suggestController=controller;const timeout=setTimeout(()=>controller.abort(),105000);$('suggest-reply').disabled=true;$('suggest-status').textContent='Preparing a suggestion on the Mac mini… You can continue editing your draft.';
 try{
  const session=await fetch('/inquiry-studio/api/session',{cache:'no-store',signal:controller.signal});if(!session.ok)throw new Error('Mac mini connection unavailable (HTTP '+session.status+'). Open Inquiry Studio to check access, then retry.');const data=await session.json();if(!data.token)throw new Error('Inquiry Studio session unavailable.');
  const response=await fetch('/inquiry-studio/api/whatsapp-suggest',{method:'POST',headers:{'Content-Type':'application/json','X-Pilot-Token':data.token},signal:controller.signal,body:JSON.stringify({language:$('suggest-language').value,variant:$('suggest-variant').value,messages:current().messages.filter(m=>m.kind!=='automation').slice(-12).map(m=>({direction:m.direction,text:m.text.split(/\n\s*(?:Page|Reference):/i)[0].slice(0,2000)})),reference})});
  if(response.status===404)throw new Error('The Mac mini needs the WhatsApp drafting update. Manual replies remain available.');
  const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'Suggestion unavailable.');
  if(current().id!==threadId||suggestController!==controller)return;
  if(typeof result.reply!=='string'||!result.reply.trim()||result.reply.length>4000)throw new Error('Invalid suggestion received.');
  suggestionThread=threadId;$('suggest-text').value=result.reply;$('suggest-preview').hidden=false;$('suggest-status').textContent='Local AI draft · review facts, language and tone. Nothing sent.';
 }catch(error){if(suggestController===controller){const message=error.name==='AbortError'?'Suggestion timed out or was cancelled. Try again or reply manually.':error.message;$('suggest-status').textContent=message;notice('AI suggestion: '+message);}}
 finally{clearTimeout(timeout);if(suggestController===controller){suggestController=null;$('suggest-reply').disabled=false;}}
};
$('use-suggestion').onclick=()=>{if(suggestionThread!==current().id){clearSuggestion();return;}try{insertDraft($('suggest-text').value);clearSuggestion();notice('Suggestion inserted into editable draft. Nothing sent.');}catch(error){$('suggest-status').textContent=error.message;}};
renderSaved();
render();if(!storageAvailable)notice('Sample storage is unavailable. Changes may not survive a reload.');
try{const response=await fetch('/api/whatsapp',{cache:'no-store'});if(!response.ok)throw new Error('Unavailable');const data=await response.json();knowledgeCheckedAt=data.knowledge?.checkedAt||'';knowledgeStatus=data.knowledge?.status==='connected'?'connected':'unavailable';knowledge=Array.isArray(data.knowledge?.items)?data.knowledge.items:[];$('knowledge-category').innerHTML='<option value="">All categories</option>'+[...new Set(knowledge.map(r=>r.subject))].sort().map(s=>'<option>'+esc(s)+'</option>').join('');$('knowledge-health').textContent=knowledgeStatus==='connected'?'Live reference loaded from the existing library. Retrieved '+time(data.knowledge.checkedAt)+'. Staff review remains required.':'Reference feed unavailable; no stale prices substituted.';}catch{knowledgeStatus='unavailable';$('knowledge-health').textContent='Reference feed unavailable; open the existing library to review information.';}renderKnowledge();sourceOptions();suggestSources();
