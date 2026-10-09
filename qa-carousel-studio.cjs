const fs = require("fs");
const assert = require("assert");
const { pathToFileURL } = require("url");
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

const root = __dirname;
const read = (path) => fs.readFileSync(`${root}/${path}`, "utf8");
const json = (path) => JSON.parse(read(path));

function compileWorkflow(path) {
  const workflow = json(path);
  const names = new Set(workflow.nodes.map((node) => node.name));
  for (const node of workflow.nodes) {
    if (node.parameters && node.parameters.jsCode) new AsyncFunction(node.parameters.jsCode);
  }
  for (const [source, groups] of Object.entries(workflow.connections || {})) {
    assert(names.has(source), `${path}: missing source node ${source}`);
    for (const group of Object.values(groups)) for (const list of group) for (const target of list) {
      assert(names.has(target.node), `${path}: missing target node ${target.node}`);
    }
  }
  return workflow;
}

(async () => {
  const html = read("admin/media/carousels/index.html");
  const ui = read("admin/assets/js/carousel-studio.js");
  const css = read("admin/assets/css/carousel-studio.css");
  for (const id of [...ui.matchAll(/\$\("([A-Za-z][A-Za-z0-9_-]*)"\)/g)].map((match) => match[1])) {
    assert(html.includes(`id="${id}"`), `UI references missing #${id}`);
  }
  assert(html.includes("2–10"), "UI must state the supported slide count");
  assert(html.includes("1080 × 1350"), "UI must disclose the output dimensions");
  assert(ui.includes("America/New_York"), "UI must use the fixed Eastern timezone");
  assert(ui.includes("already 1 carousel") && ui.includes("scheduled for this date"), "UI must warn about same-date scheduling");
  assert(ui.includes("x[-_ ]?ray") && ui.includes("sticky|graphic|infographic|notes"), "UI must identify educational graphics for fit/pad treatment");
  assert(/aspect-ratio\s*:\s*4\s*\/\s*5/.test(css), "Previews must use the Instagram 4:5 aspect ratio");

  const main = compileWorkflow("MBW - AI Carousels - IMPORT.json");
  const intake = compileWorkflow("MBW - Carousel Intake - IMPORT.json");
  const gateway = compileWorkflow("n8n/generated/MBW - Carousel Admin Gateway - IMPORT.json");
  const adminMain = compileWorkflow("n8n/generated/MBW - AI Carousels - Admin Trigger - IMPORT.json");
  assert(main.nodes.length === 65, "Unexpected main workflow node count");
  assert(intake.nodes.some((node) => node.name === "[INTAKE] Validate and Split Images"), "Legacy intake must support variable slide counts");
  assert(gateway.nodes.some((node) => node.name === "Plan Carousel Action"), "Admin gateway planner is missing");
  assert(adminMain.nodes.some((node) => node.name === "[ADMIN] Trigger Carousel Processing"), "Admin processing webhook is missing");
  const allMainText = JSON.stringify(main);
  assert(!allMainText.includes("generativelanguage.googleapis.com"), "Carousel copy must remain local-first");
  assert(allMainText.includes("gpt-oss:20b local grounding + independent editor"), "Independent local editor is missing");
  assert(allMainText.includes("PUBLISH BLOCKED: copy approval is required"), "Approval publishing gate is missing");
  assert(allMainText.includes("={{ $json.instagram_permalink }}") && allMainText.includes("={{ $json.facebook_permalink }}"), "Published post permalinks must be saved");
  assert(allMainText.includes("between two and ten image URLs"), "2–10 URL validation is missing");
  const transformText = allMainText + JSON.stringify(intake) + read("functions/api/admin/carousels/index.js");
  assert(transformText.includes("c_pad,b_rgb:f7f4e8"), "Fit/pad transform is missing");
  assert(transformText.includes("c_fill,g_auto"), "Photo crop transform is missing");
  assert(!JSON.stringify(intake).match(/Exactly 9|exactly nine|length !== 9/), "Legacy nine-image enforcement remains");

  const moduleUrl = pathToFileURL(`${root}/functions/api/admin/carousels/index.js`).href + `?qa=${Date.now()}`;
  const api = await import(moduleUrl);
  const call = (body, env = {}) => api.onRequestPost({
    request: new Request("https://mindobirdwatching.com/api/admin/carousels", {
      method: "POST", headers: { origin: "https://admin.mindobirdwatching.com", "content-type": "application/json" }, body: JSON.stringify(body),
    }), env,
  });
  let response = await call({ action: "create_carousel", carousel: { images: [] } });
  assert.strictEqual(response.status, 400, "One-image/empty carousels must fail");
  response = await call({ action: "create_carousel", carousel: {
    featured_birds: "Rufous Motmot", carousel_description: "A factual three-slide Rufous Motmot feature.", scheduled_date: "2000-01-01", scheduled_time: "07:00",
    post_to_instagram: true, images: [{ original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/a.jpg" }, { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/b.jpg" }],
  }});
  assert.strictEqual(response.status, 400, "Past dates must fail at the API boundary");

  const originalFetch = global.fetch;
  let gatewayPayload;
  global.fetch = async (_url, options) => {
    gatewayPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
  response = await call({ action: "create_carousel", mode: "review", carousel: {
    featured_birds: "Rufous Motmot", scientific_name: "Baryphthengus martii", carousel_description: "A factual three-slide Rufous Motmot feature.",
    scheduled_date: "2099-10-10", scheduled_time: "07:00", post_to_instagram: true, post_to_facebook: false,
    images: [
      { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/v1/photo.jpg", fit_mode: "fill", content_type: "photo", width: 4284, height: 5712 },
      { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/v1/xray.jpg", fit_mode: "fit", content_type: "xray", width: 928, height: 1152 },
      { original_url: "https://res.cloudinary.com/dd25hpdx3/image/upload/v1/notes.jpg", fit_mode: "fit", content_type: "infographic", width: 928, height: 1152 },
    ],
  }}, { N8N_ADMIN_CAROUSELS_WEBHOOK_URL: "https://n8n.example.test/webhook/carousels" });
  global.fetch = originalFetch;
  assert.strictEqual(response.status, 200, "Valid three-slide carousel must pass the API");
  assert(gatewayPayload.carousel.images[0].delivery_url.includes("c_fill,g_auto,h_1350,w_1080"), "Photo must receive subject-aware fill crop");
  assert(gatewayPayload.carousel.images[1].delivery_url.includes("c_pad,b_rgb:f7f4e8,h_1350,w_1080"), "X-ray must receive fit/pad treatment");
  assert(gatewayPayload.carousel.images[2].delivery_url.includes("c_pad,b_rgb:f7f4e8,h_1350,w_1080"), "Infographic must receive fit/pad treatment");

  console.log(JSON.stringify({
    ok: true,
    ui: "DOM references, timezone, schedule warning, and 4:5 previews verified",
    api: "validation plus fill/pad Cloudinary delivery transforms verified",
    workflows: { mainNodes: main.nodes.length, intakeNodes: intake.nodes.length, gatewayNodes: gateway.nodes.length, adminMainNodes: adminMain.nodes.length },
    samplePolicy: ["photo: fill", "x-ray: fit", "sticky-notes: fit"],
  }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
