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
  vm.runInContext(script.replace('    })();',`globalThis.qa={cache,state,els,fillQuoteOptions,formRecord,saveRecord,normalizeTourItem,serializeTourItems,calendarEntriesForRecord,normalizeCrmRecord,primaryTourItemFromRecord,additionalTourItemsForForm,normalizeTourItems,setApi(fn){api=fn},setResolve(fn){resolveReference=fn},install(){api=persist;resolveReference=async()=>null;render=()=>{};saveLocalRecords=()=>{};showToast=()=>{};upsert=record=>{state.records=[normalizeCrmRecord(record)]}}};})();`),context);
  const q=context.qa;q.cache();q.install();Object.assign(base,q.normalizeCrmRecord(base));q.state.records=[base];q.state.selectedId=base.inquiry_id;
  for(const [id,value] of Object.entries({modeInput:'update',guestIdInput:base.guest_id,firstNameInput:'QA',fullNameInput:'QA Guest',emailInput:'qa@example.invalid',countryInput:'US',sourceInput:'site_book_tour',tourInput:'Birdwatching',guestCountInput:'2',dateInput:'2099-11-26',recordStatusInput:base.status,quoteStatusInput:base.quote_status,paymentStatusInput:'unpaid',serviceTypeInput:'Birdwatching',priorityInput:'normal',followupInput:'2099-11-01'}))node(id).value=value;
  function load(){
    const current=q.state.records[0];
    const primary=q.primaryTourItemFromRecord(current);
    node('productSelectedInput').value=current.product_selected||primary.product_selected;
    node('durationInput').value=current.duration_preference||primary.duration;
    const extras=q.additionalTourItemsForForm(current);
    q.state.tourItems=extras;
    node('tourItemsList').querySelectorAll=()=>extras.map(item=>({dataset:{id:item.id},querySelector:selector=>{
      const key=selector.match(/data-tour-field="([^"]+)"/)?.[1];
      return {value:({product:item.product_selected,service:item.service_type,date:item.date,guests:item.guests,price:item.price,duration:item.duration,status:item.status,pickup:item.pickup_location,notes:item.notes,tour:item.tour})[key]||''};
    }}));
    return {primary,extras};
  }
  return {q,node,base,rows,calls,load};
}



const service={id:'night',tour:'Night Walk',product_selected:'MBW016',date:'2099-11-26',guests:'3',price:'35',custom_ref:'keep'};
const statuses=['new','contacted','planning','qualified','quoted','follow_up','deposit_pending','payment_pending','deposit_paid','booked','completed','cancelled','did_not_book','duplicate'];
for(const stage of statuses) test('missing service status inherits explicit inquiry stage '+stage,async()=>{
  const h=harness({status:stage,tour_type:'Birdwatching',product_selected:'MBW004',requested_date:'2099-11-26',tour_items_json:JSON.stringify([service])});
  const {extras}=h.load();assert.equal(extras[0].status,stage);assert.equal(h.q.calendarEntriesForRecord(h.base)[0].status,stage);
  assert.equal(await h.q.saveRecord(),true);
  const saved=JSON.parse(h.rows[0].tour_items_json).find(i=>i.id==='night');assert.equal(saved.status,stage);assert.equal(saved.custom_ref,'keep');assert.equal(saved.price,'35');
});
test('missing standalone status defaults to New, including whitespace',()=>{
 const h=harness();for(const value of [undefined,null,'','  '])assert.equal(h.q.normalizeTourItem({...service,status:value}).status,'new');
 const row=h.q.normalizeCrmRecord({tour_items_json:JSON.stringify([service])});assert.equal(JSON.parse(row.tour_items_json)[0].status,'new');
});
test('every explicit service status wins over a conflicting inquiry stage',()=>{
 const h=harness();for(const status of statuses){const items=h.q.normalizeTourItems({status:status==='booked'?'new':'booked',tour_items_json:JSON.stringify([{...service,status}])});assert.equal(items[0].status,status);assert.equal(JSON.parse(h.q.serializeTourItems(items))[0].status,status)}
 assert.equal(h.q.normalizeTourItem({...service,status:'Confirmed'}).status,'booked');
});
test('all stored formats inherit context without array indexes becoming statuses',()=>{
 const h=harness();for(const source of [[service,{...service,id:'second'}],JSON.stringify([service,{...service,id:'second'}])]){
 const items=h.q.normalizeTourItems({status:'quoted',tour_items:source});assert.deepEqual(Array.from(items,i=>i.status),['quoted','quoted']);
 }
 const legacy=h.q.normalizeTourItems({status:'planning',tour_items:'2099-11-26::Night Walk::3::MBW016'});assert.equal(legacy[0].status,'planning');
 const whitespace=h.q.normalizeTourItems({status:'quoted',tour_items:[{...service,status:'   '}]});assert.equal(whitespace[0].status,'quoted');
});
test('requested legacy add-ons remain New even under a booked inquiry',()=>{
 const h=harness({status:'booked',tour_type:'Birdwatching',tour_add_ons:'Night Walk | Transportation'});const {extras}=h.load();assert.deepEqual(Array.from(extras,i=>i.status),['new','new']);
});
test('missing inquiry stage also leaves inferred primary service New',()=>{
 const h=harness({status:''});assert.equal(h.q.primaryTourItemFromRecord({tour_type:'Birdwatching'}).status,'new');assert.equal(JSON.parse(h.q.formRecord().tour_items_json)[0].status,'new');
});

test('a missing historical contact intent no longer blocks an otherwise valid CRM save',async()=>{
 const h=harness({contact_intent_id:'ci_missing1234'});h.load();h.node('referenceIdInput').value='ci_missing1234';h.q.setResolve(async()=>{throw new Error('Live CRM save failed: contact_intent_not_found')});
 assert.equal(await h.q.saveRecord(),true);assert.equal(h.rows[0].contact_intent_id,'ci_missing1234');assert.match(h.node('referenceStatus').textContent,/preserved without relinking/i);
});

test('a missing contact intent is omitted from a new CRM record',async()=>{
 const h=harness();h.q.state.records=[];h.q.state.selectedId='';h.node('modeInput').value='create';h.node('referenceIdInput').value='ci_missing5678';h.q.setResolve(async()=>{throw new Error('contact_intent_not_found')});let saved;
 h.q.setApi(async(action,payload)=>{if(action==='list_inquiries')return {ok:true,records:[]};assert.equal(action,'create_guest_and_inquiry');saved=structuredClone(payload.record);return {ok:true,records:[payload.record]};});
 assert.equal(await h.q.saveRecord(),true);assert.equal(saved.contact_intent_id,undefined);assert.equal(h.node('referenceIdInput').value,'');assert.match(h.node('referenceStatus').textContent,/without website attribution/i);
});
