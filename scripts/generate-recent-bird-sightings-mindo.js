#!/usr/bin/env node

/*
  Mindo Bird Watching - Recent Bird Sightings Pages

  Generates:
    /birding/recent-bird-sightings-mindo/index.html
    /es/birding/avistamientos-recientes-mindo/index.html
    /functions/api/recent-bird-sightings/index.js
    Google Sheet TSV header files

  This is the first static + n8n-ready build. It does not fake live sightings.
  The page uses MBW route/species data as a watchlist and the request form
  sends guests into a workflow that can refresh eBird and write snapshot tabs.
*/

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://mindobirdwatching.com";
const SHEET_ID = "1FGmAm92kMYIMCLjGL_m-OOaUmD6og_mvsKcTIGs_GJE";

const OUT_DIR = process.env.RECENT_SIGHTINGS_OUT_DIR ||
  path.join(process.cwd(), "outputs", "upload-recent-bird-sightings-mindo");
const HEADERS_DIR = path.join(process.cwd(), "outputs", "recent-bird-sightings-sheet-headers");

const EN_PATH = "/birding/recent-bird-sightings-mindo/";
const ES_PATH = "/es/birding/avistamientos-recientes-mindo/";
const HERO_IMAGE = "/assets/images/pages/tours/full-day/MBW-Assets-65-Tours-FD-Carousel.jpg";
const OG_IMAGE = HERO_IMAGE;
const LOGO_IMAGE = "/assets/images/logo/mbw-logo-mark-1024.png";
const PLACEHOLDER_IMAGE = "/assets/images/pages/tours/full-day/MBW-Assets-65-Tours-FD-Carousel.jpg";

const SOURCES = {
  speciesCore: process.env.SPECIES_CORE_CSV ||
    "/Users/juangranda/Downloads/mbw_custom_tour_builder - species_core (2).csv",
  speciesMedia: process.env.SPECIES_MEDIA_CSV ||
    "/Users/juangranda/Downloads/mbw_custom_tour_builder - species_media (3).csv",
  speciesTourBuilder: process.env.SPECIES_TOUR_BUILDER_CSV ||
    "/Users/juangranda/Downloads/mbw_custom_tour_builder - species_tour_builder (8).csv",
  routeClusters: process.env.ROUTE_CLUSTERS_CSV ||
    "/Users/juangranda/Downloads/mbw_custom_tour_builder - route_clusters (3).csv"
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
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => clean(cell) !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => clean(cell) !== "")) rows.push(row);
  return rows;
}

function parseRows(text, source) {
  const delimiter = source.endsWith(".tsv") ? "\t" : ",";
  const rows = parseDelimited(text.replace(/^\uFEFF/, ""), delimiter);
  const headers = rows.shift() || [];
  return rows.map((row) => {
    const out = {};
    headers.forEach((header, index) => {
      out[clean(header)] = clean(row[index]);
    });
    return out;
  });
}

function readRows(source) {
  return parseRows(fs.readFileSync(source, "utf8"), source);
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
    custom_private: "Custom Private",
    custom_only: "Custom Private",
    multi_day: "Multi-Day",
    easy: "Easy",
    moderate: "Moderate",
    hard: "Hard",
    specialist: "Specialist",
    dawn: "Dawn",
    early_morning: "Early Morning",
    morning: "Morning"
  };
  const es = {
    half_day: "Medio Dia",
    full_day: "Dia Entero",
    custom_private: "Privado Personalizado",
    custom_only: "Privado Personalizado",
    multi_day: "Varios Dias",
    easy: "Facil",
    moderate: "Moderado",
    hard: "Dificil",
    specialist: "Especialista",
    dawn: "Amanecer",
    early_morning: "Temprano",
    morning: "Manana"
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

function buildData() {
  const coreRows = readRows(SOURCES.speciesCore);
  const mediaRows = readRows(SOURCES.speciesMedia);
  const tourRows = readRows(SOURCES.speciesTourBuilder);
  const routeRows = readRows(SOURCES.routeClusters);

  const coreByCode = indexBy(coreRows, "speciesCode");
  const mediaByCode = indexBy(mediaRows, "speciesCode");
  const routeById = indexBy(routeRows, "route_cluster_id");

  const routes = routeRows
    .filter((route) => bool(route.active) || clean(route.active) === "")
    .map((route) => ({
      id: clean(route.route_cluster_id),
      nameEn: clean(route.route_cluster_name_en),
      nameEs: clean(route.route_cluster_name_es),
      baseTourType: clean(route.base_tour_type),
      startTime: clean(route.recommended_start_time),
      duration: clean(route.typical_duration_hours),
      habitats: clean(route.primary_habitats),
      notesEn: clean(route.notes_en),
      notesEs: clean(route.notes_es)
    }));

  const birds = tourRows
    .filter((tour) => bool(tour.target_species) && bool(tour.active))
    .map((tour) => {
      const code = clean(tour.speciesCode);
      const core = coreByCode.get(code);
      if (!core) return null;
      const route = routeById.get(clean(tour.route_cluster_primary));
      const media = mediaByCode.get(code) || {};
      return {
        speciesCode: code,
        englishName: clean(core.english_name) || clean(tour.english_name),
        spanishName: clean(core.spanish_name) || clean(tour.spanish_name) || clean(core.english_name),
        scientificName: clean(core.scientific_name) || clean(tour.scientific_name),
        family: clean(core.family),
        image: safeImage(media),
        imageAltEn: clean(media.image_alt_en) || `${clean(core.english_name)} in Mindo`,
        imageAltEs: clean(media.image_alt_es) || `${clean(core.spanish_name) || clean(core.english_name)} en Mindo`,
        routeCluster: clean(tour.route_cluster_primary),
        routeNameEn: routeLabel(route, "en"),
        routeNameEs: routeLabel(route, "es"),
        hotspot: clean(tour.primary_hotspot_name),
        difficulty: clean(tour.target_difficulty) || "to_review",
        photographyDifficulty: clean(tour.photography_difficulty) || "to_review",
        tourFit: clean(tour.tour_fit),
        bestTime: clean(tour.best_time_of_day),
        habitat: [clean(tour.habitat_primary), clean(tour.habitat_secondary)].filter(Boolean).join(", "),
        reliability: Number(clean(tour.reliability_score_manual)) || 50,
        rarity: Number(clean(tour.rarity_score_manual)) || 50,
        photoScore: Number(clean(tour.photography_score_manual)) || 50,
        iconic: bool(tour.iconic_species),
        priority: clean(tour.custom_tour_priority)
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const order = { signature: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9) ||
        Number(b.iconic) - Number(a.iconic) ||
        b.reliability - a.reliability ||
        a.englishName.localeCompare(b.englishName);
    });

  return { routes, birds };
}

function routeCounts(data) {
  const counts = new Map();
  data.birds.forEach((bird) => {
    counts.set(bird.routeCluster, (counts.get(bird.routeCluster) || 0) + 1);
  });
  return counts;
}

function topBirds(data, count = 12) {
  return data.birds
    .filter((bird) => bird.iconic || bird.priority === "signature" || bird.priority === "high")
    .slice(0, count);
}

function routeWatchlist(data, routeId, count = 4) {
  return data.birds
    .filter((bird) => bird.routeCluster === routeId)
    .sort((a, b) => Number(b.iconic) - Number(a.iconic) || b.reliability - a.reliability)
    .slice(0, count);
}

function renderHeaderFallback(lang) {
  const isEs = lang === "es";
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
  <a class="brand" href="${isEs ? "/es/" : "/"}" aria-label="Mindo Bird Watching">
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
</header>`;
}

function renderFooterFallback(lang) {
  const isEs = lang === "es";
  return `
<footer class="footer recentSightingsFallbackFooter" aria-label="Footer">
  <div class="footer-social" aria-label="${isEs ? "Redes sociales" : "Social media links"}">
    <a href="https://www.instagram.com/mindobirdwatching" target="_blank" rel="noopener" aria-label="Instagram"><img src="/assets/images/icons/mbw_ig.png" alt="Instagram" loading="lazy"></a>
    <a href="https://www.tiktok.com/@mindobirdwatching" target="_blank" rel="noopener" aria-label="TikTok"><img src="/assets/images/icons/mbw_tt.png" alt="TikTok" loading="lazy"></a>
    <a href="https://www.facebook.com/profile.php?id=61577783327957" target="_blank" rel="noopener" aria-label="Facebook"><img src="/assets/images/icons/mbw_fb.png" alt="Facebook" loading="lazy"></a>
    <a href="https://www.youtube.com/@MindoBirdWatching" target="_blank" rel="noopener" aria-label="YouTube"><img src="/assets/images/icons/mbw_yt.png" alt="YouTube" loading="lazy"></a>
    <a href="https://wa.me/13054585402" target="_blank" rel="noopener" aria-label="WhatsApp"><img src="/assets/images/icons/mbw_wa.png" alt="WhatsApp" loading="lazy"></a>
    <a href="https://g.page/r/CdMlIYMGgBIvEAE/review" target="_blank" rel="noopener" aria-label="Google Review"><img src="/assets/images/icons/mbw_gr.png" alt="Google Review" loading="lazy"></a>
  </div>
  <div class="footer-bottom">
    <img src="${attr(LOGO_IMAGE)}" alt="" loading="lazy">
    <small>Mindo Bird Watching © 2026</small>
  </div>
</footer>`;
}

function renderWhatsAppFab(lang) {
  const isEs = lang === "es";
  const primary = isEs
    ? "Hola Mindo Bird Watching, quiero revisar avistamientos recientes para planificar un tour privado en Mindo. Pagina: {url}"
    : "Hi Mindo Bird Watching, I want to review recent bird sightings for a private tour in Mindo. Page: {url}";
  return `
<div class="mbwWaBirdFab" data-wa-number="13054585402" data-wa-img-desktop="/assets/images/icons/mbw_lorito_final_003.png" data-wa-img-mobile="/assets/images/icons/mbw_lorito_final_004.png" aria-label="WhatsApp contact">
  <div class="mbwWaBirdBackdrop" aria-hidden="true"></div>
  <button class="mbwWaBirdBtn" type="button" aria-label="${isEs ? "Abrir WhatsApp" : "Open WhatsApp"}" aria-haspopup="dialog" aria-expanded="false">
    <img class="mbwWaBirdImg" src="/assets/images/icons/mbw_lorito_final_003.png" alt="Chat on WhatsApp" loading="lazy" decoding="async">
  </button>
  <div class="mbwWaBirdPanel" role="dialog" aria-label="WhatsApp">
    <div class="mbwWaBirdHead">
      <div class="mbwWaBirdTitle">${isEs ? "Escribenos por WhatsApp" : "Message us on WhatsApp"}</div>
      <button class="mbwWaBirdClose" type="button" aria-label="${isEs ? "Cerrar" : "Close"}">x</button>
    </div>
    <div class="mbwWaBirdActions">
      <a class="mbwWaBirdAction" href="#" data-wa-template="${attr(primary)}">${isEs ? "Revisar avistamientos recientes" : "Review recent sightings"}</a>
    </div>
  </div>
</div>`;
}

function pageCss() {
  return `<style>
body[data-page-type="recent_bird_sightings_mindo"]{--rs-bg:var(--bg,#C7DAAC);--rs-forest:var(--forest,#0D5925);--rs-ink:var(--ink,#071923);--rs-muted:var(--muted,rgba(7,25,35,.72));--rs-card:var(--card,rgba(255,255,255,.72));--rs-line:var(--line,rgba(7,25,35,.14));--rs-radius:var(--r,18px);--rs-shadow:var(--shadow,0 18px 55px rgba(7,25,35,.10));--rs-head:var(--font-head,Georgia,"Times New Roman",serif);--rs-body:var(--font-body,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif)}
body[data-page-type="recent_bird_sightings_mindo"] .recentPage{margin-top:18px;padding:0;overflow:hidden;background:var(--rs-card);border:1px solid var(--rs-line);border-radius:var(--rs-radius);box-shadow:var(--rs-shadow)}
body[data-page-type="recent_bird_sightings_mindo"] .btn,body[data-page-type="recent_bird_sightings_mindo"] button.btn,body[data-page-type="recent_bird_sightings_mindo"] a.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:11px 14px;border-radius:14px;border:1px solid var(--rs-line);font-family:var(--rs-body);font-weight:900;text-decoration:none;cursor:pointer;box-sizing:border-box;line-height:1.15}
body[data-page-type="recent_bird_sightings_mindo"] .btn.primary{background:rgba(13,89,37,.94);border-color:rgba(13,89,37,.45);color:#fff}
body[data-page-type="recent_bird_sightings_mindo"] .btn.secondary{background:rgba(255,255,255,.78);border-color:rgba(13,89,37,.28);color:var(--rs-forest)}
body[data-page-type="recent_bird_sightings_mindo"] .recentHero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr);gap:16px;align-items:stretch;padding:18px;background:linear-gradient(135deg,rgba(255,255,255,.78),rgba(255,255,255,.50))}
body[data-page-type="recent_bird_sightings_mindo"] .heroCopy,body[data-page-type="recent_bird_sightings_mindo"] .heroMedia,body[data-page-type="recent_bird_sightings_mindo"] .miniPanel,body[data-page-type="recent_bird_sightings_mindo"] .watchCard,body[data-page-type="recent_bird_sightings_mindo"] .routeCard,body[data-page-type="recent_bird_sightings_mindo"] .leadPanel,body[data-page-type="recent_bird_sightings_mindo"] .infoBox{border:1px solid var(--rs-line);border-radius:var(--rs-radius);background:rgba(255,255,255,.68);box-shadow:var(--rs-shadow)}
body[data-page-type="recent_bird_sightings_mindo"] .heroCopy{padding:26px;display:grid;align-content:center;gap:14px;min-height:0}
body[data-page-type="recent_bird_sightings_mindo"] .heroMedia{overflow:hidden;display:grid;grid-template-rows:minmax(0,1fr) auto;background:#eef4ea}
body[data-page-type="recent_bird_sightings_mindo"] .heroMedia img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
body[data-page-type="recent_bird_sightings_mindo"] .heroCap{padding:10px 12px;border-top:1px solid var(--rs-line);background:rgba(255,255,255,.74);font-size:.82rem;line-height:1.45;color:var(--rs-muted);margin:0}
body[data-page-type="recent_bird_sightings_mindo"] .eyebrow{display:inline-flex;width:fit-content;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.82);color:var(--forest);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
body[data-page-type="recent_bird_sightings_mindo"] .eyebrow:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--forest);display:inline-block}
body[data-page-type="recent_bird_sightings_mindo"] h1{margin:0;color:var(--rs-forest);font-size:clamp(2rem,4.2vw,3.55rem);line-height:1.04;letter-spacing:-.025em;max-width:760px}
body[data-page-type="recent_bird_sightings_mindo"] h2,body[data-page-type="recent_bird_sightings_mindo"] h3{color:var(--rs-forest);margin:0}
body[data-page-type="recent_bird_sightings_mindo"] p{line-height:1.58}
body[data-page-type="recent_bird_sightings_mindo"] .heroCopy p{margin:0;max-width:72ch;color:var(--rs-ink);font-size:1rem;line-height:1.68}
body[data-page-type="recent_bird_sightings_mindo"] .heroActions{display:flex;gap:10px;flex-wrap:wrap}
body[data-page-type="recent_bird_sightings_mindo"] .heroMetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;max-width:620px}
body[data-page-type="recent_bird_sightings_mindo"] .heroMetric{border:1px solid var(--line);background:rgba(255,255,255,.74);border-radius:14px;padding:12px}
body[data-page-type="recent_bird_sightings_mindo"] .heroMetric strong{display:block;font-size:1.55rem;color:var(--forest);line-height:1}
body[data-page-type="recent_bird_sightings_mindo"] .heroMetric span{font-size:.82rem;color:var(--muted);font-weight:800}
body[data-page-type="recent_bird_sightings_mindo"] .miniPanel{margin:0 26px 18px;padding:16px;display:grid;gap:10px}
body[data-page-type="recent_bird_sightings_mindo"] .miniPanel ul{margin:0;padding-left:18px;line-height:1.65;color:var(--rs-ink)}
body[data-page-type="recent_bird_sightings_mindo"] .pageSection{padding:18px;border-top:1px solid var(--line);display:grid;gap:16px}
body[data-page-type="recent_bird_sightings_mindo"] .sectionHeader{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
body[data-page-type="recent_bird_sightings_mindo"] .sectionHeader p{margin:.25rem 0 0;color:var(--rs-muted)}
body[data-page-type="recent_bird_sightings_mindo"] .watchGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
body[data-page-type="recent_bird_sightings_mindo"] .watchCard{overflow:hidden;display:grid;grid-template-rows:auto 1fr}
body[data-page-type="recent_bird_sightings_mindo"] .watchImage{aspect-ratio:4/3;background:rgba(13,89,37,.08);overflow:hidden}
body[data-page-type="recent_bird_sightings_mindo"] .watchImage img{width:100%;height:100%;object-fit:contain;object-position:center;display:block;background:rgba(255,255,255,.42)}
body[data-page-type="recent_bird_sightings_mindo"] .watchBody{padding:12px;display:grid;gap:7px;align-content:start}
body[data-page-type="recent_bird_sightings_mindo"] .watchTop{display:flex;justify-content:space-between;gap:8px;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:var(--forest);font-weight:900}
body[data-page-type="recent_bird_sightings_mindo"] .watchBody h3{font-family:var(--rs-body);font-size:1rem;color:var(--rs-ink);letter-spacing:0}
body[data-page-type="recent_bird_sightings_mindo"] .muted{color:var(--rs-muted);font-size:.86rem;margin:0}
body[data-page-type="recent_bird_sightings_mindo"] .routeGrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;align-items:stretch}
body[data-page-type="recent_bird_sightings_mindo"] .routeCard{padding:12px;display:grid;grid-template-rows:minmax(42px,auto) 36px minmax(38px,auto) 1fr;gap:8px;align-items:start;text-align:center;min-height:228px}
body[data-page-type="recent_bird_sightings_mindo"] .routeCard .routeName{display:flex;align-items:flex-start;justify-content:center;min-height:42px;font-weight:900;line-height:1.12;color:var(--rs-ink)}
body[data-page-type="recent_bird_sightings_mindo"] .routeCard strong{display:flex;align-items:center;justify-content:center;font-size:1.58rem;color:var(--forest);line-height:1;font-variant-numeric:tabular-nums}
body[data-page-type="recent_bird_sightings_mindo"] .routeCard small{display:flex;align-items:center;justify-content:center;min-height:38px;color:var(--muted);font-size:.76rem;line-height:1.35}
body[data-page-type="recent_bird_sightings_mindo"] .routeExamples{margin:0;padding:0 0 0 16px;color:var(--rs-muted);font-size:.82rem;line-height:1.45;text-align:left;align-self:start}
body[data-page-type="recent_bird_sightings_mindo"] .routeExamples li{margin:0 0 5px}
body[data-page-type="recent_bird_sightings_mindo"] .leadPanel{padding:16px}
body[data-page-type="recent_bird_sightings_mindo"] .leadGrid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:16px;align-items:start}
body[data-page-type="recent_bird_sightings_mindo"] .leadForm{display:grid;gap:10px}
body[data-page-type="recent_bird_sightings_mindo"] .twoCol{display:grid;grid-template-columns:1fr 1fr;gap:10px}
body[data-page-type="recent_bird_sightings_mindo"] .leadForm label{display:grid;gap:6px;min-width:0}
body[data-page-type="recent_bird_sightings_mindo"] .labelText{font-size:.78rem;font-weight:900;color:var(--ink)}
body[data-page-type="recent_bird_sightings_mindo"] .leadForm input,body[data-page-type="recent_bird_sightings_mindo"] .leadForm select,body[data-page-type="recent_bird_sightings_mindo"] .leadForm textarea{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:14px;padding:11px 12px;background:rgba(255,255,255,.78);color:var(--ink);font:inherit;box-shadow:0 10px 25px rgba(0,0,0,.05)}
body[data-page-type="recent_bird_sightings_mindo"] .leadForm input,body[data-page-type="recent_bird_sightings_mindo"] .leadForm select{height:44px}
body[data-page-type="recent_bird_sightings_mindo"] .leadForm textarea{min-height:118px;resize:vertical;line-height:1.5}
body[data-page-type="recent_bird_sightings_mindo"] .summaryBox{border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.72);padding:12px;display:grid;gap:8px}
body[data-page-type="recent_bird_sightings_mindo"] .summaryBox ul{margin:0;padding-left:18px;line-height:1.6;color:var(--rs-muted)}
body[data-page-type="recent_bird_sightings_mindo"] .success,body[data-page-type="recent_bird_sightings_mindo"] .errorMsg{display:none;padding:12px 14px;border-radius:14px;font-weight:900;font-size:.88rem;line-height:1.4}
body[data-page-type="recent_bird_sightings_mindo"] .success{border:1px solid rgba(13,89,37,.25);background:rgba(13,89,37,.10)}
body[data-page-type="recent_bird_sightings_mindo"] .errorMsg{border:1px solid rgba(160,0,0,.22);background:rgba(160,0,0,.08)}
body[data-page-type="recent_bird_sightings_mindo"] .infoGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
body[data-page-type="recent_bird_sightings_mindo"] .infoBox{padding:16px}
body[data-page-type="recent_bird_sightings_mindo"] .infoBox p{margin:8px 0 0;color:var(--muted)}
body[data-page-type="recent_bird_sightings_mindo"] .recentSightingsFallbackFooter{margin-top:18px}
@media(max-width:980px){body[data-page-type="recent_bird_sightings_mindo"] .recentHero,body[data-page-type="recent_bird_sightings_mindo"] .leadGrid{grid-template-columns:1fr}body[data-page-type="recent_bird_sightings_mindo"] .routeGrid{grid-template-columns:repeat(3,minmax(0,1fr))}body[data-page-type="recent_bird_sightings_mindo"] .watchGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){body[data-page-type="recent_bird_sightings_mindo"] .recentHero{padding:12px}body[data-page-type="recent_bird_sightings_mindo"] .heroCopy{padding:18px}body[data-page-type="recent_bird_sightings_mindo"] .heroMedia{min-height:260px}body[data-page-type="recent_bird_sightings_mindo"] .heroMetrics,body[data-page-type="recent_bird_sightings_mindo"] .watchGrid,body[data-page-type="recent_bird_sightings_mindo"] .twoCol,body[data-page-type="recent_bird_sightings_mindo"] .infoGrid{grid-template-columns:1fr}body[data-page-type="recent_bird_sightings_mindo"] .miniPanel{margin:0 12px 12px}body[data-page-type="recent_bird_sightings_mindo"] .pageSection{padding:12px}body[data-page-type="recent_bird_sightings_mindo"] .routeGrid{display:flex;overflow-x:auto;gap:9px;padding-bottom:4px;scroll-snap-type:x mandatory}body[data-page-type="recent_bird_sightings_mindo"] .routeCard{flex:0 0 168px;scroll-snap-align:start}body[data-page-type="recent_bird_sightings_mindo"] .leadForm input,body[data-page-type="recent_bird_sightings_mindo"] .leadForm select,body[data-page-type="recent_bird_sightings_mindo"] .leadForm textarea{display:block;max-width:100%;min-width:0}body[data-page-type="recent_bird_sightings_mindo"] .heroActions .btn{width:100%}}
</style>`;
}

function schemaGraph(lang, data) {
  const isEs = lang === "es";
  const pagePath = isEs ? ES_PATH : EN_PATH;
  const title = isEs
    ? "Avistamientos Recientes de Aves en Mindo"
    : "Recent Bird Sightings in Mindo";
  const description = isEs
    ? "Solicita una revision de avistamientos recientes de aves cerca de Mindo con datos de eBird y conocimiento local de rutas."
    : "Request a recent bird sightings review near Mindo using eBird activity and local route knowledge.";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": SITE_URL + pagePath + "#webpage",
        url: SITE_URL + pagePath,
        name: title,
        description,
        inLanguage: isEs ? "es" : "en",
        image: SITE_URL + OG_IMAGE
      },
      {
        "@type": "TouristTrip",
        "@id": SITE_URL + pagePath + "#recent-sightings-review",
        name: title,
        description,
        touristType: ["Birdwatchers", "Bird photographers", "Nature travelers"],
        provider: { "@type": "LocalBusiness", name: "Mindo Bird Watching", url: SITE_URL }
      },
      {
        "@type": "ItemList",
        "@id": SITE_URL + pagePath + "#route-watchlist",
        name: isEs ? "Rutas de observacion en Mindo" : "Mindo birding route watchlist",
        numberOfItems: data.routes.length
      }
    ]
  };
}

function pageScript(lang) {
  return `<script>
(function(){
  var PAGE_LANG = ${JSON.stringify(lang)};
  function track(eventName, params){
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({
      event: eventName,
      page_path: window.location.pathname,
      language: PAGE_LANG,
      page_type: "recent_bird_sightings_mindo"
    }, params || {}));
  }
  function titleCaseName(value){
    return String(value || "").replace(/\\s+/g, " ").trim().split(" ").map(function(part){
      if(!part) return "";
      return part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase();
    }).join(" ");
  }
  document.querySelectorAll("[data-name-field]").forEach(function(input){
    input.addEventListener("blur", function(){ input.value = titleCaseName(input.value); });
  });
  document.querySelectorAll("[data-route-interest]").forEach(function(button){
    button.addEventListener("click", function(){
      var route = button.getAttribute("data-route-interest");
      var input = document.querySelector("[name=route_interests]");
      if(input) input.value = route;
      track("recent_sightings_route_filter_click", { route_cluster: route });
      document.getElementById("recentSightingsForm").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll("[data-copy-summary]").forEach(function(button){
    button.addEventListener("click", function(){
      var box = document.querySelector("[data-summary-text]");
      var text = box ? box.innerText.trim() : "";
      if(navigator.clipboard && text){
        navigator.clipboard.writeText(text).then(function(){
          button.textContent = PAGE_LANG === "es" ? "Copiado" : "Copied";
          setTimeout(function(){ button.textContent = PAGE_LANG === "es" ? "Copiar resumen" : "Copy summary"; }, 1500);
        });
      }
      track("recent_sightings_copy_summary", {});
    });
  });
  document.querySelectorAll("[data-target-builder-link]").forEach(function(link){
    link.addEventListener("click", function(){ track("recent_sightings_target_builder_click", {}); });
  });
  document.querySelectorAll("[data-whatsapp-action]").forEach(function(link){
    link.addEventListener("click", function(){ track("recent_sightings_whatsapp_click", { location: "page_form" }); });
  });
  var form = document.querySelector("[data-recent-sightings-form]");
  if(form){
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, "0");
    var dd = String(today.getDate()).padStart(2, "0");
    var dateInput = form.querySelector("[name=start_date]");
    if(dateInput && !dateInput.min) dateInput.min = yyyy + "-" + mm + "-" + dd;
    form.addEventListener("submit", async function(event){
      event.preventDefault();
      var ok = document.getElementById("recentSightingsSuccess");
      var err = document.getElementById("recentSightingsError");
      if(ok) ok.style.display = "none";
      if(err) err.style.display = "none";
      form.querySelectorAll("[data-name-field]").forEach(function(input){ input.value = titleCaseName(input.value); });
      var formData = new FormData(form);
      var payload = {};
      formData.forEach(function(value, key){ payload[key] = value; });
      payload.source_page = window.location.pathname;
      payload.preferred_language = PAGE_LANG;
      payload.submitted_at = new Date().toISOString();
      payload.request_id = "recent_" + Date.now();
      payload.turnstileToken = payload["cf-turnstile-response"] || "";
      try{
        var response = await fetch(form.action, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        var result = await response.json().catch(function(){ return {}; });
        if(!response.ok || result.ok === false) throw new Error(result.message || "Request failed");
        if(ok) ok.style.display = "block";
        track("recent_sightings_review_submitted", {
          has_email: Boolean(payload.visitor_email),
          has_whatsapp: Boolean(payload.visitor_whatsapp),
          group_size: payload.group_size || "",
          birding_days: payload.birding_days || ""
        });
      }catch(error){
        if(err){
          err.textContent = PAGE_LANG === "es"
            ? "No pudimos enviar la solicitud. Intenta de nuevo o escribenos por WhatsApp."
            : "We could not send the request. Please try again or message us on WhatsApp.";
          err.style.display = "block";
        }
      }
    });
  }
})();</script>`;
}

function renderRouteCards(data, lang) {
  const isEs = lang === "es";
  const counts = routeCounts(data);
  return data.routes.map((route) => {
    const examples = routeWatchlist(data, route.id, 3);
    return `
<button class="routeCard" type="button" data-route-interest="${attr(route.id)}">
  <span class="routeName">${esc(isEs ? route.nameEs : route.nameEn)}</span>
  <strong>${counts.get(route.id) || 0}</strong>
  <small>${esc(route.startTime ? `${isEs ? "Inicio sugerido" : "Suggested start"} ${route.startTime}` : (isEs ? "Revisar horario" : "Review timing"))}</small>
  <ul class="routeExamples">${examples.map((bird) => `<li>${esc(isEs ? bird.spanishName : bird.englishName)}</li>`).join("")}</ul>
</button>`;
  }).join("");
}

function renderWatchCards(data, lang) {
  const isEs = lang === "es";
  const labels = labelMap(lang);
  return topBirds(data, 12).map((bird) => `
<article class="watchCard">
  <div class="watchImage"><img src="${attr(bird.image)}" alt="${attr(isEs ? bird.imageAltEs : bird.imageAltEn)}" loading="lazy" decoding="async"></div>
  <div class="watchBody">
    <div class="watchTop"><span>${esc(labels[bird.difficulty] || bird.difficulty || (isEs ? "Por revisar" : "To review"))}</span><span>${bird.iconic ? (isEs ? "Iconica" : "Iconic") : (isEs ? "Objetivo" : "Target")}</span></div>
    <h3>${esc(isEs ? bird.spanishName : bird.englishName)}</h3>
    <p class="muted">${esc(isEs ? bird.englishName : bird.spanishName)}<br><em>${esc(bird.scientificName)}</em></p>
    <p class="muted"><strong>${isEs ? "Ruta:" : "Route:"}</strong> ${esc(isEs ? bird.routeNameEs : bird.routeNameEn)}<br><strong>${isEs ? "Mejor momento:" : "Best window:"}</strong> ${esc(labels[bird.bestTime] || bird.bestTime || (isEs ? "Por revisar" : "To review"))}</p>
  </div>
</article>`).join("");
}

function renderPage(lang, data) {
  const isEs = lang === "es";
  const pagePath = isEs ? ES_PATH : EN_PATH;
  const oppositePath = isEs ? EN_PATH : ES_PATH;
  const title = isEs
    ? "Avistamientos Recientes de Aves en Mindo"
    : "Recent Bird Sightings in Mindo";
  const metaDescription = isEs
    ? "Solicita una revision de avistamientos recientes cerca de Mindo con eBird, rutas locales y recomendaciones privadas de Mindo Bird Watching."
    : "Request a recent bird sightings review near Mindo with eBird activity, local route knowledge, and private birding recommendations from Mindo Bird Watching.";
  const h1 = title;
  const totalBirds = data.birds.length;
  const totalRoutes = data.routes.length;
  const iconic = data.birds.filter((bird) => bird.iconic).length;
  const labels = labelMap(lang);
  const routeCards = renderRouteCards(data, lang);
  const watchCards = renderWatchCards(data, lang);
  const summaryItems = topBirds(data, 5).map((bird) => `<li><strong>${esc(isEs ? bird.spanishName : bird.englishName)}</strong> - ${esc(isEs ? bird.routeNameEs : bird.routeNameEn)}; ${esc(labels[bird.difficulty] || bird.difficulty)}</li>`).join("");

  return `<!doctype html>
<html lang="${isEs ? "es" : "en"}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)} | Mindo Bird Watching</title>
<meta name="description" content="${attr(metaDescription)}"/>
<link rel="canonical" href="${attr(SITE_URL + pagePath)}"/>
<link rel="alternate" hreflang="en" href="${attr(SITE_URL + EN_PATH)}"/>
<link rel="alternate" hreflang="es" href="${attr(SITE_URL + ES_PATH)}"/>
<link rel="alternate" hreflang="x-default" href="${attr(SITE_URL + EN_PATH)}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${attr(title)}"/>
<meta property="og:description" content="${attr(metaDescription)}"/>
<meta property="og:url" content="${attr(SITE_URL + pagePath)}"/>
<meta property="og:image" content="${attr(SITE_URL + OG_IMAGE)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<link href="/favicon.ico" rel="icon"/>
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
<body data-page-content-group="birding" data-page-language="${isEs ? "es" : "en"}" data-page-location="mindo" data-page-region="mindo_cloud_forest" data-page-type="recent_bird_sightings_mindo">
<div class="container">
<div id="siteHeader" data-current-lang="${isEs ? "es" : "en"}">${renderHeaderFallback(lang)}</div>
<main class="page recentPage" aria-label="${attr(h1)}">
  <section class="recentHero">
    <div class="heroCopy">
      <span class="eyebrow">${isEs ? "eBird + guia local" : "eBird + local guide review"}</span>
      <h1>${esc(h1)}</h1>
      <p>${isEs ? "Revisa señales recientes de aves cerca de Mindo y pide a MBW que convierta la actividad actual en una recomendacion privada de ruta, horario y esfuerzo." : "Review recent birding signals near Mindo and ask MBW to turn current activity into a private route, timing, and effort recommendation."}</p>
      <div class="heroActions">
        <a class="btn primary" href="#recentSightingsForm">${isEs ? "Solicitar revision reciente" : "Request Recent Review"}</a>
        <a class="btn secondary" href="${isEs ? "/es/tours/constructor-tour-aves-objetivo/" : "/tours/target-bird-tour-builder/"}" data-target-builder-link>${isEs ? "Crear lista de aves objetivo" : "Build Target Bird List"}</a>
      </div>
      <div class="heroMetrics">
        <div class="heroMetric"><strong>${totalBirds}</strong><span>${isEs ? "aves en la base MBW" : "MBW planning birds"}</span></div>
        <div class="heroMetric"><strong>${totalRoutes}</strong><span>${isEs ? "zonas de ruta" : "route areas"}</span></div>
        <div class="heroMetric"><strong>${iconic}</strong><span>${isEs ? "objetivos iconicos" : "iconic targets"}</span></div>
      </div>
    </div>
    <div class="heroMedia">
      <img src="${attr(HERO_IMAGE)}" alt="${isEs ? "Ruta de observacion de aves en el bosque nublado de Mindo" : "Birding route in the Mindo cloud forest"}" loading="eager" decoding="async">
      <p class="heroCap">${isEs ? "Los avistamientos cambian diariamente. MBW revisa eBird reciente y conocimiento local antes de recomendar la ruta." : "Bird activity changes daily. MBW reviews recent eBird activity and local knowledge before recommending a route."}</p>
    </div>
  </section>
  <section class="miniPanel">
    <h2>${isEs ? "Como usar esta pagina" : "How to use this page"}</h2>
    <ul>
      <li>${isEs ? "Explora rutas y objetivos que vale la pena revisar." : "Explore route areas and target birds worth checking."}</li>
      <li>${isEs ? "Envia fechas, grupo e intereses." : "Send dates, group size, and interests."}</li>
      <li>${isEs ? "Recibe una revision inicial con lenguaje de oportunidad, no de garantia." : "Receive an initial opportunity review, not a guarantee."}</li>
    </ul>
  </section>
  <section class="pageSection">
    <div class="sectionHeader">
      <div>
        <h2>${isEs ? "Aves para revisar ahora" : "Birds to Review Now"}</h2>
        <p>${isEs ? "Esta lista usa la base MBW como watchlist. El flujo n8n agregara avistamientos recientes de eBird por fecha y ubicacion." : "This uses the MBW database as a watchlist. The n8n workflow will add recent eBird sightings by date and location."}</p>
      </div>
      <a class="btn secondary" href="#recentSightingsForm">${isEs ? "Enviar mis fechas" : "Send my dates"}</a>
    </div>
    <div class="watchGrid">${watchCards}</div>
  </section>
  <section class="pageSection">
    <div class="sectionHeader">
      <div>
        <h2>${isEs ? "Rutas que revisamos" : "Routes We Check"}</h2>
        <p>${isEs ? "Elige una ruta si ya sabes donde quieres enfocar la busqueda." : "Choose a route if you already know where you want to focus the search."}</p>
      </div>
    </div>
    <div class="routeGrid">${routeCards}</div>
  </section>
  <section class="pageSection" id="recentSightingsForm">
    <div class="leadPanel">
      <div class="leadGrid">
        <div class="summaryBox" data-summary-text>
          <h2>${isEs ? "Resumen para copiar" : "Copyable Review Summary"}</h2>
          <p class="muted">${isEs ? "Usa esto como punto de partida para pedir una revision con fechas reales." : "Use this as a starting point when requesting a real-date review."}</p>
          <ul>${summaryItems}</ul>
          <button class="btn secondary" type="button" data-copy-summary>${isEs ? "Copiar resumen" : "Copy summary"}</button>
        </div>
        <form action="/api/recent-bird-sightings" class="leadForm" data-recent-sightings-form method="post">
          <div class="twoCol">
            <label><span class="labelText">${isEs ? "Nombre" : "First Name"}*</span><input name="first_name" data-name-field autocomplete="given-name" autocapitalize="words" autocorrect="off" spellcheck="false" required placeholder="${isEs ? "Nombre" : "First name"}"></label>
            <label><span class="labelText">${isEs ? "Apellido" : "Last Name"}*</span><input name="last_name" data-name-field autocomplete="family-name" autocapitalize="words" autocorrect="off" spellcheck="false" required placeholder="${isEs ? "Apellido" : "Last name"}"></label>
          </div>
          <div class="twoCol">
            <label><span class="labelText">Email*</span><input name="visitor_email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
            <label><span class="labelText">WhatsApp</span><input name="visitor_whatsapp" autocomplete="tel" inputmode="tel" placeholder="+1 123 456 7890"></label>
          </div>
          <div class="twoCol">
            <label><span class="labelText">${isEs ? "Fecha de inicio" : "Start date"}</span><input name="start_date" type="date"></label>
            <label><span class="labelText">${isEs ? "Dias de observacion" : "Birding days"}</span><select name="birding_days"><option value="">${isEs ? "Seleccionar" : "Select"}</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5+">5+</option></select></label>
          </div>
          <div class="twoCol">
            <label><span class="labelText">${isEs ? "Personas" : "Group size"}</span><select name="group_size"><option value="">${isEs ? "Seleccionar" : "Select"}</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6+">6+</option></select></label>
            <label><span class="labelText">${isEs ? "Contacto preferido" : "Preferred contact"}</span><select name="preferred_contact_method"><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="either">${isEs ? "Cualquiera" : "Either"}</option></select></label>
          </div>
          <label><span class="labelText">${isEs ? "Intereses" : "Birding interests"}</span><select name="target_interests"><option value="recent_notable">${isEs ? "Avistamientos notables recientes" : "Recent notable sightings"}</option><option value="photography">${isEs ? "Fotografia" : "Photography"}</option><option value="rare_specialist">${isEs ? "Raras / especialistas" : "Rare / specialist birds"}</option><option value="easy_half_day">${isEs ? "Facil para medio dia" : "Easy half-day birds"}</option></select></label>
          <label><span class="labelText">${isEs ? "Notas" : "Notes"}</span><textarea name="visitor_notes" placeholder="${isEs ? "Fechas flexibles, aves objetivo o preferencias de ruta" : "Flexible dates, target birds, or route preferences"}"></textarea></label>
          <input name="route_interests" type="hidden" value="">
          <input name="preferred_language" type="hidden" value="${isEs ? "es" : "en"}">
          <div class="cf-turnstile" data-sitekey="0x4AAAAAACYIFF7ZNXiqieGk"></div>
          <div class="heroActions">
            <button class="btn primary" type="submit">${isEs ? "Solicitar revision" : "Request Review"}</button>
            <a class="btn secondary" href="https://wa.me/13054585402" target="_blank" rel="noopener" data-whatsapp-action>${isEs ? "WhatsApp" : "WhatsApp"}</a>
          </div>
          <p class="muted">${isEs ? "Este formulario usa Cloudflare Turnstile para reducir bots. La revision final la hace MBW." : "This form uses Cloudflare Turnstile to reduce bots. The final review is handled by MBW."}</p>
          <div class="success" id="recentSightingsSuccess">${isEs ? "Solicitud enviada. Revisaremos actividad reciente y rutas." : "Request sent. We will review recent activity and routes."}</div>
          <div class="errorMsg" id="recentSightingsError">${isEs ? "No pudimos enviar la solicitud." : "We could not send the request."}</div>
        </form>
      </div>
    </div>
  </section>
  <section class="pageSection">
    <div class="infoGrid">
      <article class="infoBox"><h2>${isEs ? "Actividad reciente" : "Recent Activity"}</h2><p>${isEs ? "El reporte usa fechas recientes, ubicaciones y frecuencia como senales de oportunidad." : "The report uses recent dates, locations, and frequency as opportunity signals."}</p></article>
      <article class="infoBox"><h2>${isEs ? "Rutas practicas" : "Practical Routes"}</h2><p>${isEs ? "Agrupamos aves por rutas reales para evitar planes imposibles o demasiado dispersos." : "We group birds by real route areas to avoid impossible or scattered plans."}</p></article>
      <article class="infoBox"><h2>${isEs ? "Sin garantias" : "No Guarantees"}</h2><p>${isEs ? "Usamos lenguaje de oportunidad y revision, no probabilidades garantizadas." : "We use opportunity and review language, not guaranteed probability."}</p></article>
    </div>
  </section>
</main>
<div id="siteFooter">${renderFooterFallback(lang)}</div>
</div>
${renderWhatsAppFab(lang)}
<script defer src="/assets/js/site.js"></script>
${pageScript(lang)}
</body>
</html>`;
}

function cloudflareFunction() {
  return `export async function onRequestPost(context) {
  const { request, env } = context;
  const json = (body, init = {}) => new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...(init.headers || {})
    }
  });

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const token = body.turnstileToken || body["cf-turnstile-response"] || "";
  if (env.TURNSTILE_SECRET_KEY) {
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: request.headers.get("CF-Connecting-IP") || ""
      })
    });
    const result = await verify.json().catch(() => ({}));
    if (!result.success) {
      return json({ ok: false, message: "Turnstile verification failed." }, { status: 403 });
    }
  }

  const webhook = env.N8N_RECENT_SIGHTINGS_WEBHOOK_URL;
  if (!webhook) {
    return json({ ok: false, message: "N8N_RECENT_SIGHTINGS_WEBHOOK_URL is not configured." }, { status: 500 });
  }

  const payload = {
    ...body,
    request_type: "recent_bird_sightings_mindo",
    request_status: "submitted",
    page_path: body.source_page || "",
    turnstileToken: undefined,
    "cf-turnstile-response": undefined
  };

  const forward = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await forward.text();
  if (!forward.ok) {
    return json({ ok: false, message: "Recent sightings workflow returned " + forward.status, detail: text.slice(0, 400) }, { status: 502 });
  }

  let data = {};
  try { data = JSON.parse(text); } catch (error) { data = { raw: text.slice(0, 400) }; }
  return json({ ok: true, request_id: payload.request_id, workflow: data });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });
}
`;
}

const SHEET_TABS = {
  recent_sightings_requests: [
    "request_id", "submitted_at", "source_page", "preferred_language", "first_name", "last_name", "visitor_name",
    "visitor_email", "visitor_whatsapp", "preferred_contact_method", "start_date", "birding_days", "group_size",
    "target_interests", "route_interests", "visitor_notes", "lead_status", "review_status", "quote_status",
    "assigned_to", "follow_up_date", "last_contacted_at", "visitor_email_sent", "internal_email_sent",
    "telegram_sent_at", "email_sent_at", "final_recommendation_sent_at", "turnstile_status", "request_status",
    "internal_notes"
  ],
  recent_sightings_request_interests: [
    "request_id", "interest_type", "route_cluster_id", "route_cluster_name", "speciesCode", "english_name",
    "spanish_name", "notes", "created_at"
  ],
  recent_sightings_snapshots: [
    "snapshot_id", "generated_at", "lat", "lng", "dist_km", "back_days", "total_observations",
    "unique_species_count", "notable_count", "source", "workflow_run_id", "active", "notes"
  ],
  recent_sightings_snapshot_species: [
    "snapshot_id", "speciesCode", "english_name", "spanish_name", "scientific_name", "last_seen_datetime",
    "location_name", "ebird_loc_id", "obs_count_window", "recent_activity_score", "route_cluster_id",
    "target_difficulty", "tour_fit", "notable", "observation_url", "needs_review", "created_at"
  ],
  recent_sightings_route_summary: [
    "snapshot_id", "route_cluster_id", "route_cluster_name_en", "route_cluster_name_es", "species_count",
    "notable_count", "best_start_time", "visitor_summary_en", "visitor_summary_es", "internal_notes"
  ],
  recent_sightings_email_log: [
    "request_id", "email_type", "recipient_email", "cc_email", "subject", "sent_at", "status",
    "provider_message_id", "error_message"
  ],
  recent_sightings_config: [
    "config_key", "config_value", "notes", "updated_at"
  ]
};

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function writeSheetHeaders() {
  fs.rmSync(HEADERS_DIR, { recursive: true, force: true });
  fs.mkdirSync(HEADERS_DIR, { recursive: true });
  Object.entries(SHEET_TABS).forEach(([tab, headers]) => {
    writeFile(path.join(HEADERS_DIR, `${tab}.tsv`), headers.join("\t") + "\n");
  });
  const guide = `# MBW Recent Bird Sightings Google Sheet Setup

Recommended Google Sheet name:

\`mbw_recent_bird_sightings_mindo\`

Create these tabs and paste the first row from each TSV file:

${Object.keys(SHEET_TABS).map((tab) => `- \`${tab}\``).join("\n")}

Cloudflare Pages environment variable for the page function:

\`N8N_RECENT_SIGHTINGS_WEBHOOK_URL=https://n8n.mindobirdwatching.com/webhook/mbw-recent-bird-sightings-request\`

Keep \`TURNSTILE_SECRET_KEY\` configured as it is for the other MBW forms.
`;
  writeFile(path.join(process.cwd(), "outputs", "mbw_recent_bird_sightings_google_sheet_setup.md"), guide);
}

function build() {
  const data = buildData();
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  writeFile(path.join(OUT_DIR, "birding", "recent-bird-sightings-mindo", "index.html"), renderPage("en", data));
  writeFile(path.join(OUT_DIR, "es", "birding", "avistamientos-recientes-mindo", "index.html"), renderPage("es", data));
  writeFile(path.join(OUT_DIR, "functions", "api", "recent-bird-sightings", "index.js"), cloudflareFunction());
  writeSheetHeaders();

  console.log(`Built recent bird sightings pages in ${OUT_DIR}`);
  console.log(`Google Sheet headers in ${HEADERS_DIR}`);
}

build();
