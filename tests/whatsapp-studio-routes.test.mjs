import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/whatsapp/studio-session.js';
import {onRequestPost} from '../functions/api/whatsapp/suggest.js';
for(const [name,handler,method,path] of [['session',onRequestGet,'GET','session'],['suggest',onRequestPost,'POST','whatsapp-suggest']]){
 test(name+' routes to protected Studio API',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://n8n.mindobirdwatching.com/inquiry-studio/api/'+path);assert.equal(options.headers.get('Cf-Access-Jwt-Assertion'),'test');return new Response('{"ok":true}',{headers:{'Content-Type':'application/json','X-MBW-Inquiry-Studio':'1'}});};
  try{const response=await handler({request:new Request('https://admin.mindobirdwatching.com/api/whatsapp/'+name,{method,headers:{'Cf-Access-Jwt-Assertion':'test',Origin:'https://admin.mindobirdwatching.com'},...(method==='POST'?{body:'{}'}:{})})});assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});}finally{globalThis.fetch=original;}
 });
}
test('HTML upstream yields JSON error',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response('<!doctype html>');try{const response=await onRequestGet({request:new Request('https://admin.mindobirdwatching.com/api/whatsapp/studio-session',{headers:{'Cf-Access-Jwt-Assertion':'test'}})});assert.equal(response.status,503);assert.match((await response.json()).error,/connection/);}finally{globalThis.fetch=original;}});
