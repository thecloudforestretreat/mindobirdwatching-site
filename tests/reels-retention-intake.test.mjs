import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../admin/media/reels/index.html', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../admin/assets/js/reels-studio.js', import.meta.url), 'utf8');
const prompt = readFileSync(new URL('../n8n/reels-v9/build-local-creative-request.js', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../functions/api/admin/reels/index.js', import.meta.url), 'utf8');

assert.match(html, /data-field="opening_action_0_3"[^>]*[\s\S]*?required/);
assert.match(html, /visible action should still work with sound muted/);
assert.match(html, /reels-studio\.js\?v=21/);
assert.equal((ui.match(/type="checkbox" data-creative-check/g) || []).length, 2);
assert.match(ui, /Music over muted footage is a valid default/);
assert.match(ui, /Complete both opening and retention checks/);
assert.match(prompt, /original camera audio is normally muted and replaced with a music soundtrack/);
assert.match(prompt, /Do not claim that a bird call, wing sound, river sound, or other natural audio can be heard/);

const { onRequestPost } = await import('data:text/javascript;base64,' + Buffer.from(apiSource).toString('base64'));
const mediaUrl = 'https://n8n.mindobirdwatching.com/media-delivery/v1/' + 'a'.repeat(32) + '/original.mp4';
const payload = {
  action: 'create_batch',
  mode: 'review',
  timezone: 'America/New_York',
  reels: [{
    video_url: mediaUrl,
    reel_description: 'A Torrent Duck swims through the rapids in Mindo, Ecuador.',
    opening_action_0_3: 'The duck is already swimming against the rapids as the camera moves closer.',
    scheduled_date: '2099-01-01',
    scheduled_time: '07:00',
    post_to_instagram: true
  }]
};
const makeRequest = (body) => new Request('https://admin.mindobirdwatching.com/api/admin/reels', {
  method: 'POST',
  headers: { origin: 'https://admin.mindobirdwatching.com', 'content-type': 'application/json' },
  body: JSON.stringify(body)
});
const originalFetch = globalThis.fetch;
try {
  let forwarded;
  globalThis.fetch = async (_url, options) => { forwarded = JSON.parse(options.body); return Response.json({ ok: true }); };
  const accepted = await onRequestPost({ request: makeRequest(payload), env: { N8N_ADMIN_REELS_WEBHOOK_URL: 'https://example.test/reels' } });
  assert.equal(accepted.status, 200);
  assert.equal(forwarded.reels[0].verified_details, 'Opening 0–3 seconds: The duck is already swimming against the rapids as the camera moves closer.');

  const missing = structuredClone(payload);
  delete missing.reels[0].opening_action_0_3;
  const rejected = await onRequestPost({ request: makeRequest(missing), env: { N8N_ADMIN_REELS_WEBHOOK_URL: 'https://example.test/reels' } });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).message, /visible action during the first 0–3 seconds/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('PASS: opening-action intake, music-first guidance, grounded copy context and approval checks.');
