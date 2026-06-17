#!/usr/bin/env node

/*
  Mindo Bird Watching - Bird Tour Page Generator

  File location:
    /scripts/generate-bird-pages.js

  Generates:
    /tours/birds-you-can-see-in-mindo-half-day-vs-full-day/index.html
    /es/tours/aves-que-puedes-ver-en-mindo-tour-medio-dia-vs-dia-completo/index.html

  Data source:
    Published Google Sheets CSV

  Run:
    node scripts/generate-bird-pages.js

  Cloudflare Pages:
    Requires Node 18+ because this script uses the built-in fetch API.
*/

const fs = require("fs");
const path = require("path");

const SITE_URL = "https://mindobirdwatching.com";

const BIRD_CSV_URL =
  process.env.BIRD_CSV_URL ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS_8ukUe3GFUxAkrv_M0kl8-8uiMWfrWqKJ_DfMmKTEfPHdXfsu85teQ6aDErGq3SkZc6tJTR56yJwd/pub?gid=1098221451&single=true&output=csv";

const PLACEHOLDER_IMAGE = "/assets/images/birds/mbw_plate_billed_mountan_toucan_01.jpg";

const EN_PATH = "/tours/birds-you-can-see-in-mindo-half-day-vs-full-day/";
const ES_PATH = "/es/tours/aves-que-puedes-ver-en-mindo-tour-medio-dia-vs-dia-completo/";

const OUT_EN = path.join(
  process.cwd(),
  "tours",
  "birds-you-can-see-in-mindo-half-day-vs-full-day",
  "index.html"
);

const OUT_ES = path.join(
  process.cwd(),
  "es",
  "tours",
  "aves-que-puedes-ver-en-mindo-tour-medio-dia-vs-dia-completo",
  "index.html"
);

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

function parseCsv(text) {
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

  const headers = rows.shift().map(clean);

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

async function fetchCsv(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "MBW-Bird-Page-Generator/1.0"
    }
  });

  if (!response.ok) {
    throw new Error("CSV request failed with status " + response.status);
  }

  return await response.text();
}
function normalizeVisibility(value, fallback) {
  const v = clean(value).toLowerCase().replace(/\s+/g, "_");

  if (v === "half_day" || v === "full_day" || v === "both") {
    return v;
  }

  const f = clean(fallback).toLowerCase();

  if (f.includes("half")) return "half_day";
  if (f.includes("full")) return "full_day";

  return "both";
}

function normalizeBird(row, index) {
  const englishName = clean(row.english_name || row.requested_bird_name);
  const spanishName = clean(row.spanish_name || englishName);
  const scientificName = clean(row.scientific_name);

  return {
    sortOrder: Number(row.featured_order || row.sort_order || index + 1) || index + 1,
    birdId: clean(row.bird_id) || clean(row.species_code) || "bird-" + (index + 1),
    speciesCode: clean(row.species_code || row.ebird_target_species),
    englishName,
    spanishName,
    scientificName,
    image: clean(row.display_image_url || row.image_url) || PLACEHOLDER_IMAGE,
    imageCredit: clean(row.image_credit),
    audio: clean(row.audio_url),
    audioCredit: clean(row.audio_credit),
    moreInfoUrl: clean(row.more_info_url),
    ebirdUrl:
      clean(row.ebird_species_url) ||
      (clean(row.species_code)
        ? "https://ebird.org/species/" + encodeURIComponent(clean(row.species_code))
        : ""),
    recommendedTourFilter: clean(row.recommended_tour_filter),
    halfDayVisibility: clean(row.half_day_visibility),
    fullDayVisibility: clean(row.full_day_visibility),
    cardPriority: clean(row.card_priority),
    upsellEn: clean(row.full_day_upsell_copy_en),
    upsellEs: clean(row.full_day_upsell_copy_es),
    showEn: clean(row.show_on_english_page || "yes").toLowerCase() !== "no",
    showEs: clean(row.show_on_spanish_page || "yes").toLowerCase() !== "no",
    tourVisibility: normalizeVisibility(row.tour_visibility, row.recommended_tour_filter)
  };
}

function tourLabel(visibility, lang) {
  const labels = {
    en: {
      half_day: "Half Day",
      full_day: "Full Day",
      both: "Half Day + Full Day"
    },
    es: {
      half_day: "Medio Día",
      full_day: "Día Entero",
      both: "Medio Día + Día Entero"
    }
  };

  return labels[lang][visibility] || labels[lang].both;
}

function renderBirdCard(bird, lang) {
  const isEs = lang === "es";
  const name = isEs ? bird.spanishName : bird.englishName;
  const otherName = isEs ? bird.englishName : bird.spanishName;
  const upsell = isEs ? bird.upsellEs : bird.upsellEn;

  const halfLabel = isEs ? "Medio Día" : "Half Day";
  const fullLabel = isEs ? "Día Entero" : "Full Day";
  const playLabel = isEs ? "Reproducir sonido" : "Play Bird Call";
  const ebirdLabel = isEs ? "Ver en eBird" : "View on eBird";
  const moreInfoLabel = isEs ? "Más información" : "More info";

  const imageAlt = isEs
    ? `${name} (${bird.scientificName}) en el bosque nublado de Mindo`
    : `${name} (${bird.scientificName}) in the Mindo cloud forest`;

  return `
<article class="birdTourCard" data-bird-card data-tour="${attr(bird.tourVisibility)}" data-bird-id="${attr(bird.birdId)}" data-bird-name="${attr(name)}">
  <div class="birdTourImageWrap">
    <img
      class="birdTourImage"
      src="${attr(bird.image)}"
      alt="${attr(imageAlt)}"
      loading="lazy"
      decoding="async"
      width="1200"
      height="900"
    />
  </div>
  <div class="birdTourBody">
    <div class="birdTourTop">
      <span class="birdTourBadge">${esc(tourLabel(bird.tourVisibility, lang))}</span>
      ${bird.cardPriority ? `<span class="birdTourPriority">${esc(bird.cardPriority)}</span>` : ""}
    </div>

    <h3>${esc(name)}</h3>
    <p class="birdTourAlt">${esc(otherName)}</p>
    <p class="birdTourSci"><em>${esc(bird.scientificName)}</em></p>

    <div class="birdTourLikelihood">
      <p><strong>${halfLabel}:</strong> ${esc(bird.halfDayVisibility || (isEs ? "Posible según ruta y clima" : "Possible depending on route and weather"))}</p>
      <p><strong>${fullLabel}:</strong> ${esc(bird.fullDayVisibility || (isEs ? "Mejor oportunidad con más tiempo" : "Better opportunity with more time"))}</p>
    </div>

    ${upsell ? `<p class="birdTourUpsell">${esc(upsell)}</p>` : ""}

    <div class="birdTourAudio">
      ${
        bird.audio
          ? `<button
              class="birdAudioBtn"
              type="button"
              data-audio-src="${attr(bird.audio)}"
              data-bird-name="${attr(name)}"
              data-analytics-event="bird_audio_play"
            >${esc(playLabel)}</button>
            ${bird.audioCredit ? `<p class="birdCredit">${esc(bird.audioCredit)}</p>` : ""}`
          : `<span class="birdAudioPlaceholder" aria-hidden="true"></span>`
      }
    </div>

    <div class="birdTourLinks">
      ${
        bird.ebirdUrl
          ? `<a href="${attr(bird.ebirdUrl)}" target="_blank" rel="noopener noreferrer" data-analytics-event="ebird_species_click" data-analytics-bird="${attr(name)}" data-analytics-link-url="${attr(bird.ebirdUrl)}">${esc(ebirdLabel)}</a>`
          : ""
      }
      ${
        bird.moreInfoUrl
          ? `<a href="${attr(bird.moreInfoUrl)}" target="_blank" rel="noopener noreferrer" data-analytics-event="bird_more_info_click" data-analytics-bird="${attr(name)}">${esc(moreInfoLabel)}</a>`
          : ""
      }
    </div>
  </div>
</article>`;
}

function filterButtons(lang) {
  const labels =
    lang === "es"
      ? [
          ["all", "Todas"],
          ["half_day", "Medio Día"],
          ["full_day", "Día Entero"],
          ["both", "Medio Día y Día Entero"]
        ]
      : [
          ["all", "All Birds"],
          ["half_day", "Half Day"],
          ["full_day", "Full Day"],
          ["both", "Both Half & Full Day"]
        ];

  return labels
    .map(([filter, label], index) => {
      return `<button class="birdFilterBtn" type="button" data-filter="${filter}" aria-pressed="${index === 0 ? "true" : "false"}" data-analytics-event="bird_filter_change" data-analytics-label="${attr(label)}">${esc(label)}</button>`;
    })
    .join("\n");
}

function faqItems(lang) {
  if (lang === "es") {
    return [
      [
        "¿Un tour de medio día es suficiente para ver aves en Mindo?",
        "Sí. Un tour de medio día puede ser una excelente introducción, especialmente para colibríes, tangaras y especies cerca de rutas accesibles. Un tour de día entero ofrece más tiempo para buscar especies objetivo."
      ],
      [
        "¿Por qué un tour de día entero aumenta las oportunidades?",
        "Porque permite empezar temprano, cubrir más hábitat, ajustar la ruta según el clima y la actividad de las aves, y dedicar más tiempo a especies menos predecibles."
      ],
      [
        "¿Se garantizan las especies de esta página?",
        "No. Las aves silvestres no se pueden garantizar. Esta página muestra oportunidades relativas según tiempo, ruta, clima, temporada y estrategia del guía."
      ],
      [
        "¿Puedo elegir especies objetivo?",
        "Si. Puedes revisar las tarjetas, escuchar sonidos y compartir tus especies favoritas antes del tour."
      ]
    ];
  }

  return [
    [
      "Is a half day tour enough to see birds in Mindo?",
      "Yes. A half day tour can be a great introduction, especially for hummingbirds, tanagers, and species near accessible routes. A full day tour gives more time for target species."
    ],
    [
      "Why does a full day tour increase opportunities?",
      "A full day allows an earlier start, more habitat coverage, route changes based on weather and bird activity, and more time for less predictable species."
    ],
    [
      "Are the birds on this page guaranteed?",
      "No. Wild bird sightings cannot be guaranteed. This page shows relative opportunities based on time, route, weather, season, and guide strategy."
    ],
    [
      "Can I choose target species?",
      "Yes. You can review the cards, listen to sounds, and share your favorite species before the tour."
    ]
  ];
}

function renderFaq(lang) {
  return faqItems(lang)
    .map(([q, a]) => {
      return `
<article class="faqCard">
  <h3>${esc(q)}</h3>
  <p>${esc(a)}</p>
</article>`;
    })
    .join("\n");
}

function schemaGraph(lang, birds) {
  const isEs = lang === "es";
  const pagePath = isEs ? ES_PATH : EN_PATH;
  const pageUrl = SITE_URL + pagePath;

  const title = isEs
    ? "Aves que Puedes Ver en Mindo: Tour de Medio Día vs Día Entero"
    : "Birds You Can See in Mindo: Half Day vs Full Day Birdwatching Tours";

  const description = isEs
    ? "Compara aves que puedes ver en tours de medio día y día entero en Mindo, con fotos, sonidos, filtros por duración y enlaces de eBird."
    : "Compare birds you can see on half day and full day birdwatching tours in Mindo, with photos, sounds, tour filters and eBird links.";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageUrl + "#webpage",
        "url": pageUrl,
        "name": title,
        "description": description,
        "inLanguage": isEs ? "es" : "en",
        "isPartOf": {
          "@id": SITE_URL + "/#website"
        }
      },
      {
        "@type": "CollectionPage",
        "@id": pageUrl + "#collection",
        "url": pageUrl,
        "name": title,
        "inLanguage": isEs ? "es" : "en",
        "hasPart": birds.slice(0, 40).map((bird, index) => ({
          "@type": "CreativeWork",
          "position": index + 1,
          "name": isEs ? bird.spanishName : bird.englishName,
          "alternateName": isEs ? bird.englishName : bird.spanishName,
          "about": bird.scientificName
        }))
      },
      {
        "@type": "BreadcrumbList",
        "@id": pageUrl + "#breadcrumb",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": isEs ? "Inicio" : "Home",
            "item": SITE_URL + (isEs ? "/es/" : "/")
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Tours",
            "item": SITE_URL + (isEs ? "/es/tours/" : "/tours/")
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": title,
            "item": pageUrl
          }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": pageUrl + "#faq",
        "mainEntity": faqItems(lang).map(([q, a]) => ({
          "@type": "Question",
          "name": q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": a
          }
        }))
      }
    ]
  };
}

function pageCss() {
  return `
<style>
.birdCompareHero{
  display:grid;
  grid-template-columns:minmax(0,1.12fr) minmax(280px,.88fr);
  gap:18px;
  align-items:stretch;
}

.birdCompareHeroCopy,
.birdCompareHeroPanel,
.birdCompareBox,
.birdTourCard,
.birdEbirdBox,
.birdCtaBox{
  border:1px solid var(--line);
  border-radius:var(--r);
  background:rgba(255,255,255,.72);
  box-shadow:var(--shadow);
}

.birdCompareHeroCopy{
  padding:22px;
  display:flex;
  flex-direction:column;
  justify-content:center;
}

.birdCompareHeroCopy h1{
  font-size:42px;
  line-height:1.04;
  margin-bottom:12px;
}

.birdCompareHeroCopy p{
  color:var(--ink);
}

.birdCompareHeroPanel{
  overflow:hidden;
  display:grid;
}

.birdCompareHeroPanel img{
  width:100%;
  height:100%;
  min-height:340px;
  object-fit:cover;
}

.birdCompareHeroCopy .ctaRow{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:12px;
  align-items:stretch;
}

.birdCompareHeroCopy .ctaRow .btn{
  width:100%;
  min-height:48px;
  justify-content:center;
  text-align:center;
}

.birdStats{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:14px;
  margin-top:16px;
}

.birdStat{
  min-height:84px;
  padding:14px;
  border-radius:16px;
  border:1px solid var(--line);
  background:rgba(255,255,255,.58);
  display:flex;
  flex-direction:column;
  justify-content:center;
}

.birdStat strong{
  display:block;
  font-size:24px;
  color:var(--forest);
  font-family:var(--font-head);
  line-height:1;
}

.birdStat span{
  display:block;
  line-height:1.25;
}

.birdCompareGrid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:14px;
}

.birdCompareBox{
  padding:18px;
}

.birdCompareBox ul{
  margin:0;
  padding-left:18px;
  color:var(--muted);
  line-height:1.65;
}

.birdFilterBar{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  align-items:center;
  margin:14px 0;
}

.birdFilterBtn{
  appearance:none;
  border:1px solid var(--line);
  background:rgba(255,255,255,.68);
  color:var(--ink);
  border-radius:999px;
  padding:10px 13px;
  font-weight:900;
  cursor:pointer;
  box-shadow:var(--shadow);
}

.birdFilterBtn[aria-pressed="true"]{
  background:rgba(13,89,37,.14);
  border-color:rgba(13,89,37,.35);
}

.birdTourGrid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:14px;
  align-items:stretch;
}

.birdTourCard{
  overflow:hidden;
  display:flex;
  flex-direction:column;
  height:100%;
}

.birdTourCard[hidden]{
  display:none !important;
}

.birdTourImageWrap{
  aspect-ratio:4/3;
  background:rgba(255,255,255,.65);
  border-bottom:1px solid var(--line);
  overflow:hidden;
  flex:0 0 auto;
}

.birdTourImage{
  width:100%;
  height:100%;
  object-fit:cover;
}

.birdTourBody{
  padding:14px;
  display:grid;
  grid-template-rows:auto 52px 18px 18px 54px 66px 70px 24px;
  gap:8px;
  flex:1;
}

.birdTourTop{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  align-items:center;
  justify-content:space-between;
  min-height:30px;
}

.birdTourBadge,
.birdTourPriority{
  display:inline-flex;
  align-items:center;
  min-height:28px;
  padding:7px 9px;
  border-radius:999px;
  border:1px solid rgba(13,89,37,.26);
  background:rgba(13,89,37,.10);
  color:var(--forest);
  font-size:12px;
  font-weight:900;
  line-height:1;
}

.birdTourPriority{
  background:rgba(255,215,0,.22);
  border-color:rgba(255,215,0,.52);
  color:var(--ink);
}

.birdTourCard h3{
  margin:0;
  font-size:21px;
  line-height:1.12;
  overflow:hidden;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
}

.birdTourAlt,
.birdTourSci,
.birdCredit{
  margin:0;
  font-size:13px;
  color:var(--muted);
  line-height:1.3;
  overflow:hidden;
  white-space:nowrap;
  text-overflow:ellipsis;
}

.birdTourLikelihood{
  display:grid;
  gap:4px;
  align-content:start;
}

.birdTourLikelihood p{
  margin:0;
  font-size:13px;
  line-height:1.35;
  overflow:hidden;
  white-space:nowrap;
  text-overflow:ellipsis;
}

.birdTourUpsell{
  margin:0;
  color:var(--ink);
  font-size:13px;
  line-height:1.35;
  font-weight:800;
  overflow:hidden;
  display:-webkit-box;
  -webkit-line-clamp:3;
  -webkit-box-orient:vertical;
  align-self:start;
}

.birdTourAudio{
  align-self:end;
  display:grid;
  grid-template-rows:34px 28px;
  gap:6px;
  min-height:68px;
}

.birdAudioBtn{
  width:100%;
  min-height:34px;
  height:34px;
  border:1px solid rgba(13,89,37,.28);
  background:rgba(13,89,37,.10);
  color:var(--forest);
  border-radius:12px;
  padding:7px 12px;
  font-weight:900;
  cursor:pointer;
  line-height:1;
}

.birdAudioPlaceholder{
  display:block;
  min-height:34px;
}

.birdCredit{
  white-space:normal;
  display:-webkit-box;
  -webkit-line-clamp:2;
  -webkit-box-orient:vertical;
}

.birdTourLinks{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  align-items:end;
  min-height:24px;
  font-size:13px;
  font-weight:900;
}

.birdTourLinks a{
  text-decoration:underline;
  text-underline-offset:3px;
}

.birdCtaBox,
.birdEbirdBox{
  padding:18px;
}

.birdCtaBox{
  display:grid;
  grid-template-columns:1fr minmax(220px,auto);
  gap:16px;
  align-items:center;
  background:linear-gradient(135deg,rgba(255,215,0,.24),rgba(255,255,255,.76));
}

.birdCtaBox .btn{
  min-height:48px;
  justify-content:center;
  text-align:center;
}

.birdStickyCta{
  position:fixed;
  left:50%;
  bottom:14px;
  transform:translateX(-50%);
  width:min(720px,calc(100vw - 28px));
  z-index:2400;
  display:none;
  grid-template-columns:1fr 1fr;
  gap:8px;
  padding:8px;
  border:1px solid var(--line);
  border-radius:18px;
  background:rgba(255,255,255,.92);
  box-shadow:var(--shadow);
  backdrop-filter:blur(10px);
}

.birdStickyCta .btn{
  width:100%;
  min-height:44px;
  font-size:13px;
  justify-content:center;
  text-align:center;
}

@media(max-width:1000px){
  .birdTourGrid{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }

  .birdCompareHero,
  .birdCompareGrid{
    grid-template-columns:1fr;
  }
}

@media(max-width:760px){
  .birdTourGrid,
  .birdStats,
  .birdCtaBox,
  .birdCompareHeroCopy .ctaRow{
    grid-template-columns:1fr;
  }

  .birdCompareHeroCopy h1{
    font-size:32px;
  }

  .birdTourBody{
    grid-template-rows:auto auto auto auto auto auto auto auto;
  }

  .birdTourCard h3,
  .birdTourUpsell,
  .birdCredit{
    display:block;
    overflow:visible;
    -webkit-line-clamp:unset;
  }

  .birdTourAlt,
  .birdTourSci,
  .birdTourLikelihood p{
    white-space:normal;
    overflow:visible;
    text-overflow:clip;
  }

  .birdStickyCta{
    display:grid;
  }

  body{
    padding-bottom:96px;
  }
}

@media(max-width:520px){
  .birdStickyCta{
    grid-template-columns:1fr;
  }

  body{
    padding-bottom:148px;
  }
}
</style>`;
}
function includeLoaderScript() {
  return `
<script>
(function () {
  "use strict";

  function loadInclude(id, url) {
    var el = document.getElementById(id);
    if (!el || el.children.length) return;

    fetch(url, { cache: "no-cache" })
      .then(function (res) { return res.ok ? res.text() : ""; })
      .then(function (html) {
        if (html) el.innerHTML = html;
        document.dispatchEvent(new CustomEvent("mbw_include_loaded", { detail: { id: id } }));
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      loadInclude("siteHeader", "/assets/includes/header.html");
      loadInclude("siteFooter", "/assets/includes/footer.html");
    });
  } else {
    loadInclude("siteHeader", "/assets/includes/header.html");
    loadInclude("siteFooter", "/assets/includes/footer.html");
  }
})();
</script>`;
}

function interactionScript() {
  return `
<script>
(function () {
  "use strict";

  function track(eventName, params) {
    params = params || {};

    if (window.gtag) {
      window.gtag("event", eventName, params);
    }

    window.dispatchEvent(new CustomEvent("mbw_analytics_event", {
      detail: { event: eventName, params: params }
    }));
  }

  function setFilter(filter) {
    var cards = document.querySelectorAll("[data-bird-card]");
    var buttons = document.querySelectorAll("[data-filter]");
    var visible = 0;

    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-filter") === filter ? "true" : "false");
    });

    cards.forEach(function (card) {
      var tour = card.getAttribute("data-tour") || "both";
var show = false;

if (filter === "all") {
  show = true;
} else if (filter === "both") {
  show = tour === "both";
} else {
  show = tour === filter || tour === "both";
}

      card.hidden = !show;

      if (show) visible++;
    });

    var count = document.getElementById("birdResultCount");

    if (count) {
      count.textContent = String(visible);
    }

    track("bird_filter_change", {
      filter: filter,
      visible_count: visible,
      page_path: window.location.pathname
    });
  }

  document.addEventListener("click", function (event) {
    var filterButton = event.target.closest("[data-filter]");

    if (filterButton) {
      setFilter(filterButton.getAttribute("data-filter"));
      return;
    }

    var audioButton = event.target.closest(".birdAudioBtn");

    if (audioButton) {
      var src = audioButton.getAttribute("data-audio-src");
      var birdName = audioButton.getAttribute("data-bird-name") || "";
      var player = document.getElementById("birdAudioPlayer");

      if (!src || !player) return;

      player.src = src;
      player.play().catch(function () {});

      track("bird_audio_play", {
        bird_name: birdName,
        audio_src: src,
        page_path: window.location.pathname
      });

      return;
    }

    var analyticsElement = event.target.closest("[data-analytics-event]");

    if (analyticsElement) {
      var eventName = analyticsElement.getAttribute("data-analytics-event");

      if (!eventName || eventName === "bird_audio_play" || eventName === "bird_filter_change") {
        return;
      }

      track(eventName, {
        label: analyticsElement.getAttribute("data-analytics-label") || analyticsElement.textContent.trim(),
        bird_name: analyticsElement.getAttribute("data-analytics-bird") || "",
        link_url: analyticsElement.getAttribute("data-analytics-link-url") || analyticsElement.getAttribute("href") || "",
        location: analyticsElement.getAttribute("data-analytics-location") || "",
        page_path: window.location.pathname
      });
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    var cards = document.querySelectorAll("[data-bird-card]");
    var count = document.getElementById("birdResultCount");

    if (count) {
      count.textContent = String(cards.length);
    }

    track("bird_page_view", {
      page_path: window.location.pathname,
      bird_count: cards.length
    });
  });
})();
</script>`;
}

function renderPage(lang, birds) {
  const isEs = lang === "es";
  const pagePath = isEs ? ES_PATH : EN_PATH;
  const counterpartPath = isEs ? EN_PATH : ES_PATH;

  const pageUrl = SITE_URL + pagePath;
  const counterpartUrl = SITE_URL + counterpartPath;

  const title = isEs
    ? "Aves que Puedes Ver en Mindo: Tour de Medio Día vs Día Entero"
    : "Birds You Can See in Mindo: Half Day vs Full Day Birdwatching Tours";

  const meta = isEs
    ? "Compara las aves de tours de medio día y día entero en Mindo. Explora fotos, sonidos, avistamientos recientes y por que un día entero aumenta tus oportunidades."
    : "Compare birds seen on Mindo half day and full day birdwatching tours. Explore photos, sounds, recent sightings and why a full day gives you more chances to see iconic species.";

  const visibleBirds = birds
    .filter((bird) => (isEs ? bird.showEs : bird.showEn))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const featuredNames = visibleBirds
    .filter((bird) => clean(bird.cardPriority).toLowerCase() === "feature")
    .slice(0, 12)
    .map((bird) => (isEs ? bird.spanishName : bird.englishName))
    .join(", ");

  const cards = visibleBirds.map((bird) => renderBirdCard(bird, lang)).join("\n");

  const whatsappKey = isEs ? "book_tour_es" : "book_tour_en";
  const primaryCta = isEs ? "Reservar Tour de Día Entero" : "Book a Full Day Birding Tour";
  const secondaryCta = isEs ? "Ver Tours" : "View Tour Options";

  const langSwitch = isEs
    ? `<nav aria-label="Selector de idioma" class="rawLangLinks"><a href="${attr(counterpartUrl)}" hreflang="en" lang="en" data-analytics-event="language_switch_click" data-analytics-target-language="en">English</a><a href="${attr(pageUrl)}" hreflang="es" lang="es" aria-current="page" data-analytics-event="language_switch_click" data-analytics-target-language="es">Español</a></nav>`
    : `<nav aria-label="Language switch" class="rawLangLinks"><a href="${attr(pageUrl)}" hreflang="en" lang="en" aria-current="page" data-analytics-event="language_switch_click" data-analytics-target-language="en">English</a><a href="${attr(counterpartUrl)}" hreflang="es" lang="es" data-analytics-event="language_switch_click" data-analytics-target-language="es">Español</a></nav>`;

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
<meta property="og:image" content="${attr(SITE_URL + PLACEHOLDER_IMAGE)}"/>
<meta property="og:image:alt" content="${attr(title)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${attr(title)}"/>
<meta name="twitter:description" content="${attr(meta)}"/>
<meta name="twitter:image" content="${attr(SITE_URL + PLACEHOLDER_IMAGE)}"/>
<link href="/favicon.ico" rel="icon" sizes="any"/>
<link href="/favicon.svg" rel="icon" type="image/svg+xml"/>
<link href="/apple-touch-icon.png" rel="apple-touch-icon"/>
<link href="/site.webmanifest" rel="manifest"/>
<link href="/assets/css/header.css" rel="stylesheet"/>
<link href="/assets/css/site.css" rel="stylesheet"/>
<script defer src="/assets/js/head.js"></script>
<script defer src="/assets/js/site-config.js"></script>
<script defer src="/assets/js/site.js"></script>
${pageCss()}
<script type="application/ld+json">${JSON.stringify(schemaGraph(lang, visibleBirds), null, 2)}</script>
</head>
<body data-page-content-group="birding_tours" data-page-language="${isEs ? "es" : "en"}" data-page-location="mindo" data-page-region="mindo_cloud_forest" data-page-type="tour_species_comparison">
<div class="container">
<div id="siteHeader" data-current-lang="${isEs ? "es" : "en"}"></div>
${langSwitch}

<main class="page card" aria-label="${attr(title)}">
<section class="birdCompareHero" aria-label="${isEs ? "Introduccion" : "Introduction"}">
<div class="birdCompareHeroCopy">
<span class="eyebrow">Mindo Cloud Forest</span>
<h1>${esc(title)}</h1>
<p>${isEs ? "Usa esta guía visual para comparar qué aves suelen ser más realistas en un tour de medio día y cuáles se vuelven mucho más probables cuando eliges un día entero con más tiempo, más hábitat y una estrategia de guía más flexible." : "Use this visual guide to compare which birds are realistic on a half day tour and which species become more likely when you choose a full day with more time, more habitat, and a more flexible guide strategy."}</p>
<div class="ctaRow">
<a class="btn primary" href="#request-form" data-whatsapp-message-key="${whatsappKey}" data-analytics-event="tour_whatsapp_click" data-analytics-label="${attr(primaryCta)}" data-analytics-link-url="dynamic_whatsapp" data-analytics-location="hero" rel="noopener noreferrer" target="_blank">${esc(primaryCta)}</a>
<a class="btn secondary" href="${isEs ? "/es/tours/" : "/tours/"}" data-analytics-event="secondary_cta_click" data-analytics-label="${attr(secondaryCta)}" data-analytics-link-url="${isEs ? "/es/tours/" : "/tours/"}">${esc(secondaryCta)}</a>
</div>
<div class="birdStats">
<div class="birdStat"><strong>${visibleBirds.length}</strong><span>${isEs ? "aves destacadas" : "featured birds"}</span></div>
<div class="birdStat"><strong>${visibleBirds.length}</strong><span>${isEs ? "comparaciones de tour" : "tour comparisons"}</span></div>
<div class="birdStat"><strong>${visibleBirds.filter((b) => b.audio).length}</strong><span>${isEs ? "sonidos de aves" : "bird sounds"}</span></div>
</div>
</div>
<div class="birdCompareHeroPanel">
<img src="${PLACEHOLDER_IMAGE}" alt="${isEs ? "Tucan Andino Piquiplaca en Mindo" : "Plate-billed Mountain Toucan in Mindo"}" loading="eager" decoding="async"/>
</div>
</section>

<section class="section">
<div class="sectionHead">
<h2>${isEs ? "Medio Día vs Día Entero" : "Half Day vs Full Day"}</h2>
<p class="sectionHint">${isEs ? "El día entero no garantiza especies, pero aumenta tiempo, rutas y oportunidades." : "A full day does not guarantee species, but it increases time, route options, and opportunities."}</p>
</div>
<div class="birdCompareGrid">
<article class="birdCompareBox">
<h3>${isEs ? "Tour de Medio Día" : "Half Day Tour"}</h3>
<ul>
<li>${isEs ? "Ideal si tienes poco tiempo." : "Best if you have limited time."}</li>
<li>${isEs ? "Bueno para colibríes, tangaras y aves cerca de rutas accesibles." : "Good for hummingbirds, tanagers, and birds near accessible routes."}</li>
<li>${isEs ? "Menos margen para especies raras o de hábitat específico." : "Less margin for rare or habitat-specific species."}</li>
</ul>
</article>
<article class="birdCompareBox">
<h3>${isEs ? "Tour de Día Entero" : "Full Day Tour"}</h3>
<ul>
<li>${isEs ? "Más tiempo para buscar especies objetivo." : "More time to search for target species."}</li>
<li>${isEs ? "Más hábitat, elevación y flexibilidad según el clima." : "More habitat, elevation, and weather flexibility."}</li>
<li>${isEs ? "Mejor opcion para fotografos y observadores serios." : "Best choice for photographers and serious birders."}</li>
</ul>
</article>
</div>
</section>

<section class="section">
<div class="birdCtaBox">
<div>
<h2>${isEs ? "Especies que hacen que el día entero valga la pena" : "Species That Make the Full Day Worth It"}</h2>
<p>${esc(featuredNames || (isEs ? "Aves destacadas de Mindo" : "Featured birds of Mindo"))}</p>
</div>
<a class="btn primary" href="#request-form" data-whatsapp-message-key="${whatsappKey}" data-analytics-event="full_day_upgrade_cta_click" data-analytics-label="${attr(primaryCta)}" data-analytics-link-url="dynamic_whatsapp" data-analytics-location="mid_page_upgrade" rel="noopener noreferrer" target="_blank">${esc(primaryCta)}</a>
</div>
</section>

<section class="section">
<div class="sectionHead">
<h2>${isEs ? "Filtra las aves por duración del tour" : "Filter Birds by Tour Length"}</h2>
<p class="sectionHint"><span id="birdResultCount">${visibleBirds.length}</span> ${isEs ? "aves visibles" : "birds visible"}</p>
</div>
<div class="birdFilterBar" role="group" aria-label="${isEs ? "Filtros de aves" : "Bird filters"}">
${filterButtons(lang)}
</div>
<div class="birdTourGrid">
${cards}
</div>
</section>

<section class="section">
<div class="birdEbirdBox" id="recent-ebird-sightings">
<h2>${isEs ? "Avistamientos recientes cerca de Mindo" : "Recent Sightings Near Mindo"}</h2>
<p>${isEs ? "Este modulo esta listo para conectar con tu flujo de eBird. Por ahora, cada tarjeta enlaza a la ficha de especie en eBird para revisar reportes recientes." : "This module is ready to connect with your eBird workflow. For now, each card links to the species page on eBird so visitors can review recent reports."}</p>
</div>
</section>

<section class="section">
<div class="sectionHead"><h2>${isEs ? "Preguntas Frecuentes" : "Frequently Asked Questions"}</h2></div>
<div class="faqGrid">
${renderFaq(lang)}
</div>
</section>

<section class="section" id="request-form">
<div class="birdCtaBox">
<div>
<h2>${isEs ? "¿Quieres aumentar tus oportunidades de ver más aves?" : "Want Better Chances to See More Birds?"}</h2>
<p>${isEs ? "Envía un mensaje con tus fechas, intereses y especies objetivo. Te ayudaremos a elegir entre medio día, día entero o un tour privado." : "Send a message with your dates, interests, and target species. We will help you choose between half day, full day, or a private custom tour."}</p>
</div>
<a class="btn primary" href="#request-form" data-whatsapp-message-key="${whatsappKey}" data-analytics-event="tour_whatsapp_click" data-analytics-label="${attr(primaryCta)}" data-analytics-link-url="dynamic_whatsapp" data-analytics-location="bottom_request_form" rel="noopener noreferrer" target="_blank">${esc(primaryCta)}</a>
</div>
</section>
</main>

<div id="siteFooter"></div>
</div>

<div class="birdStickyCta">
<a class="btn primary" href="#request-form" data-whatsapp-message-key="${whatsappKey}" data-analytics-event="tour_whatsapp_click" data-analytics-label="${attr(primaryCta)}" data-analytics-link-url="dynamic_whatsapp" data-analytics-location="sticky_mobile" rel="noopener noreferrer" target="_blank">${esc(primaryCta)}</a>
<a class="btn secondary" href="#birdResultCount">${isEs ? "Ver aves" : "See Birds"}</a>
</div>

<audio id="birdAudioPlayer" preload="none"></audio>
${includeLoaderScript()}
${interactionScript()}
</body>
</html>`;
}

async function main() {
  const csvText = await fetchCsv(BIRD_CSV_URL);
  const rows = parseCsv(csvText);

  const birds = rows
    .map(normalizeBird)
    .filter((bird) => bird.englishName && bird.scientificName);

  if (!birds.length) {
    throw new Error("No valid bird rows found.");
  }

  fs.mkdirSync(path.dirname(OUT_EN), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_ES), { recursive: true });

  fs.writeFileSync(OUT_EN, renderPage("en", birds), "utf8");
  fs.writeFileSync(OUT_ES, renderPage("es", birds), "utf8");

  console.log("Generated: " + OUT_EN);
  console.log("Generated: " + OUT_ES);
  console.log("Bird rows: " + birds.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
