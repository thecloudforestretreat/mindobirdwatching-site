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
