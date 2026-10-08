import {verifyIdentity} from '../_middleware.js';
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export function ranges(days,now=new Date(),comparison="previous"){
 if(![7,28,90].includes(days))throw Error('Invalid period');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const shift=n=>new Date(Date.parse(today+'T00:00:00Z')-n*86400000).toISOString().slice(0,10);
 const period={start:shift(days+2),end:shift(3),priorStart:shift(2*days+2),priorEnd:shift(days+3)};
 if(comparison==='year'){const yearAgo=d=>{const [y,m,day]=d.split('-').map(Number);const last=new Date(Date.UTC(y-1,m,0)).getUTCDate();return new Date(Date.UTC(y-1,m-1,Math.min(day,last))).toISOString().slice(0,10)};period.priorStart=yearAgo(period.start);period.priorEnd=yearAgo(period.end)}
 return period;
}
export async function onRequestGet({request}){
 if(new URL(request.url).hostname!=='admin.mindobirdwatching.com')return reply(403,{ok:false,error:'Open through MBW Admin.'});
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 try{if(await verifyIdentity(token)==='faustoandrade635@gmail.com')return reply(403,{ok:false,error:'Administrator access required.'});}catch{return reply(401,{ok:false,error:'Sign in through MBW Admin.'});}
 const params=new URL(request.url).searchParams;const domain=params.get('site')||null;const allowed=['mindobirdwatching.com','thecloudforestretreat.com','experienceecuador.com','mindotours.com','chocoandinotours.com','experiencetheamazon.com','businessbuyingandselling.com','eyesondanang.com','arguellodentistry.com'];if(domain&&!allowed.includes(domain))return reply(400,{ok:false,error:'Choose a portfolio website.'});
 const comparison=params.get('compare')||'previous';if(!['previous','year'].includes(comparison))return reply(400,{ok:false,error:'Choose previous period or last year.'});
 let period;try{period=ranges(Number(params.get('days')||28),new Date(),comparison);}catch{return reply(400,{ok:false,error:'Choose 7, 28 or 90 days.'});}
 const headers={'Content-Type':'application/json','Cf-Access-Jwt-Assertion':token};
 const readBusiness=async(start,end)=>{try{
  const r=await fetch('https://n8n.mindobirdwatching.com/webhook/mbw-recorded-outcomes',{method:'POST',headers,body:JSON.stringify({source:'website',stage:'confirmed',start,end}),signal:AbortSignal.timeout(40000)});if(!r.ok)throw Error();const p=await r.json();if(!p.ok||p.start!==start||p.end!==end||p.demand?.status!=='connected'||!Array.isArray(p.demand.rows))throw Error();
  const pipeline=p.demand.pipeline;const fields=['cohort','contact','overdue','prospectOverdue','guestOverdue','quotes','payment','unscheduled','cancelled','missingDate','missingQuoteDate','missingContactDate','responseRecorded','responseHoursTotal','responseMissing'];
  const followup=pipeline?.status==='connected'&&pipeline.queueVersion>=2&&Array.isArray(pipeline.rows)?{status:'connected',asOf:pipeline.asOf,start:pipeline.start,end:pipeline.end,queueVersion:pipeline.queueVersion,counts:Object.fromEntries(fields.map(k=>[k,pipeline.rows.reduce((n,row)=>n+(Number.isFinite(row[k])&&row[k]>=0?row[k]:0),0)]))}:{status:'unavailable'};
  const sum=k=>p.demand.rows.reduce((n,r)=>n+(Number.isFinite(r[k])?r[k]:0),0);
  return {status:'connected',followup,inquiries:sum('inquiries'),confirmed:sum('confirmed'),completedTours:sum('completedTours'),missingCreatedDates:p.demand.missingCreatedDates,missingCompletedDates:p.demand.missingCompletedDates,excluded:p.demand.excluded,duplicates:p.demand.duplicates,reconciliation:p.demand.reconciliation,definitions:p.demand.definitions,updatedAt:p.updated_at};
 }catch{return {status:'unavailable'}}};
 const inspection=params.get('inspect')==='1';let pages=[];if(inspection){if(!domain)return reply(400,{ok:false,error:'Choose a website.'});try{pages=JSON.parse(params.get('pages')||'[]');if(!Array.isArray(pages)||pages.length<1||pages.length>3)throw Error();pages=pages.map(value=>{const u=new URL(value);if(u.protocol!=='https:'||![domain,'www.'+domain].includes(u.hostname)||u.username||u.password||u.port||u.search||u.hash||u.pathname.length>300||/^\/(?:[a-z]{2}\/)?(?:testing[0-9]*|admin|preview|staging|qa)(?:\/|$)/i.test(u.pathname))throw Error();return u.href;});}catch{return reply(400,{ok:false,error:'Choose up to three public pages on this website.'});}}
 const business=domain?Promise.resolve(null):Promise.all([readBusiness(period.start,period.end),readBusiness(period.priorStart,period.priorEnd)]).then(([current,prior])=>({...current,prior}));
 try{const r=await fetch('https://n8n.mindobirdwatching.com/webhook/mbw-portfolio-report',{method:'POST',headers,body:JSON.stringify({...period,domain,includeTests:params.get('tests')==='include',mode:inspection?'inspection':undefined,pages:inspection?pages:undefined}),signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error();const p=await r.json();if(!p.ok||p.start!==period.start||p.end!==period.end||!Array.isArray(p.sites))throw Error();if(!domain)p.business=await business;p.comparison=comparison;return reply(200,p);}catch{return reply(503,{ok:false,error:'Portfolio reporting feed is unavailable. No snapshot or estimated totals are displayed.'});}
}
