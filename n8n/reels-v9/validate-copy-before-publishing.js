function bool(value) {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'y', 'on'].includes(String(value ?? '').trim().toLowerCase());
}
function has(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
const norm = value => String(value ?? '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
const countPhrase = (value, phrase) => norm(value).split(norm(phrase)).length - 1;

const row = { ...$json };
const inputStatus = String(row.input_status || '').trim().toUpperCase();
const approvalStatus = String(row.approval_status || '').trim().toUpperCase();
const qualityScore = Number(row.quality_score || 0);

if (!['READY', 'VERIFIED'].includes(inputStatus)) throw new Error('PUBLISH BLOCKED — input_status must be READY or VERIFIED. No social post was sent.');
if (approvalStatus !== 'APPROVED' || qualityScore < 92) throw new Error(`PUBLISH BLOCKED — copy approval is ${approvalStatus || 'missing'} with quality score ${qualityScore}. No social post was sent.`);
if (/DETERMINISTIC_RECOVERY|DRAFT_ONLY/i.test(String(row.final_copy_source || ''))) throw new Error('PUBLISH BLOCKED — fallback or draft copy requires review. No social post was sent.');

const copyText = [row.instagram_caption_final, row.youtube_title, row.tiktok_caption, row.x_caption].filter(Boolean).join(' ');
const captionBodies = [row.instagram_caption_raw, row.tiktok_caption, row.x_caption, row.youtube_title].filter(Boolean).join(' ');
if (/(^|\s)#[A-Za-z0-9_]+\b/.test(captionBodies)) throw new Error('PUBLISH BLOCKED — a caption or title contains inline hashtags. No social post was sent.');
if (/[\p{Extended_Pictographic}\uFE0F]/u.test(captionBodies)) throw new Error('PUBLISH BLOCKED — a caption or title contains emojis. No social post was sent.');
if (/(?:\.{3,}|…)/.test(captionBodies)) throw new Error('PUBLISH BLOCKED — copy contains an ellipsis or incomplete sentence. No social post was sent.');

const unsupported = [
  /guaranteed? sight/i, /always see/i, /will see/i, /guests? (loved|enjoyed|were thrilled)/i,
  /\brare\b/i, /frequent/i, /abundant/i, /natural habitat/i, /natural rhythm/i,
  /misty trails?/i, /rich (avian )?tapestry/i, /feast for bird/i, /\bmagnificent\b/i,
  /\bstunning\b/i, /\belusive\b/i, /\bamazing\b/i, /breathtaking/i,
  /reliable highlight/i, /quiet magic/i, /this reel shows/i, /the video shows/i,
  /can bring several distinct moments together/i,
  /can unfold in unexpected ways/i,
  /three distinct moments/i,
  /each offering something different to notice/i,
  /which (?:one|moment) would have caught your eye(?: first)?/i,
  /those (?:are|supplied) (?:the )?details that made this experience(?: in [^.]+)? worth sharing/i,
  /every outing develops from the moments that are actually present/i,
  /this was the clear focus here/i, /supplied details are the focus/i,
  /the account stays with the moment as described/i,
  /adding a splash of color/i, /turn(?:s|ing)? (?:a|the|this) [^.]+ into a memorable adventure/i,
  /\bshowdown\b/i,
  /\b(?:one|a|an|each)\s+(?:birdwatching|birding)\b/i,
];
if (unsupported.some(pattern => pattern.test(copyText))) throw new Error('PUBLISH BLOCKED — copy contains unsupported, generic, or unnatural template wording. No social post was sent.');
if (/^(?:birdwatching|birding|tour|nature|reel|mindo)$/i.test(String(row.youtube_title || '').trim())) throw new Error('PUBLISH BLOCKED — the YouTube title is too generic. No social post was sent.');

const location = String(row.location || 'Mindo, Ecuador').trim();
for (const value of [row.instagram_caption_raw, row.tiktok_caption, row.x_caption]) {
  if (has(value) && countPhrase(value, location) > 1) throw new Error('PUBLISH BLOCKED — a platform caption repeats the full location. No social post was sent.');
}
const source = norm(String(row.reel_description || '').replace(/(?:\.{3,}|…)+/g, '.'));
if (source.split(/\s+/).length >= 12 && norm(row.instagram_caption_raw).includes(source)) throw new Error('PUBLISH BLOCKED — the Instagram caption copies the intake description verbatim. No social post was sent.');

const missing = [];
if ((bool(row.post_to_instagram) || bool(row.post_to_facebook)) && !has(row.instagram_caption_final)) missing.push('instagram_caption_final');
if ((bool(row.post_to_instagram) || bool(row.post_to_facebook)) && !has(row.instagram_hashtags)) missing.push('instagram_hashtags');
if (bool(row.post_on_youtube) && !has(row.youtube_title)) missing.push('youtube_title');
if (bool(row.post_on_tiktok) && !has(row.tiktok_caption)) missing.push('tiktok_caption');
if (bool(row.post_on_tiktok) && !has(row.tiktok_hashtags)) missing.push('tiktok_hashtags');
if (bool(row.post_on_tiktok) && !has(row.tiktok_additional_hashtags)) missing.push('tiktok_additional_hashtags');
if (missing.length) throw new Error(`PUBLISH BLOCKED — missing required copy: ${missing.join(', ')}. No social post was sent.`);

const alreadyPublished = [];
if (bool(row.post_to_instagram) && (has(row.instagram_post_id) || has(row.instagram_published_date))) alreadyPublished.push('Instagram');
if (bool(row.post_to_facebook) && (has(row.facebook_post_id) || has(row.facebook_published_date))) alreadyPublished.push('Facebook');
if (bool(row.post_on_youtube) && (has(row.youtube_post_id) || has(row.youtube_published_date) || has(row.youtube_url))) alreadyPublished.push('YouTube');
if (bool(row.post_on_tiktok) && (has(row.tiktok_post_id) || has(row.tiktok_published_date))) alreadyPublished.push('TikTok');
if (alreadyPublished.length) throw new Error(`PUBLISH BLOCKED — existing publication data found for ${alreadyPublished.join(', ')}. Automatic reposting is disabled.`);

const instagramTags = String(row.instagram_hashtags || '').split(/\s+/).filter(Boolean);
if (instagramTags.length !== 5) throw new Error(`PUBLISH BLOCKED — Instagram requires exactly five hashtags; received ${instagramTags.length}.`);

row._copy_validated_for_publish = true;
return [{ json: row }];
