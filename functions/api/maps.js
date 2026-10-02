import { verifyIdentity } from '../_middleware.js';
import { validDate, previousPeriod, extractRecords, aggregateGuests, normalizeGA } from '../lib/maps.mjs';
import { aggregateDemand } from '../lib/demand.mjs';
import { normalizeDetails,normalizeCountryDaily } from '../lib/market-details.mjs';
const GA='https://n8n.mindobirdwatching.com/webhook/mbw-ga4-acquisition';
const CRM='https://n8n.mindobirdwatching.com/webhook/mbw-crm-admin-api';
function reply(status,body){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});}
async function read(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(40000)});
  if(!response.ok)throw new Error('Reporting source is unavailable.');return response.json();
}
export async function onRequestGet({request}) {
  const url=new URL(request.url),local=['localhost','127.0.0.1'].includes(url.hostname);
  if(url.hostname!=='admin.mindobirdwatching.com'&&!local)return reply(403,{ok:false,error:'Open this report through MBW Admin.'});
  if(!local){try{const email=await verifyIdentity(request.headers.get('Cf-Access-Jwt-Assertion'));if(email==='faustoandrade635@gmail.com')return reply(403,{ok:false,error:'This report requires administrator access.'});}catch{return reply(401,{ok:false,error:'Sign in through MBW Admin.'});}}
  const source=url.searchParams.get('source'),stage=url.searchParams.get('stage')||'confirmed',start=url.searchParams.get('start')||'',end=url.searchParams.get('end')||'';
  if(!['website','guests'].includes(source))return reply(400,{ok:false,error:'Choose a reporting source.'});
  if(!['confirmed','completed','current','upcoming','overdue','undated','prospects'].includes(stage))return reply(400,{ok:false,error:'Choose a valid guest stage.'});
  let previous;
  try{if(source==='website'||start||end)previous=previousPeriod(start,end);}catch(error){return reply(400,{ok:false,error:error.message});}
  if(source==='website'&&end>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))return reply(400,{ok:false,error:'Website reporting cannot include future dates.'});
  try {
    if(source==='website') {
      const [current,prior,demand,currentDaily,priorDaily]=await Promise.all([read(GA+'?'+new URLSearchParams({start,end,view:'markets'})),read(GA+'?'+new URLSearchParams({...previous,view:'markets'})),read(CRM,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'list_inquiries',filters:{}})}).then(payload=>aggregateDemand(extractRecords(payload),{start,end,today:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())})).catch(()=>({status:'unavailable',rows:[],reason:'CRM comparison unavailable; website reports remain available.'})),read(GA+'?'+new URLSearchParams({start,end,view:'country_daily'})).catch(()=>null),read(GA+'?'+new URLSearchParams({...previous,view:'country_daily'})).catch(()=>null)]);
      return reply(200,{ok:true,source,start,end,previous,demand,exclusions:current.exclusions||[],...normalizeGA(current,start,end),details:{...normalizeDetails(current,start,end),country_daily:normalizeCountryDaily(currentDaily,start,end)},prior:{...normalizeGA(prior,previous.start,previous.end),details:{...normalizeDetails(prior,previous.start,previous.end),country_daily:normalizeCountryDaily(priorDaily,previous.start,previous.end)}}});
    }
    const payload=await read(CRM,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'list_inquiries',filters:{}})});
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    return reply(200,{ok:true,source,start,end,stage,today,timeZone:'America/Guayaquil',updated_at:new Date().toISOString(),...aggregateGuests(extractRecords(payload),{stage,start,end,today})});
  }catch{return reply(502,{ok:false,error:'The reporting source could not provide a complete report. Try Refresh now or check the existing GA4 / CRM integration.'});}
}
