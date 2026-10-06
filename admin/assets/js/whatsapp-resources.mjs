const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function validResource(r){try{const u=new URL(r.url);return r.type==='page'&&u.protocol==='https:'&&u.hostname==='mindobirdwatching.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&r.available===true&&typeof r.title==='string';}catch{return false;}}
export function recommendResources(messages,items,language='en'){
 const inbound=messages.filter(m=>m.direction==='in').slice(-6).map(m=>fold(String(m.text).split(/\n\s*(?:Page|Reference):/i)[0]));const latest=inbound.at(-1)||'';const text=/target|specific|especific|custom|personaliz|transport|transfer|traslado|night walk|caminata nocturna|full.day|half.day|medio dia|tour options|what tours|opciones de tour/.test(latest)?latest:inbound.join(' ');
 const topics=[];
 if(/target birds?|specific (?:birds?|species)|particular birds?|aves objetivo|especies especificas|aves especificas/.test(text))topics.push(['target_birds','Guest mentioned specific target birds.']);
 if(/custom|three days|multi.day|varios dias|tres dias|personalizad/.test(text)&&/bird|birding|aves|pajar/.test(text))topics.push(['custom_birding','Guest is asking about a custom or multi-day birding trip.']);
 if(/transport|transfer|transporte|traslado/.test(text))topics.push(['transportation','Guest asked about transportation.']);
 if(/full.day|dia completo|dia entero/.test(text)&&/bird|tour|aves/.test(text))topics.push(['full_day_birding','Guest asked about full-day birding.']);
 if(/half.day|medio dia/.test(text)&&/bird|tour|aves/.test(text))topics.push(['half_day_birding','Guest asked about half-day birding.']);
 if(/night walk|caminata nocturna/.test(text))topics.push(['night_walk','Guest asked about a night walk.']);
 if(/plan.*trip|trip.*plan|planificar.*viaje/.test(text))topics.push(['trip_planning','Guest is planning their visit.']);
 if(!topics.length&&/tour options|what tours|que tours|opciones de tour/.test(text))topics.push(['tour_options','Guest asked about tour options.']);
 const selected=topics.flatMap(([topic,reason])=>{const candidates=items.filter(r=>validResource(r)&&r.approved===true&&r.topics?.includes(topic));const resource=candidates.find(r=>r.language===language)||candidates[0];return resource?[{...resource,reason}]:[];});
 const stops=new Set('a an the and or for with of to in is are can could we i you do have how what where when would like want interested good best offering offer visit see get any need information tell please still guests people tour tours bird birds birding mindo ecuador el la los las de del en y para con un una que como donde cuando aves'.split(' '));
 const tokens=[...new Set(text.split(/[^a-z0-9]+/).filter(w=>w.length>=3&&!stops.has(w)))];
 const candidates=items.filter(r=>validResource(r)&&r.approved===true),frequency=new Map(tokens.map(w=>[w,candidates.filter(r=>fold(r.title+' '+r.url).split(/[^a-z0-9]+/).includes(w)).length]));
 const categoryRules=[['Photography',/photograph|photos|fotograf/],['Lodging',/lodg|accommodation|hotel|where.*stay|alojamiento|hospedaje|alojarse|dormir/],['Reserves',/reserve|reserva|milpe|silanche|paz de las aves/],['Itineraries',/itinerar|how many days|cuantos dias/],['Trip timing',/season|best time|weather|rain|temporada|clima|lluvia|epoca/],['Equipment',/equipment|binocular|scope|what to bring|equipo|que llevar/],['Beginner birding',/beginner|first time bird|principiante/],['Activities',/activities|things to do|actividades|que hacer/]];
 const ranked=candidates.map(r=>{const title=fold(r.title+' '+r.url),words=new Set(title.split(/[^a-z0-9]+/));let score=0,reason='',lexical=false;for(const word of tokens)if(words.has(word)){score+=frequency.get(word)<=12?9:1;lexical=true;reason='Matches your guest’s question: '+word+'.';}for(const keyword of r.keywords||[])if(fold(keyword).length>=4&&text.includes(fold(keyword))){score+=10;lexical=true;reason='Matches your guest’s question: '+keyword+'.';}for(const [category,pattern]of categoryRules)if(r.category===category&&pattern.test(text)){score+=12;reason='Relevant '+category.toLowerCase()+' information for this inquiry.';}if(r.language===language)score+=0.5;if(r.url.includes('/birding/'))score+=0.1;return {...r,score,reason,lexical};}).filter(r=>r.score>=6&&(!tokens.some(w=>frequency.get(w)>0&&frequency.get(w)<=12)||r.lexical)).sort((a,b)=>b.score-a.score||a.title.length-b.title.length);
 // Prefer the selected language for the same title/category/entity match; avoid translated duplicates.
 const result=[...selected];for(const r of ranked){if(result.some(x=>x.id===r.id||x.groupId&&x.groupId===r.groupId||x.category===r.category&&x.topics?.length>1&&JSON.stringify(x.topics)===JSON.stringify(r.topics)))continue;result.push(r);if(result.length>=3)break;}
 return result.slice(0,3);

}
export function searchResources(items,query='',language='all'){
 const words=fold(query).split(/\s+/).filter(Boolean);
 return items.filter(r=>validResource(r)&&(language==='all'||r.language===language)&&words.every(w=>fold([r.title,r.description,r.purpose,r.url,...(r.keywords||[]),...(r.headings||[])].join(' ')).includes(w))).sort((a,b)=>Number(b.approved)-Number(a.approved)||a.title.localeCompare(b.title));
}
