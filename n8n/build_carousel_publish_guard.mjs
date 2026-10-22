import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, 'generated', 'MBW - AI Carousels - Admin Trigger - IMPORT.json');
const outputPath = path.join(here, 'generated', 'MBW - AI Carousels v14 - Publish State Guard - IMPORT.json');
const workflow = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

function node(name) {
  const found = workflow.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`Missing workflow node: ${name}`);
  return found;
}

workflow.name = 'MBW - AI Carousels v14 - Publish State Guard';
delete workflow.id;
delete workflow.versionId;
delete workflow.active;

node('[CORE] Scheduled Trigger').parameters.rule.interval = [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 10 }];

node('Classify Carousel').parameters.jsCode = String.raw`function has(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
function bool(v, defaultValue = false) {
  if (!has(v)) return defaultValue;
  if (typeof v === 'boolean') return v;
  return ['true','1','yes','y','on'].includes(String(v).trim().toLowerCase());
}
function scheduledTimePassed(r) {
  const d = String(r.scheduled_date || '').trim();
  const t = String(r.scheduled_time || '').trim();
  if (!d || !t) return false;
  let dt = DateTime.fromFormat(d + ' ' + t, 'M/d/yyyy h:mm a', { zone: 'America/New_York' });
  if (!dt.isValid) dt = DateTime.fromFormat(d + ' ' + t, 'M/d/yyyy H:mm', { zone: 'America/New_York' });
  if (!dt.isValid) dt = DateTime.fromISO(d + 'T' + t, { zone: 'America/New_York' });
  return dt.isValid && dt.toMillis() <= DateTime.now().setZone('America/New_York').toMillis();
}
return $input.all().map(item => {
  const r = { ...item.json };
  const urls = Array.from({length: 10}, (_, i) => String(r['image_' + (i + 1) + '_url'] || '').trim()).filter(Boolean);
  const inputStatus = String(r.input_status || '').trim().toUpperCase();
  const originalStatus = String(r.status || '').trim();
  let status = originalStatus.toLowerCase();
  const reviewStatus = String(r.copy_review_status || '').trim().toUpperCase();
  const approvalStatus = String(r.approval_status || '').trim().toUpperCase();
  const copyReady = ['PASS','HUMAN_EDITED'].includes(reviewStatus) && (reviewStatus === 'HUMAN_EDITED' || Number(r.quality_score || 0) >= 92);
  const publishReady = approvalStatus === 'APPROVED' && copyReady;
  const lock=String(r.publishing_lock||'').trim();
  const lockMatch=lock.match(/(20\d\d-\d\d-\d\dT[^\s]+)$/);
  const lockTime=lockMatch?DateTime.fromISO(lockMatch[1],{zone:'America/New_York'}):null;
  const staleLock=Boolean(lockTime&&lockTime.isValid&&DateTime.now().diff(lockTime,'minutes').minutes>15);
  const hasUnfinishedArtifacts=(bool(r.post_to_instagram,true)&&has(r.instagram_container_id)&&!has(r.instagram_post_id)) || (bool(r.post_to_facebook,true)&&has(r.facebook_photo_ids)&&!has(r.facebook_post_id));
  const repairableStatus = ['needs review','testing','ready'].includes(status);
  if (publishReady && repairableStatus) {
    r.status = 'Scheduled';
    status = 'scheduled';
    r._state_repaired = true;
  } else if (publishReady && status === 'publishing' && staleLock && !hasUnfinishedArtifacts) {
    r.status = 'Scheduled';
    r.publishing_lock = '';
    status = 'scheduled';
    r._state_repaired = true;
  } else {
    r._state_repaired = false;
  }
  const queued = status === 'queued';
  const inputApproved = ['READY','VERIFIED'].includes(inputStatus);
  const due = queued || (status === 'scheduled' && scheduledTimePassed(r));
  const valid = has(r.carousel_id) && urls.length >= 2 && urls.length <= 10 && new Set(urls).size === urls.length && has(r.featured_birds) && inputApproved;
  const copyComplete = has(r.carousel_title) && has(r.caption) && has(r.instagram_hashtags) && has(r.facebook_caption) && has(r.facebook_hashtags) && has(r.reddit_title) && has(r.reddit_caption) && has(r.reddit_hashtags);
  r.media_type = 'CAROUSEL';
  r.post_to_instagram = bool(r.post_to_instagram, true);
  r.post_to_facebook = bool(r.post_to_facebook, true);
  r._needs_generation = !copyComplete || (!publishReady && !String(r.ai_model || '').includes('en-US v10'));
  r._process = valid && due;
  r._is_testing = queued;
  r._validation_error = !has(r.carousel_id) ? 'Missing carousel_id' :
    (urls.length < 2 || urls.length > 10) ? 'Between two and ten image URLs are required' :
    new Set(urls).size !== urls.length ? 'All carousel image URLs must be unique' :
    !has(r.featured_birds) ? 'Missing featured_birds' :
    !inputApproved ? 'input_status must be READY or VERIFIED' : '';
  return { json: r };
});`;

node('[CORE] Reclassify Prepared Row').parameters.jsCode = String.raw`function has(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
function bool(v, d=false) { if (!has(v)) return d; if (typeof v === 'boolean') return v; return ['true','1','yes','y','on'].includes(String(v).trim().toLowerCase()); }
function stripTrailingHashtags(v) { return String(v ?? '').trim().replace(/\s*(?:#[\p{L}\p{N}_-]+\s*)+$/gu, '').trim(); }
function scheduledTimePassed(r) {
  const d=String(r.scheduled_date||'').trim(), t=String(r.scheduled_time||'').trim();
  if (!d || !t) return false;
  let dt=DateTime.fromFormat(d+' '+t,'M/d/yyyy h:mm a',{zone:'America/New_York'});
  if (!dt.isValid) dt=DateTime.fromISO(d+'T'+t,{zone:'America/New_York'});
  return dt.isValid && dt.toMillis() <= DateTime.now().setZone('America/New_York').toMillis();
}
return $input.all().map(item => {
  const r={...item.json};
  r.caption=stripTrailingHashtags(r.caption);
  r.facebook_caption=stripTrailingHashtags(r.facebook_caption);
  r.post_to_instagram=bool(r.post_to_instagram,true);
  r.post_to_facebook=bool(r.post_to_facebook,true);
  const status=String(r.status||'').trim().toLowerCase();
  const reviewStatus=String(r.copy_review_status||'').trim().toUpperCase();
  const approvalStatus=String(r.approval_status||'').trim().toUpperCase();
  const publishReady=approvalStatus==='APPROVED' && ['PASS','HUMAN_EDITED'].includes(reviewStatus) && (reviewStatus==='HUMAN_EDITED' || Number(r.quality_score||0)>=92);
  r._is_testing=status==='testing' || !publishReady || (status==='scheduled' && !scheduledTimePassed(r));
  return {json:r};
});`;

node('[CORE] Validate and Lock').parameters.jsCode = String.raw`function has(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
function bool(v,d=false) { if (!has(v)) return d; if (typeof v==='boolean') return v; return ['true','1','yes','y','on'].includes(String(v).trim().toLowerCase()); }
const r={...$json};
const urls=Array.from({length:10},(_,i)=>String(r['image_'+(i+1)+'_url']||'').trim()).filter(Boolean);
if (urls.length < 2 || urls.length > 10) throw new Error('PUBLISH BLOCKED: between two and ten image URLs are required.');
if (new Set(urls).size !== urls.length) throw new Error('PUBLISH BLOCKED: all carousel image URLs must be unique.');
r._image_urls=urls;
if (!has(r.caption) || !has(r.instagram_hashtags) || !has(r.facebook_caption)) throw new Error('PUBLISH BLOCKED: caption fields are incomplete.');
if (String(r.input_status||'').trim().toUpperCase() !== 'VERIFIED') throw new Error('PUBLISH BLOCKED: carousel is not verified.');
const reviewStatus=String(r.copy_review_status||'').trim().toUpperCase();
if (String(r.approval_status||'').trim().toUpperCase() !== 'APPROVED' || !['PASS','HUMAN_EDITED'].includes(reviewStatus) || (reviewStatus==='PASS' && Number(r.quality_score||0) < 92)) throw new Error('PUBLISH BLOCKED: approved copy must pass both local reviews or contain validated human edits.');
r.post_to_instagram=bool(r.post_to_instagram,true);
r.post_to_facebook=bool(r.post_to_facebook,true);
if (!r.post_to_instagram && !r.post_to_facebook) throw new Error('PUBLISH BLOCKED: no platform is selected.');
if (reviewStatus!=='HUMAN_EDITED') {
  const mechanical=/submitted (?:images|visual details)|featured bird|visual story|complete carousel|shift perspectives|distinct visual formats|different kind of attention|designed for slower looking|what catches your attention|visual journey|carefully curated|subtle shifts?|invites contemplation|natural beauty|rhythm of the landscape|light and composition/i;
  if (r.post_to_instagram && mechanical.test([r.carousel_title,r.caption].join(' '))) throw new Error('PUBLISH BLOCKED: Instagram copy still contains mechanical or generic wording.');
  if (r.post_to_facebook && mechanical.test(String(r.facebook_caption||''))) throw new Error('PUBLISH BLOCKED: Facebook copy still contains mechanical or generic wording.');
}
if (has(r.publishing_lock)) throw new Error('PUBLISH BLOCKED: this row already has a publishing lock. Review it before retrying.');
if (r.post_to_instagram && has(r.instagram_container_id) && !has(r.instagram_post_id)) throw new Error('RECOVERY REQUIRED: Instagram container exists without a saved post ID. Automatic reposting was blocked.');
if (r.post_to_facebook && has(r.facebook_photo_ids) && !has(r.facebook_post_id)) throw new Error('RECOVERY REQUIRED: Facebook photo IDs exist without a saved post ID. Automatic reposting was blocked.');
r.publishing_lock='execution-'+($execution.id || 'manual')+'-'+DateTime.now().setZone('America/New_York').toISO();
r.status='Publishing';
r.media_type='CAROUSEL';
r.error_message='';
r.posting_defaults_applied_at=r.posting_defaults_applied_at || DateTime.now().setZone('America/New_York').toISO();
return [{json:r}];`;

node('[CORE] Finalize Status').parameters.jsCode = String.raw`function has(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
function bool(v,d=false) { if (!has(v)) return d; if (typeof v==='boolean') return v; return ['true','1','yes','y','on'].includes(String(v).trim().toLowerCase()); }
const r={...$json};
const igSelected=bool(r.post_to_instagram,true), fbSelected=bool(r.post_to_facebook,true);
const complete=(!igSelected || has(r.instagram_post_id)) && (!fbSelected || has(r.facebook_post_id));
r.status=complete?'Published':'Partial';
r.error_message=complete?'':'One or more selected platforms did not return a post ID. Use safe recovery only for the missing platform.';
r.publishing_lock='';
return [{json:r}];`;

node('[TG] Mark Preview Sent').parameters.columns.value.status = "={{ ['SCHEDULED','READY'].includes(String($json.status || '').trim().toUpperCase()) && String($json.approval_status || '').trim().toUpperCase() === 'APPROVED' && ['PASS','HUMAN_EDITED'].includes(String($json.copy_review_status || '').trim().toUpperCase()) ? $json.status : String($json.admin_mode || '').toLowerCase() === 'auto' ? $json.status : 'Needs Review' }}";

for (const name of ['[TG] Build Preview Message', '[TG] Build Success Message']) {
  const messageNode = node(name);
  messageNode.parameters.jsCode = messageNode.parameters.jsCode.replace(
    "const reviewReady=String(r.copy_review_status||'').trim().toUpperCase()==='PASS';",
    "const reviewStatus=String(r.copy_review_status||'').trim().toUpperCase();\nconst reviewReady=['PASS','HUMAN_EDITED'].includes(reviewStatus);"
  );
}

const classifier = node('Classify Carousel').parameters.jsCode;
const reclassifier = node('[CORE] Reclassify Prepared Row').parameters.jsCode;
const previewStatus = node('[TG] Mark Preview Sent').parameters.columns.value.status;
if (!classifier.includes("['PASS','HUMAN_EDITED']") || !classifier.includes('_state_repaired')) throw new Error('Classifier guard was not applied');
if (!classifier.includes('staleLock') || !classifier.includes('hasUnfinishedArtifacts')) throw new Error('Stale publishing recovery guard was not applied');
if (!reclassifier.includes("reviewStatus==='HUMAN_EDITED'")) throw new Error('Human-edited publish guard was not applied');
if (!previewStatus.includes("['PASS','HUMAN_EDITED']")) throw new Error('Preview status preservation guard was not applied');
if (!node('[TG] Build Preview Message').parameters.jsCode.includes("['PASS','HUMAN_EDITED']")) throw new Error('Telegram review-ready guard was not applied');
if (!node('[CORE] Validate and Lock').parameters.jsCode.includes("reviewStatus!=='HUMAN_EDITED'") || node('[CORE] Validate and Lock').parameters.jsCode.includes('swipe through')) throw new Error('Platform copy validation guard was not applied');
if (!node('[CORE] Finalize Status').parameters.jsCode.includes("r.publishing_lock=''")) throw new Error('Publishing lock finalizer was not applied');
if (JSON.stringify(node('[CORE] Scheduled Trigger').parameters.rule.interval) !== JSON.stringify([{ field: 'hours', hoursInterval: 1, triggerAtMinute: 10 }])) throw new Error('Hourly schedule is not configured for minute 10');

fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + '\n');
console.log(outputPath);
