const names = new Intl.DisplayNames(['en'], { type: 'region' });
const aliases = new Map();
// Intl also recognizes retired codes; avoid letting DD claim Germany before DE.
const retired=new Set('AN BU CS DD DY FX HV NH NT QU RH SU TP UK VD YD YU ZR'.split(' '));
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = names.of(code);
  if (name !== code && !retired.has(code)) { if(!aliases.has(name.toLowerCase()))aliases.set(name.toLowerCase(), code); aliases.set(code.toLowerCase(), code); }
}
Object.entries({usa:'US',us:'US','united states of america':'US',uk:'GB','united kingdom':'GB',england:'GB',scotland:'GB',wales:'GB','great britain':'GB','czech republic':'CZ','south korea':'KR','north korea':'KP',russia:'RU',taiwan:'TW',vietnam:'VN',turkey:'TR','the netherlands':'NL','ivory coast':'CI','congo - kinshasa':'CD','congo - brazzaville':'CG'}).forEach(([name,code])=>aliases.set(name,code));
Object.entries({'hong kong':'HK',macao:'MO',macau:'MO',palestine:'PS','cape verde':'CV','swaziland':'SZ','east timor':'TL','republic of the congo':'CG','democratic republic of the congo':'CD','the bahamas':'BS'}).forEach(([name,code])=>aliases.set(name,code));
function country(value) {
  const input = String(value || '').trim();
  const code = aliases.get(input.toLowerCase());
  return code ? {code, country:names.of(code)} : {code:'', country:input && !['(not set)','unknown','n/a','-'].includes(input.toLowerCase()) ? 'Unmapped country' : 'Unknown country'};
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
}
function previousPeriod(start,end,comparison="previous") {
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('Choose a valid date range.');
  const days=(Date.parse(end)-Date.parse(start))/86400000+1;
  if (days>366) throw new Error('Choose a date range of 366 days or fewer.');
  if(!['previous','year'].includes(comparison))throw new Error('Choose a valid comparison.');
  if(comparison==='year'){const [y,m,d]=end.split('-').map(Number),lastDay=new Date(Date.UTC(y-1,m,0)).getUTCDate(),priorEnd=new Date(Date.UTC(y-1,m-1,Math.min(d,lastDay))).toISOString().slice(0,10);return {start:new Date(Date.parse(priorEnd)-(days-1)*86400000).toISOString().slice(0,10),end:priorEnd};}
  return {start:new Date(Date.parse(start)-days*86400000).toISOString().slice(0,10), end:new Date(Date.parse(start)-86400000).toISOString().slice(0,10)};
}
function extractRecords(payload) {
  if (payload?.ok===false) throw new Error('Guest reporting is unavailable.');
  if (payload?.body) return extractRecords(payload.body);
  if (payload?.has_more || payload?.next_cursor || payload?.next_page || payload?.truncated) throw new Error('Guest reporting returned an incomplete dataset.');
  const rows=Array.isArray(payload)?payload:payload?.records||payload?.rows||payload?.data||payload?.items;
  if (!Array.isArray(rows)) throw new Error('Guest reporting response was not recognized.');
  if (payload?.count!==undefined && Number(payload.count)!==rows.length) throw new Error('Guest reporting count does not match the returned records.');
  return rows.map(row=>row?.json||row);
}
const yes=value=>['yes','true','1'].includes(String(value||'').toLowerCase());
function dateOnly(value) { const date=String(value||'').slice(0,10);return validDate(date)?date:''; }
function guestStage(row,today) {
  const status=String(row.status||'').toLowerCase();
  if (yes(row.is_archived)||row.superseded_by_inquiry_id||['duplicate','cancelled','canceled','did_not_book','lost'].includes(status)) return 'excluded';
  if (status==='completed'||yes(row.tour_completed)) return 'completed';
  if (!['booked','deposit_paid','confirmed'].includes(status)) return 'prospects';
  const start=dateOnly(row.confirmed_date||row.requested_date_start||row.requested_date);
  const end=dateOnly(row.requested_date_end)||start;
  if (!start || end<start) return 'undated';
  if (start>today) return 'upcoming';
  if (end<today) return 'overdue';
  return 'current';
}
function aggregateGuests(records,{stage='confirmed',start='',end='',today}) {
  const groups=new Map(),seen=new Set(); let excluded=0,duplicates=0,missingDates=0,missingGuestCounts=0,missingTrendDates=0;
  const stages={completed:0,current:0,upcoming:0,overdue:0,undated:0,prospects:0};
  for (const row of records) {
    const id=row.inquiry_id||row.booking_id||row.source_record_id||(row.source_tab&&row.source_row ? row.source_tab+':'+row.source_row : '');
    if(id&&seen.has(id)){duplicates++;continue;} if(id)seen.add(id);
    const actual=guestStage(row,today);if(actual==='excluded'){excluded++;continue;}
    stages[actual]++;
    if (stage==='confirmed'?actual==='prospects':actual!==stage) continue;
    const date=dateOnly(actual==='completed'?(row.completed_date||row.confirmed_date||row.requested_date_start||row.requested_date):(row.confirmed_date||row.requested_date_start||row.requested_date));
    if (start && !date){missingDates++;continue;}
    if (start && (date<start||date>end)) continue;
    const loc=country(row.country||row.home_country||row.country_of_residence);
    const key=loc.code||loc.country;const group=groups.get(key)||{...loc,records:0,guests:0,missingGuestCounts:0,series:[]};
    group.records++;
    const value=String(row.guest_count||row.guest_count_text||'').trim();
    if(/^\d+$/.test(value)&&Number(value)>0&&Number(value)<=10000)group.guests+=Number(value);
    else {group.missingGuestCounts++;missingGuestCounts++;}
    if(date){let point=group.series.find(p=>p.date===date);if(!point){point={date,records:0,guests:0};group.series.push(point);}point.records++;if(/^\d+$/.test(value)&&Number(value)>0&&Number(value)<=10000)point.guests+=Number(value);}else missingTrendDates++;
    groups.set(key,group);
  }
  return {rows:[...groups.values()],stages,excluded,duplicates,missingDates,missingGuestCounts,missingTrendDates,countryBasis:'Booking contact country as recorded in CRM; not independently verified residence or each traveler’s country.'};
}
function normalizeGA(payload,start,end) {
  if (!payload?.ok||payload.start!==start||payload.end!==end||!Array.isArray(payload.reports?.countries?.rows)) throw new Error('GA4 did not return the requested country report.');
  const report=payload.reports.countries;
  if (report.truncated) throw new Error('GA4 country report is incomplete.');
  const seen=new Set();
  const rows=report.rows.map(row=>{
    const loc=country(row.country),key=loc.code||loc.country;
    if(seen.has(key))throw new Error('GA4 returned duplicate country groups.');seen.add(key);
    const out={...loc};
    for(const metric of ['sessions','totalUsers','engagedSessions']) {
      const value=row[metric];
      if(value===undefined||value===null||!Number.isFinite(Number(value))||Number(value)<0)throw new Error('GA4 is missing a required country metric.');
      out[metric]=Number(value);
    }
    out.engagementRate=out.sessions?out.engagedSessions/out.sessions:null;return out;
  });
  const metadata=report.metadata||{};
  return {rows,updated_at:payload.updated_at||null,timeZone:metadata.timeZone||'Unavailable',limited:Boolean(metadata.subjectToThresholding||metadata.dataLossFromOtherRow||metadata.samplingMetadatas?.length)};
}

const date=v=>{const raw=String(v||''),s=raw.slice(0,10);if(!validDate(s))return '';if(raw.includes('T')){const time=Date.parse(raw);return Number.isFinite(time)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time)):'';}return s;};
const size=r=>{const s=String(r.guest_count||r.guest_count_text||'').trim();return /^\d+$/.test(s)&&+s>0&&+s<=10000?+s:null;};
const identity=r=>{const email=String(r.email_normalized||r.email||'').trim().toLowerCase();if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return 'email:'+email;const id=String(r.guest_id||'').trim();return id&&!['unknown','n/a','none','null'].includes(id.toLowerCase())?'id:'+id:'';};
function aggregateDemand(records,{start,end,today}){
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

const {reconcileBookings,reconciledDemand}=(()=>{
const text=v=>String(v??'').trim();
const email=v=>{const s=text(v).toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:'';};
const date=v=>{const s=text(v).slice(0,10);return validDate(s)?s:'';};
const yes=v=>/^(yes|true|1)$/i.test(text(v));
const size=v=>/^\d+$/.test(text(v))&&+v>0&&+v<=10000?+v:null;
// A booking is not an invoice line, a traveler, or a contact. All matching stays server-side.
function reconcileBookings(crm,invoices,{today}) {
 const stats={invoiceRows:invoices.length,invoiceBookings:0,matchedInvoiceBookings:0,historicalInvoiceBookings:0,ambiguousMatches:0,missingInvoiceEmails:0,missingInvoiceDates:0,countryConflicts:0,guestCountConflicts:0,excludedServiceRows:0,crmOnlyCompleted:0};
 const groups=new Map();
 for(const r of invoices){
  const no=text(r.invoice_no),product=text(r.product_selected),service=text(r.service_type);
  if(!no)continue;
  if(/(REIMB|UPG)/i.test(no)||/^(TRANS|ACCOM)/i.test(product)||/^(transportation|transport|reimbursement|accommodation|tour upgrade)$/i.test(service)){stats.excludedServiceRows++;continue;}
  const mail=email(r.guest_email),id=text(r.booking_id),key=id?'id:'+id:mail?'legacy:'+mail+'|'+no:'invoice:'+no;
  const g=groups.get(key)||{key,no,email:mail,rows:[],ids:new Set(),inquiryIds:new Set()};
  g.rows.push(r);if(id)g.ids.add(id);if(text(r.inquiry_id))g.inquiryIds.add(text(r.inquiry_id));groups.set(key,g);
 }
 const clean=[],seen=new Set();for(const r of crm){const id=text(r.inquiry_id||r.booking_id||r.source_record_id);if(id&&seen.has(id))continue;if(id)seen.add(id);if(guestStage(r,today)!=='excluded')clean.push(r);}
 const matches=new Map(clean.map(r=>[r,[]]));
 for(const g of groups.values()){
  g.dates=[...new Set(g.rows.map(r=>date(r.tour_date)).filter(Boolean))].sort();
  g.complete=g.rows.every(r=>yes(r.tour_completed));g.completedDate=g.complete?g.dates.at(-1)||'':'';
  g.country=country(g.rows.find(r=>text(r.home_country))?.home_country);g.sizes=[...new Set(g.rows.map(r=>size(r.party_size)).filter(n=>n!==null))];
  if(!g.email)stats.missingInvoiceEmails++;if(g.rows.some(r=>!date(r.tour_date))){stats.missingInvoiceDates++;g.dates=[];g.completedDate='';}
  if(g.rows.some(r=>country(r.home_country).code!==g.country.code)){stats.countryConflicts++;g.country=country('');}
  if(g.sizes.length>1)stats.guestCountConflicts++;
  const strong=clean.filter(r=>(text(r.booking_id)&&g.ids.has(text(r.booking_id)))||(text(r.inquiry_id)&&g.inquiryIds.has(text(r.inquiry_id)))||(text(r.invoice_no)===g.no&&email(r.email_normalized||r.email)===g.email&&g.email));
  // Email can change or be missing. A recorded invoice reference plus matching
  // tour date and country identifies the same booking without guessing a contact.
  const invoiceRefs=clean.filter(r=>{
   if(text(r.invoice_no)!==g.no||!g.dates.length||!g.country.code||country(r.country||r.home_country).code!==g.country.code)return false;
   const first=date(r.confirmed_date||r.requested_date_start||r.requested_date||r.completed_date),last=date(r.requested_date_end)||first;
   return first&&last>=first&&g.dates.some(d=>d>=first&&d<=last);
  });
  const identified=[...new Set([...strong,...invoiceRefs])];
  g.candidates=identified.length?identified:clean.filter(r=>{if(!g.email||email(r.email_normalized||r.email)!==g.email)return false;const first=date(r.confirmed_date||r.requested_date_start||r.requested_date||r.completed_date),last=date(r.requested_date_end)||first;return first&&last>=first&&g.dates.some(d=>d>=first&&d<=last);});
  for(const r of g.candidates)matches.get(r).push(g);
 }
 const consumed=new Set(),uncertain=new Set(),records=[];
 for(const g of groups.values()){
  const candidates=g.candidates,ambiguous=candidates.length>1||candidates.some(r=>matches.get(r).length>1);
  if(ambiguous){stats.ambiguousMatches++;candidates.forEach(r=>uncertain.add(r));}
  const match=!ambiguous&&candidates.length===1?candidates[0]:null;
  if(match){consumed.add(match);stats.matchedInvoiceBookings++;}else if(!ambiguous)stats.historicalInvoiceBookings++;
  // Invoice completion is authoritative for matched trips, including an explicit No.
  const first=g.dates[0]||'',last=g.dates.at(-1)||'';
  records.push({...match,source_record_id:'accounting:'+g.key,inquiry_id:'',booking_id:'',country:g.country.country,home_country:g.country.country,email:g.email,guest_count:g.sizes.length===1?g.sizes[0]:'',guest_count_text:'',status:g.complete?'completed':'booked',tour_completed:g.complete?'Yes':'No',completed_date:g.completedDate,confirmed_date:first,requested_date_start:first,requested_date:first,requested_date_end:last,created_at:match?.created_at||'',completed_tour_days:g.complete?g.dates.length:0,invoice_history:true});
 }
 for(const r of clean){if(consumed.has(r)||uncertain.has(r))continue;records.push(r);if(guestStage(r,today)==='completed')stats.crmOnlyCompleted++;}
 stats.invoiceBookings=groups.size;
 return {records,stats};
}
function reconciledDemand(crm,reconciled,aggregateDemand,options){
 const demand=aggregateDemand(crm,options),outcomes=aggregateDemand(reconciled.records,options);
 for(const row of demand.rows)row.completedTours=0;
 demand.timeline=demand.timeline.map(r=>({...r,completedTours:0}));
 for(const r of outcomes.rows){let row=demand.rows.find(g=>(g.code||g.country)===(r.code||r.country));if(!row){row={...r};for(const k of Object.keys(row))if(typeof row[k]==='number')row[k]=0;demand.rows.push(row);}row.completedTours=r.completedTours;}
 for(const p of outcomes.timeline.filter(r=>r.completedTours)){let point=demand.timeline.find(r=>r.date===p.date&&(r.code||r.country)===(p.code||p.country));if(!point){point={...p,inquiries:0,confirmed:0};demand.timeline.push(point);}point.completedTours=p.completedTours;}
 demand.missingCompletedDates=outcomes.missingCompletedDates;demand.reconciliation=reconciled.stats;
 demand.definitions.completed='Completed bookings reconciled from accounting invoices and CRM, counted once on the last recorded tour/completion date. Invoice service rows and multiple tour days do not create additional bookings. Ambiguous CRM matches are withheld from the combined total pending review; invoice bookings remain counted. Transportation, lodging, standalone upgrades and reimbursement rows are excluded.';
 return demand;
}

return {reconcileBookings,reconciledDemand};})();
const {aggregateFollowup}=(()=>{
const canonical=v=>String(v||'').trim().toLowerCase().replace(/[-\s]+/g,'_');
const yes=v=>/^(yes|true|1)$/i.test(String(v||''));
const day=v=>{const raw=String(v||'');if(!/^\d{4}-\d{2}-\d{2}(?:$|T| (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$)/.test(raw))return '';const d=raw.slice(0,10);if(!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)return '';if(!raw.includes('T'))return d;const t=Date.parse(raw);return Number.isFinite(t)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t)):'';};
const days=(a,b)=>(Date.parse(a)-Date.parse(b))/86400000;
const FOLLOWUP_CARDS=[
 ['contact','New inquiries needing contact','New status, at least 2 calendar days old, with no usable recorded contact date.'],
 ['prospectOverdue','Prospects needing follow-up','Open prospects with a follow-up date before the review day.'],
 ['guestOverdue','Booked guests needing attention','Booked, confirmed or deposit-paid guests with an overdue follow-up. Review service status and next action before contacting.'],
 ['quotes','Aging quotes','Open quoted inquiries at least 7 calendar days after quote sent, without newer recorded contact. Review the conversation before following up.'],
 ['payment','Payment status to review','Open inquiries explicitly marked payment/deposit pending, or booked with an unpaid status. This is not an outstanding balance.'],
 ['unscheduled','Follow-up date missing','Open prospects without a usable follow-up date.'],
 ['cancelled','Cancelled inquiries','Current cancelled status among inquiries created during this period; not cancellation events dated in this period.'],
 ['missingDate','Historical dates to review','Eligible CRM records without a usable creation date across all history, regardless of the selected period. Tour and invoice dates are not inquiry creation dates.']
];
function inquiryFlags(r,asOf){
 const status=canonical(r._source_status||r.status)||'new',payment=canonical(r._recorded_payment_status??r.payment_status),created=day(r.created_at),contact=day(r.last_contacted_at||r.first_response_at||r.first_contacted_at),quote=day(r.quote_sent_at),followup=day(r._recorded_followup_date??r.followup_date);
 const excluded=yes(r.is_archived)||r.superseded_by_inquiry_id||['duplicate','archived','superseded'].includes(status),cancelled=['cancelled','canceled'].includes(status),booked=['booked','confirmed','deposit_paid'].includes(status),closed=cancelled||['completed','did_not_book','lost','closed'].includes(status)||yes(r.tour_completed);
 const open=!excluded&&!closed;
 return {excluded,created,missingDate:!excluded&&!created,prospectOverdue:open&&!booked&&!!followup&&followup<asOf,guestOverdue:open&&booked&&!!followup&&followup<asOf,contact:open&&status==='new'&&!!created&&days(asOf,created)>=2&&!contact,overdue:open&&!!followup&&followup<asOf,quotes:open&&!booked&&(status==='quoted'||canonical(r.quote_status)==='sent')&&!!quote&&days(asOf,quote)>=7&&(!contact||contact<=quote),payment:open&&(['payment_pending','deposit_pending'].includes(status)||['payment_pending','deposit_pending','deposit_sent'].includes(payment)||(booked&&payment==='unpaid')),unscheduled:open&&!booked&&!followup,cancelled:!excluded&&cancelled,missingQuoteDate:open&&!booked&&(status==='quoted'||canonical(r.quote_status)==='sent')&&!quote,missingContactDate:open&&status==='new'&&!!String(r.last_contacted_at||'').trim()&&!contact};
}
function aggregateFollowup(records,{start,end,today}){
 if(!day(start)||!day(end)||start>end||!day(today))throw new Error('Invalid follow-up reporting dates.');
 const groups=new Map(),seen=new Set();let duplicates=0,excluded=0,missingCreatedDates=0;let recoveredCreatedDates=0;const history=new Map();
 for(const r of records){const id=r.inquiry_id||r.booking_id||r.source_record_id||(r.source_tab&&r.source_row?r.source_tab+':'+r.source_row:'');if(id&&seen.has(id)){duplicates++;continue;}if(id)seen.add(id);
  const f=inquiryFlags(r,today);if(f.excluded){excluded++;continue;}if(!f.created){missingCreatedDates++;const loc=country(r.country||r.home_country||r.country_of_residence),key=loc.code||loc.country;const g=history.get(key)||{...loc,missingDate:0};g.missingDate++;history.set(key,g);continue;}if(!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(String(r.created_at||'')))recoveredCreatedDates++;if(f.created<start||f.created>end)continue;
  const loc=country(r.country||r.home_country||r.country_of_residence),key=loc.code||loc.country,g=groups.get(key)||{...loc,cohort:0,contact:0,overdue:0,prospectOverdue:0,guestOverdue:0,missingDate:0,quotes:0,payment:0,unscheduled:0,cancelled:0,missingQuoteDate:0,missingContactDate:0,responseRecorded:0,responseHoursTotal:0,responseMissing:0};g.cohort++;
  for(const metric of [...FOLLOWUP_CARDS.map(c=>c[0]),'overdue','missingQuoteDate','missingContactDate'])if(f[metric])g[metric]++;
  const first=r.first_response_at||r.first_contacted_at,created=String(r.created_at||''),hours=(Date.parse(first)-Date.parse(created))/3600000;
  // A last-contact date is never substituted for the first response.
  if(String(first||'').includes('T')&&created.includes('T')&&day(first)&&Number.isFinite(hours)&&hours>=0&&day(first)<=today){g.responseRecorded++;g.responseHoursTotal+=hours;}else g.responseMissing++;
  groups.set(key,g);
 }
 for(const [key,h] of history){const g=groups.get(key)||{...h,cohort:0};g.missingDate=h.missingDate;groups.set(key,g);}
 return {status:'connected',queueVersion:2,start,end,asOf:today,rows:[...groups.values()],duplicates,excluded,missingCreatedDates,recoveredCreatedDates};
}
function followupFilter(params){
 const review=params.get('review'),start=params.get('start'),end=params.get('end'),asOf=params.get('asOf'),market=params.get('market')||'',audience=params.get('audience')||'all',countries=(params.get('countries')||'').split(',').filter(Boolean);
 if(!(review==='overdue'||FOLLOWUP_CARDS.some(c=>c[0]===review))||!day(start)||!day(end)||start>end||!day(asOf)||!['all','domestic','international'].includes(audience))return null;
 return r=>{const f=inquiryFlags(r,asOf),loc=country(r.country||r.home_country||r.country_of_residence);return !!f[review]&&(review==='missingDate'||(f.created>=start&&f.created<=end))&&(!market||(country(market).code?loc.code===country(market).code:loc.country===market))&&(!countries.length||countries.includes(loc.code))&&(audience==='all'||(audience==='domestic'?loc.code==='EC':!!loc.code&&loc.code!=='EC'));};
}

return {aggregateFollowup};})();
const options=$('Authorize Administrator').first().json;
const crm=$('Collect CRM Bookings').first().json.records;
const invoices=$input.all().map(i=>i.json).filter(r=>r.invoice_no);
const reconciled=reconcileBookings(crm,invoices,options);
const result=options.source==='website'?{demand:{...reconciledDemand(crm,reconciled,aggregateDemand,options),pipeline:aggregateFollowup(crm,options)}}:aggregateGuests(reconciled.records,options);
return [{json:{ok:true,source:options.source,start:options.start,end:options.end,stage:options.stage,today:options.today,updated_at:new Date().toISOString(),reconciliation:reconciled.stats,...result}}];