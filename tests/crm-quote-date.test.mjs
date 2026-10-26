import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../admin/guest-crm/index.html',import.meta.url),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const CRM_API_DEFAULT'));
const workflow=JSON.parse(fs.readFileSync(new URL('../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json',import.meta.url),'utf8'));
const processor=workflow.nodes.find(n=>n.name==='Update Inquiry - Prepare Row').parameters.jsCode;

function harness(record={}){
  const nodes=new Map();
  function node(id){if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},textContent:'',innerHTML:'',disabled:false,options:[],checked:false,focus(){},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll(){return[];}});return nodes.get(id);}
  const base={inquiry_id:'QA-QUOTE-DATE',guest_id:'QA-GUEST',status:'new',quote_status:'not_sent',quote_sent_at:'',is_archived:'No',source_page:'/book-tour/',created_at:'2026-10-20T10:00:00Z',...record};
  const rows=[structuredClone(base)],calls=[];
  const backend=payload=>new Function('$','$input',processor)(()=>({first:()=>({json:payload})}),{all:()=>rows.map(json=>({json}))})[0].json;
  const context={console,URL,URLSearchParams,Date,Intl,setTimeout,clearTimeout,location:{hostname:'localhost',search:''},localStorage:{getItem(){return null;},setItem(){}},document:{getElementById:node,addEventListener(){},querySelectorAll(){return[];}},window:{addEventListener(){},location:{search:''}},persist:async(action,payload)=>{assert.equal(action,'update_inquiry');calls.push(structuredClone(payload));const saved=backend(payload);assert.notEqual(saved.ok,false);Object.assign(rows[0],saved.record);return saved;}};
  vm.createContext(context);
  vm.runInContext(script.replace('    })();',`globalThis.qa={cache,state,els,fillQuoteOptions,formRecord,saveRecord,markQuotesSent,localDateTimeValue,clearInteractionForm,install(){api=persist;resolveReference=async()=>null;render=()=>{};saveLocalRecords=()=>{};showToast=()=>{};upsert=record=>{state.records=[record]}}};})();`),context);
  const q=context.qa;q.cache();q.install();q.state.records=[base];q.state.selectedId=base.inquiry_id;
  for(const [id,value] of Object.entries({modeInput:'update',guestIdInput:base.guest_id,firstNameInput:'QA',fullNameInput:'QA Guest',emailInput:'qa@example.invalid',countryInput:'US',sourceInput:'site_book_tour',tourInput:'Birdwatching',guestCountInput:'2',dateInput:'2099-11-26',recordStatusInput:base.status,quoteStatusInput:base.quote_status,paymentStatusInput:'unpaid',serviceTypeInput:'Birdwatching',priorityInput:'normal',followupInput:'2099-11-01'}))node(id).value=value;
  return {q,node,base,rows,calls};
}

test('blank, absent, whitespace and invalid sent dates stay blank through load and actual backend save',async()=>{
  for(const sent of ['',undefined,null,'   ','not-a-date']){
    const h=harness({quote_sent_at:sent});h.q.fillQuoteOptions(h.base);
    assert.equal(h.node('quoteSentAtInput').value,'');
    assert.equal(h.q.formRecord().quote_sent_at,'');
    assert.equal(await h.q.saveRecord(),true);
    assert.equal(h.rows[0].quote_sent_at,'');assert.equal(h.rows[0].quote_status,'not_sent');assert.equal(h.rows[0].source_page,'/book-tour/');
  }
});

test('existing sent dates survive normal saves, including inconsistent historical statuses',async()=>{
  for(const status of ['not_sent','sent','accepted']){
    const sent='2026-10-20T15:00:00.000Z';const h=harness({quote_status:status,quote_sent_at:sent});
    h.q.fillQuoteOptions(h.base);assert.ok(h.node('quoteSentAtInput').value);
    await h.q.saveRecord();assert.equal(h.rows[0].quote_sent_at,sent);assert.equal(h.rows[0].quote_status,status);
  }
});

test('recording an actually sent quote creates a timestamp only at that action',async()=>{
  const h=harness();h.q.fillQuoteOptions(h.base);assert.equal(h.node('quoteSentAtInput').value,'');
  const row={dataset:{quoteCode:'MBW004',quoteName:'Jewels'},querySelector:s=>({value:s.includes('price')?'60':s.includes('basis')?'per_person':''})};
  h.node('quoteOptionsList').querySelectorAll=()=>[row];h.node('quoteSentChannelInput').value='email';
  const before=Date.now()-60000;await h.q.markQuotesSent();
  assert.equal(h.calls.length,1);assert.equal(h.rows[0].quote_status,'sent');assert.equal(h.rows[0].status,'quoted');
  assert.ok(Date.parse(h.rows[0].quote_sent_at)>=before);assert.ok(Date.parse(h.rows[0].quote_sent_at)<=Date.now());
});

test('communication log continues to default to current time while missing quote date stays blank',()=>{
  const h=harness();h.q.clearInteractionForm();
  assert.match(h.node('interactionOccurredAt').value,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  h.q.fillQuoteOptions({});assert.equal(h.node('quoteSentAtInput').value,'');
  assert.ok(h.q.localDateTimeValue());
});

test('ordinary saves allow direct deposit and payment stages without requiring quote or follow-up',async()=>{
  for(const status of ['deposit_pending','payment_pending','deposit_paid','booked']){
    const h=harness({status});h.q.fillQuoteOptions(h.base);h.node('followupInput').value='';
    assert.equal(await h.q.saveRecord(),true);assert.equal(h.rows[0].status,status);
    assert.equal(h.rows[0].quote_status,'not_sent');assert.equal(h.rows[0].quote_sent_at,'');
  }
});


test('new and returning inquiries cannot silently carry a sent date while marked Not Sent',async()=>{
  for(const mode of ['create','returning']){
    const h=harness({quote_sent_at:'2026-09-08T12:48:00.000Z'});
    h.q.fillQuoteOptions(h.base);h.node('modeInput').value=mode;
    assert.equal(await h.q.saveRecord(),false);
    assert.equal(h.calls.length,0);
    assert.ok(h.node('quoteSentAtInput').value,'the entered value remains available for review');
    assert.equal(h.node('quoteOptionsPanel').open,true);
  }
});
