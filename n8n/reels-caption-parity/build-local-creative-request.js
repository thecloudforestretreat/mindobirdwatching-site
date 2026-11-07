const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const row = { ...$json };
// Preserve the human-entered bird field separately. The writer's extracted
// featured_birds value is a candidate, not factual authority.
row._input_featured_birds = clean(row.featured_birds);
const birdTypes = '(?:Cock-of-the-Rock|Toucanet|Toucan|Barbet|Motmot|Potoo|Hummingbird|Duck|Antpitta|Quetzal|Trogon|Tanager|Manakin|Flycatcher|Woodpecker|Owl|Hawk|Eagle|Heron|Kingfisher|Parrot|Parakeet|Jay|Finch|Warbler|Wren|Thrush|Oriole|Cacique|Oropendola|Honeycreeper|Euphonia|Vireo|Sparrow|Dove|Pigeon|Rail|Coot|Grebe|Cormorant|Ibis|Snipe|Sandpiper)s?';
const leadingNoise = new Set(['a','an','the','and','or','plus','with','some','several','one','two','three','four','this','that','our','their','guests','tour','walk','outing','featured','found','saw','seen','seeing','we','they','while','then','early','morning']);
const titleWord = word => word.split('-').map((part, index) => {
  if (!part) return part;
  return index === 0 ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part.toLowerCase();
}).join('-');
const detectedBirds = [];
const birdPattern = new RegExp(`\\b(?:[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’\\-]*\\s+){0,4}${birdTypes}\\b`, 'gi');
for (const match of clean(row.reel_description).matchAll(birdPattern)) {
  const tokens = clean(match[0]).split(/\s+/);
  while (tokens.length > 1 && leadingNoise.has(tokens[0].toLowerCase().replace(/[^a-z-]/g, ''))) tokens.shift();
  if (!tokens.length) continue;
  tokens[tokens.length - 1] = tokens[tokens.length - 1].replace(/s$/i, '');
  const candidate = tokens.map(titleWord).join(' ').replace(/Cock-of-the-rock/g, 'Cock-of-the-Rock');
  if (candidate && !detectedBirds.some(value => value.toLowerCase() === candidate.toLowerCase())) detectedBirds.push(candidate);
}
row._source_birds_detected = detectedBirds;
const location = clean(row.location) || 'Mindo, Ecuador';
const destinationContext = /\bmindo\b/i.test(location)
  ? 'Mindo, Ecuador is in the Andean Choc\u00f3 cloud forest. Cloud forest, mist, humidity, and frequent rain are established characteristics of the destination. These stable destination facts may be used naturally, but do not claim that rain or mist occurred during this specific outing unless the intake says so.'
  : 'No destination fact pack is available. Use only the supplied location and intake facts.';
const recent = Array.isArray(row._recent_captions)
  ? row._recent_captions.slice(-20).map((caption, index) => `${index + 1}. ${clean(caption).slice(0, 240)}`)
  : [];
const factualInput = [
  row.reel_description,
  row.featured_birds,
  row.activity_name,
  row.verified_details,
  row.post_type,
].map(clean).filter(Boolean).join(' ');
const commercialIntent = /\b(new|launch|introduc(?:e|ing)|offer(?:ing)?|book(?:ing)?|reserve|availability|message us|plan (?:a|your)|tour package)\b/i.test(factualInput);
const ctaGuidance = commercialIntent
  ? 'The intake has a genuine commercial or announcement purpose. A short, specific next step is allowed, but it must match that purpose and must not sound like an advertisement.'
  : 'The intake does not ask for a sale. Do not add a booking CTA, "message us", "join us", "plan your trip", or a generic engagement question. End with the concrete observation.';

const schema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'featured_birds',
    'activity_name',
    'location',
    'verified_details',
    'post_type',
    'blurb',
    'instagram_caption',
    'instagram_primary_hashtags',
    'youtube_title',
    'tiktok_caption',
    'tiktok_primary_hashtags',
    'tiktok_additional_hashtags',
    'x_caption',
    'x_hashtags',
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

const prompt = `You are the local editorial strategist and platform copywriter for Mindo Bird Watching.

USER'S QUICK DESCRIPTION (factual authority):
"""${clean(row.reel_description)}"""

OPTIONAL EXISTING FIELDS (also factual when present):
Featured birds: ${clean(row.featured_birds)}
Bird names detected verbatim from the description: ${detectedBirds.join(' | ') || 'None detected'}
Activity: ${clean(row.activity_name)}
Location: ${location}
Verified details: ${clean(row.verified_details)}
Post type: ${clean(row.post_type)}

VERIFIED DESTINATION CONTEXT:
${destinationContext}

RECENT INSTAGRAM COPY TO AVOID REPEATING:
${recent.length ? recent.join('\n') : 'No recent copy supplied.'}

Extract the facts and create finished platform copy.

Grounding rules:
- Use the supplied facts and the verified destination context above.
- Correct obvious spelling and capitalization errors in bird names, but never invent a species.
- Copy correctly spelled bird names exactly as supplied. Never substitute, pluralize, or change a word in an already correct bird name.
- If no different location is explicitly stated, use exactly "Mindo, Ecuador".
- If the description says tour, guests, birding, birdwatching, early morning, night walk, or another activity, reflect it naturally.
- featured_birds must contain clean common names only, in the order mentioned.
- When bird names were detected from the description, copy those names exactly into featured_birds. They override any model guess.
- verified_details must briefly restate only supplied facts.
- Stable destination facts may add useful local context. Do not turn a regional characteristic into a claim about the exact weather or conditions during this specific outing.
- Words such as moonlit, moonlight, lantern, canopy, plumage, elusive, rare, river, current, rapids, nest, feeding, dawn, or glow may be used only when that fact appears in the supplied description or optional fields. For Mindo, general cloud-forest, mist, humidity, and rain context is permitted by the destination fact pack; specific conditions in the footage still require intake evidence.

Creative rules:
- Write like a knowledgeable local guide sending a clear field note after the outing, not a travel brochure, brand campaign, nature documentary, or AI assistant.
- Choose the strongest angle for this specific reel: guest experience, a tour moment, species contrast, field observation, education, destination, or atmosphere.
- Do not reuse openings, sentence patterns, CTA wording, or framing from the recent copy.
- Use ordinary words, contractions when they fit, and varied sentence lengths. It is acceptable for the caption to be understated.
- Open with a concrete supplied detail. Do not open with "During this outing", "This reel", "This video", "One birding", "Two birds, two...", or a generic statement about Mindo.
- Avoid stock AI/travel-copy phrases, including "This reel follows", "This reel shows", "The video shows", "Imagine", "Step into", "hidden paradise", "nature's symphony", "mist-kissed", "living tapestry", "feathered wonders", "where time slows down", "set the scene", "rich avian diversity", "the mix of species shows", "cloud forest delivered", "were observed", "splash of color", "striking species", "in its own way", "just long enough", "one of the best chances", "what makes this special", "a reminder that", and "witness ... up close".
- Do not end with "Which one caught your eye?", "Which one caught your attention?", "What would you notice first?", or another engagement question unless the intake explicitly asks for audience participation.
- Prefer plain observations a local guide would actually say. Do not pad the caption with generic atmosphere, an inspirational conclusion, a summary sentence, or claims that the sighting "showcases" Mindo.
- Do not claim rarity, reliability, guarantees, emotions, behavior, habitat, weather, or sightings that were not supplied. Avoid unsupported taglines such as "Reliable morning birding."
- First-person language such as "we saw" or "our guests" is allowed only when the factual intake uses we, us, our, guests, or tourists.

CTA decision:
${ctaGuidance}

Platform rules:
- blurb: factual, 40–80 words, no hashtags or CTA.
- Instagram: 35–100 words, aim for 45–65 words in 2–4 sentences, warm, specific, and conversational. Count the caption words before returning JSON. It must have at least 35 and at most 100 words, excluding hashtags. Develop the supplied observation with specific, factual phrasing; do not add invented details or filler merely to make the caption longer. A CTA is optional and governed by the CTA decision above. No hashtags or emojis inside the caption.
- Instagram primary hashtags: exactly 2 contextual tags; do not include #mindobirdwatching, any compound containing "mindobirdwatching", #mindo, or #ecuador.
- YouTube title: descriptive Title Case, 45–90 characters, include "Mindo, Ecuador" naturally.
- TikTok: 1–2 short lines, 8–35 words, concrete rather than generic. No hashtags or emojis inside the caption.
- TikTok primary hashtags: exactly 2 contextual tags, excluding the three core tags.
- TikTok additional hashtags: 5–10 factual discovery tags.
- X: conversational, concrete, at most 240 characters before hashtags. No hashtags or emojis inside x_caption.
- Do not put hashtags into any caption field; return them only in the hashtag arrays.
- Do not use emojis anywhere.
- Never use #fyp, #viral, #FY, or #explorepage.
- Before returning JSON, read the Instagram caption aloud. If it sounds polished enough for a tourism brochure, contains a generic lesson, or could describe almost any birding reel, rewrite it in plainer language.
- Verify that every supplied bird appears with the same common name, every platform meets its stated length rule, and every descriptive claim can be pointed back to the factual authority above.

Return only JSON matching the supplied schema.`;

row._ollama_body = {
  model: 'gpt-oss:20b',
  messages: [
    { role: 'system', content: 'Return valid JSON matching the supplied schema. Use only supplied facts.' },
    { role: 'user', content: prompt },
  ],
  stream: false,
  think: 'low',
  format: schema,
  keep_alive: '30m',
  options: {
    temperature: 0.52,
    // Structured multi-platform JSON can exceed 1,000 tokens even when every
    // public caption is concise. Keep enough headroom to avoid truncated JSON.
    num_predict: 1600,
    seed: Number(row.post_id || 1),
  },
};

return { json: row };
  