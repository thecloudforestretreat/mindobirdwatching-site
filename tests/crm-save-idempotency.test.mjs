import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync(new URL("../admin/guest-crm/index.html",import.meta.url),"utf8");
const workflow=JSON.parse(fs.readFileSync(new URL("../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json",import.meta.url),"utf8"));

test("blank write responses are never replayed by the CRM",()=>{
  assert.match(html,/if\(isRead&&res\.ok&&!text\)/);
  assert.match(html,/CRM did not confirm the save\. Do not retry yet/);
  assert.doesNotMatch(html,/if\(res\.ok&&!text\)/);
});

test("new guest creation persists the inquiry before the guest profile",()=>{
  const connections=workflow.connections;
  assert.equal(connections["Route Validated Create"].main[0][0].node,"Append CRM Inquiry - New Guest");
  assert.equal(connections["Append CRM Inquiry - New Guest"].main[0][0].node,"Restore Create Payload");
  assert.equal(connections["Restore Create Payload"].main[0][0].node,"Append CRM Guest Profile");
  assert.equal(connections["Append CRM Guest Profile"].main[0][0].node,"Respond to Admin Page");
});

test("both Google Sheets writes retain bounded retry handling",()=>{
  for(const name of ["Append CRM Inquiry - New Guest","Append CRM Guest Profile"]){
    const node=workflow.nodes.find(candidate=>candidate.name===name);
    assert.equal(node.retryOnFail,true,name);
    assert.equal(node.maxTries,3,name);
    assert.equal(node.waitBetweenTries,2000,name);
  }
});

test("every CRM inquiry write node uses the same current sheet schema",()=>{
  const writeNodeNames=[
    "Append CRM Inquiry - New Guest",
    "Append CRM Inquiry - Returning Guest",
    "Update CRM Inquiry - Google Sheets",
  ];
  const nodes=writeNodeNames.map(name=>{
    const node=workflow.nodes.find(item=>item.name===name);
    assert.ok(node,`Missing CRM write node: ${name}`);
    return node;
  });
  const expectedIds=nodes[2].parameters.columns.schema.map(column=>column.id);

  for(const node of nodes){
    const columns=node.parameters.columns;
    const ids=columns.schema.map(column=>column.id);
    assert.deepEqual(ids,expectedIds,`${node.name} has stale or reordered sheet columns`);
    assert.equal(new Set(ids).size,ids.length,`${node.name} contains duplicate sheet columns`);
    assert.equal(columns.mappingMode,"defineBelow");
  }

  assert.deepEqual(nodes[2].parameters.columns.matchingColumns,["inquiry_id"]);
});

test("CRM inquiry write mappings cover the same writable columns",()=>{
  const writeNodeNames=[
    "Append CRM Inquiry - New Guest",
    "Append CRM Inquiry - Returning Guest",
    "Update CRM Inquiry - Google Sheets",
  ];
  const nodes=writeNodeNames.map(name=>workflow.nodes.find(item=>item.name===name));
  const expectedKeys=Object.keys(nodes[2].parameters.columns.value).sort();

  for(const node of nodes){
    assert.deepEqual(
      Object.keys(node.parameters.columns.value).sort(),
      expectedKeys,
      `${node.name} is missing one or more CRM field mappings`,
    );
  }
});
