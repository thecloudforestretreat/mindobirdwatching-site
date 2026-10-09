import json
import uuid
from pathlib import Path

OUT = Path("MBW - AI Carousels - IMPORT.json")

DOC_URL = "https://docs.google.com/spreadsheets/d/1TCwGEscdKFVBH1C-2tnozoFrNS-rQiTgHA4M7iPX3-8/edit?usp=sharing"
SHEET_NAME = "ai_carousels"
IG_USER_ID = "17841471335674238"
FB_PAGE_ID = "753092067877601"
GRAPH_VERSION = "v23.0"
IG_LOCATION_ID = "217339241"  # Verified Instagram place: Mindo, Ecuador
IG_COLLABORATORS = ["mindo.chicho", "mindo.tours", "chocoandino.tours"]

GS_CRED = {"googleSheetsOAuth2Api": {"id": "sJdVMmql2IyZ94ti", "name": "Google Sheets - MBW"}}
IG_CRED = {"facebookGraphApi": {"id": "herDuII5ILdZK9vI", "name": "Facebook Graph - MBW3"}}
FB_CRED = {"facebookGraphApi": {"id": "hKtqKmiLtyPbhYMw", "name": "Facebook Graph - MBW"}}
GEMINI_CRED = {"httpHeaderAuth": {"id": "pUqvnQ1eJqGqakpW", "name": "x-goog-api-key"}}
TG_CRED = {"telegramApi": {"id": "fvhEZEI6Ksxrj9DD", "name": "MBW - Notifications"}}

HEADERS = [
    "carousel_id",
    *[f"image_{i}_url" for i in range(1, 11)],
    "images_json", "carousel_description", "slide_notes", "featured_birds", "scientific_name", "activity_name", "location",
    "verified_details", "input_status", "scheduled_date", "scheduled_time", "status", "media_type",
    "post_to_instagram", "post_to_facebook", "local_brief", "copy_review_status",
    "caption_generation_status", "carousel_title", "caption", "instagram_hashtags", "facebook_caption", "facebook_hashtags",
    "reddit_title", "reddit_caption", "reddit_hashtags",
    "copy_generated_at", "ai_model", "gemini_input_tokens", "gemini_output_tokens",
    "gemini_total_tokens", "posting_defaults_applied_at", "publishing_lock",
    "instagram_container_id", "instagram_published_date", "instagram_post_id", "instagram_permalink",
    "facebook_photo_ids", "facebook_published_date", "facebook_post_id", "facebook_permalink",
    "error_message", "telegram_sent_date", "approval_status", "quality_score",
    "submitted_at", "source", "timezone", "admin_mode"
]


def uid(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "mbw-ai-carousels/" + name))


def node(name, typ, version, position, parameters=None, credentials=None, **extra):
    data = {
        "parameters": parameters or {},
        "type": typ,
        "typeVersion": version,
        "position": position,
        "id": uid(name),
        "name": name,
    }
    if credentials:
        data["credentials"] = credentials
    data.update(extra)
    return data


def schema():
    boolean_headers = {"post_to_instagram", "post_to_facebook"}
    numeric_headers = {"gemini_input_tokens", "gemini_output_tokens", "gemini_total_tokens", "quality_score"}
    return [
        {
            "id": h,
            "displayName": h,
            "required": False,
            "defaultMatch": False,
            "display": True,
            "type": "boolean" if h in boolean_headers else "number" if h in numeric_headers else "string",
            "canBeUsedToMatch": True,
            "removed": False,
        }
        for h in HEADERS
    ] + [{
        "id": "row_number", "displayName": "row_number", "required": False,
        "defaultMatch": False, "display": True, "type": "number",
        "canBeUsedToMatch": True, "readOnly": True, "removed": True,
    }]


def sheet_ref():
    return {"__rl": True, "value": SHEET_NAME, "mode": "name"}


def doc_ref():
    return {"__rl": True, "value": DOC_URL, "mode": "url"}


def gs_read(name, position, filters=None):
    p = {"documentId": doc_ref(), "sheetName": sheet_ref(), "options": {}}
    if filters:
        p["filtersUI"] = {"values": filters}
    return node(name, "n8n-nodes-base.googleSheets", 4.6, position, p, GS_CRED, retryOnFail=True)


def gs_update(name, position, values):
    p = {
        "operation": "update",
        "documentId": doc_ref(),
        "sheetName": sheet_ref(),
        "columns": {
            "mappingMode": "defineBelow",
            "value": values,
            "matchingColumns": ["carousel_id"],
            "schema": schema(),
            "attemptToConvertTypes": False,
            "convertFieldsToString": False,
        },
        "options": {},
    }
    return node(name, "n8n-nodes-base.googleSheets", 4.6, position, p, GS_CRED, retryOnFail=True)


def if_node(name, position, left):
    return node(name, "n8n-nodes-base.if", 2.2, position, {
        "conditions": {
            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
            "conditions": [{
                "id": uid(name + "/condition"),
                "leftValue": left,
                "rightValue": "",
                "operator": {"type": "boolean", "operation": "true", "singleValue": True},
            }],
            "combinator": "and",
        },
        "options": {},
    })


def code_node(name, position, js):
    return node(name, "n8n-nodes-base.code", 2, position, {"jsCode": js})


CLASSIFY_JS = r"""
function has(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
function bool(v, defaultValue = false) {
  if (!has(v)) return defaultValue;
  if (typeof v === 'boolean') return v;
  return ['true','1','yes','y','on'].includes(String(v).trim().toLowerCase());
}
function scheduledTimePassed(r) {
  const d = String(r.scheduled_date || '').trim();
  const t = String(r.scheduled_time || '').trim();
  if (!d || !t) return false;
  let dt = DateTime.fromFormat(d + ' ' + t, 'M/d/yyyy h:mm a', { zone: 'America/New_York' });
  if (!dt.isValid) dt = DateTime.fromFormat(d + ' ' + t, 'M/d/yyyy H:mm', { zone: 'America/New_York' });
  if (!dt.isValid) dt = DateTime.fromISO(d + 'T' + t, { zone: 'America/New_York' });
  return dt.isValid && dt.toMillis() <= DateTime.now().setZone('America/New_York').toMillis();
}
return $input.all().map(item => {
  const r = { ...item.json };
  const urls = Array.from({length: 10}, (_, i) => String(r[`image_${i + 1}_url`] || '').trim()).filter(Boolean);
  const inputStatus = String(r.input_status || '').trim().toUpperCase();
  const status = String(r.status || '').trim().toLowerCase();
  const queued = status === 'queued';
  const approved = ['READY','VERIFIED'].includes(inputStatus);
  const due = queued || (status === 'scheduled' && scheduledTimePassed(r));
  const valid = has(r.carousel_id) && urls.length >= 2 && urls.length <= 10 && new Set(urls).size === urls.length && has(r.featured_birds) && approved;
  r.media_type = 'CAROUSEL';
  r.post_to_instagram = bool(r.post_to_instagram, true);
  r.post_to_facebook = bool(r.post_to_facebook, true);
  r._needs_generation = !has(r.carousel_title) || !has(r.caption) || !has(r.instagram_hashtags) || !has(r.facebook_caption) || !has(r.facebook_hashtags) || !has(r.reddit_title) || !has(r.reddit_caption) || !has(r.reddit_hashtags) || !String(r.ai_model || '').includes('en-US v6');
  r._process = valid && due;
  r._is_testing = queued;
  r._validation_error = !has(r.carousel_id) ? 'Missing carousel_id' :
    (urls.length < 2 || urls.length > 10) ? 'Between two and ten image URLs are required' :
    new Set(urls).size !== urls.length ? 'All carousel image URLs must be unique' :
    !has(r.featured_birds) ? 'Missing featured_birds' :
    !approved ? 'input_status must be READY or VERIFIED' : '';
  return { json: r };
});
""".strip()

OLLAMA_BODY = r"""={{ {
  model: 'gpt-oss:20b',
  messages: [
    { role: 'system', content: 'You are a factual grounding assistant for Mindo Bird Watching. Use only facts explicitly stated in the supplied text. Never infer ecology, diet, behavior, habitat, breeding, clutch size, conservation status, sightings, rarity, or abundance from a bird name, scientific name, filename, image type, or general knowledge. If a detail is not written in the inputs, omit it. Return valid JSON only.' },
    { role: 'user', content: `Create one concise factual brief for a 2–10 slide carousel.\nDescription: ${$json.carousel_description || ''}\nSlide notes: ${$json.slide_notes || ''}\nFeatured birds: ${$json.featured_birds || ''}\nScientific name: ${$json.scientific_name || ''}\nActivity: ${$json.activity_name || ''}\nLocation: ${$json.location || ''}\nVerified details: ${$json.verified_details || ''}\nReturn JSON: {"brief":"...","facts_used":["..."]}` }
  ],
  stream: false,
  think: 'low',
  format: 'json',
  keep_alive: '30m',
  options: { temperature: 0.1, num_predict: 500 }
} }}"""

EDITOR_BODY = r"""={{ {
  model: 'gpt-oss:20b',
  messages: [
    { role: 'system', content: 'You are the first-pass social copywriter for Mindo Bird Watching. Write vivid, natural copy without inventing facts. Return valid JSON only.' },
    { role: 'user', content: `Draft distinct, captivating, factual copy for Instagram, Facebook, and Reddit. Use only the grounded brief, original text, and visual inventory. A bird name alone supports naming the bird and presenting the images, but not claims about ecology, diet, behavior, habitat, breeding, conservation, rarity, abundance, sightings, or guest reactions. Visual inventory labels such as photo, xray, and infographic support describing those formats, but not unseen details inside them. Avoid generic internal phrases including "submitted images", "submitted visual details", "featured bird", "visual story", and "complete carousel". Build a hook, a clear slide-to-slide narrative, and one natural question or CTA.\n\nGrounded brief: ${$json.message?.content || ''}\nOriginal description: ${$('Classify Carousel').item.json.carousel_description || ''}\nSlide notes: ${$('Classify Carousel').item.json.slide_notes || ''}\nVisual inventory: ${$('Classify Carousel').item.json.images_json || ''}\nFeatured birds: ${$('Classify Carousel').item.json.featured_birds || ''}\nScientific name: ${$('Classify Carousel').item.json.scientific_name || ''}\nLocation: ${$('Classify Carousel').item.json.location || ''}\nVerified details: ${$('Classify Carousel').item.json.verified_details || ''}\n\nReturn JSON: {"carousel_title":"engaging title under 80 characters","caption":"Instagram caption, 50-120 words, 2-3 short paragraphs, one CTA, no hashtags","instagram_hashtags":["#mindobirdwatching","#mindo","#ecuador","#ActualSpeciesName","#ActualRelevantTopic"],"facebook_caption":"Facebook caption, 50-140 words, friendly and grounded, no hashtags","facebook_hashtags":["#mindobirdwatching","#ActualSpeciesName","#EcuadorBirds"],"reddit_title":"natural non-promotional Reddit title under 120 characters","reddit_caption":"Reddit body, 35-120 words, conversational and factual, no sales language or hashtags","reddit_hashtags":["#ActualSpeciesName","#BirdPhotography","#Ecuador"]}. Use real subject-specific hashtags; placeholders are forbidden.` }
  ],
  stream: false, think: 'low', format: 'json', keep_alive: '30m',
  options: { temperature: 0.42, num_predict: 2100, seed: Number($('Classify Carousel').item.json.row_number || 1) + 200003 }
} }}"""

FINAL_EDITOR_BODY = r"""={{ {
  model: 'gpt-oss:20b',
  messages: [
    { role: 'system', content: 'You are the independent senior editor and factual reviewer for Mindo Bird Watching. Rewrite weak copy instead of merely rejecting it. Return valid JSON only.' },
    { role: 'user', content: `Review and, when necessary, rewrite the first-pass draft below. Your final copy must be factual, specific to the supplied carousel formats, engaging, free of repetition, and ready for a human to approve. Use only the grounded brief, original text, and visual inventory. Do not add biological or experiential claims that are absent from those sources. Remove generic internal language such as "submitted images", "submitted visual details", "featured bird", "visual story", "complete carousel", and generic "follow for more" endings.\n\nFirst-pass draft: ${$json.message?.content || ''}\nGrounded brief: ${$('[GEN] Local Grounding (Ollama)').item.json.message?.content || ''}\nOriginal description: ${$('Classify Carousel').item.json.carousel_description || ''}\nSlide notes: ${$('Classify Carousel').item.json.slide_notes || ''}\nVisual inventory: ${$('Classify Carousel').item.json.images_json || ''}\nFeatured birds: ${$('Classify Carousel').item.json.featured_birds || ''}\nScientific name: ${$('Classify Carousel').item.json.scientific_name || ''}\nLocation: ${$('Classify Carousel').item.json.location || ''}\nVerified details: ${$('Classify Carousel').item.json.verified_details || ''}\n\nReturn the complete rewritten package, not comments alone: {"carousel_title":"under 80 characters","caption":"Instagram caption, 50-120 words, 2-3 short paragraphs, one CTA, no hashtags","instagram_hashtags":["exactly 5"],"facebook_caption":"50-140 words, no hashtags","facebook_hashtags":["exactly 3"],"reddit_title":"under 120 characters","reddit_caption":"35-120 words, no hashtags","reddit_hashtags":["exactly 3"],"grounding_verdict":"PASS or FAIL","editorial_score":0-100,"review_verdict":"PASS or REVISE","review_notes":["specific remaining issue, or READY"]}. Score 92 or higher only when the copy has a strong hook, natural progression, clean platform adaptation, no generic filler, and no unsupported claims. If the draft is weak, rewrite it before scoring.` }
  ],
  stream: false, think: 'medium', format: 'json', keep_alive: '30m',
  options: { temperature: 0.24, num_predict: 2400, seed: Number($('Classify Carousel').item.json.row_number || 1) + 400009 }
} }}"""

PARSE_COPY_JS = r"""
function clean(v) { return String(v ?? '').trim(); }
function safeTag(v) {
  const s = clean(v).normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/^#+/, '').replace(/[^A-Za-z0-9]/g, '');
  return s ? '#' + s : '';
}
const base = { ...$('Classify Carousel').item.json };
let local = {};
try { local = JSON.parse($('[GEN] Local Grounding (Ollama)').item.json.message?.content || '{}'); } catch (_) {}
let parsed = {};
try {
  const raw = $json.message?.content || $json.response || '';
  parsed = JSON.parse(raw);
} catch (_) {}
let firstPass = {};
try { firstPass = JSON.parse($('[GEN] Independent Local Copy Editor').item.json.message?.content || '{}'); } catch (_) {}
if (!Object.keys(parsed).length) parsed = firstPass;
const fallbackBrief = [base.carousel_description, base.featured_birds, base.activity_name, base.location, base.verified_details].filter(Boolean).join('. ');
const imageCount = Array.from({length:10},(_,i)=>clean(base[`image_${i+1}_url`])).filter(Boolean).length;
const bird = clean(base.featured_birds) || 'featured bird';
const scientific = clean(base.scientific_name) ? ` (${clean(base.scientific_name)})` : '';
const location = clean(base.location) || 'Mindo, Ecuador';
const descriptionWords = clean(base.carousel_description).split(/\s+/).filter(Boolean).slice(0,45).join(' ');
const description = descriptionWords ? descriptionWords.replace(/[.!?]+$/,'') + '.' : '';
let manifest = [];
try { manifest = JSON.parse(base.images_json || '[]'); } catch (_) {}
const types = new Set(manifest.map(image => clean(image.content_type).toLowerCase()));
const hasPhoto = types.has('photo'), hasXray = types.has('xray'), hasGraphic = types.has('infographic');
const sequence = hasPhoto && hasXray && hasGraphic
  ? `Begin with a field portrait, continue with an X-ray anatomy study, and finish with an illustrated reference.`
  : `Move through the ${imageCount || 'several'} frames one at a time and notice how each presentation changes the way the subject is seen.`;
const fallbackTitle = `${bird}: Portrait, Structure & Story`;
const fallbackCaption = `One bird, ${imageCount || 'several'} ways to look closer. ${sequence} ${description} Together, the images move from first impression to a more considered view of the ${bird}${scientific}, while keeping every statement grounded in the material provided. Swipe through, pause on the details that catch your attention, and tell us which frame you would return to first. Save the carousel as inspiration for your next birding experience in ${location}.`.replace(/\s+/g,' ').trim();
const fallbackFacebook = `Take a closer look at the ${bird}${scientific} from ${location}. ${sequence} ${description} The sequence brings photography and educational presentation together without adding claims beyond the material supplied for the post. Browse all ${imageCount || 'the'} frames, then tell us which approach helped you see the subject differently. Save the set for later or share it with someone who enjoys learning about birds through both images and visual reference material.`.replace(/\s+/g,' ').trim();
const fallbackRedditTitle = `${bird} from ${location} — ${imageCount || 'multiple'} images`;
const fallbackReddit = `Sharing a ${imageCount || 'multi'}-image set focused on the ${bird}${scientific} from ${location}. ${sequence} ${description} The aim is to compare several ways of presenting the same subject without adding claims beyond the available material. Which frame communicates the subject most clearly to you, and why?`.replace(/\s+/g,' ').trim();
const contextSeeds = [base.featured_birds, base.activity_name, 'BirdingEcuador'].flatMap(v => clean(v).split(/[|,]/)).map(safeTag).filter(Boolean);
const tags = ['#mindobirdwatching','#mindo','#ecuador', ...contextSeeds];
const uniqueTags = [...new Map(tags.map(t => [t.toLowerCase(), t])).values()].slice(0, 5);
while (uniqueTags.length < 5) uniqueTags.push(['#CloudForest','#Birdwatching'][uniqueTags.length - 3] || '#NatureEcuador');
const placeholderTag = tag => /(?:contexttag|placeholder|hashtag\d*|example|sampletag|tag\d+)$/i.test(tag.replace(/^#/,''));
const proposed = (Array.isArray(parsed.instagram_hashtags) ? parsed.instagram_hashtags : clean(parsed.instagram_hashtags).split(/\s+/)).map(safeTag).filter(tag => tag && !placeholderTag(tag));
const fixedTagKeys = new Set(['#mindobirdwatching','#mindo','#ecuador']);
const contextual = [...contextSeeds, ...proposed.filter(tag => !fixedTagKeys.has(tag.toLowerCase()))];
const finalTags = [...new Map(['#mindobirdwatching','#mindo','#ecuador',...contextual].map(t => [t.toLowerCase(),t])).values()].slice(0,5);
while (finalTags.length < 5) finalTags.push(uniqueTags[finalTags.length]);
const tagsFrom = (value, fallback, limit) => {
  const proposedTags = (Array.isArray(value) ? value : clean(value).split(/\s+/)).map(safeTag).filter(tag => tag && !placeholderTag(tag));
  return [...new Map([...proposedTags,...fallback].map(tag => [tag.toLowerCase(),tag])).values()].slice(0,limit).join(' ');
};
const stripTrailingHashtags = v => clean(v).replace(/\s*(?:#[\p{L}\p{N}_-]+\s*)+$/gu, '').trim();
const parsedCaption = stripTrailingHashtags(parsed.caption);
const parsedTitle = clean(parsed.carousel_title);
const parsedFacebook = stripTrailingHashtags(parsed.facebook_caption);
const parsedRedditTitle = clean(parsed.reddit_title);
const parsedReddit = stripTrailingHashtags(parsed.reddit_caption);
const sourceText = [base.carousel_description,base.slide_notes,base.verified_details,base.images_json].map(clean).join(' ').toLowerCase();
const candidateText = [parsedTitle,parsedCaption,parsedFacebook,parsedRedditTitle,parsedReddit].join(' ').toLowerCase();
const guardedTerms = ['ecosystem','plumage','colorful','forest','perch','tail','beak','diet','habitat','behavior','breeding','conservation','endemic','nocturnal','migratory','rare','abundant'];
const unsupportedTerms = guardedTerms.filter(term => candidateText.includes(term) && !sourceText.includes(term));
const useFallback = !parsedCaption || unsupportedTerms.length > 0;
const caption = useFallback ? fallbackCaption : parsedCaption;
const title = useFallback ? fallbackTitle : (parsedTitle || fallbackTitle);
const facebook = useFallback ? fallbackFacebook : (parsedFacebook || fallbackFacebook);
const facebookTags = tagsFrom(parsed.facebook_hashtags,[finalTags[0],finalTags[3], '#EcuadorBirds'],3);
const redditTitle = useFallback ? fallbackRedditTitle : (parsedRedditTitle || fallbackRedditTitle);
const reddit = useFallback ? fallbackReddit : (parsedReddit || fallbackReddit);
const redditTags = tagsFrom(parsed.reddit_hashtags,[finalTags[3], '#BirdPhotography', '#Ecuador'],3);
const forbidden = /guaranteed?|always see|will see|\brare\b|abundant|natural habitat|expert guides?|won't miss|will not miss|elusive/i;
const issues = [];
const finalText = [title,caption,facebook,redditTitle,reddit].join(' ');
if (forbidden.test(finalText)) issues.push('unsupported or exaggerated wording');
if (clean(parsed.grounding_verdict).toUpperCase() !== 'PASS') issues.push('grounding reviewer did not pass');
if (clean(parsed.review_verdict).toUpperCase() !== 'PASS') issues.push('editorial reviewer requested revision');
if (unsupportedTerms.length) issues.push(`unsupported terms: ${unsupportedTerms.join(', ')}`);
if (![title,caption,facebook,redditTitle,reddit].every(value => /^["'“‘(]*[A-Z0-9]/.test(value))) issues.push('copy must begin with a capital letter');
if (/\b(seening|seing|recieve|thier|alot)\b/i.test(finalText)) issues.push('obvious spelling error');
const instagramWords=(caption.match(/\S+/g)||[]).length, facebookWords=(facebook.match(/\S+/g)||[]).length, redditWords=(reddit.match(/\S+/g)||[]).length;
if (instagramWords < 50 || instagramWords > 120) issues.push('Instagram caption outside 50–120 words');
if (facebookWords < 50 || facebookWords > 140) issues.push('Facebook caption outside 50–140 words');
if (redditWords < 35 || redditWords > 120) issues.push('Reddit body outside 35–120 words');
if (title.length > 80 || redditTitle.length > 120) issues.push('generated title too long');
if (finalTags.length !== 5 || facebookTags.split(/\s+/).length !== 3 || redditTags.split(/\s+/).length !== 3) issues.push('platform hashtag counts invalid');
const genericPattern = /submitted (?:images|visual details)|featured bird|visual story|complete carousel|follow (?:us|mindo bird watching) for more/i;
if (genericPattern.test(finalText)) issues.push('generic internal or filler language');
const reviewerNotes = Array.isArray(parsed.review_notes) ? parsed.review_notes.map(clean).filter(Boolean) : [];
let editorialScore = Math.max(0,Math.min(100,Number(parsed.editorial_score)||70));
if (useFallback) editorialScore = Math.min(editorialScore,78);
if (issues.length) editorialScore = Math.min(editorialScore,89);
const ready = !issues.length && editorialScore >= 92;
base.local_brief = clean(local.brief) || fallbackBrief;
base.copy_review_status = ready ? 'PASS' : 'REVISE';
base.caption_generation_status = ready ? 'GENERATED_DOUBLE_PASS' : (useFallback ? 'SAFE_DRAFT_NEEDS_REVIEW' : 'NEEDS_EDITORIAL_REVIEW');
base.carousel_title = title.slice(0,120);
base.caption = caption;
base.instagram_hashtags = finalTags.join(' ');
base.facebook_caption = facebook;
base.facebook_hashtags = facebookTags;
base.reddit_title = redditTitle.slice(0,160);
base.reddit_caption = reddit;
base.reddit_hashtags = redditTags;
base.copy_generated_at = DateTime.now().setZone('America/New_York').toISO();
base.ai_model = 'gpt-oss:20b local writer + independent repair editor | en-US v6';
const autoMode = clean(base.admin_mode).toLowerCase() === 'auto';
base.approval_status = autoMode && ready ? 'APPROVED' : 'NEEDS_REVIEW';
base.quality_score = editorialScore;
base.error_message = ready ? '' : `COPY REVIEW REQUIRED: ${[...issues,...reviewerNotes].filter(Boolean).slice(0,5).join(' | ') || 'editorial score below 92'}`;
if (autoMode && ready) {
  base.input_status = 'VERIFIED';
  base.status = 'Scheduled';
} else {
  base.status = ready ? 'Testing' : 'Needs Review';
}
base.gemini_input_tokens = 0;
base.gemini_output_tokens = 0;
base.gemini_total_tokens = 0;
return [{ json: base }];
""".strip()

RECLASSIFY_JS = r"""
function has(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
function bool(v, d=false) { if (!has(v)) return d; if (typeof v === 'boolean') return v; return ['true','1','yes','y','on'].includes(String(v).trim().toLowerCase()); }
function stripTrailingHashtags(v) { return String(v ?? '').trim().replace(/\s*(?:#[\p{L}\p{N}_-]+\s*)+$/gu, '').trim(); }
function scheduledTimePassed(r) {
  const d=String(r.scheduled_date||'').trim(), t=String(r.scheduled_time||'').trim();
  if (!d || !t) return false;
  let dt=DateTime.fromFormat(d+' '+t,'M/d/yyyy h:mm a',{zone:'America/New_York'});
  if (!dt.isValid) dt=DateTime.fromISO(d+'T'+t,{zone:'America/New_York'});
  return dt.isValid && dt.toMillis() <= DateTime.now().setZone('America/New_York').toMillis();
}
return $input.all().map(item => {
  const r={...item.json};
  r.caption=stripTrailingHashtags(r.caption);
  r.facebook_caption=stripTrailingHashtags(r.facebook_caption);
  r.post_to_instagram=bool(r.post_to_instagram,true);
  r.post_to_facebook=bool(r.post_to_facebook,true);
  const status=String(r.status||'').trim().toLowerCase();
  r._is_testing=status==='testing' || String(r.copy_review_status||'').trim().toUpperCase()!=='PASS' || (status==='scheduled' && !scheduledTimePassed(r));
  return {json:r};
});
""".strip()

LOCK_JS = r"""
function has(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
function bool(v,d=false) { if (!has(v)) return d; if (typeof v==='boolean') return v; return ['true','1','yes','y','on'].includes(String(v).trim().toLowerCase()); }
const r={...$json};
const urls=Array.from({length:10},(_,i)=>String(r[`image_${i+1}_url`]||'').trim()).filter(Boolean);
if (urls.length < 2 || urls.length > 10) throw new Error('PUBLISH BLOCKED: between two and ten image URLs are required.');
if (new Set(urls).size !== urls.length) throw new Error('PUBLISH BLOCKED: all carousel image URLs must be unique.');
r._image_urls=urls;
if (!has(r.caption) || !has(r.instagram_hashtags) || !has(r.facebook_caption)) throw new Error('PUBLISH BLOCKED: caption fields are incomplete.');
if (String(r.input_status||'').trim().toUpperCase() !== 'VERIFIED') throw new Error('PUBLISH BLOCKED: carousel is not verified.');
const reviewStatus=String(r.copy_review_status||'').trim().toUpperCase();
if (String(r.approval_status||'').trim().toUpperCase() !== 'APPROVED' || !['PASS','HUMAN_EDITED'].includes(reviewStatus) || (reviewStatus==='PASS' && Number(r.quality_score||0) < 92)) throw new Error('PUBLISH BLOCKED: approved copy must pass both local reviews or contain validated human edits.');
r.post_to_instagram=bool(r.post_to_instagram,true);
r.post_to_facebook=bool(r.post_to_facebook,true);
if (!r.post_to_instagram && !r.post_to_facebook) throw new Error('PUBLISH BLOCKED: no platform is selected.');
if (has(r.publishing_lock)) throw new Error('PUBLISH BLOCKED: this row already has a publishing lock. Review it before retrying.');
if (r.post_to_instagram && has(r.instagram_container_id) && !has(r.instagram_post_id)) throw new Error('RECOVERY REQUIRED: Instagram container exists without a saved post ID. Automatic reposting was blocked.');
if (r.post_to_facebook && has(r.facebook_photo_ids) && !has(r.facebook_post_id)) throw new Error('RECOVERY REQUIRED: Facebook photo IDs exist without a saved post ID. Automatic reposting was blocked.');
r.publishing_lock=`execution-${$execution.id || 'manual'}-${DateTime.now().setZone('America/New_York').toISO()}`;
r.status='Publishing';
r.media_type='CAROUSEL';
r.error_message='';
r.posting_defaults_applied_at=r.posting_defaults_applied_at || DateTime.now().setZone('America/New_York').toISO();
return [{json:r}];
""".strip()

BUILD_IG_ITEMS_JS = r"""
const r={...$json};
const urls=Array.isArray(r._image_urls)?r._image_urls:Array.from({length:10},(_,i)=>String(r[`image_${i+1}_url`]||'').trim()).filter(Boolean);
return urls.map((image_url,i)=>({json:{...r,slide_number:i+1,image_url}}));
""".strip()

AGG_IG_JS = r"""
const items=$input.all();
if (items.length<2 || items.length>10 || items.some(i=>!i.json.id)) throw new Error('Instagram child-container creation did not return 2–10 valid IDs.');
const base={...$('[CORE] Attach Locked Row').item.json};
base.instagram_child_ids=items.map(i=>i.json.id);
return [{json:base}];
""".strip()

PREP_IG_PAYLOAD_JS = r"""
function clean(v){ return String(v ?? '').trim(); }
const r={...$json};
const caption=clean(r.caption), hashtags=clean(r.instagram_hashtags);
const locationId='217339241';
const collaborators=['mindo.chicho','mindo.tours','chocoandino.tours'];
if (!caption) throw new Error('PUBLISH BLOCKED: Instagram caption is blank immediately before container creation.');
if (!hashtags || !hashtags.includes('#')) throw new Error('PUBLISH BLOCKED: Instagram hashtags are blank or invalid immediately before container creation.');
if (!/^\d+$/.test(locationId)) throw new Error('PUBLISH BLOCKED: Instagram location ID is invalid.');
if (collaborators.length > 3 || collaborators.some(v=>!/^[-._a-z0-9]+$/.test(v))) throw new Error('PUBLISH BLOCKED: Instagram collaborators are invalid.');
r._instagram_publish_caption=`${caption}\n\n${hashtags}`.trim();
r._instagram_location_id=locationId;
r._instagram_location_name='Mindo, Ecuador';
r._instagram_collaborators=collaborators;
if (r._instagram_publish_caption.length < 40) throw new Error('PUBLISH BLOCKED: Instagram publish caption is unexpectedly short.');
return [{json:r}];
""".strip()

ATTACH_IG_PARENT_JS = r"""
const base={...$('[IG] Aggregate Child IDs').item.json};
if (!$json.id) throw new Error('Instagram parent container ID was not returned.');
base.instagram_container_id=$json.id;
return [{json:base}];
""".strip()

VALIDATE_IG_READY_JS = r"""
const status=String($json.status_code||'').toUpperCase();
if (!['FINISHED','PUBLISHED'].includes(status)) throw new Error(`Instagram carousel container is not ready: ${status || 'UNKNOWN'}. Publishing was not attempted.`);
return [{json:{...$('[IG] Attach Parent Container').item.json,instagram_status_code:status}}];
""".strip()

ATTACH_IG_PUBLISH_JS = r"""
const base={...$('[IG] Attach Parent Container').item.json};
if (!$json.id) throw new Error('Instagram publish did not return a media ID.');
base.instagram_post_id=$json.id;
base.instagram_published_date=DateTime.now().setZone('America/New_York').toFormat('yyyy-MM-dd HH:mm:ss');
return [{json:base}];
""".strip()

BUILD_FB_ITEMS_JS = r"""
const r={...$json};
const urls=Array.isArray(r._image_urls)?r._image_urls:Array.from({length:10},(_,i)=>String(r[`image_${i+1}_url`]||'').trim()).filter(Boolean);
return urls.map((image_url,i)=>({json:{...r,slide_number:i+1,image_url}}));
""".strip()

AGG_FB_JS = r"""
const items=$input.all();
if (items.length<2 || items.length>10 || items.some(i=>!i.json.id)) throw new Error('Facebook unpublished-photo creation did not return 2–10 valid IDs.');
const base={...$('[IG] Merge Completed or Skipped').item.json};
base.facebook_photo_ids=JSON.stringify(items.map(i=>i.json.id));
base._facebook_attached_media=items.map(i=>({media_fbid:i.json.id}));
return [{json:base}];
""".strip()

PREP_FB_PAYLOAD_JS = r"""
function clean(v){ return String(v ?? '').trim(); }
const r={...$json};
const caption=clean(r.facebook_caption || r.caption), hashtags=clean(r.facebook_hashtags || r.instagram_hashtags);
if (!caption) throw new Error('PUBLISH BLOCKED: Facebook caption is blank immediately before publication.');
if (!hashtags || !hashtags.includes('#')) throw new Error('PUBLISH BLOCKED: Facebook hashtags are blank or invalid immediately before publication.');
let ids=[];
try { ids=JSON.parse(r.facebook_photo_ids || '[]'); } catch {}
const expected=Array.isArray(r._image_urls)?r._image_urls.length:Array.from({length:10},(_,i)=>String(r[`image_${i+1}_url`]||'').trim()).filter(Boolean).length;
if (!Array.isArray(ids) || ids.length!==expected || ids.length<2 || ids.length>10 || ids.some(id=>!clean(id))) throw new Error('PUBLISH BLOCKED: Facebook photo count does not match the 2–10 slide carousel.');
r._facebook_publish_message=`${caption}\n\n${hashtags}`.trim();
r._facebook_attached_media=ids.map(id=>({media_fbid:id}));
if (r._facebook_publish_message.length < 40) throw new Error('PUBLISH BLOCKED: Facebook publish message is unexpectedly short.');
return [{json:r}];
""".strip()

ATTACH_FB_POST_JS = r"""
const base={...$('[FB] Attach Stored Photos').item.json};
if (!$json.id) throw new Error('Facebook carousel post did not return a post ID.');
base.facebook_post_id=$json.id;
base.facebook_published_date=DateTime.now().setZone('America/New_York').toFormat('yyyy-MM-dd HH:mm:ss');
return [{json:base}];
""".strip()

VERIFY_IG_POST_JS = r"""
const base={...$('[IG] Attach Publish Result').item.json};
const publishedCaption=String($json.caption ?? '').trim();
const firstHashtag=String(base.facebook_hashtags||base.instagram_hashtags||'').trim().split(/\s+/)[0];
if (!publishedCaption) throw new Error(`PUBLISH VERIFICATION FAILED: Instagram post ${base.instagram_post_id} exists but its caption is blank.`);
if (firstHashtag && !publishedCaption.includes(firstHashtag)) throw new Error(`PUBLISH VERIFICATION FAILED: Instagram post ${base.instagram_post_id} is missing the expected hashtags.`);
base.instagram_verified_caption=publishedCaption;
base.instagram_permalink=$json.permalink || '';
return [{json:base}];
""".strip()

VERIFY_FB_POST_JS = r"""
const base={...$('[FB] Attach Post Result').item.json};
const publishedMessage=String($json.message ?? '').trim();
const firstHashtag=String(base.instagram_hashtags||'').trim().split(/\s+/)[0];
if (!publishedMessage) throw new Error(`PUBLISH VERIFICATION FAILED: Facebook post ${base.facebook_post_id} exists but its caption is blank.`);
if (firstHashtag && !publishedMessage.includes(firstHashtag)) throw new Error(`PUBLISH VERIFICATION FAILED: Facebook post ${base.facebook_post_id} is missing the expected hashtags.`);
base.facebook_verified_message=publishedMessage;
base.facebook_permalink=$json.permalink_url || '';
return [{json:base}];
""".strip()

FINALIZE_JS = r"""
function has(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
function bool(v,d=false) { if (!has(v)) return d; if (typeof v==='boolean') return v; return ['true','1','yes','y','on'].includes(String(v).trim().toLowerCase()); }
const r={...$json};
const igSelected=bool(r.post_to_instagram,true), fbSelected=bool(r.post_to_facebook,true);
const complete=(!igSelected || has(r.instagram_post_id)) && (!fbSelected || has(r.facebook_post_id));
r.status=complete?'Published':'Partial';
r.error_message=complete?'':'One or more selected platforms did not return a post ID.';
if (complete) r.publishing_lock='';
return [{json:r}];
""".strip()

TG_MESSAGE_JS = r"""
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
const r={...$json};
const published=Boolean(String(r.instagram_post_id||'').trim() || String(r.facebook_post_id||'').trim());
const reviewReady=String(r.copy_review_status||'').trim().toUpperCase()==='PASS';
const title=published?'Carousel Publishing Complete':reviewReady?'Carousel Copy Ready':'Carousel Copy Needs Review';
const count=Array.from({length:10},(_,i)=>r[`image_${i+1}_url`]).filter(Boolean).length;
r.telegram_text=`<b>${title}</b>\n\n<b>Title:</b> ${esc(r.carousel_title)}\n<b>Carousel:</b> ${esc(r.carousel_id)}\n<b>Status:</b> ${esc(r.status)}\n<b>Editorial score:</b> ${esc(r.quality_score||'Not scored')}\n<b>Review:</b> ${esc(r.copy_review_status||'Pending')}\n${r.error_message?`<b>Reviewer notes:</b> ${esc(r.error_message)}\n`:''}<b>Scheduled:</b> ${esc(r.scheduled_date)} ${esc(r.scheduled_time)} ET\n<b>Images:</b> ${count}\n<b>First image:</b> <a href="${esc(r.image_1_url)}">Open image</a>\n\n<b>Instagram caption:</b>\n<pre>${esc(r.caption)}</pre>\n<b>Instagram hashtags:</b>\n<pre>${esc(r.instagram_hashtags)}</pre>\n\n<b>Facebook caption:</b>\n<pre>${esc(r.facebook_caption)}</pre>\n<b>Facebook hashtags:</b>\n<pre>${esc(r.facebook_hashtags)}</pre>\n\n<b>Reddit title:</b>\n<pre>${esc(r.reddit_title)}</pre>\n<b>Reddit body:</b>\n<pre>${esc(r.reddit_caption)}</pre>\n<b>Reddit hashtags:</b>\n<pre>${esc(r.reddit_hashtags)}</pre>\n\n<b>Instagram:</b> ${r.instagram_permalink?`<a href="${esc(r.instagram_permalink)}">Open post</a>`:esc(r.instagram_post_id||'Not published')}\n<b>Facebook:</b> ${r.facebook_permalink?`<a href="${esc(r.facebook_permalink)}">Open post</a>`:esc(r.facebook_post_id||'Not published')}\n<b>Reddit:</b> Copy package ready in Carousel Studio\n\n<b>Copy model:</b> ${esc(r.ai_model||'local double pass')}`;
return [{json:r}];
""".strip()

nodes = []
nodes.append(node("[CORE] Manual Trigger", "n8n-nodes-base.manualTrigger", 1, [-1260, 120], {}))
nodes.append(node("[CORE] Scheduled Trigger", "n8n-nodes-base.scheduleTrigger", 1.2, [-1260, -40], {"rule": {"interval": [{"field": "minutes", "minutesInterval": 5}]}}))
nodes.append(gs_read("[CORE] Load ai_carousels", [-1040, 40]))
nodes.append(code_node("Classify Carousel", [-820, 40], CLASSIFY_JS))
nodes.append(if_node("[CORE] If: Due or Testing", [-600, 40], "={{ $json._process }}"))
nodes.append(if_node("[GEN] If: Copy Missing", [-380, 40], "={{ $json._needs_generation }}"))
nodes.append(gs_update("[GEN] Mark Generation Started", [-270, -80], {
    "carousel_id": "={{ $json.carousel_id }}", "status": "Generating",
    "caption_generation_status": "PENDING_LOCAL_REVIEW", "error_message": ""
}))
nodes.append(node("[GEN] Local Grounding (Ollama)", "n8n-nodes-base.httpRequest", 4.2, [-160, -80], {
    "method": "POST", "url": "http://127.0.0.1:11434/api/chat", "sendHeaders": True,
    "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]},
    "sendBody": True, "specifyBody": "json", "jsonBody": OLLAMA_BODY, "options": {}
}, retryOnFail=True, waitBetweenTries=5000))
nodes.append(node("[GEN] Independent Local Copy Editor", "n8n-nodes-base.httpRequest", 4.2, [60, -80], {
    "method": "POST", "url": "http://127.0.0.1:11434/api/chat", "sendHeaders": True,
    "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]},
    "sendBody": True, "specifyBody": "json", "jsonBody": EDITOR_BODY,
    "options": {"response": {"response": {"responseFormat": "json"}}}
}, retryOnFail=True, waitBetweenTries=5000))
nodes.append(node("[GEN] Final Local Repair Editor", "n8n-nodes-base.httpRequest", 4.2, [280, -220], {
    "method": "POST", "url": "http://127.0.0.1:11434/api/chat", "sendHeaders": True,
    "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]},
    "sendBody": True, "specifyBody": "json", "jsonBody": FINAL_EDITOR_BODY,
    "options": {"response": {"response": {"responseFormat": "json"}}}
}, retryOnFail=True, waitBetweenTries=5000))
nodes.append(code_node("[GEN] Parse and Validate Copy", [280, -80], PARSE_COPY_JS))
nodes.append(gs_update("[GEN] Write Copy to Sheet", [500, -80], {
    "carousel_id": "={{ $json.carousel_id }}", "post_to_instagram": "={{ $json.post_to_instagram }}",
    "post_to_facebook": "={{ $json.post_to_facebook }}", "local_brief": "={{ $json.local_brief }}",
    "copy_review_status": "={{ $json.copy_review_status }}", "caption_generation_status": "={{ $json.caption_generation_status }}",
    "carousel_title": "={{ $json.carousel_title }}", "caption": "={{ $json.caption }}",
    "instagram_hashtags": "={{ $json.instagram_hashtags }}", "facebook_caption": "={{ $json.facebook_caption }}",
    "facebook_hashtags": "={{ $json.facebook_hashtags }}", "reddit_title": "={{ $json.reddit_title }}",
    "reddit_caption": "={{ $json.reddit_caption }}", "reddit_hashtags": "={{ $json.reddit_hashtags }}",
    "copy_generated_at": "={{ $json.copy_generated_at }}",
    "ai_model": "={{ $json.ai_model }}", "gemini_input_tokens": "={{ $json.gemini_input_tokens }}",
    "gemini_output_tokens": "={{ $json.gemini_output_tokens }}", "gemini_total_tokens": "={{ $json.gemini_total_tokens }}",
    "approval_status": "={{ $json.approval_status }}", "quality_score": "={{ $json.quality_score }}",
    "input_status": "={{ $json.input_status }}", "status": "={{ $json.status }}",
    "error_message": "={{ $json.error_message }}"
}))
nodes.append(gs_read("[GEN] Reload Generated Row", [720, -80], [{"lookupColumn": "carousel_id", "lookupValue": "={{ $json.carousel_id }}"}]))
nodes.append(node("[CORE] Merge Prepared Row", "n8n-nodes-base.merge", 3.2, [940, 40], {"mode": "append"}))
nodes.append(code_node("[CORE] Reclassify Prepared Row", [1160, 40], RECLASSIFY_JS))
nodes.append(if_node("[CORE] If: Testing Preview", [1380, 40], "={{ $json._is_testing }}"))
nodes.append(code_node("[TG] Build Preview Message", [1600, -120], TG_MESSAGE_JS))
nodes.append(node("[TG] Send Preview", "n8n-nodes-base.telegram", 1.2, [1820, -120], {
    "chatId": "-1003067570080", "text": "={{ $json.telegram_text }}",
    "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"}
}, TG_CRED))
nodes.append(code_node("[TG] Attach Preview Row", [2040, -120], "return [{json:{...$('[TG] Build Preview Message').item.json,_telegram_response:$json}}];"))
nodes.append(gs_update("[TG] Mark Preview Sent", [2260, -120], {
    "carousel_id": "={{ $json.carousel_id }}", "caption": "={{ $json.caption }}",
    "instagram_hashtags": "={{ $json.instagram_hashtags }}", "facebook_caption": "={{ $json.facebook_caption }}",
    "telegram_sent_date": "={{ $now.toFormat(\"yyyy-MM-dd HH:mm:ss\") }}",
    "status": "={{ String($json.admin_mode || '').toLowerCase() === 'auto' ? $json.status : 'Needs Review' }}"
}))
nodes.append(code_node("[CORE] Validate and Lock", [1600, 160], LOCK_JS))
nodes.append(gs_update("[CORE] Lock Row", [1820, 160], {
    "carousel_id": "={{ $json.carousel_id }}", "status": "={{ $json.status }}", "media_type": "CAROUSEL",
    "post_to_instagram": "={{ $json.post_to_instagram }}", "post_to_facebook": "={{ $json.post_to_facebook }}",
    "posting_defaults_applied_at": "={{ $json.posting_defaults_applied_at }}", "publishing_lock": "={{ $json.publishing_lock }}",
    "error_message": ""
}))
nodes.append(code_node("[CORE] Attach Locked Row", [2040, 160], "return [{json:{...$('[CORE] Validate and Lock').item.json,...$json}}];"))
nodes.append(if_node("[IG] If: Publish Needed", [2260, 160], "={{ $json.post_to_instagram === true && !$json.instagram_post_id }}"))
nodes.append(code_node("[IG] Build Carousel Child Items", [2260, 80], BUILD_IG_ITEMS_JS))
nodes.append(node("[IG] Create Child Containers", "n8n-nodes-base.facebookGraphApi", 1, [2480, 80], {
    "httpRequestMethod": "POST", "graphApiVersion": GRAPH_VERSION, "node": "=" + IG_USER_ID, "edge": "media",
    "options": {"queryParameters": {"parameter": [
        {"name": "image_url", "value": "={{ $json.image_url }}"},
        {"name": "is_carousel_item", "value": "true"}
    ]}}
}, IG_CRED, retryOnFail=True, waitBetweenTries=5000))
nodes.append(code_node("[IG] Aggregate Child IDs", [2700, 80], AGG_IG_JS))
nodes.append(code_node("[IG] Validate Caption Payload", [2810, 80], PREP_IG_PAYLOAD_JS))
nodes.append(node("[IG] Create Parent Carousel", "n8n-nodes-base.facebookGraphApi", 1, [2920, 80], {
    "httpRequestMethod": "POST", "graphApiVersion": GRAPH_VERSION, "node": "=" + IG_USER_ID, "edge": "media",
    "options": {"queryParameters": {"parameter": [
        {"name": "media_type", "value": "CAROUSEL"},
        {"name": "children", "value": "={{ $json.instagram_child_ids.join(',') }}"},
        {"name": "caption", "value": "={{ $json._instagram_publish_caption }}"},
        {"name": "location_id", "value": IG_LOCATION_ID},
        {"name": "collaborators", "value": "={{ JSON.stringify($json._instagram_collaborators) }}"}
    ]}}
}, IG_CRED, retryOnFail=True, waitBetweenTries=5000))
nodes.append(code_node("[IG] Attach Parent Container", [3140, 80], ATTACH_IG_PARENT_JS))
nodes.append(gs_update("[IG] Store Parent Container", [3360, 80], {
    "carousel_id": "={{ $json.carousel_id }}", "instagram_container_id": "={{ $json.instagram_container_id }}",
    "status": "Publishing", "publishing_lock": "={{ $json.publishing_lock }}"
}))
nodes.append(node("[IG] Wait for Processing", "n8n-nodes-base.wait", 1.1, [3580, 80], {"amount": 20, "unit": "seconds"}, webhookId=uid("ig-wait")))
nodes.append(node("[IG] Check Parent Status", "n8n-nodes-base.facebookGraphApi", 1, [3800, 80], {
    "graphApiVersion": GRAPH_VERSION, "node": "={{ $json.instagram_container_id }}",
    "options": {"fields": {"field": [{"name": "status_code"}, {"name": "status"}]}}
}, IG_CRED, retryOnFail=True))
nodes.append(if_node("[IG] If: Parent Ready", [4020, 80], "={{ ['FINISHED','PUBLISHED'].includes(String($json.status_code || '').toUpperCase()) }}"))
nodes.append(node("[IG] Wait and Recheck", "n8n-nodes-base.wait", 1.1, [4240, 200], {"amount": 20, "unit": "seconds"}, webhookId=uid("ig-wait-recheck")))
nodes.append(node("[IG] Recheck Parent Status", "n8n-nodes-base.facebookGraphApi", 1, [4460, 200], {
    "graphApiVersion": GRAPH_VERSION, "node": "={{ $('[IG] Store Parent Container').item.json.instagram_container_id }}",
    "options": {"fields": {"field": [{"name": "status_code"}, {"name": "status"}]}}
}, IG_CRED, retryOnFail=True))
nodes.append(node("[IG] Merge Ready Check", "n8n-nodes-base.merge", 3.2, [4680, 80], {"mode": "append"}))
nodes.append(code_node("[IG] Validate Ready", [4900, 80], VALIDATE_IG_READY_JS))
nodes.append(node("[IG] Publish Carousel", "n8n-nodes-base.httpRequest", 4.2, [5120, 80], {
    "method": "POST", "url": f"https://graph.facebook.com/{GRAPH_VERSION}/{IG_USER_ID}/media_publish",
    "authentication": "predefinedCredentialType", "nodeCredentialType": "facebookGraphApi",
    "sendBody": True, "contentType": "form-urlencoded",
    "bodyParameters": {"parameters": [{"name": "creation_id", "value": "={{ $json.instagram_container_id }}"}]}, "options": {}
}, IG_CRED, retryOnFail=True, waitBetweenTries=5000))
nodes.append(code_node("[IG] Attach Publish Result", [5340, 80], ATTACH_IG_PUBLISH_JS))
nodes.append(node("[IG] Read Published Post", "n8n-nodes-base.facebookGraphApi", 1, [5450, 80], {
    "graphApiVersion": GRAPH_VERSION, "node": "={{ $json.instagram_post_id }}",
    "options": {"fields": {"field": [{"name": "id"}, {"name": "caption"}, {"name": "permalink"}]}}
}, IG_CRED, retryOnFail=True))
nodes.append(code_node("[IG] Verify Published Caption", [5505, 80], VERIFY_IG_POST_JS))
nodes.append(gs_update("[IG] Mark Instagram Published", [5560, 80], {
    "carousel_id": "={{ $json.carousel_id }}", "instagram_container_id": "={{ $json.instagram_container_id }}",
    "instagram_published_date": "={{ $json.instagram_published_date }}", "instagram_post_id": "={{ $json.instagram_post_id }}",
    "instagram_permalink": "={{ $json.instagram_permalink }}",
    "status": "Publishing", "publishing_lock": "={{ $json.publishing_lock }}"
}))
nodes.append(code_node("[IG] Attach Saved Instagram Row", [5670, 80], "return [{json:{...$('[IG] Attach Publish Result').item.json,...$json}}];"))
nodes.append(node("[IG] Merge Completed or Skipped", "n8n-nodes-base.merge", 3.2, [5780, 160], {"mode": "append"}))
nodes.append(if_node("[FB] If: Publish Needed", [6000, 160], "={{ $json.post_to_facebook === true && !$json.facebook_post_id }}"))
nodes.append(code_node("[FB] Build Carousel Photo Items", [6220, 80], BUILD_FB_ITEMS_JS))
nodes.append(node("[FB] Upload Unpublished Photos", "n8n-nodes-base.httpRequest", 4.2, [6440, 80], {
    "method": "POST", "url": f"https://graph.facebook.com/{GRAPH_VERSION}/{FB_PAGE_ID}/photos",
    "authentication": "predefinedCredentialType", "nodeCredentialType": "facebookGraphApi",
    "sendBody": True, "contentType": "form-urlencoded",
    "bodyParameters": {"parameters": [
        {"name": "url", "value": "={{ $json.image_url }}"},
        {"name": "published", "value": "false"}
    ]}, "options": {}
}, FB_CRED, retryOnFail=True, waitBetweenTries=5000))
nodes.append(code_node("[FB] Aggregate Photo IDs", [6660, 80], AGG_FB_JS))
nodes.append(gs_update("[FB] Store Photo IDs", [6880, 80], {
    "carousel_id": "={{ $json.carousel_id }}", "facebook_photo_ids": "={{ $json.facebook_photo_ids }}",
    "status": "Publishing", "publishing_lock": "={{ $json.publishing_lock }}"
}))
nodes.append(code_node("[FB] Attach Stored Photos", [6990, 80], "return [{json:{...$('[FB] Aggregate Photo IDs').item.json,...$json}}];"))
nodes.append(code_node("[FB] Validate Caption Payload", [7045, 80], PREP_FB_PAYLOAD_JS))
nodes.append(node("[FB] Publish Carousel Post", "n8n-nodes-base.httpRequest", 4.2, [7100, 80], {
    "method": "POST", "url": f"https://graph.facebook.com/{GRAPH_VERSION}/{FB_PAGE_ID}/feed",
    "authentication": "predefinedCredentialType", "nodeCredentialType": "facebookGraphApi",
    "sendBody": True, "contentType": "form-urlencoded",
    "bodyParameters": {"parameters": [
        {"name": "message", "value": "={{ $json._facebook_publish_message }}"},
        {"name": "attached_media", "value": "={{ JSON.stringify($json._facebook_attached_media) }}"}
    ]}, "options": {}
}, FB_CRED, retryOnFail=True, waitBetweenTries=5000))
nodes.append(code_node("[FB] Attach Post Result", [7320, 80], ATTACH_FB_POST_JS))
nodes.append(node("[FB] Read Published Post", "n8n-nodes-base.facebookGraphApi", 1, [7430, 80], {
    "graphApiVersion": GRAPH_VERSION, "node": "={{ $json.facebook_post_id }}",
    "options": {"fields": {"field": [{"name": "id"}, {"name": "message"}, {"name": "permalink_url"}]}}
}, FB_CRED, retryOnFail=True))
nodes.append(code_node("[FB] Verify Published Caption", [7485, 80], VERIFY_FB_POST_JS))
nodes.append(gs_update("[FB] Mark Facebook Published", [7540, 80], {
    "carousel_id": "={{ $json.carousel_id }}", "facebook_photo_ids": "={{ $json.facebook_photo_ids }}",
    "facebook_published_date": "={{ $json.facebook_published_date }}", "facebook_post_id": "={{ $json.facebook_post_id }}",
    "facebook_permalink": "={{ $json.facebook_permalink }}",
    "status": "Publishing", "publishing_lock": "={{ $json.publishing_lock }}"
}))
nodes.append(node("[FB] Merge Completed or Skipped", "n8n-nodes-base.merge", 3.2, [7760, 160], {"mode": "append"}))
nodes.append(gs_read("[CORE] Reload Final Row", [7980, 160], [{"lookupColumn": "carousel_id", "lookupValue": "={{ $json.carousel_id }}"}]))
nodes.append(code_node("[CORE] Finalize Status", [8200, 160], FINALIZE_JS))
nodes.append(gs_update("[CORE] Write Final Status", [8420, 160], {
    "carousel_id": "={{ $json.carousel_id }}", "status": "={{ $json.status }}",
    "publishing_lock": "={{ $json.publishing_lock }}", "error_message": "={{ $json.error_message }}"
}))
nodes.append(code_node("[CORE] Attach Final Status", [8530, 160], "return [{json:{...$('[CORE] Finalize Status').item.json,...$json}}];"))
nodes.append(code_node("[TG] Build Success Message", [8640, 160], TG_MESSAGE_JS))
nodes.append(node("[TG] Send Publication Confirmation", "n8n-nodes-base.telegram", 1.2, [8860, 160], {
    "chatId": "-1003067570080", "text": "={{ $json.telegram_text }}",
    "additionalFields": {"appendAttribution": False, "parse_mode": "HTML"}
}, TG_CRED))
nodes.append(code_node("[TG] Attach Published Row", [9080, 160], "return [{json:{...$('[TG] Build Success Message').item.json,_telegram_response:$json}}];"))
nodes.append(gs_update("[TG] Mark Confirmation Sent", [9300, 160], {
    "carousel_id": "={{ $json.carousel_id }}", "telegram_sent_date": "={{ $now.toFormat(\"yyyy-MM-dd HH:mm:ss\") }}"
}))
nodes.append(node("[README] Setup and Safety", "n8n-nodes-base.stickyNote", 1, [-1040, -300], {
    "content": "## MBW AI Carousels\n\n- Sheet tab: `ai_carousels`\n- Between 2 and 10 unique public HTTPS image URLs are required.\n- `Testing` generates/validates copy and sends Telegram without publishing.\n- `Scheduled` publishes only after the scheduled time, verified input, passing local review, and copy approval.\n- Per-platform IDs prevent normal duplicate posts.\n- A publishing lock stops automatic retries after an uncertain partial failure.\n- Import inactive, refresh Google Sheets columns, run a review-only test, then activate.",
    "height": 300, "width": 520, "color": 5
}))

connections = {}


def connect(src, dst, src_index=0, dst_index=0):
    main = connections.setdefault(src, {}).setdefault("main", [])
    while len(main) <= src_index:
        main.append([])
    main[src_index].append({"node": dst, "type": "main", "index": dst_index})


connect("[CORE] Manual Trigger", "[CORE] Load ai_carousels")
connect("[CORE] Scheduled Trigger", "[CORE] Load ai_carousels")
connect("[CORE] Load ai_carousels", "Classify Carousel")
connect("Classify Carousel", "[CORE] If: Due or Testing")
connect("[CORE] If: Due or Testing", "[GEN] If: Copy Missing", 0)
connect("[GEN] If: Copy Missing", "[GEN] Mark Generation Started", 0)
connect("[GEN] Mark Generation Started", "[GEN] Local Grounding (Ollama)")
connect("[GEN] Local Grounding (Ollama)", "[GEN] Independent Local Copy Editor")
connect("[GEN] Independent Local Copy Editor", "[GEN] Final Local Repair Editor")
connect("[GEN] Final Local Repair Editor", "[GEN] Parse and Validate Copy")
connect("[GEN] Parse and Validate Copy", "[GEN] Write Copy to Sheet")
connect("[GEN] Write Copy to Sheet", "[GEN] Reload Generated Row")
connect("[GEN] Reload Generated Row", "[CORE] Merge Prepared Row", 0, 1)
connect("[GEN] If: Copy Missing", "[CORE] Merge Prepared Row", 1, 0)
connect("[CORE] Merge Prepared Row", "[CORE] Reclassify Prepared Row")
connect("[CORE] Reclassify Prepared Row", "[CORE] If: Testing Preview")
connect("[CORE] If: Testing Preview", "[TG] Build Preview Message", 0)
connect("[TG] Build Preview Message", "[TG] Send Preview")
connect("[TG] Send Preview", "[TG] Attach Preview Row")
connect("[TG] Attach Preview Row", "[TG] Mark Preview Sent")
connect("[CORE] If: Testing Preview", "[CORE] Validate and Lock", 1)
connect("[CORE] Validate and Lock", "[CORE] Lock Row")
connect("[CORE] Lock Row", "[CORE] Attach Locked Row")
connect("[CORE] Attach Locked Row", "[IG] If: Publish Needed")
connect("[IG] If: Publish Needed", "[IG] Build Carousel Child Items", 0)
connect("[IG] Build Carousel Child Items", "[IG] Create Child Containers")
connect("[IG] Create Child Containers", "[IG] Aggregate Child IDs")
connect("[IG] Aggregate Child IDs", "[IG] Validate Caption Payload")
connect("[IG] Validate Caption Payload", "[IG] Create Parent Carousel")
connect("[IG] Create Parent Carousel", "[IG] Attach Parent Container")
connect("[IG] Attach Parent Container", "[IG] Store Parent Container")
connect("[IG] Store Parent Container", "[IG] Wait for Processing")
connect("[IG] Wait for Processing", "[IG] Check Parent Status")
connect("[IG] Check Parent Status", "[IG] If: Parent Ready")
connect("[IG] If: Parent Ready", "[IG] Merge Ready Check", 0, 0)
connect("[IG] If: Parent Ready", "[IG] Wait and Recheck", 1)
connect("[IG] Wait and Recheck", "[IG] Recheck Parent Status")
connect("[IG] Recheck Parent Status", "[IG] Merge Ready Check", 0, 1)
connect("[IG] Merge Ready Check", "[IG] Validate Ready")
connect("[IG] Validate Ready", "[IG] Publish Carousel")
connect("[IG] Publish Carousel", "[IG] Attach Publish Result")
connect("[IG] Attach Publish Result", "[IG] Read Published Post")
connect("[IG] Read Published Post", "[IG] Verify Published Caption")
connect("[IG] Verify Published Caption", "[IG] Mark Instagram Published")
connect("[IG] Mark Instagram Published", "[IG] Attach Saved Instagram Row")
connect("[IG] Attach Saved Instagram Row", "[IG] Merge Completed or Skipped", 0, 1)
connect("[IG] If: Publish Needed", "[IG] Merge Completed or Skipped", 1, 0)
connect("[IG] Merge Completed or Skipped", "[FB] If: Publish Needed")
connect("[FB] If: Publish Needed", "[FB] Build Carousel Photo Items", 0)
connect("[FB] Build Carousel Photo Items", "[FB] Upload Unpublished Photos")
connect("[FB] Upload Unpublished Photos", "[FB] Aggregate Photo IDs")
connect("[FB] Aggregate Photo IDs", "[FB] Store Photo IDs")
connect("[FB] Store Photo IDs", "[FB] Attach Stored Photos")
connect("[FB] Attach Stored Photos", "[FB] Validate Caption Payload")
connect("[FB] Validate Caption Payload", "[FB] Publish Carousel Post")
connect("[FB] Publish Carousel Post", "[FB] Attach Post Result")
connect("[FB] Attach Post Result", "[FB] Read Published Post")
connect("[FB] Read Published Post", "[FB] Verify Published Caption")
connect("[FB] Verify Published Caption", "[FB] Mark Facebook Published")
connect("[FB] Mark Facebook Published", "[FB] Merge Completed or Skipped", 0, 1)
connect("[FB] If: Publish Needed", "[FB] Merge Completed or Skipped", 1, 0)
connect("[FB] Merge Completed or Skipped", "[CORE] Reload Final Row")
connect("[CORE] Reload Final Row", "[CORE] Finalize Status")
connect("[CORE] Finalize Status", "[CORE] Write Final Status")
connect("[CORE] Write Final Status", "[CORE] Attach Final Status")
connect("[CORE] Attach Final Status", "[TG] Build Success Message")
connect("[TG] Build Success Message", "[TG] Send Publication Confirmation")
connect("[TG] Send Publication Confirmation", "[TG] Attach Published Row")
connect("[TG] Attach Published Row", "[TG] Mark Confirmation Sent")

workflow = {
    "id": "RAXzJtHipv329i6V",
    "name": "MBW - AI Carousels",
    "nodes": nodes,
    "pinData": {},
    "connections": connections,
    "active": False,
    "settings": {"executionOrder": "v1", "timezone": "America/New_York"},
    "versionId": uid("workflow-version"),
    "meta": {"templateCredsSetupCompleted": True},
    "tags": [],
}

OUT.write_text(json.dumps(workflow, indent=2) + "\n")
print(OUT.resolve())
print(f"nodes={len(nodes)} headers={len(HEADERS)}")
