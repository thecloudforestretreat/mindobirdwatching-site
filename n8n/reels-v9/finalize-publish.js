function bool(value) {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'y', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

function has(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

const row = { ...$json };
const definitions = [
  { platform: 'instagram', flag: 'post_to_instagram', id: 'instagram_post_id', date: 'instagram_published_date' },
  { platform: 'facebook', flag: 'post_to_facebook', id: 'facebook_post_id', date: 'facebook_published_date' },
  { platform: 'youtube', flag: 'post_on_youtube', id: 'youtube_post_id', date: 'youtube_published_date' },
];

const unresolved = [];
for (const definition of definitions) {
  const { platform, flag, id, date } = definition;
  if (!bool(row[flag])) continue;
  const stateKey = `${platform}_publish_state`;
  if (has(row[id]) || has(row[date]) || String(row[stateKey] || '').trim().toUpperCase() === 'PUBLISHED') {
    row[stateKey] = 'PUBLISHED';
    row[`${platform}_publish_error`] = '';
  } else {
    row[stateKey] = 'RECONCILE';
    unresolved.push(platform);
  }
}

// TikTok is copy-only until an uploader exists. Legacy claims must not keep
// Instagram, Facebook, and YouTube from reaching a complete state.
if (!has(row.tiktok_post_id) && !has(row.tiktok_published_date)) {
  row.tiktok_publish_state = '';
  row.tiktok_publish_claim_id = '';
  row.tiktok_publish_claimed_at = '';
  row.tiktok_publish_error = '';
}

if (unresolved.length) {
  row.status = 'Needs Attention';
  row.error_message = `Publication outcome needs reconciliation for: ${unresolved.join(', ')}. Automatic retries are disabled to prevent duplicate posts.`;
} else {
  row.status = 'Published';
  row.error_message = '';
}

return { json: row };
