const base = $('[V2] Build Local Creative Request').item.json || {};
const clean = value => String(value ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
const stripEmoji = value => String(value ?? '').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '');
const stripInlineHashtags = value => String(value ?? '').replace(/(^|\s)#[A-Za-z0-9_]+\b/g, ' ');
const caption = value => clean(stripInlineHashtags(stripEmoji(value)))
  .replace(/\s+([,.;:!?])/g, '$1')
  .trim();
const title = value => caption(value).replace(/[.!?]+$/g, '').trim();
const truncateAtWord = (value, maximum) => {
  const text = clean(value);
  if (text.length <= maximum) return text;
  const candidate = text.slice(0, maximum + 1);
  const breakAt = candidate.lastIndexOf(' ');
  const shortened = breakAt >= Math.floor(maximum * 0.6)
    ? candidate.slice(0, breakAt)
    : text.slice(0, maximum);
  return shortened.replace(/[\s,:;\-–—]+$/g, '').trim();
};
const hashtag = value => {
  const raw = clean(value).replace(/^#+/, '').replace(/[^A-Za-z0-9_]/g, '');
  return raw ? `#${raw}` : '';
};
const unique = values => [...new Map(values.filter(Boolean).map(value => [value.toLowerCase(), value])).values()];
const words = value => clean(value).split(/\s+/).filter(Boolean).length;
const core = ['#mindobirdwatching', '#mindo', '#ecuador'];
const normalizeForMatch = value => clean(value)
  .normalize('NFKD')
  .replace(/[\u2010-\u2015\u2212]/g, '-')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase();

let draft = {};
let parseWarning = '';
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
  draft = typeof raw === 'object' && raw !== null ? raw : JSON.parse(String(raw));
} catch (error) {
  parseWarning = transportMessage
    ? `mac_mini_writer_unavailable:${transportMessage}`
    : `local_json_parse_failed:${error.message}`;
}

const sourceDetectedBirds = Array.isArray(base._source_birds_detected) ? base._source_birds_detected.map(clean).filter(Boolean) : [];
const inputBirds = clean(base._input_featured_birds || base.featured_birds).split(/[|,;]/).map(clean).filter(Boolean);
const authoritativeBirds = inputBirds.length ? inputBirds : sourceDetectedBirds;
const birds = unique((authoritativeBirds.length ? authoritativeBirds : (Array.isArray(draft.featured_birds) ? draft.featured_birds : []))
  .map(clean)
  .filter(Boolean));
const location = clean(draft.location) || clean(base.location) || 'Mindo, Ecuador';
const normalizeActivity = value => {
  const candidate = clean(value);
  if (!candidate || /^(bird\s*watching|birding)$/i.test(candidate)) return 'Birdwatching';
  if (/^(tour|tours|activity)$/i.test(candidate)) return 'Birdwatching Tour';
  return candidate.replace(/\bbird\s+watching\b/gi, 'Birdwatching');
};
const activity = normalizeActivity(draft.activity_name || base.activity_name);
const postType = clean(draft.post_type) || clean(base.post_type) || 'Tour';
const verified = clean(base.verified_details) || clean(base.reel_description);
let blurb = clean(draft.blurb) || clean(base.reel_description);

let igBody = caption(draft.instagram_caption);
const similarityTokens = value => new Set(clean(value).toLowerCase()
  .replace(/[^a-z0-9\s-]/g, ' ')
  .split(/\s+/)
  .filter(token => token.length > 3 && !['mindo', 'ecuador', 'birding', 'birdwatching', 'with', 'this', 'that', 'from', 'your'].includes(token)));
const similarity = (left, right) => {
  const a = similarityTokens(left);
  const b = similarityTokens(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter(token => b.has(token)).length;
  return intersection / Math.max(a.size, b.size);
};
const recentCaptions = Array.isArray(base._recent_captions) ? base._recent_captions : [];
const maxSimilarity = recentCaptions.reduce((max, caption) => Math.max(max, similarity(igBody, caption)), 0);
const igPrimary = unique((Array.isArray(draft.instagram_primary_hashtags) ? draft.instagram_primary_hashtags : [])
  .map(hashtag)
  .filter(tag => tag && !core.includes(tag.toLowerCase()) && !tag.toLowerCase().includes('mindobirdwatching')));
for (const fallback of ['#MindoBirding', '#EcuadorBirds']) {
  if (igPrimary.length < 2 && !igPrimary.some(tag => tag.toLowerCase() === fallback.toLowerCase())) igPrimary.push(fallback);
}
const instagramHashtags = [...core, ...igPrimary.slice(0, 2)].join(' ');
let instagramFinal = `${igBody}\n\n${instagramHashtags}`;

let youtubeTitle = title(draft.youtube_title);
youtubeTitle = truncateAtWord(youtubeTitle, 90);

let tiktokCaption = caption(draft.tiktok_caption);

const ttPrimary = unique((Array.isArray(draft.tiktok_primary_hashtags) ? draft.tiktok_primary_hashtags : [])
  .map(hashtag)
  .filter(tag => tag && !core.includes(tag.toLowerCase()) && !tag.toLowerCase().includes('mindobirdwatching')));
for (const fallback of ['#MindoBirding', '#EcuadorBirds']) {
  if (ttPrimary.length < 2 && !ttPrimary.some(tag => tag.toLowerCase() === fallback.toLowerCase())) ttPrimary.push(fallback);
}
const tiktokHashtags = [...core, ...ttPrimary.slice(0, 2)].join(' ');
const additional = unique((Array.isArray(draft.tiktok_additional_hashtags) ? draft.tiktok_additional_hashtags : [])
  .map(hashtag)
  .filter(tag => tag && !core.includes(tag.toLowerCase()) && tag.length <= 28));
for (const fallback of ['#BirdWatching', '#CloudForest', '#EcuadorWildlife', '#BirdingTour', '#NatureTravel']) {
  if (additional.length < 5 && !additional.some(tag => tag.toLowerCase() === fallback.toLowerCase())) additional.push(fallback);
}

let xCaption = caption(draft.x_caption);
if (xCaption.length > 240) xCaption = `${truncateAtWord(xCaption, 237)}…`;
const xTags = unique((Array.isArray(draft.x_hashtags) ? draft.x_hashtags : ['#MindoBirds'])
  .map(hashtag)).slice(0, 2);
const xHashtags = xTags.join(' ');

const forbidden = /\b(this (?:reel|video|post) (?:shows|follows)|the video shows|imagine|step into|hidden paradise|nature['’]s symphony|mist-kissed|living tapestry|feathered wonders|where time slows down|set(?:s|ting)? the scene|rich avian diversity|add(?:s|ed|ing)? (?:a )?splash of colou?r|striking species|vivid encounters?|showcas(?:e|es|ed|ing)|witness[^.!?]{0,60}up close|in (?:its|their) own way|just long enough|one of the best chances|what makes (?:this|it) special|a reminder that)\b/i;
const formulaic = [
  /^during this outing\b/i,
  /\bbrings? [^.]{0,80} into view\b/i,
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
const sourceAuthority = [
  base.reel_description,
  base.featured_birds,
  base.activity_name,
  base.location,
  base.verified_details,
].join(' ');
const destinationAuthority = /\bmindo\b/i.test(location)
  ? 'Mindo Ecuador Andean Choco cloud forest habitat habitats mist misty humidity humid rain rainfall rainy weather'
  : '';
const sourceNormalized = normalizeForMatch([sourceAuthority, destinationAuthority].join(' '));
const intakeNormalized = normalizeForMatch(sourceAuthority);
const unsupportedTerms = [
  'moonlit', 'moonlight', 'lantern', 'canopy', 'plumage', 'elusive', 'rare',
  'mist', 'misty', 'rain', 'rainfall', 'weather', 'habitat', 'nest', 'feeding',
  'river', 'rapids', 'current', 'trail', 'garden', 'feeder', 'bridge', 'road', 'lodge', 'breakfast', 'dawn', 'sunrise', 'glow', 'rainforest', 'cloud forest',
];
const findUnsupported = value => {
  const generatedNormalized = normalizeForMatch(value);
  return unsupportedTerms.filter(term => {
    const normalizedTerm = normalizeForMatch(term);
    return generatedNormalized.includes(normalizedTerm) && !sourceNormalized.includes(normalizedTerm);
  });
};
const findMissingBirds = value => {
  const haystack = normalizeForMatch(value);
  return birds.filter(bird => !haystack.includes(normalizeForMatch(bird)));
};

const generatedCopy = [blurb, igBody, youtubeTitle, tiktokCaption, xCaption].join(' ');
const unsupportedDetails = findUnsupported(generatedCopy);
const generatedSpecificWeather = /\b(?:it (?:was|is) raining|rain (?:fell|started|continued)|during (?:the )?rain|in (?:the )?rain|rainy (?:morning|afternoon|evening|day|tour|outing)|misty (?:morning|afternoon|evening|day|tour|outing))\b/i.test(generatedCopy);
const intakeHasSpecificWeather = /\b(?:rain|raining|rainy|rainfall|mist|misty|weather)\b/i.test(intakeNormalized);
const missingBirds = findMissingBirds([igBody, youtubeTitle, tiktokCaption, xCaption].join(' '));
const validationFlags = [];
if (parseWarning) validationFlags.push(parseWarning);
if (!blurb || !igBody || !youtubeTitle || !tiktokCaption || !xCaption) validationFlags.push('writer_missing_required_copy');
if (forbidden.test([igBody, youtubeTitle, tiktokCaption, xCaption].join(' '))) validationFlags.push('forbidden_template_language');
if (formulaic.some(pattern => pattern.test(igBody))) validationFlags.push('formulaic_caption_voice');
if (unsupportedDetails.length) validationFlags.push(`unsupported_details:${unsupportedDetails.join('|')}`);
if (generatedSpecificWeather && !intakeHasSpecificWeather) validationFlags.push('unsupported_current_weather');
if (missingBirds.length) validationFlags.push(`missing_featured_birds:${missingBirds.join('|')}`);
if (words(igBody) < 35 || words(igBody) > 100) validationFlags.push('instagram_length_outside_35_100');
if (words(tiktokCaption) < 8 || words(tiktokCaption) > 45) validationFlags.push('tiktok_length_outside_8_45');
if (maxSimilarity > 0.62 && recentCaptions.some(caption => similarity(igBody, caption) > 0.62)) validationFlags.push('recent_caption_similarity_too_high');
const sourceRequestsAction = /\b(new|launch|introduc(?:e|ing)|offer(?:ing)?|book(?:ing)?|reserve|availability|message us|plan (?:a|your)|tour package)\b/i.test(sourceAuthority);
const generatedSalesCta = /\b(book|reserve|message us|join us|plan your|contact us|send us a message)\b/i.test(igBody);
if (generatedSalesCta && !sourceRequestsAction) validationFlags.push('unsolicited_sales_cta');
const intakeWords = words(base.reel_description);
if (intakeWords < 8 || /^(mindo\s+has\s+an?\s+adventure\s+for\s+everyone[.!]?)$/i.test(clean(base.reel_description))) {
  validationFlags.push('intake_description_too_vague');
}

const now = new Date().toISOString();
const approved = validationFlags.length === 0;
const qualityScore = approved ? 95 : Math.max(0, 85 - (validationFlags.length * 12));

return {
  json: {
    ...base,
    featured_birds: birds.join(' | '),
    activity_name: activity,
    location,
    verified_details: verified,
    status: base.status,
    input_status: 'READY',
    post_type: postType,
    media_type: 'REELS',
    local_blurb: blurb,
    local_validation_status: approved ? 'PASS' : 'FLAGGED',
    local_validation_flags: validationFlags.join(' | '),
    local_generated_at: now,
    local_model: 'gpt-oss:20b local editorial strategist v2.1',
    copy_review_status: approved ? 'FINAL' : 'HUMAN_REVIEW',
    draft_model: 'gpt-oss:20b local editorial strategist v2.1',
    draft_generated_at: now,
    supervision_status: approved ? 'APPROVED' : 'NEEDS_REVIEW',
    supervision_notes: approved
      ? 'Local structured generation and deterministic platform checks passed.'
      : validationFlags.join(' | '),
    final_copy_source: approved ? 'LOCAL_LLM_VALIDATED' : 'DRAFT_ONLY',
    quality_score: qualityScore,
    approval_status: approved ? 'APPROVED' : 'NEEDS_REVIEW',
    approval_timestamp: approved ? now : '',
    posting_defaults_applied_at: now,
    blurb,
    post_to_instagram: base.post_to_instagram !== false,
    instagram_caption_raw: igBody,
    instagram_caption_final: instagramFinal,
    instagram_hashtags: instagramHashtags,
    post_to_facebook: base.post_to_facebook !== false,
    post_on_youtube: base.post_on_youtube !== false,
    youtube_title: youtubeTitle,
    post_on_tiktok: base.post_on_tiktok !== false,
    tiktok_caption: tiktokCaption,
    tiktok_hashtags: tiktokHashtags,
    tiktok_additional_hashtags: additional.slice(0, 10).join(' '),
    generate_for_x: base.generate_for_x !== false,
    x_caption: xCaption,
    x_hashtags: xHashtags,
    x_post_final: [xCaption, xHashtags].filter(Boolean).join('\n\n'),
    post_to_x: base.post_to_x === true,
    error_message: approved
      ? ''
      : validationFlags.some(flag => flag.startsWith('mac_mini_writer_unavailable:'))
        ? 'MAC MINI UNAVAILABLE — Ollama did not complete the local writing pass. Copy was not approved or published. Keep the Mac mini awake, confirm Ollama is running, and regenerate.'
        : `COPY REVIEW REQUIRED: ${validationFlags.join(' | ')}`,
    _draft_validation_flags: validationFlags,
    _draft_parse_warning: parseWarning,
  },
};
