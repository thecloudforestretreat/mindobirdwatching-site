import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/recommendations-public.json'), 'utf8'));

const ui = {
  en: {
    locale: 'en_US', htmlLang: 'en', base: '/recommendations/', altBase: '/es/recomendaciones/', home: '/', contact: '/contact/', book: '/book-tour/', guide: '/mindo-bird-watching-guide/',
    title: 'Mindo Recommendations | Curated Stays, Food and Experiences',
    description: 'Compare locally curated places to stay, eat, and explore in Mindo, Ecuador with useful filters, price feel, early-start logistics, and honest planning notes.',
    eyebrow: 'THE MINDO FIELD GUIDE', heading: 'Stay, eat and explore Mindo with local context',
    lead: 'More useful than a booking list: compare the places we know by trip fit, early-start logistics, atmosphere, and price feel—without publishing private partner rates.',
    trust: [['8', 'curated partner profiles'], ['Bilingual', 'English and Spanish planning'], ['Birding-aware', 'pickup and breakfast context'], ['No hidden rates', 'public price feel only']],
    asideTitle: 'Built for real trip decisions', aside: ['Filter stays by cabin, hotel, lodge, vacation rental, or glamping.', 'See what works before a dawn birding departure.', 'Compare the character of each place, not just amenities.', 'Open a full profile before visiting the partner site.'],
    browse: 'Find your Mindo match', browseHint: 'Start broad, then narrow by category or stay style. Every card remains readable and indexable without filters.', search: 'Search by partner, feature, or trip style',
    category: 'Category', type: 'Stay type', all: 'All', stays: 'Stays', food: 'Food', experiences: 'Experiences', services: 'Services',
    types: [['vacation-rental','Vacation rental / Airbnb'],['hotel','Hotel'],['lodge','Lodge'],['guesthouse','Hostel / guesthouse'],['cabin','Cabin'],['glamping','Glamping'],['private-reserve','Private reserve']],
    sort: 'Sort', sortOptions: [['recommended','Recommended match'],['early','Early-start friendly'],['price-low','Price feel: low to high'],['price-high','Price feel: high to low'],['recent','Recently verified'],['az','A–Z']],
    showing: 'Showing', partners: 'recommendations', empty: 'No places match those filters yet. Clear a filter or search for another feature.', why: 'Why we recommend', view: 'Open field guide', verified: 'Verified',
    methodTitle: 'How we curate the guide', methodHint: 'A partner relationship can help guests, but it never replaces practical judgment.', methods: [['Local usefulness', 'We look at location, communication, guest fit, and whether the experience adds something useful to a Mindo itinerary.'],['Birding-day fit', 'Breakfast timing, pickup access, forest setting, and recovery after a long route matter more here than generic star scores.'],['Clear disclosure', 'Partner profiles and independent recommendations are labeled. Price symbols show general feel, never confidential rates.']],
    priceTitle: 'What the price symbols mean', priceHint: 'A relative guide for comparing this collection—not a quote or promise of availability.', priceLabels: ['Budget-friendly', 'Moderate', 'Comfort-plus', 'Premium', 'Top-end'],
    faqTitle: 'Mindo recommendation questions', faqs: [['Is the price symbol an exact rate?', 'No. It is a relative price feel for this guide. Contact the property or ask us for a current quote and availability.'],['Are partner listings paid rankings?', 'No. Partner status is disclosed, and default order reflects guest usefulness and the maturity of each profile—not who pays the most.'],['Which stay type is best for birders?', 'There is no single answer. A central hotel can simplify pickups, while a lodge or private reserve can place you closer to habitat. Use the early-start and location notes.'],['Can you combine a partner stay with a private tour?', 'Yes. Send us your dates, lodging idea, group size, and target birds so we can check the practical route fit.']],
    ctaTitle: 'Want a recommendation for your exact trip?', ctaText: 'Tell us your dates, group, comfort level, and birding priorities. We will help you shortlist the places that fit the route—not just the prettiest card.', ask: 'Ask Mindo Bird Watching', bookTour: 'Book a birding tour',
    profile: {crumb:'Recommendations', why:'Why we recommend it', facts:['Category','Price feel','Best for','Last verified'], fit:'How it fits a birding day', fitLabels:['Early start','Pickup logic','Food plan','Trip pace'], stands:'What stands out', know:'Know before you go', gallery:'A closer look', plan:'Pair it with the right route', planText:'The best choice depends on departure time, route, target birds, transport, and how much energy you want after birding.', official:'Visit official website', reserve:'Check availability', ask:'Ask us to help pair it', source:'Images sourced from the partner’s official website with partner authorization.', disclosure:'Relationship disclosure'}
  },
  es: {
    locale: 'es_EC', htmlLang: 'es', base: '/es/recomendaciones/', altBase: '/recommendations/', home: '/es/', contact: '/es/contacto/', book: '/es/reservar-tour/', guide: '/es/guia-avistamiento-aves-mindo/',
    title: 'Recomendaciones de Mindo | Hospedaje, comida y experiencias',
    description: 'Compara hospedajes, restaurantes y experiencias curadas en Mindo con filtros útiles, nivel de precio, logística para salidas tempranas y notas honestas.',
    eyebrow: 'LA GUÍA LOCAL DE MINDO', heading: 'Hospédate, come y explora Mindo con contexto local',
    lead: 'Más útil que una lista de reservas: compara lugares por tipo de viaje, logística temprana, ambiente y nivel de precio, sin publicar tarifas privadas de socios.',
    trust: [['8', 'perfiles curados'], ['Bilingüe', 'planificación en inglés y español'], ['Pensado para birding', 'recogida y desayuno'], ['Sin tarifas privadas', 'solo nivel de precio público']],
    asideTitle: 'Diseñada para decisiones reales', aside: ['Filtra por cabaña, hotel, lodge, alquiler vacacional o glamping.', 'Revisa qué funciona antes de una salida al amanecer.', 'Compara el carácter de cada lugar, no solo sus servicios.', 'Abre el perfil completo antes de visitar el sitio del socio.'],
    browse: 'Encuentra tu mejor opción en Mindo', browseHint: 'Empieza con una categoría y luego filtra por estilo. Todas las fichas siguen siendo legibles e indexables sin usar filtros.', search: 'Buscar por socio, servicio o estilo de viaje',
    category: 'Categoría', type: 'Tipo de hospedaje', all: 'Todos', stays: 'Hospedajes', food: 'Comida', experiences: 'Experiencias', services: 'Servicios',
    types: [['vacation-rental','Alquiler vacacional / Airbnb'],['hotel','Hotel'],['lodge','Lodge'],['guesthouse','Hostal / casa de huéspedes'],['cabin','Cabaña'],['glamping','Glamping'],['private-reserve','Reserva privada']],
    sort: 'Ordenar', sortOptions: [['recommended','Mejor coincidencia'],['early','Mejor para salidas tempranas'],['price-low','Precio: menor a mayor'],['price-high','Precio: mayor a menor'],['recent','Verificado recientemente'],['az','A–Z']],
    showing: 'Mostrando', partners: 'recomendaciones', empty: 'No hay lugares con esos filtros. Quita un filtro o busca otra característica.', why: 'Por qué lo recomendamos', view: 'Abrir guía', verified: 'Verificado',
    methodTitle: 'Cómo curamos la guía', methodHint: 'Una relación comercial puede ayudar al huésped, pero nunca reemplaza el criterio práctico.', methods: [['Utilidad local', 'Revisamos ubicación, comunicación, tipo de huésped y si la experiencia realmente aporta a un itinerario en Mindo.'],['Ajuste al día de birding', 'Horario de desayuno, recogida, entorno y descanso después de una ruta importan más que una calificación genérica.'],['Divulgación clara', 'Identificamos socios y recomendaciones independientes. Los símbolos muestran nivel de precio, nunca tarifas confidenciales.']],
    priceTitle: 'Qué significan los símbolos de precio', priceHint: 'Una guía relativa dentro de esta colección; no es una cotización ni promesa de disponibilidad.', priceLabels: ['Económico', 'Moderado', 'Comodidad plus', 'Premium', 'Alta gama'],
    faqTitle: 'Preguntas sobre recomendaciones en Mindo', faqs: [['El símbolo de precio es una tarifa exacta?', 'No. Es un nivel relativo dentro de esta guía. Contacta al lugar o pídenos una cotización y disponibilidad actual.'],['Los socios pagan por aparecer primero?', 'No. La relación se divulga y el orden predeterminado refleja utilidad para el huésped y madurez del perfil, no quién paga más.'],['Qué tipo de hospedaje es mejor para birders?', 'No existe una sola respuesta. Un hotel céntrico facilita recogidas, mientras un lodge o reserva puede acercarte al hábitat. Revisa las notas de salida temprana y ubicación.'],['Pueden combinar un hospedaje con un tour privado?', 'Sí. Envíanos fechas, idea de hospedaje, tamaño del grupo y aves objetivo para revisar la logística de la ruta.']],
    ctaTitle: 'Quieres una recomendación para tu viaje exacto?', ctaText: 'Cuéntanos fechas, grupo, nivel de comodidad y prioridades de birding. Te ayudamos a elegir lo que funciona para la ruta, no solo la tarjeta más bonita.', ask: 'Preguntar a Mindo Bird Watching', bookTour: 'Reservar tour de birding',
    profile: {crumb:'Recomendaciones', why:'Por qué lo recomendamos', facts:['Categoría','Nivel de precio','Ideal para','Última verificación'], fit:'Cómo encaja en un día de birding', fitLabels:['Salida temprana','Lógica de recogida','Plan de comidas','Ritmo del viaje'], stands:'Lo que destaca', know:'Antes de ir', gallery:'Mira más de cerca', plan:'Combínalo con la ruta correcta', planText:'La mejor opción depende de la hora de salida, ruta, aves objetivo, transporte y cuánta energía quieres después del birding.', official:'Visitar sitio oficial', reserve:'Consultar disponibilidad', ask:'Pedir ayuda para combinarlo', source:'Imágenes obtenidas del sitio oficial del socio con su autorización.', disclosure:'Divulgación de relación'}
  }
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = level => '$'.repeat(level) + '<span aria-hidden="true" style="opacity:.28">' + '$'.repeat(5 - level) + '</span>';
const isoPretty = value => new Intl.DateTimeFormat('en', {year:'numeric', month:'short'}).format(new Date(value + 'T12:00:00Z'));
const profilePath = (partner, lang) => `${ui[lang].base}${partner.slug}/`;
const absolute = relative => `https://mindobirdwatching.com${relative}`;
const json = value => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

function head({lang, title, description, canonical, alternate, image, schema, bodyClass}) {
  const t = ui[lang];
  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1" name="viewport"/>
<title>${esc(title)}</title>
<meta content="${esc(description)}" name="description"/>
<meta content="index,follow,max-image-preview:large" name="robots"/>
<link href="${canonical}" rel="canonical"/>
<link href="${lang === 'en' ? canonical : alternate}" hreflang="en" rel="alternate"/>
<link href="${lang === 'es' ? canonical : alternate}" hreflang="es" rel="alternate"/>
<link href="${lang === 'en' ? canonical : alternate}" hreflang="x-default" rel="alternate"/>
<meta content="website" property="og:type"/>
<meta content="Mindo Bird Watching" property="og:site_name"/>
<meta content="${t.locale}" property="og:locale"/>
<meta content="${esc(title)}" property="og:title"/>
<meta content="${esc(description)}" property="og:description"/>
<meta content="${canonical}" property="og:url"/>
<meta content="${absolute(image)}" property="og:image"/>
<meta content="summary_large_image" name="twitter:card"/>
<link href="/favicon.ico" rel="icon" sizes="any"/>
<link href="/favicon.svg" rel="icon" type="image/svg+xml"/>
<link href="/apple-touch-icon.png" rel="apple-touch-icon"/>
<link href="/site.webmanifest" rel="manifest"/>
<link href="/assets/css/site.css" rel="stylesheet"/>
<link href="/assets/css/header.css?v=1" rel="stylesheet"/>
<link href="/assets/css/pages/recommendations-public.css?v=20261008-1" rel="stylesheet"/>
<script defer src="/assets/js/head.js"></script>
<script type="application/ld+json">${json(schema)}</script>
</head>
<body class="globalOnlyPage ${bodyClass}" data-page-language="${lang}" data-page-type="recommendations_public">
<div class="container"><div data-current-lang="${lang}" id="siteHeader"></div>`;
}

function foot(extra = '') {
  return `<div id="siteFooter"></div></div>
<script defer src="/assets/js/includes.js?v=1"></script>
<script defer src="/assets/js/site.js?v=34"></script>
${extra}
</body></html>`;
}

function card(partner, lang) {
  const t = ui[lang];
  const copy = partner[lang];
  const href = profilePath(partner, lang);
  const searchText = [copy.name, copy.kicker, copy.summary, ...copy.bestFor, ...copy.tags].join(' ');
  return `<article class="guideCard" data-partner-card data-category="${partner.category.join(' ')}" data-types="${partner.types.join(' ')}" data-price="${partner.priceLevel}" data-early="${partner.earlyStart}" data-order="${partner.sortPriority}" data-verified="${partner.verified}" data-name="${esc(copy.name)}" data-search="${esc(searchText)}">
  <div class="guideCardMedia"><img src="${partner.image}" alt="${esc(copy.name + ' in Mindo, Ecuador')}" loading="lazy" decoding="async"/><div class="guideCardBadges"><span class="guideBadge">${esc(copy.disclosure.split(' · ')[0])}</span><span class="guideBadge guideBadge--price" aria-label="${partner.priceLevel} of 5 price level">${money(partner.priceLevel)}</span></div></div>
  <div class="guideCardBody"><p class="guideCardKicker">${esc(copy.kicker)}</p><h3>${esc(copy.name)}</h3><p class="guideCardSummary">${esc(copy.summary)}</p><p class="guideCardWhy"><strong>${t.why}:</strong> ${esc(copy.why)}</p><div class="tagRow">${copy.tags.slice(0,4).map(tag => `<span class="fieldTag">${esc(tag)}</span>`).join('')}</div><div class="guideCardFoot"><span class="verifiedLine">${t.verified} ${isoPretty(partner.verified)}</span><a class="fieldLink" href="${href}">${t.view} →</a></div></div>
</article>`;
}

function directorySchema(lang) {
  const t = ui[lang];
  const canonical = absolute(t.base);
  return {'@context':'https://schema.org','@graph':[
    {'@type':'CollectionPage','@id':canonical+'#webpage',url:canonical,name:t.heading,description:t.description,inLanguage:lang,dateModified:data.lastUpdated,isPartOf:{'@id':'https://mindobirdwatching.com/#website'}},
    {'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:lang==='en'?'Home':'Inicio',item:absolute(t.home)},{'@type':'ListItem',position:2,name:lang==='en'?'Recommendations':'Recomendaciones',item:canonical}]},
    {'@type':'ItemList','@id':canonical+'#itemlist',name:lang==='en'?'Curated Mindo recommendations':'Recomendaciones curadas de Mindo',numberOfItems:data.partners.length,itemListElement:data.partners.map((partner,index)=>({'@type':'ListItem',position:index+1,name:partner[lang].name,url:absolute(profilePath(partner,lang))}))},
    {'@type':'FAQPage','@id':canonical+'#faq',mainEntity:t.faqs.map(([question,answer])=>({'@type':'Question',name:question,acceptedAnswer:{'@type':'Answer',text:answer}}))}
  ]};
}

function directoryPage(lang) {
  const t = ui[lang];
  const canonical = absolute(t.base);
  const alternate = absolute(t.altBase);
  const categoryButtons = [[t.all,'all'],[t.stays,'stay'],[t.food,'food'],[t.experiences,'experience'],[t.services,'service']];
  return head({lang,title:t.title,description:t.description,canonical,alternate,image:'/MBW-Assets-OG-Image.jpg',schema:directorySchema(lang),bodyClass:'recommendationsDirectoryPage'}) + `
<main class="page" data-recommendations-directory>
  <section class="fieldHero"><div><p class="fieldEyebrow">${t.eyebrow}</p><h1>${t.heading}</h1><p class="fieldHeroLead">${t.lead}</p></div><aside class="fieldHeroAside"><strong>${t.asideTitle}</strong><ul>${t.aside.map(item=>`<li>${item}</li>`).join('')}</ul></aside></section>
  <section class="fieldTrust" aria-label="Guide standards">${t.trust.map(([a,b])=>`<div><strong>${a}</strong><span>${b}</span></div>`).join('')}</section>
  <section class="fieldSection"><div class="fieldSectionHead"><div><p class="fieldEyebrow">${lang==='en'?'TRIP MATCHER':'BUSCADOR DE VIAJE'}</p><h2>${t.browse}</h2><p>${t.browseHint}</p></div></div>
    <div class="directoryControls" aria-label="Recommendation filters"><div class="directoryControlRow"><input class="directorySearch" type="search" data-directory-search placeholder="${t.search}" aria-label="${t.search}"/><select class="directorySort" data-directory-sort aria-label="${t.sort}">${t.sortOptions.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></div>
      <div class="directoryControlRow"><span class="filterLabel">${t.category}</span>${categoryButtons.map(([label,value],index)=>`<button class="filterChip" type="button" data-filter-category="${value}" aria-pressed="${index===0?'true':'false'}">${label}</button>`).join('')}</div>
      <div class="directoryControlRow"><span class="filterLabel">${t.type}</span><button class="filterChip" type="button" data-filter-type="all" aria-pressed="true">${t.all}</button>${t.types.map(([value,label])=>`<button class="filterChip" type="button" data-filter-type="${value}" aria-pressed="false">${label}</button>`).join('')}</div>
    </div>
    <div class="directoryStatus"><span>${t.showing} <strong data-directory-count>${data.partners.length}</strong> ${t.partners}</span><span>${lang==='en'?'Updated':'Actualizado'} ${data.lastUpdated}</span></div>
    <div class="directoryGrid" data-directory-grid>${data.partners.map(partner=>card(partner,lang)).join('')}</div><p class="directoryEmpty" data-directory-empty hidden>${t.empty}</p>
  </section>
  <section class="fieldSection"><div class="fieldSectionHead"><div><h2>${t.methodTitle}</h2><p>${t.methodHint}</p></div></div><div class="methodGrid">${t.methods.map(([title,text])=>`<div class="methodCard"><strong>${title}</strong><p>${text}</p></div>`).join('')}</div><div class="fieldSectionHead" style="margin-top:30px"><div><h2>${t.priceTitle}</h2><p>${t.priceHint}</p></div></div><div class="priceGuide">${t.priceLabels.map((label,index)=>`<div><strong>${'$'.repeat(index+1)}</strong><span>${label}</span></div>`).join('')}</div></section>
  <section class="fieldSection fieldFaq" id="faq"><div class="fieldSectionHead"><h2>${t.faqTitle}</h2></div>${t.faqs.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</section>
  <section class="fieldCta"><div><h2>${t.ctaTitle}</h2><p>${t.ctaText}</p></div><div class="fieldActions"><a class="fieldButton fieldButton--light" href="${t.contact}">${t.ask}</a><a class="fieldButton" href="${t.book}">${t.bookTour}</a></div></section>
</main>` + foot('<script defer src="/assets/js/recommendations-directory.js?v=20261008-1"></script>');
}

function categoryLabel(partner, lang) {
  const map = lang === 'en' ? {stay:'Stay',food:'Food & drink',experience:'Experience',service:'Service'} : {stay:'Hospedaje',food:'Comida',experience:'Experiencia',service:'Servicio'};
  return partner.category.map(value=>map[value]).join(' · ');
}

function profileSchema(partner, lang) {
  const t = ui[lang];
  const copy = partner[lang];
  const canonical = absolute(profilePath(partner,lang));
  const entityId = canonical + '#partner';
  return {'@context':'https://schema.org','@graph':[
    {'@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:`${copy.name} | ${copy.kicker}`,description:copy.summary,inLanguage:lang,dateModified:data.lastUpdated,isPartOf:{'@id':'https://mindobirdwatching.com/#website'},about:{'@id':entityId}},
    {'@type':'BreadcrumbList','@id':canonical+'#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:lang==='en'?'Home':'Inicio',item:absolute(t.home)},{'@type':'ListItem',position:2,name:t.profile.crumb,item:absolute(t.base)},{'@type':'ListItem',position:3,name:copy.name,item:canonical}]},
    {'@type':partner.entityType || 'LocalBusiness','@id':entityId,name:copy.name,url:partner.officialSite,image:partner.images.map(img=>absolute(img.src)),description:copy.summary,address:{'@type':'PostalAddress',addressLocality:'Mindo',addressRegion:'Pichincha',addressCountry:'EC'},areaServed:{'@type':'Place',name:'Mindo, Ecuador'},sameAs:[partner.officialSite]}
  ]};
}

function profilePage(partner, lang) {
  const t = ui[lang];
  const p = t.profile;
  const copy = partner[lang];
  const canonical = absolute(profilePath(partner,lang));
  const alternate = absolute(profilePath(partner,lang === 'en' ? 'es' : 'en'));
  const title = `${copy.name} in Mindo, Ecuador | ${copy.kicker}`;
  return head({lang,title,description:copy.summary,canonical,alternate,image:partner.image,schema:profileSchema(partner,lang),bodyClass:'recommendationProfilePage'}) + `
<main class="page">
  <section class="profileHero"><img src="${partner.image}" alt="${esc(partner.images[0][lang==='en'?'altEn':'altEs'])}" fetchpriority="high"/><div class="profileHeroContent"><p class="fieldEyebrow">${esc(copy.kicker)}</p><h1>${esc(copy.name)}</h1><p class="profileHeroLead">${esc(copy.summary)}</p><div class="profileBadges"><span class="profileBadge">${esc(copy.disclosure)}</span><span class="profileBadge" aria-label="${partner.priceLevel} of 5 price level">${money(partner.priceLevel)}</span></div></div></section>
  <section class="profileSection"><div class="profileFacts"><div class="profileFact"><span>${p.facts[0]}</span><strong>${categoryLabel(partner,lang)}</strong></div><div class="profileFact"><span>${p.facts[1]}</span><strong>${'$'.repeat(partner.priceLevel)} / $$$$$</strong></div><div class="profileFact"><span>${p.facts[2]}</span><strong>${esc(copy.bestFor.slice(0,2).join(' · '))}</strong></div><div class="profileFact"><span>${p.facts[3]}</span><strong>${partner.verified}</strong></div></div></section>
  <section class="profileSection"><div class="fieldSectionHead"><h2>${p.why}</h2></div><div class="profileSplit"><div class="profileQuote">“${esc(copy.why)}”</div><div class="profileNote"><strong>${p.know}</strong><p>${esc(copy.knowBefore)}</p></div></div></section>
  <section class="profileSection"><div class="fieldSectionHead"><div><h2>${p.fit}</h2><p class="profileSectionLead">${lang==='en'?'The practical details that generic booking cards usually miss.':'Los detalles prácticos que normalmente no aparecen en una ficha de reservas.'}</p></div></div><div class="profileFitGrid">${[copy.early,copy.pickup,copy.food,copy.pace].map((text,index)=>`<div class="profileFit"><strong>${p.fitLabels[index]}</strong><p>${esc(text)}</p></div>`).join('')}</div></section>
  <section class="profileSection"><div class="fieldSectionHead"><h2>${p.stands}</h2></div><div class="tagRow">${copy.tags.map(tag=>`<span class="fieldTag">${esc(tag)}</span>`).join('')}</div><div class="fieldSectionHead" style="margin-top:30px"><h2>${p.gallery}</h2></div><div class="profileGallery">${partner.images.map(image=>`<figure><img src="${image.src}" alt="${esc(image[lang==='en'?'altEn':'altEs'])}" loading="lazy" decoding="async"/></figure>`).join('')}</div><p class="profileSource">${p.source}</p></section>
  <section class="fieldCta"><div><h2>${p.plan}</h2><p>${p.planText}</p></div><div class="fieldActions"><a class="fieldButton fieldButton--light" href="${partner.bookingUrl || partner.officialSite}" target="_blank" rel="noopener">${p.reserve}</a><a class="fieldButton" href="${t.contact}">${p.ask}</a></div></section>
  <section class="profileSection"><div class="fieldActions"><a class="fieldButton fieldButton--outline" href="${partner.officialSite}" target="_blank" rel="noopener">${p.official} ↗</a><a class="fieldLink" href="${t.base}">← ${p.crumb}</a></div><p class="profileDisclosure"><strong>${p.disclosure}:</strong> ${esc(copy.disclosure)}. ${lang==='en'?'Mindo Bird Watching may coordinate guests with this partner, but the profile is written for traveler usefulness and does not publish confidential rates.':'Mindo Bird Watching puede coordinar huéspedes con este socio, pero el perfil se redacta por utilidad para el viajero y no publica tarifas confidenciales.'}</p></section>
</main>` + foot();
}

function write(relativePath, contents) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.writeFileSync(target, contents);
  console.log(relativePath);
}

write('recommendations/index.html', directoryPage('en'));
write('es/recomendaciones/index.html', directoryPage('es'));

for (const partner of data.partners.filter(item => item.profile)) {
  write(`recommendations/${partner.slug}/index.html`, profilePage(partner,'en'));
  write(`es/recomendaciones/${partner.slug}/index.html`, profilePage(partner,'es'));
}
