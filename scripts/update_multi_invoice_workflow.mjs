import fs from "node:fs";
import crypto from "node:crypto";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  throw new Error("Usage: node scripts/update_multi_invoice_workflow.mjs <source.json> <output.json>");
}

const workflow = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const node = name => workflow.nodes.find(item => item.name === name);
const clone = value => JSON.parse(JSON.stringify(value));
const makeId = value => crypto.createHash("sha1").update(value).digest("hex").slice(0, 8) + "-0000-4000-8000-" + crypto.createHash("sha1").update(value).digest("hex").slice(8, 20);
const sheetUrl = "https://docs.google.com/spreadsheets/d/1_1JtBLyZXpXxTVe11TolZ3Ip2b4ASRDoQaISdHulmFg/edit";

const resources = [
  {
    singular: "Booking",
    plural: "Bookings",
    sheet: "crm_bookings",
    key: "booking_id",
    actions: ["list_bookings", "upsert_booking"],
    columns: ["booking_id","inquiry_id","guest_id","created_at","updated_at","booking_status","tour_date_start","tour_date_end","tour_date_text","party_size","service_type","product_selected","tour_guide","pickup_location","total_booking_price","quoted_currency","deposit_required","balance_due_date","calendar_event_id","operations_notes","source_system","source_key","invoice_no","tour_key","completed_at","is_archived","archived_at","archive_reason"],
    process: `
const request=$('Normalize Request').first().json;
const action=String(request.action||'');
const clean=value=>String(value??'').trim();
const rows=$input.all().map(item=>item.json||item).filter(row=>row&&Object.values(row).some(value=>clean(value)!==''));
if(action==='list_bookings'){
  const guest=clean(request.guest_id),inquiry=clean(request.inquiry_id),booking=clean(request.booking_id);
  const records=rows.filter(row=>(!guest||clean(row.guest_id)===guest)&&(!inquiry||clean(row.inquiry_id)===inquiry)&&(!booking||clean(row.booking_id)===booking)&&clean(row.is_archived).toLowerCase()!=='yes').sort((a,b)=>clean(b.tour_date_start||b.created_at).localeCompare(clean(a.tour_date_start||a.created_at)));
  return [{json:{ok:true,action,count:records.length,records,_route:'respond'}}];
}
const now=new Date().toISOString();
const incoming={...(request.booking||request.record||{})};
if(!clean(incoming.inquiry_id)||!clean(incoming.guest_id)) throw new Error('Booking requires inquiry_id and guest_id.');
incoming.booking_id=clean(incoming.booking_id)||('B-'+clean(incoming.inquiry_id).replace(/^INQ-/,''));
const existing=rows.find(row=>clean(row.booking_id)===incoming.booking_id)||{};
const record={...existing,...incoming,booking_id:incoming.booking_id,created_at:clean(existing.created_at||incoming.created_at)||now,updated_at:now};
record.booking_status=clean(record.booking_status||'pending').toLowerCase();
record.quoted_currency=clean(record.quoted_currency||'USD').toUpperCase();
record.is_archived=['yes','true','1'].includes(clean(record.is_archived).toLowerCase())?'Yes':'No';
return [{json:{...record,_route:'write'}}];`
  },
  {
    singular: "Payment",
    plural: "Payments",
    sheet: "crm_payments",
    key: "payment_id",
    actions: ["list_payments", "upsert_payment"],
    columns: ["payment_id","booking_id","inquiry_id","guest_id","created_at","payment_status","payment_date","payment_method","paid_to","invoice_no","invoice_id","transaction_id","payment_reference_note","total_booking_price","deposit_amount_paid","additional_amount_paid","total_amount_paid","balance_remaining","is_fully_paid","notes"],
    process: `
const request=$('Normalize Request').first().json;
const action=String(request.action||'');
const clean=value=>String(value??'').trim();
const number=value=>{const parsed=Number(String(value??'').replace(/[^0-9.-]/g,''));return Number.isFinite(parsed)?parsed:0;};
const rows=$input.all().map(item=>item.json||item).filter(row=>row&&Object.values(row).some(value=>clean(value)!==''));
if(action==='list_payments'){
  const guest=clean(request.guest_id),inquiry=clean(request.inquiry_id),booking=clean(request.booking_id);
  const records=rows.filter(row=>(!guest||clean(row.guest_id)===guest)&&(!inquiry||clean(row.inquiry_id)===inquiry)&&(!booking||clean(row.booking_id)===booking)).sort((a,b)=>clean(b.payment_date||b.created_at).localeCompare(clean(a.payment_date||a.created_at)));
  return [{json:{ok:true,action,count:records.length,records,_route:'respond'}}];
}
const now=new Date().toISOString();
const incoming={...(request.payment||request.record||{})};
if(!clean(incoming.inquiry_id)||!clean(incoming.guest_id)) throw new Error('Payment requires inquiry_id and guest_id.');
const identity=clean(incoming.invoice_id||incoming.transaction_id||incoming.invoice_no);
incoming.payment_id=clean(incoming.payment_id)||(identity?'PAY-'+identity.replace(/[^A-Za-z0-9_-]/g,'-'):'PAY-'+Date.now());
incoming.booking_id=clean(incoming.booking_id)||('B-'+clean(incoming.inquiry_id).replace(/^INQ-/,''));
const existing=rows.find(row=>clean(row.payment_id)===incoming.payment_id)||{};
const record={...existing,...incoming,payment_id:incoming.payment_id,created_at:clean(existing.created_at||incoming.created_at)||now};
record.deposit_amount_paid=number(record.deposit_amount_paid);
record.additional_amount_paid=number(record.additional_amount_paid);
record.total_amount_paid=number(record.total_amount_paid||record.additional_amount_paid||record.deposit_amount_paid);
record.total_booking_price=number(record.total_booking_price);
record.balance_remaining=Math.max(0,number(record.balance_remaining||Math.max(0,record.total_booking_price-record.total_amount_paid)));
record.is_fully_paid=record.balance_remaining<=0.005&&record.total_amount_paid>0?'Yes':'No';
record.payment_status=clean(record.payment_status||(record.is_fully_paid==='Yes'?'paid':record.total_amount_paid>0?'partial':'unpaid')).toLowerCase();
return [{json:{...record,_route:'write'}}];`
  }
];

const switchNode = node("Switch - Action");
const switchConnections = workflow.connections["Switch - Action"].main;
const fallback = switchConnections.pop();

for (const [resourceIndex, resource] of resources.entries()) {
  const readName = `Read CRM ${resource.plural}`;
  const processName = `Process CRM ${resource.plural}`;
  const routeName = `Route CRM ${resource.plural}`;
  const writeName = `Write CRM ${resource.singular}`;
  const finalName = `Finalize CRM ${resource.singular}`;
  const y = 14800 + resourceIndex * 520;

  const read = clone(node("Read CRM Interactions"));
  Object.assign(read,{id:makeId(readName),name:readName,position:[46864,y]});
  read.parameters.documentId.value=sheetUrl;
  read.parameters.sheetName.value=resource.sheet;

  const process = clone(node("Process CRM Interactions"));
  Object.assign(process,{id:makeId(processName),name:processName,position:[47104,y]});
  process.parameters.jsCode=resource.process;

  const route = clone(node("Route CRM Interactions"));
  Object.assign(route,{id:makeId(routeName),name:routeName,position:[47376,y]});

  const write = clone(node("Write CRM Interaction"));
  Object.assign(write,{id:makeId(writeName),name:writeName,position:[47648,y-80]});
  write.parameters.documentId.value=sheetUrl;
  write.parameters.sheetName.value=resource.sheet;
  write.parameters.columns.value=Object.fromEntries(resource.columns.map(column=>[column,`={{ $json.${column} ?? '' }}`]));
  write.parameters.columns.matchingColumns=[resource.key];
  write.parameters.columns.schema=resource.columns.map(column=>({id:column,displayName:column,required:false,defaultMatch:false,display:true,type:"string",canBeUsedToMatch:true,removed:false}));

  const final = clone(node("Finalize CRM Interaction"));
  Object.assign(final,{id:makeId(finalName),name:finalName,position:[47904,y-80]});
  final.parameters.jsCode=`const record={...$('${processName}').first().json}; delete record._route; return [{json:{ok:true,action:'upsert_${resource.singular.toLowerCase()}',record}}];`;

  workflow.nodes.push(read,process,route,write,final);
  workflow.connections[readName]={main:[[{node:processName,type:"main",index:0}]]};
  workflow.connections[processName]={main:[[{node:routeName,type:"main",index:0}]]};
  workflow.connections[routeName]={main:[[{node:writeName,type:"main",index:0}],[{node:"Respond to Admin Page",type:"main",index:0}]]};
  workflow.connections[writeName]={main:[[{node:finalName,type:"main",index:0}]]};
  workflow.connections[finalName]={main:[[{node:"Respond to Admin Page",type:"main",index:0}]]};

  for (const action of resource.actions) {
    switchNode.parameters.rules.values.push({conditions:{options:{caseSensitive:false,leftValue:"",typeValidation:"strict"},conditions:[{leftValue:"={{$json.action}}",rightValue:action,operator:{type:"string",operation:"equals"}}],combinator:"and"}});
    switchConnections.push([{node:readName,type:"main",index:0}]);
  }
}
switchConnections.push(fallback);

const unsupported = node("Unsupported Action");
unsupported.parameters.jsCode = unsupported.parameters.jsCode.replace(
  /allowed_actions:\s*\[[^\]]*\]/,
  `allowed_actions: ["list_inquiries","create_guest_and_inquiry","create_returning_inquiry","update_inquiry","list_interactions","create_interaction","update_interaction","delete_interaction","list_assignments","create_assignment","update_assignment","delete_assignment","list_providers","invite_assignment_provider","save_inquiry_studio","get_inquiry_studio","list_bookings","upsert_booking","list_payments","upsert_payment"]`
);

fs.writeFileSync(outputPath, JSON.stringify(workflow,null,2)+"\n");
