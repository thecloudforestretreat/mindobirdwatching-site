const ADMIN_ORIGIN="https://admin.mindobirdwatching.com";
const PERIODS=new Set(["7d","28d","90d"]);
function headers(request){const origin=request.headers.get("origin")||"";return{"content-type":"application/json; charset=utf-8","cache-control":"no-store","access-control-allow-origin":origin===ADMIN_ORIGIN?origin:ADMIN_ORIGIN,"access-control-allow-methods":"GET, OPTIONS","access-control-allow-headers":"content-type",vary:"Origin"}}
function json(request,body,status=200){return new Response(JSON.stringify(body),{status,headers:headers(request)})}
function emptyPlatform(){return{connected:false,metrics:{}}}
function unavailable(request,message){return json(request,{ok:true,configured:false,message,summary:{},series:[],top_posts:[],post_results:[],observed_patterns:[],ai_guidance:{available:false,items:[]},youtube_retention:{available:false},data_health:{stale:true,note:message,platforms:{}},recommendations:{configured:false,timezone:"America/New_York",sample_size:0,slots:[]},platforms:{instagram:emptyPlatform(),facebook:emptyPlatform(),youtube:emptyPlatform()}})}
export async function onRequestGet({request,env}){
  const webhook=String(env.N8N_ADMIN_MEDIA_INSIGHTS_WEBHOOK_URL||env.N8N_ADMIN_SOCIAL_ANALYTICS_WEBHOOK_URL||"https://n8n.mindobirdwatching.com/webhook/mbw-media-insights-v5").trim();
  if(!webhook)return unavailable(request,"Existing n8n reporting covers Meta ads and website/SEO. Connect an organic Meta Insights and YouTube Analytics collector to add post-level reach, engagement, saves, shares, and watch-time trends here.");
  const requested=new URL(request.url).searchParams.get("period")||"28d",period=PERIODS.has(requested)?requested:"28d";
  try{
    const response=await fetch(webhook,{method:"POST",headers:{"content-type":"application/json","x-mbw-request-id":"media_insights_"+crypto.randomUUID()},body:JSON.stringify({action:"media_insights",period,timezone:"America/New_York"}),signal:AbortSignal.timeout(45000)});
    const text=await response.text();
    if(!response.ok)throw new Error("Insights workflow returned "+response.status);
    const data=JSON.parse(text||"{}");
    const recommendations=data.recommendations||data.posting_recommendations||data.best_times;
    return json(request,{ok:true,configured:true,period,updated_at:data.updated_at||new Date().toISOString(),summary:data.summary||{},series:Array.isArray(data.series)?data.series:Array.isArray(data.trend)?data.trend:[],top_posts:Array.isArray(data.top_posts)?data.top_posts:Array.isArray(data.topPosts)?data.topPosts:[],post_results:Array.isArray(data.post_results)?data.post_results:[],observed_patterns:Array.isArray(data.observed_patterns)?data.observed_patterns:[],ai_guidance:data.ai_guidance&&typeof data.ai_guidance==="object"?data.ai_guidance:{available:false,items:[]},youtube_retention:data.youtube_retention||{available:false},data_health:data.data_health||{stale:true,note:"Data-health details were not returned.",platforms:{}},content_types:data.content_types||{},sources:Array.isArray(data.sources)?data.sources:[],recommendations:recommendations&&typeof recommendations==="object"?recommendations:{configured:false,timezone:"America/New_York",sample_size:0,slots:[]},platforms:{instagram:data.platforms?.instagram||emptyPlatform(),facebook:data.platforms?.facebook||emptyPlatform(),youtube:data.platforms?.youtube||emptyPlatform()}});
  }catch(error){console.error("Media insights unavailable",{message:error?.message});return unavailable(request,"Analytics connections are configured, but the reporting service is temporarily unavailable. Publishing is not affected.")}
}
export async function onRequestOptions({request}){const values=headers(request);delete values["content-type"];return new Response(null,{status:204,headers:values})}
