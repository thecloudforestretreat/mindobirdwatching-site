import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";

const root=new URL("../",import.meta.url).pathname;

function buildWorkflow(){
  const directory=mkdtempSync(join(tmpdir(),"mbw-analytics-"));
  const output=join(directory,"workflow.json");
  const run=spawnSync(process.execPath,[join(root,"n8n/build_social_media_analytics.mjs")],{cwd:root,encoding:"utf8",env:{...process.env,MBW_ANALYTICS_OUTPUT:output}});
  assert.equal(run.status,0,run.stderr||run.stdout);
  return JSON.parse(readFileSync(output,"utf8"));
}

test("analytics workflow queries Facebook posts and reels with the correct object fields",()=>{
  const workflow=buildWorkflow();
  const names=new Set(workflow.nodes.map(node=>node.name));
  assert.ok(names.has("[META] Facebook Stored Posts"));
  assert.ok(names.has("[META] Facebook Stored Reels"));
  assert.ok(names.has("[JOIN] Facebook Stored Objects"));
  assert.ok(names.has("[META] Facebook Batch Insights"));
  assert.ok(names.has("[JOIN] Facebook Sources"));
  const prepare=workflow.nodes.find(node=>node.name==="[CORE] Prepare Batch Queries").parameters.jsCode;
  assert.match(prepare,/published_posts/);
  assert.match(prepare,/fb_ids_url/);
  assert.match(prepare,/fb_reels_url/);
  assert.match(prepare,/description,picture,thumbnails,likes/);
  assert.match(prepare,/facebook_caption/);
  assert.match(prepare,/post_media_view,post_total_media_view_unique,post_clicks,post_reactions_by_type_total,post_video_views/);
  assert.match(prepare,/const facebookPostCandidates = values => unique\(values\.map/);
  assert.match(prepare,/const facebookReelCandidates = values => unique\(values\.map/);
  assert.doesNotMatch(prepare,/facebookCandidates = values => unique\(values\.flatMap/);
  assert.doesNotMatch(prepare,/post_impressions_unique/);
  assert.doesNotMatch(prepare,/post_engaged_users/);
});

test("analytics workflow keeps Facebook recovery deterministic and auditable",()=>{
  const workflow=buildWorkflow();
  const report=workflow.nodes.find(node=>node.name==="[REPORT] Build Dashboard Payload").parameters.jsCode;
  assert.match(report,/score>=\.72/);
  assert.match(report,/score-candidates\[1\]\.score>=\.15/);
  assert.match(report,/facebook_match_method/);
  assert.match(report,/not_returned_or_ambiguous/);
  assert.match(report,/denominator=v\.reach\|\|v\.views/);
  assert.match(report,/visibility_available/);
  assert.match(report,/visibility_missing/);
  assert.match(report,/const visibilityRows=current\.filter/);
  assert.match(report,/const platformCounts=visibilityRows\.reduce/);
  assert.match(report,/facebookPageAuthorized/);
  assert.match(report,/connection_reason/);
  assert.match(report,/metaCredentialReason=apiError\(pageAccessRaw\)\|\|apiError\(igRaw\)/);
  assert.match(report,/instagramConnectionReason/);
  assert.match(report,/value\.error\.description \|\| value\.error\.message/);
  assert.match(report,/post_total_media_view_unique/);
  assert.match(report,/post_media_view/);
  assert.match(report,/Unique viewers/);
  assert.match(report,/facebook_unique_viewers/);
  assert.match(report,/visibility_totals_are_comparable:false/);
  assert.match(report,/unique_viewers:fbTotals\.reach/);
  assert.match(report,/platform:'Instagram'/);
  assert.match(report,/platform:'Facebook'/);
  assert.doesNotMatch(report,/platform:'Instagram \+ Facebook'/);
  assert.doesNotMatch(report,/v\.reach\|\|v\.engaged_users\|\|engagement/);
  for(const node of workflow.nodes.filter(node=>node.type==="n8n-nodes-base.code"))assert.doesNotThrow(()=>new Function(node.parameters.jsCode),node.name);
});

test("analytics workflow recovers YouTube records from canonical saved URLs and audits gaps",()=>{
  const workflow=buildWorkflow();
  const prepare=workflow.nodes.find(node=>node.name==="[CORE] Prepare Batch Queries").parameters.jsCode;
  const report=workflow.nodes.find(node=>node.name==="[REPORT] Build Dashboard Payload").parameters.jsCode;
  assert.match(prepare,/youtubeIdFromUrl/);
  assert.match(prepare,/records\.flatMap\(r => \[r\.youtube_post_id,r\.youtube_url_id\]\)/);
  assert.match(report,/youtubeMatches=\{exact_id:0,url_fallback:0,unmatched:0,unresolved:\[\]\}/);
  assert.match(report,/youtube_url_id&&ytById\[r\.youtube_url_id\]/);
  assert.match(report,/youtube_match_method/);
  assert.match(report,/not_returned_by_api/);
  assert.match(report,/matched_with_visibility:status\.visible/);
});
