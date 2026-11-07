const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const root = 'n8n/reels-caption-parity/';
const base = {reel_description:'A baby Yellow-throated Toucan peeking out of a nest inside a palm tree in Mindo, Ecuador.',location:'Mindo, Ecuador',activity_name:'Birdwatching',admin_mode:'review'};
const draft = {featured_birds:['Yellow-throated Toucan'],activity_name:'Birdwatching',blurb:'A baby Yellow-throated Toucan peeks from a palm tree nest in Mindo, Ecuador.',youtube_title:'A Baby Yellow-throated Toucan Peeks from a Palm Tree in Mindo',tiktok_caption:'A baby Yellow-throated Toucan peeks from its nest in Mindo, Ecuador.',instagram_primary_hashtags:['YellowThroatedToucan','Birdwatching'],tiktok_primary_hashtags:['YellowThroatedToucan','Birdwatching'],tiktok_additional_hashtags:['Toucan','EcuadorBirds','BirdWatching','Wildlife','MindoBirding'],x_caption:'A baby Yellow-throated Toucan peeks from its nest in Mindo.',x_hashtags:['Toucan'],review_verdict:'APPROVE',review_notes:[]};
function run(file, data, row=base) {return vm.runInNewContext('(function(){'+fs.readFileSync(root+file,'utf8')+'})()',{$json:data,$:()=>({item:{json:row}})}).json;}
for (const file of ['parse-validate-local-draft.js','finalize-editorial-review.js','finalize-targeted-repair.js']) {
 for (const n of [16,34,35,100,101]) {
  const result=run(file,{message:{content:JSON.stringify({...draft,instagram_caption:Array(n).fill('Toucan').join(' ')})}});
  assert.equal(result.local_validation_flags.includes('instagram_length_outside_35_100'), n<35||n>100, file+': '+n);
 }
}
for(const file of ['build-local-creative-request.js','build-editorial-review.js','build-targeted-repair.js']) {
 const code=fs.readFileSync(root+file,'utf8');
 assert.match(code,/35–100 words/);assert.doesNotMatch(code,/Instagram[^\n]*(?:20–80|20–85)/);
}
const ui=fs.readFileSync('admin/assets/js/reels-studio.js','utf8');
const count=vm.runInNewContext('('+ui.match(/function instagramWordCount\(value\) \{[\s\S]*?\n  \}/)[0]+')',{clean:v=>String(v??'').trim()});
assert.equal(count('A toucan peeks.\n\n#one #two #three #four #five'),3);
assert.equal(count(''),0);
const title=vm.runInNewContext('('+ui.match(/function reelTitle\(row\) \{[\s\S]*?\n  \}/)[0]+')',{clean:v=>String(v??'').trim()});
assert.equal(title({youtube_title:'Baby Toucan',activity_name:'Birdwatching Tour'}),'Baby Toucan');
console.log('PASS: 15 boundary cases, all 3 prompts, hashtag-excluding counter, specific display title.');
