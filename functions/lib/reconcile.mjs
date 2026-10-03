import {country,validDate,guestStage} from './maps.mjs';
const text=v=>String(v??'').trim();
const email=v=>{const s=text(v).toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)?s:'';};
const date=v=>{const s=text(v).slice(0,10);return validDate(s)?s:'';};
const yes=v=>/^(yes|true|1)$/i.test(text(v));
const size=v=>/^\d+$/.test(text(v))&&+v>0&&+v<=10000?+v:null;
// A booking is not an invoice line, a traveler, or a contact. All matching stays server-side.
export function reconcileBookings(crm,invoices,{today}) {
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
export function reconciledDemand(crm,reconciled,aggregateDemand,options){
 const demand=aggregateDemand(crm,options),outcomes=aggregateDemand(reconciled.records,options);
 for(const row of demand.rows)row.completedTours=0;
 demand.timeline=demand.timeline.map(r=>({...r,completedTours:0}));
 for(const r of outcomes.rows){let row=demand.rows.find(g=>(g.code||g.country)===(r.code||r.country));if(!row){row={...r};for(const k of Object.keys(row))if(typeof row[k]==='number')row[k]=0;demand.rows.push(row);}row.completedTours=r.completedTours;}
 for(const p of outcomes.timeline.filter(r=>r.completedTours)){let point=demand.timeline.find(r=>r.date===p.date&&(r.code||r.country)===(p.code||p.country));if(!point){point={...p,inquiries:0,confirmed:0};demand.timeline.push(point);}point.completedTours=p.completedTours;}
 demand.missingCompletedDates=outcomes.missingCompletedDates;demand.reconciliation=reconciled.stats;
 demand.definitions.completed='Completed bookings reconciled from accounting invoices and CRM, counted once on the last recorded tour/completion date. Invoice service rows and multiple tour days do not create additional bookings. Ambiguous CRM matches are withheld from the combined total pending review; invoice bookings remain counted. Transportation, lodging, standalone upgrades and reimbursement rows are excluded.';
 return demand;
}
