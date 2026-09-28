// Access policy remains on the admin hostname. The tunnel and local server both
// verify this application's signed JWT; a spoofed header cannot authorize access.
const ADMIN='https://admin.mindobirdwatching.com';
const PREFIX='/inquiry-studio/';
const ORIGIN='https://n8n.mindobirdwatching.com';
export async function onRequest({request}) {
 const url=new URL(request.url);
 const fail=(status,message)=>new Response(JSON.stringify({error:message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(url.origin!==ADMIN)return fail(403,'Use the protected admin hostname.');
 const jwt=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!jwt)return fail(401,'Sign in through MBW Admin.');
 if(!['GET','POST'].includes(request.method))return fail(405,'Method not allowed.');
 if(request.method==='POST'&&request.headers.get('Origin')!==ADMIN)return fail(403,'Invalid origin.');
 if(url.pathname==='/inquiry-studio')return Response.redirect(ADMIN+PREFIX,302);
 if(!url.pathname.startsWith(PREFIX))return fail(404,'Not found.');
 const headers=new Headers({'Cf-Access-Jwt-Assertion':jwt});
 for(const name of ['Accept','Content-Type','X-Pilot-Token','Origin']){
  const value=request.headers.get(name);if(value)headers.set(name,value);
 }
 try {
  const response=await fetch(ORIGIN+url.pathname+url.search,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,redirect:'manual',signal:AbortSignal.timeout(110000)});
  if(response.status>=500)return fail(503,'The Mac mini studio is unavailable. Please try again shortly.');
  if(response.status>=300&&response.status<400)return fail(502,'Studio connection is not ready.');
  const output=new Headers(response.headers);output.set('Cache-Control','no-store');output.set('X-Frame-Options','SAMEORIGIN');output.delete('Set-Cookie');
  return new Response(response.body,{status:response.status,headers:output});
 } catch {return fail(503,'The Mac mini studio is unavailable. Please try again shortly.');}
}
