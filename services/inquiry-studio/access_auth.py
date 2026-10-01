"""Verify MBW Admin Access tokens against Cloudflare's public signing keys."""
import base64,json,time,threading
from urllib.request import urlopen
ISSUER='https://tcfr-mbw.cloudflareaccess.com'
AUDIENCE='62ad79ee3af18f90b4827d5a84be038d4df901a56cbc21abda1ac5991ea89060'
_cache=(0,[])
_lock=threading.Lock()
def decode(value):return base64.urlsafe_b64decode(value+'='*(-len(value)%4))
def keys():
 global _cache
 with _lock:
  if time.monotonic()-_cache[0]>300 or not _cache[1]:
   with urlopen(ISSUER+'/cdn-cgi/access/certs',timeout=10) as r:data=json.load(r)
   _cache=(time.monotonic(),data['keys'])
  return _cache[1]
def authorized(token):
 try:
  from cryptography.hazmat.primitives.asymmetric import rsa,padding
  from cryptography.hazmat.primitives import hashes
  if not token or len(token)>16000:return False
  h,p,s=token.split('.');header=json.loads(decode(h));claims=json.loads(decode(p))
  aud=claims.get('aud',[]);aud=[aud] if isinstance(aud,str) else aud
  now=time.time()
  if header.get('alg')!='RS256' or claims.get('iss')!=ISSUER or AUDIENCE not in aud:return False
  if not isinstance(claims.get('exp'),(int,float)) or claims['exp']<=now:return False
  if claims.get('nbf',0)>now+30 or claims.get('iat',0)>now+30:return False
  if not claims.get('sub') or not claims.get('email'):return False
  key=next(k for k in keys() if k['kid']==header.get('kid') and k['kty']=='RSA')
  public=rsa.RSAPublicNumbers(int.from_bytes(decode(key['e']),'big'),int.from_bytes(decode(key['n']),'big')).public_key()
  public.verify(decode(s),(h+'.'+p).encode(),padding.PKCS1v15(),hashes.SHA256())
  return True
 except Exception:return False
