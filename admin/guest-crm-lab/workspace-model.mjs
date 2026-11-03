export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const dateAdd=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export function meta(notes=''){let out={nextAction:'',waitingOn:'not_recorded'};for(const line of String(notes).split('\n'))if(line.startsWith('[MBW_LAB_FOLLOWUP] ')){try{const m=JSON.parse(line.slice(19));if(typeof m.nextAction==='string'&&['not_recorded','guest','guide','team','none'].includes(m.waitingOn))out=m}catch{}}return out}
export const operational=r=>!r.archived&&!r.closed&&!r.past;
export const waitingLabel=w=>({guest:'Awaiting guest',guide:'Awaiting guide',team:'Awaiting our team',none:'Nothing pending',not_recorded:'Waiting-on not recorded'}[w]||'Waiting-on not recorded');
export function lenses(ctx,staff=''){
 const active=ctx.records.filter(operational),upcoming=new Set(ctx.entries.filter(e=>e.date>=ctx.today&&e.date<=dateAdd(ctx.today,7)&&['booked','deposit_paid'].includes(e.status)).map(e=>e.inquiry_id));
 const missing=new Set(ctx.entries.filter(e=>e.date>=ctx.today&&['booked','deposit_paid'].includes(e.status)&&(!e.provider||!e.time||!e.pickup)).map(e=>e.inquiry_id));
 return {all:active.map(r=>r.inquiry_id),due:active.filter(r=>['today','overdue'].includes(r.followup?.kind)).map(r=>r.inquiry_id),mine:active.filter(r=>staff&&r.assigned_to===staff&&['today','overdue'].includes(r.followup?.kind)).map(r=>r.inquiry_id),departures:[...upcoming],guest:active.filter(r=>meta(r.internal_notes).waitingOn==='guest').map(r=>r.inquiry_id),guide:active.filter(r=>meta(r.internal_notes).waitingOn==='guide').map(r=>r.inquiry_id),team:active.filter(r=>meta(r.internal_notes).waitingOn==='team').map(r=>r.inquiry_id),missing:[...missing]};
}
const minutes=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i);if(!m)return null;let h=+m[1],n=+m[2];if(m[3]){if(h<1||h>12)return null;h=h%12+(/^pm$/i.test(m[3])?12:0)}return h>23||n>59?null:h*60+n};
export function scheduleConflicts(rows,today){
 const unique=new Map();for(const a of rows){if(a.assignment_kind==='tour_plan'||a.is_deleted==='Yes'||['cancelled','completed'].includes(a.assignment_status)||String(a.service_date||'')<today)continue;const name=a.provider_name==='Other'?a.provider_name_other:a.provider_name;if(!name)continue;const id=a.assignment_id||[a.inquiry_id,a.service_date,a.start_time,a.service_type,name].join('|');unique.set(id,{...a,id,provider:name,key:String(a.provider_id||name).trim().toLowerCase(),start:minutes(a.start_time),end:minutes(a.end_time)})}
 const items=[...unique.values()],unknown=items.filter(a=>a.start===null||a.end===null||a.end<=a.start),valid=items.filter(a=>!unknown.includes(a)),overlaps=[];
 for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++){const a=valid[i],b=valid[j];if(a.assignment_group_id&&a.assignment_group_id===b.assignment_group_id&&a.start===b.start&&a.end===b.end&&a.service_type===b.service_type)continue;if(a.key===b.key&&a.service_date===b.service_date&&a.start<b.end&&b.start<a.end)overlaps.push({a,b});}
 return {overlaps,unknown};
}
export function followupPatch(base,values,{dateChanged=false,clearDate=false}={}){const patch={};if(values.notes!==base.notes)patch.notes=values.notes;if(values.nextAction!==base.nextAction)patch.next_action=values.nextAction;if(values.waitingOn!==base.waitingOn)patch.waiting_on=values.waitingOn;if(clearDate)patch.followup_date='';else if(dateChanged)patch.followup_date=values.followupDate;return patch}
