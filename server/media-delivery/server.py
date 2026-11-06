"""Loopback media-output service. Only uploaded carousel objects are addressable."""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import os,json,uuid,re,hashlib,hmac,subprocess,threading,urllib.parse,plistlib,time
ROOT=Path(os.environ['MBW_MEDIA_ROOT']);KEY=Path(os.environ['MBW_MEDIA_KEY_FILE']).read_text().strip();PREFIX='/media-delivery';BASE='https://n8n.mindobirdwatching.com'+PREFIX;SCRIPT=Path(__file__).with_name('render.py');LIMIT=12*1024*1024;RENDER=threading.Semaphore(1)
assert len(KEY)>=40

def guard():
 vol=Path('/Volumes/JPG-Server-8TB');info=plistlib.loads(subprocess.check_output(['/usr/sbin/diskutil','info','-plist',str(vol)],timeout=10));assert vol.is_mount() and info.get('VolumeUUID')=='DCBBC330-F327-4ABD-AAAC-36A9DE63547C' and not info.get('Locked')
 assert ROOT.is_relative_to(vol) and not ROOT.is_symlink()
def render(raw,*args):
 with RENDER:
  cmd=['/Applications/Docker.app/Contents/Resources/bin/docker','exec','-i','jpg-immich-pilot-immich-machine-learning-1','python','-c',SCRIPT.read_text(),*args]
  r=subprocess.run(cmd,input=raw,capture_output=True,timeout=90)
  if r.returncode:raise ValueError('Image could not be processed')
  return r.stdout
class Handler(BaseHTTPRequestHandler):
 server_version='MBWMedia/1'
 def log_message(self,format,*args):pass
 def send(self,status,data=b'',mime='application/json',cache='no-store',extra=None):
  self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control',cache);self.send_header('X-Content-Type-Options','nosniff')
  for k,v in (extra or {}).items():self.send_header(k,v)
  self.end_headers()
  if self.command!='HEAD':self.wfile.write(data)
 def error(self,status,message):self.send(status,json.dumps({'ok':False,'message':message}).encode())
 def do_POST(self):
  if not hmac.compare_digest(self.headers.get('X-MBW-Media-Key',''),KEY):return self.error(403,'Not authorized')
  if self.path!=PREFIX+'/upload':return self.error(404,'Not found')
  try:
   guard();size=int(self.headers.get('Content-Length','0'));mime=self.headers.get('Content-Type','').split(';')[0]
   if not 0<size<=LIMIT or mime not in {'image/jpeg','image/png','image/webp'}:return self.error(400,'Choose JPG, PNG or WebP up to 12 MB')
   raw=self.rfile.read(size)
   if len(raw)!=size:return self.error(400,'Incomplete image upload')
   info=json.loads(render(raw,'inspect'));digest=hashlib.sha256(raw).hexdigest();ident=hmac.new(KEY.encode(),digest.encode(),hashlib.sha256).hexdigest()[:32];folder=ROOT/ident;folder.mkdir(parents=True,exist_ok=True);ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];original=folder/('original.'+ext);original.write_bytes(raw)
   meta={'id':ident,'mime':mime,'extension':ext,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':size,'width':info['width'],'height':info['height'],'created_at':time.time()};(folder/'metadata.json').write_text(json.dumps(meta));assert hashlib.sha256(original.read_bytes()).hexdigest()==meta['sha256']
   # Publishing renditions are distinct from the byte-preserved source.
   for fit,gravity in [('fill','auto'),('fit','center')]:
    data=render(raw,fit,gravity);(folder/(fit+'-'+gravity+'.jpg')).write_bytes(data)
   self.send(200,json.dumps({'ok':True,'secure_url':BASE+'/v1/'+ident+'/original.'+ext,'original_url':BASE+'/v1/'+ident+'/original.'+ext,'width':info['width'],'height':info['height'],'sha256':meta['sha256'],'public_id':ident}).encode())
  except (ValueError,AssertionError,subprocess.SubprocessError,OSError):self.error(503,'Media server unavailable or image could not be prepared. No carousel was submitted.')
 def do_HEAD(self):self.do_GET()
 def do_GET(self):
  path=urllib.parse.urlsplit(self.path)
  if path.path==PREFIX+'/health':
   try:guard();self.send(200,b'{"ok":true}')
   except Exception:self.error(503,'Primary media drive unavailable')
   return
  m=re.fullmatch(PREFIX+r'/v1/([a-f0-9]{32})/(original\.(?:jpg|png|webp|mp4)|(?:fill|fit)-(?:auto|center|north|south|east|west)\.jpg)',path.path)
  if not m or path.query:return self.error(404,'Not found')
  try:
   guard();folder=(ROOT.parent/'Reels' if m[2]=='original.mp4' else ROOT)/m[1];meta=json.loads((folder/'metadata.json').read_text());f=folder/m[2];assert not folder.is_symlink() and not f.is_symlink()
   if m[2].startswith('original.'):
    if m[2]!='original.'+meta['extension']:return self.error(404,'Not found')
    mime=meta['mime']
   else:
    mime='image/jpeg'
    if not f.exists():
     fit,gravity=m[2][:-4].split('-');raw=(folder/('original.'+meta['extension'])).read_bytes();data=render(raw,fit,gravity);tmp=folder/(m[2]+'.'+uuid.uuid4().hex+'.tmp');tmp.write_bytes(data);os.replace(tmp,f)
   if mime=='video/mp4':
    size=f.stat().st_size;lo=0;hi=size-1;status=200;rg=self.headers.get('Range');headers={'ETag':'"'+meta['sha256']+'"','Accept-Ranges':'bytes'}
    if rg:
     match=re.fullmatch(r'bytes=(\d*)-(\d*)',rg)
     if not match or not any(match.groups()):return self.send(416,b'',mime,extra={'Content-Range':'bytes */'+str(size)})
     if not match[1]:lo=max(0,size-int(match[2]))
     else:lo=int(match[1]);hi=min(int(match[2]) if match[2] else size-1,size-1)
     if lo>hi or lo>=size:return self.send(416,b'',mime,extra={'Content-Range':'bytes */'+str(size)})
     status=206;headers['Content-Range']=f'bytes {lo}-{hi}/{size}'
    self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(hi-lo+1));self.send_header('Cache-Control','public, max-age=86400');self.send_header('X-Content-Type-Options','nosniff')
    for k,v in headers.items():self.send_header(k,v)
    self.end_headers()
    if self.command!='HEAD':
     with f.open('rb') as stream:
      stream.seek(lo);remaining=hi-lo+1
      while remaining:
       chunk=stream.read(min(1024*1024,remaining))
       if not chunk:break
       self.wfile.write(chunk);remaining-=len(chunk)
    return
   data=f.read_bytes();headers={'ETag':'"'+hashlib.sha256(data).hexdigest()+'"','Accept-Ranges':'bytes'}
   if self.headers.get('If-None-Match')==headers['ETag']:return self.send(304,b'',mime,'public, max-age=86400',headers)
   rg=self.headers.get('Range')
   if rg:
    match=re.fullmatch(r'bytes=(\d+)-(\d*)',rg)
    if not match:return self.send(416,b'',mime,extra={'Content-Range':'bytes */'+str(len(data))})
    lo=int(match[1]);hi=min(int(match[2]) if match[2] else len(data)-1,len(data)-1)
    if lo>hi:return self.send(416,b'',mime,extra={'Content-Range':'bytes */'+str(len(data))})
    headers['Content-Range']=f'bytes {lo}-{hi}/{len(data)}';return self.send(206,data[lo:hi+1],mime,'public, max-age=86400',headers)
   self.send(200,data,mime,'public, max-age=86400',headers)
  except FileNotFoundError:self.error(404,'Not found')
  except Exception:self.error(503,'Media server unavailable')
if __name__=='__main__':
 guard();ROOT.mkdir(parents=True,exist_ok=True);ThreadingHTTPServer(('127.0.0.1',8099),Handler).serve_forever()
