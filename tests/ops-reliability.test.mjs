import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { onRequestGet, onRequestPost } from "../functions/api/admin/crm-save.js";
import { accountingExceptions, freshness } from "../functions/lib/accounting-integrity.mjs";

function db() {
  const rows = new Map();
  return {prepare(sql) {
    let bindings;
    const statement = {
      bind(...values) { bindings=values; return statement; },
      async run(){
        if(sql.startsWith("CREATE"))return {meta:{changes:0}};
        if(sql.startsWith("INSERT")){
          const [id,fingerprint,started_at]=bindings;
          if(rows.has(id))return {meta:{changes:0}};
          rows.set(id,{fingerprint,started_at});return {meta:{changes:1}};
        }
        if(sql.startsWith("UPDATE"))rows.get(bindings[1]).verified_at??=bindings[0];
      },
      async first(){return rows.get(bindings[0]);}
    };
    return statement;
  }};
}

test("CRM stores a single claim, returns the canonical record, and never rewrites on ambiguous or concurrent replies", async t => {
  const env = {MBW_PORTFOLIO_DB:db(),MBW_CRM_VERIFIED_SAVE_ENABLED:"true"};
  const url = "http://localhost/api/admin/crm-save";
  const record={inquiry_id:"INQ-TEST-GUARD",guest_id:"G-TEST",status:"quoted"};
  const body={action:"update_inquiry",request_id:"94f35bd6-db35-49d0-a402-5a29c44646dc",record};
  const submit=(payload=body, origin="http://localhost",bindings=env)=>onRequestPost({
    request:new Request(url,{method:"POST",headers:{"Content-Type":"application/json",Origin:origin},body:JSON.stringify(payload)}),env:bindings
  });
  const rows=new Map();
  let writes=0, failRead=false, duplicateRead=false, useOldRow=false, mismatch=false;
  t.mock.method(globalThis,"fetch",async (_url,{body:encoded})=>{
    const payload=JSON.parse(encoded.get("payload"));
    if(payload.action==="list_inquiries"){
      if(failRead)throw Error("timeout");
      const found=rows.get(payload.filters.inquiry_id), unrelated={inquiry_id:"INQ-UNRELATED"};
      return Response.json({ok:true,records:found?[unrelated,found,...(duplicateRead?[found]:[])]:[unrelated]});
    }
    writes++;
    rows.set(payload.record.inquiry_id,{...payload.record,updated_at:useOldRow?"2000-01-01T00:00:00Z":new Date().toISOString(),status:mismatch?"booked":payload.record.status,canonical_field:"stored"});
    throw Error("acknowledgment lost after write");
  });
  assert.equal((await submit(body,"http://another-site.test")).status,403);
  assert.equal((await submit({...body,action:"post_zelle_to_accounting"})).status,400);
  assert.equal((await submit(body,"http://localhost",{})).status,503);
  assert.equal((await submit(body,"http://localhost",{...env,MBW_PORTFOLIO_DB:null})).status,503);
  assert.equal(writes,0);
  const parallel=await Promise.all([submit(),submit()]);
  assert.equal(writes,1);
  const verified=await parallel.find(response=>response.ok).json();
  assert.equal(verified.record.canonical_field,"stored");
  assert.equal(verified.request_id,body.request_id);
  assert.equal(verified.inquiry_id,record.inquiry_id);
  assert.equal((await submit({...body,record:{...record,status:"booked"}})).status,409);
  assert.equal(writes,1);
  failRead=true;
  const next={...body,request_id:"f4deec75-b2f4-4e68-9f25-c17f0da20444"};
  assert.equal((await submit(next)).status,409);
  failRead=false;
  assert.equal((await submit(next)).status,200);
  assert.equal(writes,2);
  duplicateRead=true;
  assert.equal((await submit(next)).status,409);
  assert.equal(writes,2);
  duplicateRead=false;useOldRow=true;
  assert.equal((await submit({...body,request_id:"901f6118-db35-49d0-a402-5a29c44646dc"})).status,409);
  useOldRow=false;mismatch=true;
  assert.equal((await submit({...body,request_id:"191f6118-db35-49d0-a402-5a29c44646dc"})).status,409);
});

test("the guarded route stays off until the rollout flag is enabled and a store is present", async()=>{
  const request=new Request("http://localhost/api/admin/crm-save");
  assert.equal((await (await onRequestGet({request,env:{MBW_PORTFOLIO_DB:db()}})).json()).enabled,false);
  assert.equal((await (await onRequestGet({request,env:{MBW_PORTFOLIO_DB:db(),MBW_CRM_VERIFIED_SAVE_ENABLED:"true"}})).json()).enabled,true);
});

const now=Date.parse("2026-11-25T17:00:00Z"), today="2026-11-25";
const columns={
  invoices:["invoice_no","home_country","service_type","product_selected","tour_key","tour_guide","total_amount_owed_to_guide","amount_received"],
  expenses:["tour_key","expense_type","amount","expense_status"],
  guide_payment_queue:["tour_key","guide","payment_status","amount_due"]
};
const paid={invoice_no:"MBW-0900",tour_key:"service-1",date_paid:"11/24/2026",tour_date:"2026-11-27",product_selected:"MBW016",service_type:"Wildlife",home_country:"",tour_guide:"Guide",total_amount_owed_to_guide:"$20.00",amount_received:"$40",tour_completed:"No"};
const current=freshness("2026-11-25T16:45:00Z",now,45);
test("freshness distinguishes an idle or unknown timestamp from a late heartbeat",()=>{
  assert.equal(current.status,"current");
  assert.equal(freshness(null,now,45).status,"unknown");
  assert.equal(freshness("2026-11-25T16:00:00Z",now,45).status,"delayed");
  assert.equal(freshness("2026-11-25T18:00:00Z",now,45).status,"unknown");
});
test("the queue flags exact missing obligations, not Stripe fees or a different service on the same invoice",()=>{
  const result=accountingExceptions({invoices:[paid],expenses:[
    {...paid,expense_type:"Stripe Fee",amount:-1.6},
    {...paid,tour_key:"other-service",expense_type:"Guide Payout",amount:-20},
    {...paid,expense_type:"Guide Payout",amount:-20,expense_status:"Void"},
  ],guide_payment_queue:[]},columns,today,current,now);
  assert.deepEqual(result.counts,{missing_invoice_fields:1,missing_provider_expense:1,missing_guide_queue:1});
  assert.equal(result.issues[0].invoice,"MBW-0900");
});
test("the queue suppresses grace-period, void, deposit credit and intentional historical queue gaps",()=>{
  const past={...paid,home_country:"United States",tour_date:"2026-11-24",tour_completed:"Yes"};
  const result=accountingExceptions({
    invoices:[past,{...paid,tour_key:"void",booking_status:"Guest Cancelled"},{...paid,tour_key:"credit",amount_received:"-$100"},
      {...paid,tour_key:"new",date_paid:today,paid_at:"2026-11-25T16:54:00Z"},{...paid,tour_key:"deposit",product_selected:"DEP001"}],
    expenses:[{...past,expense_type:"Guide Payout",amount:"($20.00)",expense_status:"Pending"}],
  },columns,today,current,now);
  assert.equal(result.total,0);
});
test("a partial payout is compared using its original queue amount, not the remaining balance",()=>{
  const invoice={...paid,home_country:"United States"};
  const expenses=[{...invoice,expense_type:"Guide Payout",amount:-20,paid_to:"Guide"}];
  const queued={tour_key:invoice.tour_key,guide:"Guide",amount_due:20,remaining_due:5,payment_status:"Partially paid"};
  assert.equal(accountingExceptions({invoices:[invoice],expenses,guide_payment_queue:[queued]},columns,today,current,now).total,0);
  assert.equal(accountingExceptions({invoices:[invoice],expenses,guide_payment_queue:[{...queued,guide:"Different guide"}]},columns,today,current,now).counts.guide_queue_review,1);
});
test("prior snapshot contracts are partial and a stale snapshot never reports a clean review",()=>{
  assert.equal(accountingExceptions({invoices:[paid]},null,today,current,now).status,"partial");
  assert.equal(accountingExceptions({invoices:[paid]},columns,today,{status:"delayed"},now).status,"snapshot_not_current");
});
test("snapshot manifest preserves real column availability without changing ledger cells",async()=>{
  const source=await readFile(new URL("../deployment/multi-invoice-ledger/accounting-dashboard-source-v1.0.0.gs",import.meta.url),"utf8");
  const sandbox=vm.createContext({});
  vm.runInContext(source,sandbox);
  const data=[["invoice_no","service_type"],["MBW-0900","Wildlife"]];
  const fakeSheet={getLastRow:()=>2,getLastColumn:()=>2,getRange:(start,col,height,width)=>({
    getDisplayValues:()=>data.slice(start-1,start+height-1).map(row=>row.slice(col-1,col-1+width))
  })};
  const manifest={};
  const rows=sandbox.readAccountingDashboardTab_({getSheetByName:()=>fakeSheet},"invoices",["invoice_no","home_country","service_type"],manifest);
  assert.deepEqual(JSON.parse(JSON.stringify(manifest)),{invoices:["invoice_no","service_type"]});
  assert.equal(rows[0].home_country,"");
});
