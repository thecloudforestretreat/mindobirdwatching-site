"""Runs with the existing Immich ML Pillow runtime; input/output through pipes."""
import sys,io,json
from PIL import Image,ImageOps
Image.MAX_IMAGE_PIXELS=50_000_000
raw=sys.stdin.buffer.read(13*1024*1024)
im=Image.open(io.BytesIO(raw));im.load();im=ImageOps.exif_transpose(im)
if sys.argv[1]=='inspect':
 print(json.dumps({'width':im.width,'height':im.height,'format':im.format or 'image'}));sys.exit()
fit,gravity=sys.argv[1:3];centers={'auto':(.5,.5),'center':(.5,.5),'north':(.5,0),'south':(.5,1),'east':(1,.5),'west':(0,.5)}
if im.mode!='RGB':
 bg=Image.new('RGB',im.size,'#f7f4e8')
 if 'A' in im.getbands():bg.paste(im,mask=im.getchannel('A'))
 else:bg.paste(im.convert('RGB'))
 im=bg
if fit=='fill':im=ImageOps.fit(im,(1080,1350),Image.Resampling.LANCZOS,centering=centers[gravity])
else:
 scaled=ImageOps.contain(im,(1080,1350),Image.Resampling.LANCZOS);canvas=Image.new('RGB',(1080,1350),'#f7f4e8');canvas.paste(scaled,((1080-scaled.width)//2,(1350-scaled.height)//2));im=canvas
im.save(sys.stdout.buffer,format='JPEG',quality=95,subsampling=0,optimize=True)
