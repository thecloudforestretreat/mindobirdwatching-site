import {authorize} from '../whatsapp/index.js';
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function onRequestPost({request,env}) {
 const denied=await authorize(request);if(denied)return denied;
 if(new URL(request.url).origin !== request.headers.get('Origin'))return reply(403,{ok:false,error:'Same-origin request required.'});
 let id;try{id=(await request.json()).inquiry_id;if(!/^INQ-[A-Za-z0-9_-]{1,100}$/.test(id||''))throw Error();}catch{return reply(400,{ok:false,error:'Select a saved inquiry.'});}
 if(!env.CF_SHARED_SECRET)return reply(503,{ok:false,error:'Invoice reconciliation is not configured.'});
 try{
  const r=await fetch('https://mbw-stripe-checkout.thecloudforestretreat.workers.dev/api/invoices/reconcile',{method:'POST',headers:{Authorization:'Bearer '+env.CF_SHARED_SECRET,'Content-Type':'application/json'},body:JSON.stringify({inquiry_id:id}),signal:AbortSignal.timeout(20000)});
  const data=await r.json();if(!r.ok||!data.ok)throw Error();return reply(200,data);
 }catch{return reply(503,{ok:false,error:'Invoice reconciliation incomplete. Retry safely; no invoice was created or sent.'});}
}
