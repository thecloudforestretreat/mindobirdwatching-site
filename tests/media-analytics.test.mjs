import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url);
const analytics=require("../admin/assets/js/media-analytics.js");

const posts=[
  {content_id:"a",platform:"Instagram",type:"reel",published_date:"2026-10-20",publish_day:"Tuesday",publish_hour:7,result:100,engagements:10,denominator:100,engagement_rate:10,tags:[{key:"species:yellow-throated-toucan",label:"Yellow-throated Toucan",category:"species"}]},
  {content_id:"b",platform:"Instagram",type:"reel",published_date:"2026-10-20",publish_day:"Tuesday",publish_hour:7,result:300,engagements:15,denominator:300,engagement_rate:5,tags:[{key:"species:yellow-throated-toucan",label:"Yellow-throated Toucan",category:"species"}]},
  {content_id:"c",platform:"YouTube",type:"carousel",published_date:"2026-10-21",publish_day:"Wednesday",publish_hour:16,result:200,engagements:20,denominator:200,engagement_rate:10,tags:[{key:"activity:night-walk",label:"Night walk",category:"activity"}]},
];

test("date groups retain contributing posts and aggregate rates",()=>{
  const rows=analytics.dateGroups(posts,"engagement_rate");
  assert.equal(rows[0].posts.length,2);
  assert.equal(rows[0].value,6.25);
});

test("heatmap reports sample confidence separately from performance",()=>{
  const rows=analytics.heatmapGroups(posts,"result");
  const tuesday=rows.find(row=>row.day==="Tuesday");
  assert.equal(tuesday.value,200);
  assert.equal(tuesday.confidence,"early");
  assert.equal(tuesday.count,2);
});

test("tag performance uses canonical keys and exposes median",()=>{
  const tag=analytics.tagPerformance(posts,"result").find(row=>row.key==="species:yellow-throated-toucan");
  assert.equal(tag.count,2);
  assert.equal(tag.median,200);
  assert.equal(tag.average,200);
});

test("zero expected IDs are N/A rather than a false 100 percent",()=>{
  const health=analytics.health({data_health:{platforms:{facebook:{expected:0,matched:0}}}},posts);
  const facebook=health.platforms.find(row=>row.key==="facebook");
  assert.equal(facebook.rate,null);
  assert.equal(facebook.status,"unknown");
});

test("duplicate rows and tag coverage are auditable",()=>{
  const duplicate={...posts[0]};
  const health=analytics.health({data_health:{platforms:{}}},posts.concat(duplicate));
  assert.equal(health.duplicates,1);
  assert.equal(health.tag_coverage,100);
});

test("observed winners require a real comparison group",()=>{
  const oneEligibleGroup=analytics.observedPatterns(posts.filter(post=>post.platform==="Instagram"),"result");
  assert.equal(oneEligibleGroup.some(row=>row.kind==="format"),false);
  const comparison=posts.filter(post=>post.platform==="Instagram").concat(
    {content_id:"c",platform:"Instagram",type:"carousel",published_date:"2026-10-21",publish_day:"Wednesday",publish_hour:16,result:200,engagements:20,denominator:200,engagement_rate:10,tags:[]},
    {content_id:"d",platform:"Instagram",type:"carousel",published_date:"2026-10-22",publish_day:"Wednesday",publish_hour:16,result:250,engagements:20,denominator:250,engagement_rate:8,tags:[]}
  );
  assert.equal(analytics.observedPatterns(comparison,"result").some(row=>row.kind==="format"),true);
});

test("views and reach are not compared across platforms",()=>{
  assert.deepEqual(analytics.observedPatterns(posts,"result"),[]);
});

test("response map refuses to combine platform visibility measures",()=>{
  const map=analytics.responseMap(posts);
  assert.equal(map.comparable,false);
  assert.equal(map.summaries.length,2);
});

test("response map positions posts only after one platform is selected",()=>{
  const map=analytics.responseMap(posts.filter(post=>post.platform==="Instagram"));
  assert.equal(map.comparable,true);
  assert.equal(map.platform,"Instagram");
  assert.equal(map.points.length,2);
  assert.equal(map.median_visibility,200);
  assert.equal(map.median_engagement_rate,7.5);
  assert.ok(map.points.every(point=>point.x>=3&&point.x<=97&&point.y>=3&&point.y<=97));
});

test("facebook reconciliation evidence remains available to data health",()=>{
  const health=analytics.health({data_health:{platforms:{facebook:{expected:10,matched:8,unmatched:2,matched_with_visibility:6,visibility_missing:2,connection_reason:"Reconnect Page access.",match_methods:{exact_id:5,permalink:2,caption_date:1},unmatched_reasons:{not_returned_or_ambiguous:2}}}}},posts);
  const facebook=health.platforms.find(row=>row.key==="facebook");
  assert.equal(facebook.rate,80);
  assert.equal(facebook.matched_with_visibility,6);
  assert.equal(facebook.visibility_missing,2);
  assert.equal(facebook.connection_reason,"Reconnect Page access.");
  assert.equal(facebook.match_methods.caption_date,1);
  assert.equal(facebook.unmatched_reasons.not_returned_or_ambiguous,2);
});

test("cross-platform visibility is never totaled as one comparable metric",()=>{
  const result=analytics.summary(posts,"all");
  assert.equal(result.comparable,false);
  assert.equal(result.visibility_label,"Platform visibility");
  assert.equal(result.posts,3);
  assert.equal(result.engagements,45);
});

test("engagement rate excludes engagement-only rows without visibility",()=>{
  const facebook=[
    {content_id:"fb-1",platform:"Facebook",result:0,denominator:0,engagements:40},
    {content_id:"fb-2",platform:"Facebook",result:100,denominator:100,engagements:10},
  ];
  const result=analytics.summary(facebook,"facebook");
  assert.equal(result.comparable,true);
  assert.equal(result.visibility_label,"Media views");
  assert.equal(result.visible_records,1);
  assert.equal(result.visibility_coverage,50);
  assert.equal(result.engagements,50);
  assert.equal(result.engagement_rate,10);
});
