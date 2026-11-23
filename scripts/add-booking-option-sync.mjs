import fs from "node:fs";
import crypto from "node:crypto";

const path = new URL("../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json", import.meta.url);
const workflow = JSON.parse(fs.readFileSync(path, "utf8"));
const documentUrl = "https://docs.google.com/spreadsheets/d/1rdPmYmhCehx_3bI737dkg8NyiutwIu3NAav7B-mbwlw/edit";
const credentials = { googleSheetsOAuth2Api: { id: "sJdVMmql2IyZ94ti", name: "Google Sheets - MBW" } };
const id = () => crypto.randomUUID();

const optionColumns = ["option_id","inquiry_id","guest_id","booking_id","parent_service_item_id","guest_name","tour_product","service_date","option_type","product_selected","option_name","reserve_location","offering_status","decision_status","quantity","unit_price","currency","guest_amount_total","payment_route","financial_status","invoice_no","invoice_id","payment_id","supplier_cost_per_unit","supplier_cost_total","supplier_cost_status","expense_id","dietary_notes","meal_choices_json","communicated_at","communication_channel","selected_at","fulfilled_at","record_status","cancelled_at","cancellation_reason","created_at","updated_at","updated_by","automation_notes"];
const guestColumns = ["option_guest_id","option_id","inquiry_id","guest_id","booking_id","parent_service_item_id","service_date","tour_product","option_type","traveler_index","traveler_name","participation_status","meal_selection","allergy_dietary_notes","preference_notes","finalization_status","finalized_at","record_status","created_at","updated_at","updated_by","automation_notes"];

function readNode(name, sheetName, position) {
  return {
    parameters: {
      documentId: { __rl: true, value: documentUrl, mode: "url" },
      sheetName: { __rl: true, value: sheetName, mode: "name" },
      options: {}
    },
    id: id(), name, type: "n8n-nodes-base.googleSheets", typeVersion: 4.7,
    position, alwaysOutputData: true, credentials
  };
}

function writeNode(name, sheetName, columns, match, position) {
  return {
    parameters: {
      operation: "appendOrUpdate",
      documentId: { __rl: true, value: documentUrl, mode: "url" },
      sheetName: { __rl: true, value: sheetName, mode: "name" },
      columns: {
        mappingMode: "defineBelow",
        value: Object.fromEntries(columns.map(column => [column, `={{ $json.${column} ?? '' }}`])),
        matchingColumns: [match],
        schema: columns.map(column => ({ id: column, displayName: column, required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true, removed: false })),
        attemptToConvertTypes: false,
        convertFieldsToString: false
      },
      options: {}
    },
    id: id(), name, type: "n8n-nodes-base.googleSheets", typeVersion: 4.7,
    position, credentials
  };
}

function codeNode(name, jsCode, position) {
  return { parameters: { jsCode }, id: id(), name, type: "n8n-nodes-base.code", typeVersion: 2, position };
}

function routeNode(name, writeRoute, position) {
  return {
    parameters: {
      rules: { values: [{ conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict" }, conditions: [{ leftValue: "={{$json._route}}", rightValue: writeRoute, operator: { type: "string", operation: "equals" } }], combinator: "and" } }] },
      options: { fallbackOutput: "extra" }
    },
    id: id(), name, type: "n8n-nodes-base.switch", typeVersion: 3, position
  };
}

const prepareOptions = String.raw`const request=$('Normalize Request').first().json;
const record={...(request.record||request.inquiry_row||{})};
const clean=value=>String(value??'').trim();
const now=new Date().toISOString();
const staff=clean(request.updated_by||request.created_by||'CRM').toUpperCase();
const code=value=>{const match=clean(value).toUpperCase().match(/(?:^|\b)(MBW\d{3})(?:\b|\s|-)/);return match?match[1]:'';};
const eligible=new Set(['MBW005','MBW006','MBW007','MBW008','MBW010']);
const parse=value=>{if(Array.isArray(value))return value;if(!clean(value))return[];try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}};
const items=parse(record.tour_items_json||record.tour_items);
const existing=$('Read Booking Options').all().map(item=>item.json||item).filter(row=>clean(row.option_id));
const incoming=[];
for(const item of items){
  const product=code(item.product_selected||item.tour);
  if(!eligible.has(product)||!item.meal_options)continue;
  for(const type of ['breakfast','lunch']){
    const meal=item.meal_options[type]; if(!meal)continue;
    const travelers=Array.isArray(meal.travelers)?meal.travelers:[];
    const selected=travelers.filter(row=>type==='breakfast'?clean(row.participation_status)==='included':!['','undecided','not_eating'].includes(clean(row.meal_selection)));
    const quantity=selected.length;
    const price=Number(meal.unit_price||0);
    const decision=clean(meal.guest_decision)==='yes'?'selected':clean(meal.guest_decision)==='no'?'declined':'pending';
    const payment=clean(meal.payment_route)||'undecided';
    const financial=payment==='reserve_onsite'?'pay_onsite':payment==='complimentary'?'not_applicable':payment==='mbw'?'not_invoiced':'not_invoiced';
    const optionId=clean(meal.option_id)||[clean(item.id)||'primary',clean(item.date||item.tour_date)||'undated',product,type].join('|');
    const dietary=[...new Set(travelers.map(row=>clean(row.allergy_dietary_notes)).filter(Boolean))].join('; ');
    incoming.push({option_id:optionId,inquiry_id:clean(record.inquiry_id),guest_id:clean(record.guest_id),booking_id:clean(record.booking_id),parent_service_item_id:clean(item.id)||'primary',guest_name:clean(record.full_name),tour_product:product,service_date:clean(item.date||item.tour_date),option_type:'meal',product_selected:type,option_name:type==='breakfast'?'Breakfast':'Lunch',reserve_location:'',offering_status:clean(meal.discussed_stage)==='not_discussed'?'not_mentioned':'mentioned',decision_status:decision,quantity:String(quantity),unit_price:String(price||''),currency:'USD',guest_amount_total:payment==='mbw'&&quantity&&price?String(quantity*price):'0',payment_route:payment,financial_status:financial,invoice_no:'',invoice_id:'',payment_id:'',supplier_cost_per_unit:'',supplier_cost_total:'',supplier_cost_status:'none',expense_id:'',dietary_notes:dietary,meal_choices_json:JSON.stringify(travelers),communicated_at:'',communication_channel:'',selected_at:decision==='selected'?now:'',fulfilled_at:'',record_status:'active',cancelled_at:'',cancellation_reason:'',created_at:clean(existing.find(row=>clean(row.option_id)===optionId)?.created_at)||now,updated_at:now,updated_by:staff,automation_notes:'Synced from CRM tour meal options',_route:'write_option'});
  }
}
const ids=new Set(incoming.map(row=>row.option_id));
const stale=existing.filter(row=>clean(row.inquiry_id)===clean(record.inquiry_id)&&!ids.has(clean(row.option_id))&&clean(row.record_status)!=='cancelled').map(row=>({...row,record_status:'cancelled',cancelled_at:now,cancellation_reason:'Removed or no longer eligible in CRM itinerary',updated_at:now,updated_by:staff,automation_notes:'Cancelled by CRM booking-option sync',_route:'write_option'}));
const rows=[...incoming,...stale];
return rows.length?rows.map(json=>({json})):[{json:{_route:'skip_options',inquiry_id:record.inquiry_id,guest_id:record.guest_id}}];`;

const prepareGuests = String.raw`const request=$('Normalize Request').first().json;
const record={...(request.record||request.inquiry_row||{})};
const clean=value=>String(value??'').trim();
const now=new Date().toISOString();
const staff=clean(request.updated_by||request.created_by||'CRM').toUpperCase();
const code=value=>{const match=clean(value).toUpperCase().match(/(?:^|\b)(MBW\d{3})(?:\b|\s|-)/);return match?match[1]:'';};
const eligible=new Set(['MBW005','MBW006','MBW007','MBW008','MBW010']);
const parse=value=>{if(Array.isArray(value))return value;if(!clean(value))return[];try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}};
const existing=$('Read Booking Option Guests').all().map(item=>item.json||item).filter(row=>clean(row.option_guest_id));
const incoming=[];
for(const item of parse(record.tour_items_json||record.tour_items)){
  const product=code(item.product_selected||item.tour); if(!eligible.has(product)||!item.meal_options)continue;
  for(const type of ['breakfast','lunch']){
    const meal=item.meal_options[type]; if(!meal)continue;
    const optionId=clean(meal.option_id)||[clean(item.id)||'primary',clean(item.date||item.tour_date)||'undated',product,type].join('|');
    const travelers=Array.isArray(meal.travelers)?meal.travelers:[];
    travelers.forEach((traveler,index)=>{
      const travelerIndex=Number(traveler.traveler_index||index+1);
      const rowId=optionId+'|'+travelerIndex;
      const finalStatus=clean(traveler.finalization_status||meal.finalization_status)||'not_finalized';
      incoming.push({option_guest_id:rowId,option_id:optionId,inquiry_id:clean(record.inquiry_id),guest_id:clean(record.guest_id),booking_id:clean(record.booking_id),parent_service_item_id:clean(item.id)||'primary',service_date:clean(item.date||item.tour_date),tour_product:product,option_type:type,traveler_index:String(travelerIndex),traveler_name:clean(traveler.traveler_name)||('Guest '+travelerIndex),participation_status:clean(traveler.participation_status)||'pending',meal_selection:clean(traveler.meal_selection)||(type==='lunch'?'undecided':'not_applicable'),allergy_dietary_notes:clean(traveler.allergy_dietary_notes),preference_notes:clean(traveler.preference_notes),finalization_status:finalStatus,finalized_at:finalStatus==='finalized'?now:'',record_status:'active',created_at:clean(existing.find(row=>clean(row.option_guest_id)===rowId)?.created_at)||now,updated_at:now,updated_by:staff,automation_notes:'Synced from CRM traveler meal selection',_route:'write_guest'});
    });
  }
}
const ids=new Set(incoming.map(row=>row.option_guest_id));
const stale=existing.filter(row=>clean(row.inquiry_id)===clean(record.inquiry_id)&&!ids.has(clean(row.option_guest_id))&&clean(row.record_status)!=='cancelled').map(row=>({...row,record_status:'cancelled',updated_at:now,updated_by:staff,automation_notes:'Cancelled by CRM booking-option sync',_route:'write_guest'}));
const rows=[...incoming,...stale];
return rows.length?rows.map(json=>({json})):[{json:{_route:'skip_guests',inquiry_id:record.inquiry_id,guest_id:record.guest_id}}];`;

const finalize = String.raw`const request=$('Normalize Request').first().json;
const record={...(request.record||request.inquiry_row||{})};
const clean=value=>String(value??'').trim();
const parse=value=>{if(Array.isArray(value))return value;if(!clean(value))return[];try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}};
const eligible=new Set(['MBW005','MBW006','MBW007','MBW008','MBW010']);
const code=value=>{const match=clean(value).toUpperCase().match(/(?:^|\b)(MBW\d{3})(?:\b|\s|-)/);return match?match[1]:'';};
let optionCount=0,guestCount=0;
for(const item of parse(record.tour_items_json||record.tour_items)){
  if(!eligible.has(code(item.product_selected||item.tour))||!item.meal_options)continue;
  for(const type of ['breakfast','lunch']){const meal=item.meal_options[type];if(!meal)continue;optionCount++;guestCount+=Array.isArray(meal.travelers)?meal.travelers.length:0;}
}
return [{json:{ok:true,action:'sync_booking_options',inquiry_id:clean(record.inquiry_id),option_count:optionCount,option_guest_count:guestCount,verified:true}}];`;

const newNodes = [
  readNode("Read Booking Options", "crm_booking_options", [48200, 16000]),
  readNode("Read Booking Option Guests", "crm_booking_option_guests", [48440, 16000]),
  codeNode("Prepare Booking Option Sync", prepareOptions, [48680, 16000]),
  routeNode("Route Booking Option Sync", "write_option", [48920, 16000]),
  writeNode("Write Booking Options", "crm_booking_options", optionColumns, "option_id", [49160, 15920]),
  codeNode("Prepare Booking Option Guest Sync", prepareGuests, [49400, 16000]),
  routeNode("Route Booking Option Guest Sync", "write_guest", [49640, 16000]),
  writeNode("Write Booking Option Guests", "crm_booking_option_guests", guestColumns, "option_guest_id", [49880, 15920]),
  codeNode("Finalize Booking Option Sync", finalize, [50120, 16000])
];

const names = new Set(newNodes.map(node => node.name));
workflow.nodes = workflow.nodes.filter(node => !names.has(node.name));
for (const name of names) delete workflow.connections[name];
workflow.nodes.push(...newNodes);

const switchNode = workflow.nodes.find(node => node.name === "Switch - Action");
const rules = switchNode.parameters.rules.values;
const existingRule = rules.findIndex(rule => rule.conditions.conditions[0].rightValue === "sync_booking_options");
if (existingRule >= 0) rules.splice(existingRule, 1);
rules.push({ conditions: { options: { caseSensitive: false, leftValue: "", typeValidation: "strict" }, conditions: [{ leftValue: "={{$json.action}}", rightValue: "sync_booking_options", operator: { type: "string", operation: "equals" } }], combinator: "and" } });

const switchConnections = workflow.connections["Switch - Action"].main;
if (switchConnections.length > rules.length) switchConnections.splice(rules.length - 1, switchConnections.length - rules.length);
switchConnections.splice(rules.length - 1, 0, [{ node: "Read Booking Options", type: "main", index: 0 }]);

workflow.connections["Read Booking Options"] = { main: [[{ node: "Read Booking Option Guests", type: "main", index: 0 }]] };
workflow.connections["Read Booking Option Guests"] = { main: [[{ node: "Prepare Booking Option Sync", type: "main", index: 0 }]] };
workflow.connections["Prepare Booking Option Sync"] = { main: [[{ node: "Route Booking Option Sync", type: "main", index: 0 }]] };
workflow.connections["Route Booking Option Sync"] = { main: [
  [{ node: "Write Booking Options", type: "main", index: 0 }],
  [{ node: "Prepare Booking Option Guest Sync", type: "main", index: 0 }]
] };
workflow.connections["Write Booking Options"] = { main: [[{ node: "Prepare Booking Option Guest Sync", type: "main", index: 0 }]] };
workflow.connections["Prepare Booking Option Guest Sync"] = { main: [[{ node: "Route Booking Option Guest Sync", type: "main", index: 0 }]] };
workflow.connections["Route Booking Option Guest Sync"] = { main: [
  [{ node: "Write Booking Option Guests", type: "main", index: 0 }],
  [{ node: "Finalize Booking Option Sync", type: "main", index: 0 }]
] };
workflow.connections["Write Booking Option Guests"] = { main: [[{ node: "Finalize Booking Option Sync", type: "main", index: 0 }]] };
workflow.connections["Finalize Booking Option Sync"] = { main: [[{ node: "Respond to Admin Page", type: "main", index: 0 }]] };

fs.writeFileSync(path, JSON.stringify(workflow, null, 2) + "\n");
console.log(`Updated workflow with ${workflow.nodes.length} nodes and ${rules.length} action rules.`);
