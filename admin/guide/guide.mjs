const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const LANGUAGE_KEY = "mbw-guide-language-v1";
const COPY = {
  es: {
    private: "Privado", opening: "Abriendo Guide Nest", loadingTours: "Cargando tus tours asignados.", unavailable: "Guide Nest no está disponible", retry: "Intentar de nuevo",
    bookedAssignments: "Tours reservados", myTours: "Mis tours", previewGuide: "Vista del guía", previewNote: "Esta vista muestra exactamente la información limitada que recibe el guía.",
    privacy: "Los datos de contacto aparecen solo cuando el tour está reservado. No se comparten precios, pagos, notas internas ni el CRM.", assignedOnly: "Solo tours asignados", calendar: "Calendario",
    afterTour: "Después del tour", sightings: "Avistamientos", submitReport: "Enviar reporte de avistamientos", reportHelp: "Crea la lista de la ruta, registra las aves vistas o escuchadas y envía el reporte a MBW.",
    tourReference: "Tour de referencia", openReport: "Abrir reporte", historyEyebrow: "Tu historial", previousReports: "Reportes anteriores", historyLoading: "Cargando reportes anteriores…",
    guestFollowup: "Seguimiento para huéspedes", shareIntro: "Elige un mensaje después del tour. Cada botón copia una nota breve con el enlace oficial de MBW.", tours: "Tours",
    booked: "Reservado", dateTime: "Fecha y hora", service: "Servicio", pickup: "Recogida", pickupMissing: "Punto de recogida pendiente", guests: "Personas", phone: "Teléfono", unavailablePhone: "No disponible",
    whatsapp: "WhatsApp", copyGuest: "Copiar mensaje", report: "Reporte", openCalendar: "Abrir calendario", noTours: "No hay tours reservados asignados", chooseGuide: "Elige un guía para revisar sus tours reservados.",
    datePending: "Fecha pendiente", timePending: "Hora pendiente", noCalendar: "No hay tours reservados para mostrar en el calendario.", noTour: "No hay un tour reservado disponible", copied: "Copiado",
    noReports: "Todavía no hay reportes anteriores.", historyUnlinked: "El historial aparecerá cuando el número de colaborador esté vinculado a esta cuenta.", historyUnavailable: "No se pudieron cargar los reportes anteriores.", reports: "reportes",
    species: "especies", observations: "registros", reference: "Referencia", reportRecorded: "Reporte enviado", googleTitle: "Reseña en Google", googleSub: "Solicitar una reseña", tripTitle: "Tripadvisor", tripSub: "Solicitar una reseña",
    instagram: "Instagram", instagramSub: "Compartir novedades", facebook: "Facebook", facebookSub: "Compartir la página de MBW", youtube: "YouTube", youtubeSub: "Compartir el canal de MBW", shop: "Tienda MBW", shopSub: "Compartir la tienda oficial", copy: "Copiar",
  },
  en: {
    private: "Private", opening: "Opening Guide Nest", loadingTours: "Loading your assigned tours.", unavailable: "Guide Nest unavailable", retry: "Try again",
    bookedAssignments: "Booked assignments", myTours: "My Tours", previewGuide: "Preview guide", previewNote: "This preview uses the same limited view a guide receives.",
    privacy: "Guest contact appears only after the tour is booked. Internal CRM, pricing, payments, and notes are not shared.", assignedOnly: "Assigned tours only", calendar: "Calendar",
    afterTour: "After the tour", sightings: "Sightings", submitReport: "Submit a sighting report", reportHelp: "Build a route checklist, record birds seen or heard, and submit the report to MBW.",
    tourReference: "Tour reference", openReport: "Open sighting report", historyEyebrow: "Your history", previousReports: "Previous reports", historyLoading: "Loading previous reports…",
    guestFollowup: "Guest-ready follow-up", shareIntro: "Choose one relevant message after the tour. Each button copies a short note with the verified MBW link.", tours: "Tours",
    booked: "Booked", dateTime: "Date & time", service: "Service", pickup: "Pickup", pickupMissing: "Pickup not set", guests: "Guests", phone: "Phone", unavailablePhone: "Not available",
    whatsapp: "WhatsApp", copyGuest: "Copy guest message", report: "Sightings report", openCalendar: "Open calendar", noTours: "No booked assignments are currently assigned", chooseGuide: "Choose a guide to preview booked assignments.",
    datePending: "Date pending", timePending: "Time pending", noCalendar: "No booked assignments to place on the calendar.", noTour: "No booked tour available", copied: "Copied to clipboard",
    noReports: "No previous reports yet.", historyUnlinked: "History will appear after the contributor number is linked to this account.", historyUnavailable: "Previous reports could not be loaded.", reports: "reports",
    species: "species", observations: "observations", reference: "Reference", reportRecorded: "Report submitted", googleTitle: "Google review", googleSub: "Request a Google review", tripTitle: "Tripadvisor", tripSub: "Request a Tripadvisor review",
    instagram: "Instagram", instagramSub: "Share birding updates", facebook: "Facebook", facebookSub: "Share the MBW page", youtube: "YouTube", youtubeSub: "Share the MBW channel", shop: "MBW Shop", shopSub: "Share the official shop", copy: "Copy",
  },
};

let language = localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "es";
let data;
let reports = [];
let reportsLinked = true;
let reportsLoaded = false;
let reportsLoading = false;
let toastTimer;
const t = key => COPY[language][key] || key;
const icon = name => `<span class="buttonIcon buttonIcon--${name}" aria-hidden="true"></span>`;
const empty = message => `<div class="empty">${esc(message)}</div>`;

function dateLabel(value) {
  if (!value) return t("datePending");
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat(language === "es" ? "es-EC" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function countLabel(value) {
  if (!value) return language === "es" ? "Cantidad pendiente" : "Guest count not set";
  if (language === "es") return `${esc(value)} persona${String(value) === "1" ? "" : "s"}`;
  return `${esc(value)} guest${String(value) === "1" ? "" : "s"}`;
}

function tourType(tour) {
  const value = String(tour.service || "").toLowerCase();
  if (/multi|varios d[ií]as/.test(value)) return "multi_day";
  if (/full.?day|d[ií]a completo|five toucans/.test(value)) return "full_day";
  if (/custom|privad|personaliz/.test(value)) return "custom_private";
  return "half_day";
}

function reportUrl(tour) {
  const base = language === "es" ? "https://mindobirdwatching.com/es/reporte-de-avistamientos/" : "https://mindobirdwatching.com/guide-tour-recap/";
  const url = new URL(base);
  const reference = tour.bookingId || tour.assignmentId;
  if (reference) url.searchParams.set("booking", reference);
  if (tour.serviceDate) url.searchParams.set("date", tour.serviceDate);
  url.searchParams.set("tour_type", tourType(tour));
  return url.toString();
}

function guestMessage(tour) {
  if (language === "en") return tour.guestMessage;
  const firstName = String(tour.guestName || "").split(/\s+/)[0] || "hola";
  const when = [dateLabel(tour.serviceDate), tour.startTime ? `a las ${tour.startTime}` : ""].filter(Boolean).join(" ");
  const pickup = tour.pickup ? ` El punto de recogida es ${tour.pickup}.` : "";
  return `Hola ${firstName}, soy ${data?.identity?.name || data?.providerName || "tu guía"} de Mindo Bird Watching. Seré tu guía para ${tour.service}${when ? ` el ${when}` : ""}.${pickup} Escríbeme por aquí si tienes alguna pregunta antes del tour.`;
}

function tourCard(tour) {
  const phone = tour.phone ? `<a class="whatsapp" href="${esc(tour.whatsappUrl)}" target="_blank" rel="noopener noreferrer">${icon("whatsapp")}${t("whatsapp")}</a>` : `<button type="button" disabled>${t("unavailablePhone")}</button>`;
  const calendar = tour.calendarUrl ? `<a href="${esc(tour.calendarUrl)}" target="_blank" rel="noopener noreferrer">${icon("calendar")}${t("openCalendar")}</a>` : "";
  return `<article class="tourCard"><div class="tourHead"><h2>${esc(tour.guestName)}</h2><span>${t("booked")}</span></div><div class="tourInfo"><div><small>${t("dateTime")}</small><strong>${esc(dateLabel(tour.serviceDate))}${tour.startTime ? ` · ${esc(tour.startTime)}` : ""}</strong></div><div><small>${t("service")}</small><strong>${esc(tour.service)}</strong></div><div class="wide"><small>${t("pickup")}</small><strong>${esc(tour.pickup || t("pickupMissing"))}</strong></div><div><small>${t("guests")}</small><strong>${countLabel(tour.guestCount)}</strong></div><div><small>${t("phone")}</small><strong>${esc(tour.phone || t("unavailablePhone"))}</strong></div></div><div class="tourActions">${phone}<button type="button" data-copy="${encodeURIComponent(guestMessage(tour))}">${icon("copy")}${t("copyGuest")}</button><a href="${esc(reportUrl(tour))}" target="_blank" rel="noopener noreferrer">${icon("bird")}${t("report")}</a>${calendar}</div></article>`;
}

function updateReportLink() {
  const reference = $("#reportTour").value;
  const tour = data?.tours.find(item => (item.bookingId || item.assignmentId) === reference);
  $("#openReport").href = tour ? reportUrl(tour) : (language === "es" ? "https://mindobirdwatching.com/es/reporte-de-avistamientos/" : "https://mindobirdwatching.com/guide-tour-recap/");
}

function renderTours() {
  $("#tourList").innerHTML = data.tours.length ? data.tours.map(tourCard).join("") : empty(data.providerName ? `${t("noTours")} ${data.providerName}.` : t("chooseGuide"));
  const groups = Map.groupBy ? Map.groupBy(data.tours, item => item.serviceDate || "pending") : data.tours.reduce((map, item) => map.set(item.serviceDate || "pending", [...(map.get(item.serviceDate || "pending") || []), item]), new Map());
  $("#calendarList").innerHTML = data.tours.length ? [...groups.entries()].map(([, tours]) => `<section class="dateGroup"><h2>${esc(dateLabel(tours[0].serviceDate))}</h2>${tours.map(tour => `<div class="dateItem"><time>${esc(tour.startTime || t("timePending"))}</time><div><strong>${esc(tour.service)} · ${esc(tour.guestName)}</strong><small>${esc(tour.pickup || t("pickupMissing"))}</small></div></div>`).join("")}</section>`).join("") : empty(t("noCalendar"));
  const selected = $("#reportTour").value;
  $("#reportTour").innerHTML = data.tours.length ? data.tours.map(tour => `<option value="${esc(tour.bookingId || tour.assignmentId)}" ${(tour.bookingId || tour.assignmentId) === selected ? "selected" : ""}>${esc(dateLabel(tour.serviceDate))} · ${esc(tour.guestName)}</option>`).join("") : `<option value="">${t("noTour")}</option>`;
  updateReportLink();
}

function shareMessage(kind, url) {
  const messages = language === "es" ? {
    google: `¡Gracias por acompañarnos en Mindo Bird Watching! Si disfrutaste el tour, ¿podrías compartir tu experiencia en Google? ${url}`,
    tripadvisor: `¡Gracias por explorar Mindo con nosotros! Tu reseña en Tripadvisor ayuda a otros viajeros a encontrarnos: ${url}`,
    social: `Sigue las aves y los avistamientos recientes de Mindo en Instagram: ${url}`,
    facebook: `Sigue a Mindo Bird Watching en Facebook para ver avistamientos y novedades: ${url}`,
    youtube: `Mira más aves y momentos de Mindo en nuestro canal de YouTube: ${url}`,
    shop: `¡Gracias por visitarnos! Puedes conocer la tienda de Mindo Bird Watching aquí: ${url}`,
  } : {
    google: `Thank you for joining Mindo Bird Watching! If you enjoyed your tour, would you share your experience on Google? ${url}`,
    tripadvisor: `Thank you for exploring Mindo with us! If you have a moment, your Tripadvisor review would help other travelers find us: ${url}`,
    social: `Keep following Mindo’s birds and our latest sightings on Instagram: ${url}`,
    facebook: `You can follow Mindo Bird Watching on Facebook for recent sightings and updates: ${url}`,
    youtube: `See more birds and moments from Mindo on our YouTube channel: ${url}`,
    shop: `Thank you for touring with us! You can visit the Mindo Bird Watching shop here: ${url}`,
  };
  return messages[kind];
}

function renderShare() {
  const items = [
    ["google", "https://mindobirdwatching.com/assets/images/icons/mbw_gr.png", t("googleTitle"), t("googleSub"), data.links.google],
    ["tripadvisor", "https://mindobirdwatching.com/assets/images/icons/mbw_icons_trip_advisor.png", t("tripTitle"), t("tripSub"), data.links.tripadvisor],
    ["social", "https://mindobirdwatching.com/assets/images/icons/mbw_ig.png", t("instagram"), t("instagramSub"), data.links.instagram],
    ["facebook", "https://mindobirdwatching.com/assets/images/icons/mbw_fb.png", t("facebook"), t("facebookSub"), data.links.facebook],
    ["youtube", "https://mindobirdwatching.com/assets/images/icons/mbw_yt.png", t("youtube"), t("youtubeSub"), data.links.youtube],
    ["shop", "https://mindobirdwatching.com/assets/images/icons/mbw_shop.png", t("shop"), t("shopSub"), data.links.shop],
  ];
  $("#shareList").innerHTML = items.map(([kind, image, title, subtitle, url]) => `<article class="shareCard shareCard--${kind}"><span><img src="${esc(image)}" alt=""></span><div><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></div><button class="copyButton" type="button" data-copy="${encodeURIComponent(shareMessage(kind, url))}">${icon("copy")}${t("copy")}</button></article>`).join("");
}

function renderHistory() {
  $("#reportCount").textContent = reportsLoaded && reports.length ? `${reports.length} ${t("reports")}` : "";
  if (reportsLoading) { $("#reportHistory").innerHTML = empty(t("historyLoading")); return; }
  if (!reportsLinked) { $("#reportHistory").innerHTML = empty(t("historyUnlinked")); return; }
  if (!reports.length) { $("#reportHistory").innerHTML = empty(t("noReports")); return; }
  $("#reportHistory").innerHTML = reports.map(report => `<article class="historyCard"><div><strong>${esc(report.location || t("reportRecorded"))}</strong><small>${esc(report.recapId)}</small></div><time>${esc(dateLabel(report.observedAt?.slice(0, 10)))}</time><div class="historyMeta"><span><b>${esc(report.speciesCount)}</b> ${t("species")}</span><span><b>${esc(report.totalObservations)}</b> ${t("observations")}</span>${report.bookingReference ? `<span>${t("reference")}: <b>${esc(report.bookingReference)}</b></span>` : ""}</div></article>`).join("");
}

async function loadReports() {
  if (reportsLoaded || reportsLoading) return;
  reportsLoading = true; renderHistory();
  try {
    const url = new URL("/api/guide/reports", location.origin);
    if (data?.providerName) url.searchParams.set("provider", data.providerName);
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || t("historyUnavailable"));
    reports = Array.isArray(body.reports) ? body.reports : [];
    reportsLinked = body.linked !== false;
  } catch { reports = []; reportsLinked = true; }
  finally { reportsLoading = false; reportsLoaded = true; renderHistory(); }
}

function renderPreview() {
  const panel = $("#adminPreview");
  panel.hidden = !data.preview;
  if (!data.preview) return;
  $("#providerSelect").innerHTML = data.providers.length ? data.providers.map(name => `<option value="${esc(name)}" ${name === data.providerName ? "selected" : ""}>${esc(name)}</option>`).join("") : `<option value="">${language === "es" ? "No hay guías" : "No guide records found"}</option>`;
}

function applyLanguage() {
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach(node => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll("[data-language]").forEach(button => button.classList.toggle("active", button.dataset.language === language));
  $("#refresh").setAttribute("aria-label", language === "es" ? "Actualizar" : "Refresh");
  if (data) { renderPreview(); renderTours(); renderShare(); renderHistory(); }
}

function render() { applyLanguage(); renderPreview(); renderTours(); renderShare(); renderHistory(); }

async function load(provider = "") {
  $("#error").hidden = true; $("#loading").hidden = false; $("#workspace").hidden = true; $("#nav").hidden = true;
  try {
    const url = new URL("/api/guide/bootstrap", location.origin); if (provider) url.searchParams.set("provider", provider);
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" }); const body = await response.json();
    if (!response.ok) throw new Error(body.error || (language === "es" ? "No se pudieron cargar los tours." : "Guide data could not load."));
    data = body; reports = []; reportsLoaded = false; reportsLoading = false; render(); $("#loading").hidden = true; $("#workspace").hidden = false; $("#nav").hidden = false;
  } catch (error) { $("#loading").hidden = true; $("#errorText").textContent = error.message; $("#error").hidden = false; }
}

function route(name) {
  document.querySelectorAll(".view").forEach(view => { view.hidden = view.dataset.view !== name; });
  document.querySelectorAll(".nav button").forEach(button => button.classList.toggle("active", button.dataset.route === name));
  history.replaceState({}, "", name === "today" ? "/guide/" : `/guide/?view=${name}`); scrollTo(0, 0);
  if (name === "sightings") loadReports();
}

async function copyText(text) {
  await navigator.clipboard.writeText(text); $("#toast").textContent = t("copied"); $("#toast").hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 1800);
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-route]"); if (nav) route(nav.dataset.route);
  const copy = event.target.closest("[data-copy]"); if (copy) copyText(decodeURIComponent(copy.dataset.copy)).catch(() => alert(language === "es" ? "No se puede copiar en este navegador." : "Copy is unavailable in this browser."));
  const languageButton = event.target.closest("[data-language]");
  if (languageButton) { language = languageButton.dataset.language; localStorage.setItem(LANGUAGE_KEY, language); applyLanguage(); }
});
$("#providerSelect").addEventListener("change", event => load(event.target.value));
$("#reportTour").addEventListener("change", updateReportLink);
$("#refresh").addEventListener("click", () => load(data?.providerName || ""));
$("#retry").addEventListener("click", () => load());
applyLanguage();
load().then(() => route(new URLSearchParams(location.search).get("view") || "today"));
