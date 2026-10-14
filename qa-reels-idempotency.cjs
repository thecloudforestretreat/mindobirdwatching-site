const assert = require('node:assert');
const fs = require('node:fs');

const claim = new Function('$json', fs.readFileSync('n8n/reels-v9/publish-claim.js', 'utf8'));
const finalize = new Function('$json', fs.readFileSync('n8n/reels-v9/finalize-publish.js', 'utf8'));
const base = {
  post_id: 500,
  reel_id: 'qa-idempotency',
  status: 'Scheduled',
  post_to_instagram: true,
  post_to_facebook: true,
  post_on_youtube: true,
  post_on_tiktok: true,
};

const first = claim(base).json;
assert.equal(first.status, 'Scheduled', 'Claims must not break destination routing');
assert.deepEqual(first._new_publish_claims, ['instagram', 'facebook', 'youtube']);
assert.ok(!first.tiktok_publish_claim_id, 'TikTok must remain copy-only');
assert.throws(() => claim(first), /reconcile.*No duplicate post was sent/i);

const partial = {
  ...first,
  instagram_post_id: 'ig_123', instagram_publish_state: 'PUBLISHED',
  facebook_post_id: 'fb_123', facebook_publish_state: 'PUBLISHED',
  youtube_post_id: '', youtube_publish_state: 'CLAIMED',
};
assert.throws(() => claim(partial), /youtube/i, 'Ambiguous YouTube must not retry');

const complete = finalize({
  ...first,
  instagram_post_id: 'ig_123', instagram_publish_state: 'PUBLISHED',
  facebook_post_id: 'fb_123', facebook_publish_state: 'PUBLISHED',
  youtube_post_id: 'yt_123', youtube_publish_state: 'PUBLISHED',
  tiktok_publish_state: 'CLAIMED', tiktok_publish_claim_id: 'legacy:tiktok',
}).json;
assert.equal(complete.status, 'Published');
assert.equal(complete.tiktok_publish_state, '');
assert.equal(complete.tiktok_publish_claim_id, '');

const ambiguous = finalize(partial).json;
assert.equal(ambiguous.status, 'Needs Attention');
assert.equal(ambiguous.youtube_publish_state, 'RECONCILE');

console.log(JSON.stringify({
  ok: true,
  scenarios: ['claim before upload', 'duplicate retry blocked', 'partial retry blocked', 'complete finalization', 'TikTok copy-only cleanup'],
  externalPostsSent: false,
}, null, 2));
