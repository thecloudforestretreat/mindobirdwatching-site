import fs from "node:fs";

const file = new URL("../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json", import.meta.url);
const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
const byName = name => workflow.nodes.find(node => node.name === name);
const clone = value => structuredClone(value);

const switchNode = byName("Switch - Action");
const readTemplate = byName("Read CRM Payments");
const processTemplate = byName("Process CRM Payments");
const routeTemplate = byName("Route CRM Payments");
const writeTemplate = byName("Write CRM Payment");
const finalizeTemplate = byName("Finalize CRM Payment");
if (![switchNode, readTemplate, processTemplate, routeTemplate, writeTemplate, finalizeTemplate].every(Boolean)) throw new Error("CRM workflow templates are missing.");

const names = new Set(["Read CRM Supplier Commitments", "Process CRM Supplier Commitments", "Route CRM Supplier Commitments", "Write CRM Supplier Commitment", "Finalize CRM Supplier Commitment"]);
workflow.nodes = workflow.nodes.filter(node => !names.has(node.name));
switchNode.parameters.rules.values = switchNode.parameters.rules.values.filter(rule => {
  const value = rule.conditions?.conditions?.[0]?.rightValue;
  return !["list_supplier_commitments", "upsert_supplier_commitment"].includes(value);
});

const rule = action => ({ conditions: { options: { caseSensitive: false, leftValue: "", typeValidation: "strict" }, conditions: [{ leftValue: "={{$json.action}}", rightValue: action, operator: { type: "string", operation: "equals" } }], combinator: "and" } });
switchNode.parameters.rules.values.push(rule("list_supplier_commitments"), rule("upsert_supplier_commitment"));

const read = clone(readTemplate);
Object.assign(read, { id: "6e170001-0000-4000-8000-000000000001", name: "Read CRM Supplier Commitments", position: [46864, 15640] });
read.parameters.sheetName.value = "crm_supplier_commitments";

const process = clone(processTemplate);
Object.assign(process, { id: "6e170002-0000-4000-8000-000000000002", name: "Process CRM Supplier Commitments", position: [47104, 15640] });
process.parameters.jsCode = `
const request=$('Normalize Request').first().json;
const action=String(request.action||'');
const clean=value=>String(value??'').trim();
const number=value=>{const parsed=Number(value??0);return Number.isFinite(parsed)&&parsed>=0?Math.round(parsed*100)/100:0;};
const rows=$input.all().map(item=>item.json||item).filter(row=>row&&Object.values(row).some(value=>clean(value)!==''));
if(action==='list_supplier_commitments'){
  const plan=clean(request.plan_id),inquiry=clean(request.inquiry_id),booking=clean(request.booking_id),supplier=clean(request.supplier_id);
  const records=rows.filter(row=>(!plan||clean(row.plan_id)===plan)&&(!inquiry||clean(row.inquiry_id)===inquiry)&&(!booking||clean(row.booking_id)===booking)&&(!supplier||clean(row.supplier_id)===supplier)).sort((a,b)=>clean(a.service_date_start||a.created_at).localeCompare(clean(b.service_date_start||b.created_at)));
  return [{json:{ok:true,action,count:records.length,records,_route:'respond'}}];
}
const now=new Date().toISOString();
const incoming={...(request.commitment||request.record||{})};
if(!clean(incoming.commitment_id)||!clean(incoming.supplier_name)||!clean(incoming.description)||(!clean(incoming.plan_id)&&!clean(incoming.inquiry_id))) throw new Error('Commitment requires an ID, supplier, description, and plan or inquiry reference.');
const existing=rows.find(row=>clean(row.commitment_id)===clean(incoming.commitment_id))||{};
const record={...existing,...incoming,commitment_id:clean(incoming.commitment_id),created_at:clean(existing.created_at||incoming.created_at)||now,updated_at:now};
for(const key of ['quoted_cost','committed_cost','amount_paid','refundable_amount']) record[key]=number(record[key]);
return [{json:{...record,_route:'write'}}];`;

const route = clone(routeTemplate);
Object.assign(route, { id: "6e170003-0000-4000-8000-000000000003", name: "Route CRM Supplier Commitments", position: [47376, 15640] });

const columns = ["commitment_id", "inquiry_id", "booking_id", "plan_id", "supplier_id", "supplier_name", "category", "description", "service_date_start", "service_date_end", "currency", "quoted_cost", "committed_cost", "amount_paid", "payment_status", "refundability", "refundable_amount", "cancellation_deadline", "confirmation_reference", "evidence_url", "internal_notes", "entered_by", "created_at", "updated_at"];
const write = clone(writeTemplate);
Object.assign(write, { id: "6e170004-0000-4000-8000-000000000004", name: "Write CRM Supplier Commitment", position: [47648, 15560] });
write.parameters.sheetName.value = "crm_supplier_commitments";
write.parameters.columns.value = Object.fromEntries(columns.map(key => [key, `={{ $json.${key} ?? '' }}`]));
write.parameters.columns.matchingColumns = ["commitment_id"];
write.parameters.columns.schema = columns.map(key => ({ id: key, displayName: key, required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true, removed: false }));

const finalize = clone(finalizeTemplate);
Object.assign(finalize, { id: "6e170005-0000-4000-8000-000000000005", name: "Finalize CRM Supplier Commitment", position: [47904, 15560] });
finalize.parameters.jsCode = "const record={...$('Process CRM Supplier Commitments').first().json}; delete record._route; return [{json:{ok:true,action:'upsert_supplier_commitment',record}}];";
workflow.nodes.push(read, process, route, write, finalize);

const switchOutputs = workflow.connections["Switch - Action"].main;
while (switchOutputs.length > switchNode.parameters.rules.values.length + 1) switchOutputs.splice(-2, 1);
const fallback = switchOutputs.pop() || [{ node: "Unsupported Action", type: "main", index: 0 }];
switchOutputs.push([{ node: read.name, type: "main", index: 0 }], [{ node: read.name, type: "main", index: 0 }], fallback);
workflow.connections[read.name] = { main: [[{ node: process.name, type: "main", index: 0 }]] };
workflow.connections[process.name] = { main: [[{ node: route.name, type: "main", index: 0 }]] };
workflow.connections[route.name] = { main: [[{ node: write.name, type: "main", index: 0 }], [{ node: "Respond to Admin Page", type: "main", index: 0 }]] };
workflow.connections[write.name] = { main: [[{ node: finalize.name, type: "main", index: 0 }]] };
workflow.connections[finalize.name] = { main: [[{ node: "Respond to Admin Page", type: "main", index: 0 }]] };

fs.writeFileSync(file, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Updated ${file.pathname} with ${workflow.nodes.length} nodes and ${switchNode.parameters.rules.values.length} actions.`);
