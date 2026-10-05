import {verifyIdentity} from '../../_middleware.js';
import {normalizeKnowledge} from '../../../admin/assets/js/whatsapp-model.mjs';
const STAFF_SOURCE='https://script.google.com/macros/s/AKfycbzPORSX9WyGwLkBs3BIrkSmdHSPpmPTSQg1CtpGw-8Ak2q9vBEbx8qQ9UdRBCSyrDg/exec';
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
export async function authorize(request){
 const u=new URL(request.url);if(u.hostname!=='admin.mindobirdwatching.com'&&!['localhost','127.0.0.1'].includes(u.hostname))return reply(403,{ok:false,error:'Open through MBW Admin.'});
 if(!['localhost','127.0.0.1'].includes(u.hostname)){try{const identity=await verifyIdentity(request.headers.get('Cf-Access-Jwt-Assertion'));if(identity==='faustoandrade635@gmail.com')return reply(403,{ok:false,error:'Staff workspace access required.'});}catch{return reply(401,{ok:false,error:'Sign in through MBW Admin.'});}}
}
export async function onRequestGet({request}){
 const denied=await authorize(request);if(denied)return denied;
 const body={ok:true,mode:'sample',connected:false,sendingEnabled:false,number:'Ecuador business number · ending 6501',knowledge:{status:'unavailable',items:[]},integrations:{meta:'not_connected',crm:'not_connected',macMini:'planned',media:'planned'}};
 try{const response=await fetch(STAFF_SOURCE,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Unavailable');const items=normalizeKnowledge(await response.json());if(!items.length)throw new Error('Empty');body.knowledge={status:'connected',items,source:'Staff Info Library',checkedAt:new Date().toISOString(),reviewRequired:true};}catch{body.knowledge.reason='Staff Info Library could not be loaded. Open the library to review current information.';}
 return reply(200,body);
}
export async function onRequestPost({request}){const denied=await authorize(request);if(denied)return denied;return reply(409,{ok:false,connected:false,error:'Live messaging is not connected. No message was sent and no CRM record was changed.'});}
