import { readFile } from "node:fs/promises";

const robots = await readFile(new URL("../robots.txt", import.meta.url), "utf8");
const requiredAgents = ["Googlebot", "Googlebot-Image", "Storebot-Google"];

function rulesFor(agent) {
  const lines = robots.split(/\r?\n/);
  const rules = [];
  let active = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      active = value.toLowerCase() === agent.toLowerCase();
      continue;
    }

    if (active && (field === "allow" || field === "disallow")) {
      rules.push({ field, value });
    }
  }

  return rules;
}

for (const agent of requiredAgents) {
  const rules = rulesFor(agent);
  if (!rules.some(({ field, value }) => field === "allow" && value === "/")) {
    throw new Error(`${agent} must have an explicit Allow: / rule`);
  }
  if (rules.some(({ field, value }) => field === "disallow" && value === "/")) {
    throw new Error(`${agent} must not be blocked from the full site`);
  }
}

if (!robots.includes("Sitemap: https://mindobirdwatching.com/sitemap.xml")) {
  throw new Error("The production sitemap directive is missing");
}

console.log("Merchant crawler robots rules: OK");
