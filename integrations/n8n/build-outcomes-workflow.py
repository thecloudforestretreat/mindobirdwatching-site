import json,uuid,re,sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=json.load(open(sys.argv[1]))
sheet=next(n for n in source['nodes'] if n['name']=='Get row(s) in sheet')
def node(name,kind,parameters,x):
 return {'id':str(uuid.uuid4()),'name':name,'type':'n8n-nodes-base.'+kind,'typeVersion':{'code':2,'webhook':2,'googleSheets':4.7,'respondToWebhook':1.1,'if':2.2}[kind],'parameters':parameters,'position':[x,300]}
nodes=[node('Recorded Outcomes Webhook','webhook',{'httpMethod':'POST','path':'mbw-recorded-outcomes','responseMode':'responseNode','options':{}},0),node('Authorize Administrator','code',{'jsCode':(root/'integrations/n8n/authorize-outcomes.js').read_text()},240),node('Administrator Authorized','if',{'conditions':{'options':{'caseSensitive':True,'leftValue':'','typeValidation':'strict','version':2},'conditions':[{'id':'authorized','leftValue':'={{$json.authorized}}','rightValue':True,'operator':{'type':'boolean','operation':'true','singleValue':True}}],'combinator':'and'},'options':{}},360)]
for name,doc,gid,x in [('Read CRM Bookings','1rdPmYmhCehx_3bI737dkg8NyiutwIu3NAav7B-mbwlw',613590723,480),('Read Accounting Invoices','1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU',73485413,960)]:
 n=node(name,'googleSheets',{'documentId':{'__rl':True,'value':doc,'mode':'id'},'sheetName':{'__rl':True,'value':gid,'mode':'id'},'options':{'outputFormatting':{'values':{'general':'UNFORMATTED_VALUE','date':'FORMATTED_STRING'}}}},x);n['credentials']=sheet['credentials'];n['alwaysOutputData']=True;n['retryOnFail']=True;n['maxTries']=3
 nodes.append(n)
 if name=='Read CRM Bookings':nodes.append(node('Collect CRM Bookings','code',{'jsCode':'return [{json:{records:$input.all().map(i=>i.json).filter(r=>r.inquiry_id||r.booking_id||r.status||r.email||r.email_normalized)}}];'},720))
parts=[]
for f in ['maps','demand','reconcile']:
 s=(root/('functions/lib/'+f+'.mjs')).read_text();s=re.sub(r'^import .*?;\n','',s,flags=re.M);s=s.replace('export ','')
 parts.append(s)
code='\n'.join(parts)+"\nconst options=$('Authorize Administrator').first().json;\nconst crm=$('Collect CRM Bookings').first().json.records;\nconst invoices=$input.all().map(i=>i.json).filter(r=>r.invoice_no);\nconst reconciled=reconcileBookings(crm,invoices,options);\nconst result=options.source==='website'?{demand:reconciledDemand(crm,reconciled,aggregateDemand,options)}:aggregateGuests(reconciled.records,options);\nreturn [{json:{ok:true,source:options.source,start:options.start,end:options.end,stage:options.stage,today:options.today,updated_at:new Date().toISOString(),reconciliation:reconciled.stats,...result}}];"
# Preserve each module's helper scope when bundling for the n8n Code node.
s=(root/'functions/lib/reconcile.mjs').read_text();s=re.sub(r'^import .*?;\n','',s,flags=re.M).replace('export ','')
parts[-1]='const {reconcileBookings,reconciledDemand}=(()=>{\n'+s+'\nreturn {reconcileBookings,reconciledDemand};})();'
code='\n'.join(parts)+code[code.index('\nconst options='):]
(root/'integrations/n8n/aggregate-outcomes.js').write_text(code)
nodes.extend([node('Aggregate Reconciled Outcomes','code',{'jsCode':code},1200),node('Return Aggregate Outcomes','respondToWebhook',{'respondWith':'json','responseBody':'={{$json}}','options':{'responseHeaders':{'entries':[{'name':'Cache-Control','value':'private, no-store'}]}}},1440)])
connections={a['name']:{'main':[[{'node':b['name'],'type':'main','index':0}]]} for a,b in zip(nodes,nodes[1:])}
reject=node('Reject Unauthorized','respondToWebhook',{'respondWith':'json','responseBody':'={{$json}}','options':{'responseCode':401,'responseHeaders':{'entries':[{'name':'Cache-Control','value':'private, no-store'}]}}},480);reject['position']=[480,600];nodes.append(reject)
connections['Administrator Authorized']['main'].append([{'node':'Reject Unauthorized','type':'main','index':0}])
w={'name':'MBW - Reconciled Recorded Outcomes','nodes':nodes,'connections':connections,'settings':{'executionOrder':'v1','saveDataErrorExecution':'none','saveDataSuccessExecution':'none','saveManualExecutions':False,'saveExecutionProgress':False,'timezone':'America/Guayaquil'},'active':False}
Path('/private/tmp/mbw-recorded-outcomes.json').write_text(json.dumps(w,indent=2))
