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
    ? `Three ways to meet the ${subject}${scientific}. Begin with its portrait in ${location}, then continue with an X-ray study and an illustrated guide. ${description} Together, the ${imageCount || 'three'} images offer different ways to study the same bird without adding details beyond the supplied material. Which slide would you stop to examine first? Swipe through and tell us what caught your eye.`.replace(/\s+/g,' ').trim()
    : `Meet the ${subject}${scientific} through ${imageCount || 'several'} views from ${location}. ${description} This set keeps the named bird at the center without adding details that were not supplied. Swipe through the photographs, choose the frame that works best as the cover, and tell us what made that image stand out to you.`.replace(/\s+/g,' ').trim();
  fallbackFacebook = hasPhoto && hasXray && hasGraphic
    ? `One bird, viewed three different ways. This carousel begins with a portrait of the ${subject}${scientific} in ${location}, continues with an X-ray study, and concludes with an illustrated reference. ${description} Each supplied format offers a different way to study the same subject. Which view holds your attention most: the photograph, the X-ray, or the illustration?`.replace(/\s+/g,' ').trim()
    : `A closer look at the ${subject}${scientific} through ${imageCount || 'several'} images from ${location}. ${description} The photographs keep the named bird at the center without adding details that were not provided. Browse the set, decide which image works best as the opening slide, and tell us what made you choose it.`.replace(/\s+/g,' ').trim();
  fallbackRedditTitle = `${subject} from ${location}`;
  fallbackReddit = hasPhoto && hasXray && hasGraphic
    ? `Sharing three supplied views of the ${subject}${scientific} from ${location}: a portrait, an X-ray study, and an illustrated guide. ${description} Each format offers a different way to study the same bird without adding facts beyond the source material. Which of the three would you spend the most time with?`.replace(/\s+/g,' ').trim()
    : `Sharing ${imageCount || 'several'} photographs of the ${subject}${scientific} from ${location}. ${description} The set stays focused on the named bird and the supplied images. Which photograph works best as the opening slide, and what makes it the strongest introduction?`.replace(/\s+/g,' ').trim();
} else if (contentMode === 'community') {
  fallbackTitle = 'Birdwatching Is Better Together in Mindo';
  fallbackCaption = `Birdwatching is better when it is shared. These ${imageCount || 'several'} photographs celebrate the people who make each visit to Mindo memorable and the sense of connection behind every day out. ${description} We love welcoming guests of every age into the Mindo Bird Watching family. Swipe through the carousel, then tell us: who would you bring along for a birdwatching experience in Mindo?`.replace(/\s+/g,' ').trim();
  fallbackFacebook = `Some of the best birdwatching moments in Mindo are the ones shared with family. These ${imageCount || 'several'} photographs celebrate the people and connections that make each visit memorable. ${description} We love welcoming curious guests of every age into the Mindo Bird Watching family. Browse the carousel, then tell us: who would you bring along for a birdwatching day in Mindo?`.replace(/\s+/g,' ').trim();
  fallbackRedditTitle = 'Birdwatching is better when the experience is shared';
  fallbackReddit = `Sharing ${imageCount || 'several'} photographs centered on the people and shared moments behind Mindo Bird Watching. ${description} The idea for this set is simple: birdwatching is often more memorable when the experience is shared. Which image would you choose as the cover, and who first introduced you to birdwatching?`.replace(/\s+/g,' ').trim();
} else if (contentMode === 'experience') {
  fallbackTitle = /\bnight walks?\b/i.test(subject) ? 'After Dark in Mindo: Recent Night Walks' : quitoToMindo ? 'From Quito to Mindo: A Day Trip in 10 Photos' : sentenceStyleSubject ? `A Recent Outing in ${location}` : `${subjectTitle} in ${location}`;
  fallbackCaption = /\bnight walks?\b/i.test(subject)
    ? `Night walks reveal a different side of Mindo. These ${imageCount || 'several'} photographs come from some of our recent evenings out, with each frame holding another moment from the experience. ${description} Swipe through slowly, then tell us which image would make you stop and look twice. Would you add a night walk to your next visit to Mindo?`.replace(/\s+/g,' ').trim()
    : quitoToMindo
      ? `A day trip from Quito to Mindo, told through ${imageCount || 'several'} photographs. We kept the full set together because each image adds another moment to the experience, from the first stop to the final frame. ${description} Swipe through and tell us which photograph best captures the day for you. Would you include Mindo in your plans while visiting Quito?`.replace(/\s+/g,' ').trim()
      : `${subjectTitle} in ${location} gave us ${imageCount || 'several'} moments worth sharing. ${description} Rather than reducing the outing to one highlight, this carousel keeps the experience together from the first frame to the last. Swipe through the set and tell us which photograph pulls you into the outing most. Would you join us for an experience like this on your next visit to Mindo?`.replace(/\s+/g,' ').trim();
  fallbackFacebook = /\bnight walks?\b/i.test(subject)
    ? `Night walks have a rhythm of their own. These ${imageCount || 'several'} photographs come from some recent walks in ${location}, and we wanted to keep the moments together instead of choosing only one. ${description} Take your time with the carousel, then let us know which frame best captures the experience for you. If you were joining us after dark, what would you hope to notice first?`.replace(/\s+/g,' ').trim()
    : quitoToMindo
      ? `A day trip from Quito to Mindo can hold more than one memorable moment. These ${imageCount || 'several'} photographs keep the experience together instead of choosing a single image to represent the day. ${description} Browse the carousel from beginning to end, then tell us which frame best captures the outing for you. Would you add a day in Mindo to your plans while staying in Quito?`.replace(/\s+/g,' ').trim()
      : `Here are ${imageCount || 'several'} moments from ${experienceLabel} in ${location}. ${description} The full set keeps the outing together instead of choosing only one photograph to represent it. Browse the carousel from beginning to end, then tell us which frame best captures the feeling of being there. Would this be part of your plans for a visit to Mindo?`.replace(/\s+/g,' ').trim();
  fallbackRedditTitle = /\bnight walks?\b/i.test(subject) ? 'Recent night walks in Mindo, Ecuador' : quitoToMindo ? 'A day trip from Quito to Mindo in 10 photographs' : sentenceStyleSubject ? `A recent outing in ${location}` : `${subjectTitle} in ${location}`;
  fallbackReddit = /\bnight walks?\b/i.test(subject)
    ? `Sharing ${imageCount || 'several'} photographs from some recent night walks in ${location}. ${description} I kept them together as a carousel because the sequence says more about the outing than a single frame would. Which image would you choose as the cover, and what made it stand out?`.replace(/\s+/g,' ').trim()
    : quitoToMindo
      ? `Sharing ${imageCount || 'several'} photographs from a day trip between Quito and Mindo. I kept the outing together as a carousel rather than selecting one image, so the sequence can show more of the experience. ${description} Which frame works best as the opening slide, and which one would you choose as the cover?`.replace(/\s+/g,' ').trim()
      : `Sharing ${imageCount || 'several'} photographs from ${experienceLabel} in ${location}. ${description} I kept the outing together as a carousel rather than selecting a single image. Which frame works best as the opening slide, and which one would you have chosen as the cover?`.replace(/\s+/g,' ').trim();
} else {
  fallbackTitle = `${subjectTitle} in ${location}`;
  fallbackCaption = `${subjectTitle} is the focus of this ${imageCount || 'multi'}-image set from ${location}. ${description} The carousel keeps the supplied subject and photographs together without adding details that were not provided. Swipe through the full sequence, then tell us which frame communicates the subject most clearly and what made that image stand out to you.`.replace(/\s+/g,' ').trim();
  fallbackFacebook = `This ${imageCount || 'multi'}-image carousel focuses on ${displaySubject} in ${location}. ${description} Each supplied photograph adds another view while the copy stays within the information provided. Browse the full set, choose the image that would make the strongest cover, and tell us what led you to that choice.`.replace(/\s+/g,' ').trim();
  fallbackRedditTitle = `${subjectTitle} — ${location}`;
  fallbackReddit = `Sharing a ${imageCount || 'multi'}-image set focused on ${displaySubject} in ${location}. ${description} I kept the captions limited to the supplied context rather than guessing at details. Which image would you use as the cover, and what makes it the clearest introduction to the set?`.replace(/\s+/g,' ').trim();
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
if (instagramWords < 50 || instagramWords > 120) issues.push('Instagram caption outside 50–120 words');
if (facebookWords < 50 || facebookWords > 140) issues.push('Facebook caption outside 50–140 words');
if (redditWords < 35 || redditWords > 120) issues.push('Reddit body outside 35–120 words');
if (title.length > 80 || redditTitle.length > 120) issues.push('generated title too long');
if (finalTags.length !== 5 || facebookTags.split(/\s+/).length !== 3 || redditTags.split(/\s+/).length !== 3) issues.push('platform hashtag counts invalid');
const genericPattern = /submitted (?:images|visual details)|featured bird|visual story|complete carousel|follow (?:us|mindo bird watching) for more|shift perspectives|distinct visual formats|different kind of attention|designed for slower looking|what catches your attention|visual journey|carefully curated|subtle shifts?|invites contemplation|natural beauty|rhythm of the landscape|light and composition/i;
if (genericPattern.test(finalText)) issues.push('generic internal or filler language');
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
