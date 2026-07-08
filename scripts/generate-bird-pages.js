#!/usr/bin/env node

/*
  Cloudflare-safe Bird Quest build check.

  Bird Quest now uses /assets/data/bird-quest.json as the deployable data file.
  Do not read local laptop paths such as /Users/.../Downloads during Cloudflare
  Pages builds; those files do not exist on the build machine.
*/

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const dataPath = path.join(root, "assets", "data", "bird-quest.json");
const pagePaths = [
  path.join(root, "bird-quest", "index.html"),
  path.join(root, "es", "reto-de-aves", "index.html")
];

function fail(message) {
  console.error(`[bird-quest] ${message}`);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Unable to read valid JSON at ${path.relative(root, filePath)}: ${error.message}`);
  }
}

function main() {
  if (!fs.existsSync(dataPath)) {
    fail("Missing assets/data/bird-quest.json. Commit the generated JSON file before deploying.");
  }

  const payload = readJson(dataPath);
  const birds = Array.isArray(payload) ? payload : payload.birds;
  if (!Array.isArray(birds) || birds.length === 0) {
    fail("assets/data/bird-quest.json does not contain a non-empty birds array.");
  }

  const missingBasics = birds.filter((bird) => !bird.code || !bird.nameEn);
  if (missingBasics.length) {
    fail(`Bird Quest JSON has rows missing code/nameEn: ${missingBasics.map((bird) => bird.code || bird.nameEn || "unknown").join(", ")}`);
  }

  pagePaths.forEach((pagePath) => {
    if (!fs.existsSync(pagePath)) {
      fail(`Missing ${path.relative(root, pagePath)}.`);
    }
    const html = fs.readFileSync(pagePath, "utf8");
    if (!html.includes('data-src="/assets/data/bird-quest.json"')) {
      fail(`${path.relative(root, pagePath)} is not wired to /assets/data/bird-quest.json.`);
    }
    if (!html.includes("/assets/js/bird-quest-page.js")) {
      fail(`${path.relative(root, pagePath)} is missing the Bird Quest runtime script.`);
    }
  });

  console.log(`[bird-quest] Using committed assets/data/bird-quest.json with ${birds.length} birds.`);
  console.log("[bird-quest] Cloudflare-safe check passed.");
}

main();
