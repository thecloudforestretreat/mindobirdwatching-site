import coordinates from './city-coordinates.mjs';
import {country,validDate} from './maps.mjs';
const metrics=['sessions','totalUsers','engagedSessions'];
const text=value=>String(value||'').trim().slice(0,200);
const norm=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/’/g,"'").trim();
export function locateCity(code,city,region) {
  const cityAliases={'US|new york':'new york city','MX|mexico city':'ciudad de mexico'};
  const lookup=code+'|'+norm(city);
  const entries=coordinates[lookup]||coordinates[code+'|'+cityAliases[lookup]]||[];
  const exact=entries.filter(row=>norm(row[2])===norm(region));
  const candidates=exact.length?exact:entries;
  // Do not guess between same-named cities in different regions.
  if(candidates.length!==1)return null;
  return {lat:candidates[0][0],lon:candidates[0][1],basis:'Approximate city center, GeoNames; not an individual visitor location.'};
}
export function safeLanding(value) {
  const input=text(value);if(input==='(not set)')return input;
  const clean=input.split(/[?#]/)[0];return clean.startsWith('/')&&!clean.startsWith('//')?clean:'Unknown landing page';
}
export function normalizeDetails(payload,start,end) {
  const results={};
  for(const name of ['cities','daily','sources','landing_pages']){
    const report=payload.reports?.[name];
    if(payload.schema_version!==2||!Array.isArray(report?.rows)||report.truncated){results[name]={status:'unavailable',reason:report?.truncated?'Report exceeded its complete-row limit.':'Extended GA4 reporting is not connected yet.',rows:[]};continue;}
    try{
      const seen=new Set();
      const rows=report.rows.map(row=>{
        if(!Object.hasOwn(row,'country'))throw new Error('Country dimension missing.');
        const loc=country(row.country),out={...loc};
        out.city=text(row.city)||'(not set)';out.region=text(row.region)||'(not set)';out.cityId=text(row.cityId);
        out.cityKey=[out.code||out.country,out.region,out.cityId||out.city].join('|');
        for(const key of metrics){if(row[key]===null||row[key]===undefined||!Number.isFinite(Number(row[key]))||Number(row[key])<0)throw new Error('Invalid metric.');out[key]=Number(row[key]);}
        out.engagementRate=out.sessions?out.engagedSessions/out.sessions:null;
        if(name==='cities'){
          out.id=out.cityKey;
          out.coordinates=out.city!=='(not set)'?locateCity(out.code,out.city,out.region):null;
        }
        if(name==='daily'){
          const raw=text(row.date),date=/^\d{8}$/.test(raw)?raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6):raw;
          if(!validDate(date)||date<start||date>end)throw new Error('Daily date outside requested range.');out.date=date;
        }
        if(name==='sources'){out.source=text(row.sessionSourceMedium)||'(not set)';out.campaign=text(row.sessionCampaignName)||'(not set)';}
        if(name==='landing_pages')out.page=safeLanding(row.landingPage);
        if(!Object.hasOwn(row,'city')||!Object.hasOwn(row,'region')||!Object.hasOwn(row,'cityId'))throw new Error('City dimensions missing.');
        const id=name==='cities'?out.id:name==='daily'?[out.cityKey,out.date].join('|'):name==='sources'?[out.cityKey,out.source,out.campaign].join('|'):[out.cityKey,out.page].join('|');
        if(seen.has(id))throw new Error('Duplicate reporting group.');seen.add(id);return out;
      });
      const metadata=report.metadata||{};
      results[name]={status:'connected',rows,limited:Boolean(metadata.subjectToThresholding||metadata.dataLossFromOtherRow||metadata.samplingMetadatas?.length)};
    }catch{results[name]={status:'unavailable',reason:'Report failed completeness or data validation.',rows:[]};}
  }
  return results;
}

export function normalizeCountryDaily(payload,start,end){
 const report=payload?.reports?.country_daily;
 if(!payload?.ok||payload.start!==start||payload.end!==end||!Array.isArray(report?.rows)||report.truncated)return {status:'unavailable',reason:'Country daily reporting unavailable or incomplete.',rows:[]};
 try{const seen=new Set(),rows=report.rows.map(row=>{const loc=country(row.country),raw=String(row.date||''),date=/^\d{8}$/.test(raw)?raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6):raw;if(!Object.hasOwn(row,'country')||!validDate(date)||date<start||date>end)throw Error();const out={...loc,date};for(const key of metrics){if(row[key]===null||row[key]===undefined||!Number.isFinite(Number(row[key]))||Number(row[key])<0)throw Error();out[key]=Number(row[key]);}const id=(loc.code||loc.country)+'|'+date;if(seen.has(id))throw Error();seen.add(id);return out;});return {status:'connected',rows,limited:Boolean(report.metadata?.subjectToThresholding||report.metadata?.dataLossFromOtherRow||report.metadata?.samplingMetadatas?.length)};}catch{return {status:'unavailable',reason:'Country daily validation failed.',rows:[]};}
}
