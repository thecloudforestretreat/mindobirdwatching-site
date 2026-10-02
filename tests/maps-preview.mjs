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
    return Response.json({ok:true,start:u.searchParams.get('start'),end:u.searchParams.get('end'),updated_at:'2026-10-02T12:00:00Z',reports:{countries:{rows:[{country:'United States',sessions:prior?70:140,totalUsers:100,engagedSessions:85},{country:'Canada',sessions:40,totalUsers:30,engagedSessions:25},{country:'Germany',sessions:20,totalUsers:18,engagedSessions:15},{country:'(not set)',sessions:5,totalUsers:4,engagedSessions:1}],metadata:{timeZone:'America/Guayaquil'},truncated:false}}});
  }
  if(String(url).includes('mbw-crm-admin-api'))return Response.json({ok:true,count:5,records:[{inquiry_id:'a',status:'completed',country:'US',guest_count:'2'},{inquiry_id:'b',status:'booked',requested_date:'2099-01-01',country:'Canada',guest_count:'4'},{inquiry_id:'c',status:'booked',requested_date:'2020-01-01',country:'Germany',guest_count:'3'},{inquiry_id:'d',status:'quoted',country:'France',guest_count:'2'},{inquiry_id:'e',status:'completed',guest_count:''}]});
  throw new Error('Unexpected external request in QA');
};
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost:8797');
  if(u.pathname==='/api/maps'){const response=await onRequestGet({request:new Request(u)});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;}
  let target=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  if(!fs.existsSync(target)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res);
}).listen(8797,'127.0.0.1',()=>console.log('Synthetic map QA: http://127.0.0.1:8797/analytics/maps/'));
