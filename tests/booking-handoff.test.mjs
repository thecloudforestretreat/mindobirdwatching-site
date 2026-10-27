import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=fs.readFileSync(new URL('../assets/js/booking-context.js',import.meta.url),'utf8');
function harness({search='?experience=quito-day-trip&source_page=/quito-to-mindo-day-trip/',contact=false,format='',transportChecked=false,absoluteLinks=false}={}) {
 const listeners={},windowListeners={},label={hidden:false},sourceField={value:'initial'};
 const event=()=>{listeners.change?.();};
 const fields=contact?[{tagName:'SELECT',value:'',options:['Night Walk','Quito to Mindo Day Trip','Half-Day Tour'].map(value=>({value})),dispatchEvent:event}]:['Night Walk','Quito to Mindo Day Trip','Half-Day Tour'].map(value=>({tagName:'INPUT',value,checked:false,dispatchEvent:event}));
 const formats=['Private Tour','Join a Small Group','Either Private or Small Group'].map(value=>({value,checked:value===format,dispatchEvent:event}));
 const transport={checked:transportChecked,disabled:false,defaultChecked:false,closest:()=>label,dispatchEvent:event};
 const addon={checked:false,disabled:false};
 const notes=['night-walk','quito-day-trip'].map(key=>({hidden:true,getAttribute:()=>key}));
 const paths=contact?['/contact/','/es/contacto/']:['/book-tour/','/es/reservar-tour/'];
 const links=['en','es'].map((lang,i)=>({attrs:{'data-lang':lang,href:absoluteLinks?'https://mindobirdwatching.com'+paths[i]:paths[i]},getAttribute(k){return this.attrs[k]||null;},setAttribute(k,v){this.attrs[k]=v;}}));
 const form={getAttribute:()=>contact?'/api/contact':'/api/book-tour',querySelectorAll(s){return s.includes('preferred')?fields:s==='[data-tour-format]'?formats:notes;},querySelector(s){return s.includes('source_page')?sourceField:s.includes('Transportation')?transport:s.includes('Night Walk')?addon:null;},addEventListener(t,f){listeners[t]=f;}};
 vm.runInNewContext(source,{URL,URLSearchParams,Event:class{},document:{querySelector:()=>form,querySelectorAll:()=>links},window:{location:{search,origin:'https://site.invalid'},setTimeout(f){f();},addEventListener(t,f){windowListeners[t]=f;}}});
 const select=value=>{if(contact)fields[0].value=value;else fields.forEach(f=>f.checked=f.value===value);listeners.change();};
 return {links,fields,formats,transport,label,sourceField,notes,select,windowListeners,reset(){fields.forEach(f=>{f.checked=false;f.value=contact?'':f.value;});formats.forEach(f=>f.checked=false);transport.checked=false;listeners.reset();}};
}
test('EN–ES–EN navigation maps source pair and keeps only supported nonpersonal context',()=>{
 let h=harness({absoluteLinks:true,search:'?experience=quito-day-trip&source_page=/quito-to-mindo-day-trip/&email=private@example.com&utm_content=do-not-copy'});
 let es=new URL(h.links[1].attrs.href,'https://site.invalid');assert.equal(es.pathname,'/es/reservar-tour/');assert.equal(es.searchParams.get('experience'),'quito-day-trip');assert.equal(es.searchParams.get('source_page'),'/es/viaje-de-un-dia-quito-mindo/');assert.equal(es.hash,'#request-form');assert.equal([...es.searchParams].length,2);
 h=harness({search:es.search});let en=new URL(h.links[0].attrs.href,'https://site.invalid');assert.equal(en.searchParams.get('source_page'),'/quito-to-mindo-day-trip/');assert(h.fields.find(f=>f.value==='Quito to Mindo Day Trip').checked);
});
test('included package transport is hidden, disabled, reversible and private default remains editable',()=>{
 const h=harness({transportChecked:true});assert(h.formats[0].checked);assert(h.label.hidden);assert(h.transport.disabled);assert(!h.transport.checked);
 h.formats.forEach(f=>f.checked=f.value==='Join a Small Group');h.select('Quito to Mindo Day Trip');assert(h.formats[1].checked);
 h.select('Half-Day Tour');assert(!h.label.hidden);assert(!h.transport.disabled);assert(h.transport.checked);assert.match(h.links[1].attrs.href,/experience=half-day/);
});
test('reset clears the package and does not resurrect an optional transport choice',()=>{
 const h=harness({transportChecked:true});h.reset();assert(!h.label.hidden);assert(!h.transport.disabled);assert(!h.transport.checked);assert(h.formats.every(f=>!f.checked));
});
test('shared header injection and changes to selected experience refresh language links',()=>{
 const h=harness();h.links[1].attrs.href='/es/reservar-tour/';h.windowListeners['mbw:includes:ready']();assert.match(h.links[1].attrs.href,/experience=quito-day-trip/);
 h.select('Night Walk');assert.match(h.links[1].attrs.href,/experience=night-walk/);assert(!h.transport.disabled);
});
test('contact choices and night-walk sources survive language navigation without adding booking-only behavior',()=>{
 const h=harness({contact:true,search:'?experience=night-walk&source_page=/activities/night-walk/'});assert.equal(h.fields[0].value,'Night Walk');let u=new URL(h.links[1].attrs.href,'https://site.invalid');assert.equal(u.pathname,'/es/contacto/');assert.equal(u.searchParams.get('source_page'),'/es/actividades/caminata-nocturna/');assert.equal(u.hash,'#contactForm');assert(h.formats.every(f=>!f.checked));
});
test('unsafe sources and unknown experiences never enter links; generic forms and itinerary mode retain their behavior',()=>{
 for(const input of ['//evil.invalid/','https://evil.invalid/','/book-tour/?secret=1']){const h=harness({search:'?experience=quito-day-trip&source_page='+encodeURIComponent(input)});assert.equal(h.sourceField.value,'initial');assert(!h.links[1].attrs.href.includes('source_page'));}
 for(const search of ['', '?experience=constructor','?experience=unknown','?experience=quito-day-trip&itinerary=1']){const h=harness({search});assert(h.fields.every(f=>!f.checked));assert(h.formats.every(f=>!f.checked));assert(!h.transport.disabled);assert.equal(h.links[1].attrs.href,'/es/reservar-tour/');}
});
