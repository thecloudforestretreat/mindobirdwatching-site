import assert from 'node:assert/strict';
import fs from 'node:fs';
const period={start:'2026-09-07',end:'2026-10-04',priorStart:'2026-08-10',priorEnd:'2026-09-06'};
const requests=new Function('$',fs.readFileSync('integrations/portfolio/requests.js','utf8'))(()=>({first:()=>({json:period})}));
assert.equal(requests.length,48);
for(const {json:c} of requests){if(c.source==='gaBatch'){assert.equal(c.body.requests.length,5);assert.deepEqual(c.body.requests[0].dateRanges.map(r=>r.name),['current','previous']);assert.equal(c.body.requests[1].dateRanges[0].startDate,'2026-07-07');assert.equal(c.body.requests[0].dimensionFilter.filter.fieldName,'hostName');}}
const row=(d,m)=>({dimensionValues:d.map(value=>({value})),metricValues:m.map(value=>({value:String(value)}))});
const ga={reports:[{metricHeaders:[{},{}],rows:[row(['current'],[100,40]),row(['previous'],[200,80])]},{metricHeaders:[{}],rows:[row(['20261004'],[5])]},{metricHeaders:[{}],rows:[row(['Organic Search','current'],[50]),row(['Organic Search','previous'],[40]),row(['Direct','previous'],[160])]},{metricHeaders:[{}],rows:[row(['/page'],[80])]},{metricHeaders:[{}],rows:[row(['form_submit_success'],[3])]}]};
const items=requests.map(({json:c})=>({json:c.source==='gaBatch'?ga:c.source==='search'?{rows:[{clicks:10,impressions:1000,position:12}]}:c.source==='queries'?{rows:[{keys:['<img src=x onerror=alert(1)>'],clicks:1,impressions:300,ctr:1/300,position:12}]}:{rows:[]}}));
const dollar=name=>name==='Authorize Administrator'?{first:()=>({json:period})}:{all:()=>requests};
const format=new Function('$','$input',fs.readFileSync('integrations/portfolio/format.js','utf8'));
const p=format(dollar,{all:()=>items})[0].json;assert.equal(p.sites[0].sessions,100);assert.equal(p.sites[0].priorSessions,200);assert.equal(p.sites[0].engagedSessions,40);assert.equal(p.sites[0].trend[0].date,'2026-10-04');assert.equal(p.sites[0].channels[0].priorSessions,40);assert.equal(p.sites[0].opportunities.length,1);
items[0]={json:{error:{code:403}}};assert.equal(format(dollar,{all:()=>items})[0].json.sites[0].sessions,null);
fs.writeFileSync('/private/tmp/portfolio-v2-fixture.json',JSON.stringify({...p,business:{status:'connected',inquiries:12,confirmed:5,completedTours:4,missingCreatedDates:2,missingCompletedDates:1,definitions:{cohort:'Created cohort',completed:'Completed tours'}}}));
console.log('PASS: host filtering, 5-report batch limit, 90-day dates, period comparisons, channel movements, opportunity selection, failure remains unavailable');
