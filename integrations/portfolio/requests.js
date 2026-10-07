const q=$('Authorize Administrator').first().json;
const props={"mindobirdwatching.com":"474681565","thecloudforestretreat.com":"449392042","experienceecuador.com":"516211767","mindotours.com":"555190853","chocoandinotours.com":"555387617","experiencetheamazon.com":"557349745","businessbuyingandselling.com":"525388203","eyesondanang.com":"557171133"};
const trendStart=new Date(Date.parse(q.end+'T00:00:00Z')-89*86400000).toISOString().slice(0,10);
const dates=[{startDate:q.start,endDate:q.end,name:'current'},{startDate:q.priorStart,endDate:q.priorEnd,name:'previous'}];
const out=[];
for(const [domain,property] of Object.entries(props)){
 const host={filter:{fieldName:'hostName',inListFilter:{values:[domain,'www.'+domain],caseSensitive:false}}};
 const report=(dimensions,metrics,dateRanges=dates,extra={})=>({dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name})),dateRanges,dimensionFilter:host,...extra});
 const descending=name=>[{metric:{metricName:name},desc:true}];
 out.push({json:{domain,source:'gaBatch',url:'https://analyticsdata.googleapis.com/v1beta/properties/'+property+':batchRunReports',body:{requests:[
  report([],['sessions','engagedSessions']),
  report(['date'],['sessions'],[{startDate:trendStart,endDate:q.end}],{orderBys:[{dimension:{dimensionName:'date'}}],limit:'90'}),
  report(['sessionDefaultChannelGroup'],['sessions']),
  report(['pagePath'],['screenPageViews'],[dates[0]],{orderBys:descending('screenPageViews'),limit:'10'}),
  report(['eventName'],['eventCount'],[dates[0]],{limit:'1000'})
 ]}}});
 const url='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(domain==='experienceecuador.com'?'https://experienceecuador.com/':'sc-domain:'+domain)+'/searchAnalytics/query';
 const search=(source,body,prior=false)=>out.push({json:{domain,source,prior,url,body:{type:'web',dataState:'final',...body}}});
 search('search',{startDate:q.start,endDate:q.end});search('search',{startDate:q.priorStart,endDate:q.priorEnd},true);
 search('searchTrend',{startDate:trendStart,endDate:q.end,dimensions:['date'],rowLimit:90});
 search('queries',{startDate:q.start,endDate:q.end,dimensions:['query'],rowLimit:1000});
 search('searchPages',{startDate:q.start,endDate:q.end,dimensions:['page'],rowLimit:10});
}
return out;
