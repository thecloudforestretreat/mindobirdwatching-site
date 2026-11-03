export const WAITING = new Set(['not_recorded','guest','guide','team','none']);
export function readFollowupMeta(notes='') {
 let result={nextAction:'',waitingOn:'not_recorded'};
 for(const line of String(notes).split('\n'))if(line.startsWith('[MBW_LAB_FOLLOWUP] ')){try{const x=JSON.parse(line.slice(19));if(typeof x.nextAction==='string'&&WAITING.has(x.waitingOn))result={nextAction:x.nextAction,waitingOn:x.waitingOn}}catch{}}
 return result;
}
export function validateFollowupPatch(patch,today){
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length)throw Object.assign(Error('No supported notes or follow-up changes supplied.'),{status:400});
 const limits={notes:3000,followup_date:10,next_action:500,waiting_on:30};
 for(const [k,v]of Object.entries(patch))if(!Object.hasOwn(limits,k)||typeof v!=='string'||v.length>limits[k])throw Object.assign(Error('Only notes, follow-up date, next action and waiting-on can be edited here.'),{status:400});
 if(patch.waiting_on!==undefined&&!WAITING.has(patch.waiting_on))throw Object.assign(Error('Choose a valid waiting-on state.'),{status:400});
 const d=patch.followup_date;if(d){const valid=/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;if(!valid||d<today)throw Object.assign(Error('Choose today or a future valid follow-up date, or clear it.'),{status:400});}
 return patch;
}
export function followupRecord(raw){return {inquiryId:String(raw.inquiry_id||''),notes:String(raw.notes||''),internalNotes:String(raw.internal_notes||''),followupDate:String(raw.followup_date||'').slice(0,10),updatedAt:String(raw.updated_at||''),assignedTo:String(raw.assigned_to||''),...readFollowupMeta(raw.internal_notes)}}
export function applyFollowupPatch(raw,patch,staff,timestamp){
 const before=readFollowupMeta(raw.internal_notes);const meta={nextAction:patch.next_action??before.nextAction,waitingOn:patch.waiting_on??before.waitingOn};
 const updated={...raw,updated_at:timestamp};for(const k of ['notes','followup_date'])if(patch[k]!==undefined)updated[k]=patch[k];
 updated.internal_notes=[raw.internal_notes||'',`[MBW_LAB_FOLLOWUP] ${JSON.stringify(meta)}`,`Lab notes/follow-up edit by ${staff} · ${timestamp} · fields: ${Object.keys(patch).join(', ')}`].filter(Boolean).join('\n');return updated;
}
