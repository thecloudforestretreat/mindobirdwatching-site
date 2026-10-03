let authorizationStage='runtime';
try {
// Reuse MBW Admin's existing Access identity. Never trust a header without its signature.
authorizationStage='claims';
const input=$json,token=input.headers?.['cf-access-jwt-assertion'];
if(typeof token!=='string'||token.length>16384)throw new Error('Administrator sign-in required');
const parts=token.split('.');if(parts.length!==3)throw new Error('Invalid identity');
const decode=s=>Buffer.from(s,'base64url');
const header=JSON.parse(decode(parts[0]).toString()),claims=JSON.parse(decode(parts[1]).toString()),now=Math.floor(Date.now()/1000);
const issuer='https://tcfr-mbw.cloudflareaccess.com',audience='62ad79ee3af18f90b4827d5a84be038d4df901a56cbc21abda1ac5991ea89060';
if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(audience)||!Number.isFinite(claims.exp)||claims.exp<=now||(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>now))||typeof claims.email!=='string'||!claims.email.trim())throw new Error('Invalid identity');
authorizationStage='identity_service';
// Cloudflare's existing origin verifier checks the signature using Web Crypto.
// Send the same application token as the Access cookie so the edge authenticates too.
const identity=await this.helpers.httpRequest({url:'https://admin.mindobirdwatching.com/api/outcomes-identity',headers:{Cookie:'CF_Authorization='+token,'Cf-Access-Jwt-Assertion':token},json:true,timeout:10000});
if(identity?.authorized!==true)throw new Error('Invalid identity');
if(claims.email.trim().toLowerCase()==='faustoandrade635@gmail.com')throw new Error('Administrator access required');
authorizationStage='report';
const q=input.body||{},source=q.source,stage=q.stage||'confirmed',start=q.start||'',end=q.end||'';
const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
if(!['website','guests'].includes(source)||!['confirmed','completed','current','upcoming','overdue','undated','prospects'].includes(stage))throw new Error('Invalid report');
if((source==='website'||start||end)&&(!valid(start)||!valid(end)||start>end||(Date.parse(end)-Date.parse(start))/86400000>=366))throw new Error('Invalid date range');
return [{json:{authorized:true,source,stage,start,end,today:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}}];

} catch { return [{json:{authorized:false,ok:false,error:'Administrator authorization failed.',diagnostic:authorizationStage}}]; }
