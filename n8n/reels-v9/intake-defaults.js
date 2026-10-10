const truthy = value => {
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'y', 'on'].includes(String(value ?? '').trim().toLowerCase());
};

const has = value => value !== null && value !== undefined && String(value).trim() !== '';
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

const scheduledAt = row => {
  const date = clean(row.scheduled_date);
  const time = clean(row.scheduled_time);
  if (!date || !time) return null;
  const parsed = DateTime.fromFormat(`${date} ${time}`, 'M/d/yyyy h:mm a', {
    zone: 'America/New_York',
  });
  return parsed.isValid ? parsed : null;
};

const recentCaptions = $input.all()
  .map(item => clean(item.json.instagram_caption_raw || item.json.instagram_caption_final))
  .filter(Boolean)
  .slice(-20);

return $input.all().map(item => {
  const row = { ...item.json };
  const when = scheduledAt(row);
  const status = clean(row.status).toLowerCase();
  const testing = status === 'testing';
  const baseReady = has(row.post_id)
    && has(row.video_url)
    && has(row.reel_description)
    && when !== null;
  const due = baseReady
    && status === 'scheduled'
    && when.toMillis() <= DateTime.now().setZone('America/New_York').toMillis();
  const eligible = testing || due;

  row.location = clean(row.location) || 'Mindo, Ecuador';
  row.media_type = clean(row.media_type) || 'REELS';
  row.input_status = clean(row.input_status) || 'READY';
  const destinationFlags = [row.post_to_instagram, row.post_to_facebook, row.post_on_youtube, row.post_on_tiktok].map(truthy);
  const useProductionDefaults = eligible && !destinationFlags.some(Boolean);
  row.post_to_instagram = useProductionDefaults ? true : destinationFlags[0];
  row.post_to_facebook = useProductionDefaults ? true : destinationFlags[1];
  row.post_on_youtube = useProductionDefaults ? true : destinationFlags[2];
  row.post_on_tiktok = useProductionDefaults ? true : destinationFlags[3];
  row.generate_for_x = has(row.generate_for_x) ? truthy(row.generate_for_x) : true;
  row.post_to_x = has(row.post_to_x) ? truthy(row.post_to_x) : false;

  const prepared = [
    row.featured_birds,
    row.activity_name,
    row.post_type,
    row.blurb,
    row.instagram_caption_final,
    row.instagram_hashtags,
    row.youtube_title,
    row.tiktok_caption,
    row.tiktok_hashtags,
    row.tiktok_additional_hashtags,
  ].every(has);

  const publishApproved = prepared
    && clean(row.approval_status).toUpperCase() === 'APPROVED'
    && Number(row.quality_score || 0) >= 92;
  row.should_generate = eligible && !publishApproved;
  row.should_publish = due;
  row.is_testing = testing;
  row._recent_captions = recentCaptions;
  row._validation_error = baseReady
    ? ''
    : 'Required inputs: video_url, reel_description, scheduled_date, and scheduled_time';

  return { json: row };
});
