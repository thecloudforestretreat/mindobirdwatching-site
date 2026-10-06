import {suggestedBooking} from './whatsapp-readiness.mjs';
export function handoffSummary(thread,record){
 const inferred=suggestedBooking(thread.messages),known=thread.booking||record||{};
 const lastGuest=thread.messages.filter(m=>m.direction==='in').at(-1);
 const lastStaff=thread.messages.filter(m=>m.direction==='out'&&m.kind==='human').at(-1);
 const latestNote=thread.notes.at(-1);
 return {owner:thread.owner||'Unassigned',tour:known.tour||inferred.tour||'Not selected',date:known.date||inferred.date||'Not decided',guests:known.guests||inferred.guests||'Unknown',source:thread.booking?'Staff-reviewed test details':record?'Linked CRM': 'Suggested from messages · verify',lastGuest:lastGuest?.text||'No guest message',lastStaff:lastStaff?.text||'No staff reply yet',lastStaffBy:lastStaff?.actor||'',note:latestNote?.text||'No internal note',nextAction:thread.nextAction||'No next action recorded',inquiryId:thread.inquiryId||'Not linked',ambiguities:inferred.ambiguous};
}
const encode=new TextEncoder(),decode=new TextDecoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
async function digest(value){return hex(await crypto.subtle.digest('SHA-256',encode.encode(JSON.stringify(value))));}
export function inspectSnapshot(data){
 if(!data||data.mode!=='shared_test'||data.sendingEnabled!==false||data.metaConnected!==false||!Array.isArray(data.threads)||!data.threads.length)throw Error('This is not a disconnected test inbox backup.');
 const ids=new Set();let messages=0,notes=0;
 for(const t of data.threads){
  if(!/^sample-[1-4]$/.test(t.id)||ids.has(t.id)||typeof t.name!=='string'||typeof t.draft!=='string'||!Array.isArray(t.messages)||!Array.isArray(t.notes))throw Error('Invalid or duplicate conversation in backup.');ids.add(t.id);
  for(const m of t.messages)if(typeof m.text!=='string'||!['in','out'].includes(m.direction)||!Number.isFinite(Date.parse(m.at)))throw Error('Invalid message in backup.');
  for(const n of t.notes)if(typeof n.text!=='string')throw Error('Invalid note in backup.');
  messages+=t.messages.length;notes+=t.notes.length;
 }
 for(const key of ['replies','learning','events','learningHistory'])if(!Array.isArray(data[key]))throw Error('Backup is missing '+key+'.');
 for(const row of [...data.events,...data.learningHistory])if(row.data){try{JSON.parse(row.data);}catch{throw Error('Invalid audit/history data.');}}
 return {conversations:ids.size,messages,notes,savedReplies:data.replies.length,reviewedLessons:data.learning.length,historyVersions:data.learningHistory.length,auditEvents:data.events.length,exportedAt:data.exportedAt||'Unknown'};
}
export async function packBackup(snapshot){inspectSnapshot(snapshot);return {format:'mbw-whatsapp-test-backup',version:1,sha256:await digest(snapshot),snapshot};}
export async function unpackBackup(value){
 if(value?.format!=='mbw-whatsapp-test-backup'||value.version!==1||typeof value.sha256!=='string')throw Error('Unsupported backup format.');
 if(await digest(value.snapshot)!==value.sha256)throw Error('Backup integrity check failed.');
 return {snapshot:value.snapshot,summary:inspectSnapshot(value.snapshot)};
}
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
async function keyFor(password,salt){if(password.length<12)throw Error('Use a backup passphrase of at least 12 characters.');const material=await crypto.subtle.importKey('raw',encode.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function encryptBackup(value,password){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(password,salt);
 const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encode.encode(JSON.stringify(value)));
 // Chunking avoids argument limits on larger test histories.
 let binary='';const array=new Uint8Array(bytes);for(let i=0;i<array.length;i+=8192)binary+=String.fromCharCode(...array.subarray(i,i+8192));
 return {format:'mbw-whatsapp-encrypted-backup',version:1,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:250000,salt:b64(salt),iv:b64(iv),ciphertext:btoa(binary)};
}
export async function decryptBackup(value,password){
 if(value?.format!=='mbw-whatsapp-encrypted-backup'||value.version!==1||value.iterations!==250000||value.algorithm!=='AES-256-GCM'||value.kdf!=='PBKDF2-SHA256')throw Error('Unsupported encrypted backup.');
 try{const key=await keyFor(password,unb64(value.salt));return JSON.parse(decode.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(value.iv)},key,unb64(value.ciphertext))));}catch{throw Error('Cannot unlock backup. Check the passphrase and file.');}
}
