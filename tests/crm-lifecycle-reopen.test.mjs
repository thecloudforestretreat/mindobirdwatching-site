import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../admin/guest-crm/index.html',import.meta.url),'utf8');

function source(name){
  const match=html.match(new RegExp('      (?:async )?function '+name+'\\('));
  assert.ok(match,name);
  const start=match.index;
  const next=html.slice(start+match[0].length).search(/\n      (?:async )?function /);
  return html.slice(start,next<0?undefined:start+match[0].length+next);
}

const clean=value=>String(value??'').trim();
const normalizeStatus=value=>clean(value).toLowerCase().replace(/[-\\s]+/g,'_')||'new';
const isClosedStatus=value=>['completed','cancelled','did_not_book','spam','duplicate'].includes(normalizeStatus(value));
const context={normalizeStatus,isClosedStatus};
vm.createContext(context);
vm.runInContext(source('shouldReopenLifecycle'),context);

test('Did Not Book and Cancelled can be deliberately reopened to Quoted',()=>{
  assert.equal(context.shouldReopenLifecycle({status:'did_not_book'},'quoted'),true);
  assert.equal(context.shouldReopenLifecycle({status:'cancelled'},'quoted'),true);
  assert.equal(context.shouldReopenLifecycle({status:'canceled'},'planning'),true);
});

test('terminal-to-terminal and active updates do not request an override',()=>{
  assert.equal(context.shouldReopenLifecycle({status:'did_not_book'},'cancelled'),false);
  assert.equal(context.shouldReopenLifecycle({status:'quoted'},'planning'),false);
});

test('Spam, Duplicate, and Completed retain their protected workflows',()=>{
  for(const status of ['spam','duplicate','completed']){
    assert.equal(context.shouldReopenLifecycle({status},'quoted'),false,status);
  }
});

test('save payload sends the backend override and verified records discard it',()=>{
  assert.match(html,/mode==="update"&&shouldReopenLifecycle\(selected,record\.status\)\) record\.lifecycle_override="Yes"/);
  assert.match(html,/delete verified\.lifecycle_override/);
});
