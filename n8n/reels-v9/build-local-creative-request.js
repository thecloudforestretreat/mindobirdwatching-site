const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const row = { ...$json };
const recent = Array.isArray(row._recent_captions)
  ? row._recent_captions.slice(-20).map((caption, index) => `${index + 1}. ${clean(caption).slice(0, 240)}`)
  : [];

const schema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'featured_birds', 'activity_name', 'location', 'verified_details', 'post_type', 'blurb',
    'instagram_caption', 'instagram_primary_hashtags', 'youtube_title', 'tiktok_caption',
    'tiktok_primary_hashtags', 'tiktok_additional_hashtags', 'x_caption', 'x_hashtags',
  ],
  properties: {
    featured_birds: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    activity_name: { type: 'string' },
    location: { type: 'string' },
    verified_details: { type: 'string' },
    post_type: { type: 'string', enum: ['Tour', 'Bird', 'Wildlife', 'Location', 'Educational', 'Behind the Scenes', 'General', 'Destination', 'Activities'] },
    blurb: { type: 'string' },
    instagram_caption: { type: 'string' },
    instagram_primary_hashtags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
    youtube_title: { type: 'string' },
    tiktok_caption: { type: 'string' },
    tiktok_primary_hashtags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
    tiktok_additional_hashtags: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 10 },
    x_caption: { type: 'string' },
    x_hashtags: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 2 },
  },
};

const prompt = `You are the local senior editor and platform copywriter for Mindo Bird Watching.

USER'S QUICK DESCRIPTION (factual authority):
"""${clean(row.reel_description)}"""

OPTIONAL EXISTING FIELDS (also factual when present):
Featured birds: ${clean(row.featured_birds)}
Activity: ${clean(row.activity_name)}
Location: ${clean(row.location) || 'Mindo, Ecuador'}
Verified details: ${clean(row.verified_details)}
Post type: ${clean(row.post_type)}

RECENT INSTAGRAM COPY TO AVOID REPEATING:
${recent.length ? recent.join('\n') : 'No recent copy supplied.'}

Extract the facts and create finished platform copy.

Grounding rules:
- Use only facts explicitly supplied above.
- Correct obvious spelling and capitalization errors in bird names, but never invent a species.
- Copy correctly spelled bird names exactly as supplied. Never substitute or change a correct bird name.
- If no different location is explicitly stated, use exactly "Mindo, Ecuador".
- featured_birds must contain clean common names only, in the order mentioned.
- verified_details must briefly restate only supplied facts.
- Do not add sensory staging, scenery, habitat, appearance, behavior, weather, or atmosphere that is not literally supplied.

Editorial rules:
- Write like a knowledgeable local guide, not a travel brochure or AI assistant.
- Open with a concrete person, bird, place, or action from the intake. Never open with a broad claim about how birding "can unfold" or what an outing "can bring".
- Prefer one vivid, factual scene over an abstract recap. Do not label the content as "three distinct moments" or explain that each moment "offers something different to notice".
- Do not use rhetorical engagement questions such as "Which one caught your eye?" The CTA should be direct and useful.
- Lead with the most concrete subject or moment. Never begin with "One birdwatching", "Each birdwatching", or another article followed by the activity name.
- Paraphrase the quick description naturally; do not paste it as a complete sentence into the caption.
- Use the full location no more than once per platform field.
- Remove trailing ellipses and incomplete fragments.
- Name the birds in the title when birds are supplied; a one-word generic title such as "birdwatching", "birding", "tour", "nature", or "reel" is forbidden.
- Avoid generic filler including "can bring several distinct moments together", "can unfold in unexpected ways", "three distinct moments", "each offering something different to notice", "which one would have caught your eye", "those are the details that made this experience worth sharing", "every outing develops from the moments that are actually present", "this was the clear focus here", "supplied details are the focus", and "the account stays with the moment as described".
- Avoid clickbait or decorative filler such as "showdown", "adding a splash of color", or "turn this into a memorable adventure". Do not imply that two birds interacted unless the intake explicitly says they did.
- Do not reuse openings, sentence patterns, CTA wording, or framing from recent copy.
- Do not claim rarity, guarantees, emotions, behavior, habitat, weather, or sightings that were not supplied.

Platform rules:
- blurb: factual, 35–70 words, no hashtags or CTA.
- Instagram: 40–80 words total, 2 short paragraphs, one natural CTA, no hashtags or emojis inside the caption.
- Instagram primary hashtags: exactly 2 contextual tags. When birds are supplied, at least one tag must name a supplied bird; prefer species and birding-intent tags over invented scene mashups.
- YouTube title: natural Title Case, 45–90 characters, naming a supplied bird or concrete subject and including "Mindo, Ecuador" naturally.
- TikTok: 1–2 short lines, 8–35 words, concrete rather than generic. No hashtags or emojis inside the caption.
- TikTok primary hashtags: exactly 2 contextual tags; when birds are supplied, at least one must name a supplied bird.
- TikTok additional hashtags: 5–10 factual discovery tags.
- X: conversational, concrete, at most 240 characters before hashtags. No hashtags or emojis inside x_caption.
- Core hashtags are added later. Do not include #mindobirdwatching, #mindo, or #ecuador in the two contextual arrays.
- Never use #fyp, #viral, #FY, #explorepage, generic labels such as #Birds or #Child, or invented compound tags such as #RainyRiver, #RiverPlay, or #RainyDay.
- Before returning JSON, reread every sentence for grammar, repetition, fragments, ellipses, copied intake wording, filler, and unsupported claims.

Return only JSON matching the supplied schema.`;

row._ollama_body = {
  model: 'gpt-oss:20b',
  messages: [
    { role: 'system', content: 'Return valid JSON matching the supplied schema. Use only supplied facts. Rewrite until the prose is natural and publication-ready.' },
    { role: 'user', content: prompt },
  ],
  stream: false,
  think: 'medium',
  format: schema,
  keep_alive: '30m',
  options: { temperature: 0.35, num_predict: 3200, seed: Number(row.post_id || 1) },
};

return { json: row };
