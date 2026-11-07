const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const row = { ...$json };
const location = clean(row.location) || 'Mindo, Ecuador';
const destinationContext = /\bmindo\b/i.test(location)
  ? 'Mindo, Ecuador is in the Andean Choc\u00f3 cloud forest. Cloud forest, mist, humidity, and frequent rain are established destination facts. General regional references are allowed; claims that rain or mist occurred during this exact outing require support in the original description or verified details.'
  : 'No destination fact pack is available. Use only the supplied location and intake facts.';
const recent = Array.isArray(row._recent_captions)
  ? row._recent_captions.slice(-20).map((caption, index) => `${index + 1}. ${clean(caption).slice(0, 240)}`)
  : [];
const factualInput = [row.reel_description, row.featured_birds, row.activity_name, row.verified_details, row.post_type]
  .map(clean).filter(Boolean).join(' ');
const commercialIntent = /\b(new|launch|introduc(?:e|ing)|offer(?:ing)?|book(?:ing)?|reserve|availability|message us|plan (?:a|your)|tour package)\b/i.test(factualInput);

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['featured_birds','activity_name','blurb','instagram_caption','instagram_primary_hashtags','youtube_title','tiktok_caption','tiktok_primary_hashtags','tiktok_additional_hashtags','x_caption','x_hashtags','review_verdict','review_notes'],
  properties: {
    featured_birds: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    activity_name: { type: 'string' },
    blurb: { type: 'string' },
    instagram_caption: { type: 'string' },
    instagram_primary_hashtags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
    youtube_title: { type: 'string' },
    tiktok_caption: { type: 'string' },
    tiktok_primary_hashtags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
    tiktok_additional_hashtags: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 10 },
    x_caption: { type: 'string' },
    x_hashtags: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
    review_verdict: { type: 'string', enum: ['PASS', 'REVISE'] },
    review_notes: { type: 'array', items: { type: 'string' }, maxItems: 12 },
  },
};

const prompt = `You are the independent copy editor for Mindo Bird Watching. This is a fresh second pass. Correct the candidate rather than echoing it.

FACTUAL AUTHORITY — never add facts not present here:
Original description: """${clean(row.reel_description)}"""
Original bird field: ${clean(row._input_featured_birds) || 'Not separately supplied; extract exact names from the original description.'}
Bird names detected from the original description: ${Array.isArray(row._source_birds_detected) ? row._source_birds_detected.join(' | ') : 'None detected'}
Candidate extracted birds (may contain an error): ${clean(row.featured_birds)}
Location: ${location}
Verified details: ${clean(row.verified_details)}

VERIFIED DESTINATION CONTEXT:
${destinationContext}

RECENT INSTAGRAM COPY — do not repeat its openings, endings, questions, or sentence frames:
${recent.length ? recent.join('\n') : 'No recent copy supplied.'}

CANDIDATE:
Activity: ${clean(row.activity_name)}
Blurb: ${clean(row.blurb)}
Instagram: ${clean(row.instagram_caption_raw)}
Instagram contextual hashtags: ${clean(row.instagram_hashtags).split(/\s+/).slice(-2).join(' ')}
YouTube title: ${clean(row.youtube_title)}
TikTok: ${clean(row.tiktok_caption)}
TikTok contextual hashtags: ${clean(row.tiktok_hashtags).split(/\s+/).slice(-2).join(' ')}
Additional hashtags: ${clean(row.tiktok_additional_hashtags)}
X: ${clean(row.x_caption)}
X hashtags: ${clean(row.x_hashtags)}
First-pass validation findings: ${Array.isArray(row._draft_validation_flags) ? row._draft_validation_flags.join(' | ') : clean(row.local_validation_flags)}

Edit every field for spelling, grammar, capitalization, natural phrasing, and factual accuracy.
- Correct obvious input typos in prose, including "seening" to "seeing".
- Never change or invent a supplied bird species. The original description and original bird field are authoritative even when the candidate extracted birds are wrong.
- Return featured_birds as the exact common names used in the original description. In particular, never substitute Toucan for Toucanet, Toucanet for Toucan, or one hummingbird, barbet, motmot, duck, or potoo name for another.
- If the deterministic detected-bird list is non-empty, return that list exactly and correct the same names everywhere in the candidate copy.
- A first-pass flag such as unsupported_details:canopy means the unsupported word must be removed unless that exact fact appears in the original description or original bird field. Never return PASS while repeating a flagged unsupported term.
- Normalize a generic activity such as "tour" to "Birdwatching Tour".
- Every prose field and title must begin with a capital letter.
- Never use "During tour" or similarly broken title grammar.
- Avoid repetitive boilerplate, repeated locations, and phrases such as "never follows a fixed script".
- Rewrite stock AI/travel-copy phrases such as "this reel follows", "during this outing", "Mindo's morning brought", "brings ... into view", "the mix of species shows", "cloud forest delivered", "were observed", "in its own way", "just long enough", "one of the best chances", "set the scene", "rich avian diversity", "splash of color", "striking species", "vivid encounters", "showcasing", and "witness ... up close" into plain, specific observations.
- Remove generic lessons, inspirational conclusions, symmetrical slogans, and audience-bait questions such as "Which one caught your attention first?"
- Remove unsupported promotional fragments such as "Reliable morning birding."
- A PASS caption should sound like a knowledgeable local guide recounting one real outing in ordinary language, not a polished tourism template or nature documentary.
- Preserve useful specificity, but do not force every supplied fact into every platform field.
- ${commercialIntent ? 'A short, specific next step is allowed because the intake has a genuine announcement or commercial purpose.' : 'Do not add a booking CTA, "message us", "join us", "plan your trip", or a generic engagement question because the intake does not request a sale.'}
- Remove or rewrite every genuinely unsupported detail identified by the first-pass validator; do not remove stable facts supported by the destination context, and do not discard an otherwise usable draft.
- If the original description is too vague to identify a concrete subject or moment, do not invent one. Return REVISE with a clear review note.
- Instagram must be 35–100 words, aim for 45–65 words in 2–4 sentences, with no hashtags or emojis. Count words excluding hashtags before returning JSON. Repair a short draft with factual phrasing grounded in the intake, without padding or invented details. A CTA is optional and only allowed under the rule above.
- YouTube must be natural Title Case, no more than 100 characters.
- TikTok must be 8–45 words, with no hashtags or emojis.
- X must be no more than 240 characters before hashtags.
- Keep exactly two contextual Instagram/TikTok hashtags; exclude #mindobirdwatching, any compound containing "mindobirdwatching", #mindo, and #ecuador.
- Return 5–10 factual discovery hashtags.
- Captions contain prose only. Hashtags belong only in arrays.
- Read the Instagram caption aloud before deciding. If it could be pasted onto an unrelated wildlife reel with only the bird names changed, rewrite it.
- Set review_verdict to PASS only after the corrected output meets every rule. Otherwise use REVISE and explain why.

Return only JSON matching the schema.`;

row._review_ollama_body = {
  model: 'gpt-oss:20b',
  messages: [
    { role: 'system', content: 'Act as a strict independent editor. Return valid JSON only. Preserve facts and correct all copy defects.' },
    { role: 'user', content: prompt },
  ],
  stream: false,
  think: 'low',
  format: schema,
  keep_alive: '30m',
  // The editor returns every platform field plus review notes. A larger bounded
  // budget prevents syntactically incomplete JSON without encouraging longer
  // customer-facing captions, whose lengths are validated separately.
  options: { temperature: 0.18, num_predict: 1400, seed: Number(row.post_id || 1) + 100003 },
};

return { json: row };
