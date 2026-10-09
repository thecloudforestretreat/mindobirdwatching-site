import {authorize} from '../whatsapp/index.js';
import {extractRecords} from '../whatsapp/crm.js';
import {conversationContext,validateSummary} from '../../../admin/assets/js/crm-summary.mjs';
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const CRM='https://n8n.mindobirdwatching.com/webhook/mbw-crm-admin-api';
async function read(action){const response=await fetch(CRM,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({payload:JSON.stringify({action,filters:{}})}),signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error();const data=await response.json();if(data.ok===false)throw Error();return extractRecords(data);}
export async function onRequestPost({request,env}){
 const denied=await authorize(request);if(denied)return denied;
 if(request.headers.get('Origin')!==new URL(request.url).origin)return reply(403,{error:'Open through Guest CRM.'});
 if(!env.CRM_SUMMARY_TOKEN)return reply(503,{error:'Local summaries are unavailable.'});
 let id;try{const raw=await request.text();if(raw.length>500)throw Error();id=JSON.parse(raw).inquiryId;if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id))throw Error();}catch{return reply(400,{error:'Select a saved inquiry.'});}
 try{
  const [records,rows]=await Promise.all([read('list_inquiries'),read('list_interactions')]);const record=records.find(r=>r.inquiry_id===id);if(!record)return reply(404,{error:'Inquiry not found.'});
  const messages=conversationContext(rows,id);if(!messages.length)return reply(409,{error:'No recorded conversation to summarize. Log guest messages or staff replies first.'});
  const response=await fetch('https://n8n.mindobirdwatching.com/webhook/mbw-crm-local-summary',{method:'POST',headers:{'Content-Type':'application/json','X-CRM-Summary-Key':env.CRM_SUMMARY_TOKEN,'User-Agent':'Mozilla/5.0 CRM Summary'},body:JSON.stringify({messages}),signal:AbortSignal.timeout(55000)});if(!response.ok)throw Error();const data=await response.json();const summary=validateSummary(data.result,messages.map(m=>m.id));return reply(200,{...summary,model:'qwen3.5:9b',generatedAt:new Date().toISOString(),readOnly:true});
 }catch{return reply(503,{error:'Local summary unavailable or response invalid. Retry later. No record was changed.'});}
}
