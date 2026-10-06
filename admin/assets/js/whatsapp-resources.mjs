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
 return topics.flatMap(([topic,reason])=>{const candidates=items.filter(r=>validResource(r)&&r.approved===true&&r.topics?.includes(topic));const resource=candidates.find(r=>r.language===language)||candidates[0];return resource?[{...resource,reason}]:[];}).slice(0,2);
}
export function searchResources(items,query='',language='all'){
 const words=fold(query).split(/\s+/).filter(Boolean);
 return items.filter(r=>validResource(r)&&(language==='all'||r.language===language)&&words.every(w=>fold([r.title,r.description,r.purpose,r.url].join(' ')).includes(w))).sort((a,b)=>Number(b.approved)-Number(a.approved)||a.title.localeCompare(b.title));
}
