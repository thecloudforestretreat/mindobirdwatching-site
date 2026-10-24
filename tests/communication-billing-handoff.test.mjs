import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../admin/itinerary-generator/index.html',import.meta.url),'utf8');
const start=source.indexOf('      function createZelleInvoice('),end=source.indexOf('\n      function ',start+1),fn=source.slice(start,end);
for(const brandId of ['mbw','mindo-tours','choco-andino'])test('Zelle handoff retains '+brandId+' attribution with MBW billing and exact quoted amounts',()=>{
 const store=new Map(),opened=[],elements={offerZelle:{checked:true},zelleEmailField:{hidden:false}};
 const data={brandId,billingBrandId:'mbw',guestName:'Fictional QA',guestEmail:'qa@example.invalid',guestCount:3,tripTitle:'QA',whatsappNumber:'',startDate:'2099-12-01',endDate:'2099-12-01',zelleEmail:'mindobirdwatching@gmail.com',adjustmentReason:'Agreed discount',items:[{productPreset:'MBW004 - Jewels of the Morning Forest',quantity:3,unitPrice:55,note:'',date:'2099-12-01'},{productPreset:'TRANS06 - Quito -> Mindo -> Quito',quantity:1,unitPrice:180,note:''}],discount:-5};
 const c={$:id=>elements[id],getFormData:()=>data,totals:d=>({total:d.items.reduce((n,x)=>n+x.quantity*x.unitPrice,0)+d.discount,adjustment:d.discount}),state:{inquiryId:'QA-INQUIRY',itineraryVersion:2,crmRecord:{guest_id:'QA-GUEST'}},productDisplayName:x=>x.productPreset,serviceTypeLabel:x=>x,isVehicleItem:x=>x.productPreset.startsWith('TRANS'),localStorage:{setItem:(k,v)=>store.set(k,v)},ZELLE_HANDOFF_KEY:'draft',ZELLE_INVOICE_URL:'https://admin.mindobirdwatching.com/zelle-invoice-generator/',window:{open:u=>opened.push(u)},URL,Date,toast(){}};
 vm.createContext(c);vm.runInContext(fn,c);c.createZelleInvoice();const draft=JSON.parse(store.get('draft'));
 assert.equal(draft.marketing_brand_id,brandId);assert.equal(draft.billing_brand_id,'mbw');assert.equal(draft.quoted_amount,340);assert.equal(draft.zelle_payment_email,'mindobirdwatching@gmail.com');assert.deepEqual(JSON.parse(draft.tour_items_json).map(x=>[x.quantity,x.price]),[[3,55],[1,180]]);assert.equal(new URL(opened[0]).pathname,'/zelle-invoice-generator/');assert.equal(new URL(opened[0]).searchParams.get('inquiry_id'),'QA-INQUIRY');
});

test('custom and extended half-day durations never silently display as the first duration choice',()=>{
 const a=source.indexOf('      function normalizeDurationChoice('),b=source.indexOf('\n      function ',a+1),c={};vm.createContext(c);vm.runInContext(source.slice(a,b),c);
 assert.equal(c.normalizeDurationChoice('Custom'),'Custom');assert.equal(c.normalizeDurationChoice('Extended Half Day'),'Extended Half Day');assert.equal(c.normalizeDurationChoice('2 horas'),'2 Hours');
 for(const duration of ['Custom','Extended Half Day'])assert.ok(source.includes("'"+duration+"'"));
});
