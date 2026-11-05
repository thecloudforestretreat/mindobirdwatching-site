import fs from "node:fs";

const sourceFile = new URL("../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json", import.meta.url);
const outputFile = new URL("../deployment/multi-invoice-ledger/MBW-Supplier-Transactions-API.json", import.meta.url);
const source = JSON.parse(fs.readFileSync(sourceFile, "utf8"));
const names = ["Webhook - CRM Admin API", "Normalize Request", "Switch - Action", "Read CRM Supplier Transactions", "Process CRM Supplier Transactions", "Route CRM Supplier Transactions", "Write CRM Supplier Transaction", "Finalize CRM Supplier Transaction", "Respond to Admin Page"];
const nodes = names.map(name => structuredClone(source.nodes.find(node => node.name === name))).filter(Boolean);
if (nodes.length !== names.length) throw new Error("Supplier transaction workflow templates are incomplete.");
const byName = name => nodes.find(node => node.name === name);
const webhook = byName("Webhook - CRM Admin API");
webhook.parameters.path = "mbw-supplier-transactions-api";
webhook.webhookId = "mbw-supplier-transactions-api";
webhook.name = "Webhook - Supplier Transactions API";
const normalize = byName("Normalize Request");
normalize.name = "Normalize Supplier Transaction Request";
const processTransactions = byName("Process CRM Supplier Transactions");
processTransactions.parameters.jsCode = processTransactions.parameters.jsCode.replace("$('Normalize Request')", "$('Normalize Supplier Transaction Request')");
const switchNode = byName("Switch - Action");
switchNode.name = "Switch - Supplier Transaction Action";
switchNode.parameters.rules.values = switchNode.parameters.rules.values.filter(rule => ["list_supplier_transactions", "upsert_supplier_transaction"].includes(rule.conditions?.conditions?.[0]?.rightValue));
const workflow = {
  name: "MBW Supplier Transactions API",
  nodes,
  pinData: {},
  connections: {
    [webhook.name]: { main: [[{ node: normalize.name, type: "main", index: 0 }]] },
    [normalize.name]: { main: [[{ node: switchNode.name, type: "main", index: 0 }]] },
    [switchNode.name]: { main: [[{ node: "Read CRM Supplier Transactions", type: "main", index: 0 }], [{ node: "Read CRM Supplier Transactions", type: "main", index: 0 }], [{ node: "Respond to Admin Page", type: "main", index: 0 }]] },
    "Read CRM Supplier Transactions": { main: [[{ node: "Process CRM Supplier Transactions", type: "main", index: 0 }]] },
    "Process CRM Supplier Transactions": { main: [[{ node: "Route CRM Supplier Transactions", type: "main", index: 0 }]] },
    "Route CRM Supplier Transactions": { main: [[{ node: "Write CRM Supplier Transaction", type: "main", index: 0 }], [{ node: "Respond to Admin Page", type: "main", index: 0 }]] },
    "Write CRM Supplier Transaction": { main: [[{ node: "Finalize CRM Supplier Transaction", type: "main", index: 0 }]] },
    "Finalize CRM Supplier Transaction": { main: [[{ node: "Respond to Admin Page", type: "main", index: 0 }]] },
  },
  active: false,
  settings: source.settings || {},
  versionId: crypto.randomUUID(),
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};
fs.writeFileSync(outputFile, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Wrote ${outputFile.pathname}`);
