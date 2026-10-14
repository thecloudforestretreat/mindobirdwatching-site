function bool(value) {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'y', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function has(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

const row = { ...$json };
const definitions = [
  { platform: 'instagram', flag: 'post_to_instagram', id: 'instagram_post_id' },
  { platform: 'facebook', flag: 'post_to_facebook', id: 'facebook_post_id' },
  { platform: 'youtube', flag: 'post_on_youtube', id: 'youtube_post_id' },
];

const now = new Date().toISOString();
const nonce = Math.random().toString(36).slice(2, 12);
const claimRoot = `reel:${String(row.reel_id || row.post_id || 'unknown')}:${Date.now()}:${nonce}`;
const claimed = [];
const completed = [];
const blocked = [];

for (const definition of definitions) {
  const { platform, flag, id } = definition;
  if (!bool(row[flag])) continue;

  const stateKey = `${platform}_publish_state`;
  const claimKey = `${platform}_publish_claim_id`;
  const claimedAtKey = `${platform}_publish_claimed_at`;
  const errorKey = `${platform}_publish_error`;
  const state = String(row[stateKey] || '').trim().toUpperCase();

  if (has(row[id]) || state === 'PUBLISHED') {
    row[flag] = false;
    row[stateKey] = 'PUBLISHED';
    completed.push(platform);
    continue;
  }

  // An old claim without a durable platform ID is ambiguous. The API call may
  // have succeeded before bookkeeping failed, so an automatic retry is unsafe.
  if (has(row[claimKey]) || ['CLAIMED', 'PUBLISHING', 'UNKNOWN', 'RECONCILE'].includes(state)) {
    row[flag] = false;
    row[stateKey] = 'RECONCILE';
    blocked.push(platform);
    continue;
  }

  row[stateKey] = 'CLAIMED';
  row[claimKey] = `${claimRoot}:${platform}`;
  row[claimedAtKey] = now;
  row[errorKey] = '';
  claimed.push(platform);
}

row._new_publish_claims = claimed;
row._completed_publish_platforms = completed;
row._reconciliation_required = blocked;

if (blocked.length) {
  row.status = 'Needs Attention';
  row.error_message = `PUBLISH BLOCKED — reconcile ${blocked.join(', ')} before retrying. No duplicate post was sent.`;
  throw new Error(row.error_message);
}
if (!claimed.length) {
  throw new Error(`PUBLISH SKIPPED — no unclaimed destinations remain (${completed.join(', ') || 'none'}). No duplicate post was sent.`);
}

// Keep Scheduled until each destination branch has evaluated the claimed row.
row.error_message = '';
return { json: row };
