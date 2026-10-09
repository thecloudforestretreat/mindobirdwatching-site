import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
const sourcePath = `${root}/MBW - AI Carousels - IMPORT.json`;
const outputDir = `${root}/n8n/generated`;
const main = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const loadTemplate = main.nodes.find((node) => node.name === "[CORE] Load ai_carousels");
const writeTemplate = main.nodes.find((node) => node.name === "[GEN] Write Copy to Sheet");
if (!loadTemplate || !writeTemplate) throw new Error("Carousel workflow Sheet templates were not found.");

const uuid = () => crypto.randomUUID();
const gatewayPath = "mbw-admin-carousels-gateway";
const metaPath = `${outputDir}/carousel-gateway-meta.json`;
let previousTriggerPath = "";
try {
  previousTriggerPath = JSON.parse(fs.readFileSync(metaPath, "utf8")).triggerPath || "";
} catch {}
const triggerPath = /^mbw-carousels-process-[a-f0-9-]+$/.test(previousTriggerPath)
  ? previousTriggerPath
  : `mbw-carousels-process-${uuid()}`;
const sheetFields = writeTemplate.parameters.columns.schema
  .filter((field) => field.id !== "row_number")
  .map((field) => field.id);
const schema = writeTemplate.parameters.columns.schema.map((field) => ({ ...field }));

function googleNode(name, operation, position) {
  const value = Object.fromEntries(sheetFields.map((field) => [field, `={{ $json.${field} }}`]));
  return {
    parameters: {
      ...(operation === "read" ? {} : { operation }),
      documentId: structuredClone(loadTemplate.parameters.documentId),
      sheetName: structuredClone(loadTemplate.parameters.sheetName),
      ...(operation === "read" ? { options: {} } : {
        columns: {
          mappingMode: operation === "append" ? "autoMapInputData" : "defineBelow",
          value: operation === "append" ? {} : value,
          matchingColumns: operation === "update" ? ["carousel_id"] : [],
          schema,
          attemptToConvertTypes: false,
          convertFieldsToString: false,
        },
        options: {},
      }),
    },
    id: uuid(), name, type: "n8n-nodes-base.googleSheets", typeVersion: 4.6,
    position, credentials: structuredClone(loadTemplate.credentials),
  };
}

const planCode = String.raw`const body = $('Admin Carousels Webhook').first().json.body || {};
const rows = $input.all().map(item => ({...item.json}));
const action = String(body.action || '').trim();
const clean = value => String(value ?? '').trim();
const truthy = value => value === true || ['true','1','yes','on'].includes(clean(value).toLowerCase());
const words = value => clean(value).split(/\s+/).filter(Boolean).length;
const response = (ok,message,extra={}) => [{json:{_route:'respond',ok,message,...extra}}];
const toSheetDate = value => {
  const text=clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return DateTime.fromISO(text,{zone:'America/New_York'}).toFormat('M/d/yyyy');
  return text;
};
const toSheetTime = value => {
  const text=clean(value);
  if (/^\d{2}:\d{2}$/.test(text)) return DateTime.fromFormat(text,'HH:mm',{zone:'America/New_York'}).toFormat('h:mm a');
  return text;
};
const fields=${JSON.stringify(sheetFields)};
const normalized = source => Object.fromEntries(fields.map(field => [field, source[field] ?? '']));
const find = () => rows.find(row => clean(row.carousel_id) === clean(body.carousel_id));

if (action === 'list_carousels') {
  const query=clean(body.query).toLowerCase();
  let filtered=rows.filter(row => clean(row.carousel_id) && Array.from({length:10},(_,i)=>clean(row['image_'+(i+1)+'_url'])).some(Boolean));
  if (query) filtered=filtered.filter(row => [row.carousel_id,row.featured_birds,row.scientific_name,row.carousel_title,row.carousel_description,row.caption,row.reddit_title,row.status].join(' ').toLowerCase().includes(query));
  const limit=Math.min(250,Math.max(1,Number(body.limit)||150));
  filtered.sort((a,b)=>Number(b.row_number||0)-Number(a.row_number||0));
  return response(true,'',{carousels:filtered.slice(0,limit),count:Math.min(filtered.length,limit)});
}

if (action === 'create_carousel') {
  const c=body.carousel && typeof body.carousel === 'object' ? body.carousel : {};
  const images=Array.isArray(c.images)?c.images:[];
  if (images.length<2 || images.length>10) return response(false,'A carousel requires 2–10 images.');
  const urls=images.map(image=>clean(image.delivery_url||image.original_url));
  if (urls.some(url=>!url) || new Set(urls).size!==urls.length) return response(false,'Every carousel image must have one unique delivery URL.');
  const duplicate=rows.some(row=>urls.some(url=>Array.from({length:10},(_,i)=>clean(row['image_'+(i+1)+'_url'])).includes(url)));
  if (duplicate) return response(false,'One or more images already exist in ai_carousels.');
  const auto=clean(body.mode).toLowerCase()==='auto';
  const row=normalized({
    carousel_id:clean(c.carousel_id)||('CAR-'+crypto.randomUUID()),
    images_json:JSON.stringify(images), carousel_description:clean(c.carousel_description),
    featured_birds:clean(c.featured_birds), scientific_name:clean(c.scientific_name),
    location:clean(c.location)||'Mindo, Ecuador', input_status:auto?'VERIFIED':'READY',
    scheduled_date:toSheetDate(c.scheduled_date), scheduled_time:toSheetTime(c.scheduled_time),
    status:'Testing', media_type:'CAROUSEL', post_to_instagram:truthy(c.post_to_instagram),
    post_to_facebook:truthy(c.post_to_facebook), copy_review_status:'PENDING_LOCAL_REVIEW',
    caption_generation_status:'NOT_STARTED', approval_status:'NEEDS_REVIEW', quality_score:0,
    submitted_at:clean(c.submitted_at)||new Date().toISOString(), source:clean(c.source)||'admin_carousel_studio',
    timezone:clean(body.timezone)||'America/New_York', admin_mode:auto?'auto':'review', error_message:'',
  });
  urls.forEach((url,index)=>{row['image_'+(index+1)+'_url']=url;});
  return [{json:{...row,_route:'append_trigger'}}];
}

const existing=find();
if (!existing) return response(false,'The requested carousel was not found.');
const row=normalized(existing);

if (action === 'update_carousel') {
  const allowed=new Set(['carousel_title','caption','instagram_hashtags','facebook_caption','facebook_hashtags','reddit_title','reddit_caption','reddit_hashtags','scheduled_date','scheduled_time','post_to_instagram','post_to_facebook']);
  for (const [key,value] of Object.entries(body.edits||{})) if (allowed.has(key)) row[key]=key==='scheduled_date'?toSheetDate(value):key==='scheduled_time'?toSheetTime(value):key==='post_to_instagram'||key==='post_to_facebook'?truthy(value):clean(value);
  return [{json:{...row,_route:'update_only'}}];
}

if (action === 'approve_carousel') {
  const errors=[];
  const count=Array.from({length:10},(_,i)=>clean(row['image_'+(i+1)+'_url'])).filter(Boolean).length;
  if (count<2 || count>10) errors.push('Carousel must have 2–10 images.');
  const captionWords=words(row.caption);
  if (captionWords<50 || captionWords>120) errors.push('Caption must contain 50–120 words.');
  const tags=clean(row.instagram_hashtags).split(/\s+/).filter(Boolean);
  if (tags.length!==5 || tags.some(tag=>!/^#[A-Za-z0-9_]+$/.test(tag))) errors.push('Instagram requires exactly five valid hashtags.');
  if (!clean(row.carousel_title)) errors.push('Carousel title is required.');
  const facebookWords=words(row.facebook_caption), facebookTags=clean(row.facebook_hashtags).split(/\s+/).filter(Boolean);
  if (facebookWords<50 || facebookWords>140 || facebookTags.length!==3 || facebookTags.some(tag=>!/^#[A-Za-z0-9_]+$/.test(tag))) errors.push('Facebook requires a 50–140 word caption and exactly three valid hashtags.');
  const redditWords=words(row.reddit_caption), redditTags=clean(row.reddit_hashtags).split(/\s+/).filter(Boolean);
  if (!clean(row.reddit_title) || clean(row.reddit_title).length>120 || redditWords<35 || redditWords>120 || redditTags.length!==3 || redditTags.some(tag=>!/^#[A-Za-z0-9_]+$/.test(tag))) errors.push('Reddit requires a title, a 35–120 word body, and exactly three valid hashtags.');
  if (!truthy(row.post_to_instagram) && !truthy(row.post_to_facebook)) errors.push('Select Instagram or Facebook.');
  if (clean(row.copy_review_status).toUpperCase()!=='PASS') errors.push('Both local copy passes must complete successfully.');
  if (errors.length) return response(false,errors.join(' '));
  Object.assign(row,{status:'Scheduled',input_status:'VERIFIED',approval_status:'APPROVED',quality_score:100,error_message:''});
  return [{json:{...row,_route:'update_only'}}];
}

if (action === 'regenerate_carousel') {
  if ([row.instagram_post_id,row.facebook_post_id].some(value=>clean(value))) return response(false,'Published or partially published carousels cannot be regenerated.');
  for (const field of ['local_brief','copy_review_status','caption_generation_status','carousel_title','caption','instagram_hashtags','facebook_caption','facebook_hashtags','reddit_title','reddit_caption','reddit_hashtags','copy_generated_at','ai_model','posting_defaults_applied_at']) row[field]='';
  Object.assign(row,{status:'Testing',input_status:clean(row.admin_mode).toLowerCase()==='auto'?'VERIFIED':'READY',approval_status:'NEEDS_REVIEW',quality_score:0,error_message:'',publishing_lock:''});
  return [{json:{...row,_route:'update_trigger'}}];
}

if (action === 'retry_carousel') {
  if (clean(row.approval_status).toUpperCase()!=='APPROVED' || Number(row.quality_score||0)<85) return response(false,'Copy must be approved before retrying publication.');
  const ig=truthy(row.post_to_instagram)&&!clean(row.instagram_post_id);
  const fb=truthy(row.post_to_facebook)&&!clean(row.facebook_post_id);
  if (!ig&&!fb) return response(false,'No missing selected platform is available to retry.');
  Object.assign(row,{status:'Scheduled',post_to_instagram:ig,post_to_facebook:fb,error_message:'',publishing_lock:'',instagram_container_id:ig?'':row.instagram_container_id,facebook_photo_ids:fb?'':row.facebook_photo_ids});
  return [{json:{...row,_route:'update_trigger'}}];
}
return response(false,'Unsupported gateway action.');`;

const responseCode = String.raw`const body=$('Admin Carousels Webhook').first().json.body||{};
const planned=$('Plan Carousel Action').all().map(item=>item.json);
const cleanRow=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!key.startsWith('_')));
return [{json:{ok:true,action:body.action,carousel:planned[0]?cleanRow(planned[0]):null}}];`;

const routeValues=["respond","append_trigger","update_only","update_trigger"].map((route)=>({
  conditions:{options:{caseSensitive:true,leftValue:"",typeValidation:"strict"},conditions:[{leftValue:"={{ $json._route }}",rightValue:route,operator:{type:"string",operation:"equals"}}],combinator:"and"},
  renameOutput:true,outputKey:route,
}));

const webhook={parameters:{httpMethod:"POST",path:gatewayPath,responseMode:"responseNode",options:{}},id:uuid(),name:"Admin Carousels Webhook",type:"n8n-nodes-base.webhook",typeVersion:2,position:[0,0],webhookId:gatewayPath};
const load=googleNode("Load AI Carousels","read",[240,0]);
const plan={parameters:{jsCode:planCode},id:uuid(),name:"Plan Carousel Action",type:"n8n-nodes-base.code",typeVersion:2,position:[480,0]};
const route={parameters:{rules:{values:routeValues},options:{fallbackOutput:"extra"}},id:uuid(),name:"Route Carousel Action",type:"n8n-nodes-base.switch",typeVersion:3.3,position:[720,0]};
const append=googleNode("Append Carousel","append",[960,120]);
const updateOnly=googleNode("Update Carousel Only","update",[960,300]);
const updateTrigger=googleNode("Update Carousel and Trigger","update",[960,460]);
const triggerMain={parameters:{method:"POST",url:`https://n8n.mindobirdwatching.com/webhook/${triggerPath}`,sendHeaders:true,headerParameters:{parameters:[{name:"Content-Type",value:"application/json"}]},sendBody:true,specifyBody:"json",jsonBody:"={{ { source: 'admin_carousels_gateway', action: $('Admin Carousels Webhook').first().json.body.action } }}",options:{timeout:10000}},id:uuid(),name:"Trigger Carousel Processing",type:"n8n-nodes-base.httpRequest",typeVersion:4.2,position:[1220,220]};
const success={parameters:{jsCode:responseCode},id:uuid(),name:"Build Carousel Success",type:"n8n-nodes-base.code",typeVersion:2,position:[1460,220]};
const direct={parameters:{respondWith:"json",responseBody:"={{ $json }}",options:{}},id:uuid(),name:"Respond Carousel Direct",type:"n8n-nodes-base.respondToWebhook",typeVersion:1.1,position:[960,-80]};
const respond={parameters:{respondWith:"json",responseBody:"={{ $json }}",options:{}},id:uuid(),name:"Respond Carousel Success",type:"n8n-nodes-base.respondToWebhook",typeVersion:1.1,position:[1700,220]};

const gateway={name:"MBW - Carousel Admin Gateway",nodes:[webhook,load,plan,route,append,updateOnly,updateTrigger,triggerMain,success,direct,respond],pinData:{},connections:{
  [webhook.name]:{main:[[{node:load.name,type:"main",index:0}]]},
  [load.name]:{main:[[{node:plan.name,type:"main",index:0}]]},
  [plan.name]:{main:[[{node:route.name,type:"main",index:0}]]},
  [route.name]:{main:[[{node:direct.name,type:"main",index:0}],[{node:append.name,type:"main",index:0}],[{node:updateOnly.name,type:"main",index:0}],[{node:updateTrigger.name,type:"main",index:0}]]},
  [append.name]:{main:[[{node:triggerMain.name,type:"main",index:0}]]},
  [updateOnly.name]:{main:[[{node:success.name,type:"main",index:0}]]},
  [updateTrigger.name]:{main:[[{node:triggerMain.name,type:"main",index:0}]]},
  [triggerMain.name]:{main:[[{node:success.name,type:"main",index:0}]]},
  [success.name]:{main:[[{node:respond.name,type:"main",index:0}]]},
},active:false,settings:{executionOrder:"v1",timezone:"America/New_York"},versionId:uuid(),meta:{templateCredsSetupCompleted:true},tags:[]};

const mainTrigger={parameters:{httpMethod:"POST",path:triggerPath,responseMode:"onReceived",options:{}},id:uuid(),name:"[ADMIN] Trigger Carousel Processing",type:"n8n-nodes-base.webhook",typeVersion:2,position:[loadTemplate.position[0]-260,loadTemplate.position[1]+180],webhookId:triggerPath};
main.nodes.push(mainTrigger);
main.connections[mainTrigger.name]={main:[[{node:loadTemplate.name,type:"main",index:0}]]};

fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(`${outputDir}/MBW - Carousel Admin Gateway - IMPORT.json`,JSON.stringify(gateway,null,2)+"\n");
fs.writeFileSync(`${outputDir}/MBW - AI Carousels - Admin Trigger - IMPORT.json`,JSON.stringify(main,null,2)+"\n");
fs.writeFileSync(`${outputDir}/carousel-gateway-meta.json`,JSON.stringify({gatewayPath,triggerPath,gatewayWebhookUrl:`https://n8n.mindobirdwatching.com/webhook/${gatewayPath}`},null,2)+"\n");
console.log(JSON.stringify({gatewayNodes:gateway.nodes.length,mainNodes:main.nodes.length,gatewayPath,triggerPath},null,2));
