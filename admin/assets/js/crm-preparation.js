/* Read-only preparation models. No persistence, network or messaging. */
(function(root){
  const clean=v=>String(v??'').trim();
  const day=v=>{const text=clean(v);return /^\d{4}-\d{2}-\d{2}$/.test(text)&&Number.isFinite(Date.parse(text+'T12:00:00Z'))&&new Date(text+'T12:00:00Z').toISOString().slice(0,10)===text?text:'';};
  const time=v=>{const text=clean(v),h24=text.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/);if(h24&&Number(h24[1])<24)return h24[1].padStart(2,'0')+':'+h24[2];const h12=text.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);return h12&&Number(h12[1])>=1&&Number(h12[1])<=12?String(Number(h12[1])%12+(/PM/i.test(h12[3])?12:0)).padStart(2,'0')+':'+h12[2]:'';};
  const closed=new Set(['cancelled','did_not_book','duplicate','spam']);
  function build({record,services,today,verified}){
    if(closed.has(record.status)||/^(yes|true|1|y)$/i.test(clean(record.is_archived)))return null;
    const knownLocation=v=>{const text=clean(v);return text&&!/^(unknown|unassigned|pending|tbd|to be confirmed|not set|n\/a|-)$/i.test(text)?text:'';};
    const chosen=services.filter(s=>s.selected||s.status==='completed').map(s=>{
      const pickup=knownLocation(s.pickup),dropoff=knownLocation(s.dropoff);
      const route=s.transport&&/^transportation$/i.test(clean(s.label))&&pickup&&dropoff&&pickup.toLowerCase()!==dropoff.toLowerCase();
      return {...s,label:route?'Transportation · '+pickup+' → '+dropoff:s.label,date:day(s.date),start:time(s.start),end:time(s.end)};
    });
    const order=(a,b)=>(day(a.date)||'9999').localeCompare(day(b.date)||'9999')||(a.start||'99:99').localeCompare(b.start||'99:99');
    const remaining=chosen.filter(s=>s.status!=='completed'&&!closed.has(s.status)&&(!day(s.date)||s.date>=today)).slice().sort(order);
    if(!remaining.length||!['booked','deposit_paid','completed'].includes(record.status))return null;
    const earlier=chosen.filter(s=>s.status==='completed'||(day(s.date)&&s.date<today)).slice().sort(order);
    const missing=[];
    if(!verified)missing.push('Refresh CRM to verify provider data');
    if(record.status==='completed')missing.push('Review booking status: a confirmed service is still ahead');
    if(!clean(record.assigned_to))missing.push('Assign a rep');
    if(!clean(record.phone_number))missing.push('Add guest phone');
    for(const s of remaining){
      const add=text=>missing.push((s.date||'Date needed')+' · '+s.label+': '+text);
      if(!day(s.date))add('Confirm tour date');
      if(!/^[1-9]\d*$/.test(clean(s.guests)))add('Confirm guest count');
      if(!s.label||/^(birding|birdwatching|activity|custom|other|service|specialty wildlife|transportation)$/i.test(s.label)||/needs review/i.test(s.label))add('Confirm service name');
      if(!knownLocation(s.pickup))add('Add pickup / meeting location');
      if(s.transport&&!knownLocation(s.dropoff))add('Add drop-off location');
      if(!s.flexible&&(!clean(s.start)||!clean(s.end)))add('Confirm start and end times');
      if(s.start&&s.end&&s.start>=s.end)add('Review start and end times');
      if(verified&&s.requiresProvider){
        if(!clean(s.providerName)||/^(unassigned|pending|tbd)$/i.test(clean(s.providerName))||!['assigned','confirmed','booked'].includes(s.providerStatus))add('Confirm guide / driver assignment');
        else{
          if(!clean(s.providerPhone))add('Add guide / driver contact');
          if(!s.providerInformed)add('Confirm provider informed');
        }
      }
    }
    const dates=remaining.map(s=>day(s.date)).filter(Boolean).sort();
    const first=dates[0]||'';
    const reminder=first?new Date(Date.parse(first+'T12:00:00Z')-2*86400000).toISOString().slice(0,10):'';
    const followup=day(record.followup_date);
    return {id:record.inquiry_id,guest:clean(record.full_name)||'Unnamed guest',rep:clean(record.assigned_to),remaining,earlier,missing:[...new Set(missing)],ready:verified&&!missing.length,reminderDate:reminder,followupDate:followup,urgency:!followup?'missing':followup<today?'overdue':followup===today?'today':'upcoming',lastContact:clean(record.last_contacted_at),payment:clean(record.payment_status)||'Not recorded',invoice:clean(record.invoice_no),quote:clean(record.quote_status)||'Not recorded'};
  }
  function queue(rows){return rows.filter(Boolean).sort((a,b)=>(a.reminderDate||'9999').localeCompare(b.reminderDate||'9999')||a.guest.localeCompare(b.guest));}
  function filter(rows,show,rep){return rows.filter(r=>(show==='all'||(show==='needs_details'?r.missing.length>0:r.urgency===show))&&(rep==='all'||(rep==='unassigned'?!r.rep:r.rep===rep)));}
  function message(model){
    const lines=['Hello '+model.guest+',','Here are your scheduled Mindo services:',''];
    for(const s of model.remaining){lines.push(s.label,'Date: '+(s.date||'To be confirmed'),'Start / pickup: '+(s.start||(s.flexible?'Flexible':'To be confirmed'))+' · End: '+(s.end||(s.flexible?'Flexible':'To be confirmed')),'Guests: '+(s.guests||'To be confirmed'),'Pickup / meeting: '+(s.pickup||'To be confirmed'));if(s.dropoff)lines.push('Drop-off: '+s.dropoff);if(s.providerName)lines.push('Guide / driver: '+s.providerName+(s.providerPhone?' · '+s.providerPhone:''));lines.push('');}
    lines.push('All times are local Mindo, Ecuador time.');return lines.join('\n');
  }
  root.MbwCrmPreparation={build,queue,filter,message};
})(typeof globalThis!=='undefined'?globalThis:window);
