import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('paired tour comparisons use owner-confirmed Jewels schedule and preserve language/canonical declarations',()=>{
 for(const [p,time] of [['tours/index.html','6–9 AM'],['es/tours/index.html','6–9 a. m.']]){
 const s=read(p);assert.ok(s.includes(time));assert.equal((s.match(/class="journeyCompareCard"/g)||[]).length,3);assert.match(s,/rel="canonical"/);assert.match(s,/hreflang="es"/);
 }
 assert.match(read('tours/jewels-morning-forest-birding/index.html'),/6:00am to 9:00am/);
 assert.match(read('es/tours/joyas-del-bosque-matutino/index.html'),/>3 horas</);
});
test('paired activity hubs expose progressive category filtering and keep unavailable rafting status',()=>{
 for(const p of ['activities/index.html','es/actividades/index.html']){const s=read(p);assert.equal((s.match(/data-activity-filter=/g)||[]).length,5);assert.ok((s.match(/data-activity-categories=/g)||[]).length>=20);assert.match(s,/activity-filter.js/);assert.match(s,/rafting|rafting/);}
});
test('condensed tour collections retain practical guides, FAQs and all main tour formats',()=>{
 for(const p of ['tours/index.html','es/tours/index.html']){const s=read(p);assert.match(s,/journeyFormats/);assert.match(s,/FAQPage/);assert.match(s,/birdwatching-itineraries|itinerarios/);assert.match(s,/night-walk|caminata-nocturna/);assert.match(s,/target-bird|constructor-tour|birds-you-can|aves-que-puedes/);assert.equal((s.match(/class="journeyCompareCard"/g)||[]).length,3);}
});
