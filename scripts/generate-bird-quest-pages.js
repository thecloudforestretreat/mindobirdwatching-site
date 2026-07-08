#!/usr/bin/env node

/*
  Mindo Bird Quest page generator

  Purpose:
  - Keep the CSV as the single source of truth for Bird Quest species/media.
  - Preserve the approved EN/ES HTML shells, SEO/AEO/GEO structure, hreflang,
    schema blocks, analytics includes, and runtime JS includes.
  - Regenerate only the bird data, schema ItemList, and visible counts.

  Usage:
    node generate-bird-quest-pages.js

    BIRD_QUEST_CSV="/path/to/bird_quest.csv" \
    TEMPLATE_EN="/path/to/en/index.html" \
    TEMPLATE_ES="/path/to/es/index.html" \
    BIRD_QUEST_OUT_DIR="/path/to/output/root" \
    node generate-bird-quest-pages.js
*/

const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  csv: "/Users/juangranda/Downloads/mbw_recent_bird_sightings_mindo - bird_quest_mvp (5).csv",
  templateEn: "/Users/juangranda/Downloads/index - 2026-07-08T081101.975.html",
  templateEs: "/Users/juangranda/Downloads/index - 2026-07-08T081103.830.html",
  outDir: "/Users/juangranda/Documents/Codex/2026-07-07/i/outputs/bird_quest_generator_update"
};

const CONFIG = {
  csv: process.env.BIRD_QUEST_CSV || DEFAULTS.csv,
  templateEn: process.env.TEMPLATE_EN || DEFAULTS.templateEn,
  templateEs: process.env.TEMPLATE_ES || DEFAULTS.templateEs,
  outDir: process.env.BIRD_QUEST_OUT_DIR || DEFAULTS.outDir
};

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function bool(value) {
  return /^(true|yes|1)$/i.test(clean(value));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift().map((header) => clean(header).replace(/^\uFEFF/, ""));
  return rows
    .filter((r) => r.some((value) => clean(value)))
    .map((r) => Object.fromEntries(headers.map((header, index) => [header, r[index] || ""])));
}

function normalizeUrl(url) {
  const value = clean(url);
  if (!value) return "";
  return value.replace(/^http:\/\/mindobirdwatching\.com\//i, "https://mindobirdwatching.com/");
}

function numberOrBlank(value) {
  const text = clean(value);
  if (!text) return "";
  const number = Number(text);
  return Number.isFinite(number) ? number : "";
}

function rowImages(row) {
  const images = [];
  [1, 2, 3].forEach((index) => {
    const url = normalizeUrl(row[`image_${index}_url`]);
    if (!url) return;
    images.push({
      url,
      altEn: clean(row[`image_${index}_alt_en`]) || clean(row.common_name_en),
      altEs: clean(row[`image_${index}_alt_es`]) || clean(row.common_name_es) || clean(row.common_name_en),
      credit: clean(row[`image_${index}_credit`]) || "Mindo Bird Watching",
      source: clean(row[`image_${index}_source_type`]) || "mbw_site"
    });
  });
  return images;
}

function splitFacts(row, lang) {
  return [1, 2, 3]
    .map((index) => clean(row[`fun_fact_${index}_${lang}`]))
    .filter(Boolean);
}

function rowToBird(row) {
  return {
    code: clean(row.species_code),
    order: clean(row.quest_display_order) || clean(row.sort_order),
    nameEn: clean(row.common_name_en),
    nameEs: clean(row.common_name_es),
    scientific: clean(row.scientific_name),
    tourVisibility: clean(row.tour_visibility),
    routeNameEn: clean(row.route_cluster_name_en),
    routeNameEs: clean(row.route_cluster_name_es),
    hotspot: clean(row.primary_hotspot_name),
    bestTime: clean(row.best_time_of_day),
    habitat: clean(row.habitat_primary),
    rarity: clean(row.rarity),
    difficulty: clean(row.target_difficulty),
    badge: clean(row.game_badge_type),
    points: clean(row.game_points),
    images: rowImages(row),
    audio: normalizeUrl(row.audio_url),
    audioCaptionEn: clean(row.audio_caption_en),
    audioCaptionEs: clean(row.audio_caption_es),
    audioCredit: clean(row.audio_credit),
    factsEn: splitFacts(row, "en"),
    factsEs: splitFacts(row, "es"),
    kidFactEn: clean(row.kid_fact_en),
    kidFactEs: clean(row.kid_fact_es),
    idTipEn: clean(row.id_tip_en),
    idTipEs: clean(row.id_tip_es),
    whereEn: clean(row.where_seen_en),
    whereEs: clean(row.where_seen_es),
    unlockEn: clean(row.unlock_hint_en),
    unlockEs: clean(row.unlock_hint_es),
    ebird: normalizeUrl(row.ebird_url),
    family: clean(row.family),
    elevationMinM: numberOrBlank(row.elevation_min_m),
    elevationMaxM: numberOrBlank(row.elevation_max_m)
  };
}

function activeBirds(rows) {
  return rows
    .filter((row) => bool(row.active) && bool(row.quest_enabled))
    .map(rowToBird)
    .filter((bird) => bird.code && bird.nameEn)
    .sort((a, b) => {
      const aOrder = Number(a.order || 9999);
      const bOrder = Number(b.order || 9999);
      return aOrder - bOrder || a.nameEn.localeCompare(b.nameEn);
    });
}

function safeScriptJson(value) {
  return JSON.stringify(value).replace(/<\/script/gi, "<\\/script");
}

function updateJsonLd(html, birds, lang) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (match, rawJson) => {
    let data;
    try {
      data = JSON.parse(rawJson);
    } catch (error) {
      return match;
    }

    const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [];
    const itemList = graph.find((item) => item && item["@type"] === "ItemList");
    if (itemList) {
      itemList.numberOfItems = birds.length;
      itemList.itemListElement = birds.map((bird, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: lang === "es" ? (bird.nameEs || bird.nameEn) : bird.nameEn,
        url: bird.ebird || `https://ebird.org/species/${encodeURIComponent(bird.code)}`
      }));
    }

    return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  });
}

function replaceBirdData(html, birds) {
  return html.replace(
    /<script id="birdQuestData" type="application\/json">[\s\S]*?<\/script>/,
    `<script id="birdQuestData" type="application/json">${safeScriptJson(birds)}</script>`
  );
}

function updateCounts(html, birds) {
  const audioCount = birds.filter((bird) => clean(bird.audio)).length;
  return html
    .replace(/(<strong id="birdQuestProgressCount">)0\/\d+(<\/strong>)/, `$10/${birds.length}$2`)
    .replace(/(<strong id="birdQuestAudioCount">)\d+(<\/strong>)/, `$1${audioCount}$2`)
    .replace(/(<strong id="birdQuestSpeciesCount">)\d+(<\/strong>)/, `$1${birds.length}$2`);
}

function renderTemplate(templatePath, birds, lang) {
  let html = fs.readFileSync(templatePath, "utf8");
  html = updateJsonLd(html, birds, lang);
  html = updateCounts(html, birds);
  html = replaceBirdData(html, birds);
  return html;
}

function writeOutput(filePath, html) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html, "utf8");
}

function main() {
  const rows = parseCsv(fs.readFileSync(CONFIG.csv, "utf8"));
  const birds = activeBirds(rows);
  if (!birds.length) {
    throw new Error("No active Bird Quest rows found. Check active=TRUE and quest_enabled=TRUE in the CSV.");
  }

  const enHtml = renderTemplate(CONFIG.templateEn, birds, "en");
  const esHtml = renderTemplate(CONFIG.templateEs, birds, "es");

  const enOut = path.join(CONFIG.outDir, "bird-quest", "index.html");
  const esOut = path.join(CONFIG.outDir, "es", "reto-de-aves", "index.html");

  writeOutput(enOut, enHtml);
  writeOutput(esOut, esHtml);

  console.log(`Generated ${enOut}`);
  console.log(`Generated ${esOut}`);
  console.log(`Birds enabled: ${birds.length}`);
  console.log(`Audio ready: ${birds.filter((bird) => clean(bird.audio)).length}`);
  console.log(`Images normalized to HTTPS where needed.`);
}

main();
