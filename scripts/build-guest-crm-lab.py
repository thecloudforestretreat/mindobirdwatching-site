"""Generate the Beta workflow UI from the current CRM; never edit the working CRM."""
from pathlib import Path
import hashlib,re,json
root=Path(__file__).resolve().parents[1]
source=root/'admin/guest-crm/index.html';target=root/'admin/guest-crm-lab'
html=source.read_text();styles=re.findall(r'<style>(.*?)</style>',html,re.S);scripts=re.findall(r'<script>(.*?)</script>',html,re.S)
assert len(styles)==len(scripts)==1
engine=scripts[0]
def change(old,new):
 global engine
 assert old in engine,old[:120]
 engine=engine.replace(old,new)
change('https://n8n.mindobirdwatching.com/webhook/mbw-crm-admin-api','/api/crm-lab/read')
# Isolate the Beta's record cache/preferences from the existing CRM.
change('credentials:"omit"','credentials:"same-origin"')
change('mbwCrm','mbwCrmLab');change('mbwCalendar','mbwLabCalendar')
change('view: "calendar"','view: "dashboard"')
change('if(!state.records.length)loadDemoRecords(false);','')
change('const payload={action,...data};','if(!action.startsWith("list_")) throw new Error("Beta is read-only. Use the current Guest CRM to save this action.");\n        const payload={action,...data};')
start=engine.index('      function scheduleRefreshRetry(delay){');end=engine.index('      async function refreshCrm(background)',start)
engine=engine[:start]+'      function scheduleRefreshRetry(){ /* Beta refresh is manual; avoid extra background requests. */ }\n'+engine[end:]
change('const followHit=r.followup_date===iso;','const followHit=r.followup_date===iso;')
change('if(followHit&&!tourEntries.length) entries.push','if(followHit) entries.push')
change('const mode=state.calendarMode||"tour"; const entries=[]; state.records.forEach','const mode=state.calendarMode||"tour"; const entries=[]; getFiltered().forEach')
change('const active=state.records.filter(record=>!isArchivedStatus(record)&&!isClosedStatus(record.status)); let entries=','const active=getFiltered().filter(record=>!isArchivedStatus(record)&&!isClosedStatus(record.status)); let entries=')
change('const activeServiceCount=state.records.filter','const activeServiceCount=getFiltered().filter')
old='function capacityInfo(count){ if(count>=9) return {className:"guide",label:count+" booked",alert:"Capacity Alert"}; if(count>=5) return {className:"watch",label:count+" booked",alert:"Capacity Alert"}; if(count>=1) return {className:"normal",label:count+" guest"+(count===1?"":"s")+" booked"}; return {className:"open",label:"Not booked"}; }'
new='function capacityInfo(count){ if(count>=1) return {className:"normal",label:count+" guest"+(count===1?"":"s")+" booked"}; return {className:"open",label:"Not booked"}; }'
change(old,new);change('>Open to group</span>','>Willing to share · Verify space</span>')
change('${esc(r.full_name||"Guest")}</span>${brand}', '${esc(r.full_name||"Guest")} ${esc(reportCountryFlag(r.country||r.home_country))}</span>${brand}')
change('const name=clean(r.full_name)||"Guest";', 'const name=(clean(r.full_name)||"Guest")+" "+reportCountryFlag(r.country||r.home_country);')
change('${esc(r.guest_count||"?")} guests</p>${services}', '${esc(r.guest_count||"?")} guest${String(r.guest_count)==="1"?"":"s"}${clean(r.country||r.home_country)?" · "+esc(r.country||r.home_country):""}</p>${services}')

follow=re.search(r'      function renderFollowupSummary\(\).*?\n',engine)[0]
updated=follow.rstrip().removesuffix('}')+'document.querySelectorAll("[data-stat-key=followUp]").forEach(el=>el.textContent=String(due+overdue)); }\n'
engine=engine.replace(follow,updated)
change('if(view==="balances"||view==="intake")loadBalances();','if(view==="balances")loadBalances();')
# Lab-only hooks around the unchanged working CRM engine.
change('const sort=els.sortInput.value||"created_at"', 'if(labPredicate)arr=arr.filter(r=>labPredicate.has(r.inquiry_id));const sort=els.sortInput.value||"created_at"')
change('const tourEntries=calendarEntriesForRecord(r).filter(entry=>isRecordOnTourDate(entry,iso));', 'const tourEntries=calendarEntriesForRecord(r).filter(entry=>isRecordOnTourDate(entry,iso)).filter(entry=>!labCalendarPredicate||labCalendarPredicate(entry));')
change('const filter=clean(els.pipelineStatusFilter.value);', 'if(labCalendarPredicate)entries=entries.filter(labCalendarPredicate);const filter=clean(els.pipelineStatusFilter.value);')
change('sum+calendarEntriesForRecord(record).length', 'sum+calendarEntriesForRecord(record).filter(entry=>!labCalendarPredicate||labCalendarPredicate(entry)).length')
change('function render(){ renderPreparationOverview();', 'function render(){ labEmit();renderPreparationOverview();')
change('function renderBalances(){', 'function renderBalances(){ labEmit();')
engine=engine.replace('    })();', (root/'scripts/crm-lab-bridge.js').read_text()+'\n    })();')
html=html.replace('<style>'+styles[0]+'</style>','<link rel="stylesheet" href="./workflow-base.css?v=1"><link rel="stylesheet" href="./workflow.css?v=2">')
html=html.replace('<script>'+scripts[0]+'</script>','<script src="./review-guard.js?v=2"></script><script src="./workflow-engine.js?v=2"></script><script defer src="./workflow-ui.js?v=2"></script><script type="module" src="./workspace.mjs?v=1"></script>')
html=re.sub(r'<script defer src="/assets/js/admin-nav\.js[^"]*"></script>','',html)
html=html.replace('<div class="view active" id="calendarView">','<div class="view" id="calendarView">').replace('<div class="view" id="dashboardView">','<div class="view active" id="dashboardView">')
html=html.replace('<title>MBW Admin | Guest CRM Manager</title>','<title>Guest CRM Lab Beta | MBW</title>').replace('https://admin.mindobirdwatching.com/guest-crm/" />','https://admin.mindobirdwatching.com/guest-crm-lab/" />')
html=html.replace('<body>','''<body class="crm-lab"><aside class="lab-sidebar"><a class="lab-brand" href="/guest-crm-lab/"><img src="/app/brand-mark.png" alt="Mindo Bird Watching"><span>MBW<small>Guest CRM Lab</small></span></a><span class="lab-beta">Beta · Limited editing</span><p>Full workflow foundation</p><nav aria-label="Lab sections"><button class="tab" data-view="dashboard">Dashboard</button><button class="tab" data-view="records">Guest records</button><button class="tab" data-view="calendar">Calendar & pipeline</button><button class="tab" data-view="preparation">Reminder preparation</button><button class="tab" data-view="balances">Upcoming balances</button><button class="tab" data-view="reports">Tour reports</button><button class="tab" data-view="intake">Guest workspace</button></nav><div class="lab-backlinks"><a href="/guest-crm/" target="_blank" rel="noopener noreferrer">Current Guest CRM ↗</a><a href="/app/" target="_blank" rel="noopener noreferrer">Current Nest ↗</a><a href="/guest-crm-lab/explorer/">Profile explorer</a><a href="/">Admin Hub</a></div></aside><div class="lab-banner"><strong>Guest CRM Lab <span class="lab-beta">Beta</span></strong><span>Notes & follow-up editing only · Financial and other record changes stay in the working CRM</span><a href="/guest-crm/" target="_blank" rel="noopener noreferrer">Open working CRM ↗</a></div>''')
html=html.replace('<h1>Guest CRM Manager</h1>','<h1>Guest CRM Lab <span class="lab-beta">Beta</span></h1>').replace('Manage inquiries, statuses, follow-ups, and guest actions from one place.','Today’s priorities and the complete guest workflow. The current CRM remains available.')
html=html.replace('src="https://mindobirdwatching.com/assets/images/logo/mbw-logo-mark-1024.png"','src="/app/brand-mark.png"')
html=html.replace('class="tab active" data-view="calendar"','class="tab" data-view="calendar"').replace('class="tab" data-view="dashboard"','class="tab active" data-view="dashboard"')
html=html.replace('<span>Follow Up</span>','<span>Follow-up due</span>')
html=html.replace('<h2 class="panelTitle">Dashboard</h2>','<h2 class="panelTitle">Status dashboard</h2>')
html=html.replace('<h2 class="calendarTitle" id="calendarTitle">Calendar</h2>','<h2 class="calendarTitle" id="calendarTitle">Calendar</h2><p class="lab-calendar-note">Quick filters apply · Tour dates and follow-ups are distinct events · Guest totals deduplicate multi-service parties · Space and provider availability require confirmation</p>')
(target/'index.html').write_text('\n'.join(line.rstrip() for line in html.splitlines())+'\n');(target/'workflow-base.css').write_text(styles[0]);(target/'workflow-engine.js').write_text(engine)
(target/'source-manifest.json').write_text(json.dumps({'source':'admin/guest-crm/index.html','sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'limitedWrites':['notes','followup_date','next_action','waiting_on'],'generatedBy':'scripts/build-guest-crm-lab.py'},indent=2)+'\n')
print('Generated full CRM workflow Beta; original CRM unchanged.')
