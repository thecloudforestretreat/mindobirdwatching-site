(() => {
  'use strict';
  const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
  const state={source:'website',data:null,features:[],cache:new Map(),request:0,selected:'',zoom:1};
  const number=value=>new Intl.NumberFormat('en-US').format(value);
  const percent=value=>value===null?'—':(value*100).toFixed(1)+'%';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={sessions:'Sessions',totalUsers:'Users',engagedSessions:'Engaged sessions',records:'Booking records',guests:'Recorded guests'};
  const dayOffset=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
  function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function range(){
    const all=$('period').value==='all';
    $('start').disabled=all;$('end').disabled=all;
    if(!all && $('period').value!=='custom') { $('end').value=dayOffset(today(),-1);$('start').value=dayOffset($('end').value,1-Number($('period').value)); }
  }
  function parameters(){
    const out={source:state.source};
    if($('period').value!=='all'){out.start=$('start').value;out.end=$('end').value;}
    if(state.source==='guests')out.stage=$('stage').value;
    return new URLSearchParams(out);
  }
  async function load(force=false){
    if(!$('controls').reportValidity())return;
    if($('period').value!=='all'&&$('start').value>$('end').value){$('status').textContent='Choose a start date before the end date.';return;}
    const params=parameters(),key=params.toString(),request=++state.request;
    $('report').hidden=true;$('error').hidden=true;state.data=null;
    $('status').textContent='Loading country reporting…';$('refresh').disabled=true;
    try {
      const cached=state.cache.get(key);let data;
      if(!force&&cached&&Date.now()-cached.at<900000)data=cached.data;
      else {const response=await fetch('/api/maps?'+params,{cache:'no-store',signal:AbortSignal.timeout(45000)});data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'Report unavailable.');state.cache.set(key,{at:Date.now(),data});if(state.cache.size>12)state.cache.delete(state.cache.keys().next().value);}
      if(request!==state.request)return;
      state.data=data;state.selected='';render();$('report').hidden=false;
      $('status').textContent=`${data.source==='website'?'GA4':'CRM'} reporting · ${data.start?data.start+' through '+data.end:'All recorded tour dates'} · ${data.timeZone} · ${data.updated_at?'Source refreshed '+new Date(data.updated_at).toLocaleString():'Source refresh time unavailable'}.`;
    }catch(error){if(request!==state.request)return;$('error').hidden=false;$('error-message').textContent=error.message;$('status').textContent='No report displayed. Refresh to retry.';}
    finally{if(request===state.request)$('refresh').disabled=false;}
  }
  function switchSource(source){
    state.source=source;$('website').setAttribute('aria-pressed',source==='website');$('guests').setAttribute('aria-pressed',source==='guests');
    $('stage-field').hidden=source!=='guests';$('period').querySelector('[value="all"]').hidden=source!=='guests';
    $('period').value=source==='guests'?'all':'28';
    $('measure').innerHTML=(source==='website'?['sessions','engagedSessions','totalUsers']:['records','guests']).map(key=>`<option value="${key}">${labels[key]}</option>`).join('');
    if(source==='guests')$('measure').options[0].textContent='Booking records';
    $('search').value='';$('continent').value='';range();load();
  }
  const sum=(rows,key)=>rows.reduce((total,row)=>total+(row[key]||0),0);
  const growth=(current,prior)=>prior===undefined?'Unavailable':prior===0?(current?'New activity':'No activity'):((current-prior)/prior*100).toFixed(1)+'%';
  function priorFor(row){return state.data.prior?.rows.find(old=>(old.code||old.country)===(row.code||row.country));}
  function metric(label,value,note){return `<div class="metric"><span>${escape(label)}</span><strong>${escape(value)}</strong><small>${escape(note)}</small></div>`;}
  function render(){
    const d=state.data,rows=d.rows,web=state.source==='website',total=sum(rows,web?'sessions':'records'),known=rows.filter(row=>row.code),unknown=rows.filter(row=>!row.code),warnings=[];
    const previous=d.prior?sum(d.prior.rows,'sessions'):undefined;
    $('metrics').innerHTML=web?metric('Sessions',number(total),'Country-report total')+metric('Engaged sessions',number(sum(rows,'engagedSessions')),'Sessions meeting GA4 engagement criteria')+metric('Reported countries',number(known.length),'Countries with returned rows')+metric('Sessions vs prior period',growth(total,previous),d.previous.start+' through '+d.previous.end):metric($('stage').value==='prospects'?'Inquiry records':'Booking records',number(total),'Distinct records, not unique people')+metric('Recorded guests',number(sum(rows,'guests')),d.missingGuestCounts+' records lack a reliable guest count')+metric('Reported countries',number(known.length),'Based on recorded contact country')+metric('Country coverage',total?percent(sum(known,'records')/total):'—',number(sum(unknown,'records'))+' records unknown or unmapped');
    if(web&&(d.limited||d.prior.limited))warnings.push('Google reports thresholding, sampling or grouped data. Comparisons may be incomplete.');
    if(web)warnings.push('GA4 reports measured activity; consent choices, reporting delays and location estimates limit coverage.');
    if(unknown.length)warnings.push(`${number(sum(unknown,web?'sessions':'records'))} ${web?'sessions':'records'} have unknown or unmapped countries; they remain in the table and totals.`);
    if(!web){if(d.missingGuestCounts)warnings.push(`${d.missingGuestCounts} records have missing or ambiguous group sizes. Recorded guests is a partial total.`);if(d.missingDates)warnings.push(`${d.missingDates} matching-stage records lack a tour date and were excluded from this date range.`);if(d.stages.overdue)warnings.push(`${d.stages.overdue} confirmed records have past tour dates without verified completion. Review them in Guest CRM.`);warnings.push(`${d.excluded} archived, cancelled, lost or duplicate records excluded; ${d.duplicates} repeated record IDs removed.`);}
    $('warning').textContent=warnings.join(' ');$('warning').hidden=!warnings.length;
    $('map-title').textContent=web?'Where website interest comes from':'Where guest bookings come from';
    $('map-subtitle').textContent=web?'Select a country to compare interest with the previous equal-length period.':$('stage').selectedOptions[0].textContent+' · tour-date filters · Ecuador calendar dates';
    $('definition').textContent=web?'Sessions measure visits; engaged sessions show deeper activity. Users are counted within each country and should not be added together as unique worldwide visitors. Geographic reporting estimates visitor location, not residence or nationality.':d.countryBasis+' Completed tours require a completed status; past dates alone do not prove attendance. Current and upcoming use confirmed records and their scheduled dates. Group totals can include repeat travelers across bookings.';
    $('table-note').textContent=web?'Sorted by the selected map measure. Change compares the same measure with the prior period; missing prior-country rows are treated as zero reported activity.':'Sorted by the selected map measure. Guest counts reflect the booking contact’s group, not separately verified traveler origins.';
    $('selection').textContent='Select a country to inspect its results.';renderMap();renderTable();renderInsights();
  }
  function renderMap(){
    if(!state.data)return;const key=$('measure').value,rows=state.data.rows,max=Math.max(1,...rows.filter(row=>row.code).map(row=>row[key]||0));
    const stops=[[255,244,197],[226,186,79],[217,118,48],[154,41,27]];
    for(const path of $('countries').children){const row=rows.find(item=>item.code===path.dataset.code),value=row?.[key]||0;let color='#cad5d8';
      if(row){const t=$('scale').value==='log'?Math.log1p(value)/Math.log1p(max):value/max,index=Math.min(2,Math.floor(t*3)),fraction=t*3-index;color='rgb('+stops[index].map((v,i)=>Math.round(v+(stops[index+1][i]-v)*fraction)).join(',')+')';}
      path.setAttribute('fill',color);const text=path.dataset.name+': '+(row?number(value)+' '+labels[key]:'No matching reported rows');path.setAttribute('aria-label',text);path.querySelector('title').textContent=text;path.classList.toggle('selected',state.selected===path.dataset.code);
    }
    $('legend-max').textContent=number(Math.max(0,...rows.filter(row=>row.code).map(row=>row[key]||0)))+' '+labels[key];$('scale-note').textContent=($('scale').value==='log'?'Balanced colors use a logarithmic scale so smaller markets stay visible. Read exact values in the country list.':'Linear colors scale directly with reported volume.')+' Select a country before zooming to center it.';
  }
  function visibleRows(){
    const query=$('search').value.trim().toLowerCase(),continent=$('continent').value;
    return state.data.rows.filter(row=>row.country.toLowerCase().includes(query)&&(!continent||state.features.find(f=>f.id===row.code)?.continent===continent)).sort((a,b)=>(b[$('measure').value]||0)-(a[$('measure').value]||0)||a.country.localeCompare(b.country));
  }
  function cells(row){const web=state.source==='website';return web?[row.country,row.sessions,row.totalUsers,row.engagedSessions,percent(row.engagementRate),growth(row[$('measure').value],priorFor(row)?.[$('measure').value]||0)]:[row.country,row.records,row.guests,row.missingGuestCounts];}
  function headers(){return state.source==='website'?['Country','Sessions','Users','Engaged','Engagement','Change · '+labels[$('measure').value]]:['Contact country','Records','Recorded guests','Group sizes missing'];}
  function renderTable(){
    if(!state.data)return;$('table-head').innerHTML='<tr>'+headers().map(label=>'<th scope="col">'+escape(label)+'</th>').join('')+'</tr>';
    const rows=visibleRows();$('table-body').replaceChildren();
    if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=headers().length;td.textContent='No country rows match this selection.';tr.append(td);$('table-body').append(tr);return;}
    rows.forEach(row=>{const tr=document.createElement('tr');cells(row).forEach((value,index)=>{const td=document.createElement('td');if(index===0){const button=document.createElement('button');button.textContent=value;button.addEventListener('click',()=>select(row.code||row.country));td.append(button);}else td.textContent=typeof value==='number'?number(value):value;tr.append(td);});$('table-body').append(tr);});
  }
  function select(code){
    state.selected=code;const row=state.data?.rows.find(r=>(r.code||r.country)===code),feature=state.features.find(f=>f.id===code);
    if(!row){$('selection').textContent=(feature?.name||'This country')+': no matching reported rows in this selection.';renderMap();return;}
    const values=cells(row),head=headers();
    $('selection').innerHTML='<h3>'+escape(row.country)+'</h3><div class="selection-grid">'+values.slice(1).map((value,index)=>'<span>'+escape(head[index+1])+'<strong>'+escape(typeof value==='number'?number(value):value)+'</strong></span>').join('')+'</div>';
    renderMap();
  }
  function renderInsights(){
    const rows=state.data.rows.filter(row=>row.code),key=$('measure').value,ranked=[...rows].sort((a,b)=>b[key]-a[key]),signals=[];
    if(ranked.length&&ranked[0][key]>0)signals.push(`<strong>${escape(ranked[0].country)}</strong> leads with ${number(ranked[0][key])} ${labels[key].toLowerCase()}.`);
    if(state.source==='website'){
      const movers=rows.map(row=>({row,old:priorFor(row)?.[key]||0,delta:row[key]-(priorFor(row)?.[key]||0)})).filter(item=>item.delta>0).sort((a,b)=>b.delta-a.delta);
      if(movers.length)signals.push(`<strong>${escape(movers[0].row.country)}</strong> has the largest absolute gain: +${number(movers[0].delta)} ${labels[key].toLowerCase()} versus the prior period.`);
      const losses=state.data.prior.rows.filter(row=>row.code).map(old=>({old,delta:(rows.find(row=>row.code===old.code)?.[key]||0)-old[key]})).filter(item=>item.delta<0).sort((a,b)=>a.delta-b.delta);
      if(losses.length)signals.push(`<strong>${escape(losses[0].old.country)}</strong> has the largest absolute decline: ${number(losses[0].delta)} ${labels[key].toLowerCase()} versus the prior period. Check source and content reports before drawing conclusions.`);
      const engaged=[...rows].filter(row=>row.sessions>=20).sort((a,b)=>b.engagementRate-a.engagementRate);
      if(engaged.length)signals.push(`<strong>${escape(engaged[0].country)}</strong> has the highest engagement rate among markets with at least 20 sessions: ${percent(engaged[0].engagementRate)}. This is an exploration signal, not a booking forecast.`);
      signals.push('Use volume and engagement together to choose markets for closer review. Campaign and landing-page drilldowns need a country-by-source report; separate report totals cannot establish those relationships.');
    }else signals.push('Use the stage selector to distinguish actual completed tours from upcoming demand. Correct missing countries and group sizes in Guest CRM to improve coverage.');
    $('insights').innerHTML=signals.map(text=>'<div class="signal">'+text+'</div>').join('')||'<p>No market signals are available for this selection.</p>';
  }
  function zoom(amount){state.zoom=Math.max(1,Math.min(5,state.zoom+amount));const w=900/state.zoom,h=405/state.zoom,path=[...$('countries').children].find(p=>p.dataset.code===state.selected),box=path?.getBBox(),cx=box?box.x+box.width/2:450,cy=box?box.y+box.height/2:202.5;$('map').setAttribute('viewBox',[Math.max(0,Math.min(900-w,cx-w/2)),Math.max(0,Math.min(405-h,cy-h/2)),w,h].join(' '));}
  $('website').onclick=()=>switchSource('website');$('guests').onclick=()=>switchSource('guests');
  $('period').onchange=()=>{range();load();};$('stage').onchange=()=>load();
  [$('start'),$('end')].forEach(input=>input.onchange=()=>{$('period').value='custom';});
  $('controls').onsubmit=event=>{event.preventDefault();load();};$('refresh').onclick=()=>load(true);
  $('measure').onchange=()=>{renderMap();renderTable();renderInsights();if(state.selected)select(state.selected);};$('scale').onchange=renderMap;
  $('search').oninput=renderTable;$('continent').onchange=renderTable;
  $('zoom-in').onclick=()=>zoom(.5);$('zoom-out').onclick=()=>zoom(-.5);$('reset').onclick=()=>{state.zoom=1;zoom(0);state.selected='';renderMap();$('selection').textContent='Select a country to inspect its results.';};
  $('export').onclick=()=>{
    if(!state.data)return;const safe=value=>{const text=String(value??'');return '"'+(/^[=+@\-\t\r]/.test(text)?"'":'')+text.replace(/"/g,'""')+'"';};
    const content=[['Source',state.source],['Period',state.data.start||'All recorded tour dates',state.data.end||''],['Stage',state.source==='guests'?$('stage').selectedOptions[0].textContent:''],['Measure',labels[$('measure').value]],['Timezone',state.data.timeZone],['Source refreshed',state.data.updated_at||'Unavailable'],['Region filter',$('continent').value||'All'],['Country search',$('search').value],[],headers(),...visibleRows().map(cells)].map(row=>row.map(safe).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='mbw-'+state.source+'-countries.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  fetch('/assets/maps/world.json').then(response=>{if(!response.ok)throw new Error();return response.json();}).then(features=>{state.features=features;features.forEach(feature=>{const path=document.createElementNS(NS,'path'),title=document.createElementNS(NS,'title');path.setAttribute('d',feature.path);path.dataset.code=feature.id;path.dataset.name=feature.name;path.setAttribute('fill','#cad5d8');path.setAttribute('tabindex','0');path.setAttribute('role','button');path.append(title);path.onclick=()=>select(feature.id);path.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select(feature.id);}};$('countries').append(path);});if(state.data){renderMap();renderTable();}}).catch(()=>{$('scale-note').textContent='Map boundaries could not load. Country reporting remains available in the table.';});
  setInterval(()=>{if(!document.hidden)load();},900000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  switchSource('website');
})();
