import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const source=readFileSync(new URL('../functions/api/admin/reel-uploads/index.js',import.meta.url),'utf8');const{onRequestPost}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const original=globalThis.fetch;let calls=0;
const request=(action,body,origin='https://admin.mindobirdwatching.com')=>new Request('https://admin.mindobirdwatching.com/api/admin/reel-uploads/?action='+action,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
try{
 globalThis.fetch=async(url,opts)=>{calls++;assert.match(url,/\/media-delivery\/reels\/start$/);assert.equal(opts.headers['x-mbw-media-key'],'private-test-key');return Response.json({ok:true,upload_id:'a'.repeat(32),chunk_bytes:8388608})};
 for(const[body,origin,status]of[[{name:'test.mp4',bytes:100},'https://evil.example',403],[{name:'test.mov',bytes:100},'https://admin.mindobirdwatching.com',400],[{name:'test.mp4',bytes:2**31},'https://admin.mindobirdwatching.com',400]])assert.equal((await onRequestPost({request:request('start',body,origin),env:{MBW_MEDIA_DELIVERY_KEY:'private-test-key'}})).status,status);
 assert.equal(calls,0);
 const response=await onRequestPost({request:request('start',{name:'test.mp4',bytes:100}),env:{MBW_MEDIA_DELIVERY_KEY:'private-test-key'}});assert.equal(response.status,200);assert.equal(calls,1);assert.ok(!(await response.text()).includes('private-test-key'));
 const ui=readFileSync(new URL('../admin/assets/js/reels-studio.js',import.meta.url),'utf8');assert.match(ui,/uploadingRows.size/);assert.match(ui,/crypto.subtle.digest/);assert.match(ui,/No reel was submitted/);assert.ok(!source.includes('N8N_ADMIN_REELS_WEBHOOK_URL'));console.log('PASS upload origin, size/type guards, private key isolation; uploader cannot invoke workflow.');
}finally{globalThis.fetch=original}
