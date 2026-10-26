import {authorize} from '../whatsapp/index.js';
import {listRecords} from '../../lib/mobile-crm.mjs';
import {buildBalances} from '../../lib/crm-balances.mjs';
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function onRequestGet({request,env}){
 const denied=await authorize(request);if(denied)return denied;
 try{
  const [inquiries,payments,deposits]=await Promise.all([listRecords(env,'list_inquiries'),listRecords(env,'list_payments'),listRecords(env,'list_accounting_deposits')]);
  return reply(200,{ok:true,...buildBalances({inquiries,payments,deposits})});
 }catch{return reply(503,{ok:false,error:'Accounting balances are unavailable. Retry; no records were changed.'});}
}
