import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("CRM keeps saved add-on dates and unknown service metadata", () => {
  const crm = fs.readFileSync(path.join(root, "admin/guest-crm/index.html"), "utf8");
  assert.doesNotMatch(crm, /inheritedWebsiteDate/);
  assert.doesNotMatch(crm, /const itemDate=inheritedWebsiteDate\?"":"/);
  assert.match(crm, /return Object\.assign\(\{\},item,\{id:/);
  assert.match(crm, /const original=\(state\.tourItems\|\|\[\]\)\.find/);
});

test("recurring website merges fill blanks without replacing canonical tour planning", () => {
  const router = fs.readFileSync(path.join(root, "deployment/multi-invoice-ledger/crm-router.gs"), "utf8");
  for (const field of ["requested_date_start", "requested_date_end", "requested_date_text", "tour_items", "tour_items_json", "tour_count", "tour_content", "product_selected", "service_type", "duration_preference", "requested_date"]) {
    assert.match(router, new RegExp(`${field}: keepBest_\\(existing\\.${field}, incoming\\.${field}\\)`), `${field} must preserve the current CRM value`);
  }
});

test("manual structured-data repair also preserves staff-curated planning", () => {
  const router = fs.readFileSync(path.join(root, "deployment/multi-invoice-ledger/crm-router.gs"), "utf8");
  const repairStart = router.indexOf("function repairStructuredSiteRequestDetails()");
  const repairEnd = router.indexOf("function mapWhatsappInquiryRow_", repairStart);
  const repair = router.slice(repairStart, repairEnd);
  for (const field of ["tour_items", "tour_items_json", "tour_count", "tour_content", "product_selected", "service_type", "duration_preference", "requested_date"]) {
    assert.match(repair, new RegExp(`${field}: keepBest_\\(match\\.row\\.${field},`), `${field} must keep the staff-curated CRM value`);
  }
  for (const field of ["pickup_location", "country", "home_country"]) {
    assert.match(repair, new RegExp(`${field}: keepBest_\\(match\\.row\\.${field},`), `${field} must keep the staff-curated CRM value`);
  }
});

test("CRM saves retain a multi-day end date unless staff changes the start date", () => {
  const crm = fs.readFileSync(path.join(root, "admin/guest-crm/index.html"), "utf8");
  assert.match(crm, /const requestedEnd=savedStart&&savedStart===date&&savedEnd\?savedEnd:date/);
  assert.match(crm, /requested_date_end:requestedEnd,requested_date_text:requestedText/);
});

test("contact intent remains one canonical reference during imports and D1 backfills", () => {
  const router = fs.readFileSync(path.join(root, "deployment/multi-invoice-ledger/crm-router.gs"), "utf8");
  assert.match(router, /contact_intent_id: canonicalContactIntentId_\(incoming\.contact_intent_id, existing\.contact_intent_id\)/);
  assert.match(router, /merged\[key\] = canonicalContactIntentId_\(value, merged\[key\]\)/);
  assert.match(router, /"INQ-20260909013136-0000": "ci_uj8mjpirfnh"/);
  assert.doesNotMatch(router, /"INQ-20260909013136-0000": "ci_tdr46r6pqb4 \| ci_uj8mjpirfnh"/);
});

test("new website add-ons record which values were inherited", () => {
  const handler = fs.readFileSync(path.join(root, "functions/api/book-tour/index.js"), "utf8");
  assert.match(handler, /inherit_date:true, inherit_guests:!transport, inherit_pickup:true/);
});


test("executed router preserves separate booked activities across repeated website imports", () => {
  const source=fs.readFileSync(path.join(root,"deployment/multi-invoice-ledger/crm-router.gs"),"utf8");
  const context={Utilities:{formatDate:date=>date.toISOString()}};vm.createContext(context);vm.runInContext(source+'\nCACHED_SHEET_TIMEZONE="America/Guayaquil";',context);
  const items=JSON.stringify([{id:"chocolate",tour:"Chocolate Tour",date:"2099-11-30",status:"booked"},{id:"orchids",tour:"Orchid Garden Tour",date:"2099-11-30",status:"booked"}]);
  let saved={inquiry_id:"QA-IMPORT",tour_items:items,tour_items_json:items,tour_count:"2",requested_date_start:"2099-11-29",guest_count:"3",pickup_location:"Confirmed hotel",payment_status:"paid",invoice_no:"QA-INVOICE"};
  const raw={tour_items:"[]",tour_items_json:"[]",tour_count:"1",requested_date_start:"2099-11-26",guest_count:"1",pickup_location:"TBD",payment_status:"unpaid"};
  for(let cycle=0;cycle<3;cycle++){
    saved=context.mergeInquiryRows_(saved,raw,"2099-01-01T00:00:00Z");
    assert.equal(saved.tour_items_json,items);assert.equal(saved.tour_items,items);assert.equal(saved.tour_count,"2");assert.equal(saved.requested_date_start,"2099-11-29");assert.equal(saved.guest_count,"3");assert.equal(saved.pickup_location,"Confirmed hotel");assert.equal(saved.payment_status,"paid");assert.equal(saved.invoice_no,"QA-INVOICE");
  }
  const firstImport=context.mergeInquiryRows_({inquiry_id:"QA-NEW"},raw,"2099-01-01T00:00:00Z");assert.equal(firstImport.tour_items_json,raw.tour_items_json);assert.equal(firstImport.requested_date_start,raw.requested_date_start);
});
