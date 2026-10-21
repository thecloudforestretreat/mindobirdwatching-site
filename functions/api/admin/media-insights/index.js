const ADMIN_ORIGIN="https://admin.mindobirdwatching.com";
const PERIODS=new Set(["7d","28d","90d"]);
function headers(request){const origin=request.headers.get("origin")||"";return{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":origin===ADMIN_ORIGIN?origin:ADMIN_ORIGIN,"access-control-allow-methods":"GET, OPTIONS","access-control-allow-headers":"content-type",vary:"Origin"}}
function json(request,body,status=200){return new Response(JSON.stringify(body),{status,headers:headers(request)})}
function emptyPlatform(){return{connected:false,metrics:{}}}
function unavailable(request,message){return json(request,{ok:true,configured:false,message,platforms:{instagram:emptyPlatform(),facebook:emptyPlatform(),youtube:emptyPlatform()}})}
export async function onRequestGet({request,env}){
  const webhook=String(env.N8N_ADMIN_MEDIA_INSIGHTS_WEBHOOK_URL||"").trim();
  if(!webhook)return unavailable(request,"Connect Meta Insights and YouTube Analytics with read-only access to load reach, engagement, watch time, and audience trends here.");
  const requested=new URL(request.url).searchParams.get("period")||"28d",period=PERIODS.has(requested)?requested:"28d";
  try{
    const response=await fetch(webhook,{method:"POST",headers:{"content-type":"application/json","x-mbw-request-id":"media_insights_"+crypto.randomUUID()},body:JSON.stringify({action:"media_insights",period,timezone:"America/New_York"}),signal:AbortSignal.timeout(30000)});
    const text=await response.text();
    if(!response.ok)throw new Error("Insights workflow returned "+response.status);
    const data=JSON.parse(text||"{}");
    return json(request,{ok:true,configured:true,period,updated_at:data.updated_at||new Date().toISOString(),platforms:{instagram:data.platforms?.instagram||emptyPlatform(),facebook:data.platforms?.facebook||emptyPlatform(),youtube:data.platforms?.youtube||emptyPlatform()}});
  }catch(error){console.error("Media insights unavailable",{message:error?.message});return unavailable(request,"Analytics connections are configured, but the reporting service is temporarily unavailable. Publishing is not affected.")}
}
export async function onRequestOptions({request}){const values=headers(request);delete values["content-type"];return new Response(null,{status:204,headers:values})}
