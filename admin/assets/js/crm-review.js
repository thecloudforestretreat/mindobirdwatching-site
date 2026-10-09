/* Read-only review models. No persistence, network, or messaging. */
(function(root){
  const clean=value=>String(value??'').trim();
  const closed=status=>['completed','cancelled','did_not_book','duplicate'].includes(clean(status).toLowerCase());
  const day=value=>{const text=clean(value);if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;if(!text||!Number.isFinite(Date.parse(text)))return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(text));};
  const plus=(date,count)=>new Date(Date.parse(date+'T12:00:00Z')+count*86400000).toISOString().slice(0,10);
  function suggestion(record,today,reminder,lastContact){
    if(closed(record.status)||/^(yes|true)$/i.test(clean(record.is_archived)))return null;
    if(clean(record.status).toLowerCase()==='booked')return reminder&& !['past','missing'].includes(reminder.kind)?{date:reminder.date<today?today:reminder.date,reason:'Review tour details two days before departure.'}:null;
    const tourDate=day(record.requested_date||record.requested_date_start);
    if(tourDate&&tourDate<today)return null;
    const reference=[day(lastContact),day(record.quote_sent_at),day(record.created_at)].filter(Boolean).sort().at(-1)||today;
    const quoted=record.quote_status==='sent'||record.status==='quoted';
    return {date:plus(reference,quoted?3:1)<today?today:plus(reference,quoted?3:1),reason:quoted?'Follow up three days after the latest contact or quote.':'Follow up one day after the latest contact.'};
  }
  function build(input){
    const {record,services=[],confirmation={missing:[],message:''},reminder,delivery={status:'pending'},assignments=[],operationsLoaded=false,today,lastContact='',lastContactChannel=''}=input;
    const missing=[...confirmation.missing];
    const serviceChecks=services.filter(s=>s.status==='booked').map(service=>{
      const label=service.label||service.product_selected||service.tour||'Service';
      const issues=[];
      const type=clean(service.service_type),code=clean(service.product_selected).split(' ')[0];
      const transport=type==='Transportation'||code.startsWith('TRANS');
      const needsProvider=transport||['Birdwatching','Specialty Wildlife','Night Walk'].includes(type)||code==='MBW016';
      const matching=assignments.filter(a=>a.inquiry_id===record.inquiry_id&&day(a.service_date)===day(service.date)&&!['cancelled','completed'].includes(clean(a.assignment_status).toLowerCase())&&(clean(a.service_item_id)===service.id||clean(a.internal_note).split('\n')[0]==='Service reference: '+service.id||(clean(a.product_selected).split(' ')[0]===code&&code)));
      const assigned=matching.filter(a=>clean(a.provider_name==='Other'?a.provider_name_other:a.provider_name)&&['confirmed','booked','assigned'].includes(clean(a.assignment_status).toLowerCase()));
      if(needsProvider&&(!day(service.date)||day(service.date)>=today)){
        if(!operationsLoaded)issues.push('Provider data has not been verified; refresh CRM');
        else if(!assigned.length)issues.push(transport?'Confirm driver assignment':'Confirm guide assignment');
        else if(!assigned.some(a=>clean(a.provider_informed).toLowerCase()==='yes'))issues.push('Notify provider');
      }
      for(const issue of issues)missing.push(label+': '+issue);
      return {label,past:!!day(service.date)&&day(service.date)<today,date:day(service.date),start:clean(service.start_time),guests:clean(service.guests),issues};
    });
    if(!operationsLoaded&&!missing.includes('Communication and assignment data has not been verified; refresh CRM'))missing.push('Communication and assignment data has not been verified; refresh CRM');
    if(!clean(record.assigned_to))missing.push('Assigned rep');
    serviceChecks.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.start||'99:99').localeCompare(b.start||'99:99'));
    const outstanding=[...new Set(missing)];
    const remainingDates=serviceChecks.map(s=>s.date).filter(date=>date&&date>=today).sort();
    const effectiveReminder=reminder?.kind==='past'&&remainingDates.length?{...reminder,tourDate:remainingDates[0],date:plus(remainingDates[0],-2),kind:'ready'}:reminder;
    const eligible=record.status==='booked'&&effectiveReminder&&!['past','missing'].includes(effectiveReminder.kind)&&!closed(record.status)&&!/^(yes|true)$/i.test(clean(record.is_archived));
    const sent=operationsLoaded&&delivery.status==='sent';
    return {
      guest:clean(record.full_name)||'Unnamed guest',rep:clean(record.assigned_to)||'Unassigned',status:clean(record.status)||'new',quote:clean(record.quote_status)||'Not recorded',payment:clean(record.payment_status)||'Not recorded',invoice:clean(record.invoice_no),guestCount:clean(record.guest_count),interest:clean(record.tour_type||record.tour_category),initialDate:day(record.requested_date||record.requested_date_start),services:serviceChecks,
      ready:eligible&&outstanding.length===0,missing:outstanding,eligible:!!eligible,sent,
      reminderDate:effectiveReminder?.date||'',tourDate:effectiveReminder?.tourDate||'',message:confirmation.message||'',
      lastContact:day(lastContact),lastContactChannel:clean(lastContactChannel),followupUrgency:!day(record.followup_date)?'missing':day(record.followup_date)<today?'overdue':day(record.followup_date)===today?'today':'future',followupDate:day(record.followup_date),suggestion:suggestion(record,today,effectiveReminder,lastContact),
      reviewState:!eligible?'Not scheduled':!operationsLoaded?'Data not verified':sent?'Already recorded sent':outstanding.length?'Needs details':'Details complete'
    };
  }
  function queue(items){return items.filter(item=>item.model.eligible&&!item.model.sent).sort((a,b)=>a.model.reminderDate.localeCompare(b.model.reminderDate)||a.model.guest.localeCompare(b.model.guest));}
  root.MbwCrmReview={build,queue,suggestion};
})(typeof globalThis!=='undefined'?globalThis:window);
