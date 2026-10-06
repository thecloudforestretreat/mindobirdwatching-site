// Provider-neutral test adapter. No network, live sending or CRM writes.
export function normalizeContactPhone(value){const raw=String(value||'');if(!/^[+\d ()-]+$/.test(raw))throw Error('Invalid phone');const digits=raw.replace(/\D/g,'');if(!/^[1-9]\d{7,14}$/.test(digits))throw Error('Use full international phone including country code');return digits;}
export function applyIncomingEvent(state,event){
 const next=structuredClone(state),id=String(event.id||'');
 if(!/^[A-Za-z0-9_.:-]{1,200}$/.test(id)||!['incoming','app_echo','api_echo'].includes(event.type)||typeof event.text!=='string'||!event.text.trim()||event.text.length>4000||!Number.isFinite(Date.parse(event.at)))throw Error('Invalid simulated provider event');
 const phone=normalizeContactPhone(event.phone),signature=JSON.stringify([phone,event.type,event.text,event.at]);
 const previous=next.receipts?.[id];if(previous){if(previous!==signature)throw Error('Provider message ID reused with conflicting data');return {state:next,duplicate:true,crmWrites:0,sendingEnabled:false};}
 next.receipts||={};next.receipts[id]=signature;next.contacts||={};const contact=next.contacts[phone]||={phone,messages:[],crmState:'needs_review',inquiryIds:[]};
 contact.messages.push({id,direction:event.type==='incoming'?'in':'out',source:event.type==='incoming'?'guest':'whatsapp_app_or_api',text:event.text,at:event.at});
 contact.messages.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||(a.direction==='in'?0:1)-(b.direction==='in'?0:1)||a.id.localeCompare(b.id));
 if(event.type==='incoming')contact.lastInboundAt=contact.messages.filter(m=>m.direction==='in').at(-1).at;
 return {state:next,duplicate:false,crmWrites:0,sendingEnabled:false};
}
