import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('CRM captures and hands off selling and billing brands', () => {
  const html = read('admin/guest-crm/index.html');
  assert.match(html, /id="marketingBrandInput"/);
  assert.match(html, /value="mindo-tours">Mindo Tours/);
  assert.match(html, /value="choco-andino">Chocó Andino Tours/);
  assert.match(html, /r\.marketing_brand_id=clean\(els\.marketingBrandInput\.value\)\|\|"mbw"/);
  assert.match(html, /r\.billing_brand_id="mbw"/);
  assert.match(html, /brandId:marketingBrand/);
});

test('itinerary save persists dedicated brand fields', () => {
  const html = read('admin/itinerary-generator/index.html');
  assert.match(html, /marketing_brand_id:itinerary\.brandId\|\|'mbw'/);
  assert.match(html, /billing_brand_id:itinerary\.billingBrandId\|\|'mbw'/);
});

test('Stripe checkout, deposits, invoices and confirmations preserve brand', () => {
  const worker = read('mbw-stripe-checkout-worker-v44.js');
  assert.match(worker, /marketing_brand_id: normalizeBrandId\(firstNonEmptyString\(md\.marketing_brand_id, md\.brand_id, md\.brandId\)\)/);
  assert.match(worker, /marketing_brand_id: fields\.marketing_brand_id/);
  assert.match(worker, /metadata\[marketing_brand_id\]/);
  assert.match(worker, /marketing_brand_id: lineMd\.marketing_brand_id \|\| invMd\.marketing_brand_id \|\| "mbw"/);
  assert.match(worker, /marketing_brand_id: md\.marketing_brand_id \|\| "mbw"/);
});
