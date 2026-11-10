// Keep the staff-facing URL under MBW Admin. The Mac also validates the signed JWT.
const ADMIN='https://admin.mindobirdwatching.com';
const UPSTREAM='https://n8n.mindobirdwatching.com';
const PREFIX='/whatsapp-staging/';
export async function onRequest({request}) {
 const url=new URL(request.url);
 const fail=(status,error)=>Response.json({ok:false,error},{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 if(url.origin!==ADMIN)return fail(403,'Use the protected MBW Admin address.');
 if(!['GET','POST'].includes(request.method))return fail(405,'Method not allowed.');
 const jwt=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!jwt)return fail(401,'Sign in through MBW Admin.');
 if(request.method==='POST'&&request.headers.get('Origin')!==ADMIN)return fail(403,'Same-origin staging request required.');
 if(url.pathname==='/whatsapp-staging')return Response.redirect(ADMIN+PREFIX,302);
 if(!url.pathname.startsWith(PREFIX))return fail(404,'Not found.');
 // Forward only this Access credential, never the browser's other cookies.
 const headers=new Headers({'Cf-Access-Jwt-Assertion':jwt,'Cookie':'CF_Authorization='+jwt,'X-MBW-Staging-Frontend':'admin'});
 for(const name of ['Accept','Content-Type','X-Pilot-Token','X-MBW-Staff-Profile']){const value=request.headers.get(name);if(value)headers.set(name,value);}
 if(request.method==='POST')headers.set('Origin',UPSTREAM);
 try {
  const response=await fetch(UPSTREAM+url.pathname+url.search,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,redirect:'manual',signal:AbortSignal.timeout(110000)});
  if(response.headers.get('X-MBW-WhatsApp-Staging')!=='1')return fail(503,'Staging is unavailable. Check that the Mac is awake and online, then retry.');
  if(response.status>=300&&response.status<400)return fail(502,'Staging connection needs attention. Refresh MBW Admin and retry.');
  if(response.status>=500)return fail(503,'The staging service is unavailable. Unsaved edits remain on this device.');
  const output=new Headers(response.headers);output.delete('Set-Cookie');output.set('Cache-Control','private, no-store');output.set('X-Frame-Options','SAMEORIGIN');output.set('Referrer-Policy','same-origin');output.set('X-Content-Type-Options','nosniff');
  return new Response(response.body,{status:response.status,headers:output});
 }catch{return fail(503,'The Mac staging service is unavailable or timed out. Retry when it is online.');}
}
