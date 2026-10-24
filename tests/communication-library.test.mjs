import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{},URL};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../admin/assets/js/communication-library.js',import.meta.url),'utf8'),context);const lib=context.window.MBW_COMMUNICATIONS;
const base={brand:{},groups:[{id:'tours'},{id:'activities'}],blocks:[]};
test('all three brands share exactly the same experience IDs, prices and images',()=>{
 const get=id=>lib.emailCatalog(base,id).blocks.map(x=>[x.id,x.price,x.image]);
 assert.equal(JSON.stringify(get('mbw')),JSON.stringify(get('mindo-tours')));
 assert.equal(JSON.stringify(get('mbw')),JSON.stringify(get('choco-andino')));
 assert.equal(lib.brand('unknown').id,'mbw');
});
test('every supplied photograph is mapped to a selectable experience and exists',()=>{
 const expected=['mbw-tour-hummingbirds-001.jpeg','mbw-tour-spectacled-bear-001.jpeg',...['canopy-001','canyoning-001','coffee-tour-002','flora-excursion-001','horseback-riding-001','macro-001','orchid-tour-001','paintball-001','quad-tour-001','tubing-001'].map(x=>'mbw-activities-'+x+'.jpeg')];
 for(const file of expected){const x=lib.catalog.experiences.find(x=>x.image?.endsWith(file));assert.ok(x,file);assert.ok(fs.existsSync(new URL('..'+new URL(x.image).pathname,import.meta.url)),file);}
});
test('Staff Info billing units and minimums survive both card languages',()=>{
 assert.equal(lib.byCode('ACT004').model,'per_quad');assert.equal(lib.byCode('ACT011').price,10);assert.equal(lib.byCode('ACT011').minGuests,4);
 assert.match(lib.block({},lib.byCode('ACT021'),'en').price,/110 per person per private session/);
 assert.match(lib.block({},lib.byCode('ACT021'),'es').price,/110 por persona por sesión privada/);
 assert.equal(lib.byCode('MBW019').soloPrice,75);assert.equal(lib.byCode('MBW016').price,35);assert.equal(lib.byCode('MBW014').price,30);
});
test('brand rendering changes identity while retaining real shared contact and omitting unverified socials',()=>{
 for(const id of Object.keys(lib.brands)){
  const b=lib.brand(id),html=lib.header(id,'es')+lib.signature(id,'es',[],'https://wa.me/593969076501')+lib.footer(id);
  assert.match(html,new RegExp(b.name));assert.ok(html.includes(b.site));assert.ok(html.includes(b.logo));assert.ok(html.includes('mindobirdwatching@gmail.com'));
  if(id!=='mbw'){assert.ok(!html.includes('Mindo Bird Watching'));assert.ok(!html.includes('instagram.com/mindobirdwatching'));}
 }
});
test('brand-only future cards are filtered, shared cards remain available',()=>{
 const future={...lib.byCode('ACT004'),brands:['mindo-tours']};assert.equal(lib.allows(future,'mbw'),false);assert.equal(lib.allows(future,'mindo-tours'),true);
 assert.equal(lib.block({group:'tours'},lib.byCode('MBW004'),'en','mbw').group,'tours');assert.equal(lib.block({group:'tours'},lib.byCode('MBW004'),'en','mindo-tours').group,'activities');
});
test('shared catalog updates default rates without changing already quoted itinerary lines',()=>{
 const key='ACT021 - Private Insect & Macro Wildlife Search',defaults={[key]:{unitPrice:999,note:'old'}},rules={ACT021:{model:'per_private_session',price:999}},labels={};const quoted={productPreset:key,quantity:3,unitPrice:105};
 lib.applyItineraryCatalog([key],defaults,rules,labels);assert.equal(rules.ACT021.model,'per_person');assert.equal(rules.ACT021.price,110);assert.equal(defaults[key].unitPrice,110);assert.equal(quoted.unitPrice,105);assert.match(labels[key],/Búsqueda privada/);
});
