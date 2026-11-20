const body = $('Admin Reels Webhook').first().json.body || {};
const rows = $input.all().map(item => ({ ...item.json }));
const action = String(body.action || '').trim();
const clean = value => String(value ?? '').trim();
const truthy = value => value === true || ['true','1','yes','on'].includes(clean(value).toLowerCase());
const words = value => clean(value).split(/\s+/).filter(Boolean).length;
const forbiddenCopy = /\b(this reel shows|the video shows|imagine|step into|hidden paradise|nature['’]s symphony|mist-kissed|living tapestry|feathered wonders|where time slows down|whether you(?:'re| are)|something for everyone|perfect blend|immerse yourself|embark on|adventure awaits|discover the magic|unforgettable (?:journey|adventure|experience)|set(?:s|ting)? the scene|rich avian diversity|add(?:s|ed|ing)? (?:a )?splash of colou?r|striking species|vivid encounters?|showcas(?:e|es|ed|ing)|witness[^.!?]{0,60}up close)\b/i;
const find = () => rows.find(row => (clean(body.reel_id) && clean(row.reel_id) === clean(body.reel_id)) || (clean(body.post_id) && clean(row.post_id) === clean(body.post_id)));
const response = (ok, message, extra = {}) => [{ json: { _route: 'respond', ok, message, ...extra } }];
const toSheetDate = value => {
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return DateTime.fromISO(text, { zone: 'America/New_York' }).toFormat('M/d/yyyy');
  return text;
};
const toSheetTime = value => {
  const text = clean(value);
  if (/^\d{2}:\d{2}$/.test(text)) return DateTime.fromFormat(text, 'HH:mm', { zone: 'America/New_York' }).toFormat('h:mm a');
  return text;
};
const scheduledAt = source => DateTime.fromFormat(clean(source.scheduled_date) + ' ' + clean(source.scheduled_time), 'M/d/yyyy h:mm a', { zone: 'America/New_York' });
const scheduleIsFuture = source => { const when = scheduledAt(source); return when.isValid && when.toMillis() > DateTime.now().setZone('America/New_York').toMillis(); };
const sheetFields = ["post_id","video_url","reel_description","featured_birds","activity_name","location","verified_details","input_status","post_type","scheduled_date","scheduled_time","status","media_type","error_message","local_blurb","local_validation_status","local_validation_flags","local_generated_at","local_model","copy_review_status","draft_model","draft_generated_at","supervision_status","supervision_notes","final_copy_source","quality_score","approval_status","approval_timestamp","posting_defaults_applied_at","blurb","post_to_instagram","instagram_caption_raw","instagram_caption_final","instagram_hashtags","instagram_published_date","instagram_post_id","post_to_facebook","facebook_published_date","facebook_post_id","post_on_youtube","youtube_title","youtube_published_date","youtube_post_id","post_on_tiktok","tiktok_caption","tiktok_hashtags","tiktok_additional_hashtags","tiktok_published_date","tiktok_post_id","telegram_sent_date","generate_for_x","x_caption","x_hashtags","x_post_final","x_published_date","x_post_id","post_to_x","youtube_url","reel_id","submitted_at","source","timezone","admin_mode","_route","_trigger_main","instagram_publish_state","instagram_publish_claim_id","instagram_publish_claimed_at","instagram_publish_error","facebook_publish_state","facebook_publish_claim_id","facebook_publish_claimed_at","facebook_publish_error","youtube_publish_state","youtube_publish_claim_id","youtube_publish_claimed_at","youtube_publish_error","tiktok_publish_state","tiktok_publish_claim_id","tiktok_publish_claimed_at","tiktok_publish_error"];
const normalizedRow = source => Object.fromEntries(sheetFields.map(field => [field, source[field] ?? '']));
const applyEdits = (row, edits) => {
  for (const [key,value] of Object.entries(edits && typeof edits === 'object' ? edits : {})) {
    if (!sheetFields.includes(key)) continue;
    row[key] = key === 'scheduled_date' ? toSheetDate(value) : key === 'scheduled_time' ? toSheetTime(value) : clean(value);
  }
};

if (action === 'health') return [{ json: { _route: 'health', checked_at: new Date().toISOString() } }];

if (action === 'list_reels') {
  const query = clean(body.query).toLowerCase();
  // The sheet contains future schedule placeholders. They are not actionable
  // reels until a source video has been assigned, so keep them out of the
  // Studio queue and its review counts.
  let filtered = rows.filter(row => clean(row.video_url) || clean(row.reel_description));
  if (query) filtered = filtered.filter(row => [row.post_id,row.reel_id,row.reel_description,row.activity_name,row.status,row.youtube_title].join(' ').toLowerCase().includes(query));
  const limit = Math.min(250, Math.max(1, Number(body.limit) || 150));
  filtered.sort((a,b) => Number(b.post_id || 0) - Number(a.post_id || 0));
  return response(true, '', { reels: filtered.slice(0, limit), count: Math.min(filtered.length, limit) });
}

if (action === 'create_batch') {
  const incoming = Array.isArray(body.reels) ? body.reels : [];
  if (!incoming.length || incoming.length > 20) return response(false, 'Submit between 1 and 20 reels.');
  const existingUrls = new Set(rows.map(row => clean(row.video_url)).filter(Boolean));
  const incomingUrls = incoming.map(row => clean(row.video_url));
  if (incomingUrls.some(url => existingUrls.has(url))) return response(false, 'One or more video URLs already exist in ai_reels.');
  if (new Set(incomingUrls).size !== incomingUrls.length) return response(false, 'Video URLs must be unique within the batch.');
  const maxId = rows.reduce((max,row) => Math.max(max, Number(row.post_id) || 0), 0);
  const auto = clean(body.mode).toLowerCase() === 'auto';
  return incoming.map((input,index) => {
    const row = normalizedRow({
      ...input,
      post_id: String(maxId + index + 1),
      reel_id: clean(input.reel_id) || ('reel_' + crypto.randomUUID()),
      submitted_at: clean(input.submitted_at) || new Date().toISOString(),
      source: 'admin_reels_studio',
      timezone: clean(input.timezone) || clean(body.timezone) || 'America/New_York',
      admin_mode: auto ? 'auto' : 'review',
      scheduled_date: toSheetDate(input.scheduled_date),
      scheduled_time: toSheetTime(input.scheduled_time),
      status: 'Testing',
      input_status: auto ? 'VERIFIED' : 'READY',
      media_type: 'REELS',
      location: clean(input.location) || 'Mindo, Ecuador',
      post_to_instagram: truthy(input.post_to_instagram),
      post_to_facebook: truthy(input.post_to_facebook),
      post_on_youtube: truthy(input.post_on_youtube),
      post_on_tiktok: truthy(input.post_on_tiktok),
      generate_for_x: true,
      post_to_x: false,
      approval_status: 'NEEDS_REVIEW',
      quality_score: 0,
    });
    return { json: { ...row, _route: 'append', _trigger_main: true } };
  });
}

const existing = find();
if (!existing) return response(false, 'The requested reel was not found.');
const row = normalizedRow(existing);

if (action === 'replace_media') {
  const videoUrl = clean(body.video_url);
  if (!(/^https:\/\/n8n\.mindobirdwatching\.com\/media-delivery\/v1\/[a-f0-9]{32}\/original\.mp4$/.test(videoUrl) || /^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/.+\.(?:mp4|mov|m4v)(?:[?#].*)?$/i.test(videoUrl))) return response(false, 'Enter a supported HTTPS video delivery URL.');
  const started = ['instagram','facebook','youtube'].some(platform => clean(row[platform + '_post_id']) || clean(row[platform + '_publish_claim_id']) || ['CLAIMED','PUBLISHING','UNKNOWN','RECONCILE','PUBLISHED'].includes(clean(row[platform + '_publish_state']).toUpperCase()));
  if (started) return response(false, 'The video cannot be replaced because publishing has already started.');
  if (rows.some(candidate => clean(candidate.video_url) === videoUrl && clean(candidate.post_id) !== clean(row.post_id))) return response(false, 'That video URL is already assigned to another reel.');
  row.video_url = videoUrl;
  Object.assign(row, {status:'Needs Review', approval_status:'NEEDS_REVIEW', approval_timestamp:'', supervision_status:'NEEDS_REVIEW', supervision_notes:'Replacement video uploaded. Review the new footage before approving.', error_message:''});
  return [{ json: { ...row, _route: 'update_only' } }];
}

if (action === 'update_reel') {
  const edits = body.edits && typeof body.edits === 'object' ? body.edits : {};
  applyEdits(row, edits);
  if (clean(edits.video_url) && rows.some(candidate => clean(candidate.video_url) === clean(edits.video_url) && clean(candidate.post_id) !== clean(row.post_id))) return response(false, 'That video URL is already assigned to another reel.');
  if (!scheduleIsFuture(row)) return response(false, 'Choose a future Eastern date and time.');
  // Editing a future item does not need to start the main publisher. Keeping
  // this on the update-only path prevents an admin save from overlapping the
  // hourly scheduler and creating two publication attempts.
  return [{ json: { ...row, _route: 'update_only' } }];
}

if (action === 'approve_reel') {
  // Approval is atomic: persist the exact fields visible in Studio and validate
  // those values in the same request. This prevents approving stale Sheet copy.
  applyEdits(row, body.edits);
  const errors = [];
  if (clean(body.edits?.video_url) && rows.some(candidate => clean(candidate.video_url) === clean(body.edits.video_url) && clean(candidate.post_id) !== clean(row.post_id))) errors.push('That video URL is already assigned to another reel.');
  const selected = [truthy(row.post_to_instagram),truthy(row.post_to_facebook),truthy(row.post_on_youtube),truthy(row.post_on_tiktok)];
  if (!selected.slice(0, 3).some(Boolean)) errors.push('Select Instagram, Facebook, or YouTube for automated publishing. TikTok currently generates copy only.');
  if ((selected[0] || selected[1])) {
    const tags = clean(row.instagram_hashtags).split(/\s+/).filter(Boolean);
    const bodyText = clean(row.instagram_caption_final).split(/\n\s*\n(?=#)/)[0];
    if (!bodyText) errors.push('Instagram/Facebook caption is required.');
    if (words(bodyText) < 35 || words(bodyText) > 100) errors.push('Instagram/Facebook caption must contain 35–100 words.');
    if (tags.length !== 5 || tags.some(tag => !/^#[A-Za-z0-9_]+$/.test(tag))) errors.push('Instagram requires exactly five valid hashtags.');
    row.instagram_caption_raw = bodyText;
    row.instagram_caption_final = bodyText + '\n\n' + tags.join(' ');
  }
  if (selected[2] && (!clean(row.youtube_title) || clean(row.youtube_title).length > 100)) errors.push('YouTube title must contain 1–100 characters.');
  if (selected[3]) {
    const count = words(row.tiktok_caption);
    if (count < 8 || count > 45) errors.push('TikTok caption must contain 8–45 words.');
    if (!clean(row.tiktok_hashtags) || !clean(row.tiktok_additional_hashtags)) errors.push('TikTok hashtags are required.');
  }
  const proseAndTitle = [row.instagram_caption_raw,row.youtube_title,row.tiktok_caption,truthy(row.post_to_x) ? row.x_caption : ''].filter(Boolean).join(' ');
  if (/(^|\s)#[A-Za-z0-9_]+\b/.test(proseAndTitle)) errors.push('Captions and titles cannot contain inline hashtags.');
  if (/[\p{Extended_Pictographic}\uFE0F]/u.test(proseAndTitle)) errors.push('Captions and titles cannot contain emojis.');
  if (/(?:\.{3,}|…)/.test(proseAndTitle)) errors.push('Captions and titles cannot contain ellipses. Use complete wording before approval.');
  if (forbiddenCopy.test(proseAndTitle)) errors.push('Copy contains stock AI or travel-brochure wording. Rewrite it in a natural guide voice before approval.');
  if (!clean(row.video_url)) errors.push('A video delivery URL is required.');
  if (!scheduleIsFuture(row)) errors.push('Choose a future Eastern date and time.');
  if (errors.length) return response(false, errors.join(' '));
  const now = new Date().toISOString();
  Object.assign(row, {
    status: 'Scheduled', input_status: 'VERIFIED', error_message: '', quality_score: 100,
    approval_status: 'APPROVED', approval_timestamp: now, copy_review_status: 'FINAL',
    supervision_status: 'APPROVED', supervision_notes: 'Human-reviewed in Reels Studio.',
    local_validation_status: 'PASS', local_validation_flags: '', final_copy_source: 'HUMAN_REVIEWED',
  });
  // Approval only changes durable queue state. The hourly scheduler owns the
  // publication attempt, so approval must not create a competing execution.
  return [{ json: { ...row, _route: 'update_only' } }];
}

if (action === 'regenerate_reel') {
  if ([row.instagram_post_id,row.facebook_post_id,row.youtube_post_id,row.tiktok_post_id].some(value => clean(value))) return response(false, 'Published or partially published reels cannot be regenerated. Use retry for missing platforms.');
  const claimed = ['instagram','facebook','youtube','tiktok'].filter(platform => clean(row[platform + '_publish_claim_id']) || ['CLAIMED','PUBLISHING','UNKNOWN','RECONCILE'].includes(clean(row[platform + '_publish_state']).toUpperCase()));
  if (claimed.length) return response(false, 'Regeneration is blocked while platform publication needs reconciliation: ' + claimed.join(', ') + '.');
  for (const field of ['featured_birds','activity_name','verified_details','local_blurb','local_validation_status','local_validation_flags','local_generated_at','local_model','copy_review_status','draft_model','draft_generated_at','supervision_status','supervision_notes','final_copy_source','approval_timestamp','posting_defaults_applied_at','blurb','instagram_caption_raw','instagram_caption_final','instagram_hashtags','youtube_title','tiktok_caption','tiktok_hashtags','tiktok_additional_hashtags','x_caption','x_hashtags','x_post_final']) row[field] = '';
  Object.assign(row, { status: 'Testing', error_message: '', quality_score: 0, approval_status: 'NEEDS_REVIEW', input_status: clean(row.admin_mode).toLowerCase() === 'auto' ? 'VERIFIED' : 'READY' });
  return [{ json: { ...row, _route: 'update_trigger' } }];
}

if (action === 'publish_overdue') {
  if (clean(row.approval_status).toUpperCase() !== 'APPROVED' || Number(row.quality_score || 0) < 92 || clean(row.copy_review_status).toUpperCase() !== 'FINAL') return response(false, 'This reel must have final approved copy with a quality score of at least 92 before recovery.');
  const when = scheduledAt(row);
  if (!when.isValid || when.toMillis() > DateTime.now().setZone('America/New_York').toMillis()) return response(false, 'This reel is not overdue. Keep its future schedule instead.');
  const automated = [
    ['instagram','post_to_instagram'],
    ['facebook','post_to_facebook'],
    ['youtube','post_on_youtube'],
  ];
  const ambiguous = automated.filter(([platform,flag]) => truthy(row[flag]) && !clean(row[platform + '_post_id']) && (clean(row[platform + '_publish_claim_id']) || ['CLAIMED','PUBLISHING','UNKNOWN','RECONCILE'].includes(clean(row[platform + '_publish_state']).toUpperCase()))).map(([platform]) => platform);
  if (ambiguous.length) return response(false, 'Recovery is blocked to prevent duplicates. Verify these platforms first: ' + ambiguous.join(', ') + '.');
  const missing = automated.filter(([platform,flag]) => truthy(row[flag]) && !clean(row[platform + '_post_id'])).map(([platform]) => platform);
  if (!missing.length) return response(false, 'Every automated destination already has a saved platform ID.');
  row.post_to_instagram = missing.includes('instagram');
  row.post_to_facebook = missing.includes('facebook');
  row.post_on_youtube = missing.includes('youtube');
  row.status = 'Scheduled';
  row.error_message = '';
  return [{ json: { ...row, _route: 'update_trigger', recovery_requested_at: new Date().toISOString() } }];
}

if (action === 'retry_reel') {
  if (clean(row.approval_status).toUpperCase() !== 'APPROVED' || Number(row.quality_score || 0) < 92) return response(false, 'Copy must be approved with a quality score of at least 92 before retrying publication.');
  const ambiguous = ['instagram','facebook','youtube','tiktok'].filter(platform => {
    const state = clean(row[platform + '_publish_state']).toUpperCase();
    return !clean(row[platform + '_post_id']) && (clean(row[platform + '_publish_claim_id']) || ['CLAIMED','PUBLISHING','UNKNOWN','RECONCILE'].includes(state));
  });
  if (ambiguous.length) return response(false, 'Automatic retry blocked to prevent duplicates. Verify these platforms first: ' + ambiguous.join(', ') + '.');
  const retryInstagram = truthy(row.post_to_instagram) && !clean(row.instagram_post_id);
  const retryFacebook = truthy(row.post_to_facebook) && !clean(row.facebook_post_id);
  const retryYoutube = truthy(row.post_on_youtube) && !clean(row.youtube_post_id);
  if (![retryInstagram,retryFacebook,retryYoutube].some(Boolean)) return response(false, 'No missing automated platform is available to retry.');
  Object.assign(row, { status: 'Scheduled', error_message: '', post_to_instagram: retryInstagram, post_to_facebook: retryFacebook, post_on_youtube: retryYoutube });
  // Retry is queued for the next hourly scheduler pass. There is only one
  // publication owner, which removes the manual-trigger/scheduler race that
  // previously produced duplicate platform posts.
  return [{ json: { ...row, _route: 'update_only' } }];
}

return response(false, 'Unsupported gateway action.');