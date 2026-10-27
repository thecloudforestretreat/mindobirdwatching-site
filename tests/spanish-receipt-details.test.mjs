import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
const baseline = {"book": {"buildConfirmationEmailHtmlEn_": "45e471384f7ecc2b01d48e93b84f2e8f6db80ec413415027074c7211ab1aaeff", "buildInternalEmailHtml_": "23de4e2ac52629b37dacd80d63711cac5e7ad70564115db53364b2356b05ee3d", "doPost": "afe993a094dcc4e6126a4f9392a9b3f4db6a2c20e572417bf2a17b08cc15e0e5", "appendDataRow_": "282d0d21322f0b92ec3b9912d82037d8a3f2a7a0937f8ab9670ca7d697ef2aa9"}, "contact": {"buildConfirmationEmailHtmlEn_": "18d9e99f25a1a5405b0746fae0ead48adbe9f67a413c90d1c3c44fa06483c966", "buildInternalEmailHtml_": "4c4d86718ea61a1c24c4c936e40ecee55c5faa8ecbb9da4477b6ae65ef074a9a", "doPost": "c089350b5e671be8ae623434c58747f5b0e44f555d043bd7aa6394906c209a1e", "appendDataRow_": "282d0d21322f0b92ec3b9912d82037d8a3f2a7a0937f8ab9670ca7d697ef2aa9"}};
function extract(source, name) { const start=source.indexOf(`function ${name}(`); return source.slice(start,source.indexOf('\n}',start)+2); }
for (const kind of ['book','contact']) {
 const source=readFileSync(new URL(`../deployment/form-receipts/${kind==='book'?'book-tour':'contact'}.gs`,import.meta.url),'utf8');
 test(`${kind}: complete handler parses and critical paths remain unchanged`,()=>{
  new vm.Script(source);
  for(const [name,hash] of Object.entries(baseline[kind])) assert.equal(createHash('sha256').update(extract(source,name)).digest('hex'),hash,name);
 });
 const scope={buildBrandSignatureHtml_:()=>'',buildSignatureHtmlEs_:()=>'',buildSignatureHtml_:()=>''};vm.createContext(scope);
 vm.runInContext(['sanitize_','escapeHtml_','htmlWithBreaks_','spanishSelectionLabel_','spanishAddOnsLabel_','buildConfirmationEmailHtmlEn_','buildConfirmationEmailHtmlEs_'].map(n=>extract(source,n)).join('\n'),scope);
 test(`${kind}: Spanish display, canonical data, escaping and free text`,()=>{
  const data={first_name:'QA',email:'qa@example.com',preferred_tour_type:'Quito to Mindo Day Trip',tour_add_ons:'Tour Format: Either Private or Small Group | Night Walk | Other: cascadas <script>',message_questions:'QA <test>'};
  const before=JSON.stringify(data), html=scope.buildConfirmationEmailHtmlEs_(data);
  assert.match(html,/Viaje de un día de Quito a Mindo/);assert.match(html,/&lt;test&gt;/);assert.doesNotMatch(html,/Quito to Mindo Day Trip/);
  assert.match(scope.buildConfirmationEmailHtmlEn_(data),/Quito to Mindo Day Trip/);
  assert.equal(JSON.stringify(data),before);assert.equal(scope.spanishSelectionLabel_('Guest free text'),'Guest free text');
  if(kind==='book') {assert.match(html,/Formato del tour: Tour privado o grupo pequeño/);assert.match(html,/Caminata nocturna/);assert.match(html,/Otra actividad: cascadas &lt;script&gt;/);}
  for(const value of ['Private Tour','Join a Small Group','Either Private or Small Group','Half-Day Tour','Full-Day Tour','Night Walk','Photography-Focused Tour','Custom / Private Tour','Not Sure Yet','Multi-Day','Activities','Combination','Additional Birding Day','Transportation','Accommodation Assistance','Other Activity or Tour']) assert.notEqual(scope.spanishSelectionLabel_(value),value);
 });
}

const activities=JSON.parse(readFileSync(new URL('../assets/data/experiences.json',import.meta.url),'utf8'));
for(const kind of ['book-tour','contact']) {
 test(`${kind}: all public activity labels localize without changing saved data`,()=>{
  const source=readFileSync(new URL(`../deployment/form-receipts/${kind}.gs`,import.meta.url),'utf8');
  const scope={buildBrandSignatureHtml_:()=>'',buildSignatureHtmlEs_:()=>'',buildSignatureHtml_:()=>''}; vm.createContext(scope);
  vm.runInContext(['sanitize_','escapeHtml_','htmlWithBreaks_','spanishSelectionLabel_','spanishAddOnsLabel_','buildConfirmationEmailHtmlEn_','buildConfirmationEmailHtmlEs_'].map(n=>extract(source,n)).join('\n'),scope);
  for(const activity of activities){
   const data={first_name:'QA',email:'qa@example.com',preferred_tour_type:activity.en};
   const original=JSON.stringify(data);
   assert.equal(scope.spanishSelectionLabel_(activity.en),activity.es);
   assert.ok(scope.buildConfirmationEmailHtmlEs_(data).includes(scope.escapeHtml_(activity.es)));
   assert.equal(JSON.stringify(data),original);
  }
 });
}
