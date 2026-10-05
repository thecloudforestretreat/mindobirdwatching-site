export const AGENTS=['Juan','Susana'];
export const STATUSES=['open','needs_staff','resolved'];
export function firstResponse(thread,kind='human'){
 const messages=thread.messages||[],incoming=messages.filter(m=>m.direction==='in'&&Number.isFinite(Date.parse(m.at))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];
 if(!incoming)return null;
 const response=messages.filter(m=>m.direction==='out'&&m.kind===kind&&['accepted','delivered','read','sample'].includes(m.delivery)&&Date.parse(m.at)>=Date.parse(incoming.at)).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];
 return response?{at:response.at,minutes:(Date.parse(response.at)-Date.parse(incoming.at))/60000,sample:response.delivery==='sample'}:null;
}
export function sampleThreads(now=Date.now()){
 const at=minutes=>new Date(now-minutes*60000).toISOString(),message=(id,direction,text,minutes,kind='guest')=>({id,direction,text,at:at(minutes),kind,actor:kind==='human'?'Susana':undefined,delivery:'sample'});
 return [
 {id:'sample-1',name:'Alex · sample guest',language:'en',owner:'',status:'needs_staff',topic:'Full-day birding',inquiryId:'',nextAction:'Ask for tour date and group size',messages:[message('a1','in','Hello! We are interested in the full-day birding tour. What options do you offer?',95),message('a2','out','Thanks for contacting Mindo Bird Watching. Our team will help you choose a tour.',94,'automation')],notes:[],draft:''},
 {id:'sample-2',name:'Lucía · sample guest',language:'es',owner:'Susana',status:'open',topic:'Transportation',inquiryId:'',nextAction:'Confirm pickup details with the guest',messages:[message('b1','in','Hola, ¿pueden ayudarnos con transporte desde Quito?',48),message('b2','out','Hola, Lucía. ¿Para qué fecha y cuántas personas necesitan transporte?',35,'human'),message('b3','in','Somos tres personas. Aún estamos decidiendo la fecha.',18)],notes:[],draft:''},
 {id:'sample-3',name:'Robin · sample guest',language:'en',owner:'Juan',status:'needs_staff',topic:'Custom itinerary',inquiryId:'',nextAction:'Review target birds and prepare a custom itinerary',messages:[message('c1','in','Can you arrange three days of birding with specific target birds and lodging?',170)],notes:[],draft:''},
 {id:'sample-4',name:'Taylor · sample guest',language:'en',owner:'Susana',status:'resolved',topic:'General information',inquiryId:'',nextAction:'',messages:[message('d1','in','Where can I browse your tours?',240),message('d2','out','You can explore our tours at https://mindobirdwatching.com/tours/.',230,'human')],notes:[],draft:''}
 ];
}
export function filterThreads(threads,{search='',queue='all',agent='Juan'}={}){
 const q=search.trim().toLowerCase();return threads.filter(t=>(!q||[t.name,t.topic,t.nextAction,...t.messages.map(m=>m.text)].join(' ').toLowerCase().includes(q))&&(queue==='all'||queue==='mine'&&t.owner===agent&&t.status!=='resolved'||queue==='unassigned'&&!t.owner&&t.status!=='resolved'||queue==='needs_staff'&&t.status==='needs_staff'||queue==='resolved'&&t.status==='resolved'));
}
export function mutateSample(thread,action,actor,now=Date.now()){
 if(!thread.id.startsWith('sample-'))throw new Error('Only sample conversations can be changed.');
 if(!AGENTS.includes(actor))throw new Error('Choose a sample staff member.');
 const t=structuredClone(thread),at=new Date(now).toISOString(),text=String(action.text||'').trim();
 if(action.type==='reply'){if(!text||text.length>4000)throw new Error('Reply must contain 1–4,000 characters.');t.messages.push({id:'sample-message-'+crypto.randomUUID(),direction:'out',kind:'human',text,at,actor,delivery:'sample'});t.draft='';t.status='open';}
 else if(action.type==='note'){if(!text||text.length>2000)throw new Error('Note must contain 1–2,000 characters.');t.notes.push({text,actor,at});t.noteDraft='';}
 else if(action.type==='assign'){if(action.owner!==''&&!AGENTS.includes(action.owner))throw new Error('Unknown staff member.');t.owner=action.owner;t.notes.push({text:action.owner?'Assigned to '+action.owner:'Returned to unassigned',actor,at});}
 else if(action.type==='status'){if(!STATUSES.includes(action.status))throw new Error('Unknown status.');t.status=action.status;}
 else if(action.type==='next'){if(text.length>300)throw new Error('Next action is too long.');t.nextAction=text;}
 else if(action.type==='link'){if(text&&!/^[A-Za-z0-9_-]{1,100}$/.test(text))throw new Error('Use a valid inquiry ID.');t.inquiryId=text;}
 else throw new Error('Unknown action.');return t;
}
export function normalizeKnowledge(payload){
 const rows=Array.isArray(payload?.items)?payload.items:Object.entries(payload?.languages||{}).flatMap(([language,subjects])=>Object.entries(subjects).flatMap(([subject,items])=>Array.isArray(items)?items.map(r=>({...r,language,subject})):[]));
 return rows.filter(r=>!['no','false','0'].includes(String(r.is_active??'').toLowerCase())).map((r,i)=>({id:String(r.content_id||r.id||i).slice(0,100),language:r.language==='es'?'es':'en',subject:String(r.subject||'General').slice(0,100),title:String(r.title||r.topic||'Information').slice(0,200),price:String(r.cost||'').slice(0,200),text:String(r.whatsapp_ready||r.message_short||r.message_long||'').slice(0,4000),updated:String(r.last_updated||'').slice(0,50)})).filter(r=>r.text);
}
export function restoreSamples(value){
 if(!value||value.version!==1||!Array.isArray(value.threads)||value.threads.length!==4)return null;
 const ids=new Set();for(const t of value.threads){if(!/^sample-[1-4]$/.test(t.id)||ids.has(t.id)||!Array.isArray(t.messages)||!Array.isArray(t.notes)||!STATUSES.includes(t.status)||!(t.owner===''||AGENTS.includes(t.owner))||typeof t.name!=='string'||typeof t.draft!=='string')return null;ids.add(t.id);
 if(t.messages.some(m=>typeof m.text!=='string'||m.text.length>4000||!Number.isFinite(Date.parse(m.at))||m.delivery!=='sample'||!['in','out'].includes(m.direction)))return null;
 if(t.notes.some(n=>typeof n.text!=='string'||!AGENTS.includes(n.actor)))return null;
 }return value.threads;
}
