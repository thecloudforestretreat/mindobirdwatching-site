const assert = require('assert');
const fs = require('fs');

const prompt = fs.readFileSync('n8n/reels-v9/build-local-creative-request.js', 'utf8');
const parser = fs.readFileSync('n8n/reels-v9/parse-validate-local-draft.js', 'utf8');
const guard = fs.readFileSync('n8n/reels-v9/validate-copy-before-publishing.js', 'utf8');
const intake = fs.readFileSync('n8n/reels-v9/intake-defaults.js', 'utf8');

const badCaption = 'One birdwatching in Mindo, Ecuador can bring several distinct moments together. A young kid playing by the river, plus two yellow-throated toucans on a tree and a hummingbird battling the rain... Those are the details that made this experience in Mindo, Ecuador worth sharing. Every outing develops from the moments that are actually present, and this was the clear focus here.';
const secondBadCaption = 'Birding in Mindo can unfold in unexpected ways. Three distinct moments shared the same outing, each offering something different to notice. Which one would have caught your eye first?';

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
assert(prompt.includes('Never open with a broad claim about how birding "can unfold"'), 'Writer must lead with a concrete subject or action');
assert(intake.includes('Number(row.quality_score || 0) >= 92'), 'Existing copy must meet the strong quality threshold');

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
  instagram_caption_raw: 'A young visitor played beside the river while two Yellow-throated Toucans perched above. The same outing also included a hummingbird pushing through the rain. Message us to plan a guided birding experience in Mindo.',
  instagram_caption_final: 'A young visitor played beside the river while two Yellow-throated Toucans perched above. Message us to plan a guided birding experience in Mindo.\n\n#mindobirdwatching #mindo #ecuador #YellowThroatedToucan #MindoBirding',
  instagram_hashtags: '#mindobirdwatching #mindo #ecuador #YellowThroatedToucan #MindoBirding',
  youtube_title: 'Yellow-throated Toucans by the River in Mindo, Ecuador',
  post_to_instagram: true, post_to_facebook: false, post_on_youtube: false, post_on_tiktok: false,
};
assert.throws(
  () => runGuard({ ...validRow, instagram_post_id: '18117680411048645' }),
  /existing publication data found for Instagram/,
  'A stored platform ID must block an automatic repost',
);
assert.throws(
  () => runGuard({ ...validRow, instagram_caption_raw: secondBadCaption, instagram_caption_final: `${secondBadCaption}\n\n${validRow.instagram_hashtags}` }),
  /unsupported, generic, or unnatural template wording/,
  'The reported generic caption must be blocked at publish time',
);

console.log(JSON.stringify({ ok: true, rejectedRegressionCaption: true, rejectedSecondCaption: true, duplicateGuardExecuted: true, checks: rejectionPatterns.length + secondRejectionPatterns.length + 2 }, null, 2));
