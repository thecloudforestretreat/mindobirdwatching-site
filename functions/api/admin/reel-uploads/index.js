// The shared admin middleware verifies identity/roles before this handler runs.
const ORIGIN='https://admin.mindobirdwatching.com';
const CHUNK=8*1024*1024;
function reply(data,status=200){return Response.json(data,{status,headers:{'cache-control':'no-store'}})}
export async function onRequestPost({request,env}){
 if(new URL(request.url).origin!==ORIGIN||request.headers.get('origin')!==ORIGIN)return reply({ok:false,message:'Use the signed-in Reel Studio to upload.'},403);
 if(!env.MBW_MEDIA_DELIVERY_KEY)return reply({ok:false,message:'Video uploads are not configured.'},503);
 const action=new URL(request.url).searchParams.get('action');
 if(!['start','chunk','finish'].includes(action))return reply({ok:false,message:'Unknown upload action.'},400);
 const headers={'x-mbw-media-key':env.MBW_MEDIA_DELIVERY_KEY,'user-agent':'MBW-Reel-Studio/1.0'};
 let body;
 try{
  if(action==='chunk'){
   const id=request.headers.get('x-upload-id')||'',offset=request.headers.get('x-upload-offset')||'',sha=request.headers.get('x-chunk-sha256')||'';
   if(!/^[a-f0-9]{32}$/.test(id)||!/^\d{1,10}$/.test(offset)||! /^[a-f0-9]{64}$/.test(sha))return reply({ok:false,message:'Invalid upload chunk.'},400);
   const length=Number(request.headers.get('content-length'));
   if(!length||length>CHUNK)return reply({ok:false,message:'Upload chunks must be no larger than 8 MiB.'},400);
   body=await request.arrayBuffer();if(!body.byteLength||body.byteLength>CHUNK)return reply({ok:false,message:'Invalid chunk size.'},400);
   Object.assign(headers,{'content-type':'application/octet-stream','x-upload-id':id,'x-upload-offset':offset,'x-chunk-sha256':sha});
  }else{
   if(Number(request.headers.get('content-length'))>4096)return reply({ok:false,message:'Upload request too large.'},400);
   const data=await request.json();
   if(action==='start'){
    if(!Number.isInteger(data.bytes)||data.bytes<=0||data.bytes>1024**3||typeof data.name!=='string'||data.name.length>240||!data.name.toLowerCase().endsWith('.mp4'))return reply({ok:false,message:'Choose an MP4 up to 1 GiB.'},400);
    body=JSON.stringify({name:data.name,bytes:data.bytes});
   }else{
    if(!/^[a-f0-9]{32}$/.test(data.upload_id||''))return reply({ok:false,message:'Invalid upload session.'},400);
    body=JSON.stringify({upload_id:data.upload_id});
   }
   headers['content-type']='application/json';
  }
  const r=await fetch('https://n8n.mindobirdwatching.com/media-delivery/reels/'+action,{method:'POST',headers,body,signal:AbortSignal.timeout(action==='finish'?90000:45000)});
  const data=await r.json();
  if(!r.ok||!data.ok)return reply({ok:false,message:data.message||'The mini could not verify this upload. No reel was submitted.'},r.status>=500?503:400);
  if(action==='finish'&&!/^https:\/\/n8n\.mindobirdwatching\.com\/media-delivery\/v1\/[a-f0-9]{32}\/original\.mp4$/.test(data.url||''))return reply({ok:false,message:'Invalid video delivery response.'},502);
  return reply(data);
 }catch{return reply({ok:false,message:'Upload interrupted or media server unavailable. Retry the upload; no reel was submitted.'},503)}
}
