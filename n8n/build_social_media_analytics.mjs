import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const output = process.env.MBW_ANALYTICS_OUTPUT || path.join("/tmp", "MBW_Social_Media_Analytics_v1.json");

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1TCwGEscdKFVBH1C-2tnozoFrNS-rQiTgHA4M7iPX3-8/edit?usp=sharing";
const GOOGLE_SHEETS = { id: "sJdVMmql2IyZ94ti", name: "Google Sheets - MBW" };
const INSTAGRAM_GRAPH = { id: "herDuII5ILdZK9vI", name: "Facebook Graph - MBW3" };
const FACEBOOK_GRAPH = { id: "hKtqKmiLtyPbhYMw", name: "Facebook Graph - MBW" };
const YOUTUBE = { id: "ynlMnjwMW7XwMATF", name: "YouTube - MBW" };

const id = (() => {
  let n = 0;
  return () => `mbw-social-analytics-${String(++n).padStart(2, "0")}`;
})();

const nodes = [];
function add(name, type, typeVersion, position, parameters = {}, extra = {}) {
  nodes.push({ parameters, id: id(), name, type, typeVersion, position, ...extra });
}

add("[API] Media Insights", "n8n-nodes-base.webhook", 2, [-1100, -120], {
  httpMethod: "POST",
  path: "mbw-media-insights-v3",
  responseMode: "responseNode",
  options: {},
}, { webhookId: "mbw-media-insights-v3" });
add("[TEST] Manual Trigger", "n8n-nodes-base.manualTrigger", 1, [-1100, 40], {});
add("[SYNC] Hourly Trigger", "n8n-nodes-base.scheduleTrigger", 1.2, [-1100, 200], {
  rule: { interval: [{ field: "hours", triggerAtMinute: 17 }] },
});

add("[CORE] Reporting Context", "n8n-nodes-base.code", 2, [-860, 40], {
  jsCode: String.raw`const body = $json.body || {};
const query = $json.query || {};
const raw = String(body.period || query.period || '90d').toLowerCase();
const allowed = new Set(['7d','28d','90d']);
const period = allowed.has(raw) ? raw : '90d';
const days = Number(period.replace('d',''));
const now = new Date();
const end = new Date(now);
end.setUTCDate(end.getUTCDate() - 1);
const start = new Date(end);
start.setUTCDate(start.getUTCDate() - days + 1);
const iso = d => d.toISOString().slice(0,10);
return [{json:{period,days,start_date:iso(start),end_date:iso(end),requested_at:now.toISOString(),timezone:'America/New_York'}}];`,
});

const sheetBase = {
  documentId: { __rl: true, value: SHEET_URL, mode: "url" },
  options: {},
};
add("[DATA] Load Reels", "n8n-nodes-base.googleSheets", 4.5, [-620, -40], {
  ...sheetBase,
  sheetName: { __rl: true, value: 1281322677, mode: "list", cachedResultName: "ai_reels", cachedResultUrl: SHEET_URL.replace('/edit?usp=sharing','/edit#gid=1281322677') },
}, { credentials: { googleSheetsOAuth2Api: GOOGLE_SHEETS }, retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 });
add("[DATA] Load Carousels", "n8n-nodes-base.googleSheets", 4.5, [-620, 120], {
  ...sheetBase,
  sheetName: { __rl: true, value: "ai_carousels", mode: "name" },
}, { credentials: { googleSheetsOAuth2Api: GOOGLE_SHEETS }, retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 });
add("[DATA] Combine Published Records", "n8n-nodes-base.merge", 3.2, [-380, 40], {});

add("[CORE] Prepare Batch Queries", "n8n-nodes-base.code", 2, [-140, 40], {
  jsCode: String.raw`const ctx = $('\u005bCORE\u005d Reporting Context').first().json;
const clean = v => String(v ?? '').trim();
const truthy = v => ['true','1','yes','y'].includes(clean(v).toLowerCase()) || v === true || v === 1;
const dateOnly = v => {
  const s = clean(v);
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
};
const rows = $input.all().map(i => i.json);
const records = rows.map((row,index) => {
  const type = clean(row.carousel_id) ? 'carousel' : 'reel';
  const id = clean(row.carousel_id || row.reel_id || row.post_id || row.row_number || index + 1);
  const title = clean(row.carousel_title || row.title || row.bird_name || row.activity_name || row.youtube_title || row.reel_description || row.caption || (type === 'carousel' ? 'Carousel' : 'Reel'));
  const published = dateOnly(row.instagram_published_date || row.facebook_published_date || row.youtube_published_date || row.published_date || row.scheduled_date);
  return {
    type,id,title,
    published_date: published,
    scheduled_date: dateOnly(row.scheduled_date) || published,
    scheduled_time: clean(row.scheduled_time || '07:00 AM'),
    instagram_post_id: clean(row.instagram_post_id),
    facebook_post_id: clean(row.facebook_post_id),
    youtube_post_id: clean(row.youtube_post_id),
    instagram_permalink: clean(row.instagram_permalink),
    facebook_permalink: clean(row.facebook_permalink),
    youtube_url: clean(row.youtube_url),
    thumbnail: clean(row.cover_image_url || row.thumbnail_url || row.instagram_thumbnail_url),
    is_published: clean(row.status).toLowerCase() === 'published' || Boolean(clean(row.instagram_post_id || row.facebook_post_id || row.youtube_post_id)),
  };
}).filter(r => r.is_published && r.published_date && r.published_date >= ctx.start_date && r.published_date <= ctx.end_date);
const unique = values => [...new Set(values.filter(Boolean))];
const ig = unique(records.map(r => r.instagram_post_id));
const fb = unique(records.map(r => r.facebook_post_id));
const yt = unique(records.map(r => r.youtube_post_id));
const enc = encodeURIComponent;
return [{json:{...ctx,records,
  ig_url: ig.length ? 'https://graph.facebook.com/v23.0/?ids='+enc(ig.join(','))+'&fields='+enc('id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count,insights.metric(reach,saved,shares,total_interactions,views)') : 'https://graph.facebook.com/v23.0/me?fields=id',
  fb_url: 'https://graph.facebook.com/v23.0/753092067877601/posts?since='+ctx.start_date+'&until='+ctx.end_date+'&limit=100&fields='+enc('id,created_time,permalink_url,message,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true)'),
  yt_url: 'https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id='+enc(yt.join(',')),
  yt_daily_url: 'https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate='+ctx.start_date+'&endDate='+ctx.end_date+'&metrics=views%2CestimatedMinutesWatched%2CaverageViewDuration%2Clikes%2Ccomments%2Cshares%2CsubscribersGained&dimensions=day&sort=day'
}}];`,
});

const httpDefaults = { options: { timeout: 25000 } };
add("[META] Instagram Batch Insights", "n8n-nodes-base.httpRequest", 4.2, [120, -180], {
  url: "={{ $json.ig_url }}", authentication: "predefinedCredentialType", nodeCredentialType: "facebookGraphApi", ...httpDefaults,
}, { credentials: { facebookGraphApi: INSTAGRAM_GRAPH }, onError: "continueRegularOutput", alwaysOutputData: true });
add("[META] Load Page Access", "n8n-nodes-base.httpRequest", 4.2, [120, -70], {
  url: "https://graph.facebook.com/v23.0/me/accounts?fields=id,access_token&limit=100", authentication: "predefinedCredentialType", nodeCredentialType: "facebookGraphApi", ...httpDefaults,
}, { credentials: { facebookGraphApi: INSTAGRAM_GRAPH }, onError: "continueRegularOutput", alwaysOutputData: true });
add("[META] Facebook Batch Insights", "n8n-nodes-base.httpRequest", 4.2, [340, -70], {
  url: "={{ $('[CORE] Prepare Batch Queries').first().json.fb_url }}",
  sendQuery: true,
  queryParameters: { parameters: [{ name: "access_token", value: "={{ (($json.data || []).find(account => String(account.id) === '753092067877601') || {}).access_token || '' }}" }] },
  ...httpDefaults,
}, { onError: "continueRegularOutput", alwaysOutputData: true });
add("[YT] Video Statistics", "n8n-nodes-base.httpRequest", 4.2, [120, 100], {
  url: "={{ $json.yt_url }}", authentication: "predefinedCredentialType", nodeCredentialType: "youTubeOAuth2Api", ...httpDefaults,
}, { credentials: { youTubeOAuth2Api: YOUTUBE }, onError: "continueRegularOutput", alwaysOutputData: true });
add("[YT] Daily Analytics", "n8n-nodes-base.httpRequest", 4.2, [120, 240], {
  url: "={{ $json.yt_daily_url }}", authentication: "predefinedCredentialType", nodeCredentialType: "youTubeOAuth2Api", ...httpDefaults,
}, { credentials: { youTubeOAuth2Api: YOUTUBE }, onError: "continueRegularOutput", alwaysOutputData: true });

add("[JOIN] Meta", "n8n-nodes-base.merge", 3.2, [380, -100], {});
add("[JOIN] Add YouTube Videos", "n8n-nodes-base.merge", 3.2, [580, 0], {});
add("[JOIN] Add YouTube Daily", "n8n-nodes-base.merge", 3.2, [780, 100], {});

add("[REPORT] Build Dashboard Payload", "n8n-nodes-base.code", 2, [1000, 100], {
  jsCode: String.raw`const base = $('\u005bCORE\u005d Prepare Batch Queries').first().json;
const get = name => { try { return $(name).first().json || {}; } catch { return {}; } };
const igRaw = get('\u005bMETA\u005d Instagram Batch Insights');
const fbRaw = get('\u005bMETA\u005d Facebook Batch Insights');
const ytRaw = get('\u005bYT\u005d Video Statistics');
const ydRaw = get('\u005bYT\u005d Daily Analytics');
const num = v => Number(v) || 0;
const insightMap = node => Object.fromEntries(((node && node.data) || []).map(metric => {
  const raw = metric.total_value && metric.total_value.value !== undefined ? metric.total_value.value : metric.values && metric.values[0] ? metric.values[0].value : 0;
  return [metric.name, typeof raw === 'object' ? Object.values(raw).reduce((a,b)=>a+num(b),0) : num(raw)];
}));
const igById = {};
for (const [key,value] of Object.entries(igRaw || {})) {
  if (!value || typeof value !== 'object' || key === 'error') continue;
  const m = insightMap(value.insights);
  igById[key] = {reach:num(m.reach),views:num(m.views),saves:num(m.saved),shares:num(m.shares),interactions:num(m.total_interactions),likes:num(value.like_count),comments:num(value.comments_count),permalink:value.permalink||''};
}
const fbById = {};
for (const value of (fbRaw.data || [])) {
  if (!value || typeof value !== 'object' || !value.id) continue;
  const m = insightMap(value.insights);
  const parsed = {id:String(value.id),reach:num(m.post_impressions_unique),engaged_users:num(m.post_engaged_users),clicks:num(m.post_clicks),shares:num(value.shares && value.shares.count),reactions:num(value.reactions && value.reactions.summary && value.reactions.summary.total_count),comments:num(value.comments && value.comments.summary && value.comments.summary.total_count),permalink:value.permalink_url||''};
  fbById[String(value.id)] = parsed;
  fbById[String(value.id).split('_').pop()] = parsed;
}
const ytById = {};
for (const value of (ytRaw.items || [])) {
  const s = value.statistics || {};
  ytById[value.id] = {views:num(s.viewCount),likes:num(s.likeCount),comments:num(s.commentCount),title:(value.snippet||{}).title||'',published_at:(value.snippet||{}).publishedAt||''};
}
const igTotals = Object.values(igById).reduce((a,v)=>({reach:a.reach+v.reach,views:a.views+v.views,saves:a.saves+v.saves,shares:a.shares+v.shares,likes:a.likes+v.likes,comments:a.comments+v.comments,interactions:a.interactions+v.interactions}),{reach:0,views:0,saves:0,shares:0,likes:0,comments:0,interactions:0});
const fbUnique = Object.values(fbById).filter((value,index,array)=>array.findIndex(other=>other.id===value.id)===index);
const fbTotals = fbUnique.reduce((a,v)=>({reach:a.reach+v.reach,engaged_users:a.engaged_users+v.engaged_users,clicks:a.clicks+v.clicks,shares:a.shares+v.shares,reactions:a.reactions+v.reactions,comments:a.comments+v.comments}),{reach:0,engaged_users:0,clicks:0,shares:0,reactions:0,comments:0});
const ytTotals = Object.values(ytById).reduce((a,v)=>({views:a.views+v.views,likes:a.likes+v.likes,comments:a.comments+v.comments}),{views:0,likes:0,comments:0});
const headers = (ydRaw.columnHeaders || []).map(h=>h.name);
const series = (ydRaw.rows || []).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]]))).map(row=>({date:row.day,value:num(row.views),views:num(row.views),watch_time_minutes:num(row.estimatedMinutesWatched)}));
const dailyTotals = series.reduce((a,v)=>({views:a.views+v.views,watch_time_minutes:a.watch_time_minutes+v.watch_time_minutes}),{views:0,watch_time_minutes:0});
const top = [];
const samples = [];
const content = {reel:{posts:0,reach:0,engagements:0,views:0},carousel:{posts:0,reach:0,engagements:0,views:0}};
const dayName = d => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(d+'T12:00:00Z').getUTCDay()];
const timeHour = value => {
  const s=String(value||'').trim(); let m=s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i); if(!m)return 7;
  let h=Number(m[1]); const ap=(m[3]||'').toUpperCase(); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0; return h;
};
const displayTime = h => String(h%12||12)+':00 '+(h>=12?'PM':'AM');
for (const r of base.records) {
  const type=content[r.type]?r.type:'reel'; content[type].posts++;
  if (r.instagram_post_id && igById[r.instagram_post_id]) {
    const v=igById[r.instagram_post_id], engagement=v.likes+v.comments+v.shares+v.saves;
    content[type].reach+=v.reach; content[type].engagements+=engagement; content[type].views+=v.views;
    top.push({title:r.title,platform:'Instagram',published_date:r.published_date,value:v.reach||v.views,metric:v.reach?'Reach':'Views',thumbnail:r.thumbnail,href:v.permalink||r.instagram_permalink,type:r.type});
    samples.push({platform:'Instagram + Facebook',day:dayName(r.scheduled_date),hour:timeHour(r.scheduled_time),value:v.reach||v.views||engagement});
  }
  if (r.facebook_post_id && fbById[r.facebook_post_id]) {
    const v=fbById[r.facebook_post_id], engagement=v.reactions+v.comments+v.shares;
    content[type].reach+=v.reach; content[type].engagements+=engagement;
    top.push({title:r.title,platform:'Facebook',published_date:r.published_date,value:v.reach||v.engaged_users,metric:v.reach?'Reach':'Engaged users',thumbnail:r.thumbnail,href:v.permalink||r.facebook_permalink,type:r.type});
    samples.push({platform:'Instagram + Facebook',day:dayName(r.scheduled_date),hour:timeHour(r.scheduled_time),value:v.reach||v.engaged_users||engagement});
  }
  if (r.youtube_post_id && ytById[r.youtube_post_id]) {
    const v=ytById[r.youtube_post_id], engagement=v.likes+v.comments;
    content[type].views+=v.views; content[type].engagements+=engagement;
    top.push({title:r.title||v.title,platform:'YouTube',published_date:r.published_date,value:v.views,metric:'Views',thumbnail:r.thumbnail,href:r.youtube_url||('https://youtu.be/'+r.youtube_post_id),type:r.type});
    samples.push({platform:'YouTube',day:dayName(r.scheduled_date),hour:timeHour(r.scheduled_time),value:v.views});
  }
}
top.sort((a,b)=>b.value-a.value);
const groups = new Map();
for (const s of samples) { const k=[s.platform,s.day,s.hour].join('|'); const g=groups.get(k)||{...s,count:0,total:0}; g.count++; g.total+=s.value; groups.set(k,g); }
const eligible=[...groups.values()].filter(g=>g.count>=3).map(g=>({...g,avg:g.total/g.count}));
const maxAvg=Math.max(1,...eligible.map(g=>g.avg));
const slots=eligible.sort((a,b)=>b.avg-a.avg||b.count-a.count).slice(0,3).map(g=>({days:[g.day],time:displayTime(g.hour),platform:g.platform,score:Math.min(95,Math.round(55+30*(g.avg/maxAvg)+Math.min(10,g.count))),basis:String(g.count)+' matched posts'}));
const response={
  ok:true,configured:true,period:base.period,updated_at:new Date().toISOString(),
  summary:{published_posts:base.records.length,total_reach:igTotals.reach+fbTotals.reach,total_engagements:igTotals.likes+igTotals.comments+igTotals.shares+igTotals.saves+fbTotals.reactions+fbTotals.comments+fbTotals.shares+ytTotals.likes+ytTotals.comments,youtube_views_period:dailyTotals.views},
  series,top_posts:top.slice(0,12),content_types:content,
  sources:[
    {platform:'instagram',status:Object.keys(igById).length?'connected':'no matched data',mode:'current lifetime post insights'},
    {platform:'facebook',status:fbUnique.length?'connected':'no matched data',mode:'current organic reactions, comments, and shares'},
    {platform:'youtube',status:(ytRaw.items||[]).length?'connected':'no matched data',mode:'daily finalized through '+base.end_date}
  ],
  recommendations:{configured:slots.length>0,timezone:'America/New_York',sample_size:samples.length,source:'Matched MBW organic post performance; minimum 3 posts per time slot',slots},
  platforms:{
    instagram:{connected:!igRaw.error,metrics:{reach:igTotals.reach,views:igTotals.views,likes:igTotals.likes,comments:igTotals.comments,saves:igTotals.saves,shares:igTotals.shares}},
    facebook:{connected:!fbRaw.error&&Array.isArray(fbRaw.data),metrics:{reactions:fbTotals.reactions,comments:fbTotals.comments,shares:fbTotals.shares,matched_posts:fbUnique.length}},
    youtube:{connected:!ytRaw.error&&!ydRaw.error,metrics:{views:dailyTotals.views||ytTotals.views,watch_time_minutes:dailyTotals.watch_time_minutes,likes:ytTotals.likes,comments:ytTotals.comments}}
  }
};
const state=$getWorkflowStaticData('global'); state.last_success=response.updated_at; state.last_period=base.period; state.last_summary=response.summary;
return [{json:response}];`,
});

add("[API] Respond", "n8n-nodes-base.respondToWebhook", 1.1, [1240, 100], {
  respondWith: "json",
  responseBody: "={{ $json }}",
  options: { responseHeaders: { entries: [
    { name: "Access-Control-Allow-Origin", value: "https://admin.mindobirdwatching.com" },
    { name: "Cache-Control", value: "no-store" },
  ] } },
});

const connections = {
  "[API] Media Insights": { main: [[{ node: "[CORE] Reporting Context", type: "main", index: 0 }]] },
  "[TEST] Manual Trigger": { main: [[{ node: "[CORE] Reporting Context", type: "main", index: 0 }]] },
  "[SYNC] Hourly Trigger": { main: [[{ node: "[CORE] Reporting Context", type: "main", index: 0 }]] },
  "[CORE] Reporting Context": { main: [[
    { node: "[DATA] Load Reels", type: "main", index: 0 },
    { node: "[DATA] Load Carousels", type: "main", index: 0 },
  ]] },
  "[DATA] Load Reels": { main: [[{ node: "[DATA] Combine Published Records", type: "main", index: 0 }]] },
  "[DATA] Load Carousels": { main: [[{ node: "[DATA] Combine Published Records", type: "main", index: 1 }]] },
  "[DATA] Combine Published Records": { main: [[{ node: "[CORE] Prepare Batch Queries", type: "main", index: 0 }]] },
  "[CORE] Prepare Batch Queries": { main: [[
    { node: "[META] Instagram Batch Insights", type: "main", index: 0 },
    { node: "[META] Load Page Access", type: "main", index: 0 },
    { node: "[YT] Video Statistics", type: "main", index: 0 },
    { node: "[YT] Daily Analytics", type: "main", index: 0 },
  ]] },
  "[META] Load Page Access": { main: [[{ node: "[META] Facebook Batch Insights", type: "main", index: 0 }]] },
  "[META] Instagram Batch Insights": { main: [[{ node: "[JOIN] Meta", type: "main", index: 0 }]] },
  "[META] Facebook Batch Insights": { main: [[{ node: "[JOIN] Meta", type: "main", index: 1 }]] },
  "[JOIN] Meta": { main: [[{ node: "[JOIN] Add YouTube Videos", type: "main", index: 0 }]] },
  "[YT] Video Statistics": { main: [[{ node: "[JOIN] Add YouTube Videos", type: "main", index: 1 }]] },
  "[JOIN] Add YouTube Videos": { main: [[{ node: "[JOIN] Add YouTube Daily", type: "main", index: 0 }]] },
  "[YT] Daily Analytics": { main: [[{ node: "[JOIN] Add YouTube Daily", type: "main", index: 1 }]] },
  "[JOIN] Add YouTube Daily": { main: [[{ node: "[REPORT] Build Dashboard Payload", type: "main", index: 0 }]] },
  "[REPORT] Build Dashboard Payload": { main: [[{ node: "[API] Respond", type: "main", index: 0 }]] },
};

const workflow = {
  name: "MBW - Social Media Analytics v3 - Production",
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: { executionOrder: "v1", timezone: "America/New_York", callerPolicy: "workflowsFromSameOwner", availableInMCP: false },
  versionId: "2ef3c44e-b695-47e3-919d-101df4c29839",
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(output);
