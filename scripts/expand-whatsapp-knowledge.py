"""Explicit catalog expansion from the current published website. Not run by nightly discovery."""
import hashlib,json,re,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('scanner',ROOT/'scripts/refresh-whatsapp-resources.py');scanner=importlib.util.module_from_spec(spec);spec.loader.exec_module(scanner)
ALIASES={
 'hummingbirds':['hummingbirds','hummingbird','colibrí','colibries','colibríes'],
 'toucans':['toucans','toucan','tucanes','tucán'],
 'tanagers':['tanagers','tanager','tangaras','tangara'],
 'cock_of_rock':['cock of the rock','cock-of-the-rock','gallo de la peña','gallito de las rocas'],
 'photography':['photography','photos','photographer','fotografía','fotografia','fotógrafo'],
 'lodging':['lodging','accommodation','hotel','hotels','lodge','lodges','alojamiento','hospedaje'],
 'seasonality':['best time','season','weather','rain','rainy','month','época','temporada','clima','lluvia'],
 'reserves':['reserve','reserves','reserva','reservas'],
 'itineraries':['itinerary','itineraries','multi-day','itinerario','itinerarios','varios días'],
 'beginner_birding':['beginner','beginners','first time birding','principiante','principiantes'],
 'equipment':['equipment','binoculars','scope','what to bring','equipo','binoculares','qué llevar'],
 'activities':['activities','things to do','actividades','qué hacer'],
}
def fold(text):
 import unicodedata
 return ''.join(c for c in unicodedata.normalize('NFD',text.lower()) if unicodedata.category(c)!='Mn')
def classify(path,title):
 text=fold(path+' '+title);topics=[];category=''
 if path.startswith(('activities/','actividades/')):category='Activities';topics=['activities']
 elif 'itinerar' in text or 'how-many-days' in text or 'cuantos-dias' in text:category='Itineraries';topics=['itineraries']
 elif any(w in text for w in ['reserve','reserva','birding-milpe','avistamiento-milpe','paz-de-las-aves','san-tadeo','tumpiki','sendero-de-las-aves','frutti-tour']):category='Reserves';topics=['reserves']
 elif any(w in text for w in ['photograph','fotograf']):category='Photography';topics=['photography']
 elif any(w in text for w in ['lodg','alojamiento','hospedaje','where-to-stay','where to stay','donde-alojarse','donde alojarse']):category='Lodging';topics=['lodging']
 elif any(w in text for w in ['calendar','calendario','season','seasons','best-time','mejor-epoca']):category='Trip timing';topics=['seasonality']
 elif 'beginner' in text or 'principiant' in text:category='Beginner birding';topics=['beginner_birding']
 elif any(w in text for w in ['equipment','binocular','scope','equipo']):category='Equipment';topics=['equipment']
 elif path.startswith(('birding/','blog/')) or any(w in text for w in ['bird','aves','toucan','tucan','hummingbird','colibri','tanager','tangara','racket','jacobin','woodnymph','violetear','brilliant','quetzal','motmot','barbet','antpitta','aracari','coronet','starfrontlet','momoto','barbudo','ninfa','jacobino','brillante','estrellita']):category='Bird guides';topics=['bird_guides']
 elif path.startswith(('tours/','plan-your-trip/','planifica-tu-viaje/')):category='Tour planning';topics=['trip_planning']
 if not category:return None
 for topic,words in ALIASES.items():
  if any(fold(word) in text for word in words):topics.append(topic)
 if 'cock-of-the-rock' in text or 'gallo-de-la-pena' in text:topics.append('cock_of_rock')
 # Specific page-name keywords; general keywords belong in topic rules, not broad fuzzy matches.
 slug=path.rstrip('/').split('/')[-1].replace('-',' ')
 keywords=[slug]+[word for topic in topics for word in ALIASES.get(topic,[]) if topic in ['hummingbirds','toucans','tanagers','cock_of_rock']]
 return category,list(dict.fromkeys(topics)),keywords
p=ROOT/'admin/assets/data/whatsapp-resource-catalog.json';catalog=json.loads(p.read_text());existing={r['url'] for r in catalog['resources']};index=json.loads((ROOT/'admin/assets/data/whatsapp-resources.json').read_text());added=0
for r in index['items']:
 url=r['url'];path=url.replace('https://mindobirdwatching.com/','');path=path.removeprefix('es/')
 if url in existing or not r['available'] or any(w in path.split('/') for w in ['shop','book-tour','contact','contacto','privacy-policy','politica-de-privacidad','terms-and-conditions']):continue
 if any(w in fold(r['title']) for w in ['unavailable','no disponible']):continue
 local=ROOT/url.replace('https://mindobirdwatching.com/','')/'index.html'
 if not local.is_file():continue
 classified=classify(path,r['title'])
 if not classified:continue
 category,topics,keywords=classified
 catalog['resources'].append({'id':'kb-'+hashlib.sha256(url.encode()).hexdigest()[:12],'url':url,'title':r['title'].split('|')[0].strip(),'language':r['language'],'type':'page','purpose':r.get('description','')[:250] or ('Published '+category.lower()+' information; review source before sharing.'),'topics':topics,'keywords':keywords,'category':category,'approved':True,'approvalBasis':'published_source_catalog','usage':'Informational resource; not a price, availability or sighting guarantee.'});added+=1
p.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n');print(f'Added {added} source-backed resource records; total {len(catalog["resources"])}')
