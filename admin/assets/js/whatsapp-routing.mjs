// Reusable approved-reply routing. Pure preparation only: no sending or CRM writes.
const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const body=text=>String(text||'').split(/\n\s*(?:Page|Reference):/i)[0];
export function prepareFullDayReply(messages,knowledge,language='en'){
 const inbound=(messages||[]).filter(m=>m.direction==='in').map(m=>body(m.text));const latest=fold(inbound.at(-1));
 // Only route explicit full-day birding inquiries, never a generic landing page.
 const fullDay=/\bfull[ -]day\b|\bdia (?:completo|entero)\b|\btodo el dia\b/;
 const birding=/\bbird(?:ing|watching)?\b|\baves\b|\btour\b|\bexcursion\b/;
 if(/\b(?:price|cost|payment|invoice|refund|cancel|available|availability|precio|costo|pago|factura|reembolso|cancelar|disponible|disponibilidad)\b/.test(latest))return {matched:false};
 if(!fullDay.test(latest)||!birding.test(latest)||/\b(?:bear|oso|condor|half[ -]day|medio dia)\b/.test(latest))return {matched:false};
 const rows=(knowledge||[]).filter(r=>r.language===language&&!/^(?:image|imagen|promo)/.test(fold(r.title)));
 const quest=rows.find(r=>/quest for five toucans|cinco tucanes/.test(fold(r.title)));
 const custom=rows.find(r=>/custom full day|personalizado de dia completo/.test(fold(r.title)));
 if(!quest||!custom)return {matched:true,ready:false,reason:'The live library must contain both Quest and Custom Full Day references in the selected language. No tour options were guessed.'};
 const all=fold(inbound.join('\n'));const knownDate=/\b20\d{2}-\d{2}-\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+\d{1,2}\b|\b\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b|\b(?:tomorrow|manana)\b/.test(all);
 const knownParty=/\b(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:people|persons?|guests?|adults?|personas|adultos)\b|\b(?:there (?:are|will be)|we are|we're|somos)\s+(?:\d{1,2}|two|three|four|five|dos|tres|cuatro|cinco)\b/.test(all);
 const knownTargets=/\b(?:target(?:ing)?|interested in|want to see|looking for|interesad[oa]s? en|queremos ver|buscar)\s+(?!the full|a full|full.day|birding|a tour|tours|aves en general)[a-z][a-z -]{2,}/.test(all);
 const missing=[!knownDate&&'date',!knownParty&&'party'].filter(Boolean);
 const questions=language==='es'?{date:'¿Qué fecha tienes en mente?',party:'¿Cuántas personas participarían?',targets:'¿Hay alguna especie de ave que te interese especialmente?'}:{date:'What date are you considering?',party:'How many people will join?',targets:'Are there any particular birds you’d like to see?'};
 const question=missing.length===2?(language==='es'?'¿Qué fecha tienes en mente y cuántas personas participarían?':'What date are you considering and how many people will join?'):missing.map(k=>questions[k]).join(' ');
 const introduction=language==='es'?'¡Hola! Para observación de aves de día completo, ofrecemos En Busca de Cinco Tucanes y el Gallo de Peña, o un Tour Personalizado de Día Completo.':'Hi! For full-day birding, we offer Quest for Five Toucans & the Andean Cock-of-the-Rock, or a Custom Full Day Tour.';
 return {matched:true,ready:true,reply:[introduction,question].filter(Boolean).join(' '),sources:[quest,custom].map(r=>({id:r.id,title:r.title,updated:r.updated||''})),missing,engine:'approved_pattern',sendingEnabled:false};
}
