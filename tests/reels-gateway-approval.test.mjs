import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const source = 'n8n/generated/MBW - Reels Admin Gateway v2 - Safe Recovery - IMPORT.json';
const output = path.join(os.tmpdir(), 'mbw-reels-gateway-approval-qa.json');
execFileSync(process.execPath, ['n8n/upgrade_reels_gateway_recovery.mjs', source, output], { stdio: 'pipe' });

const workflow = JSON.parse(fs.readFileSync(output, 'utf8'));
const plan = workflow.nodes.find((node) => node.name === 'Plan Reels Action');
assert.ok(plan, 'Plan Reels Action must exist');
const code = String(plan.parameters.jsCode || '');

assert.match(code, /truthy\(row\.post_to_x\) \? row\.x_caption : ''/);
assert.doesNotMatch(code, /row\.tiktok_caption,row\.x_caption\]\.filter/);
assert.match(code, /post_to_instagram: truthy\(input\.post_to_instagram\)/);
assert.match(code, /post_to_facebook: truthy\(input\.post_to_facebook\)/);
assert.match(code, /Instagram\/Facebook caption must contain 35–100 words/);

console.log('reels gateway approval QA passed');
