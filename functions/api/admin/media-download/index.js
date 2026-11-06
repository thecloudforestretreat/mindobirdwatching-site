// Admin identity/roles are enforced by the shared middleware.
const IMAGE=/^https:\/\/n8n\.mindobirdwatching\.com\/media-delivery\/v1\/[a-f0-9]{32}\/(?:original\.(?:jpg|png|webp)|(?:fill|fit)-(?:auto|center|north|south|east|west)\.jpg)$/;
export async function onRequestGet({request,env}){
 if(new URL(request.url).origin!=='https://admin.mindobirdwatching.com')return new Response('Use the signed-in media studio.',{status:403});
 const url=new URL(request.url).searchParams.get('url')||'';
 if(!IMAGE.test(url))return new Response('Unsupported media image.',{status:400});
 try{
  if(!env.MBW_MEDIA_DELIVERY_KEY)return new Response('Media download unavailable.',{status:503});
  const r=await fetch('https://n8n.mindobirdwatching.com/media-delivery/download-image',{method:'POST',headers:{'content-type':'application/json','x-mbw-media-key':env.MBW_MEDIA_DELIVERY_KEY,'user-agent':'MBW-Carousel-Studio/1.0'},body:JSON.stringify({url}),redirect:'manual',signal:AbortSignal.timeout(30000)});
  const type=(r.headers.get('content-type')||'').split(';')[0];
  if(!r.ok||!['image/jpeg','image/png','image/webp'].includes(type)||Number(r.headers.get('content-length'))>25*1024*1024)return new Response('Image unavailable.',{status:502});
  return new Response(r.body,{headers:{'content-type':type,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
 }catch{return new Response('Image download unavailable. Retry in a moment.',{status:502})}
}
