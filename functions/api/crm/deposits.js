import {authorize} from '../whatsapp/index.js';
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function onRequestGet({request,env}) {
 const denied=await authorize(request);if(denied)return denied;
 const id=new URL(request.url).searchParams.get('inquiry_id') || '';
 if(!/^INQ-[A-Za-z0-9_-]{1,100}$/.test(id))return reply(400,{ok:false,error:'Select a saved inquiry.'});
 if(!env.CF_SHARED_SECRET)return reply(503,{ok:false,error:'Deposit history is not configured.'});
 try {
  const url=new URL('https://mbw-stripe-checkout.thecloudforestretreat.workers.dev/api/deposits/history');url.searchParams.set('inquiry_id',id);
  const r=await fetch(url,{headers:{Authorization:'Bearer '+env.CF_SHARED_SECRET},signal:AbortSignal.timeout(20000)});
  const data=await r.json();if(!r.ok || data.ok!==true)throw Error();
  return reply(200,data);
 }catch{return reply(503,{ok:false,error:'Stripe deposit history is unavailable. Retry; no records were changed.'});}
}
