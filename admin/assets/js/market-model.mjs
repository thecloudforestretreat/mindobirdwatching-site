export const PALETTES={
  teal:{label:'Cloud Forest Teal',colors:['#e4f4ef','#9cd6c9','#3c9e96','#075451']},
  blue:{label:'Ocean Blue',colors:['#e7f0fc','#adcce9','#4d89b8','#163e68']},
  forest:{label:'Forest Green',colors:['#edf4df','#bdd59b','#689c51','#174d2d']}
};
export const GROWTH_COLORS=['#c07335','#f5f5f0','#147e7c'];
export const MIN_SESSIONS=20;
export const key=row=>row.code||row.country;
export const sum=(rows,metric)=>rows.reduce((total,row)=>total+(Number(row[metric])||0),0);
export function compare(current,prior){const delta=current-prior;return {delta,rate:prior>0?delta/prior:null,newActivity:prior===0&&current>0};}
export function joinPeriods(current,prior=[],id=key){
  const old=new Map(prior.map(row=>[id(row),row])),now=new Map(current.map(row=>[id(row),row]));
  return [...new Set([...now.keys(),...old.keys()])].map(k=>{const row=now.get(k),before=old.get(k);return {...(row||before),...(!row?{sessions:0,totalUsers:0,engagedSessions:0,engagementRate:null}:{}),reported:Boolean(row),prior:before||null};});
}
export function scoped(rows,{country='',continent='',features=[],city=''}={}){
  return rows.filter(row=>(!country||key(row)===country)&&(!continent||features.find(f=>f.id===row.code)?.continent===continent)&&(!city||row.cityKey===city||row.id===city));
}
export function rank(rows,metric,mode='volume',minimum=0){
  const eligible=rows.filter(row=>(mode==='loss'?Math.max(row.sessions??row.records??0,row.prior?.sessions??row.prior?.records??0):row.sessions??row.records??0)>=minimum);
  const value=row=>mode==='engagement'?(row.engagementRate??-1):mode==='gain'?compare(row[metric]||0,row.prior?.[metric]||0).delta:mode==='loss'?-compare(row[metric]||0,row.prior?.[metric]||0).delta:row[metric]||0;
  return [...eligible].sort((a,b)=>Number(!a.code)-Number(!b.code)||value(b)-value(a)||String(a.city||a.country).localeCompare(String(b.city||b.country)));
}
export function rollup(rows,field){const groups=new Map();for(const row of rows){const label=row[field]||'Unknown';const out=groups.get(label)||{label,sessions:0,engagedSessions:0};out.sessions+=row.sessions||0;out.engagedSessions+=row.engagedSessions||0;groups.set(label,out);}return [...groups.values()].map(row=>({...row,engagementRate:row.sessions?row.engagedSessions/row.sessions:null})).sort((a,b)=>b.sessions-a.sessions);}
export function dailySeries(rows,start,end,metric='sessions'){
  const values=new Map();for(const row of rows)values.set(row.date,(values.get(row.date)||0)+(row[metric]||0));
  if(!start||!end)return [...values].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value}));
  const points=[];for(let date=start;date<=end;date=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10))points.push({date,value:values.get(date)||0});return points;
}
export function qualifiedSignals(rows,metric='sessions'){
 const eligible=rows.filter(row=>row.code&&row.sessions>=MIN_SESSIONS);
 const mostEngaged=rank(eligible,metric,'engagement')[0];
 const emerging=rank(eligible.filter(row=>(row.prior?.sessions||0)<MIN_SESSIONS),metric,'gain').filter(row=>row[metric]>(row.prior?.[metric]||0));
 return {mostEngaged,emerging:emerging.slice(0,3),minimum:MIN_SESSIONS};
}
export function rgb(hex){return [1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));}
export function interpolate(colors,value){const t=Math.max(0,Math.min(1,value)),span=colors.length-1,index=Math.min(span-1,Math.floor(t*span)),fraction=t*span-index,a=rgb(colors[index]),b=rgb(colors[index+1]);return 'rgb('+a.map((v,i)=>Math.round(v+(b[i]-v)*fraction)).join(',')+')';}
export function compactMonths(points){const groups=new Map();for(const p of points){const month=p.date.slice(0,7);groups.set(month,(groups.get(month)||0)+p.value);}return [...groups].map(([date,value])=>({date,value}));}
export function briefing(rows,{source,metric='sessions',start,end,stage,minimum=source==='website'?20:5}){
 const eligible=rows.filter(row=>row.code&&(row[source==='website'?'sessions':'records']||0)>=minimum),total=sum(rows,metric);
 return {source,period:start?start+' through '+end:'All recorded tour dates',stage,total,metric,markets:rank(eligible,metric).slice(0,5),minimum,coverage:total?sum(rows.filter(row=>row.code),metric)/total:null,unqualified:rows.length-eligible.length};
}
