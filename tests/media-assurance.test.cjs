const test=require('node:test');
const assert=require('node:assert/strict');
const assurance=require('../admin/assets/js/media-assurance.js');

const now={date:'2026-11-24',time:'09:00'};
const reel={scheduled_date:'2026-11-24',scheduled_time:'09:30',video_url:'https://media.example/reel.mp4',approval_status:'APPROVED',copy_review_status:'FINAL',quality_score:96,post_to_instagram:true,post_to_facebook:true,post_on_youtube:true,instagram_caption_final:'A factual caption',youtube_title:'A title',youtube_description:'A factual description'};
const carousel={scheduled_date:'2026-11-24',scheduled_time:'09:30',approval_status:'APPROVED',copy_review_status:'PASS',quality_score:96,post_to_instagram:true,post_to_facebook:true,carousel_title:'Three views',caption:'Instagram caption',instagram_hashtags:'#one #two',facebook_caption:'Facebook caption',facebook_hashtags:'#one #two',image_1_url:'https://media.example/1.jpg',image_2_url:'https://media.example/2.jpg'};

test('reel and carousel share the 60-minute readiness window',()=>{
  const r=assurance.evaluate(reel,'reel',{now});
  const c=assurance.evaluate(carousel,'carousel',{now});
  assert.equal(r.ready,true);assert.equal(c.ready,true);assert.equal(r.preflight_window,true);assert.equal(c.preflight_window,true);
});

test('one successful destination never hides a missing cross-post receipt',()=>{
  const row={...reel,scheduled_time:'08:30',instagram_post_id:'ig-1',instagram_published_date:'2026-11-24',facebook_post_id:'',youtube_post_id:''};
  const result=assurance.evaluate(row,'reel',{now});
  assert.equal(result.verified,false);assert.equal(result.partial,true);assert.equal(result.verification_overdue,true);assert.equal(result.tone,'error');
});

test('all selected reel destinations require durable receipts',()=>{
  const row={...reel,instagram_post_id:'ig-1',facebook_post_id:'fb-1',youtube_post_id:'yt-1'};
  const result=assurance.evaluate(row,'reel',{now});
  assert.equal(result.verified,true);assert.equal(result.platforms.length,3);assert.ok(result.platforms.every(platform=>platform.verified));
});

test('carousel verification covers Instagram and Facebook',()=>{
  const row={...carousel,instagram_post_id:'ig-1',facebook_post_id:'fb-1'};
  const result=assurance.evaluate(row,'carousel',{now});
  assert.equal(result.verified,true);assert.deepEqual(result.platforms.map(platform=>platform.platform),['instagram','facebook']);
});

test('ambiguous claims require reconciliation instead of an automatic repost',()=>{
  const row={...carousel,scheduled_time:'08:30',instagram_publish_claim_id:'claim-1',instagram_publish_state:'CLAIMED'};
  const result=assurance.evaluate(row,'carousel',{now});
  assert.equal(result.ambiguous,true);assert.equal(result.tone,'error');
});
