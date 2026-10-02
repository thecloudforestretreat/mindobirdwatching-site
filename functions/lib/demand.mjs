import {country,validDate,guestStage} from './maps.mjs';
const date=v=>{const raw=String(v||''),s=raw.slice(0,10);if(!validDate(s))return '';if(raw.includes('T')){const time=Date.parse(raw);return Number.isFinite(time)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time)):'';}return s;};
const size=r=>{const s=String(r.guest_count||r.guest_count_text||'').trim();return /^\d+$/.test(s)&&+s>0&&+s<=10000?+s:null;};
const identity=r=>{const email=String(r.email_normalized||r.email||'').trim().toLowerCase();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return 'email:'+email;const id=String(r.guest_id||'').trim();return id&&!['unknown','n/a','none','null'].includes(id.toLowerCase())?'id:'+id:'';};
export function aggregateDemand(records,{start,end,today}){
 const seen=new Set(),clean=[];let excluded=0,duplicates=0;
 for(const r of records){const id=r.inquiry_id||r.booking_id||r.source_record_id||(r.source_tab&&r.source_row?r.source_tab+':'+r.source_row:'');if(id&&seen.has(id)){duplicates++;continue;}if(id)seen.add(id);if(guestStage(r,today)==='excluded'){excluded++;continue;}clean.push(r);}
 const confirmed=clean.filter(r=>guestStage(r,today)!=='prospects'),contactCounts=new Map();
 for(const r of confirmed){const id=identity(r);if(id)contactCounts.set(id,(contactCounts.get(id)||0)+1);}
 const groups=new Map(),timeline=new Map();const tick=(loc,date,metric)=>{const k=(loc.code||loc.country)+"|"+date,out=timeline.get(k)||{...loc,date,inquiries:0,confirmed:0,completedTours:0};out[metric]++;timeline.set(k,out);};let missingCreatedDates=0,missingCompletedDates=0;
 for(const r of clean){const loc=country(r.country||r.home_country||r.country_of_residence),key=loc.code||loc.country,created=date(r.created_at),completed=guestStage(r,today)==='completed',tourDate=date(r.completed_date||r.confirmed_date||r.requested_date_start||r.requested_date);
  if(!created)missingCreatedDates++;if(completed&&!tourDate)missingCompletedDates++;
  const cohort=created&&created>=start&&created<=end,finished=completed&&tourDate&&tourDate>=start&&tourDate<=end;
  if(!cohort&&!finished)continue;
  const g=groups.get(key)||{...loc,inquiries:0,confirmed:0,completedTours:0,repeatContactBookings:0,identifiedBookings:0,recordedGuests:0,missingGroupSizes:0,lodgingRequested:0,lodgingUnknown:0,transportRequested:0,transportUnknown:0,durationUnknown:0,multiDayBookings:0,missingTourDates:0};
  if(finished){g.completedTours++;tick(loc,tourDate,"completedTours");}
  if(cohort){g.inquiries++;tick(loc,created,"inquiries");if(guestStage(r,today)!=='prospects'){
   g.confirmed++;tick(loc,created,"confirmed");const n=size(r);if(n===null)g.missingGroupSizes++;else g.recordedGuests+=n;
   const id=identity(r);if(id){g.identifiedBookings++;if(contactCounts.get(id)>1)g.repeatContactBookings++;}
   const lodging=String(r.accommodation_needs||'').trim().toLowerCase();if(/^(yes|true|1|needed|si|sí)$/.test(lodging))g.lodgingRequested++;else if(!/^(no|false|0|none|not needed|n\/a)$/.test(lodging))g.lodgingUnknown++;
   const transport=String(r.transportation_needed||'').trim().toLowerCase();if(/^(yes|true|1|si|sí)$/.test(transport))g.transportRequested++;else if(!/^(no|false|0|none|not needed|n\/a)$/.test(transport))g.transportUnknown++;
   const first=date(r.confirmed_date||r.requested_date_start||r.requested_date),last=date(r.requested_date_end);if(!first)g.missingTourDates++;if(!first||!last||last<first)g.durationUnknown++;else if(last>first)g.multiDayBookings++;
  }}groups.set(key,g);
 }
 return {status:'connected',start,end,rows:[...groups.values()],timeline:[...timeline.values()],missingCreatedDates,missingCompletedDates,excluded,duplicates,definitions:{cohort:'Inquiries created during this period, with their current recorded status. Bookings from these inquiries includes completed, upcoming, current and date-unverified confirmed records; counted on inquiry creation dates, not confirmation dates.',completed:'Completed-status tours with completion date, falling back to confirmed or requested tour start date.',repeat:'Confirmed records in this cohort sharing a recorded contact email or guest ID with another eligible confirmed booking in CRM history. This measures repeat contacts, not verified unique travelers.',partner:'Partner needs summarize confirmed records in the inquiry-created cohort. Lodging and transport require explicit yes values; free-text lodging responses remain unknown. Multi-day means scheduled end is after scheduled start.'}};
}
