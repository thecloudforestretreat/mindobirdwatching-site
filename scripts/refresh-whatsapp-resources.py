"""Build the resource index. Public metadata only; no prices, CRM or LLM calls."""
import argparse, json, re, sys, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor,as_completed
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
from urllib.request import Request, build_opener, HTTPRedirectHandler
ROOT=Path(__file__).resolve().parents[1]
HOST='mindobirdwatching.com'
def safe_url(url):
 u=urlparse(url)
 return u.scheme=='https' and u.netloc==HOST and not u.query and not u.fragment and not any(p in unquote(u.path).split('/') for p in ['admin','api','inquiry-studio','create','checkout','..','.'])
def parse_sitemap(text):
 root=ET.fromstring(text);urls={};children=[]
 for entry in root:
  fields={e.tag.split('}')[-1]:e.text for e in entry if e.tag.split('}')[-1] in ['loc','lastmod']}
  url=(fields.get('loc') or '').strip()
  if not safe_url(url):continue
  if root.tag.endswith('sitemapindex'):children.append(url)
  else:
   urls[url]=fields.get('lastmod') or ''
   for link in entry:
    alternate=link.attrib.get('href','')
    if link.attrib.get('hreflang') in ['en','es'] and safe_url(alternate):urls.setdefault(alternate,fields.get('lastmod') or '')
 return urls,children
class Metadata(HTMLParser):
 def __init__(self):super().__init__();self.in_title=False;self.title='';self.description='';self.heading=False;self.headings=[];self.heading_text=''
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='title':self.in_title=True
  if tag in ['h1','h2']:self.heading=True;self.heading_text=''
  if tag=='meta' and a.get('name','').lower()=='description':self.description=a.get('content','')[:350]
 def handle_endtag(self,tag):
  if tag=='title':self.in_title=False
  if tag in ['h1','h2'] and self.heading:
   self.heading=False
   if len(self.headings)<8:self.headings.append(re.sub(r'\s+',' ',self.heading_text).strip()[:180])
 def handle_data(self,text):
  if self.in_title:self.title+=text
  if self.heading:self.heading_text+=text
 def result(self):return {'title':re.sub(r'\s+',' ',self.title).strip()[:200],'description':self.description,'headings':self.headings}
class SafeRedirect(HTTPRedirectHandler):
 def redirect_request(self,request,fp,code,msg,headers,newurl):
  if not safe_url(newurl):raise ValueError('Unexpected redirect')
  return super().redirect_request(request,fp,code,msg,headers,newurl)
def fetch(url):
 if not safe_url(url):raise ValueError('Unapproved URL')
 with build_opener(SafeRedirect()).open(Request(url,headers={'User-Agent':'MBW-Resource-Index/1.0'}),timeout=20) as response:
  if not safe_url(response.url):raise ValueError('Unexpected redirect')
  data=response.read(2_000_001)
  if len(data)>2_000_000:raise ValueError('Response too large')
  return data.decode('utf-8','replace')
def build(urls,catalog,root=ROOT,live=False,fetcher=fetch):
 now=datetime.now(timezone.utc).isoformat();curated={r['url']:r for r in catalog['resources']};items=[]
 remote={}
 if live:
  def check(url):
   try:
    parser=Metadata();parser.feed(fetcher(url));result=parser.result()
    if not result['title'] or re.search(r'404|page not found|pagina no encontrada|currently unavailable|actualmente no disponible',result['title'],re.I):raise ValueError('Unavailable page')
    return result
   except Exception:return None
  targets=[url for url in curated if url in urls and safe_url(url)]
  with ThreadPoolExecutor(max_workers=8) as pool:
   futures={pool.submit(check,url):url for url in targets}
   for future in as_completed(futures):remote[futures[future]]=future.result()
 for url in sorted(set(urls)|set(curated)):
  if not safe_url(url):continue
  path=urlparse(url).path;config=curated.get(url);meta={};available=url in urls;verified='sitemap_only'
  local=root/path.strip('/')/'index.html' if path!='/' else root/'index.html'
  if local.is_file():parser=Metadata();parser.feed(local.read_text(errors='replace'));meta=parser.result()
  if config and live and available:
   if remote.get(url):meta=remote[url];verified='http_checked'
   else:available=False;verified='http_unavailable'
  title=(config or {}).get('title') or meta.get('title') or path.strip('/').split('/')[-1].replace('-',' ').title() or 'Mindo Bird Watching'
  items.append({'id':(config or {}).get('id',path),'type':'page','url':url,'title':title,'description':meta.get('description',''),'purpose':(config or {}).get('purpose',''),'language':(config or {}).get('language','es' if path.startswith('/es/') else 'en'),'topics':(config or {}).get('topics',[]),'keywords':(config or {}).get('keywords',[]),'groupId':(config or {}).get('groupId',url),'category':(config or {}).get('category','Tour planning' if config else 'Discovered'),'headings':meta.get('headings',[]),'usage':(config or {}).get('usage',''),'approved':bool(config and config.get('approved')),'available':available,'verification':verified,'lastModified':urls.get(url,''),'checkedAt':now})
 return {'version':1,'source':'https://mindobirdwatching.com/sitemap.xml','checkedAt':now,'scanMode':'live' if live else 'repository','futureSources':catalog['futureSources'],'items':items}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--live',action='store_true');args=parser.parse_args();urls={}
 if args.live:
  pending=['https://mindobirdwatching.com/sitemap.xml'];seen=set()
  while pending:
   url=pending.pop()
   if url in seen:continue
   if len(seen)>=10:raise ValueError('Too many sitemap indexes')
   seen.add(url);found,children=parse_sitemap(fetch(url));urls.update(found);pending.extend(children)
 else:
  for name in ['sitemap.xml','sitemap-static.xml']:
   found,_=parse_sitemap((ROOT/name).read_text());urls.update(found)
 if len(urls)<10:raise ValueError('Sitemap scan unexpectedly small; existing index retained')
 catalog=json.loads((ROOT/'admin/assets/data/whatsapp-resource-catalog.json').read_text())
 data=build(urls,catalog,live=args.live);output=ROOT/'admin/assets/data/whatsapp-resources.json';temporary=output.with_suffix('.tmp');temporary.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temporary.replace(output)
 print(f"Indexed {len(data['items'])} pages; {sum(r['approved'] and r['available'] for r in data['items'])} curated resources available")
if __name__=='__main__':
 try:main()
 except Exception as error:print(f'Refresh failed; previous index retained: {error}',file=sys.stderr);sys.exit(1)
