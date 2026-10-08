import {verifyIdentity} from '../_middleware.js';
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export function ranges(days,now=new Date()){
 if(![7,28,90].includes(days))throw Error('Invalid period');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const shift=n=>new Date(Date.parse(today+'T00:00:00Z')-n*86400000).toISOString().slice(0,10);
 return {start:shift(days+2),end:shift(3),priorStart:shift(2*days+2),priorEnd:shift(days+3)};
}
export async function onRequestGet({request}){
 if(new URL(request.url).hostname!=='admin.mindobirdwatching.com')return reply(403,{ok:false,error:'Open through MBW Admin.'});
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 try{if(await verifyIdentity(token)==='faustoandrade635@gmail.com')return reply(403,{ok:false,error:'Administrator access required.'});}catch{return reply(401,{ok:false,error:'Sign in through MBW Admin.'});}
 const params=new URL(request.url).searchParams;const domain=params.get('site')||null;const allowed=['mindobirdwatching.com','thecloudforestretreat.com','experienceecuador.com','mindotours.com','chocoandinotours.com','experiencetheamazon.com','businessbuyingandselling.com','eyesondanang.com','arguellodentistry.com'];if(domain&&!allowed.includes(domain))return reply(400,{ok:false,error:'Choose a portfolio website.'});
 let period;try{period=ranges(Number(params.get('days')||28));}catch{return reply(400,{ok:false,error:'Choose 7, 28 or 90 days.'});}
 const headers={'Content-Type':'application/json','Cf-Access-Jwt-Assertion':token};
 const readBusiness=async(start,end)=>{try{
  const r=await fetch('https://n8n.mindobirdwatching.com/webhook/mbw-recorded-outcomes',{method:'POST',headers,body:JSON.stringify({source:'website',stage:'confirmed',start,end}),signal:AbortSignal.timeout(40000)});if(!r.ok)throw Error();const p=await r.json();if(!p.ok||p.start!==start||p.end!==end||p.demand?.status!=='connected'||!Array.isArray(p.demand.rows))throw Error();
  const sum=k=>p.demand.rows.reduce((n,r)=>n+(Number.isFinite(r[k])?r[k]:0),0);
  return {status:'connected',inquiries:sum('inquiries'),confirmed:sum('confirmed'),completedTours:sum('completedTours'),missingCreatedDates:p.demand.missingCreatedDates,missingCompletedDates:p.demand.missingCompletedDates,excluded:p.demand.excluded,duplicates:p.demand.duplicates,reconciliation:p.demand.reconciliation,definitions:p.demand.definitions,updatedAt:p.updated_at};
 }catch{return {status:'unavailable'}}};
 const business=domain?Promise.resolve(null):Promise.all([readBusiness(period.start,period.end),readBusiness(period.priorStart,period.priorEnd)]).then(([current,prior])=>({...current,prior}));
 try{const r=await fetch('https://n8n.mindobirdwatching.com/webhook/mbw-portfolio-report',{method:'POST',headers,body:JSON.stringify({...period,domain,includeTests:params.get('tests')==='include'}),signal:AbortSignal.timeout(55000)});if(!r.ok)throw Error();const p=await r.json();if(!p.ok||p.start!==period.start||p.end!==period.end||!Array.isArray(p.sites))throw Error();if(!domain)p.business=await business;return reply(200,p);}catch{return reply(503,{ok:false,error:'Portfolio reporting feed is unavailable. No snapshot or estimated totals are displayed.'});}
}
