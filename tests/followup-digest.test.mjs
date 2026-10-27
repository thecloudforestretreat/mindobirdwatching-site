import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=fs.readFileSync(process.env.MBW_ROUTER_QA_SOURCE || new URL('../deployment/multi-invoice-ledger/crm-router.gs',import.meta.url),'utf8');
function harness(count=450){
 const headers=['inquiry_id','status','requested_date_start','requested_date_end','followup_date'];const manualFollowups=new Set();let notesReads=0,writes=0,mails=0;
 const items=Array.from({length:count},(_,i)=>({rowNumber:i+2,row:{inquiry_id:'INQ-'+i,status:'new',requested_date_text:'old',requested_date_start:'new',is_archived:i===2?'Yes':'No'}}));
 const sheet={getLastRow:()=>count+1,getLastColumn:()=>headers.length,getRange(row,col,n){return {getValues:()=>[headers],getNotes(){notesReads++;return Array.from({length:n},(_,i)=>[i===0&&col===2?'MBW manual status override':i===1&&col===3?'MBW manual requested date override':col===5&&manualFollowups.has(i)?'MBW manual follow-up override':'']);}};}};
 const ss={getSheetByName:()=>sheet,getUrl:()=> 'https://example.test/sheet'};
 const c={Logger:{log(){}},MailApp:{sendEmail(){mails++;}},SpreadsheetApp:{openById:()=>ss}};vm.createContext(c);vm.runInContext(source,c);
 c.getObjectsWithRowNumbers_=()=>items;c.getObjects_=()=>[];
 c.bestInquiryDateRange_=(row,sh,num,manual)=>{assert.equal(sh,null);assert.equal(manual,row.inquiry_id==='INQ-1');return {start:manual?'new':'old'};};
 c.isManualStatusOverride_=()=>{throw Error('Per-row status read');};c.isManualRequestedDateOverride_=()=>{throw Error('Per-row date read');};
 c.alignInquiryStatusFromSubstatuses_=(row)=>({...row,status:'aligned'});
 c.nextActionForInquiry_=(row,dates)=>({followupDate:dates.start,followupType:row.status,action:'review'});
 c.buildFollowupRow_=(row,action,existing)=>({...existing,inquiry_id:row.inquiry_id,status:'open',followup_type:action.followupType,due_at:action.followupDate});
 c.replaceSheetBodyWithObjects_=()=>{writes++;};
 c.normalizeDateForSheet_=value=>String(value||'');
 return {c,ss,sheet,items,manualFollowups,reads:()=>notesReads,writes:()=>writes,mails:()=>mails};
}
test('450 enquiries use four bulk note reads, preserving manual dates/status and archived exclusion',()=>{const h=harness();const r=h.c.reconcileCrmFollowupQueue_(h.ss,true);assert.equal(h.reads(),4);assert.equal(h.writes(),0);assert.equal(r.rows.length,449);assert.equal(r.rows[0].followup_type,'new');assert.equal(r.rows[1].due_at,'new');assert.equal(r.rows[2].followup_type,'aligned');assert.equal(r.rows.some(x=>x.inquiry_id==='INQ-2'),false);});
test('closed/sent tasks stay closed and queue writes happen only outside preview',()=>{const h=harness(4);h.c.getObjects_=()=>[{inquiry_id:'INQ-0',followup_type:'new',status:'completed',send_status:'sent'}];const r=h.c.reconcileCrmFollowupQueue_(h.ss,true);assert.equal(r.closedTasks,1);assert.equal(r.rows[0].status,'completed');assert.equal(h.writes(),0);h.c.reconcileCrmFollowupQueue_(h.ss);assert.equal(h.writes(),1);});
test('preview renders but never sends or mutates the queue; normal run sends once to existing recipient',()=>{const h=harness(4);h.c.buildDailyFollowupDigest_=()=>({count:3,message:{body:'preview',htmlBody:'<p>preview</p>'}});const r=h.c.previewDailyFollowupDigest();assert.equal(r.dryRun,true);assert.equal(r.dueCount,3);assert.equal(h.writes(),0);assert.equal(h.mails(),0);const sent=h.c.sendDailyFollowupDigest();assert.equal(sent.sent,true);assert.equal(h.writes(),1);assert.equal(h.mails(),1);});
test('digest excludes archived records even if stale tasks remain; deduplicates tasks per enquiry',()=>{const h=harness(1);h.c.getObjects_=()=>[{inquiry_id:'active',status:'new'},{inquiry_id:'archive',is_archived:'Yes'},{inquiry_id:'duplicate',status:'duplicate'},{inquiry_id:'spam',status:'spam'}];h.c.todayIso_=()=> '2026-10-21';h.c.normalizeDateForSheet_=x=>x;h.c.groupDigestFollowups_=rows=>{assert.equal(rows.length,1);return [];};h.c.formatDigestDate_=()=> 'today';h.c.buildFollowupDigestPlainText_=()=> 'text';h.c.buildFollowupDigestHtml_=()=> 'html';const rows=['active','active','archive','duplicate','spam'].map(inquiry_id=>({inquiry_id,status:'open',due_at:'2026-10-21'}));const r=h.c.buildDailyFollowupDigest_(h.ss,rows);assert.equal(r.count,1);assert.equal(r.message.to,'mindobirdwatching@gmail.com');});

test('digest calendar labels stay on the requested date in the Ecuador timezone',()=>{const h=harness(1);h.c.normalizeDateForSheet_=x=>x;h.c.Utilities={formatDate(date,zone,pattern){const options={timeZone:zone,month:'long',day:'numeric',...(pattern.includes('yyyy')?{weekday:'long',year:'numeric'}:{})};return new Intl.DateTimeFormat('en-US',options).format(date);}};assert.equal(h.c.formatDigestDate_('2026-10-21',false),'October 21');assert.equal(h.c.formatDigestDate_('2026-10-21',true),'Wednesday, October 21, 2026');});

test('queue respects staff-postponed dates and cleared manual follow-ups',()=>{
 const h=harness(5);h.manualFollowups.add(0);h.manualFollowups.add(1);
 h.items[0].row.followup_date='2099-12-30';h.items[1].row.followup_date='';
 const before=JSON.stringify(h.items);const result=h.c.reconcileCrmFollowupQueue_(h.ss,true);
 assert.equal(result.rows.find(r=>r.inquiry_id==='INQ-0').due_at,'2099-12-30');
 assert.equal(result.rows.some(r=>r.inquiry_id==='INQ-1'),false);
 assert.equal(result.rows.find(r=>r.inquiry_id==='INQ-3').due_at,'old');
 assert.equal(JSON.stringify(h.items),before);assert.equal(h.writes(),0);assert.equal(h.mails(),0);
});

test('saved active inquiry dates do not need a Sheet note; post-tour review scheduling stays separate',()=>{
 const h=harness(4);h.items[0].row.followup_date='2099-12-30';h.items[1].row.followup_date='2099-12-31';
 h.c.alignInquiryStatusFromSubstatuses_=row=>row;h.items[1].row.status='completed';
 const result=h.c.reconcileCrmFollowupQueue_(h.ss,true);
 assert.equal(result.rows.find(r=>r.inquiry_id==='INQ-0').due_at,'2099-12-30');
 assert.equal(result.rows.find(r=>r.inquiry_id==='INQ-1').due_at,'new');
 assert.equal(h.writes(),0);assert.equal(h.mails(),0);
});

test('spam produces no action even with a saved follow-up date',()=>{
 const h=harness(4);h.c.todayIso_=()=> '2026-10-27';
 const actual={};vm.createContext(actual);vm.runInContext(source,actual);actual.todayIso_=()=> '2026-10-27';actual.normalizeDateForSheet_=x=>x||'';
 const action=actual.nextActionForInquiry_({status:'spam',followup_date:'2026-10-27'},{});
 assert.equal(action.followupDate,'');assert.equal(action.followupType,'');
 h.items[0].row.status='spam';h.items[0].row.followup_date='2026-10-27';h.manualFollowups.add(0);
 const result=h.c.reconcileCrmFollowupQueue_(h.ss,true);assert.equal(result.rows.some(r=>r.inquiry_id==='INQ-0'),false);
});
