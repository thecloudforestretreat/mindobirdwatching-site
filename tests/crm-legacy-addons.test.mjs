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
  vm.runInContext(script.replace('    })();',`globalThis.qa={cache,state,els,fillQuoteOptions,formRecord,saveRecord,normalizeCrmRecord,primaryTourItemFromRecord,additionalTourItemsForForm,normalizeTourItems,install(){api=persist;resolveReference=async()=>null;render=()=>{};saveLocalRecords=()=>{};showToast=()=>{};upsert=record=>{state.records=[normalizeCrmRecord(record)]}}};})();`),context);
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


for(const field of ['tour_add_ons','optional_additions','add_ons']){
  test(field+' keeps legacy night walk, transport and accommodation through repeated actual backend saves',async()=>{
    const h=harness({tour_type:'Birdwatching',requested_date:'2099-11-26',guest_count:'2',[field]:'Tour Format: Either Private or Small Group | Night Walk | Transportation | Accommodation Assistance',contact_intent_id:'ci_qa_preserve',utm_source:'qa_internal'});
    for(let cycle=0;cycle<3;cycle++){
      const {primary,extras}=h.load();
      assert.equal(primary.tour,'Birdwatching');assert.notEqual(primary.product_selected,'MBW016');
      assert.deepEqual(Array.from(extras,i=>i.tour),['Night Walk','Transportation Requested','Accommodation Assistance']);
      assert.deepEqual(Array.from(extras,i=>i.id),['addon-2','addon-3','addon-4']);
      assert.equal(await h.q.saveRecord(),true);
      const saved=JSON.parse(h.rows[0].tour_items_json);
      assert.equal(saved.length,4);assert.equal(saved.filter(i=>i.product_selected==='MBW016').length,1);
      assert.equal(h.rows[0].contact_intent_id,'ci_qa_preserve');assert.equal(h.rows[0].utm_source,'qa_internal');
    }
  });
}
test('structured add-on-only rows remain additional rather than becoming primary',()=>{
  const h=harness({tour_type:'Birdwatching',requested_date:'2099-11-26',tour_items_json:JSON.stringify([{id:'addon-1',tour:'Night Walk',product_selected:'MBW016',status:'new'}])});
  const {primary,extras}=h.load();assert.equal(primary.tour,'Birdwatching');assert.equal(extras.length,1);assert.equal(extras[0].id,'addon-1');
});
test('an explicit primary is selected even when additional rows precede it',async()=>{
  const items=[{id:'night',tour:'Night Walk',product_selected:'MBW016',date:'2099-11-26',price:'35',status:'quoted',custom_ref:'keep-night'},{id:'primary',tour:'Jewels',product_selected:'MBW004',date:'2099-11-26',price:'60',status:'quoted'},{id:'next-day',tour:'Night Walk',product_selected:'MBW016',date:'2099-11-27',price:'35',status:'booked',custom_ref:'keep-next'}];
  const h=harness({tour_type:'Birdwatching',requested_date:'2099-11-26',tour_items_json:JSON.stringify(items)});
  const {primary,extras}=h.load();assert.equal(primary.product_selected,'MBW004');assert.deepEqual(Array.from(extras,i=>i.id),['night','next-day']);
  assert.equal(await h.q.saveRecord(),true);const saved=JSON.parse(h.rows[0].tour_items_json);
  assert.equal(saved.length,3);assert.equal(saved.find(i=>i.id==='next-day').date,'2099-11-27');assert.equal(saved.find(i=>i.id==='next-day').custom_ref,'keep-next');assert.equal(saved.find(i=>i.id==='next-day').status,'booked');assert.equal(saved[0].price,'60');
});
test('explicit legacy primary product remains authoritative and is not duplicated as an add-on',()=>{
  const h=harness({tour_type:'Activity',product_selected:'MBW016',tour_add_ons:'Night Walk'});const {primary,extras}=h.load();assert.equal(primary.product_selected,'MBW016');assert.equal(extras.length,0);
});
test('opening an archived legacy request preserves archive and activity state',()=>{
  const h=harness({tour_type:'Birdwatching',tour_add_ons:'Night Walk',is_archived:'Yes',status:'did_not_book',archived_at:'2026-10-21T10:00:00Z'});const before=JSON.stringify(h.base);const {extras}=h.load();assert.equal(extras.length,1);assert.equal(extras[0].status,'new');assert.equal(JSON.stringify(h.base),before);
});
for(const status of ['deposit_pending','payment_pending','deposit_paid','booked']) test('legacy extras do not prevent direct '+status+' saves',async()=>{
  const h=harness({tour_type:'Birdwatching',tour_add_ons:'Night Walk',status});h.load();h.node('followupInput').value='';assert.equal(await h.q.saveRecord(),true);assert.equal(h.rows[0].status,status);assert.equal(JSON.parse(h.rows[0].tour_items_json).length,2);
});
