import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const read = p => fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const load = async p => import('data:text/javascript;base64,'+Buffer.from(read(p)).toString('base64'));
const booking = await import('../functions/api/book-tour/index.js');
const contact = await load('functions/api/contact/index.js');
async function submit(handler, fields, verify=true, json=false) {
  const original=globalThis.fetch;let forwarded=null,calls=0;
  globalThis.fetch=async(url,options)=>{calls++;if(String(url).includes('/siteverify'))return Response.json({success:verify});assert.equal(url,'https://upstream.invalid');forwarded=new URLSearchParams(options.body);return Response.json({ok:true});};
  try {const response=await handler({request:new Request('https://site.invalid/api/test',{method:'POST',headers:json?{accept:'application/json'}:{},body:new URLSearchParams({'cf-turnstile-response':'test-token',...fields})}),env:{GAS_WEB_APP_URL:'https://upstream.invalid',GAS_CONTACT_URL:'https://upstream.invalid',TURNSTILE_SECRET_KEY:'test-only',CF_SHARED_SECRET:'test-only'}});return {html:await response.text(),forwarded,calls};}finally{globalThis.fetch=original;}
}
test('English, Spanish and legacy format choices retain their meaning upstream',async()=>{
 for(const [label,expected] of [['Private Tour','private_only'],['Join a Small Group','open_to_group'],['Either Private or Small Group','open_to_group'],['Tour Privado','private_only'],['Unirse a un Grupo Pequeño','open_to_group'],['Privado o Grupo Pequeño','open_to_group']]){
  for(const legacy of [false,true]){let r=await submit(booking.onRequestPost,{preferred_tour_type:'Night Walk',...(legacy?{tour_add_ons:'Tour Format: '+label}:{tour_format_ui:label})});assert.equal(r.forwarded.get('grouping_preference'),expected,label);assert.match(r.html,/status:"ok"/);}
 }
 const unknown=await submit(booking.onRequestPost,{tour_format_ui:'unexpected'});assert.equal(unknown.forwarded.get('grouping_preference'),'unknown');
});
test('pickup survives canonicalization and day-trip transport is included',async()=>{
 let r=await submit(booking.onRequestPost,{preferred_tour_type:'Quito to Mindo Day Trip',pickup_location:'Test hotel',tour_add_ons:'Night Walk',dates_of_visit:'2026-12-01 to 2026-12-02',number_of_guests:'2'});
 assert.equal(r.forwarded.get('transportation_needed'),'Yes');assert.equal(r.forwarded.get('interest_category'),'Tour + Activity');
 let items=JSON.parse(r.forwarded.get('tour_items'));assert.equal(items.length,2);for(let x of items){assert.equal(x.pickup_location,'Test hotel');assert.equal(x.date,'2026-12-01');assert.equal(x.guests,'2');}
 for(const value of ['Night Walk','Caminata nocturna']){r=await submit(contact.onRequestPost,{preferred_tour_type:value,pickup_location:'Test meeting point'});let item=JSON.parse(r.forwarded.get('tour_items'))[0];assert.equal(item.pickup_location,'Test meeting point');assert.equal(item.product_selected,'MBW016');}
});
test('security failures never forward a guest request',async()=>{
 let r=await submit(booking.onRequestPost,{},false);assert.equal(r.calls,1);assert.equal(r.forwarded,null);assert.match(r.html,/status:"error"/);
 r=await submit(contact.onRequestPost,{'cf-turnstile-response':''});assert.equal(r.calls,0);assert.equal(r.forwarded,null);
});
test('transport quantities use vehicles while birding and night walks retain party size',async()=>{
 for(const language of ['en','es']){
  const r=await submit(booking.onRequestPost,{language,preferred_tour_type:'Half-Day Birdwatching',tour_add_ons:'Night Walk | Transportation',number_of_guests:'3 to 4'});
  const items=JSON.parse(r.forwarded.get('tour_items'));
  assert.equal(items[0].guests,'3 to 4');
  assert.equal(items[1].guests,'3 to 4');
  assert.equal(items[1].inherit_guests,true);
  assert.equal(items[2].service_type,'Transportation');
  assert.equal(items[2].guests,'1');
  assert.equal(items[2].inherit_guests,false);
  assert.match(items[2].notes,/vehicle count to be confirmed/);
  assert.equal(items[2].price,'');
 }
});
function stateHarness(path, fetchResult){
 let s=read(path),isBook=path.includes('reservar-tour')||path.startsWith('book-tour');let start=s.indexOf('var pending = false;');let end=s.indexOf('\n    })();',start);if(end<0)end=s.indexOf('\n})();',start);let code=s.slice(start,end);
 let events={},timers=[],winEvents={},reset=0,tracked=[];
 let node=()=>({style:{},hidden:true,textContent:'',setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},scrollIntoView(){}});
 let successEl=node(),errorEl=node(),submitBtn=node(),notice=node(),iframe={contentWindow:{},addEventListener(){}};
 let form={addEventListener(t,f){events[t]=f;},reset(){reset++;}};
 let context={form,successEl,errorEl,submitBtn,iframe,ds:null,de:null,ua:null,sp:null,document:{getElementById:()=>notice},updateTourAddOns(){},applyDateMinimums(){},applyDateLimits(){},validateDates(){return true;},combineDates(){},trackGA(...args){tracked.push(args);},navigator:{userAgent:'test'},setTimeout(f,ms){timers.push({f,ms});return timers.length;},clearTimeout(){},window:{location:{origin:'https://test.invalid',pathname:'/',href:'https://test.invalid/'},turnstile:{reset(){reset++;}},setTimeout(f){f();},addEventListener(t,f){winEvents[t]=f;}}};
 if(fetchResult){context.FormData=class{};context.URLSearchParams=URLSearchParams;context.window.fetch=async()=>({ok:true,json:async()=>fetchResult});}
 vm.runInNewContext(code,context);
 return {events,notice,submitBtn,successEl,errorEl,tracked,reset:()=>reset,slow(){timers.find(x=>x.ms===12000).f();},reply(status,valid=true){winEvents.message({origin:valid?'https://test.invalid':'https://other.invalid',source:iframe.contentWindow,data:{type:isBook?'mbw-booktour':'mbw-contact',status,message:'Test rejection'}});}};
}
for(const path of ['book-tour/index.html','es/reservar-tour/index.html','contact/index.html','es/contacto/index.html']){
 test(path+': slow response can resolve, unrelated messages cannot, retry token refreshes',()=>{
  let h=stateHarness(path);h.events.submit({preventDefault(){throw Error('unexpected invalid');}});assert.equal(h.submitBtn.disabled,'disabled');h.slow();assert.equal(h.notice.hidden,false);assert.equal(h.errorEl.style.display,'none');h.reply('ok',false);assert.notEqual(h.successEl.style.display,'block');h.reply('ok');assert.equal(h.successEl.style.display,'block');assert.equal(h.notice.hidden,true);assert.equal(h.submitBtn.disabled,undefined);let resets=h.reset();h.reply('ok');assert.equal(h.reset(),resets);
  h=stateHarness(path);h.events.submit({preventDefault(){}});h.reply('error');assert.equal(h.errorEl.textContent.includes('Test rejection'),true);assert.equal(h.reset(),1);assert.equal(h.submitBtn.disabled,undefined);
 });
}
function contextHarness({lang='en',experience='night-walk',source='/activities/night-walk/',contact=false,itinerary=false}={}){
 let labels=lang==='es'?['Caminata nocturna','Viaje de un día de Quito a Mindo']:['Night Walk','Quito to Mindo Day Trip'];let fields=contact?[{tagName:'SELECT',value:'',options:labels.map(value=>({value})),dispatchEvent(){}}]:['Night Walk','Quito to Mindo Day Trip'].map(value=>({tagName:'INPUT',value,checked:false,dispatchEvent(){}}));let sourceField={value:'original'},notes=['night-walk','quito-day-trip'].map(key=>({hidden:true,getAttribute(){return key;}}));let listeners={};let addon={checked:false,disabled:false};let form={querySelectorAll(s){return s.includes('preferred')?fields:s==='[data-tour-format]'?[]:notes;},querySelector(s){return s.includes('source_page')?sourceField:s.includes('Transportation')?null:s.includes('Night Walk')?addon:null;},addEventListener(t,f){listeners[t]=f;}};
 let params=new URLSearchParams({experience,source_page:source,...(itinerary?{itinerary:'1'}:{})});vm.runInNewContext(read('assets/js/booking-context.js'),{document:{querySelector:()=>form,querySelectorAll:()=>[]},window:{location:{search:'?'+params,origin:'https://test.invalid'},setTimeout(f){f();},addEventListener(){}},URLSearchParams,Event:class{}});return {fields,notes,sourceField,listeners,addon};
}
test('allowlisted context preselects editable EN/ES booking/contact choices and rejects unsafe sources',()=>{
 for(const lang of ['en','es'])for(const contact of [true,false])for(const experience of ['night-walk','quito-day-trip']){let h=contextHarness({lang,contact,experience});assert.equal(h.notes[experience==='night-walk'?0:1].hidden,false);assert.equal(h.sourceField.value,'https://test.invalid/activities/night-walk/');if(contact)h.fields[0].value='';else h.fields.forEach(f=>f.checked=false);h.listeners.change();assert.equal(h.notes.every(n=>n.hidden),true);h.addon.checked=true;h.listeners.change();assert.equal(h.notes[0].hidden,false);}
 for(const source of ['//evil.invalid/','https://evil.invalid/','/book-tour/?private=1'])assert.equal(contextHarness({source}).sourceField.value,'original');
 for(const experience of ['unsupported','constructor','toString','__proto__']) assert.equal(contextHarness({experience}).notes.every(n=>n.hidden),true);assert.equal(contextHarness({itinerary:true}).fields.every(f=>!f.checked),true);
});

test('fetch acknowledgements report definitive delivery and security rejection as JSON',async()=>{
 for(const handler of [booking.onRequestPost,contact.onRequestPost]){
  let r=await submit(handler,{preferred_tour_type:'Quito to Mindo Day Trip'},true,true);assert.equal(JSON.parse(r.html).status,'ok');assert.equal(r.forwarded.get('transportation_needed'),'Yes');
  r=await submit(handler,{},false,true);assert.equal(JSON.parse(r.html).status,'error');assert.equal(r.forwarded,null);
 }
});

for(const path of ['book-tour/index.html','es/reservar-tour/index.html','contact/index.html','es/contacto/index.html'])test(path+': direct acknowledgement completes once without an iframe message',async()=>{
 let h=stateHarness(path,{status:'ok'}),prevented=0;h.events.submit({preventDefault(){prevented++;}});await new Promise(resolve=>setImmediate(resolve));assert.equal(prevented,1);assert.equal(h.successEl.style.display,'block');assert.equal(h.submitBtn.disabled,undefined);assert.equal(h.notice.hidden,true);
 h=stateHarness(path,{status:'error',message:'Test rejection'});h.events.submit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.errorEl.textContent.includes('Test rejection'),true);assert.equal(h.submitBtn.disabled,undefined);
});
test('activity inquiries preserve canonical activity interest, selected name and guest data',async()=>{
 for(const activity of ['Chocolate Tour','Mountain Biking','Sky Bike / Sky Ride']){
 const r=await submit(booking.onRequestPost,{preferred_tour_type:'Activity',activity_choice:activity,number_of_guests:'3',pickup_location:'Test lodging'});
 assert.match(r.html,/status:"ok"/);assert.equal(r.forwarded.get('tour_type'),'Activity');assert.equal(r.forwarded.get('preferred_tour_type'),activity);
 const item=JSON.parse(r.forwarded.get('tour_items'))[0];assert.equal(item.tour,activity);assert.equal(item.service_type,'Activity');assert.equal(item.guests,'3');assert.equal(item.pickup_location,'Test lodging');assert.equal(item.price,'');
 }
 const invalid=await submit(booking.onRequestPost,{preferred_tour_type:'Activity',activity_choice:'<script>unsafe</script>'});assert.equal(invalid.forwarded,null);assert.match(invalid.html,/supported activity/);
});
test('activity plus another birding day is classified as a mixed inquiry without inventing a price',async()=>{
 const r=await submit(booking.onRequestPost,{preferred_tour_type:'Activity',activity_choice:'Chocolate Tour',tour_add_ons:'Additional Birding Day',number_of_guests:'2'});
 assert.equal(r.forwarded.get('interest_category'),'Tour + Activity');const items=JSON.parse(r.forwarded.get('tour_items'));assert.equal(items[0].tour,'Chocolate Tour');assert.equal(items[1].service_type,'Birdwatching');assert.ok(items.every(x=>x.price===''));
});
