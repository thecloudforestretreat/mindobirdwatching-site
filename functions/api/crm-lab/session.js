import {mobileIdentity} from '../../lib/mobile-auth.mjs';
import {json,errorResponse,mobileWriteReady} from '../../lib/mobile-http.mjs';
export async function onRequestGet({request,env}){try{const i=await mobileIdentity(request,env);return json(200,{ok:true,staffCode:i.staffCode||'',name:i.name,canEditFollowup:mobileWriteReady(env,i)})}catch(e){return errorResponse(e)}}
