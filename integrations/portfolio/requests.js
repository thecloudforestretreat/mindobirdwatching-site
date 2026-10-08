const q=$('Authorize Administrator').first().json;
const props={"mindobirdwatching.com":"474681565","thecloudforestretreat.com":"449392042","experienceecuador.com":"516211767","mindotours.com":"555190853","chocoandinotours.com":"555387617","experiencetheamazon.com":"557349745","businessbuyingandselling.com":"525388203","eyesondanang.com":"557171133","arguellodentistry.com":"358273543"};
if(q.domain&&!Object.hasOwn(props,q.domain))throw Error('Invalid site');
const trendStart=new Date(Date.parse(q.end+'T00:00:00Z')-89*86400000).toISOString().slice(0,10);
const dates=[{startDate:q.start,endDate:q.end,name:'current'},{startDate:q.priorStart,endDate:q.priorEnd,name:'previous'}];
const excludedPath='^/(?:[a-z]{2}/)?(?:testing[0-9]*|admin|preview|staging|qa)(?:/|$).*';
const out=[];
for(const [domain,property] of Object.entries(props)){
 if(q.domain&&q.domain!==domain)continue;
 if(q.mode==='inspection'){
  const site=['experienceecuador.com','arguellodentistry.com'].includes(domain)?'https://'+domain+'/':'sc-domain:'+domain;
  if(!Array.isArray(q.pages)||q.pages.length<1||q.pages.length>3)throw Error('Invalid pages');
  for(const page of q.pages){const match=String(page).match(/^https:\/\/([^/?#]+)(\/[^?#]*)$/);if(!match||![domain,'www.'+domain].includes(match[1]))throw Error('Invalid page');out.push({json:{domain,source:'inspection',page,url:'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',body:{inspectionUrl:page,siteUrl:site,languageCode:'en-US'}}});}continue;
 }
 const host={filter:{fieldName:'hostName',inListFilter:{values:[domain,'www.'+domain],caseSensitive:false}}};
 const filter=q.includeTests?host:{andGroup:{expressions:[host,{notExpression:{filter:{fieldName:'pagePath',stringFilter:{matchType:'FULL_REGEXP',value:excludedPath,caseSensitive:false}}}}]}};
 const report=(dimensions,metrics,dateRanges=dates,extra={})=>({dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name})),dateRanges,dimensionFilter:filter,...extra});
 const descending=name=>[{metric:{metricName:name},desc:true}];
 const limited={orderBys:descending('sessions'),limit:'20'};
 if(q.mode==='conversions'){
  const dates90=[{startDate:trendStart,endDate:q.end}],events=['form_submit_success','generate_lead','booking_success','lead_submit','contact_success','appointment_request_success','phone_click','call_click','email_click','click_email','whatsapp_click','click_whatsapp'];
  const eventFilter={andGroup:{expressions:[filter,{filter:{fieldName:'eventName',inListFilter:{values:events}}}]}};
  out.push({json:{domain,source:'conversions',url:'https://analyticsdata.googleapis.com/v1beta/properties/'+property+':batchRunReports',body:{requests:[report(['date','eventName'],['eventCount'],dates90,{dimensionFilter:eventFilter,limit:'2000',orderBys:[{dimension:{dimensionName:'date'}}]})]}}});continue;
 }
 if(q.mode==='query'){
  if(typeof q.query!=='string'||!q.query.trim()||q.query.length>250||/[\u0000-\u001f]/.test(q.query))throw Error('Invalid query');
  const site=['experienceecuador.com','arguellodentistry.com'].includes(domain)?'https://'+domain+'/':'sc-domain:'+domain,url='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(site)+'/searchAnalytics/query';
  const filtered={type:'web',dataState:'final',dimensionFilterGroups:[{groupType:'and',filters:[{dimension:'query',operator:'equals',expression:q.query}]}]};
  for(const [source,startDate,endDate,dimensions] of [['queryTotals',q.start,q.end,[]],['priorQueryTotals',q.priorStart,q.priorEnd,[]],['queryPages',q.start,q.end,['page']],['queryTrend',trendStart,q.end,['date']]])out.push({json:{domain,source,url,body:{...filtered,startDate,endDate,dimensions,rowLimit:dimensions[0]==='date'?90:1000}}});continue;
 }
 const reports=q.domain?[
  report(['landingPage'],['sessions','engagedSessions'],dates,limited),
  report(['sessionSourceMedium'],['sessions','engagedSessions'],dates,limited),
  report(['sessionCampaignName'],['sessions','engagedSessions'],dates,limited),
  report(['country'],['sessions','engagedSessions'],dates,limited),
  report(['deviceCategory'],['sessions','engagedSessions'])
 ]:[
  report([],['sessions','engagedSessions']),
  report(['date'],['sessions'],[{startDate:trendStart,endDate:q.end}],{orderBys:[{dimension:{dimensionName:'date'}}],limit:'90'}),
  report(['sessionDefaultChannelGroup'],['sessions']),
  report(['pagePath'],['screenPageViews'],[dates[0]],{orderBys:descending('screenPageViews'),limit:'10'}),
  report(['eventName'],['eventCount'],dates,{limit:'1000'})
 ];
 out.push({json:{domain,source:q.domain?'gaDetails':'gaBatch',url:'https://analyticsdata.googleapis.com/v1beta/properties/'+property+':batchRunReports',body:{requests:reports}}});
 const site=['experienceecuador.com','arguellodentistry.com'].includes(domain)?'https://'+domain+'/':'sc-domain:'+domain;
 const url='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(site)+'/searchAnalytics/query';
 const search=(source,body,prior=false)=>out.push({json:{domain,source,prior,url,body:{type:'web',dataState:'final',...body}}});
 if(q.domain){
  search('priorQueries',{startDate:q.priorStart,endDate:q.priorEnd,dimensions:['query'],rowLimit:1000});
  search('priorSearchPages',{startDate:q.priorStart,endDate:q.priorEnd,dimensions:['page'],rowLimit:1000});
  for(const dimension of ['country','device'])for(const prior of [false,true])search(dimension,{startDate:prior?q.priorStart:q.start,endDate:prior?q.priorEnd:q.end,dimensions:[dimension],rowLimit:250},prior);
 }else{
  search('search',{startDate:q.start,endDate:q.end});search('search',{startDate:q.priorStart,endDate:q.priorEnd},true);
  search('searchTrend',{startDate:trendStart,endDate:q.end,dimensions:['date'],rowLimit:90});
  search('queries',{startDate:q.start,endDate:q.end,dimensions:['query'],rowLimit:1000});
  search('searchPages',{startDate:q.start,endDate:q.end,dimensions:['page'],rowLimit:1000});
 }
}
return out;
