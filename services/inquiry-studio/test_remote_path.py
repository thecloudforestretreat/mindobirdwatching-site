import unittest,json,time,base64
from unittest.mock import patch
from email.message import Message
import server,access_auth
from cryptography.hazmat.primitives.asymmetric import rsa,padding
from cryptography.hazmat.primitives import hashes
class RemotePathTests(unittest.TestCase):
 def handler(self,host,path='/inquiry-studio/api/session',token=''):
  h=object.__new__(server.Handler);h.path=path;h.headers=Message();h.headers['Host']=host;h.headers['Cf-Access-Jwt-Assertion']=token;return h
 def test_local_still_allowed(self):self.assertTrue(self.handler('127.0.0.1:8098').allowed_host())
 def test_remote_closed_by_default(self):
  with patch.dict('os.environ',{'MBW_PILOT_REMOTE_ENABLED':'0'}):self.assertFalse(self.handler(server.REMOTE_HOST).allowed_host())
 def test_host_prefix_and_verified_login_required(self):
  with patch.dict('os.environ',{'MBW_PILOT_REMOTE_ENABLED':'1'}),patch('access_auth.authorized',return_value=True):
   self.assertFalse(self.handler('evil.example').allowed_host())
   self.assertFalse(self.handler(server.REMOTE_HOST,path='/api/session').allowed_host())
   self.assertTrue(self.handler(server.REMOTE_HOST).allowed_host())
  with patch.dict('os.environ',{'MBW_PILOT_REMOTE_ENABLED':'1'}),patch('access_auth.authorized',return_value=False):self.assertFalse(self.handler(server.REMOTE_HOST).allowed_host())
 def test_path(self):self.assertEqual(self.handler('127.0.0.1:8098',path='/inquiry-studio/api/save?q=1').app_path(),'/api/save')
 def test_real_signatures_and_claim_validation(self):
  enc=lambda b:base64.urlsafe_b64encode(b).decode().rstrip('=')
  key=rsa.generate_private_key(public_exponent=65537,key_size=2048);pub=key.public_key().public_numbers()
  jwk={'kid':'test','kty':'RSA','e':enc(pub.e.to_bytes(3,'big')),'n':enc(pub.n.to_bytes(256,'big'))}
  claims={'iss':access_auth.ISSUER,'aud':[access_auth.AUDIENCE],'exp':time.time()+60,'sub':'test-user','email':'test@example.com'}
  def sign(c,alg='RS256'):
   data=enc(json.dumps({'alg':alg,'kid':'test'}).encode())+'.'+enc(json.dumps(c).encode())
   return data+'.'+enc(key.sign(data.encode(),padding.PKCS1v15(),hashes.SHA256()))
  with patch('access_auth.keys',return_value=[jwk]):
   self.assertTrue(access_auth.authorized(sign(claims)))
   for bad in [{'aud':['wrong']},{'iss':'https://evil.example'},{'exp':time.time()-60},{'email':''}]:self.assertFalse(access_auth.authorized(sign({**claims,**bad})))
   self.assertFalse(access_auth.authorized(sign(claims,'none')))
   token=sign(claims);h,p,s=token.split('.');self.assertFalse(access_auth.authorized(h+'.'+p+'.'+s[::-1]))
if __name__=='__main__':unittest.main()
