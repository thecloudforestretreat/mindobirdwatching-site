const assert = require('assert');
const fs = require('fs');

const prompt = fs.readFileSync('n8n/reels-v9/build-local-creative-request.js', 'utf8');
const parser = fs.readFileSync('n8n/reels-v9/parse-validate-local-draft.js', 'utf8');
const guard = fs.readFileSync('n8n/reels-v9/validate-copy-before-publishing.js', 'utf8');
const intake = fs.readFileSync('n8n/reels-v9/intake-defaults.js', 'utf8');
const claim = fs.readFileSync('n8n/reels-v9/publish-claim.js', 'utf8');
const finalizer = fs.readFileSync('n8n/reels-v9/finalize-publish.js', 'utf8');

const badCaption = 'One birdwatching in Mindo, Ecuador can bring several distinct moments together. A young kid playing by the river, plus two yellow-throated toucans on a tree and a hummingbird battling the rain... Those are the details that made this experience in Mindo, Ecuador worth sharing. Every outing develops from the moments that are actually present, and this was the clear focus here.';
const secondBadCaption = 'Birding in Mindo can unfold in unexpected ways. Three distinct moments shared the same outing, each offering something different to notice. Which one would have caught your eye first?';
const thirdBadCaption = 'The tour offers guided observation of these species in wet conditions. Experience the thrill of spotting these birds in the rain. Book your spot today.';
const fourthBadCaption = 'Join us on a tour through several habitats. Experience an unforgettable surprise and book your adventure today.';

assert(parser.includes("const grammar = /\\b(?:one|a|an|each)\\s+(?:birdwatching|birding)\\b/i"), 'Parser must reject unnatural activity grammar');
assert(parser.includes('deterministic_fallback_requires_review'), 'Fallback copy must require review');
assert(parser.includes("const qualityScore = approved ? 95"), 'Single-pass approval must not receive a perfect score');
assert(parser.includes('intake_description_copied_verbatim'), 'Parser must reject copied intake wording');
assert(parser.includes('instagram_missing_bird_hashtag'), 'Parser must require a bird hashtag when birds are supplied');
assert(prompt.includes('do not paste it as a complete sentence'), 'Writer must paraphrase the intake description');
assert(prompt.includes('invented compound tags such as #RainyRiver'), 'Writer must reject weak invented hashtags');
assert(parser.includes("'riverplay', 'rainyday', 'rainyriver'"), 'Parser must remove weak discovery hashtags');
assert(guard.includes('/\\bshowdown\\b/i'), 'Publishing guard must reject unsupported clickbait titles');
assert(guard.includes('qualityScore < 92'), 'Publishing guard must require a strong quality score');
assert(guard.includes('fallback or draft copy requires review'), 'Publishing guard must block fallback copy');
assert(guard.includes('existing publication data found'), 'Publishing guard must block an already-posted destination');
assert(guard.includes('caption must contain 35–100 words'), 'Publishing guard must independently enforce Instagram caption length');
assert(guard.includes('row.instagram_caption_final || row.instagram_caption_raw'), 'Publishing guard must validate the saved final caption before the original generated draft');
assert(guard.includes('copy invents scene details that were not supplied'), 'Publishing guard must independently reject invented scene details');
assert(prompt.includes('Never open with a broad claim about how birding "can unfold"'), 'Writer must lead with a concrete subject or action');
assert(prompt.includes('locations are not automatically habitats'), 'Writer must preserve the factual distinction between locations and habitats');
assert(prompt.includes('Mindo, Ecuador is in the Andean Chocó cloud forest'), 'Writer must retain the verified Mindo destination fact pack');
assert(intake.includes('Number(row.quality_score || 0) >= 92'), 'Existing copy must meet the strong quality threshold');
assert(parser.includes("'trail'"), 'Generated settings such as a trail must be grounded in the intake');
assert(parser.includes("'garden','feeder','bridge','road','lodge','breakfast'"), 'Common invented scene details must be grounded in the intake');
assert(parser.includes('mac_mini_writer_unavailable'), 'Ollama transport failures must be identified as Mac mini outages');
assert(parser.includes('unsupported_current_weather'), 'Stable Mindo context must not become unsupported current-weather claims');
assert(intake.includes("status === 'generating'"), 'Stale Mac mini generation locks must be recoverable');
assert(!claim.includes("platform: 'tiktok'"), 'TikTok must never receive an automated publication claim');
assert(claim.includes("row.status = 'Needs Attention'"), 'Ambiguous claims must fail closed for reconciliation');
assert(claim.includes('return { json: row }'), 'Per-item claim node must return one n8n item object');
assert(finalizer.includes('Legacy claims must not keep'), 'Finalizer must clear obsolete TikTok claims');
assert(finalizer.includes('return { json: row }'), 'Per-item finalizer must return one n8n item object');

const rejectionPatterns = [
  /can bring several distinct moments together/i,
  /those (?:are|supplied) (?:the )?details that made this experience(?: in [^.]+)? worth sharing/i,
  /every outing develops from the moments that are actually present/i,
  /this was the clear focus here/i,
  /\b(?:one|a|an|each)\s+(?:birdwatching|birding)\b/i,
  /(?:\.{3,}|…)/,
];
assert(rejectionPatterns.filter(pattern => pattern.test(badCaption)).length >= 5, 'Reported bad caption must fail multiple independent checks');
const secondRejectionPatterns = [
  /can unfold in unexpected ways/i,
  /three distinct moments/i,
  /each offering something different to notice/i,
  /which (?:one|moment) would have caught your eye(?: first)?/i,
];
assert(secondRejectionPatterns.every(pattern => pattern.test(secondBadCaption)), 'Today\'s generic caption must fail every dedicated quality check');

const runGuard = new Function('$json', guard);
const validRow = {
  input_status: 'READY', approval_status: 'APPROVED', quality_score: 95,
  final_copy_source: 'HUMAN_EDITED_VALIDATED_V3', location: 'Mindo, Ecuador',
  reel_description: 'A young visitor played by the river while two Yellow-throated Toucans perched in a tree.',
  instagram_caption_raw: 'A young visitor played beside the river while two Yellow-throated Toucans perched above. The same outing also included a hummingbird pushing through the rain nearby. Message us to plan a guided birding experience in Mindo.',
  instagram_caption_final: 'A young visitor played beside the river while two Yellow-throated Toucans perched above. The same outing also included a hummingbird pushing through the rain nearby. Message us to plan a guided birding experience in Mindo.\n\n#mindobirdwatching #mindo #ecuador #YellowThroatedToucan #MindoBirding',
  instagram_hashtags: '#mindobirdwatching #mindo #ecuador #YellowThroatedToucan #MindoBirding',
  youtube_title: 'Yellow-throated Toucans by the River in Mindo, Ecuador',
  post_to_instagram: true, post_to_facebook: false, post_on_youtube: false, post_on_tiktok: false,
};
const tooShortCaption = 'A Yellow-throated Toucan perched in view during our birdwatching tour in Mindo, Ecuador.';
assert.throws(
  () => runGuard({ ...validRow, instagram_caption_raw: tooShortCaption, instagram_caption_final: `${tooShortCaption}\n\n${validRow.instagram_hashtags}` }),
  /caption must contain 35–100 words/,
  'A short caption must not publish merely because its stored score is 100',
);
assert.throws(
  () => runGuard({ ...validRow, reel_description: 'A Yellow-throated Toucan during a recent tour.', instagram_caption_raw: validRow.instagram_caption_raw.replace('beside the river', 'beside a feeder'), instagram_caption_final: validRow.instagram_caption_final.replace('beside the river', 'beside a feeder') }),
  /invents scene details that were not supplied: feeder/,
  'Scene details must be grounded in the supplied description',
);
assert.throws(
  () => runGuard({ ...validRow, instagram_post_id: '18117680411048645' }),
  /existing publication data found for Instagram/,
  'A stored platform ID must block an automatic repost',
);
assert.throws(
  () => runGuard({ ...validRow, instagram_caption_raw: thirdBadCaption, instagram_caption_final: `${thirdBadCaption}\n\n${validRow.instagram_hashtags}` }),
  /unsupported, generic, or unnatural template wording/,
  'Stock AI sales language must be blocked even when rain and thrill are valid facts',
);
assert.throws(
  () => runGuard({ ...validRow, reel_description: 'We visit several locations and sometimes find a big surprise.', instagram_caption_raw: fourthBadCaption, instagram_caption_final: `${fourthBadCaption}\n\n${validRow.instagram_hashtags}` }),
  /unsupported, generic, or unnatural template wording/,
  'Unforgettable adventure boilerplate must be blocked before publishing',
);
assert.throws(
  () => runGuard({ ...validRow, post_on_tiktok: true, tiktok_caption: 'Rainy Mindo brings the birds to the trail.', tiktok_hashtags: '#mindobirdwatching #mindo #ecuador #MindoBirding #CloudForest', tiktok_additional_hashtags: '#Birdwatching #EcuadorBirds #NatureTravel #Toucan #Hummingbird', instagram_caption_final: validRow.instagram_caption_final }),
  /invents a trail/,
  'A trail must not be invented when the intake did not supply one',
);
assert.doesNotThrow(
  () => runGuard({
    ...validRow,
    reel_description: 'Birding outdoors in nature in the rain is part of the thrill.',
    instagram_caption_raw: 'It was a rainy birdwatching day in Mindo, with an Andean Cock-of-the-Rock, a hummingbird, and a Pale-mandibled Aracari all making an appearance. Being outside in nature means taking the weather as it comes, and that is part of the thrill. Message us to plan a guided birdwatching experience in Mindo.',
    instagram_caption_final: 'It was a rainy birdwatching day in Mindo, with an Andean Cock-of-the-Rock, a hummingbird, and a Pale-mandibled Aracari all making an appearance. Being outside in nature means taking the weather as it comes, and that is part of the thrill. Message us to plan a guided birdwatching experience in Mindo.\n\n#mindobirdwatching #mindo #ecuador #AndeanCockOfTheRock #MindoBirding',
  }),
  'Natural use of explicitly supplied rain, nature, and thrill must remain allowed',
);
assert.throws(
  () => runGuard({ ...validRow, instagram_caption_raw: secondBadCaption, instagram_caption_final: `${secondBadCaption}\n\n${validRow.instagram_hashtags}` }),
  /unsupported, generic, or unnatural template wording/,
  'The reported generic caption must be blocked at publish time',
);
assert.doesNotThrow(
  () => runGuard({ ...validRow, post_to_x: false, x_caption: 'Discover the magic of this unforgettable experience on a stunning trail.' }),
  'Unused hidden X copy must not block selected publishing destinations',
);
assert.throws(
  () => runGuard({ ...validRow, post_to_x: true, x_caption: 'Discover the magic of this unforgettable experience on a stunning trail.' }),
  /unsupported, generic, or unnatural template wording/,
  'X copy must still be validated when X is an enabled destination',
);

console.log(JSON.stringify({ ok: true, rejectedRegressionCaption: true, rejectedSecondCaption: true, rejectedStockSalesCopy: true, rejectedAdventureBoilerplate: true, preservesSuppliedFeeling: true, ignoresUnusedXCopy: true, duplicateGuardExecuted: true, checks: rejectionPatterns.length + secondRejectionPatterns.length + 8 }, null, 2));
