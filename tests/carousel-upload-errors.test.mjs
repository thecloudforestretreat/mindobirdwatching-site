import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../functions/api/admin/carousels/index.js',import.meta.url),'utf8');
const {onRequestPost}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const originalFetch=globalThis.fetch;
function request(){const form=new FormData();form.append('action','upload_images');form.append('images',new Blob(['image'],{type:'image/jpeg'}),'test.jpg');return new Request('https://admin.mindobirdwatching.com/api/admin/carousels',{method:'POST',headers:{origin:'https://admin.mindobirdwatching.com'},body:form})}
try{
 for(const [name,mock,status,fragment] of [
  ['network',async()=>{throw new TypeError('fetch failed')},503,'unavailable'],
  ['timeout',async()=>{throw new DOMException('timeout','TimeoutError')},504,'timed out'],
  ['server unavailable',async()=>Response.json({ok:false,message:'Primary media drive unavailable'},{status:503}),503,'Primary media drive unavailable'],
  ['invalid JSON',async()=>new Response('<html>bad gateway</html>',{status:502}),503,'unavailable']
 ]){globalThis.fetch=mock;const response=await onRequestPost({request:request(),env:{MBW_MEDIA_DELIVERY_KEY:'test-server-only-key'}});assert.equal(response.status,status,name);assert.equal(response.headers.get('access-control-allow-origin'),'https://admin.mindobirdwatching.com');assert.match((await response.json()).message,new RegExp(fragment));}
 const js=readFileSync(new URL('../admin/assets/js/carousel-studio.js',import.meta.url),'utf8');const line=js.split('\n').find(l=>l.includes('async function uploadFiles('));let calls=0;
 const upload=vm.runInNewContext(line+';uploadFiles',{API:'https://example.test/upload',FormData,Error,Array,Object,fetch:async(url,options)=>{calls++;assert.equal(options.body.getAll('images').length,1);return Response.json({ok:true,images:[{secure_url:'https://res.cloudinary.com/test/'+calls}]})}});
 const images=await upload([new File(['a'],'a.jpg',{type:'image/jpeg'}),new File(['b'],'b.jpg',{type:'image/jpeg'})]);assert.equal(calls,2);assert.equal(images[0].order,1);assert.equal(images[1].order,2);
 const denied=await onRequestPost({request:new Request('https://mindobirdwatching.com/api/admin/carousels',{method:'POST',body:await request().formData()}),env:{MBW_MEDIA_DELIVERY_KEY:'test'}});assert.equal(denied.status,403);
 console.log('PASS: local upload error handling, same-origin upload boundary and slide ordering.');
}finally{globalThis.fetch=originalFetch}
