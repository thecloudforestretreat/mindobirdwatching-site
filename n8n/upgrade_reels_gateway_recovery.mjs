import fs from "node:fs";
import crypto from "node:crypto";

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) {
  throw new Error("Usage: node n8n/upgrade_reels_gateway_recovery.mjs <gateway-export.json> <output.json>");
}

const workflow = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const byName = name => workflow.nodes.find(node => node.name === name);
const plan = byName("Plan Reels Action");
const route = byName("Route Reels Action");
if (!plan || !route) throw new Error("The expected Reels gateway nodes were not found.");

let code = String(plan.parameters.jsCode || "");
const listNeedle = "if (action === 'list_reels') {";
if (!code.includes(listNeedle)) throw new Error("The list_reels action was not found.");
if (!code.includes("action === 'health'")) {
  code = code.replace(listNeedle, "if (action === 'health') return [{ json: { _route: 'health', checked_at: new Date().toISOString() } }];\n\n" + listNeedle);
}

const updateNeedle = "if (action === 'update_reel') {";
if (!code.includes(updateNeedle)) throw new Error("The update_reel action was not found.");
if (!code.includes("action === 'replace_media'")) {
  const replacement = `if (action === 'replace_media') {
  const videoUrl = clean(body.video_url);
  if (!/^https:\\/\\/res\\.cloudinary\\.com\\/[^/]+\\/video\\/upload\\/.+\\.(?:mp4|mov|m4v)(?:[?#].*)?$/i.test(videoUrl)) return response(false, 'Enter a valid Cloudinary video URL ending in MP4, MOV, or M4V.');
  const started = ['instagram','facebook','youtube'].some(platform => clean(row[platform + '_post_id']) || clean(row[platform + '_publish_claim_id']) || ['CLAIMED','PUBLISHING','UNKNOWN','RECONCILE','PUBLISHED'].includes(clean(row[platform + '_publish_state']).toUpperCase()));
  if (started) return response(false, 'The video cannot be replaced because publishing has already started.');
  if (rows.some(candidate => clean(candidate.video_url) === videoUrl && clean(candidate.post_id) !== clean(row.post_id))) return response(false, 'That video URL is already assigned to another reel.');
  row.video_url = videoUrl;
  return [{ json: { ...row, _route: 'update_only' } }];
}

`;
  code = code.replace(updateNeedle, replacement + updateNeedle);
}

const retryNeedle = "if (action === 'retry_reel') {";
if (!code.includes(retryNeedle)) throw new Error("The retry_reel action was not found.");
if (!code.includes("action === 'publish_overdue'")) {
  const recovery = `if (action === 'publish_overdue') {
  if (clean(row.approval_status).toUpperCase() !== 'APPROVED' || Number(row.quality_score || 0) < 92 || clean(row.copy_review_status).toUpperCase() !== 'FINAL') return response(false, 'This reel must have final approved copy with a quality score of at least 92 before recovery.');
  const when = scheduledAt(row);
  if (!when.isValid || when.toMillis() > DateTime.now().setZone('America/New_York').toMillis()) return response(false, 'This reel is not overdue. Keep its future schedule instead.');
  const automated = [
    ['instagram','post_to_instagram'],
    ['facebook','post_to_facebook'],
    ['youtube','post_on_youtube'],
  ];
  const ambiguous = automated.filter(([platform,flag]) => truthy(row[flag]) && !clean(row[platform + '_post_id']) && (clean(row[platform + '_publish_claim_id']) || ['CLAIMED','PUBLISHING','UNKNOWN','RECONCILE'].includes(clean(row[platform + '_publish_state']).toUpperCase()))).map(([platform]) => platform);
  if (ambiguous.length) return response(false, 'Recovery is blocked to prevent duplicates. Verify these platforms first: ' + ambiguous.join(', ') + '.');
  const missing = automated.filter(([platform,flag]) => truthy(row[flag]) && !clean(row[platform + '_post_id'])).map(([platform]) => platform);
  if (!missing.length) return response(false, 'Every automated destination already has a saved platform ID.');
  row.post_to_instagram = missing.includes('instagram');
  row.post_to_facebook = missing.includes('facebook');
  row.post_on_youtube = missing.includes('youtube');
  row.status = 'Scheduled';
  row.error_message = '';
  return [{ json: { ...row, _route: 'update_trigger', recovery_requested_at: new Date().toISOString() } }];
}

`;
  code = code.replace(retryNeedle, recovery + retryNeedle);
}
plan.parameters.jsCode = code;

const routeValues = route.parameters.rules.values;
if (!routeValues.some(value => value.outputKey === "health")) {
  routeValues.push({
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
      conditions: [{ leftValue: "={{ $json._route }}", rightValue: "health", operator: { type: "string", operation: "equals" } }],
      combinator: "and",
    },
    renameOutput: true,
    outputKey: "health",
  });
}

const ollama = {
  parameters: { method: "GET", url: "http://127.0.0.1:11434/api/tags", options: { timeout: 10000, response: { response: { responseFormat: "json" } } } },
  id: crypto.randomUUID(),
  name: "Check Ollama Health",
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position: [960, 560],
  alwaysOutputData: true,
  retryOnFail: false,
  onError: "continueRegularOutput",
};
const healthResponse = {
  parameters: {
    jsCode: `const value = $json || {};
const failed = Boolean(value.error) || (!Array.isArray(value.models) && !value.models);
return [{ json: {
  ok: !failed,
  checked_at: new Date().toISOString(),
  services: {
    n8n: { ok: true },
    sheets: { ok: true },
    ollama: { ok: !failed, message: failed ? String(value.error?.message || value.message || 'Ollama did not answer.') : (Array.isArray(value.models) ? value.models.length + ' model(s) available' : 'Ready') }
  }
} }];`,
  },
  id: crypto.randomUUID(),
  name: "Build Health Response",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [1220, 560],
};
const respondHealth = {
  parameters: { respondWith: "json", responseBody: "={{ $json }}", options: {} },
  id: crypto.randomUUID(),
  name: "Respond Health",
  type: "n8n-nodes-base.respondToWebhook",
  typeVersion: 1.1,
  position: [1460, 560],
};
workflow.nodes.push(ollama, healthResponse, respondHealth);
workflow.connections["Route Reels Action"].main[4] = [{ node: ollama.name, type: "main", index: 0 }];
workflow.connections[ollama.name] = { main: [[{ node: healthResponse.name, type: "main", index: 0 }]] };
workflow.connections[healthResponse.name] = { main: [[{ node: respondHealth.name, type: "main", index: 0 }]] };

workflow.name = "MBW - Reels Admin Gateway v2 - Safe Recovery";
workflow.active = false;
delete workflow.id;
delete workflow.versionId;
delete workflow.activeVersionId;
fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2) + "\n");
console.log(JSON.stringify({ outputPath, workflow: workflow.name, nodes: workflow.nodes.length, actions: ["health", "replace_media", "publish_overdue"] }, null, 2));
