import fs from "node:fs";

const defaultFile = new URL("../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json", import.meta.url);
const file = globalThis.process.argv[2] ? new URL(`file://${globalThis.process.argv[2]}`) : defaultFile;
const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
const byName = name => workflow.nodes.find(node => node.name === name);
const clone = value => structuredClone(value);
const switchNode = byName("Switch - Action");
const readTemplate = byName("Read CRM Supplier Commitments") || byName("Read CRM Payments");
const processTemplate = byName("Process CRM Supplier Commitments") || byName("Process CRM Payments");
const routeTemplate = byName("Route CRM Supplier Commitments") || byName("Route CRM Payments");
const writeTemplate = byName("Write CRM Supplier Commitment") || byName("Write CRM Payment");
const finalizeTemplate = byName("Finalize CRM Supplier Commitment") || byName("Finalize CRM Payment");
if (![switchNode, readTemplate, processTemplate, routeTemplate, writeTemplate, finalizeTemplate].every(Boolean)) throw new Error("CRM workflow templates are missing.");

const names = new Set(["Read CRM Supplier Transactions", "Process CRM Supplier Transactions", "Route CRM Supplier Transactions", "Write CRM Supplier Transaction", "Finalize CRM Supplier Transaction"]);
workflow.nodes = workflow.nodes.filter(node => !names.has(node.name));
switchNode.parameters.rules.values = switchNode.parameters.rules.values.filter(rule => !["list_supplier_transactions", "upsert_supplier_transaction"].includes(rule.conditions?.conditions?.[0]?.rightValue));
const rule = action => ({ conditions: { options: { caseSensitive: false, leftValue: "", typeValidation: "strict" }, conditions: [{ leftValue: "={{$json.action}}", rightValue: action, operator: { type: "string", operation: "equals" } }], combinator: "and" } });
switchNode.parameters.rules.values.push(rule("list_supplier_transactions"), rule("upsert_supplier_transaction"));

const read = clone(readTemplate);
Object.assign(read, { id: "7e170001-0000-4000-8000-000000000001", name: "Read CRM Supplier Transactions", position: [46864, 16040] });
read.parameters.sheetName.value = "crm_supplier_transactions";
read.alwaysOutputData = true;

const process = clone(processTemplate);
Object.assign(process, { id: "7e170002-0000-4000-8000-000000000002", name: "Process CRM Supplier Transactions", position: [47104, 16040] });
process.parameters.jsCode = `
const request=$('Normalize Request').first().json;
const action=String(request.action||'');
const clean=value=>String(value??'').trim();
const number=value=>{const parsed=Number(value??0);return Number.isFinite(parsed)&&parsed>0?Math.round(parsed*100)/100:0;};
const rows=$input.all().map(item=>item.json||item).filter(row=>row&&Object.values(row).some(value=>clean(value)!==''));
const matches=(row,key,value)=>!value||clean(row[key])===value;
if(action==='list_supplier_transactions'){
  const filters={commitment_id:clean(request.commitment_id),plan_id:clean(request.plan_id),inquiry_id:clean(request.inquiry_id),booking_id:clean(request.booking_id),supplier_id:clean(request.supplier_id),confirmation_number:clean(request.confirmation_number)};
  const records=rows.filter(row=>Object.entries(filters).every(([key,value])=>matches(row,key,value))).sort((a,b)=>clean(b.transaction_date||b.created_at).localeCompare(clean(a.transaction_date||a.created_at)));
  return [{json:{ok:true,action,count:records.length,records,_route:'respond'}}];
}
const now=new Date().toISOString();
const incoming={...(request.transaction||request.record||{})};
if(!clean(incoming.supplier_transaction_id)||!clean(incoming.commitment_id)||!clean(incoming.supplier_name)||!clean(incoming.transaction_date)||!number(incoming.amount)) throw new Error('Supplier transaction requires an ID, commitment, supplier, date, and positive amount.');
const confirmation=clean(incoming.confirmation_number);
if(confirmation&&rows.some(row=>clean(row.confirmation_number)===confirmation&&clean(row.supplier_transaction_id)!==clean(incoming.supplier_transaction_id))) throw new Error('That supplier confirmation number is already recorded.');
const existing=rows.find(row=>clean(row.supplier_transaction_id)===clean(incoming.supplier_transaction_id))||{};
const record={...existing,...incoming,supplier_transaction_id:clean(incoming.supplier_transaction_id),amount:number(incoming.amount),created_at:clean(existing.created_at||incoming.created_at)||now,updated_at:now};
return [{json:{...record,_route:'write'}}];`;

const route = clone(routeTemplate);
Object.assign(route, { id: "7e170003-0000-4000-8000-000000000003", name: "Route CRM Supplier Transactions", position: [47376, 16040] });
const columns = ["supplier_transaction_id", "commitment_id", "inquiry_id", "booking_id", "plan_id", "supplier_id", "supplier_name", "transaction_type", "payment_method", "transaction_date", "currency", "amount", "confirmation_number", "evidence_url", "internal_notes", "entered_by", "created_at", "updated_at"];
const write = clone(writeTemplate);
Object.assign(write, { id: "7e170004-0000-4000-8000-000000000004", name: "Write CRM Supplier Transaction", position: [47648, 15960] });
write.parameters.sheetName.value = "crm_supplier_transactions";
write.parameters.columns.value = Object.fromEntries(columns.map(key => [key, `={{ $json.${key} ?? '' }}`]));
write.parameters.columns.matchingColumns = ["supplier_transaction_id"];
write.parameters.columns.schema = columns.map(key => ({ id: key, displayName: key, required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true, removed: false }));
const finalize = clone(finalizeTemplate);
Object.assign(finalize, { id: "7e170005-0000-4000-8000-000000000005", name: "Finalize CRM Supplier Transaction", position: [47904, 15960] });
finalize.parameters.jsCode = "const record={...$('Process CRM Supplier Transactions').first().json}; delete record._route; return [{json:{ok:true,action:'upsert_supplier_transaction',record}}];";
workflow.nodes.push(read, process, route, write, finalize);

const outputs = workflow.connections["Switch - Action"].main;
while (outputs.length > switchNode.parameters.rules.values.length + 1) outputs.splice(-2, 1);
const fallback = outputs.pop() || [{ node: "Unsupported Action", type: "main", index: 0 }];
outputs.push([{ node: read.name, type: "main", index: 0 }], [{ node: read.name, type: "main", index: 0 }], fallback);
workflow.connections[read.name] = { main: [[{ node: process.name, type: "main", index: 0 }]] };
workflow.connections[process.name] = { main: [[{ node: route.name, type: "main", index: 0 }]] };
workflow.connections[route.name] = { main: [[{ node: write.name, type: "main", index: 0 }], [{ node: "Respond to Admin Page", type: "main", index: 0 }]] };
workflow.connections[write.name] = { main: [[{ node: finalize.name, type: "main", index: 0 }]] };
workflow.connections[finalize.name] = { main: [[{ node: "Respond to Admin Page", type: "main", index: 0 }]] };
fs.writeFileSync(file, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Updated ${file.pathname} with ${workflow.nodes.length} nodes and ${switchNode.parameters.rules.values.length} actions.`);
