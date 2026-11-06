import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page=fs.readFileSync(new URL('../admin/custom-email-generator/index.html',import.meta.url),'utf8');
const libraryContext={window:{},URL};
vm.createContext(libraryContext);
vm.runInContext(fs.readFileSync(new URL('../admin/assets/js/communication-library.js',import.meta.url),'utf8'),libraryContext);
const communications=libraryContext.window.MBW_COMMUNICATIONS;

function functionSource(name){
  const start=page.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' exists');
  const remainder=page.slice(start+1);
  const end=remainder.search(/\n[ \t]+function /);
  return page.slice(start,end<0?undefined:start+1+end);
}

test('CRM custom products select the matching email cards',()=>{
  const context={communications};
  vm.createContext(context);
  vm.runInContext(functionSource('emailBlockForCrmItem'),context);
  assert.equal(context.emailBlockForCrmItem({product_selected:'TOUR001 - Custom Half-Day Tour'}),'tour-custom-half-day');
  assert.equal(context.emailBlockForCrmItem({product_selected:'TOUR002 - Custom Full-Day Tour'}),'tour-custom-full-day');
  assert.equal(context.emailBlockForCrmItem({product_selected:'MBW008 - Custom Full Day'}),'');
});

test('custom email cards stay brand-neutral and bilingual',()=>{
  for(const [code,id] of [['TOUR001','tour-custom-half-day'],['TOUR002','tour-custom-full-day']]){
    const experience=communications.byCode(code);
    assert.equal(experience.id,id);
    for(const brand of ['mbw','mindo-tours','choco-andino']){
      const en=communications.emailCatalog({brand:{},groups:[{id:'tours'}],blocks:[]},brand,'en').blocks.find(block=>block.id===id);
      const es=communications.emailCatalog({brand:{},groups:[{id:'tours'}],blocks:[]},brand,'es').blocks.find(block=>block.id===id);
      assert.ok(en&&es,brand+' '+code);
      assert.match(en.description,/flexible private/);
      assert.match(es.description,/experiencia privada y flexible/);
      assert.match(en.price,/approved custom quote/);
      assert.match(es.price,/cotización personalizada aprobada/);
    }
  }
});
