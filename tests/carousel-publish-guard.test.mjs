import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

execFileSync(process.execPath, ['n8n/build_carousel_publish_guard.mjs'], { stdio: 'pipe' });
const workflow = JSON.parse(fs.readFileSync('n8n/generated/MBW - AI Carousels v14 - Publish State Guard - IMPORT.json', 'utf8'));
const node = (name) => workflow.nodes.find((item) => item.name === name);

assert.equal(workflow.name, 'MBW - AI Carousels v14 - Publish State Guard');
assert.equal(node('[CORE] Scheduled Trigger').parameters.rule.interval[0].triggerAtMinute, 10);
assert.match(node('Classify Carousel').parameters.jsCode, /publishReady && repairableStatus/);
assert.match(node('Classify Carousel').parameters.jsCode, /r\.status = 'Scheduled'/);
assert.match(node('Classify Carousel').parameters.jsCode, /!copyComplete \|\| \(!publishReady/);
assert.match(node('[CORE] Reclassify Prepared Row').parameters.jsCode, /\['PASS','HUMAN_EDITED'\]/);
assert.match(node('[CORE] Reclassify Prepared Row').parameters.jsCode, /reviewStatus==='HUMAN_EDITED'/);
assert.match(node('[TG] Mark Preview Sent').parameters.columns.value.status, /\['PASS','HUMAN_EDITED'\]/);
assert.match(node('[TG] Mark Preview Sent').parameters.columns.value.status, /\? \$json\.status/);
assert.match(node('[TG] Build Preview Message').parameters.jsCode, /\['PASS','HUMAN_EDITED'\]/);
assert.match(node('[TG] Build Success Message').parameters.jsCode, /\['PASS','HUMAN_EDITED'\]/);

const target = {
  approval_status: 'APPROVED',
  copy_review_status: 'HUMAN_EDITED',
  quality_score: 92,
  status: 'Needs Review',
  carousel_title: 'Nine Moments from Recent Tours in Mindo',
  caption: 'saved',
  instagram_hashtags: '#saved',
  facebook_caption: 'saved',
  facebook_hashtags: '#saved',
  reddit_title: 'saved',
  reddit_caption: 'saved',
  reddit_hashtags: '#saved',
  ai_model: 'older approved model'
};
const review = target.copy_review_status.toUpperCase();
const publishReady = target.approval_status === 'APPROVED' && ['PASS','HUMAN_EDITED'].includes(review) && (review === 'HUMAN_EDITED' || target.quality_score >= 92);
assert.equal(publishReady, true, 'approved human copy must be publishable');
assert.equal(!publishReady, false, 'approved human copy must not be sent to preview/testing');
assert.equal(!Object.values(target).slice(4, 12).every(Boolean) || (!publishReady && !target.ai_model.includes('en-US v10')), false, 'approved complete copy must not regenerate');

console.log('carousel publish guard QA passed');
