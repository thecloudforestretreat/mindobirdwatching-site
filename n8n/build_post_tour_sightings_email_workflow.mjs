import fs from 'node:fs';
import path from 'node:path';

const OUTPUT = path.resolve('n8n/generated/MBW - Post-Tour Sightings Email - APPROVAL.json');
const CRM_SHEET = '1rdPmYmhCehx_3bI737dkg8NyiutwIu3NAav7B-mbwlw';
const SIGHTINGS_SHEET = '1G5zS888jH7pQMN9x1iZf4DhwnZ77wTrBencbuvmHIRk';
const QUEUE_GID = 804829256;
const GOOGLE_SHEETS_CREDENTIAL = { id: 'sJdVMmql2IyZ94ti', name: 'Google Sheets - MBW' };
const GMAIL_CREDENTIAL = { id: 'LnshM9Re4AS62jV4', name: 'MBW - Gmail account' };
const TELEGRAM_CREDENTIAL = { id: 'fvhEZEI6Ksxrj9DD', name: 'MBW - Notifications' };
const SHEETS_RETRY = { retryOnFail: true, maxTries: 6, waitBetweenTries: 10000 };

const queueHeaders = [
  'queue_id','tour_date','guest_id','inquiry_id','first_name','email','preferred_language',
  'tour_names','guide_names','route_names','recap_ids','species_count','species_codes',
  'email_subject','email_html','email_text','approval_status','delivery_status',
  'draft_created_at','approved_at','sent_at','gmail_message_id','error','source_hash',
  'workflow_version','created_at','updated_at',
];

const schema = queueHeaders.map((id) => ({
  id,
  displayName: id,
  required: false,
  defaultMatch: false,
  display: true,
  type: id === 'species_count' ? 'number' : 'string',
  canBeUsedToMatch: true,
  removed: false,
}));

const readSheet = ({ name, spreadsheetId, sheetId, sheetName, position, alwaysOutputData = false }) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  type: 'n8n-nodes-base.googleSheets',
  typeVersion: 4.7,
  position,
  alwaysOutputData,
  executeOnce: true,
  ...SHEETS_RETRY,
  parameters: {
    documentId: { __rl: true, value: spreadsheetId, mode: 'id' },
    sheetName: {
      __rl: true,
      value: sheetId,
      mode: 'list',
      cachedResultName: sheetName,
      cachedResultUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`,
    },
    options: {},
  },
  credentials: { googleSheetsOAuth2Api: GOOGLE_SHEETS_CREDENTIAL },
});

const upsertQueue = ({ name, position }) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  type: 'n8n-nodes-base.googleSheets',
  typeVersion: 4.7,
  position,
  ...SHEETS_RETRY,
  parameters: {
    operation: 'appendOrUpdate',
    documentId: { __rl: true, value: CRM_SHEET, mode: 'id' },
    sheetName: {
      __rl: true,
      value: QUEUE_GID,
      mode: 'list',
      cachedResultName: 'post_tour_sightings_email_queue',
      cachedResultUrl: `https://docs.google.com/spreadsheets/d/${CRM_SHEET}/edit#gid=${QUEUE_GID}`,
    },
    columns: {
      mappingMode: 'autoMapInputData',
      value: {},
      matchingColumns: ['queue_id'],
      schema,
      attemptToConvertTypes: false,
      convertFieldsToString: false,
    },
    options: {},
  },
  credentials: { googleSheetsOAuth2Api: GOOGLE_SHEETS_CREDENTIAL },
});

const buildCandidatesCode = String.raw`
const clean = value => String(value ?? '').trim();
const esc = value => clean(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const rows = name => $items(name).map(item => item.json || {}).filter(row => Object.keys(row).length);
const uniq = values => [...new Map(values.map(clean).filter(Boolean).map(value => [value.toLowerCase(), value])).values()];
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
const status = value => clean(value).toLowerCase().replace(/[\s-]+/g,'_');
const isoDate = value => {
  const raw = clean(value);
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = DateTime.fromISO(raw);
  if (parsed.isValid) return parsed.toISODate();
  for (const format of ['M/d/yyyy','MM/dd/yyyy','d/M/yyyy','dd/MM/yyyy']) {
    const candidate = DateTime.fromFormat(raw, format);
    if (candidate.isValid) return candidate.toISODate();
  }
  return '';
};
const parseCsv = text => {
  text = String(text ?? '');
  const raw = text.trim();
  if (!raw || /^<!doctype html/i.test(raw) || /^<html/i.test(raw)) throw new Error('species_core CSV is unavailable or returned HTML.');
  const parsed = []; let row = []; let cell = ''; let quoted = false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i], next=text[i+1];
    if (ch==='"') { if (quoted && next==='"') { cell+='"'; i++; } else quoted=!quoted; }
    else if (ch===',' && !quoted) { row.push(cell); cell=''; }
    else if ((ch==='\n' || ch==='\r') && !quoted) { if (ch==='\r' && next==='\n') i++; row.push(cell); cell=''; if (row.some(Boolean)) parsed.push(row); row=[]; }
    else cell+=ch;
  }
  row.push(cell); if (row.some(Boolean)) parsed.push(row);
  const headers=(parsed.shift()||[]).map(value=>clean(value).replace(/^\uFEFF/,''));
  return parsed.map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
};
const hash = value => {
  let h=2166136261;
  for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h,16777619); }
  return (h>>>0).toString(36);
};
const sourceBody = $json.body ?? $json.data ?? $json.text ?? $json;
const coreRows = parseCsv(typeof sourceBody === 'string' ? sourceBody : JSON.stringify(sourceBody));
const coreByCode = Object.fromEntries(coreRows.map(row => [clean(row.speciesCode), row]).filter(([code]) => code));
const recaps = rows('Google Sheets • Read Recaps');
const recapSpecies = rows('Google Sheets • Read Recap Species');
const inquiries = rows('Google Sheets • Read CRM Inquiries');
const assignmentResponses = rows('HTTP • Read Guide Assignments');
const assignments = assignmentResponses.flatMap(row => Array.isArray(row.records) ? row.records : Array.isArray(row.data) ? row.data : []);
const queue = rows('Google Sheets • Read Approval Queue');
const existingById = Object.fromEntries(queue.map(row => [clean(row.queue_id), row]).filter(([id]) => id));
const today = DateTime.now().setZone('America/Guayaquil').startOf('day');
const earliest = today.minus({days:30});
const normalizeRef = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'');
const normalizeGuide = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const usableGuide = value => value && !['other','otro','tbd','pending','unassigned'].includes(value);
const completed = value => ['yes','true','1','completed','complete'].includes(status(value));
const recapsByGuideDate = {};
for (const recap of recaps) {
  const date = isoDate(recap.tour_date);
  const dt = date ? DateTime.fromISO(date,{zone:'America/Guayaquil'}) : null;
  const guideKey = normalizeGuide(recap.guide_name);
  if (!usableGuide(guideKey) || !date || !dt?.isValid || dt < earliest || dt > today) continue;
  const key=date+'|'+guideKey;
  const prior = recapsByGuideDate[key];
  if (!prior || clean(recap.submitted_at || recap.updated_at) > clean(prior.submitted_at || prior.updated_at)) recapsByGuideDate[key] = recap;
}
const speciesByRecap = {};
for (const bird of recapSpecies) {
  const recapId = clean(bird.recap_id);
  const code = clean(bird.speciesCode);
  if (!recapId || !code) continue;
  (speciesByRecap[recapId] ||= []).push(code);
}
const readyTours=[];
const assignmentGuide = assignment => clean(assignment.provider_name)==='Other' ? clean(assignment.provider_name_other) : clean(assignment.provider_name);
const assignmentActive = assignment => !['yes','true','1'].includes(status(assignment.is_deleted)) && !['cancelled','canceled','deleted'].includes(status(assignment.assignment_status));
const assignmentBirding = assignment => status(assignment.service_type).includes('bird') || status(assignment.provider_role)==='guide';
const assignmentsFor = (guest,date) => assignments.filter(assignment => {
  const sameGuest=(clean(assignment.inquiry_id) && clean(assignment.inquiry_id)===clean(guest.inquiry_id)) || (clean(assignment.guest_id) && clean(assignment.guest_id)===clean(guest.guest_id));
  return sameGuest && isoDate(assignment.service_date || assignment.tour_date || assignment.date)===date && assignmentActive(assignment) && assignmentBirding(assignment) && usableGuide(normalizeGuide(assignmentGuide(assignment)));
});
const isBirding = item => {
  const service=status(item.service_type);
  const product=clean(item.product_selected);
  const tour=clean(item.tour);
  return service.includes('bird') || /^MBW00[1-8]\b/i.test(product) || /^MBW019\b/i.test(product) || /birdwatch|toucan|cock-of-the-rock|hummingbird/i.test(product+' '+tour);
};
for (const guest of inquiries) {
  if (['yes','true','1'].includes(status(guest.is_archived)) || !validEmail(guest.email)) continue;
  let items=[];
  try { items=JSON.parse(clean(guest.tour_items_json)||'[]'); } catch { items=[]; }
  if (!Array.isArray(items)) continue;
  const byDate={};
  for (const item of items) {
    if (!completed(item.status) || !isBirding(item)) continue;
    const date=isoDate(item.tour_date || item.date);
    const dt=date?DateTime.fromISO(date,{zone:'America/Guayaquil'}):null;
    if (!date || !dt?.isValid || dt < earliest || dt > today) continue;
    (byDate[date] ||= []).push(item);
  }
  for (const [date,tourItems] of Object.entries(byDate)) {
    const matchedAssignments=assignmentsFor(guest,date);
    const guideKeys=uniq(matchedAssignments.map(assignment=>normalizeGuide(assignmentGuide(assignment))));
    if (guideKeys.length!==1) continue;
    const guideKey=guideKeys[0];
    const recap=recapsByGuideDate[date+'|'+guideKey];
    if (!recap) continue;
    const guestKey=clean(guest.guest_id)||clean(guest.inquiry_id)||clean(guest.email).toLowerCase();
    const reference=date+'_'+guestKey+'_'+guideKey;
    const invoice={
      guest_first_name:clean(guest.first_name)||clean(guest.full_name).split(/\s+/)[0],
      guest_email:clean(guest.email),
      product_selected:uniq(tourItems.map(item=>item.tour || item.product_selected)).join(' · '),
    };
    readyTours.push({invoice,guest,recap,date,reference});
  }
}
const formatDate = date => DateTime.fromISO(date,{zone:'America/Guayaquil'}).toLocaleString({month:'long',day:'numeric',year:'numeric'});
const listRows = species => species.map((bird,index)=>'<tr><td style="width:34px;padding:8px 10px;border-bottom:1px solid #dfe8d9;color:#0d5925;font-weight:800;text-align:right;vertical-align:top">'+(index+1)+'.</td><td style="padding:8px 10px;border-bottom:1px solid #dfe8d9"><strong style="color:#17271f">'+esc(bird.en)+'</strong><br><span style="font-size:12px;color:#607067">'+esc(bird.es)+' · <em>'+esc(bird.scientific)+'</em> · '+esc(bird.code)+'</span></td></tr>').join('');
const socialIcon = (href,src,alt) => '<a href="'+href+'" style="display:inline-block;margin:0 5px 8px"><img src="'+src+'" width="32" height="32" alt="'+alt+'" style="border:0;display:block"></a>';
function emailHtml({firstName,date,tours,routes,species,queueId}) {
  const dateLabel=formatDate(date); const count=species.length;
  const shop='https://mindobirdwatching.com/shop/?utm_source=sightings_email&utm_medium=email&utm_campaign=post_tour_followup&utm_content=shop_card';
  const site='https://mindobirdwatching.com/?utm_source=sightings_email&utm_medium=email&utm_campaign=post_tour_followup&utm_content=footer_site';
  const socials=[
    socialIcon('https://www.instagram.com/mindobirdwatching/','https://cdn-icons-png.flaticon.com/512/2111/2111463.png','Instagram'),
    socialIcon('https://www.tiktok.com/@mindobirdwatching','https://cdn-icons-png.flaticon.com/512/3046/3046121.png','TikTok'),
    socialIcon('https://www.facebook.com/profile.php?id=61577783327957','https://cdn-icons-png.flaticon.com/512/733/733547.png','Facebook'),
    socialIcon('https://www.youtube.com/@MindoBirdWatching','https://cdn-icons-png.flaticon.com/512/1384/1384060.png','YouTube'),
  ].join('');
  return '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:620px){.shell{padding:0!important}.email{border-radius:0!important}.pad{padding-left:20px!important;padding-right:20px!important}.stack{display:block!important;width:100%!important;box-sizing:border-box!important;border-right:0!important}.title{font-size:29px!important;line-height:34px!important}}</style></head><body style="margin:0;background:#dcebcf">'
  +'<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your complete Mindo bird list from '+esc(dateLabel)+' is ready.</div>'
  +'<table role="presentation" width="100%" class="shell" style="background:#dcebcf;padding:32px 12px"><tr><td align="center"><table role="presentation" width="680" class="email" style="width:100%;max-width:680px;background:#fff;border:1px solid #bed1b1;border-radius:24px;overflow:hidden">'
  +'<tr><td class="pad" style="padding:24px 42px 22px;background:#f6faf0"><table role="presentation" width="100%"><tr><td width="76" style="padding-right:14px"><img src="https://mindobirdwatching.com/assets/images/logo/mbw-logo-mark-1024.png" width="72" height="72" alt="Mindo Bird Watching"></td><td><div style="font-family:Georgia,serif;font-size:25px;line-height:29px;color:#0d5925;font-weight:700">Mindo Bird Watching</div><div style="font:900 11px/15px Arial;letter-spacing:.1em;text-transform:uppercase;color:#0d5925;margin-top:4px">Your cloud forest sightings</div></td></tr></table></td></tr>'
  +'<tr><td class="pad" style="padding:38px 42px 28px"><div style="font:900 11px/15px Arial;letter-spacing:.1em;text-transform:uppercase;color:#0d5925">Tour recap · '+count+' species</div><h1 class="title" style="font-family:Georgia,serif;font-size:34px;line-height:39px;color:#0d5925;margin:7px 0 0">Hi '+esc(firstName)+',<br>Here is your Mindo bird list.</h1><p style="font:15px/23px Arial;color:#24362e;margin:16px 0 0">Thank you for exploring Mindo with us.<br>Your guide recorded these birds during your tour on '+esc(dateLabel)+'.</p></td></tr>'
  +'<tr><td class="pad" style="padding:0 42px 30px"><table role="presentation" width="100%" style="background:#f6faf0;border:1px solid #c8dabd;border-radius:16px"><tr><td class="stack" width="33%" style="padding:15px;border-right:1px solid #d7e3d0"><strong style="font:900 11px Arial;color:#0d5925;text-transform:uppercase">Date</strong><br><span style="font:700 12px/18px Arial;color:#17271f">'+esc(dateLabel)+'</span></td><td class="stack" width="33%" style="padding:15px;border-right:1px solid #d7e3d0"><strong style="font:900 11px Arial;color:#0d5925;text-transform:uppercase">Tour</strong><br><span style="font:700 12px/18px Arial;color:#17271f">'+esc(tours||'Birdwatching')+'</span></td><td class="stack" width="34%" style="padding:15px"><strong style="font:900 11px Arial;color:#0d5925;text-transform:uppercase">Route</strong><br><span style="font:700 12px/18px Arial;color:#17271f">'+esc(routes||'Mindo cloud forest')+'</span></td></tr></table></td></tr>'
  +'<tr><td class="pad" style="padding:0 42px 34px"><div style="font:700 25px/30px Georgia;color:#0d5925;margin-bottom:12px">Birds recorded:</div><table role="presentation" width="100%" style="font:13px/18px Arial;border:1px solid #d6e1cf;border-radius:14px;overflow:hidden">'+listRows(species)+'</table></td></tr>'
  +'<tr><td class="pad" style="padding:30px 42px;background:#0d5925;text-align:center"><div style="font:700 26px/31px Georgia;color:#fff">Your tour may make the next recap</div><p style="font:14px/21px Arial;color:#e8f3e1;margin:10px auto 18px;max-width:520px">Follow us for new bird sightings, cloud forest moments and tour recaps. You may recognize a route—or even a moment—from your own day in Mindo.</p>'+socials+'</td></tr>'
  +'<tr><td class="pad" style="padding:32px 42px 10px"><table role="presentation" width="100%" style="background:#f6faf0;border:1px solid #c8dabd;border-radius:18px"><tr><td class="stack" width="58%" style="padding:24px"><div style="font:900 11px Arial;color:#0d5925;text-transform:uppercase">Share your experience</div><div style="font:700 23px/28px Georgia;color:#0d5925;margin-top:5px">Help another birder find Mindo</div><p style="font:13px/19px Arial;color:#24362e;margin:8px 0 0">A short review helps future travelers choose a local birding experience with confidence.</p></td><td class="stack" width="42%" align="center" style="padding:20px"><a href="https://g.page/r/CdMlIYMGgBIvEAE/review" style="display:inline-block;background:#fff;border:1px solid #91ad83;border-radius:12px;margin:4px;padding:5px 9px;text-align:center"><img src="https://mindobirdwatching.com/assets/images/logo/mbw_logos_google_reviews_001.jpeg" width="150" height="75" alt="Review on Google" style="object-fit:contain"><span style="display:block;font:900 11px Arial;color:#0d5925">Leave a Google review</span></a><br><a href="https://www.tripadvisor.com/Attraction_Review-g609138-d34192556-Reviews-Mindo_Bird_Watching-Mindo_Pichincha_Province.html" style="display:inline-block;background:#fff;border:1px solid #91ad83;border-radius:12px;margin:4px;padding:5px 9px;text-align:center"><img src="https://mindobirdwatching.com/assets/images/logo/mbw_logos_trip_advisor_001.jpeg" width="150" height="75" alt="Review on Tripadvisor" style="object-fit:contain"><span style="display:block;font:900 11px Arial;color:#0d5925">Leave a Tripadvisor review</span></a></td></tr></table></td></tr>'
  +'<tr><td class="pad" style="padding:12px 42px 34px"><table role="presentation" width="100%" style="background:#fff8df;border:1px solid #ead58f;border-radius:18px"><tr><td class="stack" width="70%" style="padding:23px"><div style="font:900 11px Arial;color:#72520a;text-transform:uppercase">A little piece of the cloud forest</div><div style="font:700 23px/28px Georgia;color:#0d5925;margin-top:5px">Take the birds of Mindo home with you</div><p style="font:13px/19px Arial;color:#24362e;margin:8px 0 0">Explore bird-inspired shirts, mugs and travel keepsakes made for people who want to keep Mindo close.</p></td><td class="stack" width="30%" align="center" style="padding:20px"><a href="'+shop+'" style="display:inline-block;background:#f0c74d;color:#17331f;border:1px solid #d0a82e;border-radius:12px;padding:12px 16px;font:900 13px Arial">Visit the shop</a></td></tr></table></td></tr>'
  +'<tr><td class="pad" style="padding:25px 42px 26px;background:#f6faf0;text-align:center;border-top:1px solid #d6e1cf"><p style="font:13px/20px Arial;color:#24362e;margin:0 0 13px">Thank you for choosing Mindo Bird Watching.<br><strong>We hope the list brings back a few favorite moments.</strong></p><div style="font:11px/17px Arial;color:#607067">Mindo, Ecuador · <a href="'+site+'" style="color:#0d5925">mindobirdwatching.com</a></div><div style="font:9px/14px Arial;color:#849188;margin-top:8px">Reference: '+esc(queueId)+'</div></td></tr>'
  +'</table></td></tr></table></body></html>';
}
const output=[]; const now=new Date().toISOString();
for (const {invoice,guest,recap,date,reference} of readyTours) {
  const recapIds=[clean(recap.recap_id)];
  const codes=uniq(recapIds.flatMap(id=>speciesByRecap[id]||[]));
  if (!codes.length) continue;
  const species=codes.map(code=>{const core=coreByCode[code]||{};return {code,en:clean(core.english_name)||code,es:clean(core.spanish_name)||'Spanish name pending',scientific:clean(core.scientific_name)||'Scientific name pending'};}).sort((a,b)=>a.en.localeCompare(b.en));
  const key=reference.replace(/[^a-zA-Z0-9_-]+/g,'_');
  const queueId='sightings_'+key;
  const existing=existingById[queueId]||{};
  const existingVersion=clean(existing.workflow_version);
  if (['SENDING','SENT'].includes(clean(existing.delivery_status).toUpperCase())) continue;
  if (existingVersion==='post_tour_sightings_v4' && ['APPROVED','REJECTED'].includes(clean(existing.approval_status).toUpperCase())) continue;
  const tours=clean(invoice.product_selected)||clean(recap.tour_type)||'Birdwatching';
  const routes=clean(recap.route_name)||'Mindo cloud forest';
  const guides=clean(recap.guide_name);
  const firstName=clean(invoice.guest_first_name)||clean(guest.first_name)||clean(guest.full_name).split(/\s+/)[0]||'there';
  const subject='Your Mindo bird sightings from '+formatDate(date);
  const text=['Hi '+firstName+',','Here is your Mindo bird list.','','Thank you for exploring Mindo with us.','Your guide recorded these birds during your tour on '+formatDate(date)+'.','','Birds recorded:',...species.map((bird,index)=>(index+1)+'. '+bird.en+' | '+bird.es+' | '+bird.scientific+' | '+bird.code),'','If you enjoyed your tour, we would appreciate a review:','Google: https://g.page/r/CdMlIYMGgBIvEAE/review','Tripadvisor: https://www.tripadvisor.com/Attraction_Review-g609138-d34192556-Reviews-Mindo_Bird_Watching-Mindo_Pichincha_Province.html','','Follow our tour recaps:','Instagram: https://www.instagram.com/mindobirdwatching/','TikTok: https://www.tiktok.com/@mindobirdwatching','Facebook: https://www.facebook.com/profile.php?id=61577783327957','YouTube: https://www.youtube.com/@MindoBirdWatching','','Shop: https://mindobirdwatching.com/shop/?utm_source=sightings_email&utm_medium=email&utm_campaign=post_tour_followup&utm_content=shop_text','','Thank you for choosing Mindo Bird Watching.'].join('\n');
  const email=clean(invoice.guest_email).toLowerCase();
  const sourceHash=hash([reference,date,recapIds.join('|'),codes.join('|'),email].join('::'));
  output.push({json:{queue_id:queueId,tour_date:date,guest_id:clean(guest.guest_id),inquiry_id:clean(guest.inquiry_id),first_name:firstName,email,preferred_language:'en',tour_names:tours,guide_names:guides,route_names:routes,recap_ids:recapIds.join(' | '),species_count:species.length,species_codes:codes.join(' | '),email_subject:subject,email_html:emailHtml({firstName,date,tours,routes,species,queueId}),email_text:text,approval_status:'PENDING_REVIEW',delivery_status:'QUEUED',draft_created_at:existing.draft_created_at||now,approved_at:'',sent_at:'',gmail_message_id:'',error:'',source_hash:sourceHash,workflow_version:'post_tour_sightings_v4',created_at:existing.created_at||now,updated_at:now}});
}
return output;
`;

const workflow = {
  name: 'MBW - Post-Tour Sightings Email - APPROVAL',
  active: false,
  settings: { executionOrder: 'v1', timezone: 'America/Guayaquil', saveManualExecutions: true, availableInMCP: false },
  nodes: [
    { id:'manual-prepare', name:'Manual Trigger • Prepare Queue', type:'n8n-nodes-base.manualTrigger', typeVersion:1, position:[0,0], parameters:{} },
    { id:'schedule-prepare', name:'Schedule • Prepare Queue', type:'n8n-nodes-base.scheduleTrigger', typeVersion:1.2, position:[0,160], parameters:{rule:{interval:[{field:'cronExpression',expression:'25 */6 * * *'}]}} },
    readSheet({name:'Google Sheets • Read Recaps',spreadsheetId:SIGHTINGS_SHEET,sheetId:41409381,sheetName:'guide_tour_recap',position:[240,80]}),
    { id:'wait-after-recaps', name:'Wait • Sheets quota after recaps', type:'n8n-nodes-base.wait', typeVersion:1.1, position:[480,80], parameters:{amount:20} },
    readSheet({name:'Google Sheets • Read Recap Species',spreadsheetId:SIGHTINGS_SHEET,sheetId:1305659636,sheetName:'guide_tour_recap_species',position:[720,80]}),
    { id:'wait-after-species', name:'Wait • Sheets quota after species', type:'n8n-nodes-base.wait', typeVersion:1.1, position:[960,80], parameters:{amount:20} },
    readSheet({name:'Google Sheets • Read CRM Inquiries',spreadsheetId:CRM_SHEET,sheetId:613590723,sheetName:'crm_inquiries',position:[1200,80]}),
    { id:'wait-after-crm', name:'Wait • Sheets quota after CRM', type:'n8n-nodes-base.wait', typeVersion:1.1, position:[1440,80], parameters:{amount:20} },
    { id:'read-guide-assignments', name:'HTTP • Read Guide Assignments', type:'n8n-nodes-base.httpRequest', typeVersion:4.2, position:[1680,80], executeOnce:true, parameters:{method:'POST',url:'https://n8n.mindobirdwatching.com/webhook/mbw-crm-admin-api',sendBody:true,contentType:'form-urlencoded',bodyParameters:{parameters:[{name:'payload',value:'{"action":"list_assignments"}'}]},options:{timeout:30000,response:{response:{neverError:false,responseFormat:'json'}}}} },
    readSheet({name:'Google Sheets • Read Approval Queue',spreadsheetId:CRM_SHEET,sheetId:QUEUE_GID,sheetName:'post_tour_sightings_email_queue',position:[2160,80],alwaysOutputData:true}),
    { id:'fetch-species', name:'HTTP • Fetch species_core CSV', type:'n8n-nodes-base.httpRequest', typeVersion:4.2, position:[2400,80], executeOnce:true, parameters:{url:'https://docs.google.com/spreadsheets/d/1FGmAm92kMYIMCLjGL_m-OOaUmD6og_mvsKcTIGs_GJE/gviz/tq?tqx=out:csv&sheet=species_core',options:{response:{response:{neverError:true,responseFormat:'text'}}}} },
    { id:'build-candidates', name:'Code • Build Approval Queue', type:'n8n-nodes-base.code', typeVersion:2, position:[2640,80], parameters:{jsCode:buildCandidatesCode} },
    upsertQueue({name:'Google Sheets • Upsert Approval Queue',position:[2880,80]}),
    { id:'prepare-summary', name:'Code • Prepare Telegram Summary', type:'n8n-nodes-base.code', typeVersion:2, position:[3120,80], parameters:{jsCode:String.raw`const items=$items('Code • Build Approval Queue'); if(!items.length) return []; const dates=[...new Set(items.map(i=>i.json.tour_date))]; return [{json:{chat_id:'-1003067570080',text:'<b>Post-tour sightings emails ready for review</b>\n\nGuests: <b>'+items.length+'</b>\nTour dates: <b>'+dates.join(', ')+'</b>\n\nEach draft matched a completed birdwatching tour and its assigned guide to that guide’s report on the same date. Review the row and change <code>approval_status</code> to <b>APPROVED</b>. Approved rows are sent at the next scheduled run.\n\n<a href="https://docs.google.com/spreadsheets/d/${CRM_SHEET}/edit#gid=${QUEUE_GID}">Open approval queue</a>'}}];`} },
    { id:'telegram-prepare', name:'Telegram • Queue Ready', type:'n8n-nodes-base.telegram', typeVersion:1.2, position:[3360,80], parameters:{chatId:'={{$json.chat_id}}',text:'={{$json.text}}',additionalFields:{appendAttribution:false,disable_web_page_preview:true,parse_mode:'HTML'}},credentials:{telegramApi:TELEGRAM_CREDENTIAL} },

    { id:'manual-send', name:'Manual Trigger • Send Approved', type:'n8n-nodes-base.manualTrigger', typeVersion:1, position:[0,520], parameters:{} },
    { id:'schedule-send', name:'Schedule • Check Approved', type:'n8n-nodes-base.scheduleTrigger', typeVersion:1.2, position:[0,680], parameters:{rule:{interval:[{field:'cronExpression',expression:'30 */6 * * *'}]}} },
    readSheet({name:'Google Sheets • Read Queue for Sending',spreadsheetId:CRM_SHEET,sheetId:QUEUE_GID,sheetName:'post_tour_sightings_email_queue',position:[240,600],alwaysOutputData:true}),
    { id:'select-approved', name:'Code • Select Approved Emails', type:'n8n-nodes-base.code', typeVersion:2, position:[480,600], parameters:{jsCode:String.raw`const valid=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim()); const seen=new Set(); return $input.all().filter(item=>{const r=item.json||{}; const ok=String(r.workflow_version||'').trim()==='post_tour_sightings_v4' && String(r.approval_status||'').trim().toUpperCase()==='APPROVED' && !['SENDING','SENT','SKIPPED'].includes(String(r.delivery_status||'').trim().toUpperCase()) && valid(r.email) && r.email_html && r.email_subject && r.queue_id && !seen.has(r.queue_id); if(ok) seen.add(r.queue_id); return ok;});`} },
    { id:'lock-approved', name:'Code • Lock Approved Emails', type:'n8n-nodes-base.code', typeVersion:2, position:[720,600], parameters:{jsCode:String.raw`const now=new Date().toISOString(); return $input.all().map(item=>({json:{...item.json,delivery_status:'SENDING',approved_at:item.json.approved_at||now,error:'',updated_at:now}}));`} },
    upsertQueue({name:'Google Sheets • Save Send Lock',position:[960,600]}),
    { id:'restore-locked', name:'Code • Restore Locked Email Payloads', type:'n8n-nodes-base.code', typeVersion:2, position:[1200,600], parameters:{jsCode:String.raw`return $items('Code • Lock Approved Emails').map(item=>({json:item.json}));`} },
    { id:'gmail-send', name:'Gmail • Send Approved Sightings Email', type:'n8n-nodes-base.gmail', typeVersion:2.1, position:[1440,600], continueOnFail:true, parameters:{sendTo:'={{$json.email}}',subject:'={{$json.email_subject}}',emailType:'html',message:'={{$json.email_html}}',options:{appendAttribution:false,replyTo:'mindobirdwatching@gmail.com',senderName:'Mindo Bird Watching'}},credentials:{gmailOAuth2:GMAIL_CREDENTIAL} },
    { id:'mark-result', name:'Code • Mark Delivery Result', type:'n8n-nodes-base.code', typeVersion:2, position:[1680,600], parameters:{jsCode:String.raw`const sent=$input.all(); const source=$items('Code • Restore Locked Email Payloads'); const now=new Date().toISOString(); return source.map((item,index)=>{const response=sent[index]?.json||{}; const failed=Boolean(response.error||response.message?.includes?.('error')); return {json:{...item.json,delivery_status:failed?'FAILED':'SENT',sent_at:failed?'':now,gmail_message_id:String(response.id||response.messageId||response.threadId||''),error:failed?String(response.error||response.message||'Gmail send failed'):'',updated_at:now}};});`} },
    upsertQueue({name:'Google Sheets • Save Delivery Result',position:[1920,600]}),
    { id:'crm-log', name:'Code • Build CRM Email Log', type:'n8n-nodes-base.code', typeVersion:2, position:[2160,600], parameters:{jsCode:String.raw`return $items('Code • Mark Delivery Result').filter(i=>i.json.delivery_status==='SENT').map(i=>({json:{email_log_id:'EMAIL-'+i.json.queue_id,created_at:i.json.sent_at,message_date:i.json.sent_at,direction:'outbound',inquiry_id:i.json.inquiry_id,guest_id:i.json.guest_id,email:i.json.email,email_normalized:String(i.json.email||'').toLowerCase(),gmail_thread_id:'',gmail_message_id:i.json.gmail_message_id,subject:i.json.email_subject,snippet:String(i.json.email_text||'').slice(0,500),template_key:'post_tour_sightings_v4',status:'sent',matched_by:'completed_birding_date_and_guide',notes:'Approval queue '+i.json.queue_id}}));`} },
    { id:'append-crm-log', name:'Google Sheets • Append CRM Email Log', type:'n8n-nodes-base.googleSheets', typeVersion:4.7, position:[2400,600], ...SHEETS_RETRY, parameters:{operation:'append',documentId:{__rl:true,value:CRM_SHEET,mode:'id'},sheetName:{__rl:true,value:1459468470,mode:'list',cachedResultName:'crm_email_log',cachedResultUrl:`https://docs.google.com/spreadsheets/d/${CRM_SHEET}/edit#gid=1459468470`},columns:{mappingMode:'autoMapInputData',value:{},matchingColumns:[],schema:[],attemptToConvertTypes:false,convertFieldsToString:false},options:{}},credentials:{googleSheetsOAuth2Api:GOOGLE_SHEETS_CREDENTIAL} },
    { id:'sent-summary', name:'Code • Sent Telegram Summary', type:'n8n-nodes-base.code', typeVersion:2, position:[2640,600], parameters:{jsCode:String.raw`const rows=$items('Code • Mark Delivery Result'); if(!rows.length) return []; const sent=rows.filter(i=>i.json.delivery_status==='SENT'); const failed=rows.filter(i=>i.json.delivery_status==='FAILED'); return [{json:{chat_id:'-1003067570080',text:'<b>Post-tour sightings email run complete</b>\n\nSent: <b>'+sent.length+'</b>\nFailed: <b>'+failed.length+'</b>'+ (failed.length?'\n\nFailed queue IDs:\n'+failed.map(i=>'• <code>'+i.json.queue_id+'</code>').join('\n'):'')}}];`} },
    { id:'telegram-sent', name:'Telegram • Delivery Summary', type:'n8n-nodes-base.telegram', typeVersion:1.2, position:[2880,600], parameters:{chatId:'={{$json.chat_id}}',text:'={{$json.text}}',additionalFields:{appendAttribution:false,disable_web_page_preview:true,parse_mode:'HTML'}},credentials:{telegramApi:TELEGRAM_CREDENTIAL} },
    { id:'sticky', name:'Sticky Note • Approval Workflow', type:'n8n-nodes-base.stickyNote', typeVersion:1, position:[720,-260], parameters:{content:'MBW Post-Tour Sightings Email — Approval Mode\n\n1. Four times daily at :25 Ecuador time, read completed birdwatching tours, guide assignments and submitted guide reports.\n2. Match only when the inquiry/guest, tour date and normalized assigned guide all agree.\n3. Two guides may report on the same date; each guest receives only the report from their assigned guide. Missing or conflicting guide assignments create no draft.\n4. Set approval_status to APPROVED to authorize sending.\n5. The guarded sender runs at :30 every six hours and logs successful email IDs.\n\nSafety: neither a report nor a completed tour can send alone; a matching guide assignment and manual pilot approval are required.',height:340,width:560} },
  ],
  connections: {},
  pinData: {},
  tags: [],
  meta: { templateCredsSetupCompleted: true },
};

const connect = (from, to) => {
  workflow.connections[from] ||= { main: [[]] };
  workflow.connections[from].main[0].push({ node: to, type: 'main', index: 0 });
};

for (const trigger of ['Manual Trigger • Prepare Queue','Schedule • Prepare Queue']) connect(trigger,'Google Sheets • Read Recaps');
[
  ['Google Sheets • Read Recaps','Wait • Sheets quota after recaps'],
  ['Wait • Sheets quota after recaps','Google Sheets • Read Recap Species'],
  ['Google Sheets • Read Recap Species','Wait • Sheets quota after species'],
  ['Wait • Sheets quota after species','Google Sheets • Read CRM Inquiries'],
  ['Google Sheets • Read CRM Inquiries','Wait • Sheets quota after CRM'],
  ['Wait • Sheets quota after CRM','HTTP • Read Guide Assignments'],
  ['HTTP • Read Guide Assignments','Google Sheets • Read Approval Queue'],
  ['Google Sheets • Read Approval Queue','HTTP • Fetch species_core CSV'],
  ['HTTP • Fetch species_core CSV','Code • Build Approval Queue'],
  ['Code • Build Approval Queue','Google Sheets • Upsert Approval Queue'],
  ['Google Sheets • Upsert Approval Queue','Code • Prepare Telegram Summary'],
  ['Code • Prepare Telegram Summary','Telegram • Queue Ready'],
].forEach(([from,to])=>connect(from,to));

for (const trigger of ['Manual Trigger • Send Approved','Schedule • Check Approved']) connect(trigger,'Google Sheets • Read Queue for Sending');
[
  ['Google Sheets • Read Queue for Sending','Code • Select Approved Emails'],
  ['Code • Select Approved Emails','Code • Lock Approved Emails'],
  ['Code • Lock Approved Emails','Google Sheets • Save Send Lock'],
  ['Google Sheets • Save Send Lock','Code • Restore Locked Email Payloads'],
  ['Code • Restore Locked Email Payloads','Gmail • Send Approved Sightings Email'],
  ['Gmail • Send Approved Sightings Email','Code • Mark Delivery Result'],
  ['Code • Mark Delivery Result','Google Sheets • Save Delivery Result'],
  ['Google Sheets • Save Delivery Result','Code • Build CRM Email Log'],
  ['Google Sheets • Save Delivery Result','Code • Sent Telegram Summary'],
  ['Code • Build CRM Email Log','Google Sheets • Append CRM Email Log'],
  ['Code • Sent Telegram Summary','Telegram • Delivery Summary'],
].forEach(([from,to])=>connect(from,to));

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(workflow, null, 2) + '\n');
console.log(OUTPUT);
