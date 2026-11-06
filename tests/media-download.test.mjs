import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const source=readFileSync(new URL('../functions/api/admin/media-download/index.js',import.meta.url),'utf8');const{onRequestGet}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));const old=globalThis.fetch;let calls=0;
const url='https://n8n.mindobirdwatching.com/media-delivery/v1/'+'a'.repeat(32)+'/fill-auto.jpg';
function request(u,host='admin.mindobirdwatching.com'){return new Request('https://'+host+'/api/admin/media-download?url='+encodeURIComponent(u))}
try{
 globalThis.fetch=async(url,options)=>{assert.equal(options.redirect,'manual','Cloudflare supports manual/follow only');assert.equal(options.method,'POST');calls++;return new Response('image',{headers:{'content-type':'image/jpeg'}})};
 for(const bad of [url+'?x=1',url.replace('n8n.','evil.'),url.replace('fill-auto.jpg','original.mp4'),'http://127.0.0.1/private'])assert.equal((await onRequestGet({request:request(bad)})).status,400);
 assert.equal((await onRequestGet({request:request(url,'mindobirdwatching.com')})).status,403);assert.equal(calls,0);
 const response=await onRequestGet({request:request(url),env:{MBW_MEDIA_DELIVERY_KEY:'test-private-key'}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(await response.text(),'image');assert.equal(calls,1);
 const ui=readFileSync(new URL('../admin/assets/js/media-studio.js',import.meta.url),'utf8');assert.match(ui,/api\/admin\/media-download\?url=/);assert.match(ui,/width="1024" height="1024"/);console.log('PASS same-origin image download, owned-path allowlist, no arbitrary URLs, video/private-file rejection.');
}finally{globalThis.fetch=old}
