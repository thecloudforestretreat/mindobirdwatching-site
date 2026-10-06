// Prepared scheduler; not deployed. Requires an existing D1 binding, private R2 bucket and secret.
import {packBackup,encryptBackup} from '../../admin/assets/js/whatsapp-continuity.mjs';
export async function runBackup(env,now=new Date()){
 if(!env.MBW_ATTRIBUTION_DB||!env.MBW_WHATSAPP_BACKUPS||String(env.BACKUP_PASSPHRASE||'').length<32)throw Error('Backup bindings and recovery secret must be configured');
 const tables=['wa_test_threads','wa_test_staff','wa_test_learning','wa_test_replies','wa_test_events'];
 const rows=await env.MBW_ATTRIBUTION_DB.batch(tables.map(t=>env.MBW_ATTRIBUTION_DB.prepare('SELECT * FROM '+t)));
 const history=rows[2].results,latest=new Map();for(const h of history)if(!latest.has(h.id)||latest.get(h.id).version<h.version)latest.set(h.id,h);
 const snapshot={mode:'shared_test',sendingEnabled:false,metaConnected:false,exportedAt:now.toISOString(),threads:rows[0].results.map(r=>({...JSON.parse(r.data),revision:r.revision})),staff:rows[1].results,replies:rows[3].results.map(r=>({...JSON.parse(r.data),revision:r.revision})),learning:[...latest.values()].map(h=>({...JSON.parse(h.data),id:h.id,version:h.version,actor:h.actor,at:h.at})),learningHistory:history,events:rows[4].results};
 const encrypted=JSON.stringify(await encryptBackup(await packBackup(snapshot),env.BACKUP_PASSPHRASE));
 const date=now.toISOString().slice(0,10),bucket=env.MBW_WHATSAPP_BACKUPS;
 await bucket.put('daily/'+date+'.json',encrypted,{httpMetadata:{contentType:'application/json'},customMetadata:{mode:'shared_test',exportedAt:snapshot.exportedAt}});
 if(now.getUTCDate()===1)await bucket.put('monthly/'+date.slice(0,7)+'.json',encrypted,{httpMetadata:{contentType:'application/json'}});
 // Apply retention only after today's export succeeds.
 for(const [prefix,keep]of [['daily/',30],['monthly/',12]]){let cursor,keys=[];do{const page=await bucket.list({prefix,cursor});keys.push(...page.objects.map(o=>o.key));cursor=page.truncated?page.cursor:undefined;}while(cursor);keys.sort().reverse();const expired=keys.slice(keep);for(let i=0;i<expired.length;i+=100)await bucket.delete(expired.slice(i,i+100));}
 return {ok:true,mode:'shared_test',bytes:new TextEncoder().encode(encrypted).length,date};
}
export default {async scheduled(controller,env,ctx){ctx.waitUntil(runBackup(env));},async fetch(){return new Response('No public backup endpoint',{status:404});}};
