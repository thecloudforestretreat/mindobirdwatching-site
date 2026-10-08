const q=$('Authorize Administrator').first().json,contexts=$('Build report requests').all();
const domains=[...new Set(contexts.map(i=>i.json.domain))];
const sites=domains.map(domain=>({domain,...(!q.domain?{sessions:null,priorSessions:null,engagedSessions:null,priorEngagedSessions:null,search:null,priorSearch:null,trend:null,searchTrend:null,channels:null,pages:null,events:null,queries:null,searchPages:null,opportunities:null}:{landingPages:null,referrers:null,campaigns:null,analyticsCountries:null,analyticsDevices:null,priorQueries:null,priorSearchPages:null,searchCountries:null,priorSearchCountries:null,searchDevices:null,priorSearchDevices:null})}));
const value=(r,i)=>Number(r.metricValues?.[i]?.value||0);
const label=(r,i)=>r.dimensionValues?.[i]?.value;
const usable=r=>r&&Array.isArray(r.metricHeaders)&&!r.error;
const mapped=r=>(r.rows||[]).map(row=>Object.fromEntries([...(r.dimensionHeaders||[]).map((h,i)=>[h.name,label(row,i)]),...(r.metricHeaders||[]).map((h,i)=>[h.name,value(row,i)])]));
const grouped=r=>{if(!usable(r))return null;const map=new Map();for(const row of mapped(r)){const name=row[(r.dimensionHeaders||[]).find(h=>h.name!=='dateRange')?.name],prior=row.dateRange==='previous';if(!map.has(name))map.set(name,{name,sessions:0,priorSessions:0,engagedSessions:0,priorEngagedSessions:0});const x=map.get(name);x[prior?'priorSessions':'sessions']+=row.sessions||0;x[prior?'priorEngagedSessions':'engagedSessions']+=row.engagedSessions||0;}return [...map.values()].sort((a,b)=>b.sessions-a.sessions);};
const searchRows=rows=>rows.map(r=>({name:r.keys[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}));
for(const [i,item] of $input.all().entries()){
 const c=contexts[i]?.json;if(!c)continue;const p=item.json,s=sites.find(v=>v.domain===c.domain);if(!p||p.error)continue;
 if(c.source==='gaBatch'||c.source==='gaDetails'){
  if(!Array.isArray(p.reports)||p.reports.length!==5)continue;
  if(c.source==='gaDetails'){['landingPages','referrers','campaigns','analyticsCountries','analyticsDevices'].forEach((key,i)=>s[key]=grouped(p.reports[i]));}
  else{
   const [totals,trend,channels,pages,events]=p.reports;
   if(usable(totals)){for(const prior of [false,true]){const name=prior?'previous':'current';const r=(totals.rows||[]).find(r=>label(r,0)===name);s[prior?'priorSessions':'sessions']=r?value(r,0):0;s[prior?'priorEngagedSessions':'engagedSessions']=r?value(r,1):0;}}
   if(usable(trend))s.trend=(trend.rows||[]).map(r=>({date:label(r,0).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),sessions:value(r,0)}));
   s.channels=grouped(channels);
   if(usable(pages))s.pages=(pages.rows||[]).map(r=>({path:label(r,0),views:value(r,0)}));
   if(usable(events)){const map=new Map();for(const r of mapped(events)){const name=r.eventName;if(!map.has(name))map.set(name,{name,count:0,priorCount:0});map.get(name)[r.dateRange==='previous'?'priorCount':'count']+=r.eventCount||0;}s.events=[...map.values()];}
  }
  s.analyticsCaveats=p.reports.some(r=>r.metadata?.subjectToThresholding||r.metadata?.dataLossFromOtherRow||r.metadata?.samplingMetadatas?.length)?'Google applied privacy thresholds, row limits or sampling; some detail may be omitted.':null;
 }else{
  if(!Array.isArray(p.rows)&&Object.keys(p).length>0&&!('responseAggregationType' in p))continue;
  const rows=p.rows||[];
  if(c.source==='search'){const r=rows[0];s[c.prior?'priorSearch':'search']={impressions:r?.impressions||0,clicks:r?.clicks||0,position:r?.position??null};}
  if(c.source==='searchTrend')s.searchTrend=rows.map(r=>({date:r.keys[0],impressions:r.impressions,clicks:r.clicks}));
  if(['queries','priorQueries','searchPages','priorSearchPages'].includes(c.source)){s[c.source]=searchRows(rows);if(c.source.endsWith('Pages'))s[c.source].forEach(r=>{r.url=r.name;delete r.name});}
  if(c.source==='queries')s.opportunities=rows.filter(r=>r.impressions>=20&&((r.position>=8&&r.position<=20)||(r.impressions>=100&&r.ctr<.01))).sort((a,b)=>b.impressions-a.impressions).slice(0,5).map(r=>({name:r.keys[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position,reason:r.position>=8&&r.position<=20?'Position 8–20':'CTR below 1%'}));
  if(c.source==='country')s[c.prior?'priorSearchCountries':'searchCountries']=searchRows(rows);
  if(c.source==='device')s[c.prior?'priorSearchDevices':'searchDevices']=searchRows(rows);
 }
}
const trendStart=new Date(Date.parse(q.end+'T00:00:00Z')-89*86400000).toISOString().slice(0,10);
return [{json:{ok:true,version:3,details:Boolean(q.domain),includeTests:Boolean(q.includeTests),start:q.start,end:q.end,priorStart:q.priorStart,priorEnd:q.priorEnd,trendStart,updatedAt:new Date().toISOString(),sites}}];
