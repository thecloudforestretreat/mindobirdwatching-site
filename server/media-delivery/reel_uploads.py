"""Private, bounded reel intake. No workflow or publishing actions occur here."""
from pathlib import Path
import hashlib,hmac,json,os,subprocess,time,uuid,threading,shutil
MAX_BYTES=1024**3
CHUNK_BYTES=8*1024**2
LOCK=threading.Lock()
DOCKER='/Applications/Docker.app/Contents/Resources/bin/docker'
CONTAINER='jpg-immich-pilot-immich-server-1'

def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  while b:=f.read(CHUNK_BYTES):h.update(b)
 return h.hexdigest()

def atomic_json(path,data):
 tmp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp');tmp.write_text(json.dumps(data));os.replace(tmp,path)

def probe(path):
 remote='/tmp/mbw-upload-'+uuid.uuid4().hex+'.mp4'
 try:
  subprocess.run([DOCKER,'cp',str(path),CONTAINER+':'+remote],check=True,capture_output=True,timeout=120)
  r=subprocess.run([DOCKER,'exec',CONTAINER,'ffprobe','-v','error','-show_entries','format=format_name,duration:stream=codec_type,codec_name,width,height','-of','json',remote],check=True,capture_output=True,timeout=60)
  info=json.loads(r.stdout);video=next(s for s in info['streams'] if s['codec_type']=='video');audio=[s for s in info['streams'] if s['codec_type']=='audio'];duration=float(info['format']['duration'])
  if video['codec_name']!='h264' or any(s['codec_name']!='aac' for s in audio) or not 0<duration<=900 or not video.get('width') or not video.get('height'):raise ValueError('Use an MP4 with H.264 video and AAC audio, up to 15 minutes. Export a compatible copy; the server does not convert your original.')
  return {'width':video['width'],'height':video['height'],'duration':duration}
 finally:
  subprocess.run([DOCKER,'exec',CONTAINER,'rm','-f',remote],capture_output=True,timeout=15)

class ReelUploads:
 def __init__(self,root,key,guard,backup=None,inspector=probe):
  self.root=Path(root);self.staging=self.root.parent/'.Reel-Uploads';self.key=key;self.guard=guard;self.backup=backup;self.inspector=inspector
 def begin(self,data):
  size=data.get('bytes');name=data.get('name','')
  if not isinstance(size,int) or isinstance(size,bool) or not 0<size<=MAX_BYTES or not isinstance(name,str) or not name.lower().endswith('.mp4') or len(name)>240:raise ValueError('Choose an MP4 no larger than 1 GiB.')
  self.guard();self.staging.mkdir(parents=True,exist_ok=True)
  if self.staging.is_symlink():raise ValueError('Invalid upload storage')
  # Expire only this service’s abandoned temporary sessions, never publishing objects.
  for p in self.staging.iterdir():
   if p.is_dir() and not p.is_symlink() and len(p.name)==32 and all(c in '0123456789abcdef' for c in p.name) and time.time()-p.stat().st_mtime>86400:shutil.rmtree(p)
  if sum(1 for _ in self.staging.iterdir())>=10:raise ValueError('Upload queue is full. Retry after existing uploads finish.')
  if shutil.disk_usage(self.root.parent).free<size*2+5*1024**3:raise ValueError('Not enough free space on the primary media drive.')
  ident=uuid.uuid4().hex;folder=self.staging/ident;folder.mkdir();state={'bytes':size,'name':Path(name).name,'received':0};atomic_json(folder/'state.json',state)
  return {'ok':True,'upload_id':ident,'chunk_bytes':CHUNK_BYTES}
 def session(self,ident):
  if not isinstance(ident,str) or len(ident)!=32 or any(c not in '0123456789abcdef' for c in ident):raise ValueError('Invalid upload session')
  folder=self.staging/ident
  if folder.is_symlink():raise ValueError('Invalid upload session')
  state=json.loads((folder/'state.json').read_text())
  return folder,state
 def chunk(self,ident,offset,raw,digest):
  self.guard();folder,state=self.session(ident)
  if not raw or len(raw)>CHUNK_BYTES or offset<0 or offset+len(raw)>state['bytes'] or hashlib.sha256(raw).hexdigest()!=digest:raise ValueError('Upload chunk failed verification')
  path=folder/'video.part'
  if offset<state['received']:
   with path.open('rb') as f:f.seek(offset);existing=f.read(len(raw))
   if existing!=raw:raise ValueError('Upload retry differs from saved chunk')
   return {'ok':True,'received':state['received']}
  if offset!=state['received']:raise ValueError('Upload offset differs; select the file again to retry')
  with path.open('a+b') as f:
   f.truncate(state['received']);f.seek(state['received']);f.write(raw);f.flush();os.fsync(f.fileno())
  state['received']+=len(raw);atomic_json(folder/'state.json',state)
  return {'ok':True,'received':state['received']}
 def finish(self,ident):
  self.guard();folder,state=self.session(ident)
  if (folder/'result.json').exists():return json.loads((folder/'result.json').read_text())
  path=folder/'video.part'
  if state['received']!=state['bytes'] or path.stat().st_size!=state['bytes']:raise ValueError('Upload is incomplete')
  info=self.inspector(path);digest=sha(path);object_id=hmac.new(self.key.encode(),digest.encode(),hashlib.sha256).hexdigest()[:32];dest=self.root/object_id
  self.root.mkdir(parents=True,exist_ok=True)
  if self.root.is_symlink() or dest.is_symlink():raise ValueError('Invalid media storage')
  meta={'id':object_id,'mime':'video/mp4','extension':'mp4','sha256':digest,'bytes':state['bytes'],'source_file_name':state['name'],'transcoded':False,**info}
  if dest.exists():
   if sha(dest/'original.mp4')!=digest:raise ValueError('Existing publishing copy differs; no file was changed')
  else:
   temp=self.root/('.pending-'+uuid.uuid4().hex);temp.mkdir()
   with path.open('rb') as src,(temp/'original.mp4').open('xb') as target:shutil.copyfileobj(src,target,CHUNK_BYTES);target.flush();os.fsync(target.fileno())
   if sha(temp/'original.mp4')!=digest:raise ValueError('Publishing copy failed verification')
   atomic_json(temp/'metadata.json',meta);os.rename(temp,dest)
  backed=False
  if self.backup:
   target=self.backup(dest)
   if target:
    target=Path(target);target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists():subprocess.run(['/usr/bin/ditto','--rsrc','--extattr','--acl',str(dest),str(target)],check=True,capture_output=True,timeout=300)
    if sha(target/'original.mp4')!=digest or sha(target/'metadata.json')!=sha(dest/'metadata.json'):raise ValueError('Backup verification failed; no reel was submitted')
    backed=True
  result={'ok':True,'url':'https://n8n.mindobirdwatching.com/media-delivery/v1/'+object_id+'/original.mp4','backup_verified':backed,**meta};atomic_json(folder/'result.json',result)
  path.unlink() # Only temporary upload bytes; immutable published copy is retained.
  return result
