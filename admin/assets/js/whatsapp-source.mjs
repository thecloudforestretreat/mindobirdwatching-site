// Deterministic extraction only. Message tracking does not prove ad delivery or booking.
export function parseInquirySource(text=''){
 const references=[...String(text).matchAll(/(?:^|\n)\s*Reference:\s*(ci_[A-Za-z0-9_-]{4,120})\b/gi)].map(m=>m[1]);
 const pageMatch=String(text).match(/(?:^|\n)\s*Page:\s*(https?:\/\/[^\s<>]+)/i);let page=null,invalidPage=false;
 if(pageMatch){try{const u=new URL(pageMatch[1]);if(u.username||u.password||!['mindobirdwatching.com','www.mindobirdwatching.com'].includes(u.hostname)||!['https:','http:'].includes(u.protocol))invalidPage=true;else page=u;}catch{invalidPage=true;}}
 const tracking={};if(page)for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','meta_campaign_id','meta_adset_id','meta_ad_id']){const values=page.searchParams.getAll(key);if(values.length)tracking[key]=values[0].slice(0,300);}
 const source=(tracking.utm_source||'').toLowerCase(),medium=(tracking.utm_medium||'').toLowerCase();const paid=/^(paid_social|paid|cpc|ppc|paid_search|display)$/.test(medium);const meta=['meta','facebook','instagram','fb','ig'].includes(source);const hasMetaIds=!!(tracking.meta_campaign_id||tracking.meta_adset_id||tracking.meta_ad_id),hasClickId=!!page?.searchParams.has('fbclid');
 const label=paid?(meta?'Meta paid social tracking':(source||'Unspecified source')+' paid tracking'):hasMetaIds?'Meta ad IDs present':source?(source+' · '+(medium||'medium missing')):hasClickId?'Facebook click identifier present':'Source unknown';
 const duplicateTracking=page?[...new Set([...page.searchParams.keys()])].filter(k=>(k.startsWith('utm_')||k.startsWith('meta_'))&&page.searchParams.getAll(k).length>1):[];
 const bookingIntent=/\b(?:reserve|reservation|book(?:ing)?|reservar|reserva)\b/i.test(String(text).split(/\n\s*(?:Page|Reference):/i)[0]);
 return {reference:references.at(-1)||'',references:[...new Set(references)],landingPage:page?{url:page.origin+page.pathname,path:page.pathname}:null,tracking,label,paidTracking:paid,hasMetaIds,hasClickId,invalidPage,duplicateTracking,bookingIntent,evidence:'Message URL tracking; not verified ad delivery',specificTourKnown:false};
}
export function conversationSource(messages){const incoming=(messages||[]).filter(m=>m.direction==='in');const parsed=incoming.map(m=>({...parseInquirySource(m.text),messageId:m.id}));return parsed.findLast(p=>p.reference||p.landingPage||p.invalidPage)||parseInquirySource(incoming.at(-1)?.text||'');}
