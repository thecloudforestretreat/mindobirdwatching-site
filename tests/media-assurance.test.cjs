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

test('sheet-style US dates are normalized before Eastern schedule checks',()=>{
  const row={...carousel,scheduled_date:'11/24/2026',scheduled_time:'3:00 PM'};
  const result=assurance.evaluate(row,'carousel',{now:{date:'2026-11-24',time:'11:58'}});
  assert.equal(assurance.normalizeDate(row.scheduled_date),'2026-11-24');
  assert.equal(result.checks.find(check=>check.key==='schedule').ok,true);
  assert.equal(result.ready,true);
  assert.equal(result.minutes_until,182);
});

test('invalid calendar dates do not pass readiness',()=>{
  const result=assurance.evaluate({...carousel,scheduled_date:'02/30/2026'},'carousel',{now});
  assert.equal(result.checks.find(check=>check.key==='schedule').ok,false);
  assert.equal(result.ready,false);
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

test('saved reel blurb satisfies YouTube description readiness',()=>{
  const row={...reel,youtube_description:'',blurb:'A factual YouTube description saved by the reel workflow.'};
  const result=assurance.evaluate(row,'reel',{now});
  assert.equal(result.ready,true);
});

test('publication history shows claims, receipts, and the next safe action',()=>{
  const row={...reel,scheduled_time:'08:30',submitted_at:'2026-11-23T16:00:00Z',approval_timestamp:'2026-11-23T17:00:00Z',instagram_post_id:'ig-1',facebook_publish_claim_id:'claim-fb',facebook_publish_claimed_at:'2026-11-24T13:31:00Z'};
  const result=assurance.evaluate(row,'reel',{now});
  assert.ok(result.timeline.some(step=>step.key==='instagram'&&step.state==='complete'));
  assert.ok(result.timeline.some(step=>step.key==='facebook'&&step.state==='attention'));
  assert.match(result.next_action,/Reconcile/i);
});

test('unsupported reel media is blocked before publishing',()=>{
  const result=assurance.evaluate({...reel,video_url:'https://media.example/reel.jpg'},'reel',{now});
  assert.equal(result.ready,false);
  assert.equal(result.checks.find(check=>check.key==='media').ok,false);
});
