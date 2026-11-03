import { mobileIdentity } from '../../lib/mobile-auth.mjs';
import { crmCall } from '../../lib/mobile-crm.mjs';
import { json, errorResponse, assertSameOrigin, methodNotAllowed } from '../../lib/mobile-http.mjs';
export const READS = new Set(['list_inquiries','list_interactions','list_assignments','list_providers','list_bookings','list_payments']);
export async function onRequestPost({request,env}) {
 try {
  await mobileIdentity(request,env); assertSameOrigin(request,env);
  const raw=await request.text();
  if(raw.length>12000)return json(413,{ok:false,error:'Read request too large.'});
  let payload;try{payload=JSON.parse(request.headers.get('content-type')?.includes('application/json')?raw:new URLSearchParams(raw).get('payload')||'{}')}catch{return json(400,{ok:false,error:'Invalid read request.'})}
  if(!READS.has(payload.action))return json(403,{ok:false,error:'Guest CRM Lab is read-only. Use the current Guest CRM to save changes.'});
  const filters=payload.filters&&typeof payload.filters==='object'&&!Array.isArray(payload.filters)?payload.filters:{};
  const result=await crmCall(env,payload.action,{filters,guest_id:String(payload.guest_id||'').slice(0,128),inquiry_id:String(payload.inquiry_id||'').slice(0,128)});
  return json(200,result);
 }catch(error){return errorResponse(error,'CRM Lab could not read the existing records.')}
}
export function onRequestGet(){return methodNotAllowed(['POST'])}
