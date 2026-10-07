const q=$('Authorize Administrator').first().json;
const contexts=$('Build report requests').all();
const domains=[...new Set(contexts.map(i=>i.json.domain))];
const sites=domains.map(domain=>({domain,sessions:null,priorSessions:null,engagedSessions:null,priorEngagedSessions:null,search:null,priorSearch:null,trend:null,searchTrend:null,channels:null,pages:null,events:null,queries:null,searchPages:null,opportunities:null}));
const value=(r,i)=>Number(r.metricValues?.[i]?.value||0);
const label=(r,i)=>r.dimensionValues?.[i]?.value;
const usable=r=>r&&Array.isArray(r.metricHeaders)&&!r.error;
for(const [i,item] of $input.all().entries()){
 const c=contexts[i]?.json;if(!c)continue;const p=item.json,s=sites.find(v=>v.domain===c.domain);if(!p||p.error)continue;
 if(c.source==='gaBatch'){
  if(!Array.isArray(p.reports)||p.reports.length!==5)continue;
  const [totals,trend,channels,pages,events]=p.reports;
  if(usable(totals)){
   for(const prior of [false,true]){
    const name=prior?'previous':'current';const r=(totals.rows||[]).find(r=>label(r,0)===name);
    s[prior?'priorSessions':'sessions']=r?value(r,0):0;s[prior?'priorEngagedSessions':'engagedSessions']=r?value(r,1):0;
   }
  }
  if(usable(trend))s.trend=(trend.rows||[]).map(r=>({date:label(r,0).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),sessions:value(r,0)}));
  if(usable(channels)){
   const map=new Map();for(const r of channels.rows||[]){const name=label(r,0),prior=label(r,1)==='previous';if(!map.has(name))map.set(name,{name,sessions:0,priorSessions:0});map.get(name)[prior?'priorSessions':'sessions']+=value(r,0)}s.channels=[...map.values()].sort((a,b)=>b.sessions-a.sessions);
  }
  if(usable(pages))s.pages=(pages.rows||[]).map(r=>({path:label(r,0),views:value(r,0)}));
  if(usable(events))s.events=(events.rows||[]).map(r=>({name:label(r,0),count:value(r,0)}));
  s.analyticsCaveats=p.reports.some(r=>r.metadata?.subjectToThresholding||r.metadata?.samplingMetadatas?.length)?'Google applied privacy thresholds or sampling; some detail may be omitted.':null;
 }else{
  if(!Array.isArray(p.rows)&&Object.keys(p).length>0&&!('responseAggregationType' in p))continue;
  const rows=p.rows||[];
  if(c.source==='search'){const r=rows[0];s[c.prior?'priorSearch':'search']={impressions:r?.impressions||0,clicks:r?.clicks||0,position:r?.position??null};}
  if(c.source==='searchTrend')s.searchTrend=rows.map(r=>({date:r.keys[0],impressions:r.impressions,clicks:r.clicks}));
  if(c.source==='queries'){
   s.queries=rows.slice(0,10).map(r=>({name:r.keys[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}));
   s.opportunities=rows.filter(r=>r.impressions>=20&&((r.position>=8&&r.position<=20)||(r.impressions>=100&&r.ctr<.01))).sort((a,b)=>b.impressions-a.impressions).slice(0,5).map(r=>({name:r.keys[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position,reason:r.position>=8&&r.position<=20?'Position 8–20':'CTR below 1%'}));
  }
  if(c.source==='searchPages')s.searchPages=rows.map(r=>({url:r.keys[0],clicks:r.clicks,impressions:r.impressions,ctr:r.ctr,position:r.position}));
 }
}
const trendStart=new Date(Date.parse(q.end+'T00:00:00Z')-89*86400000).toISOString().slice(0,10);
return [{json:{ok:true,version:2,start:q.start,end:q.end,priorStart:q.priorStart,priorEnd:q.priorEnd,trendStart,updatedAt:new Date().toISOString(),sites}}];
