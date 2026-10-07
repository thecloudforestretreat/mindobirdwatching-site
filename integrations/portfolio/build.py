import json,uuid,pathlib
root=pathlib.Path(__file__).parent
old=json.load(open('/private/tmp/mbw-recorded-outcomes.json'))
gsc=json.load(open(pathlib.Path.home()/'Downloads'/'MBW - Phase 1 - Search Console Collector.json'))
cred=next(n['credentials'] for n in gsc['nodes'] if n['type'].endswith('httpRequest'))
auth=next(n['parameters']['jsCode'] for n in old['nodes'] if n['name']=='Authorize Administrator')
auth=auth[:auth.index("const q=input.body")]+"const q=input.body||{};const valid=v=>/^\\d{4}-\\d{2}-\\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;if(![q.start,q.end,q.priorStart,q.priorEnd].every(valid)||q.start>q.end||q.priorEnd>=q.start)throw Error('Invalid report');return [{json:{authorized:true,...q}}];}catch{return [{json:{authorized:false,ok:false,error:'Administrator authorization failed.'}}];}"
nodes=[];connections={}
def add(name,typ,params,version=2,**extra):
 n={'id':str(uuid.uuid4()),'name':name,'type':'n8n-nodes-base.'+typ,'typeVersion':version,'position':[len(nodes)*230,0],'parameters':params,**extra};nodes.append(n);return name
def link(a,b,out=0):
 c=connections.setdefault(a,{'main':[]})['main']
 while len(c)<=out:c.append([])
 c[out].append({'node':b,'type':'main','index':0})
def code(name,src):return add(name,'code',{'jsCode':src})
def http(name,url,method='GET',body=None):
 p={'url':url,'authentication':'predefinedCredentialType','nodeCredentialType':'googleOAuth2Api','options':{'timeout':20000,'response':{'response':{'responseFormat':'json','neverError':True}}}}
 if method=='POST':p.update(method=method,sendBody=True,specifyBody='json',jsonBody=body)
 return add(name,'httpRequest',p,4.2,credentials=cred)
add('Portfolio Webhook','webhook',{'httpMethod':'POST','path':'mbw-portfolio-report','responseMode':'responseNode','options':{}},2,webhookId=str(uuid.uuid4()))
code('Authorize Administrator',auth)
branch=next(n for n in old['nodes'] if n['name']=='Administrator Authorized');add('Administrator Authorized','if',branch['parameters'],2.2)
http('Discover GA4 properties','https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200')
code('Property stream requests',"const a=$json.accountSummaries||[];const props=a.flatMap(s=>s.propertySummaries||[]);if(!props.length)return [{json:{property:null,url:'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=1'}}];return props.map(p=>({json:{property:p.property,url:'https://analyticsadmin.googleapis.com/v1beta/'+p.property+'/dataStreams?pageSize=200'}}));")
http('Read public stream identities','={{$json.url}}')
domains=['mindobirdwatching.com','thecloudforestretreat.com','experienceecuador.com','mindotours.com','chocoandinotours.com','experiencetheamazon.com','businessbuyingandselling.com','eyesondanang.com']
code('Build report requests',"const domains="+json.dumps(domains)+";const q=$('Authorize Administrator').first().json;const props={};for(const [i,item] of $input.all().entries()){const property=$('Property stream requests').all()[i]?.json.property;for(const stream of item.json.dataStreams||[]){try{const host=new URL(stream.webStreamData?.defaultUri).hostname.replace(/^www\\./,'');if(domains.includes(host)){if(props[host]&&props[host]!==property)props[host]=false;else if(props[host]!==false)props[host]=property;}}catch{}}}const out=[];for(const domain of domains)for(const prior of [false,true]){const startDate=prior?q.priorStart:q.start,endDate=prior?q.priorEnd:q.end;if(props[domain])out.push({json:{domain,prior,source:'ga',url:'https://analyticsdata.googleapis.com/v1beta/'+props[domain]+':runReport',body:{dateRanges:[{startDate,endDate}],metrics:[{name:'sessions'}],dimensionFilter:{filter:{fieldName:'hostName',inListFilter:{values:[domain,'www.'+domain],caseSensitive:false}}}}}});out.push({json:{domain,prior,source:'search',url:'https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent('sc-domain:'+domain)+'/searchAnalytics/query',body:{startDate,endDate,type:'web',dataState:'final'}}})}return out;")
http('Read portfolio reports','={{$json.url}}','POST','={{$json.body}}')
code('Format portfolio',"const domains="+json.dumps(domains)+";const sites=domains.map(domain=>({domain,sessions:null,priorSessions:null,search:null,priorSearch:null}));for(const [i,item] of $input.all().entries()){const context=$('Build report requests').all()[i].json,p=item.json,s=sites.find(v=>v.domain===context.domain);if(p.error)continue;if(context.source==='ga'){if(!Array.isArray(p.metricHeaders))continue;const v=p.rows?.[0]?.metricValues?.[0]?.value;if(v===undefined&&p.rowCount)continue;s[context.prior?'priorSessions':'sessions']=Number(v||0);}else{const row=p.rows?.[0];if(row&&(!Number.isFinite(row.impressions)||!Number.isFinite(row.clicks)))continue;s[context.prior?'priorSearch':'search']={impressions:row?.impressions||0,clicks:row?.clicks||0};}}const q=$('Authorize Administrator').first().json;return [{json:{ok:true,start:q.start,end:q.end,priorStart:q.priorStart,priorEnd:q.priorEnd,updatedAt:new Date().toISOString(),sites}}];")
resp=next(n for n in old['nodes'] if n['type'].endswith('respondToWebhook'));add('Return Portfolio','respondToWebhook',resp['parameters'],1.4)
reject=next(n for n in old['nodes'] if n['name']=='Reject Unauthorized');add('Reject Unauthorized','respondToWebhook',reject['parameters'],1.4)
seq=['Portfolio Webhook','Authorize Administrator','Administrator Authorized','Discover GA4 properties','Property stream requests','Read public stream identities','Build report requests','Read portfolio reports','Format portfolio','Return Portfolio']
for a,b in zip(seq,seq[1:]):link(a,b)
link('Administrator Authorized','Reject Unauthorized',1)
# Explicit IDs verified against Google Analytics UI and existing admin configuration.
properties={'mindobirdwatching.com':'474681565','thecloudforestretreat.com':'449392042','experienceecuador.com':'516211767','mindotours.com':'555190853','chocoandinotours.com':'555387617','experiencetheamazon.com':'557349745','businessbuyingandselling.com':'525388203','eyesondanang.com':'557171133'}
remove={'Discover GA4 properties','Property stream requests','Read public stream identities'}
nodes=[n for n in nodes if n['name'] not in remove]
connections={k:v for k,v in connections.items() if k not in remove}
connections['Administrator Authorized']['main'][0]=[{'node':'Build report requests','type':'main','index':0}]
for n in nodes:
 if n['name']=='Build report requests':
  tail=n['parameters']['jsCode'].split('const out=[];',1)[1]
  tail=tail.replace("encodeURIComponent('sc-domain:'+domain)","encodeURIComponent(domain==='experienceecuador.com'?'https://experienceecuador.com/':'sc-domain:'+domain)")
  n['parameters']['jsCode']='const domains='+json.dumps(domains)+";const q=$('Authorize Administrator').first().json;const props="+json.dumps({k:'properties/'+v for k,v in properties.items()})+';const out=[];'+tail
for n in nodes:
 if n['name']=='Build report requests':n['parameters']['jsCode']=(root/'requests.js').read_text()
 if n['name']=='Format portfolio':n['parameters']['jsCode']=(root/'format.js').read_text()
flow={'name':'MBW - Portfolio Reporting','nodes':nodes,'connections':connections,'settings':old['settings'],'active':False}
(root/'workflow.json').write_text(json.dumps(flow,indent=2))
print('Generated private portfolio workflow using existing Google credential reference; no secrets included.')
