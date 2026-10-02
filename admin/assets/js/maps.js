import {PALETTES,GROWTH_COLORS,MIN_SESSIONS,key,sum,compare,joinPeriods,scoped,rank,rollup,dailySeries,qualifiedSignals,interpolate,compactMonths,briefing} from './market-model.mjs?v=20261002-demand';

const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const state={source:'website',data:null,features:[],cache:new Map(),request:0,country:'',city:'',zoom:1,presentation:false};
const labels={sessions:'Sessions',totalUsers:'Users',engagedSessions:'Engaged sessions',records:'Booking records',guests:'Recorded guests'};
const number=value=>new Intl.NumberFormat('en-US').format(value);
const percent=value=>value===null?'—':(value*100).toFixed(1)+'%';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const deltaLabel=(current,prior)=>{const c=compare(current,prior);return c.newActivity?'New activity':c.rate===null?'No reported activity':(c.rate>0?'+':'')+percent(c.rate);};
const dayOffset=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const web=()=>state.source==='website';
const measure=()=>$('measure').value;
const isGrowth=()=>$('map-mode').value==='growth'&&web();
const scope=(city=false)=>({country:state.country,continent:$('continent').value,features:state.features,city:city?state.city:''});
const countryRows=()=>web()?joinPeriods(state.data.rows,state.data.prior?.rows):state.data.rows;
const currentRows=()=>scoped(countryRows(),scope());
const cityRows=()=>joinPeriods(state.data?.details?.cities?.rows||[],state.data?.prior?.details?.cities?.rows||[],row=>row.id);
const currentCities=()=>scoped(cityRows(),scope()).filter(row=>row.city!=='(not set)');
const scopeName=()=>state.country?countryRows().find(row=>key(row)===state.country)?.country||state.features.find(f=>f.id===state.country)?.name||state.country:$('continent').value||'Worldwide';
const cityName=row=>[row.city,row.region!=='(not set)'?row.region:'',row.country].filter(Boolean).join(', ');
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function range(){const all=$('period').value==='all';$('start').disabled=all;$('end').disabled=all;if(!all&&$('period').value!=='custom'){$('end').value=dayOffset(today(),-1);$('start').value=dayOffset($('end').value,1-Number($('period').value));}}
function parameters(){const out={source:state.source};if($('period').value!=='all'){out.start=$('start').value;out.end=$('end').value;}if(!web())out.stage=$('stage').value;return new URLSearchParams(out);}
async function load(force=false){
  if(!$('controls').reportValidity())return;
  labels.records=$('stage').value==='prospects'?'Inquiry records':'Booking records';
  const recordOption=$('measure').querySelector('[value=records]');if(recordOption)recordOption.textContent=labels.records;
  if($('period').value!=='all'&&$('start').value>$('end').value){$('status').textContent='Choose a start date before the end date.';return;}
  const params=parameters(),cacheKey=params.toString(),request=++state.request;
  $('report').hidden=true;$('error').hidden=true;$('download-brief').disabled=true;state.data=null;
  $('status').textContent='Loading country and demand reporting…';$('refresh').disabled=true;
  try{
    const cached=state.cache.get(cacheKey);let data;
    if(!force&&cached&&Date.now()-cached.at<900000)data=cached.data;
    else{const response=await fetch('/api/maps?'+params,{cache:'no-store',signal:AbortSignal.timeout(45000)});data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'Report unavailable.');state.cache.set(cacheKey,{at:Date.now(),data});if(state.cache.size>12)state.cache.delete(state.cache.keys().next().value);}
    if(request!==state.request)return;state.data=data;state.city='';populateCountries();render();$('report').hidden=false;$('download-brief').disabled=false;
    $('status').textContent=`${web()?'GA4':'CRM'} reporting · ${data.start?data.start+' through '+data.end:'All recorded tour dates'} · ${data.timeZone} · ${data.updated_at?'Source refreshed '+new Date(data.updated_at).toLocaleString():'Source refresh time unavailable'}.`;
  }catch(error){if(request!==state.request)return;$('error').hidden=false;$('error-message').textContent=error.message;$('status').textContent='No report displayed. Refresh to retry.';}
  finally{if(request===state.request)$('refresh').disabled=false;}
}
function switchSource(source){
  state.source=source;state.country='';state.city='';$('continent').value='';$('search').value='';
  $('website').setAttribute('aria-pressed',web());$('guests').setAttribute('aria-pressed',!web());$('stage-field').hidden=web();$('period').querySelector('[value="all"]').hidden=web();$('period').value=web()?'28':'all';
  $('measure').innerHTML=(web()?['sessions','engagedSessions','totalUsers']:['records','guests']).map(k=>`<option value="${k}">${labels[k]}</option>`).join('');
  $('geography').value='countries';$('geography').querySelector('[value="cities"]').disabled=!web();$('map-mode').value='volume';$('map-mode').disabled=!web();$('palette').value=web()?'teal':'forest';$('country-rank').value='volume';
  $('country-rank').disabled=!web();$('city-panel').hidden=!web();$('detail-panels').hidden=!web();$('city-style-field').hidden=true;range();load();
}
function populateCountries(){
  const rows=countryRows().filter(row=>!$('continent').value||state.features.find(f=>f.id===row.code)?.continent===$('continent').value).sort((a,b)=>a.country.localeCompare(b.country));
  $('country').replaceChildren(new Option('All markets',''),...rows.map(row=>new Option(row.country,key(row))));
  if(state.country&&!rows.some(row=>key(row)===state.country)){const feature=state.features.find(f=>f.id===state.country);if(feature&&(!$('continent').value||feature.continent===$('continent').value))$('country').append(new Option(feature.name+' · no reported rows',state.country));else state.country='';}$('country').value=state.country;
}
function metric(label,value,note){return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`;}
function render(){
  if(!state.data)return;const d=state.data,rows=currentRows(),now=rows.filter(row=>row.reported!==false),metricKey=measure(),total=sum(now,web()?'sessions':'records'),unknown=now.filter(row=>!row.code),warnings=[];
  $('scope-label').textContent=scopeName();
  $('metrics').innerHTML=web()?metric('Sessions',number(total),scopeName())+metric('Engaged sessions',number(sum(now,'engagedSessions')),'Visits meeting GA4 engagement criteria')+metric('Reported markets',number(now.filter(row=>row.code).length),'Countries with current-period rows')+metric('Sessions vs prior period',deltaLabel(total,sum(rows.map(row=>row.prior||{}),'sessions')),d.previous.start+' through '+d.previous.end):metric($('stage').value==='prospects'?'Inquiry records':'Booking records',number(total),scopeName()+' · not unique people')+metric('Recorded guests',number(sum(now,'guests')),sum(now,'missingGuestCounts')+' group sizes unavailable')+metric('Reported countries',number(now.filter(row=>row.code).length),'Recorded booking-contact country')+metric('Country coverage',total?percent(sum(now.filter(row=>row.code),'records')/total):'—',number(sum(unknown,'records'))+' records unknown or unmapped');
  if(web()){
    if(d.limited||d.prior.limited)warnings.push('Google reports thresholding, sampling or grouped data. Comparisons may be incomplete.');
    const unavailable=Object.entries(d.details||{}).filter(([,report])=>report.status!=='connected').map(([name])=>name.replace('_',' '));if(unavailable.length)warnings.push('Extended reporting unavailable: '+unavailable.join(', ')+'. Country reporting remains available.');
    if(Object.values(d.details||{}).some(report=>report.limited)||Object.values(d.prior.details||{}).some(report=>report.limited))warnings.push('Some detailed reports are limited by Google; drilldowns and trends may be incomplete.');
    warnings.push('Website geography estimates visitor location, not residence. Consent and reporting delays limit measured coverage.');
  }else{
    if(sum(now,'missingGuestCounts'))warnings.push('Recorded guest totals exclude missing or ambiguous group sizes.');
    if(d.missingDates)warnings.push(d.missingDates+' matching-stage records lack tour dates and are excluded from this range.');
    if(d.missingTrendDates)warnings.push(d.missingTrendDates+' selected records lack tour dates; the guest trend is partial.');
    if(d.stages.overdue)warnings.push(d.stages.overdue+' confirmed records have past dates without verified completion.');
    warnings.push(d.excluded+' archived, cancelled, lost or duplicate records excluded; '+d.duplicates+' repeated IDs removed. Guest cities are not available because the CRM does not record reliable home-city data.');
  }
  if(unknown.length)warnings.push(number(sum(unknown,web()?'sessions':'records'))+' '+(web()?'sessions':'records')+' in this scope have unknown or unmapped countries.');
  $('warning').textContent=warnings.join(' ');$('warning').hidden=!warnings.length;
  $('map-title').textContent=(isGrowth()?'Growth and decline':web()?'Where website interest comes from':'Where guests and inquiries come from');
  $('map-subtitle').textContent=scopeName()+' · '+(web()?d.start+' through '+d.end:$('stage').selectedOptions[0].textContent);
  $('definition').textContent=web()?'Sessions measure visits; engaged sessions show deeper activity. Users are counted within each country or city, and must not be added together as worldwide unique visitors. City locations are estimates, not individual tracking. Growth includes countries and cities with prior-period rows but no current rows.':d.countryBasis+' Completed tours require a completed status; past dates alone do not prove attendance. Group totals can include repeat travelers across bookings.';
  $('table-note').textContent=web()?'Change compares '+labels[metricKey].toLowerCase()+' with the previous equal-length period. Prior-only markets are retained as zero current reported activity. Engagement ranking requires at least 20 current sessions.':'Group totals belong to the booking contact’s recorded country. Sparklines show dated booking activity; missing dates are excluded from trends.';
  renderMap();renderTable();renderCities();renderTrend();renderDrilldowns();renderInsights();renderBriefing();renderSelection();
}
function colorValue(value,max,colors=PALETTES[$('palette').value].colors){const t=$('scale').value==='log'?Math.log1p(value)/Math.log1p(max||1):value/(max||1);return interpolate(colors,t);}
function renderMap(){
  if(!state.data)return;const rows=currentRows(),metricKey=measure(),cityView=$('geography').value==='cities',max=Math.max(1,...rows.map(row=>isGrowth()?Math.abs((row[metricKey]||0)-(row.prior?.[metricKey]||0)):row[metricKey]||0));
  const colors=PALETTES[$('palette').value].colors;$('city-style-field').hidden=!cityView;$('scale').disabled=isGrowth();
  for(const path of $('countries').children){
    const row=rows.find(item=>item.code===path.dataset.code);let fill='#cbd6d9',description='No matching reported rows';
    if(row&&!cityView){const value=row[metricKey]||0,delta=value-(row.prior?.[metricKey]||0);fill=isGrowth()?interpolate(GROWTH_COLORS,.5+delta/(max*2)):row.reported===false?'#cbd6d9':colorValue(value,max);description=isGrowth()?(delta>0?'+':'')+number(delta)+' '+labels[metricKey]+' vs prior':number(value)+' '+labels[metricKey]+(row.reported===false?' · no current rows':'');}
    path.setAttribute('fill',fill);path.classList.toggle('selected',state.country===path.dataset.code);path.setAttribute('aria-label',path.dataset.name+': '+description);path.querySelector('title').textContent=path.dataset.name+': '+description;
  }
  $('city-markers').replaceChildren();$('map-defs').replaceChildren();
  let note=isGrowth()?'Orange shows declines, neutral shows no change, teal shows gains. Color measures absolute change, not percentage.':$('scale').value==='log'?'Balanced shading reveals smaller markets. Read exact values in the rankings.':'Linear shading follows reported volume.';
  const gradient=document.querySelector('.gradient');gradient.style.background='linear-gradient(90deg,'+(isGrowth()?GROWTH_COLORS:colors).join(',')+')';
  $('legend-min').textContent=isGrowth()?'−'+number(max):'0';
  $('legend-max').textContent=isGrowth()?'+'+number(max)+' '+labels[metricKey]:number(Math.max(0,...rows.map(row=>row[metricKey]||0)))+' '+labels[metricKey];
  if(cityView&&web()){
    const report=state.data.details?.cities;
    if(report?.status!=='connected')note='City reporting is unavailable. Connect the extended GA4 report; country reporting remains available.';
    else{
      const eligible=currentCities(),located=rank(eligible.filter(row=>row.coordinates),metricKey,isGrowth()?'gain':'volume').sort((a,b)=>isGrowth()?Math.abs((b[metricKey]||0)-(b.prior?.[metricKey]||0))-Math.abs((a[metricKey]||0)-(a.prior?.[metricKey]||0)):b[metricKey]-a[metricKey]).slice(0,200),maxCity=Math.max(1,...located.map(row=>isGrowth()?Math.abs((row[metricKey]||0)-(row.prior?.[metricKey]||0)):row[metricKey]||0));
      for(const [index,row] of located.entries()){
        const delta=(row[metricKey]||0)-(row.prior?.[metricKey]||0),value=isGrowth()?Math.abs(delta):row[metricKey]||0;if(!value)continue;
        const circle=document.createElementNS(NS,'circle'),title=document.createElementNS(NS,'title'),fill=isGrowth()?interpolate(GROWTH_COLORS,.5+delta/(maxCity*2)):interpolate(colors,row.engagementRate||0),x=(row.coordinates.lon+180)*2.5,y=(85-row.coordinates.lat)*2.5,r=Math.max(2,Math.sqrt(value/maxCity)*16);
        circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',r);circle.setAttribute('fill',fill);circle.setAttribute('tabindex','0');circle.setAttribute('role','button');circle.setAttribute('stroke','#ffffff');circle.setAttribute('stroke-width','1');circle.setAttribute('vector-effect','non-scaling-stroke');circle.classList.toggle('selected',state.city===row.id);
        if($('city-style').value==='glow'){const gradient=document.createElementNS(NS,'radialGradient');gradient.id='city-glow-'+index;for(const [offset,opacity] of [['0%',.85],['65%',.35],['100%',0]]){const stop=document.createElementNS(NS,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color',fill);stop.setAttribute('stop-opacity',opacity);gradient.append(stop);}$('map-defs').append(gradient);circle.setAttribute('fill','url(#'+gradient.id+')');circle.setAttribute('r',r*1.7);circle.setAttribute('stroke','none');}
        const label=cityName(row)+': '+number(row[metricKey]||0)+' '+labels[metricKey]+', '+percent(row.engagementRate)+' engagement';title.textContent=label;circle.setAttribute('aria-label',label);circle.append(title);circle.onclick=()=>selectCity(row.id);circle.onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectCity(row.id);}};$('city-markers').prepend(circle);
      }
      const plotted=sum(located.filter(row=>row.reported!==false),'sessions'),all=sum(eligible.filter(row=>row.reported!==false),'sessions');
      note=(isGrowth()?'Bubble area shows absolute change; color shows gain or decline.':'Bubble area shows '+labels[metricKey].toLowerCase()+'; color shows engagement rate from pale to dark.')+' '+$('city-markers').children.length+' city centers plotted (maximum 200), covering '+(all?percent(plotted/all):'—')+' of named-city sessions in this scope. Unmatched cities stay in the Top 10 and report tables.';
      if($('city-style').value==='glow')note+=' Glow marks approximate city centers; it does not estimate activity between them.';
      if(isGrowth()){$('legend-min').textContent='−'+number(maxCity);$('legend-max').textContent='+'+number(maxCity)+' '+labels[metricKey];}else{$('legend-min').textContent='0% engagement';$('legend-max').textContent='100% engagement';}
    }
  }
  $('scale-note').textContent=note+' Select a country or city before zooming to center it.';
}
function sparkline(points){if(!points.length)return '<span class="muted">No dated rows</span>';const max=Math.max(1,...points.map(p=>p.value));return '<svg class="sparkline" viewBox="0 0 100 24" role="img" aria-label="Activity trend"><polyline fill="none" stroke="'+PALETTES[$('palette').value].colors[2]+'" stroke-width="2" points="'+points.map((p,i)=>(points.length===1?50:i/(points.length-1)*98+1).toFixed(1)+','+(22-p.value/max*20).toFixed(1)).join(' ')+'"/></svg>';}
function countryTrend(row){if(!web())return (row.series||[]).map(p=>({date:p.date,value:p[measure()]||0}));const report=state.data.details?.daily;if(report?.status!=='connected')return [];return dailySeries(report.rows.filter(p=>key(p)===key(row)),state.data.start,state.data.end);}
function tableRows(){const query=$('search').value.trim().toLowerCase();let rows=currentRows().filter(row=>row.country.toLowerCase().includes(query));return rank(rows,measure(),web()?$('country-rank').value:'volume',web()&&$('country-rank').value==='engagement'?MIN_SESSIONS:0);}
function headers(){return web()?['Country','Sessions','Users','Engaged','Engagement','Change · '+labels[measure()],'Trend']:['Contact country','Records','Recorded guests','Group sizes missing','Trend'];}
function values(row){return web()?[row.country,row.sessions,row.totalUsers,row.engagedSessions,percent(row.engagementRate),deltaLabel(row[measure()]||0,row.prior?.[measure()]||0)]:[row.country,row.records,row.guests,row.missingGuestCounts];}
function renderTable(){
  $('table-head').innerHTML='<tr>'+headers().map(label=>'<th scope="col">'+esc(label)+'</th>').join('')+'</tr>';$('table-body').replaceChildren();
  const rows=tableRows();if(!rows.length){$('table-body').innerHTML='<tr><td colspan="'+headers().length+'">No country rows match this selection.</td></tr>';return;}
  rows.forEach(row=>{const tr=document.createElement('tr');values(row).forEach((value,index)=>{const td=document.createElement('td');if(index===0){const button=document.createElement('button');button.textContent=value+(row.reported===false?' · prior only':'');button.onclick=()=>selectCountry(key(row));td.append(button);}else td.textContent=typeof value==='number'?number(value):value;tr.append(td);});const trend=document.createElement('td');trend.innerHTML=sparkline(countryTrend(row));tr.append(trend);$('table-body').append(tr);});
}
function renderCities(){
  $('city-panel').hidden=!web();if(!web())return;const report=state.data.details?.cities;$('city-body').replaceChildren();
  $('city-note').textContent=scopeName()+' · '+state.data.start+' through '+state.data.end+' · ranks follow the selected measure and dates.';
  $('city-head').innerHTML='<tr>'+['City · region · country',labels[measure()],'Engagement','Change','Trend'].map(label=>'<th scope="col">'+esc(label)+'</th>').join('')+'</tr>';
  if(report?.status!=='connected'){$('city-status').textContent=report?.reason||'City reporting is unavailable.';return;}
  const cityMetric=measure(),minimum=$('city-rank').value==='engagement'?Math.max(MIN_SESSIONS,Number($('city-min').value)):Number($('city-min').value),rows=rank(currentCities(),cityMetric,$('city-rank').value,minimum).slice(0,10),unknown=scoped(report.rows,scope()).filter(row=>row.city==='(not set)');
  $('city-status').textContent=number(sum(unknown,'sessions'))+' sessions have no reported city. Engagement and emerging-market signals require at least '+MIN_SESSIONS+' sessions. City centers are approximate.';
  if(!rows.length){$('city-body').innerHTML='<tr><td colspan="5">No named cities meet this selection’s minimum.</td></tr>';return;}
  rows.forEach(row=>{const tr=document.createElement('tr'),td=document.createElement('td'),button=document.createElement('button');button.textContent=cityName(row)+(row.coordinates?'':' · map location unavailable');button.onclick=()=>selectCity(row.id);td.append(button);tr.append(td);for(const value of [number(row[cityMetric]||0),percent(row.engagementRate),deltaLabel(row[cityMetric]||0,row.prior?.[cityMetric]||0)]){const cell=document.createElement('td');cell.textContent=value;tr.append(cell);}const trend=document.createElement('td');trend.innerHTML=sparkline(state.data.details.daily?.status==='connected'?dailySeries(state.data.details.daily.rows.filter(p=>p.cityKey===row.id),state.data.start,state.data.end):[]);tr.append(trend);$('city-body').append(tr);});
}
function renderSelection(){
  const row=state.city?cityRows().find(row=>row.id===state.city):currentRows().find(row=>key(row)===state.country);
  if(!row){if(state.country){$('selection').textContent=scopeName()+': no matching reported rows in this selection.';return;}$('selection').textContent='Select a country to focus every report, or select a city to inspect its trend and traffic breakdown.';return;}
  $('selection').innerHTML='<h3>'+esc(state.city?cityName(row):row.country)+'</h3><div class="selection-grid">'+(web()?[[labels[measure()],number(row[measure()]||0)],['Engagement',percent(row.engagementRate)],['Change',deltaLabel(row[measure()]||0,row.prior?.[measure()]||0)]]:[[labels.records,number(row.records)],['Recorded guests',number(row.guests)]]).map(([label,value])=>'<span>'+esc(label)+'<strong>'+esc(value)+'</strong></span>').join('')+'</div>';
}
function renderTrend(){
  $('clear-city').hidden=!state.city;const selected=cityRows().find(row=>row.id===state.city);$('trend-title').textContent=web()?'Interest over time · '+(selected?cityName(selected):scopeName()):'Dated guest activity · '+scopeName();
  let current,prior=[];
  if(web()){
    const report=state.data.details?.daily,old=state.data.prior.details?.daily;
    if(report?.status!=='connected'){$('trend').innerHTML='<p class="module-state">'+esc(report?.reason||'Daily reporting is unavailable.')+'</p>';$('trend-note').textContent='Country totals remain available.';return;}
    current=dailySeries(scoped(report.rows,scope(true)),state.data.start,state.data.end);
    if(old?.status==='connected')prior=dailySeries(scoped(old.rows,scope(true)),state.data.previous.start,state.data.previous.end);
    $('trend-note').textContent='Daily sessions · current period vs the previous '+current.length+' days, aligned by day number. Empty dates mean no reported rows.'+(old?.status!=='connected'?' Prior trend unavailable.':'');
  }else{
    const points=currentRows().flatMap(row=>(row.series||[]).map(p=>({date:p.date,sessions:p[measure()]||0})));
    current=dailySeries(points,state.data.start,state.data.end);if(!state.data.start||current.length>90)current=compactMonths(current);
    $('trend-note').textContent=(state.data.start?'Selected tour dates':'All recorded dated activity')+' · '+labels[measure()].toLowerCase()+' · missing dates excluded. This is an activity timeline, not a website conversion funnel.';
  }
  if(!current.length){$('trend').innerHTML='<p class="module-state">No dated activity is available in this scope.</p>';return;}
  const max=Math.max(1,...current.map(p=>p.value),...prior.map(p=>p.value)),points=series=>series.map((p,i)=>[(current.length===1?500:50+i/(current.length-1)*900).toFixed(1),(180-p.value/max*140).toFixed(1)].join(',')).join(' '),color=PALETTES[$('palette').value].colors[3];
  const ticks=[0,Math.floor((current.length-1)/2),current.length-1];
  $('trend').innerHTML='<div class="trend-summary"><span>'+number(sum(current,'value'))+' '+(web()?'current-period sessions':labels[measure()].toLowerCase())+'</span>'+(prior.length?'<span>'+number(sum(prior,'value'))+' prior-period sessions</span>':'')+'</div><svg class="trend-chart" viewBox="0 0 1000 230" role="img" aria-label="'+esc($('trend-title').textContent)+'"><line x1="50" x2="950" y1="180" y2="180" stroke="#c8d3c3"/><text x="5" y="45">'+number(max)+'</text><text x="15" y="185">0</text>'+(prior.length?'<polyline fill="none" stroke="#95a8ad" stroke-dasharray="6 4" stroke-width="2.5" points="'+points(prior)+'"/>':'')+'<polyline fill="none" stroke="'+color+'" stroke-width="3" points="'+points(current)+'"/>'+current.map((p,i)=>'<circle cx="'+(current.length===1?500:50+i/(current.length-1)*900).toFixed(1)+'" cy="'+(180-p.value/max*140).toFixed(1)+'" r="3" fill="'+color+'"><title>'+esc(p.date+': '+number(p.value)+(prior[i]?' · prior '+prior[i].date+': '+number(prior[i].value):''))+'</title></circle>').join('')+ticks.map(i=>'<text x="'+(current.length===1?500:50+i/(current.length-1)*900).toFixed(1)+'" y="215" text-anchor="'+(i===0?'start':i===current.length-1?'end':'middle')+'">'+esc(current[i].date)+'</text>').join('')+'</svg><p class="muted">Solid line: selected period. '+(prior.length?'Dashed line: previous period.':'')+'</p>';
}
function renderDrilldowns(){
  $('detail-panels').hidden=!web();if(!web())return;const city=cityRows().find(row=>row.id===state.city),name=city?cityName(city):scopeName();
  $('source-scope').textContent=name+' · sessions grouped by source / medium and campaign.';$('page-scope').textContent=name+' · sessions grouped by landing page; page interest is not a confirmed booking.';
  for(const [reportName,target,field] of [['sources','sources','source'],['landing_pages','landing-pages','page']]){
    const report=state.data.details?.[reportName];if(report?.status!=='connected'){$(target).innerHTML='<p class="module-state">'+esc(report?.reason||'Detailed reporting is unavailable.')+'</p>';continue;}
    const rows=scoped(report.rows,scope(true)),groups=rollup(rows,field).slice(0,10);
    $(target).innerHTML=groups.length?'<div class="table-wrap"><table><thead><tr><th scope="col">'+(field==='page'?'Landing page':'Source / medium')+'</th><th scope="col">Sessions</th><th scope="col">Engagement</th></tr></thead><tbody>'+groups.map(row=>'<tr><td class="break-word">'+esc(row.label)+'</td><td>'+number(row.sessions)+'</td><td>'+percent(row.engagementRate)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="module-state">No matching reported rows.</p>';
    if(field==='source'){const campaigns=rollup(rows.filter(row=>!['(not set)','(direct)','(organic)'].includes(row.campaign)),'campaign').slice(0,5);if(campaigns.length)$(target).innerHTML+='<h3>Leading campaigns</h3><ul class="campaign-list">'+campaigns.map(row=>'<li>'+esc(row.label)+' <strong>'+number(row.sessions)+' sessions</strong></li>').join('')+'</ul>';}
  }
}
function renderInsights(){
  const rows=currentRows(),ranked=rank(rows.filter(row=>row.code),measure()),signals=[];
  if(ranked[0]?.[measure()]>0)signals.push('<strong>'+esc(ranked[0].country)+'</strong> leads this scope with '+number(ranked[0][measure()])+' '+labels[measure()].toLowerCase()+'.');
  if(web()){
    const qualified=qualifiedSignals(rows,measure()),gainers=rank(rows.filter(row=>row.code),measure(),'gain'),losers=rank(rows.filter(row=>row.code),measure(),'loss');
    if(gainers[0]&&compare(gainers[0][measure()]||0,gainers[0].prior?.[measure()]||0).delta>0)signals.push('<strong>Largest gain: '+esc(gainers[0].country)+'</strong> · +'+number(compare(gainers[0][measure()]||0,gainers[0].prior?.[measure()]||0).delta)+' '+labels[measure()].toLowerCase()+'.');
    if(losers[0]&&compare(losers[0][measure()]||0,losers[0].prior?.[measure()]||0).delta<0)signals.push('<strong>Largest decline: '+esc(losers[0].country)+'</strong> · '+number(compare(losers[0][measure()]||0,losers[0].prior?.[measure()]||0).delta)+' '+labels[measure()].toLowerCase()+'. Review acquisition and page interest before drawing conclusions.');
    if(qualified.mostEngaged)signals.push('<strong>Most engaged: '+esc(qualified.mostEngaged.country)+'</strong> · '+percent(qualified.mostEngaged.engagementRate)+' engagement across '+number(qualified.mostEngaged.sessions)+' sessions. Minimum '+MIN_SESSIONS+' sessions.');
    if(qualified.emerging.length)signals.push('<strong>Emerging markets:</strong> '+qualified.emerging.map(row=>esc(row.country)+' ('+number(row.sessions)+' sessions)').join(', ')+'. Each grew from fewer than '+MIN_SESSIONS+' prior sessions to at least '+MIN_SESSIONS+'.');
    const pages=state.data.details?.landing_pages;if(pages?.status==='connected'){const top=rollup(scoped(pages.rows,scope()),'page')[0];if(top)signals.push('<strong>Partner conversation:</strong> '+esc(top.label)+' is the leading entry page in this scope ('+number(top.sessions)+' sessions). Review its subject alongside your available lodging, activity and promotion offers; this is an interest signal, not proof of partner demand.');}
    signals.push('For investors: show the period, measured volume, geographic coverage and confirmed outcomes separately. For prospective clients: this report demonstrates a reporting capability; it does not establish that a website change caused the results.');
  }else signals.push('For lodging and activity partners, completed and upcoming bookings provide different evidence. Review tour type, dates and capacity in Guest CRM before making commercial commitments.');
  $('insights').innerHTML=signals.map(text=>'<div class="signal">'+text+'</div>').join('')||'<p>No qualifying signals in this selection.</p>';
}
function renderBriefing(){
  const rows=currentRows().filter(row=>row.reported!==false),brief=briefing(rows,{source:state.source,metric:measure(),start:state.data.start,end:state.data.end,stage:!web()?$('stage').selectedOptions[0].textContent:''});
  $('brief-scope').textContent=scopeName()+' · '+brief.period+' · '+(web()?'GA4 measured activity':brief.stage)+' · source refreshed '+(state.data.updated_at?new Date(state.data.updated_at).toLocaleString():'time unavailable');
  const story=web()?'This selection records '+number(sum(rows,'sessions'))+' website sessions, including '+number(sum(rows,'engagedSessions'))+' engaged sessions. These are measured visits, not unique prospective customers or confirmed bookings.':'This selection contains '+number(sum(rows,'records'))+' eligible booking or inquiry records and '+number(sum(rows,'guests'))+' recorded guests. Repeat travelers and incomplete group counts can affect these totals.';
  $('brief-content').innerHTML='<p class="brief-story">'+esc(story)+'</p><h3>Leading markets with sufficient recorded activity</h3>'+(brief.markets.length?'<div class="brief-markets">'+brief.markets.map(row=>'<div><strong>'+esc(row.country)+'</strong><span>'+number(row[measure()]||0)+' '+labels[measure()].toLowerCase()+'</span></div>').join('')+'</div>':'<p>No markets meet the briefing threshold.</p>')+'<p class="muted">The leading-market list requires '+brief.minimum+' '+(web()?'sessions':'records')+' in this selection. '+percent(brief.coverage)+' of the selected '+labels[measure()].toLowerCase()+' have a mapped country code. Unknown and smaller markets remain in overall totals.</p><div class="brief-uses"><div><h3>Investors</h3><p>Assess recorded reach, engagement and changes over time. Validate bookings and financial performance separately.</p></div><div><h3>Lodging &amp; activity partners</h3><p>Use geographic interest and tour-page entry patterns to plan a partnership discussion, then validate guest needs and available capacity.</p></div><div><h3>Website &amp; promotion clients</h3><p>Demonstrate how reporting connects audience location, acquisition and content interest. This is a capability example, not a promise of future results.</p></div></div>';
}
function selectCountry(code){
  state.country=code;state.city='';if($('continent').value&&state.features.find(f=>f.id===code)?.continent!==$('continent').value)$('continent').value='';populateCountries();render();
}
function selectCity(id){state.city=id;renderSelection();renderTrend();renderDrilldowns();renderMap();}
function zoom(amount){state.zoom=Math.max(1,Math.min(6,state.zoom+amount));const w=900/state.zoom,h=405/state.zoom,city=cityRows().find(row=>row.id===state.city),path=[...$('countries').children].find(p=>p.dataset.code===state.country),box=path?.getBBox(),cx=city?.coordinates?(city.coordinates.lon+180)*2.5:box?box.x+box.width/2:450,cy=city?.coordinates?(85-city.coordinates.lat)*2.5:box?box.y+box.height/2:202.5;$('map').setAttribute('viewBox',[Math.max(0,Math.min(900-w,cx-w/2)),Math.max(0,Math.min(405-h,cy-h/2)),w,h].join(' '));}
function clearScope(){if(!state.data)return;state.country='';state.city='';$('continent').value='';populateCountries();state.zoom=1;zoom(0);render();}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportCSV(){
  if(!state.data)return;const safe=value=>'"'+(/^[=+@\-\t\r]/.test(String(value??''))?"'":'')+String(value??'').replace(/"/g,'""')+'"';
  const meta=[['Source',state.source],['Period',state.data.start||'All recorded tour dates',state.data.end||''],['Market',scopeName()],['Stage',web()?'':$('stage').selectedOptions[0].textContent],['Timezone',state.data.timeZone],['Source refreshed',state.data.updated_at||'Unavailable'],['Country counts are geographic slices; users must not be summed as worldwide unique users'],[]];
  const rows=[...meta,headers().slice(0,-1),...tableRows().map(values)];
  if(web()&&state.data.details?.cities?.status==='connected')rows.push([],['Top named cities (selected ranking and minimum)'],['City','Region','Country',labels[measure()],'Engagement','Change'],...rank(currentCities(),measure(),$('city-rank').value,$('city-rank').value==='engagement'?Math.max(MIN_SESSIONS,Number($('city-min').value)):Number($('city-min').value)).slice(0,10).map(row=>[row.city,row.region,row.country,row[measure()]||0,percent(row.engagementRate),deltaLabel(row[measure()]||0,row.prior?.[measure()]||0)]));
  download('mbw-'+state.source+'-markets.csv','\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
function setPresentation(enabled){state.presentation=enabled;document.body.dataset.presentation=String(enabled);$('briefing').hidden=!enabled;$('presentation').textContent=enabled?'Return to interactive reporting':'Investor & partner briefing';}
function downloadBrief(){
  if(!state.data)return;const brief=$('briefing').innerHTML,map=$('map').cloneNode(true);map.removeAttribute('id');map.querySelectorAll('[tabindex]').forEach(el=>{el.removeAttribute('tabindex');el.removeAttribute('role');});
  const trend=$('trend').innerHTML,available=web()?Object.entries(state.data.details||{}).map(([name,r])=>name.replace('_',' ')+': '+r.status).join(' · '):'CRM recorded-country reporting; guest city data unavailable.';
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Mindo Bird Watching · Demand briefing</title><style>body{font:15px/1.6 Arial,sans-serif;color:#15332d;background:#f5f8f4;margin:0;padding:30px}main{max-width:1100px;margin:auto}section{background:white;border:1px solid #d8e4dc;border-radius:16px;padding:24px;margin:20px 0}h1,h2,h3{font-family:Georgia,serif;color:#075451}h1{font-size:36px}.eyebrow{font-size:12px;letter-spacing:.1em;text-transform:uppercase}.metrics,.brief-markets,.brief-uses{display:flex;flex-wrap:wrap;gap:18px}.metric,.brief-markets>div,.brief-uses>div{flex:1;min-width:160px}.metric strong,.brief-markets span{display:block}.metric strong{font-size:28px}.muted,.metric small{font-size:12px;color:#52685e}svg{width:100%;height:auto;max-height:500px}svg path{stroke:white;stroke-width:.65;vector-effect:non-scaling-stroke}#countries{background:#eaf0f1}table{width:100%;border-collapse:collapse;font-size:12px}td,th{text-align:left;padding:8px;border-bottom:1px solid #d8e4dc;overflow-wrap:anywhere}.notice{background:#f3f5ec;padding:16px}.trend-summary{display:flex;gap:20px}.sparkline{width:80px}.module-state{padding:12px;background:#eef4f1}@media print{body{padding:0;background:white}section{break-inside:avoid}svg{print-color-adjust:exact}}</style></head><body><main><h1>Mindo Bird Watching</h1><p>Market demand evidence · prepared '+esc(new Date().toLocaleString())+'</p><section>'+brief+'</section><section class="metrics">'+$('metrics').innerHTML+'</section><section><h2>'+esc($('map-title').textContent)+'</h2><p>'+esc($('map-subtitle').textContent)+'</p>'+map.outerHTML+'<p class="muted">'+esc($('scale-note').textContent)+'</p><p class="muted">Map: Natural Earth. City centers: GeoNames, CC BY 4.0. Geographic locations are approximate.</p></section><section><h2>'+esc($('trend-title').textContent)+'</h2>'+trend+'<p class="muted">'+esc($('trend-note').textContent)+'</p></section>'+(web()?'<section><h2>Sources and entry pages · '+esc(state.city?cityName(cityRows().find(row=>row.id===state.city)):scopeName())+'</h2>'+$('sources').innerHTML+$('landing-pages').innerHTML+'</section>':'')+'<section><h2>Coverage and definitions</h2><p class="notice">'+esc($('warning').textContent)+'</p><p>'+esc($('definition').textContent)+'</p><p>'+esc(available)+'</p><p class="muted">This is a static aggregate snapshot, prepared for manual sharing. No CRM guest identities or contact information are included. Website interest is not verified bookings, revenue, market size, or proof of causality. The private administration hub is not included.</p></section></main></body></html>';
  download('mbw-demand-briefing-'+(state.data.end||today())+'.html',html,'text/html;charset=utf-8');
}
$('website').onclick=()=>switchSource('website');$('guests').onclick=()=>switchSource('guests');$('period').onchange=()=>{range();load();};$('stage').onchange=()=>load();[$('start'),$('end')].forEach(input=>input.onchange=()=>{$('period').value='custom';});$('controls').onsubmit=event=>{event.preventDefault();load();};$('refresh').onclick=()=>load(true);
$('measure').onchange=render;$('palette').onchange=render;$('scale').onchange=renderMap;$('map-mode').onchange=render;$('geography').onchange=renderMap;$('city-style').onchange=renderMap;$('search').oninput=()=>{if(state.data)renderTable();};$('country-rank').onchange=()=>{if(state.data)renderTable();};$('city-rank').onchange=()=>{if(state.data)renderCities();};$('city-min').onchange=()=>{if(state.data)renderCities();};
$('country').onchange=()=>{if(!state.data)return;state.country=$('country').value;state.city='';render();};$('continent').onchange=()=>{if(!state.data)return;state.city='';populateCountries();render();};$('clear-scope').onclick=clearScope;$('clear-city').onclick=()=>{state.city='';render();};$('zoom-in').onclick=()=>zoom(.5);$('zoom-out').onclick=()=>zoom(-.5);$('reset').onclick=clearScope;
$('export').onclick=exportCSV;$('presentation').onclick=()=>setPresentation(!state.presentation);$('download-brief').onclick=downloadBrief;$('print').onclick=()=>{if(state.data){setPresentation(true);window.print();}};
fetch('/assets/maps/world.json').then(response=>{if(!response.ok)throw new Error();return response.json();}).then(features=>{state.features=features;features.forEach(feature=>{const path=document.createElementNS(NS,'path'),title=document.createElementNS(NS,'title');path.setAttribute('d',feature.path);path.dataset.code=feature.id;path.dataset.name=feature.name;path.setAttribute('fill','#cbd6d9');path.setAttribute('tabindex','0');path.setAttribute('role','button');path.append(title);path.onclick=()=>{if(state.data)selectCountry(feature.id);};path.onkeydown=event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();if(state.data)selectCountry(feature.id);}};$('countries').append(path);});if(state.data){populateCountries();render();}}).catch(()=>{$('scale-note').textContent='Map boundaries could not load. Rankings remain available.';});
setInterval(()=>{if(!document.hidden)load();},900000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});switchSource('website');
