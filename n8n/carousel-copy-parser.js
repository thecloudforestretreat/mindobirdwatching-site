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
const subject = clean(base.featured_birds) || 'Recent moments';
const scientific = clean(base.scientific_name) ? ` (${clean(base.scientific_name)})` : '';
const location = clean(base.location) || 'Mindo, Ecuador';
const descriptionWords = clean(base.carousel_description).split(/\s+/).filter(Boolean).slice(0,45).join(' ');
const description = descriptionWords ? descriptionWords.replace(/[.!?]+$/,'') + '.' : '';
let manifest = [];
try { manifest = JSON.parse(base.images_json || '[]'); } catch (_) {}
const types = new Set(manifest.map(image => clean(image.content_type).toLowerCase()));
const hasPhoto = types.has('photo'), hasXray = types.has('xray'), hasGraphic = types.has('infographic');
const intentText = `${subject} ${clean(base.activity_name)} ${clean(base.carousel_description)}`;
const communityPattern = /\b(join|family|families|community|together|welcome|belong|member|membership)\b/i;
const experiencePattern = /\b(trips?|tours?|walks?|outings?|visits?|guests?|groups?|people|recent|adventures?|experiences?|behind the scenes|day|night)\b/i;
const communityMode = communityPattern.test(intentText);
const experienceMode = !communityMode && experiencePattern.test(intentText);
const birdMode = !communityMode && !experienceMode && (Boolean(clean(base.scientific_name)) || hasXray || hasGraphic);
const contentMode = communityMode ? 'community' : experienceMode ? 'experience' : birdMode ? 'bird' : 'general';
const displaySubject = (subject.replace(/^some\s+/i,'').replace(/[.!?]+$/,'').trim() || subject);
const subjectTitle = displaySubject.charAt(0).toUpperCase() + displaySubject.slice(1);
const sentenceStyleSubject = subject.split(/\s+/).length > 8 || /[,.;!?]/.test(subject) || /\b(enjoy|witness|discover|explore|visit|travel|join|experience|see)\b/i.test(subject);
const quitoToMindo = /\bquito\b/i.test(subject) && /\bmindo\b/i.test(subject);
const experienceLabel = /\bnight walks?\b/i.test(subject) ? 'recent night walks' : quitoToMindo ? 'a day trip from Quito to Mindo' : sentenceStyleSubject ? 'a recent outing' : displaySubject.toLowerCase();
let fallbackTitle, fallbackCaption, fallbackFacebook, fallbackRedditTitle, fallbackReddit;
if (contentMode === 'bird') {
  fallbackTitle = `${subject}: Beyond the Portrait`;
  fallbackCaption = hasPhoto && hasXray && hasGraphic
    ? `This set looks at the ${subject}${scientific} in three ways: a portrait from ${location}, an X-ray study, and an illustrated guide. ${description} Keeping the three views together makes it easier to compare the details in each one. Save the carousel as a reference for your next birding visit to Mindo.`.replace(/\s+/g,' ').trim()
    : `Here are ${imageCount || 'several'} views of the ${subject}${scientific} from ${location}. ${description} Each photograph adds another look at the same bird while keeping the record limited to what was observed and supplied. Save the set for future reference or share it with someone who enjoys learning about Ecuador's birds.`.replace(/\s+/g,' ').trim();
  fallbackFacebook = hasPhoto && hasXray && hasGraphic
    ? `One bird, viewed three different ways. The carousel begins with a portrait of the ${subject}${scientific} in ${location}, continues with an X-ray study, and finishes with an illustrated reference. ${description} Together, the supplied images make a useful comparison without adding facts beyond the source material. Save it for a closer look later.`.replace(/\s+/g,' ').trim()
    : `A closer look at the ${subject}${scientific} through ${imageCount || 'several'} images from ${location}. ${description} The photographs keep the named bird at the center and show the supplied views in sequence. Save the carousel for reference or share it with a friend who would enjoy seeing this bird.`.replace(/\s+/g,' ').trim();
  fallbackRedditTitle = `${subject} from ${location}`;
  fallbackReddit = hasPhoto && hasXray && hasGraphic
    ? `Sharing three supplied views of the ${subject}${scientific} from ${location}: a portrait, an X-ray study, and an illustrated guide. ${description} Each format offers a different way to examine the same bird without adding facts beyond the source material. I kept them together so the details are easy to compare.`.replace(/\s+/g,' ').trim()
    : `Sharing ${imageCount || 'several'} photographs of the ${subject}${scientific} from ${location}. ${description} The sequence stays focused on the named bird and the supplied images, with no added claims about behavior or habitat. I kept the full set together so each view has useful context.`.replace(/\s+/g,' ').trim();
} else if (contentMode === 'community') {
  fallbackTitle = 'Birdwatching Is Better Together in Mindo';
  fallbackCaption = `These ${imageCount || 'several'} photographs are about the people who shared a day of birdwatching with us in Mindo. ${description} The conversations, discoveries, and time spent outdoors together are part of what makes the outing memorable. Share the carousel with the person you would bring on a future visit.`.replace(/\s+/g,' ').trim();
  fallbackFacebook = `These ${imageCount || 'several'} photographs keep the people and shared moments from a birdwatching day in Mindo together. ${description} A guided outing is also about noticing things together and taking time to enjoy the experience. Share the set with someone you would enjoy bringing to Mindo.`.replace(/\s+/g,' ').trim();
  fallbackRedditTitle = 'Birdwatching is better when the experience is shared';
  fallbackReddit = `Sharing ${imageCount || 'several'} photographs centered on the people and shared moments behind Mindo Bird Watching. ${description} I kept the sequence together because the company and small discoveries along the way are part of the outing, not just background to the bird list.`.replace(/\s+/g,' ').trim();
} else if (contentMode === 'experience') {
  fallbackTitle = /\bnight walks?\b/i.test(subject) ? 'After Dark in Mindo: Recent Night Walks' : quitoToMindo ? 'From Quito to Mindo: A Day Trip in 10 Photos' : sentenceStyleSubject ? `A Recent Outing in ${location}` : `${subjectTitle} in ${location}`;
  fallbackCaption = /\bnight walks?\b/i.test(subject)
    ? `These ${imageCount || 'several'} photographs come from recent night walks in Mindo. ${description} Keeping them in sequence gives a fuller record of what the group encountered after dark. Save the carousel when planning your visit, or message us for details about joining a guided night walk.`.replace(/\s+/g,' ').trim()
    : quitoToMindo
      ? `A day trip from Quito to Mindo, told through ${imageCount || 'several'} photographs. ${description} We kept the sequence together because each frame adds useful context from the outing. Save the carousel while planning your Ecuador itinerary, or message us for help arranging a guided day in Mindo.`.replace(/\s+/g,' ').trim()
      : `${subjectTitle} in ${location} gave us ${imageCount || 'several'} photographs worth keeping together. ${description} The sequence follows the supplied moments without turning one frame into the whole story. Save the carousel for later, or message us if you would like to plan a similar guided outing.`.replace(/\s+/g,' ').trim();
  fallbackFacebook = /\bnight walks?\b/i.test(subject)
    ? `These ${imageCount || 'several'} photographs come from recent night walks in ${location}. ${description} We kept the sequence together because the small encounters after dark make more sense as part of the whole outing. Save it for trip planning or message us for information about a guided night walk.`.replace(/\s+/g,' ').trim()
    : quitoToMindo
      ? `These ${imageCount || 'several'} photographs follow a day trip from Quito to Mindo. ${description} The sequence keeps the outing in context instead of asking one frame to represent the full day. Save it for your Ecuador plans or message us for help arranging a guided visit.`.replace(/\s+/g,' ').trim()
      : `Here are ${imageCount || 'several'} moments from ${experienceLabel} in ${location}. ${description} The full set keeps the outing in order and stays within the details that were supplied. Save the carousel for later or message us if you would like information about planning a guided visit.`.replace(/\s+/g,' ').trim();
  fallbackRedditTitle = /\bnight walks?\b/i.test(subject) ? 'Recent night walks in Mindo, Ecuador' : quitoToMindo ? 'A day trip from Quito to Mindo in 10 photographs' : sentenceStyleSubject ? `A recent outing in ${location}` : `${subjectTitle} in ${location}`;
  fallbackReddit = /\bnight walks?\b/i.test(subject)
    ? `Sharing ${imageCount || 'several'} photographs from recent night walks in ${location}. ${description} I kept them together because the sequence provides more context than a single frame and gives a straightforward record of the outing after dark.`.replace(/\s+/g,' ').trim()
    : quitoToMindo
      ? `Sharing ${imageCount || 'several'} photographs from a day trip between Quito and Mindo. ${description} I kept the outing together as a carousel so the sequence can show more of the day without adding details that were not supplied.`.replace(/\s+/g,' ').trim()
      : `Sharing ${imageCount || 'several'} photographs from ${experienceLabel} in ${location}. ${description} I kept the outing together as a carousel because the sequence gives each moment more context than a single selected image.`.replace(/\s+/g,' ').trim();
} else {
  fallbackTitle = `${subjectTitle} in ${location}`;
  fallbackCaption = `${subjectTitle} is the focus of this ${imageCount || 'multi'}-image set from ${location}. ${description} The carousel keeps the supplied subject and photographs together without adding details that were not provided. Save the full sequence for reference or share it with someone who would appreciate the subject.`.replace(/\s+/g,' ').trim();
  fallbackFacebook = `This ${imageCount || 'multi'}-image carousel focuses on ${displaySubject} in ${location}. ${description} Each supplied photograph adds another view while the copy stays within the information provided. Save the set for a closer look later or share it with someone interested in the subject.`.replace(/\s+/g,' ').trim();
  fallbackRedditTitle = `${subjectTitle} — ${location}`;
  fallbackReddit = `Sharing a ${imageCount || 'multi'}-image set focused on ${displaySubject} in ${location}. ${description} I kept the caption limited to the supplied context rather than guessing at details, and kept the full sequence together so each image can be viewed in context.`.replace(/\s+/g,' ').trim();
}
const experienceSeeds = /\bnight\b/i.test(subject) ? ['MindoNightWalk','EcuadorWildlife'] : /\b(tour|trip|visit|outing)\b/i.test(subject) ? ['MindoTours','EcuadorTravel'] : ['MindoExperiences','EcuadorTravel'];
const communitySeeds = ['FamilyBirding','BirdwatchingEcuador'];
const subjectSeed = !experienceMode && !communityMode && subject.split(/\s+/).length <= 5 ? [subject] : [];
const modeSeeds = communityMode ? communitySeeds : experienceMode ? experienceSeeds : ['BirdingEcuador'];
const contextSeeds = [...subjectSeed, base.activity_name, ...modeSeeds].flatMap(v => clean(v).split(/[|,]/)).map(safeTag).filter(Boolean);
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
const sourceText = [base.carousel_description,base.slide_notes,base.verified_details,base.images_json,base.featured_birds,base.scientific_name,base.location].map(clean).join(' ').toLowerCase();
const candidateText = [parsedTitle,parsedCaption,parsedFacebook,parsedRedditTitle,parsedReddit].join(' ').toLowerCase();
const minimalInput = !clean(base.carousel_description) && !clean(base.slide_notes) && !clean(base.verified_details);
const guardedTerms = ['ecosystem','plumage','colorful','forest','perch','tail','beak','diet','habitat','behavior','breeding','conservation','endemic','nocturnal','migratory','rare','abundant','misty','highlands','night sky',...(contentMode !== 'bird'?['bird','birds','species','avian','featured bird']:[]),...(minimalInput?['resident','lives','wildlife','key facts','learn more','book a','guided tour']:[])];
const containsTerm = (text,term) => new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+')}([^a-z0-9]|$)`,'i').test(text);
const unsupportedTerms = guardedTerms.filter(term => containsTerm(candidateText,term) && !containsTerm(sourceText,term));
const useFallback = !parsedCaption || unsupportedTerms.length > 0 || (minimalInput && ['experience','community'].includes(contentMode));
const caption = useFallback ? fallbackCaption : parsedCaption;
const title = useFallback ? fallbackTitle : (parsedTitle || fallbackTitle);
const facebook = useFallback ? fallbackFacebook : (parsedFacebook || fallbackFacebook);
const facebookTags = tagsFrom(useFallback ? [] : parsed.facebook_hashtags,[finalTags[0],finalTags[3], contentMode === 'bird' ? '#EcuadorBirds' : contentMode === 'community' ? '#BirdwatchingEcuador' : '#EcuadorTravel'],3);
const redditTitle = useFallback ? fallbackRedditTitle : (parsedRedditTitle || fallbackRedditTitle);
const reddit = useFallback ? fallbackReddit : (parsedReddit || fallbackReddit);
const redditTags = tagsFrom(useFallback ? [] : parsed.reddit_hashtags,[finalTags[3], contentMode === 'bird' ? '#BirdPhotography' : contentMode === 'community' ? '#BirdwatchingEcuador' : '#TravelPhotography', '#Ecuador'],3);
const forbidden = /guaranteed?|always see|will see|\brare\b|abundant|natural habitat|expert guides?|won't miss|will not miss|elusive/i;
const issues = [];
const finalText = [title,caption,facebook,redditTitle,reddit].join(' ');
if (forbidden.test(finalText)) issues.push('unsupported or exaggerated wording');
if (clean(parsed.grounding_verdict).toUpperCase() !== 'PASS' && !(minimalInput && useFallback)) issues.push('grounding reviewer did not pass');
if (clean(parsed.review_verdict).toUpperCase() !== 'PASS' && !(minimalInput && useFallback)) issues.push('editorial reviewer requested revision');
const unsupportedFinalTerms = guardedTerms.filter(term => containsTerm(finalText,term) && !containsTerm(sourceText,term));
if (unsupportedFinalTerms.length) issues.push(`unsupported terms: ${unsupportedFinalTerms.join(', ')}`);
if (![title,caption,facebook,redditTitle,reddit].every(value => /^["'“‘(]*[A-Z0-9]/.test(value))) issues.push('copy must begin with a capital letter');
if (/\b(seening|seing|recieve|thier|alot)\b/i.test(finalText)) issues.push('obvious spelling error');
if (/\b(?:from in|to to|in in|the the|a a)\b/i.test(finalText) || /\bMindo(?:,\s*Ecuador)?\s+in\s+Mindo\b/i.test(finalText)) issues.push('broken or duplicated phrasing');
const instagramWords=(caption.match(/\S+/g)||[]).length, facebookWords=(facebook.match(/\S+/g)||[]).length, redditWords=(reddit.match(/\S+/g)||[]).length;
if (instagramWords < 35 || instagramWords > 100) issues.push('Instagram caption outside 35–100 words');
if (facebookWords < 35 || facebookWords > 120) issues.push('Facebook caption outside 35–120 words');
if (redditWords < 25 || redditWords > 100) issues.push('Reddit body outside 25–100 words');
if (title.length > 80 || redditTitle.length > 120) issues.push('generated title too long');
if (finalTags.length !== 5 || facebookTags.split(/\s+/).length !== 3 || redditTags.split(/\s+/).length !== 3) issues.push('platform hashtag counts invalid');
const genericPattern = /submitted (?:images|visual details)|featured bird|visual story|complete carousel|follow (?:us|mindo bird watching) for more|shift perspectives|distinct visual formats|different kind of attention|designed for slower looking|what catches your attention|visual journey|carefully curated|subtle shifts?|invites contemplation|natural beauty|rhythm of the landscape|light and composition/i;
if (genericPattern.test(finalText)) issues.push('generic internal or filler language');
const engagementBait = /\b(?:which (?:image|slide|frame|one|moment)|what caught your eye|tell us which|would you|how many|drop (?:a )?comment|comment below)\b/i;
if (engagementBait.test(finalText) || (finalText.match(/\?/g)||[]).length > 1) issues.push('formulaic engagement bait');
if (contentMode === 'community' && !/\b(family|together|shared|people|guests?|community)\b/i.test(finalText)) issues.push('copy does not match the community or family intent');
const reviewerNotes = Array.isArray(parsed.review_notes) ? parsed.review_notes.map(clean).filter(note => note && !/^ready$/i.test(note)) : [];
let editorialScore = Math.max(0,Math.min(100,Number(parsed.editorial_score)||70));
if (useFallback) editorialScore = !issues.length ? 92 : Math.min(editorialScore,78);
if (issues.length) editorialScore = Math.min(editorialScore,89);
if (editorialScore < 92 && !issues.includes('editorial score below 92')) issues.push('editorial score below 92');
const ready = !issues.length && editorialScore >= 92;
base.local_brief = clean(local.brief) || fallbackBrief;
base.copy_review_status = ready ? 'PASS' : 'REVISE';
base.caption_generation_status = ready ? (useFallback ? 'GENERATED_CURATED_SAFE_FALLBACK' : 'GENERATED_DOUBLE_PASS') : (useFallback ? 'SAFE_DRAFT_NEEDS_REVIEW' : 'NEEDS_EDITORIAL_REVIEW');
base.carousel_title = title.slice(0,120);
base.caption = caption;
base.instagram_hashtags = finalTags.join(' ');
base.facebook_caption = facebook;
base.facebook_hashtags = facebookTags;
base.reddit_title = redditTitle.slice(0,160);
base.reddit_caption = reddit;
base.reddit_hashtags = redditTags;
base.copy_generated_at = DateTime.now().setZone('America/New_York').toISO();
base.ai_model = 'gpt-oss:20b intent engine + independent repair editor | en-US v10';
base.content_mode = contentMode;
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
