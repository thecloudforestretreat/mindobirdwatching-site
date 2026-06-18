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

const HERO_IMAGE = "/assets/images/pages/tours/full-day/MBW-Assets-65-Tours-FD-Carousel.jpg";
const OG_IMAGE = HERO_IMAGE;
const PLACEHOLDER_IMAGE = "/assets/images/birds/mbw_plate_billed_mountan_toucan_01.jpg";
const LOGO_IMAGE = "/assets/images/logo/mbw-logo-mark-1024.png";
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

function renderRouteSelect(routes, lang) {
  const label = lang === "es" ? "Zona de ruta" : "Route area";
  return `
<label class="filterField">
  <span>${esc(label)}</span>
  <select data-filter-select="route">
    <option value="">${lang === "es" ? "Todas" : "All"}</option>
    ${routes.map((route) => `<option value="${attr(route.id)}">${esc(lang === "es" ? route.nameEs : route.nameEn)}</option>`).join("")}
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
body[data-page-type="target_bird_tour_builder"]{--tbtb-bg:var(--bg,#C7DAAC);--tbtb-forest:var(--forest,#0D5925);--tbtb-ink:var(--ink,#071923);--tbtb-muted:var(--muted,rgba(7,25,35,.72));--tbtb-card:var(--card,rgba(255,255,255,.72));--tbtb-line:var(--line,rgba(7,25,35,.14));--tbtb-radius:var(--r,18px);--tbtb-shadow:var(--shadow,0 18px 55px rgba(7,25,35,.10));--tbtb-head:var(--font-head,Georgia,"Times New Roman",serif);--tbtb-body:var(--font-body,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif)}
body[data-page-type="target_bird_tour_builder"] .rawLangLinks{display:flex;gap:10px;margin:10px 0;font-size:.9rem}
body[data-page-type="target_bird_tour_builder"] .rawLangLinks a{color:var(--tbtb-forest);font-weight:900;text-decoration:none}
body[data-page-type="target_bird_tour_builder"] .btn,body[data-page-type="target_bird_tour_builder"] button.btn,body[data-page-type="target_bird_tour_builder"] a.btn,body[data-page-type="target_bird_tour_builder"] .mobileSticky .btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:11px 14px;border-radius:14px;border:1px solid var(--tbtb-line);font-family:var(--tbtb-body);font-weight:900;text-decoration:none;cursor:pointer;box-sizing:border-box;line-height:1.15}
body[data-page-type="target_bird_tour_builder"] .btn.primary,body[data-page-type="target_bird_tour_builder"] button.btn.primary{background:rgba(13,89,37,.94);border-color:rgba(13,89,37,.45);color:#fff}
body[data-page-type="target_bird_tour_builder"] .btn.secondary,body[data-page-type="target_bird_tour_builder"] button.btn.secondary{background:rgba(255,255,255,.78);border-color:rgba(13,89,37,.28);color:var(--tbtb-forest)}
body[data-page-type="target_bird_tour_builder"] .targetBuilderPage{margin-top:18px;padding:0;overflow:hidden;background:var(--tbtb-card);border:1px solid var(--tbtb-line);border-radius:var(--tbtb-radius);box-shadow:var(--tbtb-shadow)}
body[data-page-type="target_bird_tour_builder"] .targetHero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr);gap:16px;align-items:stretch;padding:18px;background:linear-gradient(135deg,rgba(255,255,255,.78),rgba(255,255,255,.50))}
body[data-page-type="target_bird_tour_builder"] .targetHeroCopy,body[data-page-type="target_bird_tour_builder"] .targetHeroMedia,body[data-page-type="target_bird_tour_builder"] .targetMiniReport,body[data-page-type="target_bird_tour_builder"] .filterPanel,body[data-page-type="target_bird_tour_builder"] .targetMain,body[data-page-type="target_bird_tour_builder"] .selectedPanel,body[data-page-type="target_bird_tour_builder"] .infoBox{border:1px solid var(--tbtb-line);border-radius:var(--tbtb-radius);background:rgba(255,255,255,.68);box-shadow:var(--tbtb-shadow)}
body[data-page-type="target_bird_tour_builder"] .targetHeroCopy{padding:26px;display:grid;align-content:center;gap:14px;min-width:0;min-height:0}
body[data-page-type="target_bird_tour_builder"] .targetHeroMedia{overflow:hidden;display:grid;grid-template-rows:minmax(0,1fr) auto;align-content:stretch;min-height:0;background:#eef4ea}
body[data-page-type="target_bird_tour_builder"] .targetHeroMedia img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
body[data-page-type="target_bird_tour_builder"] .targetHeroCap{padding:10px 12px;border-top:1px solid var(--tbtb-line);background:rgba(255,255,255,.74);font-size:.82rem;line-height:1.45;color:var(--tbtb-muted);margin:0}
body[data-page-type="target_bird_tour_builder"] .eyebrow{display:inline-flex;width:fit-content;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.82);color:var(--forest);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
body[data-page-type="target_bird_tour_builder"] .eyebrow:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--forest);display:inline-block}
body[data-page-type="target_bird_tour_builder"] .targetHero h1{margin:0;color:var(--tbtb-forest);font-size:clamp(2rem,4.2vw,3.55rem);line-height:1.04;letter-spacing:-.025em;max-width:760px}
body[data-page-type="target_bird_tour_builder"] .targetHero p{margin:0;max-width:72ch;color:var(--tbtb-ink);font-size:1rem;line-height:1.68}
body[data-page-type="target_bird_tour_builder"] .heroActions{display:flex;gap:10px;flex-wrap:wrap}
body[data-page-type="target_bird_tour_builder"] .heroMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:620px}
body[data-page-type="target_bird_tour_builder"] .heroMetric{border:1px solid var(--line);background:rgba(255,255,255,.74);border-radius:14px;padding:12px}
body[data-page-type="target_bird_tour_builder"] .heroMetric strong{display:block;font-size:1.55rem;color:var(--forest);line-height:1}
body[data-page-type="target_bird_tour_builder"] .heroMetric span{font-size:.82rem;color:var(--muted);font-weight:800}
body[data-page-type="target_bird_tour_builder"] .targetMiniReport{margin:0 26px 18px;padding:16px;display:grid;gap:10px}
body[data-page-type="target_bird_tour_builder"] .targetMiniReport h2{margin:0;font-size:1.25rem}
body[data-page-type="target_bird_tour_builder"] .targetMiniReport ul{margin:0;padding-left:18px;line-height:1.65;color:var(--tbtb-ink)}
body[data-page-type="target_bird_tour_builder"] .trustNote{font-size:.82rem;line-height:1.5;color:var(--muted);margin:0}
body[data-page-type="target_bird_tour_builder"] .builderShell{display:grid;gap:16px;padding:18px;border-top:1px solid var(--line)}
body[data-page-type="target_bird_tour_builder"] .filterPanel{padding:14px}
body[data-page-type="target_bird_tour_builder"] .filterPanel h2,body[data-page-type="target_bird_tour_builder"] .selectedPanel h2{margin:0;color:var(--forest);font-size:1.18rem}
body[data-page-type="target_bird_tour_builder"] .filterStack{display:grid;grid-template-columns:minmax(190px,1.4fr) repeat(5,minmax(130px,1fr));gap:10px;align-items:end}
body[data-page-type="target_bird_tour_builder"] .filterField{display:grid;gap:6px;min-width:0}
body[data-page-type="target_bird_tour_builder"] .filterField span,body[data-page-type="target_bird_tour_builder"] .labelText{font-size:.78rem;font-weight:900;color:var(--ink)}
body[data-page-type="target_bird_tour_builder"] .filterField input,body[data-page-type="target_bird_tour_builder"] .filterField select,body[data-page-type="target_bird_tour_builder"] .leadForm input,body[data-page-type="target_bird_tour_builder"] .leadForm select,body[data-page-type="target_bird_tour_builder"] .leadForm textarea{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:14px;padding:11px 12px;background:rgba(255,255,255,.78);color:var(--ink);font:inherit;box-shadow:0 10px 25px rgba(0,0,0,.05)}
body[data-page-type="target_bird_tour_builder"] .filterField input,body[data-page-type="target_bird_tour_builder"] .filterField select,body[data-page-type="target_bird_tour_builder"] .leadForm input,body[data-page-type="target_bird_tour_builder"] .leadForm select{height:44px}
body[data-page-type="target_bird_tour_builder"] .searchField{position:relative}
body[data-page-type="target_bird_tour_builder"] .searchSuggestions{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:8;display:none;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 18px 44px rgba(7,25,35,.18);overflow:hidden}
body[data-page-type="target_bird_tour_builder"] .searchSuggestions.is-visible{display:block}
body[data-page-type="target_bird_tour_builder"] .searchSuggestions button{display:grid;width:100%;gap:2px;border:0;border-bottom:1px solid rgba(7,25,35,.08);background:#fff;text-align:left;padding:10px 12px;cursor:pointer;color:var(--ink)}
body[data-page-type="target_bird_tour_builder"] .searchSuggestions button:hover,body[data-page-type="target_bird_tour_builder"] .searchSuggestions button:focus{background:rgba(13,89,37,.08);outline:0}
body[data-page-type="target_bird_tour_builder"] .searchSuggestions strong{font-size:.9rem}
body[data-page-type="target_bird_tour_builder"] .searchSuggestions small{color:var(--muted);font-size:.76rem}
body[data-page-type="target_bird_tour_builder"] .quickToggles{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap;margin-top:0}
body[data-page-type="target_bird_tour_builder"] .quickToggles button,body[data-page-type="target_bird_tour_builder"] .routeNode{border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.75);color:var(--ink);padding:10px;cursor:pointer;text-align:left;box-shadow:0 10px 25px rgba(0,0,0,.05)}
body[data-page-type="target_bird_tour_builder"] .quickToggles button{font-weight:900;padding:8px 10px}
body[data-page-type="target_bird_tour_builder"] .quickToggles button[aria-pressed=true],body[data-page-type="target_bird_tour_builder"] .routeNode[aria-pressed=true]{border-color:rgba(13,89,37,.42);background:rgba(13,89,37,.12);color:var(--forest)}
body[data-page-type="target_bird_tour_builder"] .targetMain{padding:14px;display:grid;gap:16px}
body[data-page-type="target_bird_tour_builder"] .routeMap{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:9px}
body[data-page-type="target_bird_tour_builder"] .routeNode span{display:block;font-weight:900;font-size:.78rem;line-height:1.16}
body[data-page-type="target_bird_tour_builder"] .routeNode strong{display:block;font-size:1.35rem;color:var(--forest);line-height:1.05;margin-top:4px}
body[data-page-type="target_bird_tour_builder"] .routeNode small{display:block;color:var(--muted);font-size:.68rem;line-height:1.25;margin-top:4px}
body[data-page-type="target_bird_tour_builder"] .targetToolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;color:var(--ink)}
body[data-page-type="target_bird_tour_builder"] .targetGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
body[data-page-type="target_bird_tour_builder"] .targetBirdCard{position:relative;border:1px solid var(--line);border-radius:var(--r);background:rgba(255,255,255,.78);overflow:hidden;display:grid;grid-template-rows:auto 1fr;min-width:0;box-shadow:0 12px 30px rgba(7,25,35,.08)}
body[data-page-type="target_bird_tour_builder"] .targetBirdImage{width:100%;aspect-ratio:4/3;height:auto;object-fit:contain;object-position:center;background:linear-gradient(135deg,rgba(13,89,37,.10),rgba(255,255,255,.72));padding:6px;box-sizing:border-box}
body[data-page-type="target_bird_tour_builder"] .targetBirdBody{padding:12px;display:grid;grid-template-rows:auto auto auto 1fr;gap:8px;align-content:start;min-height:205px}
body[data-page-type="target_bird_tour_builder"] .targetBirdTopline{display:flex;justify-content:space-between;gap:8px;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:var(--forest);font-weight:900}
body[data-page-type="target_bird_tour_builder"] .targetBirdCard h3{margin:0;color:var(--ink);font-family:var(--font-body);font-size:1rem;line-height:1.22;font-weight:900;letter-spacing:0}
body[data-page-type="target_bird_tour_builder"] .birdNames{margin:0;color:var(--muted);font-size:.82rem;line-height:1.45}
body[data-page-type="target_bird_tour_builder"] .birdNames em{display:block}
body[data-page-type="target_bird_tour_builder"] .chipRow{display:grid;gap:4px;margin-top:2px}
body[data-page-type="target_bird_tour_builder"] .chipRow span{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:0;border-radius:0;padding:0;background:transparent;color:var(--muted);font-size:.76rem;line-height:1.35}
body[data-page-type="target_bird_tour_builder"] .chipRow span:before{content:"";display:inline-block;width:6px;height:6px;border-radius:999px;background:rgba(13,89,37,.42);margin-right:6px;vertical-align:1px}
body[data-page-type="target_bird_tour_builder"] .birdMicrocopy{margin:0;color:var(--muted);font-size:.82rem;line-height:1.45}
body[data-page-type="target_bird_tour_builder"] .targetBirdSelect{position:absolute;top:10px;right:10px;border:1px solid rgba(0,0,0,.12);background:#fff;border-radius:999px;padding:7px 10px;display:flex;gap:6px;align-items:center;cursor:pointer;font-weight:900;box-shadow:0 8px 20px rgba(0,0,0,.14)}
body[data-page-type="target_bird_tour_builder"] .targetBirdSelect[aria-pressed=true]{background:var(--forest);color:#fff}
body[data-page-type="target_bird_tour_builder"] .selectIcon{font-size:1.05rem;line-height:1}
body[data-page-type="target_bird_tour_builder"] .selectedPanel{padding:14px;display:grid;gap:14px}
body[data-page-type="target_bird_tour_builder"] .selectedGrid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:14px;align-items:start}
body[data-page-type="target_bird_tour_builder"] .selectedList{display:grid;gap:8px}
body[data-page-type="target_bird_tour_builder"] .selectedItem{display:flex;justify-content:space-between;gap:8px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.78);padding:9px}
body[data-page-type="target_bird_tour_builder"] .selectedItem strong{font-size:.9rem;color:var(--ink)}
body[data-page-type="target_bird_tour_builder"] .selectedItem span{display:block;color:var(--muted);font-size:.78rem;line-height:1.35}
body[data-page-type="target_bird_tour_builder"] .selectedItem button{border:0;background:transparent;font-size:1.1rem;cursor:pointer;color:var(--ink)}
body[data-page-type="target_bird_tour_builder"] .previewBox{border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.72);padding:12px;display:grid;gap:8px}
body[data-page-type="target_bird_tour_builder"] .previewBox h3{margin:0;font-size:1rem;color:var(--forest)}
body[data-page-type="target_bird_tour_builder"] .previewBox p{margin:0;color:var(--muted);line-height:1.5;font-size:.9rem}
body[data-page-type="target_bird_tour_builder"] .leadForm{display:grid;gap:10px}
body[data-page-type="target_bird_tour_builder"] .leadForm label{display:grid;gap:6px;min-width:0}
body[data-page-type="target_bird_tour_builder"] .leadForm .twoCol{display:grid;grid-template-columns:1fr 1fr;gap:10px}
body[data-page-type="target_bird_tour_builder"] .leadForm textarea{min-height:108px;resize:vertical;line-height:1.5}
body[data-page-type="target_bird_tour_builder"] .guestReport{display:none;border:1px solid var(--tbtb-line);border-radius:14px;background:rgba(255,255,255,.74);padding:12px;line-height:1.55;color:var(--tbtb-ink);font-size:.9rem}
body[data-page-type="target_bird_tour_builder"] .guestReport.is-visible{display:block}
body[data-page-type="target_bird_tour_builder"] .guestReport h3{margin:0 0 8px;color:var(--tbtb-forest);font-size:1rem}
body[data-page-type="target_bird_tour_builder"] .guestReport ul{margin:0;padding-left:18px}
body[data-page-type="target_bird_tour_builder"] .previewActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
body[data-page-type="target_bird_tour_builder"] .copyBtn{min-height:38px;padding:8px 10px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.78);color:var(--forest);font-weight:900;cursor:pointer}
body[data-page-type="target_bird_tour_builder"] .buttonHelp{margin:0;color:var(--muted);font-size:.82rem;line-height:1.45}
body[data-page-type="target_bird_tour_builder"] .payloadPreview{display:none}
body[data-page-type="target_bird_tour_builder"] .success,body[data-page-type="target_bird_tour_builder"] .errorMsg{display:none;padding:12px 14px;border-radius:14px;font-weight:900;font-size:.88rem;line-height:1.4}
body[data-page-type="target_bird_tour_builder"] .success{border:1px solid rgba(13,89,37,.25);background:rgba(13,89,37,.10)}
body[data-page-type="target_bird_tour_builder"] .errorMsg{border:1px solid rgba(160,0,0,.22);background:rgba(160,0,0,.08)}
body[data-page-type="target_bird_tour_builder"] .sectionBand{padding:18px;border-top:1px solid var(--line);display:grid;gap:16px}
body[data-page-type="target_bird_tour_builder"] .infoGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
body[data-page-type="target_bird_tour_builder"] .infoBox{padding:16px}
body[data-page-type="target_bird_tour_builder"] .infoBox h2,body[data-page-type="target_bird_tour_builder"] .infoBox h3{margin:0 0 8px}
body[data-page-type="target_bird_tour_builder"] .infoBox p{margin:0;color:var(--muted);line-height:1.55}
body[data-page-type="target_bird_tour_builder"] .hidden{display:none!important}
body[data-page-type="target_bird_tour_builder"] .mobileSticky{position:fixed;left:10px;right:10px;bottom:10px;z-index:30;gap:8px;background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:14px;padding:8px;box-shadow:0 12px 36px rgba(0,0,0,.18)}
body[data-page-type="target_bird_tour_builder"] .targetBuilderFallbackFooter{margin-top:18px}
@media(max-width:980px){body[data-page-type="target_bird_tour_builder"] .targetHero{grid-template-columns:1fr}body[data-page-type="target_bird_tour_builder"] .targetHeroMedia{min-height:320px}body[data-page-type="target_bird_tour_builder"] .filterStack{grid-template-columns:repeat(2,minmax(0,1fr))}body[data-page-type="target_bird_tour_builder"] .routeMap{grid-template-columns:repeat(3,minmax(0,1fr))}body[data-page-type="target_bird_tour_builder"] .targetGrid{grid-template-columns:repeat(2,minmax(0,1fr))}body[data-page-type="target_bird_tour_builder"] .selectedGrid{grid-template-columns:1fr}body[data-page-type="target_bird_tour_builder"] .infoGrid{grid-template-columns:1fr}}
@media(max-width:640px){body[data-page-type="target_bird_tour_builder"] .targetHero{padding:12px}body[data-page-type="target_bird_tour_builder"] .targetHeroCopy{padding:18px}body[data-page-type="target_bird_tour_builder"] .targetHeroMedia{min-height:260px}body[data-page-type="target_bird_tour_builder"] .targetMiniReport{margin:0 12px 12px}body[data-page-type="target_bird_tour_builder"] .heroMetrics,body[data-page-type="target_bird_tour_builder"] .filterStack,body[data-page-type="target_bird_tour_builder"] .routeMap,body[data-page-type="target_bird_tour_builder"] .targetGrid,body[data-page-type="target_bird_tour_builder"] .leadForm .twoCol{grid-template-columns:1fr}body[data-page-type="target_bird_tour_builder"] .builderShell{padding:12px}body[data-page-type="target_bird_tour_builder"] .targetBirdImage{aspect-ratio:5/4}.mobileSticky{display:flex}}
@media(min-width:641px){body[data-page-type="target_bird_tour_builder"] .mobileSticky{display:none}}
</style>`;
}

function renderHeaderFallback(lang) {
  const isEs = lang === "es";
  const home = isEs ? "/es/" : "/";
  const opposite = isEs ? EN_PATH : ES_PATH;
  const links = isEs
    ? [
      ["/es/", "Inicio"],
      ["/es/planifica-tu-viaje/", "Planifica tu viaje"],
      ["/es/tours/", "Tours"],
      ["/es/aves/", "Aves"],
      ["/es/sobre-nosotros/", "Nosotros"],
      ["/es/contacto/", "Contacto"],
      ["/es/reservar-tour/", "Reservar"]
    ]
    : [
      ["/", "Home"],
      ["/plan-your-trip/", "Plan Your Trip"],
      ["/tours/", "Tours"],
      ["/birds/", "Birds"],
      ["/about-us/", "About Us"],
      ["/contact/", "Contact"],
      ["/book-tour/", "Book A Tour"]
    ];
  const navLinks = links.map(([href, label]) => `<a class="pill" href="${attr(href)}">${esc(label)}</a>`).join("");
  const langLinks = `<div class="lang" aria-label="${isEs ? "Idioma" : "Language"}"><a${!isEs ? " class=\"active\" aria-current=\"page\"" : ""} href="${attr(EN_PATH)}" hreflang="en" lang="en">EN</a><a${isEs ? " class=\"active\" aria-current=\"page\"" : ""} href="${attr(ES_PATH)}" hreflang="es" lang="es">ES</a></div>`;

  return `
<header class="topbar" data-mbw-header data-current-lang="${isEs ? "es" : "en"}">
  <a class="brand" href="${attr(home)}" aria-label="Mindo Bird Watching">
    <img src="${attr(LOGO_IMAGE)}" alt="" width="32" height="32" loading="eager">
    <span>Mindo Bird Watching</span>
  </a>
  <div class="right">
    ${langLinks}
    <nav class="nav" aria-label="${isEs ? "Navegacion principal" : "Primary navigation"}">${navLinks}</nav>
  </div>
  <button class="menuBtn" type="button" aria-label="${isEs ? "Abrir menu" : "Open menu"}" aria-expanded="false" aria-controls="menuPanel">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
  </button>
  <div class="menuPanel" id="menuPanel">
    ${langLinks}
    <nav class="menuList" aria-label="${isEs ? "Menu movil" : "Mobile menu"}">${navLinks}</nav>
  </div>
</header>
<a class="hidden" href="${attr(opposite)}" hreflang="${isEs ? "en" : "es"}">${isEs ? "English" : "Español"}</a>`;
}

function renderFooterFallback(lang) {
  const isEs = lang === "es";
  return `
<footer class="footer targetBuilderFallbackFooter">
  <div class="footer-social" aria-label="${isEs ? "Redes sociales" : "Social links"}">
    <a href="https://www.instagram.com/mindobirdwatching/" rel="noopener noreferrer" target="_blank" aria-label="Instagram"><img src="/assets/images/social/instagram.png" alt="" loading="lazy"></a>
    <a href="https://www.facebook.com/mindobirdwatching/" rel="noopener noreferrer" target="_blank" aria-label="Facebook"><img src="/assets/images/social/facebook.png" alt="" loading="lazy"></a>
    <a href="https://www.youtube.com/@MindoBirdWatching" rel="noopener noreferrer" target="_blank" aria-label="YouTube"><img src="/assets/images/social/youtube.png" alt="" loading="lazy"></a>
  </div>
  <div class="footer-bottom">
    <img src="${attr(LOGO_IMAGE)}" alt="" loading="lazy">
    <small>${isEs ? "Mindo Bird Watching - Tours privados de aves en Ecuador" : "Mindo Bird Watching - Private birding tours in Ecuador"}</small>
  </div>
</footer>`;
}

function renderWhatsAppFab(lang) {
  const isEs = lang === "es";
  const primary = isEs
    ? "Hola Mindo Bird Watching, quiero revisar una lista de aves objetivo para un tour privado. Pagina: {url}"
    : "Hi Mindo Bird Watching, I want to review a target bird list for a private tour. Page: {url}";
  const dates = isEs
    ? "Hola, quiero consultar disponibilidad para un tour privado de aves objetivo. Pagina: {url}"
    : "Hi, I want to check availability for a private target bird tour. Page: {url}";
  const photo = isEs
    ? "Hola, mi prioridad es fotografia de aves en Mindo. Quiero revisar rutas privadas. Pagina: {url}"
    : "Hi, bird photography is my priority in Mindo. I want to review private routes. Page: {url}";
  const family = isEs
    ? "Hola, viajo con mi grupo/familia y quiero un tour privado de aves en Mindo. Pagina: {url}"
    : "Hi, I am traveling with my group/family and want a private birding tour in Mindo. Page: {url}";

  return `
<div class="mbwWaBirdFab"
  data-wa-number="13054585402"
  data-wa-img-desktop="${attr(LOGO_IMAGE)}"
  data-wa-img-mobile="${attr(LOGO_IMAGE)}">
  <div class="mbwWaBirdBackdrop" aria-hidden="true"></div>
  <button class="mbwWaBirdBtn" type="button" aria-label="${isEs ? "Abrir WhatsApp" : "Open WhatsApp"}" aria-expanded="false">
    <img class="mbwWaBirdImg" src="${attr(LOGO_IMAGE)}" alt="WhatsApp Mindo Bird Watching" loading="lazy">
  </button>
  <div class="mbwWaBirdPanel" role="dialog" aria-label="WhatsApp">
    <div class="mbwWaBirdHead">
      <div class="mbwWaBirdTitle">${isEs ? "Escríbenos por WhatsApp" : "Message us on WhatsApp"}</div>
      <button class="mbwWaBirdClose" type="button" aria-label="${isEs ? "Cerrar" : "Close"}">×</button>
    </div>
    <div class="mbwWaBirdActions">
      <a class="mbwWaBirdAction" href="#" data-wa-template="${attr(primary)}">${isEs ? "Revisar aves objetivo" : "Review target birds"}</a>
      <a class="mbwWaBirdAction" href="#" data-wa-template="${attr(dates)}">${isEs ? "Consultar fechas" : "Check dates"}</a>
      <a class="mbwWaBirdAction" href="#" data-wa-template="${attr(photo)}">${isEs ? "Prioridad fotografia" : "Photography priority"}</a>
      <a class="mbwWaBirdAction" href="#" data-wa-template="${attr(family)}">${isEs ? "Tour para mi grupo" : "Tour for my group"}</a>
    </div>
  </div>
</div>`;
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
  function routeSummary(){
    var routes = {};
    selected.forEach(function(bird){ routes[routeName(bird)] = (routes[routeName(bird)] || 0) + 1; });
    return Object.keys(routes).map(function(route){ return route + " (" + routes[route] + ")"; }).join("; ");
  }

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
      item.innerHTML = "<div><strong>" + birdName(bird) + "</strong><span>" + routeName(bird) + " - " + prettyDifficulty(bird.targetDifficulty) + "</span></div><button type='button' aria-label='Remove'>x</button>";
      item.querySelector("button").addEventListener("click", function(){ toggleBird(bird.speciesCode, false); });
      list.appendChild(item);
    });
    renderPreview();
    updateFormFields();
  }

  function renderSearchSuggestions(query){
    var box = document.querySelector("[data-search-suggestions]");
    if(!box) return;
    var q = String(query || "").trim().toLowerCase();
    if(q.length < 2){
      box.classList.remove("is-visible");
      box.innerHTML = "";
      return;
    }
    var hits = DATA.birds.filter(function(bird){
      return [bird.englishName, bird.spanishName, bird.scientificName, bird.speciesCode].join(" ").toLowerCase().includes(q);
    }).slice(0, 7);
    if(!hits.length){
      box.classList.remove("is-visible");
      box.innerHTML = "";
      return;
    }
    box.innerHTML = hits.map(function(bird){
      return "<button type='button' data-suggest-species='" + bird.speciesCode + "'><strong>" + birdName(bird) + "</strong><small>" + bird.speciesCode + " - " + routeName(bird) + "</small></button>";
    }).join("");
    box.classList.add("is-visible");
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
    var routeText = routeSummary();
    preview.textContent = PAGE_LANG === "es"
      ? "Tus aves objetivo apuntan a estas zonas de ruta: " + routeText + "."
      : "Your target birds point toward these route areas: " + routeText + ".";
  }

  function prettyDifficulty(value){
    var map = PAGE_LANG === "es"
      ? { easy:"Facil", moderate:"Moderado", hard:"Dificil", specialist:"Especialista" }
      : { easy:"Easy", moderate:"Moderate", hard:"Hard", specialist:"Specialist" };
    return map[value] || value || "";
  }

  function titleCaseName(value){
    return String(value || "")
      .replace(/\\s+/g, " ")
      .trim()
      .split(" ")
      .map(function(part){
        return part.split("-").map(function(piece){
          if(!piece) return "";
          if(piece.length <= 2 && piece === piece.toUpperCase()) return piece;
          return piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase();
        }).join("-");
      })
      .join(" ");
  }

  function formatNameInput(input){
    if(!input) return;
    var formatted = titleCaseName(input.value);
    if(formatted && formatted !== input.value) input.value = formatted;
  }

  function renderGuestReport(){
    var report = document.querySelector("[data-guest-report]");
    if(!report) return;
    if(!selected.size){
      report.classList.remove("is-visible");
      report.innerHTML = "";
      return;
    }
    var routes = {};
    selected.forEach(function(bird){
      var rn = routeName(bird);
      if(!routes[rn]) routes[rn] = [];
      routes[rn].push(birdName(bird));
    });
    var birdItems = Array.from(selected.values()).slice(0, 8).map(function(bird){
      return "<li><strong>" + birdName(bird) + "</strong> - " + prettyDifficulty(bird.targetDifficulty) + "; " + routeName(bird) + "</li>";
    }).join("");
    var routeItems = Object.keys(routes).map(function(route){
      return "<li><strong>" + route + "</strong>: " + routes[route].length + (PAGE_LANG === "es" ? " objetivo(s)" : " target(s)") + "</li>";
    }).join("");
    report.classList.add("is-visible");
    report.innerHTML = PAGE_LANG === "es"
      ? "<h3>Vista previa de oportunidad</h3><p>Gracias. Con base en tu lista, estas son las aves y zonas que revisaremos antes de recomendar una ruta privada.</p><ul>" + birdItems + "</ul><p><strong>Enfoque de ruta sugerido:</strong></p><ul>" + routeItems + "</ul><p>Este no es una garantia; es una referencia inicial para preparar la mejor oportunidad de observacion.</p>"
      : "<h3>Target Bird Opportunity Preview</h3><p>Thanks. Based on your list, these are the birds and route areas we will review before recommending a private route.</p><ul>" + birdItems + "</ul><p><strong>Suggested route focus:</strong></p><ul>" + routeItems + "</ul><p>This is not a guarantee; it is an initial planning reference for the best birding opportunity.</p>";
  }

  function guestReportPlainText(){
    if(!selected.size){
      return PAGE_LANG === "es"
        ? "Selecciona aves objetivo para generar una vista previa."
        : "Select target birds to generate a preview.";
    }
    var lines = [];
    var nameField = document.querySelector("input[name='first_name']");
    var visitor = nameField && nameField.value ? nameField.value.trim() : "";
    if(PAGE_LANG === "es"){
      lines.push("Vista previa de oportunidad de aves objetivo");
      if(visitor) lines.push("Hola " + visitor + ",");
      lines.push("");
      lines.push("Gracias. Con base en tu lista, estas son las aves y zonas que revisaremos antes de recomendar una ruta privada:");
    } else {
      lines.push("Target Bird Opportunity Preview");
      if(visitor) lines.push("Hi " + visitor + ",");
      lines.push("");
      lines.push("Thanks. Based on your list, these are the birds and route areas we will review before recommending a private route:");
    }
    selected.forEach(function(bird){
      lines.push("- " + birdName(bird) + ": " + prettyDifficulty(bird.targetDifficulty) + "; " + routeName(bird));
    });
    lines.push("");
    lines.push((PAGE_LANG === "es" ? "Enfoque de ruta sugerido: " : "Suggested route focus: ") + routeSummary() + ".");
    lines.push("");
    lines.push(PAGE_LANG === "es"
      ? "Esto no es una garantia; es una referencia inicial para preparar la mejor oportunidad de observacion."
      : "This is not a guarantee; it is an initial planning reference for the best birding opportunity.");
    return lines.join("\\n");
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
    renderGuestReport();
  }

  function buildPayload(){
    var form = document.querySelector("[data-lead-form]");
    if(form){
      formatNameInput(form.querySelector("input[name='first_name']"));
      formatNameInput(form.querySelector("input[name='last_name']"));
    }
    var fd = form ? new FormData(form) : new FormData();
    var firstName = String(fd.get("first_name") || "").trim();
    var lastName = String(fd.get("last_name") || "").trim();
    var startDate = String(fd.get("start_date") || "").trim();
    var days = String(fd.get("birding_days") || "").trim();
    var requestedDates = startDate ? (startDate + (days ? " / " + days + " day(s)" : "")) : "";
    return {
      visitor_name: [firstName, lastName].filter(Boolean).join(" "),
      first_name: firstName,
      last_name: lastName,
      visitor_email: String(fd.get("visitor_email") || ""),
      visitor_whatsapp: String(fd.get("visitor_whatsapp") || ""),
      preferred_language: PAGE_LANG,
      requested_dates: requestedDates,
      start_date: startDate,
      birding_days: days,
      group_size: String(fd.get("group_size") || ""),
      fitness_level: String(fd.get("fitness_level") || ""),
      photography_priority: String(fd.get("photography_priority") || ""),
      target_notes: String(fd.get("target_notes") || ""),
      source_page: window.location.pathname,
      speciesCodes: Array.from(selected.keys())
    };
  }

  function updateFormFields(){
    var form = document.querySelector("[data-lead-form]");
    if(!form) return;
    var codes = Array.from(selected.keys());
    var names = Array.from(selected.values()).map(function(bird){ return bird.englishName + " (" + bird.speciesCode + ")"; });
    var codeField = form.querySelector("input[name='selected_species_codes']");
    var nameField = form.querySelector("input[name='selected_species_names']");
    var sourceField = form.querySelector("input[name='source_page']");
    var uaField = form.querySelector("input[name='user_agent']");
    var requestedDatesField = form.querySelector("input[name='requested_dates']");
    var startDateField = form.querySelector("input[name='start_date']");
    var daysField = form.querySelector("select[name='birding_days']");
    if(codeField) codeField.value = codes.join(",");
    if(nameField) nameField.value = names.join("; ");
    if(sourceField) sourceField.value = window.location.href;
    if(uaField) uaField.value = navigator.userAgent || "";
    if(requestedDatesField){
      var startDate = startDateField ? startDateField.value : "";
      var days = daysField ? daysField.value : "";
      requestedDatesField.value = startDate ? (startDate + (days ? " / " + days + " day(s)" : "")) : "";
    }
  }

  function showFormMessage(kind, text){
    var success = document.getElementById("targetFormSuccess");
    var error = document.getElementById("targetFormError");
    if(success) success.style.display = kind === "success" ? "block" : "none";
    if(error){
      if(text) error.textContent = text;
      error.style.display = kind === "error" ? "block" : "none";
    }
  }

  document.addEventListener("input", function(event){
    var search = event.target.closest("[data-filter-search]");
    if(search){
      filters.search = search.value || "";
      renderSearchSuggestions(filters.search);
      track("target_search", { query_length: filters.search.length });
      applyFilters();
    }
  });

  document.addEventListener("blur", function(event){
    if(event.target && event.target.matches("input[data-name-field]")) formatNameInput(event.target);
  }, true);

  document.addEventListener("change", function(event){
    var select = event.target.closest("[data-filter-select]");
    if(select){ filters[select.getAttribute("data-filter-select")] = select.value || ""; applyFilters(); }
    if(event.target.matches("input[name='start_date'], select[name='birding_days']")) updateFormFields();
  });

  document.addEventListener("click", function(event){
    var selectButton = event.target.closest("[data-select-species]");
    if(selectButton){ toggleBird(selectButton.getAttribute("data-select-species")); return; }

    var suggestion = event.target.closest("[data-suggest-species]");
    if(suggestion){
      var code = suggestion.getAttribute("data-suggest-species");
      toggleBird(code, true);
      var searchInput = document.querySelector("[data-filter-search]");
      var box = document.querySelector("[data-search-suggestions]");
      if(searchInput) searchInput.value = "";
      filters.search = "";
      if(box){ box.classList.remove("is-visible"); box.innerHTML = ""; }
      applyFilters();
      return;
    }

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
      showFormMessage("success");
      track("target_form_submit", {
        selected_count: payload.speciesCodes.length,
        has_email: Boolean(payload.visitor_email),
        has_whatsapp: Boolean(payload.visitor_whatsapp)
      });
      var output = document.querySelector("[data-payload-preview]");
      if(output) output.textContent = JSON.stringify(payload, null, 2);
      renderGuestReport();
      return;
    }

    var copy = event.target.closest("[data-copy-guest-report]");
    if(copy){
      renderGuestReport();
      var text = guestReportPlainText();
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(function(){
          copy.textContent = PAGE_LANG === "es" ? "Copiado" : "Copied";
          window.setTimeout(function(){ copy.textContent = PAGE_LANG === "es" ? "Copiar vista previa" : "Copy preview"; }, 1600);
        });
      }
      track("target_preview_copy", { selected_count: selected.size });
      return;
    }
  });

  document.addEventListener("submit", function(event){
    var form = event.target.closest("[data-lead-form]");
    if(!form) return;
    formatNameInput(form.querySelector("input[name='first_name']"));
    formatNameInput(form.querySelector("input[name='last_name']"));
    updateFormFields();
    if(!selected.size){
      event.preventDefault();
      showFormMessage("error", PAGE_LANG === "es"
        ? "Selecciona al menos una especie objetivo antes de solicitar revision."
        : "Select at least one target species before requesting review.");
      track("target_form_blocked", { reason: "no_species_selected" });
      return;
    }
    var submitButton = form.querySelector("[data-submit-request]");
    if(submitButton){
      submitButton.disabled = true;
      submitButton.textContent = PAGE_LANG === "es" ? "Enviando..." : "Sending...";
      window.setTimeout(function(){
        submitButton.disabled = false;
        submitButton.textContent = PAGE_LANG === "es" ? "Solicitar revision del guia" : "Request Guide Review";
      }, 6000);
    }
    showFormMessage("success");
    track("target_guide_review_submit", {
      selected_count: selected.size,
      has_email: Boolean(form.querySelector("input[name='visitor_email']") && form.querySelector("input[name='visitor_email']").value),
      has_whatsapp: Boolean(form.querySelector("input[name='visitor_whatsapp']") && form.querySelector("input[name='visitor_whatsapp']").value)
    });
  });

  window.addEventListener("message", function(event){
    var data = event.data || {};
    if(!data || data.type !== "mbw-target-bird") return;
    var form = document.querySelector("[data-lead-form]");
    var submitButton = form ? form.querySelector("[data-submit-request]") : null;
    if(submitButton){
      submitButton.disabled = false;
      submitButton.textContent = PAGE_LANG === "es" ? "Solicitar revision del guia" : "Request Guide Review";
    }
    if(data.status === "ok"){
      showFormMessage("success", "");
      track("target_guide_review_success", { selected_count: selected.size });
    } else {
      showFormMessage("error", data.message || (PAGE_LANG === "es" ? "No pudimos enviar la solicitud. Intenta de nuevo o usa WhatsApp." : "We could not send the request. Please try again or use WhatsApp."));
      track("target_guide_review_error", { message: data.message || "unknown" });
    }
  });

  document.addEventListener("DOMContentLoaded", function(){
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, "0");
    var dd = String(today.getDate()).padStart(2, "0");
    var minDate = yyyy + "-" + mm + "-" + dd;
    document.querySelectorAll("input[type='date'][name='start_date']").forEach(function(input){ input.min = minDate; });
    var count = document.querySelector("[data-result-count]");
    if(count) count.textContent = String(DATA.birds.length);
    renderSelected();
    updateFormFields();
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
<script async defer src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
${pageCss()}
<script type="application/ld+json">${JSON.stringify(schemaGraph(lang, data), null, 2)}</script>
</head>
<body data-page-content-group="birding_tours" data-page-language="${isEs ? "es" : "en"}" data-page-location="mindo" data-page-region="mindo_cloud_forest" data-page-type="target_bird_tour_builder">
<div class="container">
<div id="siteHeader" data-current-lang="${isEs ? "es" : "en"}">${renderHeaderFallback(lang)}</div>
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
  <div class="targetHeroMedia">
    <img src="${attr(HERO_IMAGE)}" alt="${isEs ? "Aves en una ruta de avistamiento en Mindo" : "Birds on a Mindo birdwatching route"}" loading="eager" decoding="async">
    <p class="targetHeroCap">${isEs ? "Usa tu lista de aves objetivo para preparar una ruta privada mas inteligente." : "Use your target bird list to prepare a smarter private route."}</p>
  </div>
</section>
<section class="targetMiniReport" aria-label="${isEs ? "Como funciona" : "How it works"}">
  <h2>${isEs ? "Como funciona" : "How it works"}</h2>
  <ul>
    <li>${isEs ? "Selecciona aves objetivo." : "Select target birds."}</li>
    <li>${isEs ? "Comparte fechas, grupo e intereses." : "Share dates, group size, and interests."}</li>
    <li>${isEs ? "Recibe una vista previa y solicita revision del guia." : "See a preview and request guide review."}</li>
  </ul>
  <p class="trustNote">${isEs ? "No usamos lenguaje de garantia. El reporte se basa en actividad reciente y conocimiento local." : "No guarantee language. The report uses recent activity and local route knowledge."}</p>
</section>

<section class="builderShell" id="builder">
  <aside class="filterPanel" aria-label="${isEs ? "Filtros" : "Filters"}">
    <h2>${isEs ? "Filtrar aves" : "Filter Birds"}</h2>
    <div class="filterStack">
      <label class="filterField searchField"><span>${isEs ? "Buscar" : "Search"}</span><input type="search" data-filter-search autocomplete="off" placeholder="${isEs ? "Nombre, especie, codigo..." : "Name, species, code..."}"><div class="searchSuggestions" data-search-suggestions></div></label>
      ${renderSelect("group", taxonOptions, lang, "Bird group", "Grupo de ave")}
      ${renderSelect("difficulty", difficultyOptions, lang, "Target difficulty", "Dificultad")}
      ${renderSelect("tourFit", tourOptions, lang, "Tour fit", "Tipo de tour")}
      ${renderRouteSelect(data.routes.filter((route) => data.birds.some((bird) => bird.routeCluster === route.id)), lang)}
      ${renderSelect("photography", photoOptions, lang, "Photography", "Fotografia")}
      <div class="quickToggles" aria-label="${isEs ? "Filtros rapidos" : "Quick filters"}">
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
    <div class="selectedGrid">
      <div class="stack-sm">
        <p class="trustNote" data-selected-empty>${isEs ? "Selecciona aves para construir tu reporte preliminar." : "Select birds to build your preliminary report."}</p>
        <div class="selectedList" data-selected-list></div>
        <div class="previewBox">
          <h3>${isEs ? "Vista previa" : "Preview"}</h3>
          <p data-preview-text></p>
        </div>
        <div class="guestReport" data-guest-report></div>
        <div class="previewActions"><button class="copyBtn" type="button" data-copy-guest-report>${isEs ? "Copiar vista previa" : "Copy preview"}</button></div>
        <pre class="payloadPreview" data-payload-preview></pre>
      </div>
      <div>
        <iframe aria-hidden="true" id="targetBirdHiddenFrame" name="targetBirdHiddenFrame" style="position:absolute; left:-9999px; width:1px; height:1px; border:0;" tabindex="-1"></iframe>
        <form action="/api/target-bird-tour-builder" class="leadForm" data-lead-form id="targetBirdForm" method="post" target="targetBirdHiddenFrame">
          <div class="twoCol">
            <label><span class="labelText">${isEs ? "Nombre" : "First Name"}<span class="req">*</span></span><input name="first_name" data-name-field autocomplete="given-name" autocapitalize="words" autocorrect="off" spellcheck="false" required placeholder="${isEs ? "Nombre" : "First name"}"></label>
            <label><span class="labelText">${isEs ? "Apellido" : "Last Name"}<span class="req">*</span></span><input name="last_name" data-name-field autocomplete="family-name" autocapitalize="words" autocorrect="off" spellcheck="false" required placeholder="${isEs ? "Apellido" : "Last name"}"></label>
          </div>
          <div class="twoCol">
            <label><span class="labelText">Email<span class="req">*</span></span><input name="visitor_email" autocomplete="email" required type="email" placeholder="you@example.com"></label>
            <label><span class="labelText">WhatsApp</span><input name="visitor_whatsapp" autocomplete="tel" inputmode="tel" placeholder="+1 123 456 7890"></label>
          </div>
          <div class="twoCol">
            <label><span class="labelText">${isEs ? "Fecha de inicio" : "Start date"}</span><input name="start_date" type="date"></label>
            <label><span class="labelText">${isEs ? "Dias de observacion" : "Birding days"}</span><select name="birding_days"><option value="">${isEs ? "Seleccionar" : "Select"}</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7+">7+</option></select></label>
          </div>
          <div class="twoCol">
            <label><span class="labelText">${isEs ? "Personas" : "Group size"}</span><select name="group_size"><option value="">${isEs ? "Seleccionar" : "Select"}</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9+">9+</option></select></label>
            <label><span class="labelText">${isEs ? "Contacto preferido" : "Preferred contact"}</span><select name="preferred_contact_method"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="either">${isEs ? "Cualquiera" : "Either"}</option></select></label>
          </div>
          <div class="twoCol">
            <label><span class="labelText">${isEs ? "Condicion fisica" : "Fitness level"}</span><select name="fitness_level"><option value="moderate">${isEs ? "Moderada" : "Moderate"}</option><option value="easy">${labels.easy}</option><option value="hard">${labels.hard}</option></select></label>
            <label><span class="labelText">${isEs ? "Fotografia" : "Photography priority"}</span><select name="photography_priority"><option value="medium">${isEs ? "Media" : "Medium"}</option><option value="high">${isEs ? "Alta" : "High"}</option><option value="primary_goal">${isEs ? "Objetivo principal" : "Main goal"}</option></select></label>
          </div>
          <label><span class="labelText">${isEs ? "Notas" : "Notes"}</span><textarea name="target_notes" placeholder="${isEs ? "Notas, fechas flexibles o aves adicionales" : "Notes, flexible dates, or extra target birds"}"></textarea></label>
          <input name="preferred_language" type="hidden" value="${isEs ? "es" : "en"}">
          <input name="requested_dates" type="hidden" value="">
          <input name="source_page" type="hidden" value="">
          <input name="user_agent" type="hidden" value="">
          <input name="selected_species_codes" type="hidden" value="">
          <input name="selected_species_names" type="hidden" value="">
          <div class="cf-turnstile" data-sitekey="0x4AAAAAACYIFF7ZNXiqieGk"></div>
          <div class="heroActions">
            <button class="btn primary" type="button" data-preview-submit>${isEs ? "Crear vista previa" : "Build Preview"}</button>
            <button class="btn secondary" type="submit" data-submit-request>${isEs ? "Solicitar revision del guia" : "Request Guide Review"}</button>
            <a class="btn secondary" href="#targetBirdForm" data-whatsapp-message-key="${isEs ? "book_tour_es" : "book_tour_en"}" data-analytics-event="tour_whatsapp_click" data-analytics-link-url="dynamic_whatsapp" data-analytics-label="${isEs ? "Mensaje por WhatsApp" : "Message on WhatsApp"}" data-analytics-location="target_builder_form" data-analytics-page-language="${isEs ? "es" : "en"}" data-analytics-page-type="target_bird_tour_builder" rel="noopener noreferrer" target="_blank">WhatsApp</a>
          </div>
          <p class="buttonHelp">${isEs ? "Crear vista previa actualiza el resumen en esta pagina. Solicitar revision envia tu lista a MBW y dispara el flujo interno. WhatsApp abre una conversacion directa si prefieres escribirnos." : "Build Preview updates the summary on this page. Request Guide Review sends your list to MBW and starts the internal workflow. WhatsApp opens a direct conversation if you prefer to message us."}</p>
          <p class="trustNote">${isEs ? "Este formulario usa Cloudflare Turnstile para reducir bots. El reporte final sera revisado por MBW." : "This form uses Cloudflare Turnstile to reduce bots. The final report is reviewed by MBW."}</p>
          <div class="success" id="targetFormSuccess">${isEs ? "Solicitud preparada. Revisaremos tus aves objetivo." : "Request prepared. We will review your target birds."}</div>
          <div class="errorMsg" id="targetFormError">${isEs ? "Selecciona al menos una especie objetivo antes de solicitar revision." : "Select at least one target species before requesting review."}</div>
        </form>
      </div>
    </div>
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
<div id="siteFooter">${renderFooterFallback(lang)}</div>
</div>
<div class="mobileSticky"><a class="btn primary" href="#builder"><span data-selected-count>0</span> ${isEs ? "seleccionadas" : "selected"}</a><button class="btn secondary" type="button" data-preview-submit>${isEs ? "Vista previa" : "Preview"}</button></div>
${renderWhatsAppFab(lang)}
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
