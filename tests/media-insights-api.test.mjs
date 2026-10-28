import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet} from "../functions/api/admin/media-insights/index.js";

test("media insights proxy preserves measured patterns and validated AI guidance",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({
    updated_at:"2026-10-22T22:18:32Z",
    post_results:[{content_id:"one",tags:[{key:"species:toucan",label:"Toucan",category:"species"}]}],
    observed_patterns:[{id:"format:carousel",metric:"views_or_reach",sample_size:8}],
    ai_guidance:{available:true,metric:"result",items:[{evidence_id:"format:carousel",interpretation:"Measured interpretation",experiment:"Controlled experiment"}]},
    data_health:{stale:false,platforms:{}},
    platforms:{instagram:{connected:true,metrics:{reach:288}}},
  }),{status:200,headers:{"content-type":"application/json"}});
  try{
    const request=new Request("https://mindobirdwatching.com/api/admin/media-insights?period=28d",{headers:{origin:"https://admin.mindobirdwatching.com"}});
    const response=await onRequestGet({request,env:{N8N_ADMIN_MEDIA_INSIGHTS_WEBHOOK_URL:"https://example.test/insights"}});
    const body=await response.json();
    assert.equal(body.observed_patterns[0].id,"format:carousel");
    assert.equal(body.ai_guidance.metric,"result");
    assert.equal(body.post_results[0].tags[0].label,"Toucan");
  }finally{globalThis.fetch=original}
});

test("media insights proxy allows the analytics workflow to complete",async()=>{
  const original=globalThis.fetch;
  let timeout;
  globalThis.fetch=async(_url,options)=>{timeout=options.signal;return new Response("{}",{status:200})};
  try{
    const request=new Request("https://mindobirdwatching.com/api/admin/media-insights?period=28d");
    await onRequestGet({request,env:{N8N_ADMIN_MEDIA_INSIGHTS_WEBHOOK_URL:"https://example.test/insights"}});
    assert.ok(timeout instanceof AbortSignal);
    assert.equal(timeout.aborted,false);
  }finally{globalThis.fetch=original}
});
