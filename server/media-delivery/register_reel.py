"""Register one explicitly selected ready reel; never alter or transcode it."""
from pathlib import Path
import os,sys,json,hashlib,hmac,subprocess,plistlib
SOURCE=Path(sys.argv[1]).resolve(strict=True);VOL=Path('/Volumes/JPG-Server-8TB');BACKUP=Path('/Volumes/JPG-Backup-8TB');READY=VOL/'01-Projects/Mindo Bird Watching/Media/Publishing/Reels/Ready';ROOT=VOL/'01-Projects/Mindo Bird Watching/Publishing/Media-Studio/Reels'
assert SOURCE.is_file() and SOURCE.is_relative_to(READY.resolve()) and SOURCE.suffix.lower()=='.mp4';assert not Path(sys.argv[1]).is_symlink()
for p,u in [(VOL,'DCBBC330-F327-4ABD-AAAC-36A9DE63547C'),(BACKUP,'015B7E4D-E501-4EFF-9922-4BDE493B2D71')]:assert plistlib.loads(subprocess.check_output(['diskutil','info','-plist',str(p)])).get('VolumeUUID')==u
assert SOURCE.stat().st_size<1024**3
srcpath='/libraries/mbw/'+str(SOURCE.relative_to(VOL/'01-Projects/Mindo Bird Watching/Media'));probe=json.loads(subprocess.check_output(['docker','exec','jpg-immich-pilot-immich-server-1','ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_type,codec_name,width,height','-of','json',srcpath]));video=next(s for s in probe['streams'] if s['codec_type']=='video');audio=next((s for s in probe['streams'] if s['codec_type']=='audio'),None);assert video['codec_name']=='h264' and (audio is None or audio['codec_name']=='aac'),'Review format before registering'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(8*1024*1024):h.update(b)
 return h.hexdigest()
before=SOURCE.stat();digest=sha(SOURCE);key=Path('/Users/jpg/.config/mbw-media-delivery/upload.key').read_text().strip();ident=hmac.new(key.encode(),digest.encode(),hashlib.sha256).hexdigest()[:32];folder=ROOT/ident;folder.mkdir(parents=True,exist_ok=True);dest=folder/'original.mp4'
if not dest.exists():subprocess.run(['/bin/cp','-c','-p',str(SOURCE),str(dest)],check=True)
assert sha(dest)==digest and (before.st_size,before.st_mtime_ns)==(SOURCE.stat().st_size,SOURCE.stat().st_mtime_ns)
meta={'id':ident,'mime':'video/mp4','extension':'mp4','sha256':digest,'bytes':before.st_size,'width':video['width'],'height':video['height'],'duration':float(probe['format']['duration']),'source_file_name':SOURCE.name,'transcoded':False};(folder/'metadata.json').write_text(json.dumps(meta,indent=2))
for f in [SOURCE,dest,folder/'metadata.json']:
 target=BACKUP/f.relative_to(VOL);target.parent.mkdir(parents=True,exist_ok=True)
 if not target.exists():subprocess.run(['/usr/bin/ditto','--rsrc','--extattr','--acl',str(f),str(target)],check=True)
 assert sha(target)==sha(f),'Backup differs'
result={**meta,'url':'https://n8n.mindobirdwatching.com/media-delivery/v1/'+ident+'/original.mp4','source':str(SOURCE),'backup_verified':True};Path('/private/tmp/mbw-ready-reel-20261105.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
