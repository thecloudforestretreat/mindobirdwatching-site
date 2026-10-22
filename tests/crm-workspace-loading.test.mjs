import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../admin/guest-crm/index.html',import.meta.url),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const CRM_API_DEFAULT'));
function harness(api){
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},textContent:'',innerHTML:'',options:[],classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelectorAll:()=>[]});return nodes.get(id)};
 const c={Date,Intl,URL,URLSearchParams,setTimeout,clearTimeout,console,localStorage:{getItem:()=>null},document:{getElementById:node,addEventListener(){},querySelectorAll:()=>[]},window:{}};
 vm.createContext(c);vm.runInContext(script.replace('    })();',`globalThis.qa={state,els,cache,loadGuestWorkspace,loadGlobalOperationsData,renderReports,renderCalendar,saveAssignment,install(fn){api=fn;render=()=>{};renderWorkspaces=()=>{};showToast=()=>{}}};})();`),c);
 const q=c.qa;q.cache();q.install(api);return{q,node};
}
const record=id=>({inquiry_id:id,guest_id:'G-'+id,status:'booked'});
const assignment=id=>({assignment_id:'A-'+id,inquiry_id:id,guest_id:'G-'+id,service_date:'2099-11-26',service_type:'Transportation',assignment_status:'confirmed'});
test('auxiliary failure cannot discard loaded assignments or payments',async()=>{
 const {q}=harness(async(action)=>{if(action==='list_interactions')throw Error('unavailable');return{records:action==='list_assignments'?[assignment('one')]:action==='list_payments'?[{invoice_id:'keep'}]:[]}});
 q.state.records=[record('one')];q.state.selectedId='one';q.state.allAssignments=[assignment('one')];await q.loadGuestWorkspace();
 assert.equal(q.state.assignments[0].assignment_id,'A-one');assert.equal(q.state.payments[0].invoice_id,'keep');assert.match(q.state.workspaceError,/Some guest details/);assert.equal(q.state.workspaceLoading,false);
});
test('assignment failure retains matching global snapshot',async()=>{
 const {q}=harness(async action=>{if(action==='list_assignments')throw Error('offline');return{records:[]}});
 q.state.records=[record('one')];q.state.selectedId='one';q.state.allAssignments=[assignment('one'),assignment('two')];await q.loadGuestWorkspace();
 assert.equal(q.state.assignments.length,1);assert.equal(q.state.assignments[0].assignment_id,'A-one');
});
test('late response for previous guest cannot overwrite current guest or loading state',async()=>{
 const pending=[];const {q}=harness((action,data)=>new Promise(resolve=>pending.push({action,data,resolve})));
 q.state.records=[record('one'),record('two')];q.state.selectedId='one';const first=q.loadGuestWorkspace();q.state.selectedId='two';const second=q.loadGuestWorkspace();
 pending.filter(r=>r.data.guest_id==='G-one').forEach(r=>r.resolve({records:r.action==='list_assignments'?[assignment('one')]:[]}));await first;assert.equal(q.state.workspaceLoading,true);
 pending.filter(r=>r.data.guest_id==='G-two').forEach(r=>r.resolve({records:r.action==='list_assignments'?[assignment('two')]:[]}));await second;assert.equal(q.state.assignments[0].assignment_id,'A-two');assert.equal(q.state.workspaceLoading,false);
});
test('report and calendar do not display incomplete service totals while loading or failed',()=>{
 const {q,node}=harness(async()=>({records:[]}));
 for(const status of ['loading','error']){q.state.operationsStatus=status;q.state.operationsError='Assignments unavailable';q.renderReports();q.renderCalendar();assert.equal(node('reportActivityCount').textContent,'—');assert.equal(node('downloadReportBtn').disabled,true);assert.match(node('reportTableBody').innerHTML,/Loading|unavailable/);assert.match(node('calendarGrid').innerHTML,/Loading|unavailable/)}
});
test('provider directory failure does not discard successful global assignment refresh',async()=>{
 const {q}=harness(async action=>{if(action==='list_providers')throw Error('directory offline');return{records:[assignment('one')]}});await q.loadGlobalOperationsData();assert.equal(q.state.operationsStatus,'ready');assert.equal(q.state.allAssignments.length,1);
});

test('saving an unlinked transport explicitly clears stale birding service ID',async()=>{
 const writes=[];const {q,node}=harness(async(action,data)=>{if(action==='update_assignment')writes.push(JSON.parse(JSON.stringify(data.assignment)));return{records:[]}});
 q.state.records=[record('one')];q.state.selectedId='one';q.els.assignmentEndTime=node('assignmentEndTime');
 node('assignmentId').value='existing';node('assignmentDate').value='2099-11-26';node('assignmentService').value='Transportation';node('assignmentTourItem').value='';node('assignmentTourItem').dataset.product='MBW006';node('assignmentProvider').value='Juan';
 await q.saveAssignment();assert.equal(writes.length,1);assert.equal(writes[0].service_item_id,'');assert.equal(writes[0].product_selected,'Transportation');
});
