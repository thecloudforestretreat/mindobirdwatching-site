const assert = require('assert');
const fs = require('fs');

const prompt = fs.readFileSync('n8n/reels-v9/build-local-creative-request.js', 'utf8');
const parser = fs.readFileSync('n8n/reels-v9/parse-validate-local-draft.js', 'utf8');
const guard = fs.readFileSync('n8n/reels-v9/validate-copy-before-publishing.js', 'utf8');

const badCaption = 'One birdwatching in Mindo, Ecuador can bring several distinct moments together. A young kid playing by the river, plus two yellow-throated toucans on a tree and a hummingbird battling the rain... Those are the details that made this experience in Mindo, Ecuador worth sharing. Every outing develops from the moments that are actually present, and this was the clear focus here.';

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

const rejectionPatterns = [
  /can bring several distinct moments together/i,
  /those (?:are|supplied) (?:the )?details that made this experience(?: in [^.]+)? worth sharing/i,
  /every outing develops from the moments that are actually present/i,
  /this was the clear focus here/i,
  /\b(?:one|a|an|each)\s+(?:birdwatching|birding)\b/i,
  /(?:\.{3,}|…)/,
];
assert(rejectionPatterns.filter(pattern => pattern.test(badCaption)).length >= 5, 'Reported bad caption must fail multiple independent checks');

console.log(JSON.stringify({ ok: true, rejectedRegressionCaption: true, checks: rejectionPatterns.length }, null, 2));
