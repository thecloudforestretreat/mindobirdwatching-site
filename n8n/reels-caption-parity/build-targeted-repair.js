const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const row = { ...$json, _repair_attempted: true };
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

const authoritativeBirds = clean(row._input_featured_birds)
  || (Array.isArray(row._source_birds_detected) ? row._source_birds_detected.join(' | ') : '')
  || clean(row.featured_birds);
const prompt = `You are performing one targeted final repair for Mindo Bird Watching. Do not start over and do not add facts.

ORIGINAL FACTUAL INTAKE:
"""${clean(row.reel_description)}"""
Exact bird names: ${authoritativeBirds || 'No bird names supplied'}
Location: ${clean(row.location) || 'Mindo, Ecuador'}
Verified details: ${clean(row.verified_details)}

FAILED CHECKS — repair these exact problems:
${clean(row.local_validation_flags)}

CURRENT COPY:
Activity: ${clean(row.activity_name)}
Blurb: ${clean(row.blurb)}
Instagram: ${clean(row.instagram_caption_raw)}
Instagram contextual hashtags: ${clean(row.instagram_hashtags).split(/\s+/).slice(-2).join(' ')}
YouTube: ${clean(row.youtube_title)}
TikTok: ${clean(row.tiktok_caption)}
TikTok contextual hashtags: ${clean(row.tiktok_hashtags).split(/\s+/).slice(-2).join(' ')}
Additional hashtags: ${clean(row.tiktok_additional_hashtags)}
X: ${clean(row.x_caption)}
X hashtags: ${clean(row.x_hashtags)}

Repair rules:
- Preserve the useful current wording and change only what is needed to clear the failed checks.
- Return the exact authoritative bird names everywhere. Never substitute Toucan and Toucanet or change another species.
- Remove every unsupported term named in the failed checks.
- Use plain field-note language. No brochure claims, inspirational summary, symmetrical slogan, documentary narration, or generic audience question.
- Do not use "this reel follows", "during this outing", "Mindo's morning brought", "Four birds, four moments", another repeated-number slogan, "brings into view", "the mix of species shows", "in its own way", "just long enough", "one of the best chances", "made for a memorable", "cloud forest delivers", "cloud forest delivered", "were observed", "Reliable morning birding", "showcases", or "witness up close".
- Instagram must be 35–100 words excluding hashtags; aim for 45–65 words in 2–4 sentences. Count the words and repair any short or long draft before returning JSON. Do not add filler or a sales CTA unless the intake announces or offers something.
- TikTok: 8–45 words. YouTube title: no more than 100 characters.
- Captions contain no hashtags or emoji. Return exactly two contextual Instagram/TikTok hashtags, excluding #mindobirdwatching, any compound containing "mindobirdwatching", #mindo, and #ecuador, plus 5–10 factual additional hashtags.
- Set PASS only after every failed check is repaired. Otherwise return REVISE.

Return only JSON matching the schema.`;

row._repair_ollama_body = {
  model: 'gpt-oss:20b',
  messages: [
    { role: 'system', content: 'Perform a narrow factual copy repair. Return valid JSON only.' },
    { role: 'user', content: prompt },
  ],
  stream: false,
  think: 'low',
  format: schema,
  keep_alive: '30m',
  options: {
    temperature: 0.08,
    num_predict: 1400,
    seed: Number(row.post_id || 1) + 200003,
  },
};

return { json: row };
