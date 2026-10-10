const base = $('[V2] Build Local Creative Request').item.json || {};
const clean = v => String(v ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
const caption = v => clean(v).replace(/(^|\s)#[A-Za-z0-9_]+\b/g, ' ').replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim();
const norm = v => clean(v).normalize('NFKD').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\p{Diacritic}/gu, '').toLowerCase();
const words = v => clean(v).split(/\s+/).filter(Boolean).length;
const trimAt = (v, n) => clean(v).length <= n ? clean(v) : clean(v).slice(0, n + 1).replace(/\s+\S*$/, '').replace(/[\s,;:-]+$/, '') + '…';
const tag = v => { const s = clean(v).replace(/^#+/, '').replace(/[^A-Za-z0-9_]/g, ''); return s ? `#${s}` : ''; };
const uniq = values => [...new Map(values.filter(Boolean).map(v => [v.toLowerCase(), v])).values()];
const countPhrase = (value, phrase) => norm(value).split(norm(phrase)).length - 1;
const compact = value => norm(value).replace(/[^a-z0-9]/g, '').replace(/s$/, '');

let draft = {};
let parseError = '';
let rawText = '';
try {
  const raw = $json?.message?.content ?? $json?.response ?? $json?.content ?? '';
  rawText = typeof raw === 'string' ? raw : JSON.stringify(raw);
  draft = typeof raw === 'object' && raw !== null ? raw : JSON.parse(rawText);
} catch (error) {
  parseError = `local_json_parse_failed:${error.message}`;
}

const birds = uniq((Array.isArray(draft.featured_birds) ? draft.featured_birds : clean(base.featured_birds).split(/[|,;]/)).map(clean).filter(Boolean));
const location = clean(draft.location) || clean(base.location) || 'Mindo, Ecuador';
const activity = clean(draft.activity_name) || clean(base.activity_name) || 'Birdwatching';
const postType = clean(draft.post_type) || clean(base.post_type) || 'Tour';
const source = caption(base.reel_description).replace(/(?:\.{3,}|…)+/g, '.').replace(/\s+([,.;!?])/g, '$1');
const birdText = birds.length < 2 ? (birds[0] || 'the birds') : `${birds.slice(0, -1).join(', ')}, and ${birds.at(-1)}`;
const sourceAuthority = norm([base.reel_description, base.featured_birds, base.activity_name, base.location, base.verified_details].join(' '));
const banned = /\b(this reel shows|the video shows|imagine|step into|hidden paradise|nature['’]s symphony|mist-kissed|living tapestry|feathered wonders|where time slows down|showdown)\b/i;
const filler = /\b(can bring several distinct moments together|those (?:are|supplied) (?:the )?details that made this experience(?: in [^.]+)? worth sharing|every outing develops from the moments that are actually present|this was the clear focus here|supplied details are the focus|the account stays with the moment as described|adding a splash of color|turn(?:s|ing)? (?:a|the|this) [^.]+ into a memorable adventure)\b/i;
const grammar = /\b(?:one|a|an|each)\s+(?:birdwatching|birding)\b/i;
const genericTitle = /^(?:birdwatching|birding|tour|nature|reel|mindo)$/i;
const unsupportedTerms = ['moonlit','moonlight','lantern','canopy','plumage','elusive','rare','mist','misty','rain','rainfall','weather','habitat','nest','feeding','river','rapids','current','dawn','sunrise','glow','rainforest','cloud forest'];
const unsupported = value => unsupportedTerms.filter(term => norm(value).includes(norm(term)) && !sourceAuthority.includes(norm(term)));
const missingBirds = value => birds.filter(bird => !norm(value).includes(norm(bird)));

let ig = caption(draft.instagram_caption);
let yt = caption(draft.youtube_title).replace(/[.!?]+$/, '');
let tt = caption(draft.tiktok_caption);
let xx = caption(draft.x_caption);
let blurb = clean(draft.blurb) || source;
const aiCopy = [blurb, ig, yt, tt, xx].join(' ');
const initialUnsafe = Boolean(parseError || banned.test(aiCopy) || filler.test(aiCopy) || grammar.test(aiCopy) || unsupported(aiCopy).length || missingBirds([ig, yt, tt, xx].join(' ')).length || words(ig) < 40 || words(ig) > 80 || words(tt) < 8 || words(tt) > 35 || genericTitle.test(yt));
let usedDeterministicFallback = false;
if (initialUnsafe) {
  usedDeterministicFallback = true;
  blurb = source;
  ig = `${source} This moment came from a ${activity.toLowerCase()} outing in ${location}. Message us to plan a guided birding experience in Mindo.`;
  yt = `${birdText} During a Birdwatching Outing in ${location}`;
  tt = words(source) >= 8 && words(source) <= 35 ? source : `${birdText} during a birdwatching outing in ${location}.`;
  xx = trimAt(`${source} A moment from birdwatching in ${location}.`, 240);
}

const core = ['#mindobirdwatching','#mindo','#ecuador'];
const contextualFrom = value => uniq((Array.isArray(value) ? value : []).map(tag).filter(v => v && !core.includes(v.toLowerCase())));
const igTags = contextualFrom(draft.instagram_primary_hashtags);
for (const bird of birds) if (igTags.length < 2) igTags.push(tag(bird));
for (const v of ['#MindoBirding','#EcuadorBirds']) if (igTags.length < 2 && !igTags.some(x => x.toLowerCase() === v.toLowerCase())) igTags.push(v);
const instagramHashtags = [...core, ...uniq(igTags).slice(0, 2)].join(' ');
const ttTags = contextualFrom(draft.tiktok_primary_hashtags);
for (const bird of birds) if (ttTags.length < 2) ttTags.push(tag(bird));
for (const v of ['#MindoBirding','#EcuadorBirds']) if (ttTags.length < 2 && !ttTags.some(x => x.toLowerCase() === v.toLowerCase())) ttTags.push(v);
const tiktokHashtags = [...core, ...uniq(ttTags).slice(0, 2)].join(' ');
const weakDiscoveryTags = new Set(['birds', 'child', 'riverplay', 'rainyday', 'rainyriver', 'fyp', 'viral', 'fy', 'explorepage']);
const additional = contextualFrom(draft.tiktok_additional_hashtags).filter(value => !weakDiscoveryTags.has(compact(value)));
for (const v of ['#BirdWatching','#CloudForest','#EcuadorWildlife','#BirdingTour','#NatureTravel']) if (additional.length < 5 && !additional.some(x => x.toLowerCase() === v.toLowerCase())) additional.push(v);
const xTags = uniq((Array.isArray(draft.x_hashtags) ? draft.x_hashtags : ['#MindoBirds']).map(tag)).slice(0, 2).join(' ');

yt = trimAt(yt || `${birdText} During Birdwatching in ${location}`, 90);
if (xx.length > 240) xx = trimAt(xx, 240);
const finalCopy = [blurb, ig, yt, tt, xx].join(' ');
const flags = [];
if (parseError) flags.push(parseError);
if (usedDeterministicFallback) flags.push('deterministic_fallback_requires_review');
if (banned.test(finalCopy) || filler.test(finalCopy)) flags.push('forbidden_template_language');
if (grammar.test(finalCopy)) flags.push('unnatural_activity_grammar');
if (/(?:\.{3,}|…)/.test(finalCopy)) flags.push('ellipsis_or_incomplete_copy');
if (genericTitle.test(yt)) flags.push('generic_title');
const unsupportedFinal = unsupported(finalCopy);
if (unsupportedFinal.length) flags.push(`unsupported_details:${unsupportedFinal.join('|')}`);
const missingFinal = missingBirds([ig, yt, tt, xx].join(' '));
if (missingFinal.length) flags.push(`missing_featured_birds:${missingFinal.join('|')}`);
if (words(source) >= 12 && norm(ig).includes(norm(source))) flags.push('intake_description_copied_verbatim');
if ([ig, tt, xx].some(value => countPhrase(value, location) > 1)) flags.push('location_repeated_within_platform');
if (words(ig) < 40 || words(ig) > 80) flags.push('instagram_length_outside_40_80');
if (words(tt) < 8 || words(tt) > 35) flags.push('tiktok_length_outside_8_35');
const birdKeys = birds.map(compact).filter(Boolean);
const contextualKeys = instagramHashtags.split(/\s+/).slice(3).map(compact);
if (birdKeys.length && !contextualKeys.some(key => birdKeys.some(bird => key.includes(bird) || bird.includes(key)))) flags.push('instagram_missing_bird_hashtag');
const approved = flags.length === 0;
const qualityScore = approved ? 95 : Math.max(0, 85 - flags.length * 12);
const now = new Date().toISOString();
const adminMode = clean(base.admin_mode).toLowerCase();
const autoSchedule = approved && adminMode === 'auto';

return { json: {
  ...base,
  featured_birds: birds.join(' | '), activity_name: activity, location,
  verified_details: source, status: autoSchedule ? 'Scheduled' : base.status, input_status: autoSchedule ? 'VERIFIED' : 'READY', post_type: postType, media_type: 'REELS',
  local_blurb: blurb, local_validation_status: approved ? 'PASS' : 'FLAGGED', local_validation_flags: flags.join(' | '),
  local_generated_at: now, local_model: 'gpt-oss:20b local senior editor v3.0',
  copy_review_status: approved ? 'FINAL' : 'HUMAN_REVIEW', draft_model: 'gpt-oss:20b local senior editor v3.0', draft_generated_at: now,
  supervision_status: approved ? 'APPROVED' : 'NEEDS_REVIEW', supervision_notes: approved ? 'Local generation and deterministic editorial checks passed.' : flags.join(' | '),
  final_copy_source: approved ? 'LOCAL_LLM_VALIDATED_V3' : 'DRAFT_ONLY', quality_score: qualityScore,
  approval_status: approved ? 'APPROVED' : 'NEEDS_REVIEW', approval_timestamp: approved ? now : '', posting_defaults_applied_at: now,
  blurb, instagram_caption_raw: ig, instagram_caption_final: `${ig}\n\n${instagramHashtags}`, instagram_hashtags: instagramHashtags,
  youtube_title: yt, tiktok_caption: tt, tiktok_hashtags: tiktokHashtags, tiktok_additional_hashtags: additional.slice(0, 10).join(' '),
  x_caption: xx, x_hashtags: xTags, x_post_final: [xx, xTags].filter(Boolean).join('\n\n'),
  error_message: approved ? '' : `COPY REVIEW REQUIRED: ${flags.join(' | ')}`,
} };
