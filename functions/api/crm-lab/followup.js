import {mobileIdentity} from '../../lib/mobile-auth.mjs';
import {crmCall,listRecords} from '../../lib/mobile-crm.mjs';
import {json,errorResponse,validId,assertSameOrigin,assertMobileWriteReady,mobileWriteReady,readJson,methodNotAllowed} from '../../lib/mobile-http.mjs';
import {todayInEcuador} from '../../lib/mobile-domain.mjs';
import {followupRecord,validateFollowupPatch,applyFollowupPatch} from '../../lib/crm-lab-followup.mjs';
async function load(env,id){const rows=await listRecords(env,'list_inquiries',{filters:{}});const found=rows.find(r=>String(r.inquiry_id)===id);if(!found)throw Object.assign(Error('Inquiry not found.'),{status:404});return found}
export async function onRequestGet({request,env}){try{const identity=await mobileIdentity(request,env),id=validId(new URL(request.url).searchParams.get('inquiryId'));const raw=await load(env,id);return json(200,{ok:true,canEdit:mobileWriteReady(env,identity),staffCode:identity.staffCode||'',record:followupRecord(raw)})}catch(error){return errorResponse(error)}}
export async function onRequestPatch({request,env}){try{
 const identity=await mobileIdentity(request,env);assertMobileWriteReady(env,identity);assertSameOrigin(request,env);
 const body=await readJson(request,9000),id=validId(body.inquiryId),patch=validateFollowupPatch(body.patch,todayInEcuador());
 if(typeof body.expectedUpdatedAt!=='string')return json(400,{ok:false,error:'Refresh this record before saving.'});
 const raw=await load(env,id);if(['yes','true','1'].includes(String(raw.is_archived||'').toLowerCase())||raw.status==='duplicate')return json(409,{ok:false,error:'Archived/duplicate records stay read-only.'});if(String(raw.updated_at||'')!==body.expectedUpdatedAt)return json(409,{ok:false,error:'This guest record changed. Reload the editor and review before saving.'});
 const updated=applyFollowupPatch(raw,patch,identity.staffCode,new Date().toISOString());
 await crmCall(env,'update_inquiry',{record:updated,inquiry_row:updated,expected_updated_at:body.expectedUpdatedAt});
 const verified=await load(env,id),actual=followupRecord(verified),expected=followupRecord(updated);
 if(['notes','followupDate','nextAction','waitingOn'].some(k=>actual[k]!==expected[k]))return json(202,{ok:true,verified:false,error:'Save was submitted but not verified. Reload before retrying.'});
 return json(200,{ok:true,verified:true,record:actual});
 }catch(error){return errorResponse(error,'Save could not be confirmed. Reload the editor before retrying.')}}
export function onRequestPost(){return methodNotAllowed(['GET','PATCH'])}
