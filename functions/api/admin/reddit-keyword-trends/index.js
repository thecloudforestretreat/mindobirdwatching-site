const ADMIN_ORIGIN="https://admin.mindobirdwatching.com";
function headers(request){const origin=request.headers.get("origin")||"";return{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":origin===ADMIN_ORIGIN?origin:ADMIN_ORIGIN,"access-control-allow-methods":"GET, OPTIONS","access-control-allow-headers":"content-type",vary:"Origin"}}
function json(request,body,status=200){return new Response(JSON.stringify(body),{status,headers:headers(request)})}
function unavailable(request,message){return json(request,{ok:true,configured:false,message,report_week_start:"",report_week_end:"",tracked_keywords:0,total_conversations:0,previous_total_conversations:0,has_previous_week:false,keywords:[],history:[],limitation:"Community-level opportunity requires Reddit Pro Trends or reviewed Reddit search results."})}
export async function onRequestGet({request,env}){
  const webhook=String(env.N8N_REDDIT_KEYWORD_TRENDS_WEBHOOK_URL||"https://n8n.mindobirdwatching.com/webhook/mbw-reddit-keyword-trends-v1").trim();
  if(!webhook)return unavailable(request,"Reddit keyword monitoring is not configured.");
  try{
    const response=await fetch(webhook,{method:"GET",headers:{"accept":"application/json","x-mbw-request-id":"reddit_keyword_trends_"+crypto.randomUUID()},signal:AbortSignal.timeout(20000)});
    const text=await response.text();
    if(!response.ok)throw new Error("Keyword workflow returned "+response.status);
    const data=JSON.parse(text||"{}");
    return json(request,{...data,ok:true,configured:data.configured!==false,updated_at:data.updated_at||new Date().toISOString()});
  }catch(error){console.error("Reddit keyword trends unavailable",{message:error?.message});return unavailable(request,"Reddit audience trends are temporarily unavailable. Post-performance analytics are unaffected.")}
}
export async function onRequestOptions({request}){const values=headers(request);delete values["content-type"];return new Response(null,{status:204,headers:values})}
