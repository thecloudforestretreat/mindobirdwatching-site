const base = $('[V2] Build Targeted Repair').item.json || {};
const clean = value => String(value ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
const norm = value => clean(value).normalize('NFKD').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\p{Diacritic}/gu, '').toLowerCase();
const words = value => clean(value).split(/\s+/).filter(Boolean).length;
const caption = value => clean(value).replace(/(^|\s)#[A-Za-z0-9_]+\b/g, ' ').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim();
const tag = value => { const v = clean(value).replace(/^#+/, '').replace(/[^A-Za-z0-9_]/g, ''); return v ? `#${v}` : ''; };
const unique = values => [...new Map(values.filter(Boolean).map(value => [value.toLowerCase(), value])).values()];
const startsUpper = value => /^["'“‘(]*[A-Z0-9]/.test(clean(value));
const sourceWords = clean(base.reel_description).split(/\s+/).filter(Boolean).length;

let review = {};
let parseError = '';
const transportMessage = clean(
  $json?.error?.message
  || $json?.error
  || $json?.message?.error
  || $json?.cause?.message
  || ''
).slice(0, 180);
try {
  const raw = $json?.message?.content ?? $json?.response ?? $json?.content ?? '';
  if (!raw && transportMessage) throw new Error(transportMessage);
  review = typeof raw === 'object' && raw !== null ? raw : JSON.parse(String(raw));
} catch (error) {
  parseError = transportMessage
    ? `mac_mini_editor_unavailable:${transportMessage}`
    : `editor_json_parse_failed:${error.message}`;
}

const genericActivities = new Set(['tour','tours','birding','birdwatching','activity']);
let activity = clean(review.activity_name) || clean(base.activity_name) || 'Birdwatching Tour';
if (genericActivities.has(activity.toLowerCase())) activity = 'Birdwatching Tour';
const blurb = caption(review.blurb);
const ig = caption(review.instagram_caption);
const yt = caption(review.youtube_title).replace(/[.!?]+$/, '');
const tt = caption(review.tiktok_caption);
const xx = caption(review.x_caption).slice(0, 240).trim();
const core = ['#mindobirdwatching','#mindo','#ecuador'];
const contextual = unique((Array.isArray(review.instagram_primary_hashtags) ? review.instagram_primary_hashtags : []).map(tag).filter(v => v && !core.includes(v.toLowerCase()) && !v.toLowerCase().includes('mindobirdwatching')));
const ttContextual = unique((Array.isArray(review.tiktok_primary_hashtags) ? review.tiktok_primary_hashtags : []).map(tag).filter(v => v && !core.includes(v.toLowerCase()) && !v.toLowerCase().includes('mindobirdwatching')));
const additional = unique((Array.isArray(review.tiktok_additional_hashtags) ? review.tiktok_additional_hashtags : []).map(tag).filter(v => v && !core.includes(v.toLowerCase())));
const xTags = unique((Array.isArray(review.x_hashtags) ? review.x_hashtags : []).map(tag)).slice(0, 2);
const instagramHashtags = [...core, ...contextual.slice(0, 2)].join(' ');
const tiktokHashtags = [...core, ...ttContextual.slice(0, 2)].join(' ');
const birds = unique((Array.isArray(review.featured_birds) ? review.featured_birds : clean(base.featured_birds).split(/[|,;]/)).map(clean).filter(Boolean));
const location = clean(base.location) || 'Mindo, Ecuador';
const authoritativeBirdInput = Object.prototype.hasOwnProperty.call(base, '_input_featured_birds')
  ? base._input_featured_birds
  : base.featured_birds;
const detectedBirdAuthority = Array.isArray(base._source_birds_detected) ? base._source_birds_detected.join(' ') : '';
const sourceAuthority = [base.reel_description, authoritativeBirdInput, detectedBirdAuthority, location, base.verified_details].join(' ');
const destinationAuthority = /\bmindo\b/i.test(location)
  ? 'Mindo Ecuador Andean Choco cloud forest habitat habitats mist misty humidity humid rain rainfall rainy weather'
  : '';
const authority = norm([sourceAuthority, destinationAuthority].join(' '));
const intakeAuthority = norm(sourceAuthority);
const combined = [blurb, ig, yt, tt, xx].join(' ');
const sourceRequestsAction = /\b(new|launch|introduc(?:e|ing)|offer(?:ing)?|book(?:ing)?|reserve|availability|message us|plan (?:a|your)|tour package)\b/i.test(sourceAuthority);
const formulaicPatterns = [
  /\bthis (?:reel|video|post) (?:shows|follows)\b/i,
  /^during this outing\b/i,
  /\bbrings? [^.]{0,80} into view\b/i,
  /\bin (?:its|their) own way\b/i,
  /\bjust long enough\b/i,
  /\bone of the best chances\b/i,
  /\bwhat makes (?:this|it) special\b/i,
  /\ba reminder that\b/i,
  /\bwhich (?:one|bird|moment) (?:would have )?(?:caught|catches) your (?:eye|attention)(?: first)?\b/i,
  /\bwhat would you notice first\b/i,
  /\btwo [^.!?]{1,36}, two [^.!?]{1,36}\b/i,
  /\b(?:every|each) (?:outing|experience) (?:is|feels|brings|develops)\b/i,
  /\b(?:at|in) the (?:center|heart) of (?:the|this) (?:story|outing|experience)\b/i,
  /^mindo(?:'s|’s)? [^.]{0,32} brought\b/i,
  /\bthe mix of species (?:shows|reflects)\b/i,
  /\b(one|two|three|four|five|six|seven|eight|nine|ten) [^.!?,]{1,28}, \1 [^.!?]{1,28}/i,
  /\b(?:mindo(?:'s|’s)? )?cloud forest deliver(?:s|ed)\b/i,
  /\bwere observed\b/i,
  /\breliable (?:morning )?birding\b/i,
];
const unsupportedTerms = ['moonlit','moonlight','lantern','canopy','plumage','elusive','rare','mist','misty','rain','rainfall','weather','habitat','nest','feeding','river','rapids','current','dawn','sunrise','glow','rainforest','cloud forest'];
const flags = [];
if (parseError) flags.push(parseError);
if (clean(review.review_verdict).toUpperCase() !== 'PASS') flags.push('editor_verdict_not_pass');
if (!blurb || !ig || !yt || !tt || !xx) flags.push('editor_missing_required_copy');
for (const [name,value] of [['blurb',blurb],['instagram',ig],['youtube_title',yt],['tiktok',tt],['x',xx]]) if (value && !startsUpper(value)) flags.push(`${name}_must_start_uppercase`);
if (/\b(seening|seing|recieve|thier|alot)\b/i.test(combined)) flags.push('obvious_spelling_error');
if (/\bduring\s+(a\s+)?tour\b/i.test(yt)) flags.push('youtube_title_grammar');
if (genericActivities.has(activity.toLowerCase())) flags.push('generic_activity_name');
if (/never follows a fixed script/i.test(combined)) flags.push('repetitive_boilerplate');
if (/\b(whether you(?:'re| are)|something for everyone|perfect blend|immerse yourself|embark on|adventure awaits|discover the magic|unforgettable (?:journey|adventure|experience)|made for a memorable|set(?:s|ting)? the scene|rich avian diversity|add(?:s|ed|ing)? (?:a )?splash of colou?r|striking species|vivid encounters?|showcas(?:e|es|ed|ing)|witness[^.!?]{0,60}up close)\b/i.test(combined)) flags.push('ai_style_brochure_language');
if (formulaicPatterns.some(pattern => pattern.test(ig))) flags.push('formulaic_caption_voice');
if (/\b(book|reserve|message us|join us|plan your|contact us|send us a message)\b/i.test(ig) && !sourceRequestsAction) flags.push('unsolicited_sales_cta');
if (/…|\.\.\./.test([ig,yt,tt,xx].join(' '))) flags.push('ellipsis_or_incomplete_copy');
if (words(ig) < 35 || words(ig) > 100) flags.push('instagram_length_outside_35_100');
if (words(tt) < 8 || words(tt) > 45) flags.push('tiktok_length_outside_8_45');
if (yt.length < 1 || yt.length > 100) flags.push('youtube_title_length');
if (contextual.length !== 2) flags.push('instagram_contextual_hashtags_not_2');
if (ttContextual.length !== 2) flags.push('tiktok_contextual_hashtags_not_2');
if (additional.length < 5 || additional.length > 10) flags.push('additional_hashtags_outside_5_10');
const rawCaptions = [review.blurb,review.instagram_caption,review.tiktok_caption,review.x_caption].join(' ');
if (/(^|\s)#[A-Za-z0-9_]+\b/.test(rawCaptions)) flags.push('hashtags_inside_caption');
const missingBirds = birds.filter(bird => !norm([ig,yt,tt,xx].join(' ')).includes(norm(bird)));
if (missingBirds.length) flags.push(`missing_featured_birds:${missingBirds.join('|')}`);
const changedBirds = birds.filter(bird => !norm(sourceAuthority).includes(norm(bird)));
if (changedBirds.length) flags.push(`invented_or_changed_featured_birds:${changedBirds.join('|')}`);
const unsupported = unsupportedTerms.filter(term => norm(combined).includes(norm(term)) && !authority.includes(norm(term)));
if (unsupported.length) flags.push(`unsupported_details:${unsupported.join('|')}`);
const generatedSpecificWeather = /\b(?:it (?:was|is) raining|rain (?:fell|started|continued)|during (?:the )?rain|in (?:the )?rain|rainy (?:morning|afternoon|evening|day|tour|outing)|misty (?:morning|afternoon|evening|day|tour|outing))\b/i.test(combined);
const intakeHasSpecificWeather = /\b(?:rain|raining|rainy|rainfall|mist|misty|weather)\b/i.test(intakeAuthority);
if (generatedSpecificWeather && !intakeHasSpecificWeather) flags.push('unsupported_current_weather');
const locationCount = norm(ig).split(norm(location)).length - 1;
if (locationCount > 2) flags.push('repeated_location');
if (sourceWords < 8 || /^(mindo\s+has\s+an?\s+adventure\s+for\s+everyone[.!]?)$/i.test(clean(base.reel_description))) {
  flags.push('intake_description_too_vague');
}
if (sourceWords >= 12 && norm(ig).includes(norm(base.reel_description))) flags.push('intake_description_copied_verbatim');
const similarityTokens = value => new Set(norm(value).replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(token => token.length > 3 && !['mindo','ecuador','birding','birdwatching','with','this','that','from','your'].includes(token)));
const similarity = (left, right) => {
  const a = similarityTokens(left);
  const b = similarityTokens(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter(token => b.has(token)).length;
  return intersection / Math.max(a.size, b.size);
};
const recentCaptions = Array.isArray(base._recent_captions) ? base._recent_captions : [];
if (recentCaptions.some(previous => similarity(ig, previous) > 0.62)) flags.push('recent_caption_similarity_too_high');

const now = new Date().toISOString();
const approved = flags.length === 0;
const autoSchedule = approved && clean(base.admin_mode).toLowerCase() === 'auto';
const notes = Array.isArray(review.review_notes) ? review.review_notes.map(clean).filter(Boolean).join(' | ') : '';

return { json: {
  ...base,
  featured_birds: birds.join(' | '),
  activity_name: activity,
  // Testing/Generating are transient processing states, never durable review
  // states. Draft is the sheet's validated review state. Leaving a rejected
  // draft as Testing makes the hourly scheduler regenerate the same row forever
  // and can replace previously approved copy.
  status: autoSchedule ? 'Scheduled' : 'Draft',
  input_status: autoSchedule ? 'VERIFIED' : 'READY',
  blurb,
  local_blurb: blurb,
  instagram_caption_raw: ig,
  instagram_caption_final: `${ig}\n\n${instagramHashtags}`,
  instagram_hashtags: instagramHashtags,
  youtube_title: yt,
  tiktok_caption: tt,
  tiktok_hashtags: tiktokHashtags,
  tiktok_additional_hashtags: additional.slice(0, 10).join(' '),
  x_caption: xx,
  x_hashtags: xTags.join(' '),
  x_post_final: [xx, xTags.join(' ')].filter(Boolean).join('\n\n'),
  local_validation_status: approved ? 'PASS' : 'FLAGGED',
  local_validation_flags: flags.join(' | '),
  copy_review_status: approved ? 'FINAL' : 'HUMAN_REVIEW',
  supervision_status: approved ? 'APPROVED' : 'NEEDS_REVIEW',
  supervision_notes: approved
    ? `${base._repair_attempted ? 'Targeted local repair completed.' : 'Independent local editorial pass completed.'}${notes ? ` ${notes}` : ''}`
    : flags.join(' | '),
  final_copy_source: approved
    ? (base._repair_attempted ? 'LOCAL_TARGETED_REPAIR_VALIDATED' : 'LOCAL_DOUBLE_PASS_VALIDATED')
    : 'DRAFT_ONLY',
  quality_score: Math.max(0, 100 - flags.length * 15),
  approval_status: approved ? 'APPROVED' : 'NEEDS_REVIEW',
  approval_timestamp: approved ? now : '',
  draft_model: base._repair_attempted
    ? 'gpt-oss:20b writer + editor + targeted repair v4'
    : 'gpt-oss:20b writer + independent editor v4',
  draft_generated_at: now,
  posting_defaults_applied_at: now,
  error_message: approved
    ? ''
    : flags.some(flag => flag.startsWith('mac_mini_'))
      ? 'MAC MINI UNAVAILABLE — Ollama did not complete both local copy passes. Copy was not approved or published. Keep the Mac mini awake, confirm Ollama is running, and regenerate.'
      : `COPY REVIEW REQUIRED: ${flags.join(' | ')}`,
} };
