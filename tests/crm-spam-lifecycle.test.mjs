import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const crm=fs.readFileSync(new URL('../admin/guest-crm/index.html',import.meta.url),'utf8');
const marketing=fs.readFileSync(new URL('../admin/marketing/index.html',import.meta.url),'utf8');
const mobile=fs.readFileSync(new URL('../functions/lib/mobile-domain.mjs',import.meta.url),'utf8');

test('CRM exposes an explicit spam lifecycle and quick action',()=>{
  assert.match(crm,/id="recordStatusInput"[^>]*>[\s\S]*?<option value="spam">Spam<\/option>/);
  assert.match(crm,/id="markSpamBtn"/);
  assert.match(crm,/id="detailMarkSpamBtn"/);
  assert.match(crm,/did_not_book","spam","duplicate/);
  assert.match(crm,/spam:records\.filter/);
});

test('spam is excluded from marketing and mobile operational work',()=>{
  assert.match(marketing,/status!=="spam"/);
  assert.match(mobile,/"did_not_book", "spam", "duplicate"/);
});

test('missing attribution is presented as a successful save',()=>{
  assert.match(crm,/Guest saved successfully\. Tracking reference kept for later repair\./);
  assert.doesNotMatch(crm,/attribution reference preserved but unavailable/);
});
