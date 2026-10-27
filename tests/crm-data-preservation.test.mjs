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

function importArchiveContext() {
  const source=fs.readFileSync(process.env.MBW_ROUTER_QA_SOURCE || path.join(root,"deployment/multi-invoice-ledger/crm-router.gs"),"utf8");
  const context={Utilities:{formatDate:date=>date.toISOString()}};
  vm.createContext(context);vm.runInContext(source+'\nCACHED_SHEET_TIMEZONE="America/Guayaquil";',context);
  return context;
}

test("repeat raw imports preserve archive decisions and never restore follow-up work",()=>{
  const context=importArchiveContext();
  for(const archive of [{status:"duplicate"},{status:"new",is_archived:"Yes"},{status:"new",is_archived:"true"}]){
    let saved={inquiry_id:"QA-ARCHIVED",...archive,archived_at:"2098-01-01",archive_reason:"qa_cleanup",superseded_by_inquiry_id:"QA-KEEP",source_record_id:"book_tour:128",followup_date:"",next_action:"",priority:"",invoice_no:"QA-PAID",payment_status:"paid"};
    const incoming={status:"new",is_archived:"No",source_record_id:"book_tour:129",followup_date:"2099-01-01",next_action:"Review inquiry and reply",priority:"urgent",availability_status:"pending",payment_status:"unpaid",internal_notes:"Imported from raw book_tour row 129."};
    for(let cycle=0;cycle<3;cycle++){
      saved=context.mergeImportedInquiry_(saved,incoming,"2099-01-01T00:00:00Z");
      assert.equal(saved.status,"duplicate");assert.equal(saved.is_archived,"Yes");
      for(const field of ["followup_date","next_action","priority"])assert.equal(saved[field],"");
      assert.equal(saved.archived_at,"2098-01-01");assert.equal(saved.archive_reason,"qa_cleanup");assert.equal(saved.superseded_by_inquiry_id,"QA-KEEP");
      assert.equal(saved.invoice_no,"QA-PAID");assert.equal(saved.payment_status,"paid");assert.match(saved.source_record_id,/129/);assert.match(saved.internal_notes,/row 129/);
    }
  }
});

test("archived trip matching allows exact/same-date repeats but keeps new dates and undated inquiries separate",()=>{
  const context=importArchiveContext();
  const archived={guest_id:"QA-GUEST",email:"qa@example.com",status:"duplicate",source_tab:"book_tour",source_record_id:"book_tour:128",requested_date_start:"2099-12-17"};
  context.getObjectsWithRowNumbers_=()=>[{rowNumber:2,row:archived}];
  const guest={guest_id:"QA-GUEST"},input={emailNormalized:"qa@example.com",sourceTab:"book_tour",sourceType:"site_book_tour",sourceRecordId:"book_tour:129"};
  assert.ok(context.findExistingInquiryForInput_({},guest,input,{requested_date_start:"2099-12-17"}));
  assert.equal(context.findExistingInquiryForInput_({},guest,input,{requested_date_start:"2100-01-05"}),null);
  assert.equal(context.findExistingInquiryForInput_({},guest,input,{}),null);
  assert.equal(context.findExistingInquiryForInput_({},guest,{...input,sourceType:"manual_pending_guest"},{requested_date_start:"2100-01-05"}),null);
  assert.ok(context.findExistingInquiryForInput_({},guest,{...input,sourceRecordId:"book_tour:128"},{requested_date_start:"2100-01-05"}));
  archived.status="contacted";
  assert.ok(context.findExistingInquiryForInput_({},guest,input,{}));
});

test("active imports and explicit staff restore retain their existing behavior",()=>{
  const context=importArchiveContext();
  const existing={status:"quoted",is_archived:"No",followup_date:"2099-12-01",next_action:"Staff plan",priority:"high"};
  const incoming={status:"new",priority:"normal",source_record_id:"book_tour:129"};
  const saved=context.mergeImportedInquiry_(existing,incoming,"2099-01-01");
  assert.equal(saved.status,"quoted");assert.equal(saved.followup_date,existing.followup_date);assert.equal(saved.next_action,"Staff plan");
  const restored=context.mergeImportedInquiry_({...existing,status:"planning",archived_at:"",archive_reason:""},incoming,"2099-01-01");
  assert.equal(restored.is_archived,"No");assert.equal(restored.status,"planning");
});

test("intake writes an archived repeat in place and creates a separate inquiry for a later trip",()=>{
  const context=importArchiveContext();
  const old={inquiry_id:"QA-OLD",guest_id:"QA-GUEST",email:"qa@example.com",status:"duplicate",is_archived:"Yes",archived_at:"2098-01-01",source_record_id:"book_tour:128",source_tab:"book_tour",requested_date_start:"2099-12-17",followup_date:""};
  const writes=[],appends=[];
  context.getObjectsWithRowNumbers_=()=>[{rowNumber:2,row:old}];
  context.getObjects_=()=>[old];context.makeId_=()=>"QA-NEW";
  context.todayIso_=()=>"2099-01-01";
  context.writeObjectToRow_=(_,rowNumber,row)=>writes.push({rowNumber,row});
  context.appendObject_=(_,row)=>appends.push(row);
  context.buildStructuredSiteRequest_=()=>({interestCategory:"Activity",serviceType:"Activity",tourItems:[],tourItemsJson:"[]",groupingPreference:"unknown",transportationNeeded:"Unknown"});
  const ss={getSheetByName:()=>({})},guest={guest_id:"QA-GUEST"};
  const input={emailNormalized:"qa@example.com",sourceType:"site_book_tour",sourceTab:"book_tour",sourceRecordId:"book_tour:129",requestedDateText:"2099-12-17",guestCountText:"2"};
  const repeat=context.appendInquiry_(ss,guest,input,"2099-01-01T00:00:00Z");
  assert.equal(repeat._created_new,false);assert.equal(repeat.inquiry_id,"QA-OLD");assert.equal(repeat.status,"duplicate");assert.equal(repeat.followup_date,"");assert.equal(writes.length,1);assert.equal(appends.length,0);
  const later=context.appendInquiry_(ss,guest,{...input,sourceRecordId:"book_tour:130",requestedDateText:"2100-01-05"},"2099-01-01T00:00:00Z");
  assert.equal(later._created_new,true);assert.equal(later.inquiry_id,"QA-NEW");assert.equal(later.status,"new");assert.equal(later.is_archived,"No");assert.equal(appends.length,1);assert.equal(old.status,"duplicate");
});
