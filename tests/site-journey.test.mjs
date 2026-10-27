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
