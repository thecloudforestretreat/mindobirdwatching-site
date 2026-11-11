import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../admin/guest-crm/index.html',import.meta.url),'utf8');
const context={clean:value=>String(value||'').trim()};
vm.createContext(context);
for(const name of ['referenceIds','primaryReferenceId','recordReferenceIds']){
  const line=html.split('\n').find(value=>value.includes('function '+name+'('));
  vm.runInContext(line,context);
}
const mergeStart=html.indexOf('function mergeReferenceValues(');
const mergeEnd=html.indexOf('function mergeTextValues(',mergeStart);
vm.runInContext(html.slice(mergeStart,mergeEnd),context);

test('legacy pipe-separated references normalize to one latest primary reference',()=>{
  assert.equal(context.primaryReferenceId('ci_first123 | ci_second456'),'ci_second456');
});

test('consolidation keeps the newest reference primary and all references in history',()=>{
  const result=context.mergeReferenceValues([
    {created_at:'2026-11-08T10:00:00Z',contact_intent_id:'ci_first123'},
    {created_at:'2026-11-11T10:00:00Z',contact_intent_id:'ci_second456'}
  ]);
  assert.equal(result.primary,'ci_second456');
  assert.deepEqual(Array.from(result.all),['ci_first123','ci_second456']);
});

test('audit marker references remain discoverable after canonicalization',()=>{
  const ids=context.recordReferenceIds({
    contact_intent_id:'ci_second456',
    internal_notes:'[MBW_REFERENCE_HISTORY] ci_first123 | ci_second456'
  });
  assert.deepEqual(Array.from(ids),['ci_second456','ci_first123']);
});

test('CRM never exempts pipe-separated input from normal single-reference validation',()=>{
  assert.doesNotMatch(html,/function preservedReferenceList/);
  assert.match(html,/const id=referenceId\(raw\)/);
});
