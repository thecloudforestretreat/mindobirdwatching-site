const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function validResource(r){try{const u=new URL(r.url);return r.type==='page'&&u.protocol==='https:'&&u.hostname==='mindobirdwatching.com'&&!u.username&&!u.password&&!u.search&&!u.hash&&r.available===true&&typeof r.title==='string';}catch{return false;}}
export function recommendResources(messages,items,language='en'){
 const text=fold(messages.filter(m=>m.direction==='in').slice(-6).map(m=>String(m.text).split(/\n\s*(?:Page|Reference):/i)[0]).join(' '));
 const topics=[];
 if(/target birds?|specific (?:birds?|species)|particular birds?|aves objetivo|especies especificas|aves especificas/.test(text))topics.push(['target_birds','Guest mentioned specific target birds.']);
 if(/custom|three days|multi.day|varios dias|tres dias|personalizad/.test(text)&&/bird|birding|aves|pajar/.test(text))topics.push(['custom_birding','Guest is asking about a custom or multi-day birding trip.']);
 if(!topics.length&&/tour options|what tours|que tours|opciones de tour/.test(text))topics.push(['tour_options','Guest asked about tour options.']);
 return topics.flatMap(([topic,reason])=>{const candidates=items.filter(r=>validResource(r)&&r.approved===true&&r.topics?.includes(topic));const resource=candidates.find(r=>r.language===language)||candidates[0];return resource?[{...resource,reason}]:[];}).slice(0,2);
}
export function searchResources(items,query='',language='all'){
 const words=fold(query).split(/\s+/).filter(Boolean);
 return items.filter(r=>validResource(r)&&(language==='all'||r.language===language)&&words.every(w=>fold([r.title,r.description,r.purpose,r.url].join(' ')).includes(w))).sort((a,b)=>Number(b.approved)-Number(a.approved)||a.title.localeCompare(b.title));
}
