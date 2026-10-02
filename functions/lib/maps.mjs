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
export function country(value) {
  const input = String(value || '').trim();
  const code = aliases.get(input.toLowerCase());
  return code ? {code, country:names.of(code)} : {code:'', country:input && !['(not set)','unknown','n/a','-'].includes(input.toLowerCase()) ? 'Unmapped country' : 'Unknown country'};
}
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
}
export function previousPeriod(start,end) {
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('Choose a valid date range.');
  const days=(Date.parse(end)-Date.parse(start))/86400000+1;
  if (days>366) throw new Error('Choose a date range of 366 days or fewer.');
  return {start:new Date(Date.parse(start)-days*86400000).toISOString().slice(0,10), end:new Date(Date.parse(start)-86400000).toISOString().slice(0,10)};
}
export function extractRecords(payload) {
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
export function guestStage(row,today) {
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
export function aggregateGuests(records,{stage='confirmed',start='',end='',today}) {
  const groups=new Map(),seen=new Set(); let excluded=0,duplicates=0,missingDates=0,missingGuestCounts=0,missingTrendDates=0;
  const stages={completed:0,current:0,upcoming:0,overdue:0,undated:0,prospects:0};
  for (const row of records) {
    const id=row.inquiry_id||row.booking_id||row.source_record_id||(row.source_tab&&row.source_row ? row.source_tab+':'+row.source_row : '');
    if(id&&seen.has(id)){duplicates++;continue;} if(id)seen.add(id);
    const actual=guestStage(row,today);if(actual==='excluded'){excluded++;continue;}
    stages[actual]++;
    if (stage==='confirmed'?actual==='prospects':actual!==stage) continue;
    const date=dateOnly(row.confirmed_date||row.requested_date_start||row.requested_date||(actual==='completed'?row.completed_date:''));
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
export function normalizeGA(payload,start,end) {
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
