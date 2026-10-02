// Local-only QA server: synthetic reporting fixtures, never production guest data.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {onRequestGet} from '../functions/api/maps.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../admin');
globalThis.fetch=async (url,options)=>{
  if(String(url).includes('mbw-ga4-acquisition')){
    const u=new URL(url),prior=u.searchParams.get('start')<'2026-09-01';
    const start=u.searchParams.get('start'),end=u.searchParams.get('end');
    const cities=[{country:'United States',region:'New York',city:'New York City',cityId:'n',sessions:prior?30:90,totalUsers:60,engagedSessions:65},{country:'United States',region:'California',city:'Los Angeles',cityId:'l',sessions:50,totalUsers:40,engagedSessions:20},{country:'Canada',region:'Ontario',city:'Toronto',cityId:'t',sessions:40,totalUsers:30,engagedSessions:25},{country:'Germany',region:'Berlin',city:'Berlin',cityId:'b',sessions:20,totalUsers:18,engagedSessions:15},{country:'(not set)',region:'(not set)',city:'(not set)',cityId:'',sessions:5,totalUsers:4,engagedSessions:1}];
    if(prior)cities.push({country:'France',region:'Ile-de-France',city:'Paris',cityId:'p',sessions:80,totalUsers:70,engagedSessions:50});
    const report=rows=>({rows,metadata:{timeZone:'America/Guayaquil'},truncated:false});
    return Response.json({ok:true,schema_version:2,start,end,updated_at:'2026-10-02T12:00:00Z',reports:{countries:report(cities.map(({city,region,cityId,...rest})=>rest).filter(r=>r.country!=='United States').concat({country:'United States',sessions:prior?80:140,totalUsers:100,engagedSessions:85})),cities:report(cities),daily:report(cities.map(row=>({...row,date:end.replaceAll('-','')}))),sources:report(cities.map(row=>({...row,sessionSourceMedium:row.cityId==='l'?'partner / referral':'google / organic',sessionCampaignName:row.cityId==='l'?'lodging-network':'(organic)'}))),landing_pages:report(cities.map(row=>({...row,landingPage:row.cityId==='l'?'/lodging/':'/birding-tours/'})))}});

  }
  if(String(url).includes('mbw-crm-admin-api'))return Response.json({ok:true,count:5,records:[{inquiry_id:'a',created_at:'2026-09-15',completed_date:'2026-09-20',accommodation_needs:'yes',status:'completed',country:'US',guest_count:'2'},{inquiry_id:'b',status:'booked',requested_date:'2099-01-01',country:'Canada',guest_count:'4'},{inquiry_id:'c',status:'booked',requested_date:'2020-01-01',country:'Germany',guest_count:'3'},{inquiry_id:'d',status:'quoted',country:'France',guest_count:'2'},{inquiry_id:'e',status:'completed',guest_count:''}]});
  throw new Error('Unexpected external request in QA');
};
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost:8797');
  if(u.pathname==='/api/maps'){const response=await onRequestGet({request:new Request(u)});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;}
  let target=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  if(!fs.existsSync(target)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res);
}).listen(8797,'127.0.0.1',()=>console.log('Synthetic map QA: http://127.0.0.1:8797/analytics/maps/'));
