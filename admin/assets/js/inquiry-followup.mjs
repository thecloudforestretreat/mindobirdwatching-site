import {country} from './market-country.mjs';
const canonical=v=>String(v||'').trim().toLowerCase().replace(/[-\s]+/g,'_');
const yes=v=>/^(yes|true|1)$/i.test(String(v||''));
const day=v=>{const raw=String(v||'');if(!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(raw))return '';const d=raw.slice(0,10);if(!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)return '';if(!raw.includes('T'))return d;const t=Date.parse(raw);return Number.isFinite(t)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t)):'';};
const days=(a,b)=>(Date.parse(a)-Date.parse(b))/86400000;
export const FOLLOWUP_CARDS=[
 ['contact','New inquiries needing contact','New status, at least 2 calendar days old, with no usable recorded contact date.'],
 ['overdue','Overdue follow-ups','Open inquiries with a follow-up date before the review day.'],
 ['quotes','Aging quotes','Open quoted inquiries at least 7 calendar days after quote sent, without newer recorded contact. Review the conversation before following up.'],
 ['payment','Payment status to review','Open inquiries explicitly marked payment/deposit pending, or booked with an unpaid status. This is not an outstanding balance.'],
 ['unscheduled','Follow-up date missing','Open prospects without a usable follow-up date.'],
 ['cancelled','Cancelled inquiries','Current cancelled status among inquiries created during this period; not cancellation events dated in this period.']
];
export function inquiryFlags(r,asOf){
 const status=canonical(r._source_status||r.status)||'new',payment=canonical(r._recorded_payment_status??r.payment_status),created=day(r.created_at),contact=day(r.last_contacted_at||r.first_response_at||r.first_contacted_at),quote=day(r.quote_sent_at),followup=day(r._recorded_followup_date??r.followup_date);
 const excluded=yes(r.is_archived)||r.superseded_by_inquiry_id||['duplicate','archived','superseded'].includes(status),cancelled=['cancelled','canceled'].includes(status),booked=['booked','confirmed','deposit_paid'].includes(status),closed=cancelled||['completed','did_not_book','lost','closed'].includes(status)||yes(r.tour_completed);
 const open=!excluded&&!closed;
 return {excluded,created,contact:open&&status==='new'&&!!created&&days(asOf,created)>=2&&!contact,overdue:open&&!!followup&&followup<asOf,quotes:open&&!booked&&(status==='quoted'||canonical(r.quote_status)==='sent')&&!!quote&&days(asOf,quote)>=7&&(!contact||contact<=quote),payment:open&&(['payment_pending','deposit_pending'].includes(status)||['payment_pending','deposit_pending','deposit_sent'].includes(payment)||(booked&&payment==='unpaid')),unscheduled:open&&!booked&&!followup,cancelled:!excluded&&cancelled,missingQuoteDate:open&&!booked&&(status==='quoted'||canonical(r.quote_status)==='sent')&&!quote,missingContactDate:open&&status==='new'&&!!String(r.last_contacted_at||'').trim()&&!contact};
}
export function aggregateFollowup(records,{start,end,today}){
 if(!day(start)||!day(end)||start>end||!day(today))throw new Error('Invalid follow-up reporting dates.');
 const groups=new Map(),seen=new Set();let duplicates=0,excluded=0,missingCreatedDates=0;
 for(const r of records){const id=r.inquiry_id||r.booking_id||r.source_record_id||(r.source_tab&&r.source_row?r.source_tab+':'+r.source_row:'');if(id&&seen.has(id)){duplicates++;continue;}if(id)seen.add(id);
  const f=inquiryFlags(r,today);if(f.excluded){excluded++;continue;}if(!f.created){missingCreatedDates++;continue;}if(f.created<start||f.created>end)continue;
  const loc=country(r.country||r.home_country||r.country_of_residence),key=loc.code||loc.country,g=groups.get(key)||{...loc,cohort:0,contact:0,overdue:0,quotes:0,payment:0,unscheduled:0,cancelled:0,missingQuoteDate:0,missingContactDate:0,responseRecorded:0,responseHoursTotal:0,responseMissing:0};g.cohort++;
  for(const metric of [...FOLLOWUP_CARDS.map(c=>c[0]),'missingQuoteDate','missingContactDate'])if(f[metric])g[metric]++;
  const first=r.first_response_at||r.first_contacted_at,created=String(r.created_at||''),hours=(Date.parse(first)-Date.parse(created))/3600000;
  // A last-contact date is never substituted for the first response.
  if(String(first||'').includes('T')&&created.includes('T')&&day(first)&&Number.isFinite(hours)&&hours>=0&&day(first)<=today){g.responseRecorded++;g.responseHoursTotal+=hours;}else g.responseMissing++;
  groups.set(key,g);
 }
 return {status:'connected',start,end,asOf:today,rows:[...groups.values()],duplicates,excluded,missingCreatedDates};
}
export function followupFilter(params){
 const review=params.get('review'),start=params.get('start'),end=params.get('end'),asOf=params.get('asOf'),market=params.get('market')||'',audience=params.get('audience')||'all',countries=(params.get('countries')||'').split(',').filter(Boolean);
 if(!FOLLOWUP_CARDS.some(c=>c[0]===review)||!day(start)||!day(end)||start>end||!day(asOf)||!['all','domestic','international'].includes(audience))return null;
 return r=>{const f=inquiryFlags(r,asOf),loc=country(r.country||r.home_country||r.country_of_residence);return !!f[review]&&f.created>=start&&f.created<=end&&(!market||(country(market).code?loc.code===country(market).code:loc.country===market))&&(!countries.length||countries.includes(loc.code))&&(audience==='all'||(audience==='domestic'?loc.code==='EC':!!loc.code&&loc.code!=='EC'));};
}
