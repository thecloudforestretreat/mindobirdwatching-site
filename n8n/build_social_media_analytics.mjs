import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const output = process.env.MBW_ANALYTICS_OUTPUT || path.join("/tmp", "MBW_Social_Media_Analytics_v5.json");

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
  path: "mbw-media-insights-v5",
  responseMode: "responseNode",
  options: {},
}, { webhookId: "mbw-media-insights-v5" });
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
const previousEnd = new Date(start);
previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
const previousStart = new Date(previousEnd);
previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
const iso = d => d.toISOString().slice(0,10);
return [{json:{period,days,start_date:iso(start),end_date:iso(end),previous_start_date:iso(previousStart),previous_end_date:iso(previousEnd),requested_at:now.toISOString(),timezone:'America/New_York'}}];`,
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
const values = v => {
  if (Array.isArray(v)) return v.map(clean).filter(Boolean);
  const s = clean(v); if (!s) return [];
  try { const parsed=JSON.parse(s); if(Array.isArray(parsed)) return parsed.map(item=>clean(item && typeof item==='object' ? item.label||item.name||item.value : item)).filter(Boolean); } catch {}
  return s.split(/[,;|]+/).map(clean).filter(Boolean);
};
const slug = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^#+/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const tagsFor = row => {
  const tags=[];
  const add=(category,label)=>{label=clean(label).replace(/^#+/,'').replace(/_/g,' ');const value=slug(label);if(value)tags.push({key:category+':'+value,label,category});};
  values(row.tags).concat(values(row.internal_tags),values(row.search_tags),values(row.species_tags),values(row.content_tags)).forEach(v=>add('topic',v));
  const hashtags=[row.instagram_hashtags,row.facebook_hashtags,row.youtube_hashtags,row.tiktok_hashtags,row.tiktok_additional_hashtags,row.reddit_hashtags].flatMap(v=>clean(v).match(/#[\p{L}\p{N}_-]+/gu)||[]);
  hashtags.forEach(v=>add('hashtag',v));
  if(clean(row.bird_name))add('species',row.bird_name);
  if(clean(row.scientific_name))add('scientific',row.scientific_name);
  if(clean(row.featured_birds))add('subject',row.featured_birds);
  if(clean(row.activity_name))add('activity',row.activity_name);
  if(clean(row.location))add('location',row.location);
  return [...new Map(tags.map(tag=>[tag.key,tag])).values()].slice(0,24);
};
const rows = $input.all().map(i => i.json);
const youtubeIdFromUrl = value => {
  const raw=clean(value); if(!raw)return '';
  const match=raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/i);
  return match?match[1]:'';
};
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
    facebook_caption: clean(row.facebook_caption || row.instagram_caption_final || row.caption || row.reel_description),
    facebook_published_at: clean(row.facebook_published_date || row.published_date),
    youtube_url: clean(row.youtube_url),
    youtube_url_id: youtubeIdFromUrl(row.youtube_url),
    thumbnail: clean(row.cover_image_url || row.thumbnail_url || row.instagram_thumbnail_url),
    tags: tagsFor(row),
    is_published: clean(row.status).toLowerCase() === 'published' || Boolean(clean(row.instagram_post_id || row.facebook_post_id || row.youtube_post_id)),
  };
}).filter(r => r.is_published && r.published_date && r.published_date >= ctx.previous_start_date && r.published_date <= ctx.end_date)
  .map(r => ({...r,cohort:r.published_date >= ctx.start_date ? 'current' : 'previous'}));
const unique = values => [...new Set(values.filter(Boolean))];
const ig = unique(records.map(r => r.instagram_post_id));
const yt = unique(records.flatMap(r => [r.youtube_post_id,r.youtube_url_id]));
const facebookPageId = '753092067877601';
const facebookPostCandidates = values => unique(values.map(value => {
  const raw=clean(value).replace(/^https?:\/\/[^/]+\//,'').replace(/[?#].*$/,'').replace(/\/$/,'').split('/').pop();
  const bare=raw.split('_').pop();
  return raw.includes('_') ? raw : (bare ? facebookPageId+'_'+bare : '');
}));
const facebookReelCandidates = values => unique(values.map(value => clean(value).replace(/^https?:\/\/[^/]+\//,'').replace(/[?#].*$/,'').replace(/\/$/,'').split('/').pop().split('_').pop()));
const fbPostCandidates = facebookPostCandidates(records.filter(r=>r.type!=='reel').map(r=>r.facebook_post_id));
const fbReelCandidates = facebookReelCandidates(records.filter(r=>r.type==='reel').map(r=>r.facebook_post_id));
const enc = encodeURIComponent;
return [{json:{...ctx,records,
  ig_url: ig.length ? 'https://graph.facebook.com/v23.0/?ids='+enc(ig.join(','))+'&fields='+enc('id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count,insights.metric(reach,saved,shares,total_interactions,views)') : 'https://graph.facebook.com/v23.0/me?fields=id',
  fb_url: 'https://graph.facebook.com/v23.0/'+facebookPageId+'/published_posts?since='+ctx.previous_start_date+'&until='+ctx.end_date+'&limit=100&fields='+enc('id,created_time,permalink_url,full_picture,message,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true),insights.metric(post_media_view,post_total_media_view_unique,post_clicks,post_reactions_by_type_total,post_video_views)'),
  fb_ids_url: fbPostCandidates.length ? 'https://graph.facebook.com/v23.0/?ids='+enc(fbPostCandidates.join(','))+'&fields='+enc('id,created_time,permalink_url,full_picture,message,shares,comments.limit(0).summary(true),reactions.limit(0).summary(true),insights.metric(post_media_view,post_total_media_view_unique,post_clicks,post_reactions_by_type_total,post_video_views)') : 'https://graph.facebook.com/v23.0/me?fields=id',
  fb_reels_url: fbReelCandidates.length ? 'https://graph.facebook.com/v23.0/?ids='+enc(fbReelCandidates.join(','))+'&fields='+enc('id,created_time,permalink_url,description,picture,thumbnails,likes.limit(0).summary(true),comments.limit(0).summary(true)') : 'https://graph.facebook.com/v23.0/me?fields=id',
  yt_url: 'https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id='+enc(yt.join(',')),
  yt_daily_url: 'https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate='+ctx.previous_start_date+'&endDate='+ctx.end_date+'&metrics=views%2CestimatedMinutesWatched%2CaverageViewDuration%2CaverageViewPercentage%2Clikes%2Ccomments%2Cshares%2CsubscribersGained&dimensions=day&sort=day'
}}];`,
});

const httpDefaults = { options: { timeout: 25000 } };
add("[META] Instagram Batch Insights", "n8n-nodes-base.httpRequest", 4.2, [120, -180], {
  url: "={{ $json.ig_url }}", authentication: "predefinedCredentialType", nodeCredentialType: "facebookGraphApi", ...httpDefaults,
}, { credentials: { facebookGraphApi: INSTAGRAM_GRAPH }, onError: "continueRegularOutput", alwaysOutputData: true });
add("[META] Load Page Access", "n8n-nodes-base.httpRequest", 4.2, [120, -70], {
  url: "https://graph.facebook.com/v23.0/753092067877601?fields=id,name", authentication: "predefinedCredentialType", nodeCredentialType: "facebookGraphApi", ...httpDefaults,
}, { credentials: { facebookGraphApi: INSTAGRAM_GRAPH }, onError: "continueRegularOutput", alwaysOutputData: true });
add("[META] Facebook Batch Insights", "n8n-nodes-base.httpRequest", 4.2, [340, -70], {
  url: "={{ $('[CORE] Prepare Batch Queries').first().json.fb_url }}",
  authentication: "predefinedCredentialType", nodeCredentialType: "facebookGraphApi", ...httpDefaults,
}, { credentials: { facebookGraphApi: INSTAGRAM_GRAPH }, onError: "continueRegularOutput", alwaysOutputData: true });
add("[META] Facebook Stored Posts", "n8n-nodes-base.httpRequest", 4.2, [340, 10], {
  url: "={{ $('[CORE] Prepare Batch Queries').first().json.fb_ids_url }}",
  authentication: "predefinedCredentialType", nodeCredentialType: "facebookGraphApi", ...httpDefaults,
}, { credentials: { facebookGraphApi: INSTAGRAM_GRAPH }, onError: "continueRegularOutput", alwaysOutputData: true });
add("[META] Facebook Stored Reels", "n8n-nodes-base.httpRequest", 4.2, [340, 90], {
  url: "={{ $('[CORE] Prepare Batch Queries').first().json.fb_reels_url }}",
  authentication: "predefinedCredentialType", nodeCredentialType: "facebookGraphApi", ...httpDefaults,
}, { credentials: { facebookGraphApi: INSTAGRAM_GRAPH }, onError: "continueRegularOutput", alwaysOutputData: true });
add("[YT] Video Statistics", "n8n-nodes-base.httpRequest", 4.2, [120, 100], {
  url: "={{ $json.yt_url }}", authentication: "predefinedCredentialType", nodeCredentialType: "youTubeOAuth2Api", ...httpDefaults,
}, { credentials: { youTubeOAuth2Api: YOUTUBE }, onError: "continueRegularOutput", alwaysOutputData: true });
add("[YT] Daily Analytics", "n8n-nodes-base.httpRequest", 4.2, [120, 240], {
  url: "={{ $json.yt_daily_url }}", authentication: "predefinedCredentialType", nodeCredentialType: "youTubeOAuth2Api", ...httpDefaults,
}, { credentials: { youTubeOAuth2Api: YOUTUBE }, onError: "continueRegularOutput", alwaysOutputData: true });

add("[JOIN] Meta", "n8n-nodes-base.merge", 3.2, [380, -100], {});
add("[JOIN] Facebook Stored Objects", "n8n-nodes-base.merge", 3.2, [520, 40], {});
add("[JOIN] Facebook Sources", "n8n-nodes-base.merge", 3.2, [700, -60], {});
add("[JOIN] Add YouTube Videos", "n8n-nodes-base.merge", 3.2, [760, 0], {});
add("[JOIN] Add YouTube Daily", "n8n-nodes-base.merge", 3.2, [960, 100], {});

add("[REPORT] Build Dashboard Payload", "n8n-nodes-base.code", 2, [1180, 100], {
  jsCode: String.raw`const base = $('\u005bCORE\u005d Prepare Batch Queries').first().json;
const get = name => { try { return $(name).first().json || {}; } catch { return {}; } };
const igRaw = get('\u005bMETA\u005d Instagram Batch Insights');
const pageAccessRaw = get('\u005bMETA\u005d Load Page Access');
const fbRaw = get('\u005bMETA\u005d Facebook Batch Insights');
const fbDirectRaw = get('\u005bMETA\u005d Facebook Stored Posts');
const fbReelRaw = get('\u005bMETA\u005d Facebook Stored Reels');
const ytRaw = get('\u005bYT\u005d Video Statistics');
const ydRaw = get('\u005bYT\u005d Daily Analytics');
const num = v => Number(v) || 0;
const clean = v => String(v ?? '').trim();
const apiError = value => clean(value && value.error && (value.error.description || value.error.message) || value && value.description || value && value.message);
const insightMap = node => Object.fromEntries(((node && node.data) || []).map(metric => {
  const raw = metric.total_value && metric.total_value.value !== undefined ? metric.total_value.value : metric.values && metric.values[0] ? metric.values[0].value : 0;
  return [metric.name, typeof raw === 'object' ? Object.values(raw).reduce((a,b)=>a+num(b),0) : num(raw)];
}));
const igById = {};
for (const [key,value] of Object.entries(igRaw || {})) {
  if (!value || typeof value !== 'object' || key === 'error') continue;
  const m = insightMap(value.insights);
  igById[key] = {reach:num(m.reach),views:num(m.views),saves:num(m.saved),shares:num(m.shares),interactions:num(m.total_interactions),likes:num(value.like_count),comments:num(value.comments_count),permalink:value.permalink||'',thumbnail:value.thumbnail_url||value.media_url||''};
}
const fbById = {};
const fbByPermalink = {};
const fbUniqueRows = [];
const normalizeUrl = value => String(value||'').trim().replace(/[?#].*$/,'').replace(/\/$/,'').toLowerCase();
const normalizeText = value => String(value||'').toLowerCase().replace(/https?:\/\/\S+/g,' ').replace(/#[\p{L}\p{N}_-]+/gu,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const words = value => new Set(normalizeText(value).split(/\s+/).filter(word=>word.length>2));
const similarity = (left,right) => {const a=words(left),b=words(right);if(a.size<4||b.size<4)return 0;let same=0;for(const word of a)if(b.has(word))same++;return same/Math.max(a.size,b.size)};
const registerFacebook = value => {
  if (!value || typeof value !== 'object' || !value.id) return;
  const m = insightMap(value.insights);
  const thumbs=value.thumbnails&&value.thumbnails.data||[],likes=num(value.likes&&value.likes.summary&&value.likes.summary.total_count);
  const parsed = {id:String(value.id),created_time:value.created_time||'',message:value.message||value.description||'',reach:num(m.post_total_media_view_unique),views:num(value.views||m.post_media_view||m.post_video_views),clicks:num(m.post_clicks),shares:num(value.shares&&value.shares.count),reactions:num(value.reactions&&value.reactions.summary&&value.reactions.summary.total_count)||likes,comments:num(value.comments&&value.comments.summary&&value.comments.summary.total_count),permalink:value.permalink_url||'',thumbnail:value.full_picture||value.picture||(thumbs[0]&&thumbs[0].uri)||''};
  fbById[String(value.id)] = parsed;
  fbById[String(value.id).split('_').pop()] = parsed;
  if(parsed.permalink)fbByPermalink[normalizeUrl(parsed.permalink)]=parsed;
  if(!fbUniqueRows.some(row=>row.id===parsed.id))fbUniqueRows.push(parsed);
};
for (const value of (fbRaw.data || [])) registerFacebook(value);
for (const [key,value] of Object.entries(fbDirectRaw || {})) {if(key!=='error'&&value&&typeof value==='object'&&!value.error)registerFacebook(value)}
for (const [key,value] of Object.entries(fbReelRaw || {})) {if(key!=='error'&&value&&typeof value==='object'&&!value.error)registerFacebook(value)}
const ytById = {};
for (const value of (ytRaw.items || [])) {
  const s = value.statistics || {};
  const snippet=value.snippet||{},thumbs=snippet.thumbnails||{};
  ytById[value.id] = {views:num(s.viewCount),likes:num(s.likeCount),comments:num(s.commentCount),title:snippet.title||'',published_at:snippet.publishedAt||'',thumbnail:(thumbs.medium||thumbs.high||thumbs.default||{}).url||''};
}
const fbUnique = fbUniqueRows;
const headers = (ydRaw.columnHeaders || []).map(h=>h.name);
const daily = (ydRaw.rows || []).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]]))).map(row=>({date:row.day,value:num(row.views),views:num(row.views),watch_time_minutes:num(row.estimatedMinutesWatched),average_view_duration_seconds:num(row.averageViewDuration),average_view_percentage:num(row.averageViewPercentage)}));
const series = daily.filter(r=>r.date>=base.start_date);
const dailyTotals = series.reduce((a,v)=>({views:a.views+v.views,watch_time_minutes:a.watch_time_minutes+v.watch_time_minutes,duration_weighted:a.duration_weighted+v.average_view_duration_seconds*v.views,percentage_weighted:a.percentage_weighted+v.average_view_percentage*v.views}),{views:0,watch_time_minutes:0,duration_weighted:0,percentage_weighted:0});
const postResults = [];
const samples = [];
const facebookMatches={exact_id:0,permalink:0,caption_date:0,unmatched:0};
const youtubeMatches={exact_id:0,url_fallback:0,unmatched:0,unresolved:[]};
const dayName = d => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(d+'T12:00:00Z').getUTCDay()];
const timeHour = value => {
  const s=String(value||'').trim(); let m=s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i); if(!m)return 7;
  let h=Number(m[1]); const ap=(m[3]||'').toUpperCase(); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0; return h;
};
const displayTime = h => String(h%12||12)+':00 '+(h>=12?'PM':'AM');
for (const r of base.records) {
  const common={cohort:r.cohort,content_id:r.id,title:r.title,type:r.type,published_date:r.published_date,scheduled_date:r.scheduled_date,publish_day:dayName(r.scheduled_date),publish_hour:timeHour(r.scheduled_time),thumbnail:r.thumbnail,tags:r.tags||[]};
  if (r.instagram_post_id && igById[r.instagram_post_id]) {
    const v=igById[r.instagram_post_id], engagement=v.likes+v.comments+v.shares+v.saves;
    const denominator=v.reach||v.views, result=denominator||engagement;
    postResults.push({...common,thumbnail:v.thumbnail||common.thumbnail,platform:'Instagram',reach:v.reach,views:v.views,result,result_metric:v.reach?'Reach':v.views?'Views':'Engagements',engagements:engagement,denominator,engagement_rate:denominator?engagement/denominator*100:0,href:v.permalink||r.instagram_permalink});
    if(r.cohort==='current'&&denominator)samples.push({platform:'Instagram',day:common.publish_day,hour:common.publish_hour,value:result});
  }
  if (r.facebook_post_id) {
    const rawId=String(r.facebook_post_id).trim(),idCandidates=[rawId,rawId.split('_').pop()],permalinkKey=normalizeUrl(r.facebook_permalink);
    let v=idCandidates.map(id=>fbById[id]).find(Boolean),matchMethod=v?'exact_id':'';
    if(!v&&permalinkKey&&fbByPermalink[permalinkKey]){v=fbByPermalink[permalinkKey];matchMethod='permalink'}
    if(!v&&r.facebook_caption){
      const candidates=fbUnique.filter(item=>String(item.created_time||'').slice(0,10)===r.published_date).map(item=>({item,score:similarity(r.facebook_caption,item.message)})).filter(candidate=>candidate.score>=.72).sort((a,b)=>b.score-a.score);
      if(candidates.length&&(!candidates[1]||candidates[0].score-candidates[1].score>=.15)){v=candidates[0].item;matchMethod='caption_date'}
    }
    if(v){
    if(r.cohort==='current')facebookMatches[matchMethod]++;
    const engagement=v.reactions+v.comments+v.shares;
    const denominator=v.reach||v.views, result=denominator;
    postResults.push({...common,thumbnail:v.thumbnail||common.thumbnail,platform:'Facebook',reach:v.reach,views:v.views,result,result_metric:v.reach?'Unique viewers':v.views?'Media views':'Unavailable',visibility_available:Boolean(denominator),engagements:engagement,denominator,engagement_rate:denominator?engagement/denominator*100:null,href:v.permalink||r.facebook_permalink,facebook_match_method:matchMethod,facebook_canonical_post_id:v.id});
    if(r.cohort==='current'&&denominator)samples.push({platform:'Facebook',day:common.publish_day,hour:common.publish_hour,value:result});
    }else if(r.cohort==='current')facebookMatches.unmatched++;
  }
  if (r.youtube_post_id) {
    const matchedId=ytById[r.youtube_post_id]?r.youtube_post_id:(r.youtube_url_id&&ytById[r.youtube_url_id]?r.youtube_url_id:'');
    if(matchedId){
    const matchMethod=matchedId===r.youtube_post_id?'exact_id':'url_fallback',v=ytById[matchedId],engagement=v.likes+v.comments;
    if(r.cohort==='current')youtubeMatches[matchMethod]++;
    postResults.push({...common,title:r.title||v.title,thumbnail:v.thumbnail||common.thumbnail,platform:'YouTube',reach:0,views:v.views,result:v.views,result_metric:'Views',engagements:engagement,denominator:v.views,engagement_rate:v.views?engagement/v.views*100:0,href:r.youtube_url||('https://youtu.be/'+matchedId),youtube_match_method:matchMethod,youtube_canonical_video_id:matchedId});
    if(r.cohort==='current')samples.push({platform:'YouTube',day:common.publish_day,hour:common.publish_hour,value:v.views});
    }else if(r.cohort==='current'){
      youtubeMatches.unmatched++;
      youtubeMatches.unresolved.push({content_id:r.id,title:r.title,youtube_post_id:r.youtube_post_id,youtube_url_id:r.youtube_url_id||''});
    }
  }
}
const current=postResults.filter(p=>p.cohort==='current');
const top=current.slice().sort((a,b)=>b.result-a.result).map(p=>({title:p.title,platform:p.platform,published_date:p.published_date,value:p.result,metric:p.result_metric,thumbnail:p.thumbnail,href:p.href,type:p.type}));
const uniqueCurrent=[...new Set(current.map(p=>p.content_id))];
const totalsFor=platform=>current.filter(p=>p.platform===platform).reduce((a,p)=>({reach:a.reach+p.reach,views:a.views+p.views,engagements:a.engagements+p.engagements}),{reach:0,views:0,engagements:0});
const igTotals=totalsFor('Instagram'), fbTotals=totalsFor('Facebook'), ytTotals=totalsFor('YouTube');
const countExpected=(platform)=>base.records.filter(r=>r.cohort==='current'&&Boolean(r[platform+'_post_id'])).length;
const countMatched=(platform)=>current.filter(p=>p.platform.toLowerCase()===platform).length;
const countVisible=(platform)=>current.filter(p=>p.platform.toLowerCase()===platform&&num(p.denominator||p.reach||p.views)>0).length;
const platformStatus=(platform)=>{const expected=countExpected(platform),matched=countMatched(platform),visible=countVisible(platform),coverage=expected?matched/expected:0,visibilityCoverage=matched?visible/matched:0;return{expected,matched,visible,coverage_percent:expected?Math.round(coverage*100):null,visibility_coverage_percent:matched?Math.round(visibilityCoverage*100):null,data_status:matched&&visible?'available':matched?'identity_only':'no_data'}};
const facebookPageAuthorized=String(pageAccessRaw.id||'')==='753092067877601'&&!apiError(pageAccessRaw);
const facebookApiErrors=[fbRaw,fbDirectRaw,fbReelRaw].map(apiError).filter(Boolean);
const metaCredentialReason=apiError(pageAccessRaw)||apiError(igRaw);
const facebookConnectionReason=metaCredentialReason||(!facebookPageAuthorized?'The permanent Mindo Bird Watching Page token could not verify Page access. Reconnect the Facebook credential with Page access and read-insights permissions.':facebookApiErrors.length?facebookApiErrors[0]:'');
const instagramConnectionReason=apiError(igRaw)||metaCredentialReason;
const groups = new Map();
for (const s of samples) { const k=[s.platform,s.day,s.hour].join('|'); const g=groups.get(k)||{...s,count:0,total:0}; g.count++; g.total+=s.value; groups.set(k,g); }
const eligible=[...groups.values()].filter(g=>g.count>=3).map(g=>({...g,avg:g.total/g.count}));
const maxAvg=Math.max(1,...eligible.map(g=>g.avg));
const slots=eligible.sort((a,b)=>b.avg-a.avg||b.count-a.count).slice(0,3).map(g=>({days:[g.day],time:displayTime(g.hour),platform:g.platform,score:Math.min(95,Math.round(55+30*(g.avg/maxAvg)+Math.min(10,g.count))),basis:String(g.count)+' matched posts'}));
const median = values => { const a=values.map(num).sort((x,y)=>x-y); if(!a.length)return 0; const i=Math.floor(a.length/2); return a.length%2?a[i]:(a[i-1]+a[i])/2; };
const confidence = count => count>=10?'reliable':count>=5?'developing':'early';
const visibilityRows=current.filter(post=>num(post.denominator||post.reach||post.views)>0);
const platformCounts=visibilityRows.reduce((map,post)=>(map[post.platform]=(map[post.platform]||0)+1,map),{});
const primaryPlatform=Object.entries(platformCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
const analysisRows=visibilityRows.filter(post=>post.platform===primaryPlatform);
const patternGroups=(field,kind)=>{
  const grouped=new Map(); for(const post of analysisRows){const label=String(post[field]||'').trim();if(!label)continue;const a=grouped.get(label)||[];a.push(post);grouped.set(label,a)}
  const eligible=[...grouped.entries()].filter(([,rows])=>rows.length>=2).map(([label,rows])=>({id:kind+':'+label.toLowerCase(),kind,label,value:median(rows.map(p=>p.result)),sample_size:rows.length,confidence:confidence(rows.length)})).sort((a,b)=>b.value-a.value);
  return eligible.length>=2?{...eligible[0],statistic:'median',metric:'views_or_reach'}:null;
};
const overallMedian=median(analysisRows.map(p=>p.result));
const observedPatterns=[patternGroups('type','format')].filter(Boolean).map(p=>({...p,label:primaryPlatform+' · '+p.label,platform:primaryPlatform,baseline:overallMedian,delta_percent:overallMedian?(p.value-overallMedian)/overallMedian*100:null,evidence:p.sample_size+' matched '+primaryPlatform+' results'}));
const timingGroups=new Map();
for(const post of analysisRows){const key=post.publish_day+'|'+post.publish_hour,g=timingGroups.get(key)||{day:post.publish_day,hour:post.publish_hour,count:0,total:0};g.count++;g.total+=post.result;timingGroups.set(key,g)}
const comparableSlots=[...timingGroups.values()].filter(g=>g.count>=3).map(g=>({...g,avg:g.total/g.count}));
const bestSlot=comparableSlots.length>=2?comparableSlots.sort((a,b)=>b.avg-a.avg||b.count-a.count)[0]:null;
if(bestSlot)observedPatterns.push({id:'timing:'+bestSlot.day+'|'+bestSlot.hour,kind:'timing',label:primaryPlatform+' · '+bestSlot.day+' · '+displayTime(bestSlot.hour),platform:primaryPlatform,value:bestSlot.avg,baseline:overallMedian,delta_percent:overallMedian?(bestSlot.avg-overallMedian)/overallMedian*100:null,sample_size:bestSlot.count,confidence:confidence(bestSlot.count),statistic:'average',metric:'views_or_reach',evidence:bestSlot.count+' matched '+primaryPlatform+' results'});
const response={
  ok:true,configured:true,period:base.period,updated_at:new Date().toISOString(),
  summary:{published_posts:uniqueCurrent.length,instagram_reach:igTotals.reach,facebook_unique_viewers:fbTotals.reach,facebook_media_views:fbTotals.views,youtube_views:dailyTotals.views||ytTotals.views,total_engagements:igTotals.engagements+fbTotals.engagements+ytTotals.engagements,visibility_totals_are_comparable:false},
  series,top_posts:top.slice(0,12),post_results:postResults,
  youtube_retention:{available:dailyTotals.views>0,views:dailyTotals.views,average_view_duration_seconds:dailyTotals.views?dailyTotals.duration_weighted/dailyTotals.views:0,average_view_percentage:dailyTotals.views?dailyTotals.percentage_weighted/dailyTotals.views:0,completed_through:base.end_date},
  data_health:{stale:false,note:'Identity matching and metric visibility are reported separately. Facebook uses direct post and reel IDs, permalink, and high-confidence caption/date reconciliation. YouTube uses the saved video ID and falls back to the canonical ID in the saved YouTube URL when they disagree. Facebook visibility uses current media views and unique media viewers because Meta retired legacy Page post reach metrics in June 2026. Cohort comparisons group posts by publish date; YouTube daily reporting is finalized through '+base.end_date+'.',platforms:Object.fromEntries(['instagram','facebook','youtube'].map(platform=>{const status=platformStatus(platform),baseDetails={matched_with_visibility:status.visible,visibility_missing:Math.max(0,status.matched-status.visible)};const details=platform==='instagram'?{...baseDetails,connection_reason:instagramConnectionReason}:platform==='facebook'?{...baseDetails,match_methods:facebookMatches,unmatched_reasons:{not_returned_or_ambiguous:Math.max(0,status.expected-status.matched)},connection_reason:facebookConnectionReason}:platform==='youtube'?{...baseDetails,match_methods:{exact_id:youtubeMatches.exact_id,url_fallback:youtubeMatches.url_fallback},unmatched_reasons:{not_returned_by_api:youtubeMatches.unmatched},unresolved:youtubeMatches.unresolved}:baseDetails;return[platform,{expected:status.expected,matched:status.matched,unmatched:Math.max(0,status.expected-status.matched),...details}]}))},
  sources:[
    {platform:'instagram',status:Object.keys(igById).length?'connected':'no matched data',mode:'current lifetime post insights'},
    {platform:'facebook',status:fbUnique.length?'connected':'no matched data',mode:'current organic media views and unique viewers with reactions, comments, and shares'},
    {platform:'youtube',status:(ytRaw.items||[]).length?'connected':'no matched data',mode:'daily finalized through '+base.end_date}
  ],
  observed_patterns:observedPatterns,
  recommendations:{configured:slots.length>0,timezone:'America/New_York',sample_size:samples.length,source:'Matched MBW organic post performance; minimum 3 posts per time slot',slots},
  platforms:{
    instagram:{connected:!igRaw.error,...platformStatus('instagram'),connection_reason:instagramConnectionReason,metrics:{reach:igTotals.reach,views:igTotals.views,engagements:igTotals.engagements,matched_posts:countMatched('instagram')}},
    facebook:{connected:facebookPageAuthorized&&!facebookApiErrors.length,...platformStatus('facebook'),connection_reason:facebookConnectionReason,metrics:{unique_viewers:fbTotals.reach,media_views:fbTotals.views,engagements:fbTotals.engagements,matched_posts:countMatched('facebook'),visibility_matched:countVisible('facebook')}},
    youtube:{connected:!ytRaw.error&&!ydRaw.error,...platformStatus('youtube'),metrics:{views:dailyTotals.views||ytTotals.views,watch_time_minutes:dailyTotals.watch_time_minutes,engagements:ytTotals.engagements,matched_videos:countMatched('youtube')}}
  }
};
const state=$getWorkflowStaticData('global'); state.last_success=response.updated_at; state.last_period=base.period; state.last_summary=response.summary;
return [{json:response}];`,
});

add("[AI] Interpret Measured Patterns", "n8n-nodes-base.httpRequest", 4.2, [1220, 100], {
  method: "POST",
  url: "http://127.0.0.1:11434/api/chat",
  sendHeaders: true,
  headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
  sendBody: true,
  specifyBody: "json",
  jsonBody: "={{ { model: 'gpt-oss:20b', messages: [{ role: 'system', content: 'You interpret already-calculated organic social media evidence for Mindo Bird Watching. Never invent or recalculate numbers. The value and baseline fields are performance measures, never post counts; sample_size is the only count. Use only the supplied patterns. Treat associations as hypotheses, not causes. Return one cautious interpretation and one practical single-variable experiment per evidence ID. Return valid JSON only.' }, { role: 'user', content: `Evidence: ${JSON.stringify($json.observed_patterns || [])}\\nFilters cover ${$json.period || 'the selected period'}. Every pattern is already limited to the platform field supplied with it. For Instagram, views_or_reach means reach; for Facebook it means unique viewers or media views; for YouTube it means views. The statistic field says whether value is a median or average. sample_size is the number of matched platform results supporting the pattern. For every supplied evidence item, return: {\"items\":[{\"evidence_id\":\"exact supplied id\",\"interpretation\":\"plain-language explanation that correctly names the platform, metric, statistic, and sample size\",\"experiment\":\"one specific next test that changes only one variable and compares the same metric within the same platform\"}]}. For a format pattern, compare the named format against another actual format while holding subject, day, and time as similar as possible; a carousel is a multi-image post and must never be called a single image. For a timing pattern, keep platform, format, and subject similar and compare the named slot with one other slot. Do not describe value as a number of posts. Do not mention any platform not named in that evidence item. Do not call an early or developing signal proven. Do not recommend a posting time unless it appears in the supplied evidence.` }], stream: false, think: 'low', format: 'json', keep_alive: '30m', options: { temperature: 0.1, num_predict: 900 } } }}",
  options: { response: { response: { responseFormat: "json" } } },
}, { retryOnFail: true, maxTries: 2, waitBetweenTries: 3000, onError: "continueRegularOutput", alwaysOutputData: true });

add("[AI] Validate Guidance", "n8n-nodes-base.code", 2, [1440, 100], {
  jsCode: String.raw`const report={...$('[REPORT] Build Dashboard Payload').first().json};
const evidenceById=new Map((report.observed_patterns||[]).map(pattern=>[String(pattern.id||''),pattern]));
const allowed=new Set(evidenceById.keys());
let parsed={};
try{parsed=JSON.parse($json.message?.content||$json.response||'{}')}catch{}
const items=(Array.isArray(parsed.items)?parsed.items:[]).map(item=>({
  evidence_id:String(item.evidence_id||'').trim(),
  interpretation:String(item.interpretation||'').trim().slice(0,600),
  experiment:String(item.experiment||'').trim().slice(0,600),
})).filter(item=>allowed.has(item.evidence_id)&&item.interpretation).map(item=>{
  const pattern=evidenceById.get(item.evidence_id)||{},platform=String(pattern.platform||'the same platform'),measure=platform==='YouTube'?'views':platform==='Facebook'?'unique viewers or media views':'reach';
  if(pattern.kind==='format')item.experiment='On '+platform+', publish comparable posts about the same subject in the leading format and one other available format at similar times. Compare '+measure+' after the same measurement window.';
  if(pattern.kind==='timing')item.experiment='Repeat a comparable post in this '+platform+' time slot and in one other established '+platform+' slot shown in the dashboard. Keep the subject and format similar, then compare '+measure+' after the same measurement window.';
  return item;
});
report.ai_guidance={available:items.length>0,metric:'result',generated_at:items.length?new Date().toISOString():'',model:items.length?'gpt-oss:20b':'',items,note:items.length?'Local AI interpreted platform-specific visibility evidence; calculations were not AI-generated.':'Local AI guidance was unavailable; measured patterns are still shown.'};
return [{json:report}];`,
});

add("[API] Respond", "n8n-nodes-base.respondToWebhook", 1.1, [1660, 100], {
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
  "[META] Load Page Access": { main: [[
    { node: "[META] Facebook Batch Insights", type: "main", index: 0 },
    { node: "[META] Facebook Stored Posts", type: "main", index: 0 },
    { node: "[META] Facebook Stored Reels", type: "main", index: 0 },
  ]] },
  "[META] Instagram Batch Insights": { main: [[{ node: "[JOIN] Meta", type: "main", index: 0 }]] },
  "[META] Facebook Batch Insights": { main: [[{ node: "[JOIN] Facebook Sources", type: "main", index: 0 }]] },
  "[META] Facebook Stored Posts": { main: [[{ node: "[JOIN] Facebook Stored Objects", type: "main", index: 0 }]] },
  "[META] Facebook Stored Reels": { main: [[{ node: "[JOIN] Facebook Stored Objects", type: "main", index: 1 }]] },
  "[JOIN] Facebook Stored Objects": { main: [[{ node: "[JOIN] Facebook Sources", type: "main", index: 1 }]] },
  "[JOIN] Facebook Sources": { main: [[{ node: "[JOIN] Meta", type: "main", index: 1 }]] },
  "[JOIN] Meta": { main: [[{ node: "[JOIN] Add YouTube Videos", type: "main", index: 0 }]] },
  "[YT] Video Statistics": { main: [[{ node: "[JOIN] Add YouTube Videos", type: "main", index: 1 }]] },
  "[JOIN] Add YouTube Videos": { main: [[{ node: "[JOIN] Add YouTube Daily", type: "main", index: 0 }]] },
  "[YT] Daily Analytics": { main: [[{ node: "[JOIN] Add YouTube Daily", type: "main", index: 1 }]] },
  "[JOIN] Add YouTube Daily": { main: [[{ node: "[REPORT] Build Dashboard Payload", type: "main", index: 0 }]] },
  "[REPORT] Build Dashboard Payload": { main: [[{ node: "[AI] Interpret Measured Patterns", type: "main", index: 0 }]] },
  "[AI] Interpret Measured Patterns": { main: [[{ node: "[AI] Validate Guidance", type: "main", index: 0 }]] },
  "[AI] Validate Guidance": { main: [[{ node: "[API] Respond", type: "main", index: 0 }]] },
};

const workflow = {
  name: "MBW - Social Media Analytics v5 - Production",
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: { executionOrder: "v1", timezone: "America/New_York", callerPolicy: "workflowsFromSameOwner", availableInMCP: false },
  versionId: "d8a3c940-a84a-4e2c-b8d5-7cc8e4904e12",
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(output);
