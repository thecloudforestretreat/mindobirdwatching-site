import sys,tempfile,hashlib,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server/media-delivery'))
from reel_uploads import ReelUploads,sha
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp)/'Reels';root.parent.mkdir(exist_ok=True)
 raw=b'test media bytes';digest=hashlib.sha256(raw).hexdigest()
 uploads=ReelUploads(root,'private-key',lambda:None,inspector=lambda p:{'width':1080,'height':1920,'duration':28.5})
 session=uploads.begin({'name':'video.mp4','bytes':len(raw)})['upload_id']
 try:uploads.chunk(session,0,raw,'0'*64);assert False
 except ValueError:pass
 uploads.chunk(session,0,raw,digest);uploads.chunk(session,0,raw,digest)
 result=uploads.finish(session);assert result['sha256']==digest and not result['transcoded']
 original=root/result['id']/'original.mp4';before=original.stat().st_mtime_ns;metadata=(original.parent/'metadata.json').read_bytes()
 assert uploads.finish(session)==result
 second=uploads.begin({'name':'renamed.mp4','bytes':len(raw)})['upload_id'];uploads.chunk(second,0,raw,digest);assert uploads.finish(second)['url']==result['url']
 assert original.stat().st_mtime_ns==before and (original.parent/'metadata.json').read_bytes()==metadata
 assert sha(original)==digest
 partial=uploads.begin({'name':'incomplete.mp4','bytes':100})['upload_id']
 try:uploads.finish(partial);assert False
 except ValueError:pass
 try:uploads.session('../escape');assert False
 except ValueError:pass
 for i in range(12):
  session=uploads.begin({'name':'video.mp4','bytes':len(raw)})['upload_id'];uploads.chunk(session,0,raw,digest);uploads.finish(session)
 print('PASS chunk checksum, retry idempotency, incomplete/path rejection, immutable existing object, completion retry.')
