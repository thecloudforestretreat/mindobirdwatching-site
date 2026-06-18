#!/usr/bin/env node

/*
  Mindo Bird Watching - Target Bird Tour Builder Page Generator

  Generates:
    /tours/target-bird-tour-builder/index.html
    /es/tours/constructor-tour-aves-objetivo/index.html

  Data source:
    Google Sheets CSV exports or local CSV/TSV files.

  Run examples:
    node outputs/generate-target-bird-tour-builder.js

    SPECIES_CORE_CSV=/path/species_core.tsv \
    SPECIES_MEDIA_CSV=/path/species_media.tsv \
    SPECIES_TOUR_BUILDER_CSV="/path/species_tour_builder.csv" \
    ROUTE_CLUSTERS_CSV=/path/route_clusters.tsv \
    TARGET_BUILDER_OUT_DIR=outputs/generated-site \
    node outputs/generate-target-bird-tour-builder.js
*/

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://mindobirdwatching.com";
const SHEET_ID = "1FGmAm92kMYIMCLjGL_m-OOaUmD6og_mvsKcTIGs_GJE";

const EN_PATH = "/tours/target-bird-tour-builder/";
const ES_PATH = "/es/tours/constructor-tour-aves-objetivo/";

const DEFAULT_OUT_DIR = process.cwd();
const OUT_DIR = process.env.TARGET_BUILDER_OUT_DIR || DEFAULT_OUT_DIR;

const OUT_EN = path.join(OUT_DIR, "tours", "target-bird-tour-builder", "index.html");
const OUT_ES = path.join(OUT_DIR, "es", "tours", "constructor-tour-aves-objetivo", "index.html");

const OG_IMAGE = "/MBW-Assets-OG-Image.jpg";
const PLACEHOLDER_IMAGE = "/assets/images/birds/mbw_plate_billed_mountan_toucan_01.jpg";
const WEBHOOK_URL = process.env.TARGET_BIRD_WEBHOOK_URL || "";

function sheetCsvUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

const SOURCES = {
  speciesCore: process.env.SPECIES_CORE_CSV || sheetCsvUrl("species_core"),
  speciesMedia: process.env.SPECIES_MEDIA_CSV || sheetCsvUrl("species_media"),
  speciesTourBuilder: process.env.SPECIES_TOUR_BUILDER_CSV || sheetCsvUrl("species_tour_builder"),
  routeClusters: process.env.ROUTE_CLUSTERS_CSV || sheetCsvUrl("route_clusters")
};

function clean(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function esc(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attr(value) {
  return esc(value);
}

function bool(value) {
  const v = clean(value).toLowerCase();
  return v === "true" || v === "yes" || v === "1";
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
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

  if (!rows.length) return [];

  const headers = rows.shift().map((h) => clean(h).replace(/^\uFEFF/, ""));

  return rows
    .filter((r) => r.some((v) => clean(v)))
    .map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] || "";
      });
      return obj;
    });
}

function parseCsvAuto(text, source) {
  const firstLine = clean(text).split(/\r?\n/)[0] || "";
  const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const rows = parseDelimited(text, delimiter);

  if (!rows.length && clean(text).startsWith("<")) {
    throw new Error(`Expected CSV/TSV but received HTML from ${source}`);
  }

  return rows;
}

async function loadText(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, {
      redirect: "follow",
      headers: { "User-Agent": "MBW-Target-Bird-Builder/1.0" }
    });
    if (!response.ok) throw new Error(`Request failed ${response.status}: ${source}`);
    return response.text();
  }

  return fs.readFileSync(source, "utf8");
}

async function loadRows(source) {
  const text = await loadText(source);
  return parseCsvAuto(text, source);
}

function indexBy(rows, key) {
  const map = new Map();
  rows.forEach((row) => {
    const value = clean(row[key]);
    if (value) map.set(value, row);
  });
  return map;
}

function labelMap(lang) {
  const en = {
    half_day: "Half Day",
    full_day: "Full Day",
    both: "Half or Full Day",
    custom_only: "Custom Private",
    multi_day: "Multi-Day",
    custom_private: "Custom Private",
    easy: "Easy",
    moderate: "Moderate",
    hard: "Hard",
    specialist: "Specialist",
    standard: "Standard",
    standard_plus: "Standard Plus",
    premium: "Premium",
    premium_plus: "Premium Plus",
    custom_quote: "Custom Quote",
    dawn: "Dawn",
    early_morning: "Early Morning",
    morning: "Morning",
    afternoon: "Afternoon",
    any: "Any Time"
  };

  const es = {
    half_day: "Medio Dia",
    full_day: "Dia Entero",
    both: "Medio Dia o Dia Entero",
    custom_only: "Privado Personalizado",
    multi_day: "Varios Dias",
    custom_private: "Privado Personalizado",
    easy: "Facil",
    moderate: "Moderado",
    hard: "Dificil",
    specialist: "Especialista",
    standard: "Estandar",
    standard_plus: "Estandar Plus",
    premium: "Premium",
    premium_plus: "Premium Plus",
    custom_quote: "Cotizacion Personalizada",
    dawn: "Amanecer",
    early_morning: "Temprano",
    morning: "Manana",
    afternoon: "Tarde",
    any: "Cualquier Hora"
  };

  return lang === "es" ? es : en;
}

function routeLabel(route, lang) {
  if (!route) return lang === "es" ? "Ruta por revisar" : "Route to review";
  return clean(lang === "es" ? route.route_cluster_name_es : route.route_cluster_name_en) ||
    clean(route.route_cluster_name_en) ||
    clean(route.route_cluster_id);
}

function safeImage(media) {
  const local = clean(media.image_primary_local_path);
  const external = clean(media.image_primary_external_url);

  if (local) return local;
  if (external && !external.includes("media.ebird.org")) return external;
  return PLACEHOLDER_IMAGE;
}

function normalizeBird(core, media, tour, route) {
  return {
    speciesCode: clean(core.speciesCode),
    scientificName: clean(core.scientific_name),
    englishName: clean(core.english_name),
    spanishName: clean(core.spanish_name) || clean(core.english_name),
    taxonGroup: clean(core.taxon_group) || "bird",
    family: clean(core.family),
    ebirdUrl: clean(core.ebird_species_url) || `https://ebird.org/species/${encodeURIComponent(clean(core.speciesCode))}`,
    image: safeImage(media),
    imageCredit: clean(media.image_credit),
    imageAltEn: clean(media.image_alt_en) || `${clean(core.english_name)} in the Mindo cloud forest`,
    imageAltEs: clean(media.image_alt_es) || `${clean(core.spanish_name) || clean(core.english_name)} en el bosque nublado de Mindo`,
    audio: clean(media.audio_primary_local_path),
    targetSpecies: bool(tour.target_species),
    iconic: bool(tour.iconic_species),
    tourVisibility: clean(tour.tour_visibility),
    tourFit: clean(tour.tour_fit),
    targetDifficulty: clean(tour.target_difficulty),
    photographyDifficulty: clean(tour.photography_difficulty),
    bestTime: clean(tour.best_time_of_day),
    bestMonths: clean(tour.best_months),
    habitatPrimary: clean(tour.habitat_primary),
    habitatSecondary: clean(tour.habitat_secondary),
    routeCluster: clean(tour.route_cluster_primary),
    routeLabelEn: routeLabel(route, "en"),
    routeLabelEs: routeLabel(route, "es"),
    walkingLevel: clean(tour.walking_level),
    accessLevel: clean(tour.access_level),
    reliability: Number(clean(tour.reliability_score_manual)) || 50,
    pricingComplexity: clean(tour.pricing_complexity),
    priority: clean(tour.custom_tour_priority),
    guideNotesEn: clean(tour.guide_notes_en),
    guideNotesEs: clean(tour.guide_notes_es),
    internalNotes: clean(tour.internal_notes)
  };
}

function buildData(coreRows, mediaRows, tourRows, routeRows) {
  const coreByCode = indexBy(coreRows, "speciesCode");
  const mediaByCode = indexBy(mediaRows, "speciesCode");
  const routeById = indexBy(routeRows, "route_cluster_id");

  const birds = tourRows
    .filter((tour) => bool(tour.target_species))
    .map((tour) => {
      const code = clean(tour.speciesCode);
      const core = coreByCode.get(code);
      if (!core) return null;
      return normalizeBird(core, mediaByCode.get(code) || {}, tour, routeById.get(clean(tour.route_cluster_primary)));
    })
    .filter(Boolean)
    .sort((a, b) => {
      const priorityOrder = { signature: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9) ||
        b.reliability - a.reliability ||
        a.englishName.localeCompare(b.englishName);
    });

  return {
    birds,
    routes: routeRows.filter((r) => bool(r.active) || clean(r.active) === "").map((route) => ({
      id: clean(route.route_cluster_id),
      nameEn: clean(route.route_cluster_name_en),
      nameEs: clean(route.route_cluster_name_es),
      baseTourType: clean(route.base_tour_type),
      startTime: clean(route.recommended_start_time),
      duration: clean(route.typical_duration_hours),
      walkingLevel: clean(route.walking_level),
      roadAccess: clean(route.road_access),
      habitats: clean(route.primary_habitats),
      pricing: clean(route.default_pricing_complexity),
      notesEn: clean(route.notes_en),
      notesEs: clean(route.notes_es)
    }))
  };
}

function groupOptions(birds, field) {
  return Array.from(new Set(birds.map((bird) => clean(bird[field])).filter(Boolean))).sort();
}

function renderRouteMap(routes, birds, lang) {
  const labels = labelMap(lang);
  const isEs = lang === "es";

  return routes.map((route) => {
    const count = birds.filter((bird) => bird.routeCluster === route.id).length;
    if (!count) return "";
    return `
<button class="routeNode" type="button" data-route-filter="${attr(route.id)}" data-analytics-event="target_map_cluster_click" data-route-cluster="${attr(route.id)}">
  <span>${esc(isEs ? route.nameEs : route.nameEn)}</span>
  <strong>${count}</strong>
  <small>${esc(labels[route.baseTourType] || route.baseTourType)} - ${esc(route.startTime || "")}</small>
</button>`;
  }).join("");
}

function renderSelect(name, options, lang, labelEn, labelEs) {
  const labels = labelMap(lang);
  const label = lang === "es" ? labelEs : labelEn;
  return `
<label class="filterField">
  <span>${esc(label)}</span>
  <select data-filter-select="${attr(name)}">
    <option value="">${lang === "es" ? "Todos" : "All"}</option>
    ${options.map((value) => `<option value="${attr(value)}">${esc(labels[value] || value)}</option>`).join("")}
  </select>
</label>`;
}

function renderBirdCard(bird, lang) {
  const labels = labelMap(lang);
  const isEs = lang === "es";
  const name = isEs ? bird.spanishName : bird.englishName;
  const otherName = isEs ? bird.englishName : bird.spanishName;
  const imageAlt = isEs ? bird.imageAltEs : bird.imageAltEn;

  return `
<article class="targetBirdCard"
  data-bird-card
  data-species-code="${attr(bird.speciesCode)}"
  data-english-name="${attr(bird.englishName)}"
  data-spanish-name="${attr(bird.spanishName)}"
  data-scientific-name="${attr(bird.scientificName)}"
  data-group="${attr(bird.taxonGroup)}"
  data-difficulty="${attr(bird.targetDifficulty)}"
  data-tour-fit="${attr(bird.tourFit)}"
  data-route-cluster="${attr(bird.routeCluster)}"
  data-photography="${attr(bird.photographyDifficulty)}"
  data-iconic="${bird.iconic ? "true" : "false"}">
  <button class="targetBirdSelect" type="button" data-select-species="${attr(bird.speciesCode)}" aria-pressed="false">
    <span class="selectIcon" aria-hidden="true">+</span>
    <span>${isEs ? "Seleccionar" : "Select"}</span>
  </button>
  <img class="targetBirdImage" src="${attr(bird.image)}" alt="${attr(imageAlt)}" loading="lazy" decoding="async">
  <div class="targetBirdBody">
    <div class="targetBirdTopline">
      <span>${esc(labels[bird.targetDifficulty] || bird.targetDifficulty)}</span>
      ${bird.iconic ? `<strong>${isEs ? "Iconica" : "Iconic"}</strong>` : ""}
    </div>
    <h3>${esc(name)}</h3>
    <p class="birdNames">${esc(otherName)} <em>${esc(bird.scientificName)}</em></p>
    <div class="chipRow">
      <span>${esc(labels[bird.tourFit] || bird.tourFit)}</span>
      <span>${esc(isEs ? bird.routeLabelEs : bird.routeLabelEn)}</span>
      <span>${esc(labels[bird.bestTime] || bird.bestTime)}</span>
    </div>
    <p class="birdMicrocopy">${isEs
      ? `Habitat: ${esc(bird.habitatPrimary || "bosque nublado")}. Fotografia: ${esc(labels[bird.photographyDifficulty] || bird.photographyDifficulty)}.`
      : `Habitat: ${esc(bird.habitatPrimary || "cloud forest")}. Photography: ${esc(labels[bird.photographyDifficulty] || bird.photographyDifficulty)}.`}</p>
  </div>
</article>`;
}

function jsonForClient(data) {
  return JSON.stringify({
    birds: data.birds.map((bird) => ({
      speciesCode: bird.speciesCode,
      englishName: bird.englishName,
      spanishName: bird.spanishName,
      scientificName: bird.scientificName,
      targetDifficulty: bird.targetDifficulty,
      tourFit: bird.tourFit,
      routeCluster: bird.routeCluster,
      routeLabelEn: bird.routeLabelEn,
      routeLabelEs: bird.routeLabelEs,
      bestTime: bird.bestTime,
      image: bird.image,
      iconic: bird.iconic
    })),
    webhookUrl: WEBHOOK_URL
  });
}

function schemaGraph(lang, data) {
  const isEs = lang === "es";
  const pagePath = isEs ? ES_PATH : EN_PATH;
  const title = isEs
    ? "Constructor de Tour para Aves Objetivo en Mindo"
    : "Custom Target Bird Tour Builder in Mindo";
  const description = isEs
    ? "Selecciona aves objetivo, revisa zonas sugeridas y solicita un reporte de oportunidad para un tour privado de avistamiento en Mindo."
    : "Choose target birds, review suggested route areas, and request a guide-reviewed opportunity report for a private Mindo birding tour.";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": SITE_URL + "/#website",
        "url": SITE_URL + "/",
        "name": "Mindo Bird Watching",
        "inLanguage": isEs ? "es" : "en",
        "publisher": { "@id": SITE_URL + "/#organization" }
      },
      {
        "@type": "Organization",
        "@id": SITE_URL + "/#organization",
        "name": "Mindo Bird Watching",
        "url": SITE_URL + "/",
        "logo": {
          "@type": "ImageObject",
          "url": SITE_URL + "/assets/images/logo/logo-mbw.png"
        },
        "sameAs": [
          "https://www.instagram.com/mindobirdwatching/",
          "https://www.facebook.com/mindobirdwatching/"
        ]
      },
      {
        "@type": "WebPage",
        "@id": SITE_URL + pagePath + "#webpage",
        "url": SITE_URL + pagePath,
        "name": title,
        "description": description,
        "inLanguage": isEs ? "es-EC" : "en-US",
        "isPartOf": { "@id": SITE_URL + "/#website" },
        "primaryImageOfPage": {
          "@type": "ImageObject",
          "url": SITE_URL + "/MBW-Assets-OG-Image.jpg"
        },
        "dateModified": "2026-06-18",
        "about": [
          { "@type": "Thing", "name": "Mindo birdwatching" },
          { "@type": "Thing", "name": "Cloud forest birds" },
          { "@type": "Thing", "name": "Private birding guide" }
        ],
        "mentions": data.birds.slice(0, 20).map((bird) => ({
          "@type": "Taxon",
          "name": bird.englishName,
          "alternateName": bird.spanishName,
          "taxonRank": "species",
          "sameAs": bird.ebirdUrl
        }))
      },
      {
        "@type": "ItemList",
        "@id": SITE_URL + pagePath + "#target-bird-list",
        "name": isEs ? "Aves objetivo para tours privados en Mindo" : "Target birds for private Mindo tours",
        "itemListElement": data.birds.slice(0, 86).map((bird, index) => ({
          "@type": "ListItem",
          "position": index + 1,
          "name": isEs ? bird.spanishName : bird.englishName,
          "url": bird.ebirdUrl
        }))
      },
      {
        "@type": "TouristTrip",
        "@id": SITE_URL + pagePath + "#tour-builder",
        "name": title,
        "description": description,
        "touristType": ["Birdwatchers", "Nature travelers", "Bird photographers"],
        "areaServed": {
          "@type": "Place",
          "name": "Mindo, Ecuador",
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": -0.051,
            "longitude": -78.772
          }
        },
        "provider": {
          "@type": "Organization",
          "name": "Mindo Bird Watching",
          "url": SITE_URL + "/"
        }
      },
      {
        "@type": "FAQPage",
        "@id": SITE_URL + pagePath + "#faq",
        "mainEntity": (isEs ? [
          ["¿Este reporte garantiza ver las aves?", "No. Es un reporte de oportunidad basado en actividad reciente, rutas y revisión del guía."],
          ["¿Puedo elegir aves objetivo específicas?", "Sí. Puedes seleccionar aves objetivo y solicitar una revisión para un tour privado."],
          ["¿Por qué no muestran ubicaciones exactas para todas las aves?", "Algunas especies sensibles requieren manejo responsable. Mostramos zonas de ruta y revisamos detalles internamente."]
        ] : [
          ["Does this report guarantee birds?", "No. It is an opportunity report based on recent activity, route knowledge, and guide review."],
          ["Can I choose specific target birds?", "Yes. You can select target birds and request a review for a private tour."],
          ["Why not show exact locations for every bird?", "Some sensitive species require responsible handling. We show route areas and review details internally."]
        ]).map(([name, text]) => ({
          "@type": "Question",
          "name": name,
          "acceptedAnswer": { "@type": "Answer", "text": text }
        }))
      }
    ]
  };
}

function pageCss() {
  return `<style>
.rawLangLinks{display:flex;gap:10px;margin:10px 0;font-size:.9rem}
.rawLangLinks a{color:#15724f;font-weight:800;text-decoration:none}
.targetBuilderPage .btn,.mobileSticky .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #15724f;border-radius:8px;padding:10px 14px;font-weight:800;text-decoration:none;cursor:pointer;min-height:42px;box-sizing:border-box}
.targetBuilderPage .btn.primary,.mobileSticky .btn.primary{background:#15724f;color:#fff}.targetBuilderPage .btn.secondary,.mobileSticky .btn.secondary{background:#fff;color:#15724f}
.page.targetBuilderPage{margin-top:18px;padding:0;overflow:hidden;background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow)}
.targetHero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,.95fr);gap:0;min-height:520px;background:linear-gradient(135deg,rgba(18,80,54,.95),rgba(21,109,86,.84)),url('/MBW-Assets-OG-Image.jpg') center/cover;color:#fff}
.targetHeroCopy{padding:42px;display:grid;align-content:center;gap:18px}
.eyebrow{font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;font-weight:700;opacity:.86}
.targetHero h1{margin:0;font-size:clamp(2rem,5vw,4.2rem);line-height:1.02;letter-spacing:0}
.targetHero p{margin:0;max-width:68ch;font-size:1.05rem;line-height:1.65;color:rgba(255,255,255,.9)}
.heroActions{display:flex;gap:10px;flex-wrap:wrap}
.heroMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:620px}
.heroMetric{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);border-radius:8px;padding:12px}
.heroMetric strong{display:block;font-size:1.6rem}.heroMetric span{font-size:.86rem;color:rgba(255,255,255,.84)}
.targetHeroPanel{padding:28px;display:grid;align-content:end}
.targetMiniReport{background:rgba(255,255,255,.94);color:#1b2a22;border-radius:8px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.22);display:grid;gap:12px}
.targetMiniReport h2{margin:0;font-size:1.15rem}.targetMiniReport ul{margin:0;padding-left:18px;line-height:1.55}
.targetMiniReport .trustNote{color:#53665d}
.builderShell{display:grid;grid-template-columns:300px minmax(0,1fr) 340px;gap:0;border-top:1px solid var(--line)}
.filterPanel,.selectedPanel{padding:18px;background:rgba(255,255,255,.72)}
.filterPanel{border-right:1px solid var(--line)}.selectedPanel{border-left:1px solid var(--line)}
.filterPanel h2,.selectedPanel h2{margin:0 0 12px;font-size:1.05rem}.filterStack{display:grid;gap:12px}
.filterField{display:grid;gap:6px}.filterField span{font-size:.82rem;font-weight:700;color:var(--muted)}
.filterField input,.filterField select,.leadForm input,.leadForm select,.leadForm textarea{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;padding:10px 11px;background:#fff;color:var(--ink);font:inherit}
.quickToggles{display:grid;grid-template-columns:1fr 1fr;gap:8px}.quickToggles button,.routeNode{border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);padding:10px;cursor:pointer;text-align:left}
.quickToggles button[aria-pressed=true],.routeNode[aria-pressed=true]{border-color:#15724f;background:#e8f5ee;color:#0d573b}
.targetMain{padding:20px;display:grid;gap:18px}.routeMap{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.routeNode span{display:block;font-weight:800}.routeNode strong{font-size:1.7rem}.routeNode small{display:block;color:var(--muted);font-size:.78rem}
.targetToolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.resultCount{font-weight:800}
.targetGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.targetBirdCard{position:relative;border:1px solid var(--line);border-radius:8px;background:#fff;overflow:hidden;display:grid;grid-template-rows:160px auto;min-width:0}
.targetBirdImage{width:100%;height:160px;object-fit:cover;background:#edf2ed}.targetBirdBody{padding:12px;display:grid;gap:8px}
.targetBirdTopline{display:flex;justify-content:space-between;gap:8px;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:#15724f;font-weight:800}
.targetBirdCard h3{margin:0;font-size:1.03rem;line-height:1.2}.birdNames{margin:0;color:var(--muted);font-size:.86rem;line-height:1.45}.birdNames em{display:block}
.chipRow{display:flex;flex-wrap:wrap;gap:6px}.chipRow span{border:1px solid var(--line);border-radius:999px;padding:4px 7px;font-size:.76rem;background:#f7faf7}
.birdMicrocopy{margin:0;color:var(--muted);font-size:.84rem;line-height:1.45}
.targetBirdSelect{position:absolute;top:10px;right:10px;border:1px solid rgba(0,0,0,.12);background:#fff;border-radius:999px;padding:7px 10px;display:flex;gap:6px;align-items:center;cursor:pointer;font-weight:800;box-shadow:0 8px 20px rgba(0,0,0,.16)}
.targetBirdSelect[aria-pressed=true]{background:#15724f;color:#fff}.selectIcon{font-size:1.05rem;line-height:1}
.selectedPanel{position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto}.selectedList{display:grid;gap:8px;margin-bottom:16px}
.selectedItem{display:flex;justify-content:space-between;gap:8px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:9px}
.selectedItem strong{font-size:.9rem}.selectedItem span{display:block;color:var(--muted);font-size:.78rem}.selectedItem button{border:0;background:transparent;font-size:1.1rem;cursor:pointer}
.previewBox{border:1px solid var(--line);border-radius:8px;background:#f8fbf8;padding:12px;display:grid;gap:8px;margin-bottom:16px}
.previewBox h3{margin:0;font-size:1rem}.previewBox p{margin:0;color:var(--muted);line-height:1.5;font-size:.9rem}
.leadForm{display:grid;gap:10px}.leadForm .twoCol{display:grid;grid-template-columns:1fr 1fr;gap:8px}.leadForm textarea{min-height:82px;resize:vertical}
.payloadPreview{white-space:pre-wrap;max-height:260px;overflow:auto;background:#f3f7f4;border:1px solid var(--line);border-radius:8px;padding:10px;font-size:.78rem}
.trustNote{font-size:.78rem;line-height:1.45;color:var(--muted);margin:0}.sectionBand{padding:28px;border-top:1px solid var(--line);display:grid;gap:16px}
.infoGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.infoBox{border:1px solid var(--line);border-radius:8px;background:#fff;padding:16px}.infoBox h2,.infoBox h3{margin:0 0 8px}.infoBox p{margin:0;color:var(--muted);line-height:1.55}
.hidden{display:none!important}
@media(max-width:1100px){.builderShell{grid-template-columns:260px minmax(0,1fr)}.selectedPanel{grid-column:1/-1;position:static;max-height:none;border-left:0;border-top:1px solid var(--line)}.targetGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.routeMap{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:780px){.targetHero{grid-template-columns:1fr;min-height:0}.targetHeroCopy{padding:28px 18px}.targetHeroPanel{padding:18px}.heroMetrics{grid-template-columns:1fr 1fr}.builderShell{grid-template-columns:1fr}.filterPanel{border-right:0;border-bottom:1px solid var(--line)}.targetGrid{grid-template-columns:1fr}.routeMap{grid-template-columns:1fr}.infoGrid{grid-template-columns:1fr}.leadForm .twoCol{grid-template-columns:1fr}.selectedPanel{padding-bottom:88px}.mobileSticky{display:flex}}
.mobileSticky{position:fixed;left:10px;right:10px;bottom:10px;z-index:30;gap:8px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px;box-shadow:0 12px 36px rgba(0,0,0,.18)}
@media(min-width:781px){.mobileSticky{display:none}}
</style>`;
}

function clientScript(lang) {
  return `<script>
(function(){
  var PAGE_LANG = ${JSON.stringify(lang)};
  var DATA = window.MBW_TARGET_BUILDER_DATA || { birds: [], webhookUrl: "" };
  var selected = new Map();
  var filters = { search:"", group:"", difficulty:"", tourFit:"", route:"", photography:"", iconic:false };

  function track(eventName, params){
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({
      event: eventName,
      page_path: window.location.pathname,
      language: PAGE_LANG
    }, params || {}));
  }

  function birdName(bird){ return PAGE_LANG === "es" ? bird.spanishName : bird.englishName; }
  function routeName(bird){ return PAGE_LANG === "es" ? bird.routeLabelEs : bird.routeLabelEn; }

  function matches(card){
    var text = [
      card.dataset.englishName,
      card.dataset.spanishName,
      card.dataset.scientificName,
      card.dataset.speciesCode
    ].join(" ").toLowerCase();
    if(filters.search && !text.includes(filters.search.toLowerCase())) return false;
    if(filters.group && card.dataset.group !== filters.group) return false;
    if(filters.difficulty && card.dataset.difficulty !== filters.difficulty) return false;
    if(filters.tourFit && card.dataset.tourFit !== filters.tourFit) return false;
    if(filters.route && card.dataset.routeCluster !== filters.route) return false;
    if(filters.photography && card.dataset.photography !== filters.photography) return false;
    if(filters.iconic && card.dataset.iconic !== "true") return false;
    return true;
  }

  function applyFilters(){
    var visible = 0;
    document.querySelectorAll("[data-bird-card]").forEach(function(card){
      var show = matches(card);
      card.hidden = !show;
      if(show) visible++;
    });
    var count = document.querySelector("[data-result-count]");
    if(count) count.textContent = String(visible);
    track("target_filter_apply", Object.assign({}, filters, { visible_count: visible, selected_count: selected.size }));
  }

  function renderSelected(){
    var list = document.querySelector("[data-selected-list]");
    var empty = document.querySelector("[data-selected-empty]");
    var countNodes = document.querySelectorAll("[data-selected-count]");
    countNodes.forEach(function(node){ node.textContent = String(selected.size); });
    if(!list) return;
    list.innerHTML = "";
    if(empty) empty.hidden = selected.size > 0;
    selected.forEach(function(bird){
      var item = document.createElement("div");
      item.className = "selectedItem";
      item.innerHTML = "<div><strong>" + birdName(bird) + "</strong><span>" + bird.speciesCode + " - " + routeName(bird) + "</span></div><button type='button' aria-label='Remove'>x</button>";
      item.querySelector("button").addEventListener("click", function(){ toggleBird(bird.speciesCode, false); });
      list.appendChild(item);
    });
    renderPreview();
  }

  function renderPreview(){
    var preview = document.querySelector("[data-preview-text]");
    if(!preview) return;
    if(!selected.size){
      preview.textContent = PAGE_LANG === "es"
        ? "Selecciona aves objetivo para ver una vista previa de ruta y tour."
        : "Select target birds to preview route focus and tour fit.";
      return;
    }
    var routes = {};
    selected.forEach(function(bird){ routes[routeName(bird)] = (routes[routeName(bird)] || 0) + 1; });
    var routeText = Object.keys(routes).map(function(route){ return route + " (" + routes[route] + ")"; }).join("; ");
    preview.textContent = PAGE_LANG === "es"
      ? "Tu lista sugiere una revision privada con enfoque en: " + routeText + "."
      : "Your list suggests a private guide review focused on: " + routeText + ".";
  }

  function toggleBird(code, force){
    var bird = DATA.birds.find(function(item){ return item.speciesCode === code; });
    if(!bird) return;
    var next = typeof force === "boolean" ? force : !selected.has(code);
    if(next) selected.set(code, bird); else selected.delete(code);
    document.querySelectorAll("[data-select-species='" + CSS.escape(code) + "']").forEach(function(button){
      button.setAttribute("aria-pressed", next ? "true" : "false");
      button.querySelector("span:last-child").textContent = next
        ? (PAGE_LANG === "es" ? "Seleccionada" : "Selected")
        : (PAGE_LANG === "es" ? "Seleccionar" : "Select");
      var icon = button.querySelector(".selectIcon");
      if(icon) icon.textContent = next ? "✓" : "+";
    });
    track(next ? "target_species_select" : "target_species_remove", {
      speciesCode: bird.speciesCode,
      english_name: bird.englishName,
      target_difficulty: bird.targetDifficulty,
      tour_fit: bird.tourFit,
      route_cluster: bird.routeCluster,
      selected_count: selected.size
    });
    renderSelected();
  }

  function buildPayload(){
    var form = document.querySelector("[data-lead-form]");
    var fd = form ? new FormData(form) : new FormData();
    return {
      visitor_name: String(fd.get("visitor_name") || ""),
      visitor_email: String(fd.get("visitor_email") || ""),
      visitor_whatsapp: String(fd.get("visitor_whatsapp") || ""),
      preferred_language: PAGE_LANG,
      requested_dates: String(fd.get("requested_dates") || ""),
      group_size: String(fd.get("group_size") || ""),
      fitness_level: String(fd.get("fitness_level") || ""),
      photography_priority: String(fd.get("photography_priority") || ""),
      target_notes: String(fd.get("target_notes") || ""),
      source_page: window.location.pathname,
      speciesCodes: Array.from(selected.keys())
    };
  }

  document.addEventListener("input", function(event){
    var search = event.target.closest("[data-filter-search]");
    if(search){ filters.search = search.value || ""; track("target_search", { query_length: filters.search.length }); applyFilters(); }
  });

  document.addEventListener("change", function(event){
    var select = event.target.closest("[data-filter-select]");
    if(select){ filters[select.getAttribute("data-filter-select")] = select.value || ""; applyFilters(); }
  });

  document.addEventListener("click", function(event){
    var selectButton = event.target.closest("[data-select-species]");
    if(selectButton){ toggleBird(selectButton.getAttribute("data-select-species")); return; }

    var routeButton = event.target.closest("[data-route-filter]");
    if(routeButton){
      var route = routeButton.getAttribute("data-route-filter") || "";
      filters.route = filters.route === route ? "" : route;
      document.querySelectorAll("[data-route-filter]").forEach(function(btn){ btn.setAttribute("aria-pressed", btn.getAttribute("data-route-filter") === filters.route ? "true" : "false"); });
      track("target_map_cluster_click", { route_cluster: route, active: !!filters.route });
      applyFilters();
      return;
    }

    var toggle = event.target.closest("[data-quick-toggle]");
    if(toggle){
      var key = toggle.getAttribute("data-quick-toggle");
      if(key === "iconic") filters.iconic = !filters.iconic;
      if(key === "easy_half_day"){
        filters.difficulty = filters.difficulty === "easy" ? "" : "easy";
        filters.tourFit = filters.tourFit === "half_day" ? "" : "half_day";
      }
      if(key === "specialist"){
        filters.difficulty = filters.difficulty === "specialist" ? "" : "specialist";
      }
      toggle.setAttribute("aria-pressed", toggle.getAttribute("aria-pressed") !== "true" ? "true" : "false");
      applyFilters();
      return;
    }

    var submit = event.target.closest("[data-preview-submit]");
    if(submit){
      var payload = buildPayload();
      track("target_form_submit", {
        selected_count: payload.speciesCodes.length,
        has_email: Boolean(payload.visitor_email),
        has_whatsapp: Boolean(payload.visitor_whatsapp)
      });
      var output = document.querySelector("[data-payload-preview]");
      if(output) output.textContent = JSON.stringify(payload, null, 2);
      return;
    }
  });

  document.addEventListener("DOMContentLoaded", function(){
    var count = document.querySelector("[data-result-count]");
    if(count) count.textContent = String(DATA.birds.length);
    renderSelected();
    track("target_builder_view", { bird_count: DATA.birds.length });
  });
})();
</script>`;
}

function renderPage(lang, data) {
  const isEs = lang === "es";
  const pagePath = isEs ? ES_PATH : EN_PATH;
  const counterpartPath = isEs ? EN_PATH : ES_PATH;
  const pageUrl = SITE_URL + pagePath;
  const counterpartUrl = SITE_URL + counterpartPath;
  const labels = labelMap(lang);
  const title = isEs
    ? "Constructor de Tour para Aves Objetivo en Mindo | Mindo Bird Watching"
    : "Custom Target Bird Tour Builder in Mindo | Mindo Bird Watching";
  const meta = isEs
    ? "Elige aves objetivo en Mindo y solicita un reporte de oportunidad revisado por guía con actividad reciente, rutas sugeridas y opciones de tour privado."
    : "Choose target birds in Mindo and request a guide-reviewed opportunity report with recent activity, suggested route areas, and private tour options.";
  const h1 = isEs ? "Constructor de Tour para Aves Objetivo" : "Custom Target Bird Tour Builder";
  const heroText = isEs
    ? "Selecciona las aves que más quieres ver. Revisaremos actividad reciente, rutas y factibilidad para ayudarte a planificar un tour privado más inteligente."
    : "Choose the birds you most want to see. We will review recent activity, routes, and feasibility to help plan a smarter private birding tour.";
  const langSwitch = isEs
    ? `<nav aria-label="Selector de idioma" class="rawLangLinks"><a href="${attr(counterpartUrl)}" hreflang="en" lang="en" data-analytics-event="language_switch_click" data-analytics-label="English" data-analytics-location="language_switch" data-analytics-page-language="es" data-analytics-page-type="target_bird_tour_builder" data-analytics-target-language="en">English</a><a href="${attr(pageUrl)}" hreflang="es" lang="es" aria-current="page" data-analytics-event="language_switch_click" data-analytics-label="Español" data-analytics-location="language_switch" data-analytics-page-language="es" data-analytics-page-type="target_bird_tour_builder" data-analytics-target-language="es">Español</a></nav>`
    : `<nav aria-label="Language switch" class="rawLangLinks"><a href="${attr(pageUrl)}" hreflang="en" lang="en" aria-current="page" data-analytics-event="language_switch_click" data-analytics-label="English" data-analytics-location="language_switch" data-analytics-page-language="en" data-analytics-page-type="target_bird_tour_builder" data-analytics-target-language="en">English</a><a href="${attr(counterpartUrl)}" hreflang="es" lang="es" data-analytics-event="language_switch_click" data-analytics-label="Español" data-analytics-location="language_switch" data-analytics-page-language="en" data-analytics-page-type="target_bird_tour_builder" data-analytics-target-language="es">Español</a></nav>`;

  const taxonOptions = groupOptions(data.birds, "taxonGroup");
  const difficultyOptions = groupOptions(data.birds, "targetDifficulty");
  const tourOptions = groupOptions(data.birds, "tourFit");
  const routeOptions = groupOptions(data.birds, "routeCluster");
  const photoOptions = groupOptions(data.birds, "photographyDifficulty");
  const cards = data.birds.map((bird) => renderBirdCard(bird, lang)).join("\n");
  const routeMap = renderRouteMap(data.routes, data.birds, lang);

  const clientJson = JSON.stringify({
    birds: data.birds.map((bird) => ({
      speciesCode: bird.speciesCode,
      englishName: bird.englishName,
      spanishName: bird.spanishName,
      scientificName: bird.scientificName,
      targetDifficulty: bird.targetDifficulty,
      tourFit: bird.tourFit,
      routeCluster: bird.routeCluster,
      routeLabelEn: bird.routeLabelEn,
      routeLabelEs: bird.routeLabelEs,
      bestTime: bird.bestTime,
      image: bird.image,
      iconic: bird.iconic
    })),
    webhookUrl: WEBHOOK_URL
  });

  return `<!DOCTYPE html>
<html lang="${isEs ? "es" : "en"}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${attr(meta)}"/>
<link rel="canonical" href="${attr(pageUrl)}"/>
<link rel="alternate" hreflang="en" href="${attr(SITE_URL + EN_PATH)}"/>
<link rel="alternate" hreflang="es" href="${attr(SITE_URL + ES_PATH)}"/>
<link rel="alternate" hreflang="x-default" href="${attr(SITE_URL + EN_PATH)}"/>
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Mindo Bird Watching"/>
<meta property="og:locale" content="${isEs ? "es_EC" : "en_US"}"/>
<meta property="og:title" content="${attr(title)}"/>
<meta property="og:description" content="${attr(meta)}"/>
<meta property="og:url" content="${attr(pageUrl)}"/>
<meta property="og:image" content="${attr(SITE_URL + OG_IMAGE)}"/>
<meta property="og:image:secure_url" content="${attr(SITE_URL + OG_IMAGE)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="${attr(title)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${attr(title)}"/>
<meta name="twitter:description" content="${attr(meta)}"/>
<meta name="twitter:image" content="${attr(SITE_URL + OG_IMAGE)}"/>
<link href="/favicon.ico" rel="icon" sizes="any"/>
<link href="/favicon.svg" rel="icon" type="image/svg+xml"/>
<link href="/apple-touch-icon.png" rel="apple-touch-icon"/>
<link href="/site.webmanifest" rel="manifest"/>
<link href="/assets/css/header.css" rel="stylesheet"/>
<link href="/assets/css/site.css" rel="stylesheet"/>
<script defer src="/assets/js/head.js"></script>
<script defer src="/assets/js/site-config.js"></script>
${pageCss()}
<script type="application/ld+json">${JSON.stringify(schemaGraph(lang, data), null, 2)}</script>
</head>
<body data-page-content-group="birding_tours" data-page-language="${isEs ? "es" : "en"}" data-page-location="mindo" data-page-region="mindo_cloud_forest" data-page-type="target_bird_tour_builder">
<div class="container">
<div id="siteHeader" data-current-lang="${isEs ? "es" : "en"}"></div>
${langSwitch}
<main class="page targetBuilderPage" aria-label="${attr(h1)}">
<section class="targetHero">
  <div class="targetHeroCopy">
    <span class="eyebrow">${isEs ? "Tours privados en Mindo" : "Private Mindo Birding"}</span>
    <h1>${esc(h1)}</h1>
    <p>${esc(heroText)}</p>
    <div class="heroActions">
      <a class="btn primary" href="#builder" data-analytics-event="primary_cta_click" data-analytics-label="${isEs ? "Elegir aves objetivo" : "Choose Target Birds"}" data-analytics-link-url="#builder" data-analytics-location="hero" data-analytics-page-language="${isEs ? "es" : "en"}" data-analytics-page-type="target_bird_tour_builder">${isEs ? "Elegir aves objetivo" : "Choose Target Birds"}</a>
      <a class="btn secondary" href="${isEs ? "/es/tours/tour-personalizado-privado/" : "/tours/custom-private-tour/"}" data-analytics-event="internal_link_click" data-analytics-label="${isEs ? "Ver tour privado" : "View Custom Private Tour"}" data-analytics-link-url="${isEs ? "/es/tours/tour-personalizado-privado/" : "/tours/custom-private-tour/"}" data-analytics-location="hero" data-analytics-page-language="${isEs ? "es" : "en"}" data-analytics-page-type="target_bird_tour_builder">${isEs ? "Ver tour privado" : "View Custom Private Tour"}</a>
    </div>
    <div class="heroMetrics">
      <div class="heroMetric"><strong>${data.birds.length}</strong><span>${isEs ? "aves objetivo" : "target birds"}</span></div>
      <div class="heroMetric"><strong>${data.routes.filter((r) => data.birds.some((b) => b.routeCluster === r.id)).length}</strong><span>${isEs ? "zonas de ruta" : "route areas"}</span></div>
      <div class="heroMetric"><strong>${data.birds.filter((b) => b.iconic).length}</strong><span>${isEs ? "aves iconicas" : "iconic birds"}</span></div>
    </div>
  </div>
  <div class="targetHeroPanel">
    <div class="targetMiniReport">
      <h2>${isEs ? "Como funciona" : "How it works"}</h2>
      <ul>
        <li>${isEs ? "Selecciona aves objetivo." : "Select target birds."}</li>
        <li>${isEs ? "Comparte fechas, grupo e intereses." : "Share dates, group size, and interests."}</li>
        <li>${isEs ? "Recibe una vista previa y solicita revision del guia." : "See a preview and request guide review."}</li>
      </ul>
      <p class="trustNote">${isEs ? "No usamos lenguaje de garantia. El reporte se basa en actividad reciente y conocimiento local." : "No guarantee language. The report uses recent activity and local route knowledge."}</p>
    </div>
  </div>
</section>

<section class="builderShell" id="builder">
  <aside class="filterPanel" aria-label="${isEs ? "Filtros" : "Filters"}">
    <h2>${isEs ? "Filtrar aves" : "Filter Birds"}</h2>
    <div class="filterStack">
      <label class="filterField"><span>${isEs ? "Buscar" : "Search"}</span><input type="search" data-filter-search placeholder="${isEs ? "Nombre, especie, codigo..." : "Name, species, code..."}"></label>
      ${renderSelect("group", taxonOptions, lang, "Bird group", "Grupo de ave")}
      ${renderSelect("difficulty", difficultyOptions, lang, "Target difficulty", "Dificultad")}
      ${renderSelect("tourFit", tourOptions, lang, "Tour fit", "Tipo de tour")}
      ${renderSelect("route", routeOptions, lang, "Route area", "Zona de ruta")}
      ${renderSelect("photography", photoOptions, lang, "Photography", "Fotografia")}
      <div class="quickToggles">
        <button type="button" data-quick-toggle="iconic" aria-pressed="false">${isEs ? "Iconicas" : "Iconic"}</button>
        <button type="button" data-quick-toggle="easy_half_day" aria-pressed="false">${isEs ? "Facil medio dia" : "Easy half day"}</button>
        <button type="button" data-quick-toggle="specialist" aria-pressed="false">${isEs ? "Especialistas" : "Specialists"}</button>
      </div>
    </div>
  </aside>

  <section class="targetMain">
    <div class="targetToolbar">
      <div><strong data-result-count>${data.birds.length}</strong> ${isEs ? "aves visibles" : "birds visible"}</div>
      <div><strong data-selected-count>0</strong> ${isEs ? "seleccionadas" : "selected"}</div>
    </div>
    <div class="routeMap" aria-label="${isEs ? "Mapa de zonas de ruta" : "Route area map"}">${routeMap}</div>
    <div class="targetGrid">${cards}</div>
  </section>

  <aside class="selectedPanel" aria-label="${isEs ? "Aves seleccionadas" : "Selected target birds"}">
    <h2>${isEs ? "Tu lista objetivo" : "Your Target List"}</h2>
    <p class="trustNote" data-selected-empty>${isEs ? "Selecciona aves para construir tu reporte preliminar." : "Select birds to build your preliminary report."}</p>
    <div class="selectedList" data-selected-list></div>
    <div class="previewBox">
      <h3>${isEs ? "Vista previa" : "Preview"}</h3>
      <p data-preview-text></p>
    </div>
    <form class="leadForm" data-lead-form>
      <input name="visitor_name" placeholder="${isEs ? "Nombre" : "Name"}">
      <input name="visitor_email" type="email" placeholder="Email">
      <input name="visitor_whatsapp" placeholder="WhatsApp">
      <div class="twoCol">
        <input name="requested_dates" placeholder="${isEs ? "Fechas" : "Dates"}">
        <input name="group_size" inputmode="numeric" placeholder="${isEs ? "Personas" : "Group size"}">
      </div>
      <div class="twoCol">
        <select name="fitness_level"><option value="moderate">${isEs ? "Condicion moderada" : "Moderate fitness"}</option><option value="easy">${labels.easy}</option><option value="hard">${labels.hard}</option></select>
        <select name="photography_priority"><option value="medium">${isEs ? "Foto media" : "Medium photo priority"}</option><option value="high">${isEs ? "Foto alta" : "High photo priority"}</option><option value="primary_goal">${isEs ? "Fotografia principal" : "Photography is the main goal"}</option></select>
      </div>
      <textarea name="target_notes" placeholder="${isEs ? "Notas, fechas flexibles o aves adicionales" : "Notes, flexible dates, or extra target birds"}"></textarea>
      <button class="btn primary" type="button" data-preview-submit>${isEs ? "Ver vista previa del reporte" : "Preview My Report"}</button>
      <p class="trustNote">${isEs ? "En el siguiente paso podremos enviarte el reporte por email y solicitar revision del guia." : "In the next step, we can email this report and request guide review."}</p>
      <pre class="payloadPreview" data-payload-preview></pre>
    </form>
  </aside>
</section>

<section class="sectionBand">
  <div class="infoGrid">
    <article class="infoBox"><h2>${isEs ? "Reporte semi-instantaneo" : "Semi-Instant Preview"}</h2><p>${isEs ? "El visitante ve una vista previa util, mientras MBW recibe un reporte interno mas completo." : "The guest sees a useful preview, while MBW receives a richer internal report."}</p></article>
    <article class="infoBox"><h2>${isEs ? "Rutas responsables" : "Responsible Route Areas"}</h2><p>${isEs ? "Mostramos zonas generales y guardamos ubicaciones sensibles para revision interna." : "We show general route areas and keep sensitive locations for internal guide review."}</p></article>
    <article class="infoBox"><h2>${isEs ? "Seguimiento de leads" : "Lead Tracking"}</h2><p>${isEs ? "Cada seleccion, filtro y CTA esta preparado para GTM y analitica." : "Every selection, filter, and CTA is ready for GTM and analytics."}</p></article>
  </div>
</section>
</main>
<div id="siteFooter"></div>
</div>
<div class="mobileSticky"><a class="btn primary" href="#builder"><span data-selected-count>0</span> ${isEs ? "seleccionadas" : "selected"}</a><button class="btn secondary" type="button" data-preview-submit>${isEs ? "Vista previa" : "Preview"}</button></div>
<script defer src="/assets/js/site.js"></script>
<script>window.MBW_TARGET_BUILDER_DATA=${clientJson};</script>
${clientScript(lang)}
</body>
</html>`;
}

async function main() {
  const [coreRows, mediaRows, tourRows, routeRows] = await Promise.all([
    loadRows(SOURCES.speciesCore),
    loadRows(SOURCES.speciesMedia),
    loadRows(SOURCES.speciesTourBuilder),
    loadRows(SOURCES.routeClusters)
  ]);

  const data = buildData(coreRows, mediaRows, tourRows, routeRows);
  if (!data.birds.length) throw new Error("No target species found. Check species_tour_builder.target_species.");

  fs.mkdirSync(path.dirname(OUT_EN), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_ES), { recursive: true });
  fs.writeFileSync(OUT_EN, renderPage("en", data), "utf8");
  fs.writeFileSync(OUT_ES, renderPage("es", data), "utf8");

  console.log(`Generated ${OUT_EN}`);
  console.log(`Generated ${OUT_ES}`);
  console.log(`Target birds: ${data.birds.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
