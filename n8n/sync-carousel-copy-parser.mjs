import fs from 'node:fs';

const sourcePath = new URL('./carousel-copy-parser.js', import.meta.url);
const workflowPaths = [
  new URL('../MBW%20-%20AI%20Carousels%20-%20IMPORT.json', import.meta.url),
  new URL('./generated/MBW%20-%20AI%20Carousels%20-%20Admin%20Trigger%20-%20IMPORT.json', import.meta.url),
];

const parserFrom = (workflow, path) => {
  const parser = workflow.nodes.find((node) => node.name === '[GEN] Parse and Validate Copy');
  if (!parser?.parameters?.jsCode) throw new Error(`Carousel parser node not found in ${path.pathname}`);
  return parser;
};

const upgradeIntentPrompts = (workflow) => {
  const promptNodes = workflow.nodes.filter((node) => [
    '[GEN] Local Grounding (Ollama)',
    '[GEN] Independent Local Copy Editor',
    '[GEN] Final Local Repair Editor',
  ].includes(node.name));
  for (const node of promptNodes) {
    let body = String(node.parameters?.jsonBody || '');
    body = body.replaceAll(
      'bird_profile|trip_recap|tour_experience|wildlife_encounter|educational|general',
      'bird_profile|trip_recap|tour_experience|community|wildlife_encounter|educational|general',
    );
    body = body.replaceAll(
      'bird profile, trip recap, tour experience, wildlife encounter, educational set, or general topic',
      'bird profile, trip recap, tour experience, community or family invitation, wildlife encounter, educational set, or general topic',
    );
    body = body.replaceAll(
      'bird profile, trip recap, tour experience, wildlife encounter, educational, or general',
      'bird profile, trip recap, tour experience, community or family invitation, wildlife encounter, educational, or general',
    );
    body = body.replaceAll(
      'For a trip or tour recap, lead with the real outing and human experience.',
      'For a trip or tour recap, lead with the real outing and human experience. For a community or family invitation, lead with people, belonging, and a natural invitation rather than generic scenery.',
    );
    node.parameters.jsonBody = body;
  }
};

if (!fs.existsSync(sourcePath)) {
  const workflow = JSON.parse(fs.readFileSync(workflowPaths[0], 'utf8'));
  fs.writeFileSync(sourcePath, `${parserFrom(workflow, workflowPaths[0]).parameters.jsCode.trim()}\n`);
  console.log(`Extracted canonical parser to ${sourcePath.pathname}`);
} else {
  const source = fs.readFileSync(sourcePath, 'utf8').trim();
  for (const path of workflowPaths) {
    const workflow = JSON.parse(fs.readFileSync(path, 'utf8'));
    parserFrom(workflow, path).parameters.jsCode = source;
    upgradeIntentPrompts(workflow);
    fs.writeFileSync(path, `${JSON.stringify(workflow, null, 2)}\n`);
  }
  console.log(`Synced canonical parser into ${workflowPaths.length} workflow exports`);
}
