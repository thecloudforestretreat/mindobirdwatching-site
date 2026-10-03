import { verifyIdentity } from '../_middleware.js';
import { validDate, previousPeriod, normalizeGA } from '../lib/maps.mjs';
import { normalizeDetails,normalizeCountryDaily } from '../lib/market-details.mjs';
const GA='https://n8n.mindobirdwatching.com/webhook/mbw-ga4-acquisition';
const OUTCOMES='https://n8n.mindobirdwatching.com/webhook/mbw-recorded-outcomes';
function reply(status,body){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});}
async function read(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(40000)});
  if(!response.ok){
    let stage='';try { const body=await response.json();if(['runtime','claims','identity_service','report'].includes(body.diagnostic))stage=' Authorization stage: '+body.diagnostic+'.'; } catch {}
    throw new Error('Reporting source is unavailable.'+stage);
  }return response.json();
}
export async function onRequestGet({request}) {
  const url=new URL(request.url),local=['localhost','127.0.0.1'].includes(url.hostname);
  if(url.hostname!=='admin.mindobirdwatching.com'&&!local)return reply(403,{ok:false,error:'Open this report through MBW Admin.'});
  if(!local){try{const email=await verifyIdentity(request.headers.get('Cf-Access-Jwt-Assertion'));if(email==='faustoandrade635@gmail.com')return reply(403,{ok:false,error:'This report requires administrator access.'});}catch{return reply(401,{ok:false,error:'Sign in through MBW Admin.'});}}
  const source=url.searchParams.get('source'),stage=url.searchParams.get('stage')||'confirmed',start=url.searchParams.get('start')||'',end=url.searchParams.get('end')||'';
  if(!['website','guests'].includes(source))return reply(400,{ok:false,error:'Choose a reporting source.'});
  if(!['confirmed','completed','current','upcoming','overdue','undated','prospects'].includes(stage))return reply(400,{ok:false,error:'Choose a valid guest stage.'});
  const comparison=url.searchParams.get('comparison')||'previous';let previous;
  try{if(source==='website'||start||end)previous=previousPeriod(start,end,comparison);}catch(error){return reply(400,{ok:false,error:error.message});}
  if(source==='website'&&end>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))return reply(400,{ok:false,error:'Website reporting cannot include future dates.'});
  try {
    if(source==='website') {
      const [current,prior,demand,currentDaily,priorDaily,priorDemand]=await Promise.all([read(GA+'?'+new URLSearchParams({start,end,view:'markets'})),read(GA+'?'+new URLSearchParams({...previous,view:'markets'})),read(OUTCOMES,{method:'POST',headers:{'Content-Type':'application/json','Cf-Access-Jwt-Assertion':request.headers.get('Cf-Access-Jwt-Assertion')||''},body:JSON.stringify({source,stage,start,end})}).then(payload=>{if(!payload.ok||payload.start!==start||payload.end!==end||payload.demand?.status!=='connected')throw new Error('Incomplete outcomes');return {...payload.demand,updated_at:payload.updated_at||null};}).catch(error=>({status:'unavailable',rows:[],reason:'Reconciled CRM / accounting outcomes unavailable; website reports remain available. '+error.message})),read(GA+'?'+new URLSearchParams({start,end,view:'country_daily'})).catch(()=>null),read(GA+'?'+new URLSearchParams({...previous,view:'country_daily'})).catch(()=>null),comparison==='year'?read(OUTCOMES,{method:'POST',headers:{'Content-Type':'application/json','Cf-Access-Jwt-Assertion':request.headers.get('Cf-Access-Jwt-Assertion')||''},body:JSON.stringify({source,stage,...previous})}).then(p=>{if(!p.ok||p.start!==previous.start||p.end!==previous.end||p.demand?.status!=='connected')throw new Error('Incomplete prior outcomes');return p.demand;}).catch(()=>({status:'unavailable',rows:[],timeline:[]})):Promise.resolve(null)]);
      return reply(200,{ok:true,source,start,end,previous,comparison,demand,priorDemand,exclusions:current.exclusions||[],...normalizeGA(current,start,end),details:{...normalizeDetails(current,start,end),country_daily:normalizeCountryDaily(currentDaily,start,end)},prior:{...normalizeGA(prior,previous.start,previous.end),details:{...normalizeDetails(prior,previous.start,previous.end),country_daily:normalizeCountryDaily(priorDaily,previous.start,previous.end)}}});
    }
    const payload=await read(OUTCOMES,{method:'POST',headers:{'Content-Type':'application/json','Cf-Access-Jwt-Assertion':request.headers.get('Cf-Access-Jwt-Assertion')||''},body:JSON.stringify({source,stage,start,end})});
    if(!payload.ok||payload.source!==source||payload.start!==start||payload.end!==end||!Array.isArray(payload.rows))throw new Error('Incomplete outcomes');
    return reply(200,{...payload,timeZone:'America/Guayaquil',countryBasis:'Booking contact country recorded in accounting invoices or CRM; not independently verified residence or each traveler’s country.'});
  }catch(error){return reply(502,{ok:false,error:'The reporting source could not provide a complete report. '+error.message});}
}
