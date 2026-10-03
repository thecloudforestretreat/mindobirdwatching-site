import { verifyIdentity } from '../_middleware.js';
// Fixed callback for the owned n8n feed; never returns identity or account data.
export async function onRequestGet({request}) {
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  let authorized=false;
  if(new URL(request.url).hostname==='admin.mindobirdwatching.com') {
    try { authorized=(await verifyIdentity(request.headers.get('Cf-Access-Jwt-Assertion')))!=='faustoandrade635@gmail.com'; } catch {}
  }
  return new Response(JSON.stringify({authorized}),{status:authorized?200:401,headers});
}
