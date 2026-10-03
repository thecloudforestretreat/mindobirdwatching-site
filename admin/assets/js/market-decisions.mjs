import {country} from './market-country.mjs';
export function opportunities(rows,outcomes=[],connected=true){
 const evidence=new Map(outcomes.map(r=>[r.code||r.country,r]));
 return rows.filter(r=>r.code&&r.sessions>=20).map(r=>{
  const booking=evidence.get(r.code)||{},delta=r.sessions-(r.prior?.sessions||0),reasons=[];
  if(delta>0)reasons.push('Growing interest');
  if(r.engagementRate>=.7)reasons.push('Strong engagement');
  if(booking.confirmed>0)reasons.push('Recorded bookings');
  if(!reasons.length)return null;
  return {...r,confirmed:connected?(booking.confirmed||0):null,completedTours:connected?(booking.completedTours||0):null,delta,reasons,action:booking.confirmed>0?'Review guest needs and partner capacity':'Investigate tour-page interest and inquiry messaging'};
 }).filter(Boolean).sort((a,b)=>b.confirmed-a.confirmed||b.sessions-a.sessions||a.country.localeCompare(b.country)).slice(0,5);
}
export function monthlyEvidence(current,prior,currentTours=[],priorTours=[],{start,end,priorStart,priorEnd}={}){
 const buckets=(rows,key)=>{const out=new Map();for(const r of rows){const month=r.date?.slice(0,7);if(/^\d{4}-\d{2}$/.test(month))out.set(month,(out.get(month)||0)+(Number(r[key])||0));}return out;};
 const sessions=buckets(current,'sessions'),old=buckets(prior,'sessions'),tours=buckets(currentTours,'completedTours'),oldTours=buckets(priorTours,'completedTours');
 const months=new Set([...sessions.keys(),...tours.keys()]);if(start&&end){for(let d=start.slice(0,7)+'-01';d<=end;){months.add(d.slice(0,7));const next=new Date(d+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);d=next.toISOString().slice(0,10);}}
 return [...months].sort().map(month=>{const comparison=String(Number(month.slice(0,4))-1)+month.slice(4);return {month,comparison,sessions:sessions.get(month)||0,priorSessions:old.get(comparison)??(priorStart&&comparison>=priorStart.slice(0,7)&&comparison<=priorEnd.slice(0,7)?0:null),completed:tours.get(month)||0,priorCompleted:oldTours.get(comparison)??(priorStart&&comparison>=priorStart.slice(0,7)&&comparison<=priorEnd.slice(0,7)?0:null)};});
}
const dateInZone=value=>{const raw=String(value||''),date=raw.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return '';if(!raw.includes('T'))return date;const d=new Date(raw);return Number.isFinite(+d)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):'';};
export function reviewFilter(params){
 if(params.get('review')!=='lodging')return null;
 const start=params.get('start')||'',end=params.get('end')||'',market=params.get('market')||'',audience=params.get('audience')||'all',countries=(params.get('countries')||'').split(',').filter(Boolean);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||new Date(start).toISOString().slice(0,10)!==start||new Date(end).toISOString().slice(0,10)!==end||start>end)return null;
 return r=>{const status=String(r.status||'').toLowerCase(),created=dateInZone(r.created_at),location=country(r.country||r.home_country),domestic=location.code==='EC',lodging=String(r.accommodation_needs||r.accommodation_needed||'').trim().toLowerCase();return !['duplicate','cancelled','canceled','did_not_book','lost'].includes(status)&&(['booked','deposit_paid','confirmed','completed'].includes(status)||/^(yes|true|1)$/i.test(r.tour_completed||''))&&!['yes','true','1','needed','si','sí','no','false','0','none','not needed','n/a'].includes(lodging)&&!r.superseded_by_inquiry_id&&!/^(yes|true|1)$/i.test(r.is_archived||'')&&created>=start&&created<=end&&(!countries.length||countries.includes(location.code))&&(!market||(country(market).code?location.code===country(market).code:location.country===market))&&(audience==='all'||(audience==='domestic'?domestic:!!location.code&&!domestic));};
}
