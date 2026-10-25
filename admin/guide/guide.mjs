import { mountTripBuilder, renderTripQuoteRequests } from "./trip-builder.mjs";

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const LANGUAGE_KEY = "mbw-guide-language-v1";
const TIP_URL = "https://mindobirdwatching.com/tip-your-guide/";
const COPY = {
  es: {
    private: "Privado", opening: "Abriendo el Nido", loadingTours: "Cargando tus tours asignados.", unavailable: "Guide Nest no está disponible", retry: "Intentar de nuevo",
    bookedAssignments: "Tours reservados", myTours: "Mis tours", auditMode: "Modo de auditoría · Solo lectura", returnNest: "Volver a MBW Nest", previewGuide: "Guide View", previewNote: "Elige un guía para revisar exactamente los datos que recibe. Las acciones del guía permanecen desactivadas.",
    privacy: "Los datos de contacto aparecen solo cuando el tour está reservado. No se comparten precios, pagos, notas internas ni el CRM.", assignedOnly: "Solo tours asignados", calendar: "Calendario", monthView: "Mes", listView: "Lista", currentFuture: "Actuales y futuros", includePast: "Incluir pasados", tourDays: "Tours", blockedDays: "No disponible", previousMonth: "Mes anterior", nextMonth: "Mes siguiente", viewingDate: "Mostrando", clearDate: "Ver todos",
    afterTour: "Después del tour", sightings: "Avistamientos", submitReport: "Enviar reporte de avistamientos", reportHelp: "Crea la lista de la ruta, registra las aves vistas o escuchadas y envía el reporte a MBW.",
    tourReference: "Tour de referencia", openReport: "Abrir reporte", historyEyebrow: "Tu historial", previousReports: "Reportes anteriores", historyLoading: "Cargando reportes anteriores…",
    guestFollowup: "Seguimiento para huéspedes", shareIntro: "Elige un mensaje después del tour. Cada botón copia una nota breve con el enlace oficial de MBW.", tours: "Tours",
    booked: "Reservado", completed: "Completado", pending: "Pendiente", scheduled: "Confirmado", dateTime: "Fecha y hora", service: "Servicio", pickup: "Recogida", pickupMissing: "Punto de recogida pendiente", country: "País", guests: "Personas", phone: "Teléfono", unavailablePhone: "No disponible",
    whatsapp: "WhatsApp", copyGuest: "Copiar mensaje", report: "Reporte", openCalendar: "Abrir calendario", noTours: "No hay tours reservados asignados", chooseGuide: "Elige un guía para revisar sus tours reservados.",
    datePending: "Fecha pendiente", timePending: "Hora pendiente", noCalendar: "No hay tours reservados para mostrar en el calendario.", noTour: "No hay un tour reservado disponible", copied: "Copiado",
    noReports: "Todavía no hay reportes anteriores.", historyUnlinked: "El historial aparecerá cuando el número de colaborador esté vinculado a esta cuenta.", historyUnavailable: "No se pudieron cargar los reportes anteriores.", reports: "reportes",
    species: "especies", observations: "registros", reference: "Referencia", reportRecorded: "Reporte enviado", googleTitle: "Reseña en Google", googleSub: "Solicitar una reseña", tripTitle: "Tripadvisor", tripSub: "Solicitar una reseña",
    instagram: "Instagram", instagramSub: "Compartir novedades", facebook: "Facebook", facebookSub: "Compartir la página de MBW", youtube: "YouTube", youtubeSub: "Compartir el canal de MBW", shop: "Tienda MBW", shopSub: "Compartir la tienda oficial", copy: "Copiar",
    acceptTour: "Aceptar tour", awaitingAcceptance: "Por aceptar", accepted: "Aceptado", scheduleConflict: "Conflicto de horario", unavailableConflict: "Coincide con un bloqueo de disponibilidad", assignmentConflict: "Coincide con otro tour asignado", contactClosed: "Contacto cerrado", reportNeeded: "Reporte pendiente", reportSubmitted: "Reporte enviado", reportScheduled: "Reporte después del tour",
    availability: "Disponibilidad", availabilityHelp: "Bloquea las horas en que no puedes recibir asignaciones.", date: "Fecha", start: "Inicio", end: "Fin", noteOptional: "Nota opcional", blockTime: "Bloquear horario", scheduleProtection: "Protección de agenda", unavailableTimes: "Horarios no disponibles", noAvailability: "No tienes horarios bloqueados.", remove: "Quitar", availabilitySaved: "Horario bloqueado", availabilityRemoved: "Bloqueo eliminado",
    futureWork: "Próximas oportunidades", offers: "Cotizaciones", offersPrivacy: "Las solicitudes y ofertas están separadas de los tours confirmados. Solo pasan al calendario después de la aprobación del administrador.", noOffers: "No hay otras ofertas disponibles en este momento.", interested: "Me interesa", pass: "No disponible", bidOptional: "Tarifa opcional (USD)", responseSaved: "Respuesta guardada", pendingResponse: "Sin respuesta", adminReadOnly: "La vista de administrador es de solo lectura.", tripBuilderEyebrow: "SOLICITUD DE VIAJE", addOption: "+ Agregar opción", guideSummary: "Resumen y recomendaciones del guía", close: "Cerrar", saveDraft: "Guardar borrador", submitQuote: "Enviar cotización",
    upcoming: "Próximos", allTours: "Todos los tours", sevenDays: "7 días", thirtyDays: "30 días", allDates: "Todos", searchTours: "Buscar tours", searchPlaceholder: "Huésped, servicio, país o recogida", today: "Hoy", tomorrow: "Mañana", nextTour: "Próximo tour", needsAttention: "requieren atención", allSet: "Todo al día", showingTours: "tours visibles", noMatchingTours: "No hay tours que coincidan con estos filtros.", lastSynced: "Sincronizado", openMap: "Abrir mapa", tip: "Propina", shareLinks: "Compartir enlaces",
  },
  en: {
    private: "Private", opening: "Opening Guide Nest", loadingTours: "Loading your assigned tours.", unavailable: "Guide Nest unavailable", retry: "Try again",
    bookedAssignments: "Booked assignments", myTours: "My Tours", auditMode: "Audit mode · Read only", returnNest: "Return to MBW Nest", previewGuide: "Guide View", previewNote: "Choose a guide to review exactly the data they receive. Guide actions remain disabled.",
    privacy: "Guest contact appears only after the tour is booked. Internal CRM, pricing, payments, and notes are not shared.", assignedOnly: "Assigned tours only", calendar: "Calendar", monthView: "Month", listView: "List", currentFuture: "Current & future", includePast: "Include past", tourDays: "Tours", blockedDays: "Unavailable", previousMonth: "Previous month", nextMonth: "Next month", viewingDate: "Showing", clearDate: "Show all",
    afterTour: "After the tour", sightings: "Sightings", submitReport: "Submit a sighting report", reportHelp: "Build a route checklist, record birds seen or heard, and submit the report to MBW.",
    tourReference: "Tour reference", openReport: "Open sighting report", historyEyebrow: "Your history", previousReports: "Previous reports", historyLoading: "Loading previous reports…",
    guestFollowup: "Guest-ready follow-up", shareIntro: "Choose one relevant message after the tour. Each button copies a short note with the verified MBW link.", tours: "Tours",
    booked: "Booked", completed: "Completed", pending: "Pending", scheduled: "Confirmed", dateTime: "Date & time", service: "Service", pickup: "Pickup", pickupMissing: "Pickup not set", country: "Country", guests: "Guests", phone: "Phone", unavailablePhone: "Not available",
    whatsapp: "WhatsApp", copyGuest: "Copy guest message", report: "Sightings report", openCalendar: "Open calendar", noTours: "No booked assignments are currently assigned", chooseGuide: "Choose a guide to preview booked assignments.",
    datePending: "Date pending", timePending: "Time pending", noCalendar: "No booked assignments to place on the calendar.", noTour: "No booked tour available", copied: "Copied to clipboard",
    noReports: "No previous reports yet.", historyUnlinked: "History will appear after the contributor number is linked to this account.", historyUnavailable: "Previous reports could not be loaded.", reports: "reports",
    species: "species", observations: "observations", reference: "Reference", reportRecorded: "Report submitted", googleTitle: "Google review", googleSub: "Request a Google review", tripTitle: "Tripadvisor", tripSub: "Request a Tripadvisor review",
    instagram: "Instagram", instagramSub: "Share birding updates", facebook: "Facebook", facebookSub: "Share the MBW page", youtube: "YouTube", youtubeSub: "Share the MBW channel", shop: "MBW Shop", shopSub: "Share the official shop", copy: "Copy",
    acceptTour: "Accept tour", awaitingAcceptance: "Awaiting acceptance", accepted: "Accepted", scheduleConflict: "Schedule conflict", unavailableConflict: "Overlaps an unavailable block", assignmentConflict: "Overlaps another assigned tour", contactClosed: "Contact closed", reportNeeded: "Report needed", reportSubmitted: "Report submitted", reportScheduled: "Report after tour",
    availability: "Availability", availabilityHelp: "Block times when you cannot receive assignments.", date: "Date", start: "Start", end: "End", noteOptional: "Optional note", blockTime: "Block time", scheduleProtection: "Schedule protection", unavailableTimes: "Unavailable times", noAvailability: "You have no unavailable times.", remove: "Remove", availabilitySaved: "Time blocked", availabilityRemoved: "Block removed",
    futureWork: "Future opportunities", offers: "Quotes", offersPrivacy: "Quote requests and offers remain separate from confirmed tours. They enter the calendar only after admin approval.", noOffers: "No other tour offers are available right now.", interested: "Interested", pass: "Pass", bidOptional: "Optional bid (USD)", responseSaved: "Response saved", pendingResponse: "No response", adminReadOnly: "Admin preview is read-only.", tripBuilderEyebrow: "TRIP REQUEST", addOption: "+ Add option", guideSummary: "Guide summary and recommendations", close: "Close", saveDraft: "Save draft", submitQuote: "Submit quote",
    upcoming: "Upcoming", allTours: "All tours", sevenDays: "7 days", thirtyDays: "30 days", allDates: "All", searchTours: "Search tours", searchPlaceholder: "Guest, service, country, or pickup", today: "Today", tomorrow: "Tomorrow", nextTour: "Next tour", needsAttention: "need attention", allSet: "All set", showingTours: "tours shown", noMatchingTours: "No tours match these filters.", lastSynced: "Last synced", openMap: "Open map", tip: "Tip", shareLinks: "Share links",
  },
};

let language = localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "es";
let data;
let reports = [];
let reportsLinked = true;
let reportsLoaded = false;
let reportsLoading = false;
let toastTimer;
let tourView = localStorage.getItem("mbw-guide-tour-view") === "all" ? "all" : "upcoming";
let tourRange = ["7", "30", "all"].includes(localStorage.getItem("mbw-guide-tour-range")) ? localStorage.getItem("mbw-guide-tour-range") : "7";
let tourSearch = "";
let calendarView = localStorage.getItem("mbw-guide-calendar-view") === "list" ? "list" : "month";
let calendarScope = localStorage.getItem("mbw-guide-calendar-scope") === "all" ? "all" : "upcoming";
let calendarMonth = todayInEcuador().slice(0, 7);
let selectedCalendarDate = "";
let selectedAssignmentId = "";
const t = key => COPY[language][key] || key;
const icon = name => `<span class="buttonIcon buttonIcon--${name}" aria-hidden="true"></span>`;
const empty = message => `<div class="empty">${esc(message)}</div>`;

function dateLabel(value) {
  if (!value) return t("datePending");
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat(language === "es" ? "es-EC" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function todayInEcuador() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}

function dateGroupLabel(value) {
  if (!value) return t("datePending");
  const today = todayInEcuador();
  if (value === today) return t("today");
  if (value === addDays(today, 1)) return t("tomorrow");
  return dateLabel(value);
}

function shiftMonth(value, offset) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function renderCalendar() {
  if (!data) return;
  document.querySelectorAll("[data-calendar-view]").forEach(button => button.classList.toggle("active", button.dataset.calendarView === calendarView));
  $("#calendarMonthPanel").hidden = calendarView !== "month";
  $("#calendarList").hidden = calendarView !== "list";
  $("#calendarScopeSwitch").hidden = calendarView !== "list";
  document.querySelectorAll("[data-calendar-scope]").forEach(button => button.classList.toggle("active", button.dataset.calendarScope === calendarScope));

  const calendarTours = calendarScope === "all" ? data.tours : data.tours.filter(tour => !tour.serviceDate || tour.serviceDate >= todayInEcuador());
  const groups = Map.groupBy ? Map.groupBy(calendarTours, item => item.serviceDate || "pending") : calendarTours.reduce((map, item) => map.set(item.serviceDate || "pending", [...(map.get(item.serviceDate || "pending") || []), item]), new Map());
  $("#calendarList").innerHTML = calendarTours.length ? [...groups.entries()].map(([, tours]) => `<section class="dateGroup"><h2>${esc(dateLabel(tours[0].serviceDate))}</h2>${tours.map(tour => `<button type="button" class="dateItem" data-open-tour="${esc(tour.assignmentId)}" data-tour-date="${esc(tour.serviceDate)}"><time>${esc(tour.startTime || t("timePending"))}</time><span><strong>${esc(tour.service)} · ${esc(tour.guestName)}</strong><small>${esc(tour.pickup || t("pickupMissing"))}</small></span><span class="dateItemArrow" aria-hidden="true">›</span></button>`).join("")}</section>`).join("") : empty(t("noCalendar"));

  const [year, month] = calendarMonth.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingDays = (monthStart.getUTCDay() + 6) % 7;
  const monthName = new Intl.DateTimeFormat(language === "es" ? "es-EC" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart);
  $("#calendarMonthLabel").textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const weekdays = language === "es" ? ["L", "M", "M", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"];
  $("#calendarWeekdays").innerHTML = weekdays.map(day => `<span>${day}</span>`).join("");
  const toursByDate = new Map();
  for (const tour of data.tours) if (tour.serviceDate) toursByDate.set(tour.serviceDate, (toursByDate.get(tour.serviceDate) || 0) + 1);
  const blockedDates = new Set((data.availability || []).map(item => item.serviceDate).filter(Boolean));
  const cells = Array.from({ length: leadingDays }, () => '<span class="calendarDay calendarDay--empty" aria-hidden="true"></span>');
  const today = todayInEcuador();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${calendarMonth}-${String(day).padStart(2, "0")}`;
    const tourCount = toursByDate.get(date) || 0;
    const blocked = blockedDates.has(date);
    const parts = [dateLabel(date), tourCount ? `${tourCount} ${t("tourDays")}` : "", blocked ? t("blockedDays") : ""].filter(Boolean).join(", ");
    const content = `<b>${day}</b><span class="calendarMarkers">${tourCount ? `<i class="tourDot"></i>${tourCount > 1 ? `<em>${tourCount}</em>` : ""}` : ""}${blocked ? '<i class="blockedDot"></i>' : ""}</span>`;
    cells.push(tourCount ? `<button type="button" class="calendarDay ${date === today ? "calendarDay--today" : ""} calendarDay--busy" data-calendar-date="${date}" aria-label="${esc(parts)}">${content}</button>` : `<span class="calendarDay ${date === today ? "calendarDay--today" : ""} ${blocked ? "calendarDay--busy" : ""}" aria-label="${esc(parts)}">${content}</span>`);
  }
  $("#calendarGrid").innerHTML = cells.join("");
  const controls = document.querySelectorAll("[data-calendar-shift]");
  controls[0]?.setAttribute("aria-label", t("previousMonth"));
  controls[1]?.setAttribute("aria-label", t("nextMonth"));
}

function timeMinutes(value) {
  const match = String(value || "").trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (!match) return 1440;
  let hour = Number(match[1]);
  if (match[3] === "am" && hour === 12) hour = 0;
  if (match[3] === "pm" && hour < 12) hour += 12;
  return hour * 60 + Number(match[2]);
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
  const reference = tour.assignmentId || tour.bookingId;
  if (reference) url.searchParams.set("booking", reference);
  if (tour.assignmentId) url.searchParams.set("assignment", tour.assignmentId);
  if (tour.bookingId) url.searchParams.set("booking_id", tour.bookingId);
  if (tour.serviceDate) url.searchParams.set("date", tour.serviceDate);
  url.searchParams.set("tour_type", tourType(tour));
  if (data?.identity?.contributorNumber) url.searchParams.set("contributor", data.identity.contributorNumber);
  return url.toString();
}

function guestMessage(tour) {
  if (tour.guestMessage) return tour.guestMessage;
  const firstName = String(tour.guestName || "").split(/\s+/)[0] || "there";
  const guide = String(tour.providerName || data?.providerName || data?.identity?.name || "your guide").split(" · ")[0].trim();
  const service = String(tour.service || "tour").replace(/^\s*(?:MBW|ACT|TRANS|OSO|ACCOM)\d+\s*[-–—:]\s*/i, "").trim() || "tour";
  const date = tour.serviceDate ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${tour.serviceDate}T12:00:00Z`)) : "";
  const timeMatch = String(tour.startTime || "").trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  let time = String(tour.startTime || "").trim();
  if (timeMatch) {
    let hour = Number(timeMatch[1]);
    const suffix = timeMatch[3]?.toUpperCase() || (hour >= 12 ? "PM" : "AM");
    if (!timeMatch[3]) hour %= 12;
    time = `${hour || 12}:${timeMatch[2]} ${suffix}`;
  }
  const pickup = tour.pickup ? ` The pickup location is ${tour.pickup}.` : "";
  return `Hello ${firstName}, I’m ${guide} from Mindo Bird Watching. I’ll be your guide for the ${service}${date ? ` on ${date}` : ""}${time ? ` at ${time}` : ""}.${pickup}\n\nPlease message me here if you have any questions before the tour.\n\nThank you.`;
}

function countryFlag(code) {
  const value = String(code || "").toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? String.fromCodePoint(...[...value].map(letter => 127397 + letter.charCodeAt(0))) : "";
}

function tipMessage() {
  return `It was my pleasure being your guide. Here is the tip link you requested:\n\n${data?.links?.tip || TIP_URL}`;
}

function tourCard(tour, { next = false } = {}) {
  const phone = tour.phone && tour.contactAvailable ? `<a class="whatsapp" href="${esc(tour.whatsappUrl)}" target="_blank" rel="noopener noreferrer">${icon("whatsapp")}${t("whatsapp")}</a>` : `<button type="button" disabled>${t(tour.contactAvailable ? "unavailablePhone" : "contactClosed")}</button>`;
  const calendar = tour.calendarUrl ? `<a href="${esc(tour.calendarUrl)}" target="_blank" rel="noopener noreferrer">${icon("calendar")}${t("openCalendar")}</a>` : "";
  const map = tour.pickup ? `<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(tour.pickup)}" target="_blank" rel="noopener noreferrer">${icon("map")}${t("openMap")}</a>` : "";
  const afterTour = tour.status === "completed" || (tour.serviceDate && tour.serviceDate < todayInEcuador());
  const finalAction = afterTour ? `<button type="button" data-route="share">${icon("share")}${t("shareLinks")}</button>` : `<button type="button" data-copy="${encodeURIComponent(tipMessage())}">${icon("tip")}${t("tip")}</button>`;
  const reportLabel = reportState(tour);
  const lifecycle = tour.status === "completed" ? { key: "completed", label: t("completed") } : tour.status === "pending" ? { key: "pending", label: t("pending") } : { key: "scheduled", label: t("scheduled") };
  const conflict = tour.hasConflict ? `<div class="conflict"><b>${t("scheduleConflict")}</b><span>${t(tour.conflictReason === "availability" ? "unavailableConflict" : "assignmentConflict")}</span></div>` : "";
  const flag = countryFlag(tour.countryCode);
  const country = tour.country ? `${flag ? `${flag} ` : ""}${tour.country}` : t("unavailablePhone");
  return `<article class="tourCard tourCard--${lifecycle.key} ${tour.hasConflict ? "tourCard--conflict" : ""} ${next ? "tourCard--next" : ""}">${next ? `<div class="nextTourLabel">${t("nextTour")}</div>` : ""}<div class="tourHead"><h2>${esc(tour.guestName)}</h2><div class="tourBadges"><span class="statusBadge statusBadge--${lifecycle.key}">${esc(lifecycle.label)}</span><span class="statusBadge ${reportLabel.key === "reportSubmitted" ? "statusBadge--ok" : ""}">${t(reportLabel.key)}</span></div></div>${conflict}<div class="tourInfo"><div><small>${t("dateTime")}</small><strong>${esc(dateLabel(tour.serviceDate))}${tour.startTime ? ` · ${esc(tour.startTime)}` : ""}</strong></div><div><small>${t("service")}</small><strong>${esc(tour.service)}</strong></div><div><small>${t("pickup")}</small><strong>${esc(tour.pickup || t("pickupMissing"))}</strong></div><div><small>${t("country")}</small><strong>${esc(country)}</strong></div><div><small>${t("guests")}</small><strong>${countLabel(tour.guestCount)}</strong></div><div><small>${t("phone")}</small><strong>${esc(tour.phone || t(tour.contactAvailable ? "unavailablePhone" : "contactClosed"))}</strong></div></div><div class="tourActions">${phone}<button type="button" ${tour.contactAvailable ? `data-copy="${encodeURIComponent(guestMessage(tour))}"` : "disabled"}>${icon("copy")}${tour.contactAvailable ? t("copyGuest") : t("contactClosed")}</button>${map}<a href="${esc(reportUrl(tour))}" target="_blank" rel="noopener noreferrer">${icon("bird")}${t("report")}</a>${calendar}${finalAction}</div></article>`;
}

function reportState(tour) {
  const submitted = reports.some(report => [tour.assignmentId, tour.bookingId].filter(Boolean).includes(report.bookingReference));
  if (submitted) return { key: "reportSubmitted" };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return { key: tour.serviceDate && tour.serviceDate <= today ? "reportNeeded" : "reportScheduled" };
}

function reportEligibleTours() {
  const today = todayInEcuador();
  return (data?.tours || []).filter(tour =>
    ["confirmed", "completed"].includes(tour.status) && (!tour.serviceDate || tour.serviceDate <= today)
  );
}

function updateReportLink() {
  const reference = $("#reportTour").value;
  const tour = reportEligibleTours().find(item => (item.bookingId || item.assignmentId) === reference);
  $("#openReport").href = tour ? reportUrl(tour) : (language === "es" ? "https://mindobirdwatching.com/es/reporte-de-avistamientos/" : "https://mindobirdwatching.com/guide-tour-recap/");
}

function renderTours() {
  const today = todayInEcuador();
  const endDate = tourRange === "7" ? addDays(today, 6) : tourRange === "30" ? addDays(today, 29) : "9999-12-31";
  const query = tourSearch.trim().toLowerCase();
  let visible = selectedAssignmentId
    ? data.tours.filter(tour => tour.assignmentId === selectedAssignmentId)
    : selectedCalendarDate
      ? data.tours.filter(tour => tour.serviceDate === selectedCalendarDate)
      : data.tours.filter(tour => tourView === "all" || !tour.serviceDate || (tour.serviceDate >= today && tour.serviceDate <= endDate));
  if (!selectedCalendarDate && !selectedAssignmentId && tourView === "all" && query) visible = visible.filter(tour => [tour.guestName, tour.service, tour.country, tour.pickup].some(value => String(value || "").toLowerCase().includes(query)));
  visible.sort((left, right) => {
    const leftFuture = !left.serviceDate || left.serviceDate >= today, rightFuture = !right.serviceDate || right.serviceDate >= today;
    if (leftFuture !== rightFuture) return leftFuture ? -1 : 1;
    const dateOrder = String(left.serviceDate || "9999-12-31").localeCompare(String(right.serviceDate || "9999-12-31"));
    if (dateOrder) return leftFuture ? dateOrder : -dateOrder;
    return timeMinutes(left.startTime) - timeMinutes(right.startTime);
  });
  document.querySelectorAll("[data-tour-view]").forEach(button => button.classList.toggle("active", button.dataset.tourView === tourView));
  document.querySelectorAll("[data-tour-range]").forEach(button => button.classList.toggle("active", button.dataset.tourRange === tourRange));
  $("#tourRange").hidden = Boolean(selectedCalendarDate || selectedAssignmentId) || tourView === "all";
  $("#tourSearchWrap").hidden = Boolean(selectedCalendarDate || selectedAssignmentId) || tourView !== "all";
  if ($("#tourSearch").value !== tourSearch) $("#tourSearch").value = tourSearch;
  const attention = visible.filter(tour => tour.hasConflict || (reportsLoaded && reportState(tour).key === "reportNeeded")).length;
  const synced = data.checkedAt ? new Intl.DateTimeFormat(language === "es" ? "es-EC" : "en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(data.checkedAt)) : "—";
  const attentionLabel = language === "es" ? `${attention} ${attention === 1 ? "requiere" : "requieren"} atención` : `${attention} ${attention === 1 ? "needs" : "need"} attention`;
  const visibleLabel = language === "es" ? `${visible.length} tour${visible.length === 1 ? "" : "s"} visible${visible.length === 1 ? "" : "s"}` : `${visible.length} tour${visible.length === 1 ? "" : "s"} shown`;
  const selection = selectedCalendarDate || selectedAssignmentId ? `<span class="calendarSelection">${t("viewingDate")} ${esc(dateLabel(visible[0]?.serviceDate || selectedCalendarDate))}<button type="button" data-clear-calendar-selection>${t("clearDate")}</button></span>` : "";
  $("#tourSummary").innerHTML = `${selection}<span class="${attention ? "attentionCount" : "allSet"}">${attention ? attentionLabel : t("allSet")}</span><span>${visibleLabel}</span><span>${t("lastSynced")}: ${esc(synced)}</span>`;
  const displayGroups = visible.reduce((map, item) => map.set(item.serviceDate || "pending", [...(map.get(item.serviceDate || "pending") || []), item]), new Map());
  let cardIndex = 0;
  $("#tourList").innerHTML = visible.length ? [...displayGroups.entries()].map(([date, tours]) => `<section class="tourDateGroup"><h2>${esc(dateGroupLabel(date === "pending" ? "" : date))}</h2>${tours.map(tour => tourCard(tour, { next: !selectedCalendarDate && !selectedAssignmentId && tourView === "upcoming" && cardIndex++ === 0 })).join("")}</section>`).join("") : empty(data.tours.length ? t("noMatchingTours") : (data.providerName ? `${t("noTours")} ${data.providerName}.` : t("chooseGuide")));
  renderCalendar();
  const selected = $("#reportTour").value;
  const eligibleTours = reportEligibleTours();
  $("#reportTour").innerHTML = eligibleTours.length ? eligibleTours.map(tour => `<option value="${esc(tour.bookingId || tour.assignmentId)}" ${(tour.bookingId || tour.assignmentId) === selected ? "selected" : ""}>${esc(dateLabel(tour.serviceDate))} · ${esc(tour.guestName)} · ${t(reportState(tour).key)}</option>`).join("") : `<option value="">${t("noTour")}</option>`;
  updateReportLink();
}

function renderAvailability() {
  const canEdit = data?.identity?.role === "guide";
  $("#availabilityPanel").hidden = !canEdit;
  const rows = data?.availability || [];
  $("#availabilityList").innerHTML = rows.length ? rows.map(item => `<article class="availabilityItem"><div><strong>${esc(dateLabel(item.serviceDate))}</strong><small>${esc([item.startTime, item.endTime].filter(Boolean).join("–") || (language === "es" ? "Todo el día" : "All day"))}${item.note ? ` · ${esc(item.note)}` : ""}</small></div>${canEdit ? `<button type="button" data-remove-availability="${esc(item.assignmentId)}">${t("remove")}</button>` : ""}</article>`).join("") : empty(t("noAvailability"));
}

function renderOffers() {
  const canRespond = data?.identity?.role === "guide";
  renderTripQuoteRequests(data?.quoteRequests || [], { currentLanguage: language, readOnly: !canRespond });
  const offers = data?.offers || [];
  $("#offerList").innerHTML = offers.length ? offers.map(offer => `<article class="offerCard"><div class="offerHead"><div><h2>${esc(offer.service)}</h2><p>${esc(dateLabel(offer.serviceDate))}${offer.startTime ? ` · ${esc(offer.startTime)}` : ""}${offer.pickup ? ` · ${esc(offer.pickup)}` : ""}</p></div><span>${esc(offer.response ? t(offer.response === "pass" ? "pass" : "interested") : t("pendingResponse"))}</span></div>${canRespond ? `<label>${t("bidOptional")}<input type="number" min="1" step="0.01" inputmode="decimal" data-bid="${esc(offer.assignmentId)}" value="${esc(offer.bidAmount || "")}"></label><div class="offerActions"><button type="button" data-offer-response="interested" data-id="${esc(offer.assignmentId)}">${t("interested")}</button><button type="button" data-offer-response="pass" data-id="${esc(offer.assignmentId)}">${t("pass")}</button></div>` : `<p>${t("adminReadOnly")}</p>`}</article>`).join("") : empty(t("noOffers"));
}

function shareMessage(kind, url) {
  const messages = {
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
    if (data?.providerId || data?.providerName) url.searchParams.set("provider", data.providerId || data.providerName);
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || t("historyUnavailable"));
    reports = Array.isArray(body.reports) ? body.reports : [];
    reportsLinked = body.linked !== false;
  } catch { reports = []; reportsLinked = true; }
  finally { reportsLoading = false; reportsLoaded = true; renderHistory(); renderTours(); }
}

function renderPreview() {
  const panel = $("#adminPreview");
  panel.hidden = !data.preview;
  if (!data.preview) return;
  const options = data.providerOptions?.length ? data.providerOptions : (data.providers || []).map(name => ({ providerId: "", name }));
  $("#providerSelect").innerHTML = options.length ? options.map(item => `<option value="${esc(item.providerId || item.name)}" ${(item.providerId && item.providerId === data.providerId) || (!item.providerId && item.name === data.providerName) ? "selected" : ""}>${esc(item.name)}</option>`).join("") : `<option value="">${language === "es" ? "No hay guías" : "No guide records found"}</option>`;
}

function applyLanguage() {
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach(node => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(node => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-language]").forEach(button => button.classList.toggle("active", button.dataset.language === language));
  $("#refresh").setAttribute("aria-label", language === "es" ? "Actualizar" : "Refresh");
  if (data) { renderPreview(); renderTours(); renderAvailability(); renderOffers(); renderShare(); renderHistory(); }
}

function render() { applyLanguage(); renderPreview(); renderTours(); renderAvailability(); renderOffers(); renderShare(); renderHistory(); }

async function mutate(url, method = "POST", body = {}) {
  const response = await fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || result.verified === false) throw new Error(result.error || (language === "es" ? "No se confirmó el cambio." : "The change was not confirmed."));
  return result;
}

async function refreshCurrent() { await load(data?.providerId || data?.providerName || ""); }

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
  const params = new URLSearchParams();
  if (name !== "today") params.set("view", name);
  if (data?.preview && (data.providerId || data.providerName)) params.set("provider", data.providerId || data.providerName);
  history.replaceState({}, "", `/guide/${params.size ? `?${params}` : ""}`); scrollTo(0, 0);
  if (name === "sightings") loadReports();
}

async function copyText(text) {
  await navigator.clipboard.writeText(text); $("#toast").textContent = t("copied"); $("#toast").hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 1800);
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-route]"); if (nav) route(nav.dataset.route);
  const viewButton = event.target.closest("[data-tour-view]");
  if (viewButton) { selectedCalendarDate = ""; selectedAssignmentId = ""; tourView = viewButton.dataset.tourView; localStorage.setItem("mbw-guide-tour-view", tourView); renderTours(); }
  const rangeButton = event.target.closest("[data-tour-range]");
  if (rangeButton) { selectedCalendarDate = ""; selectedAssignmentId = ""; tourRange = rangeButton.dataset.tourRange; localStorage.setItem("mbw-guide-tour-range", tourRange); renderTours(); }
  const calendarViewButton = event.target.closest("[data-calendar-view]");
  if (calendarViewButton) { calendarView = calendarViewButton.dataset.calendarView; localStorage.setItem("mbw-guide-calendar-view", calendarView); renderCalendar(); }
  const calendarScopeButton = event.target.closest("[data-calendar-scope]");
  if (calendarScopeButton) { calendarScope = calendarScopeButton.dataset.calendarScope; localStorage.setItem("mbw-guide-calendar-scope", calendarScope); renderCalendar(); }
  const calendarShift = event.target.closest("[data-calendar-shift]");
  if (calendarShift) { calendarMonth = shiftMonth(calendarMonth, Number(calendarShift.dataset.calendarShift)); renderCalendar(); }
  const calendarDate = event.target.closest("[data-calendar-date]");
  if (calendarDate) { selectedCalendarDate = calendarDate.dataset.calendarDate; selectedAssignmentId = ""; route("today"); renderTours(); }
  const calendarTour = event.target.closest("[data-open-tour]");
  if (calendarTour) { selectedCalendarDate = calendarTour.dataset.tourDate; selectedAssignmentId = calendarTour.dataset.openTour; route("today"); renderTours(); }
  const clearCalendarSelection = event.target.closest("[data-clear-calendar-selection]");
  if (clearCalendarSelection) { selectedCalendarDate = ""; selectedAssignmentId = ""; renderTours(); }
  const copy = event.target.closest("[data-copy]"); if (copy) copyText(decodeURIComponent(copy.dataset.copy)).catch(() => alert(language === "es" ? "No se puede copiar en este navegador." : "Copy is unavailable in this browser."));
  const languageButton = event.target.closest("[data-language]");
  if (languageButton) { language = languageButton.dataset.language; localStorage.setItem(LANGUAGE_KEY, language); applyLanguage(); }
  const removeAvailability = event.target.closest("[data-remove-availability]");
  if (removeAvailability) { removeAvailability.disabled = true; mutate(`/api/guide/availability/${encodeURIComponent(removeAvailability.dataset.removeAvailability)}`, "DELETE").then(refreshCurrent).catch(error => { removeAvailability.disabled = false; alert(error.message); }); }
  const offerResponse = event.target.closest("[data-offer-response]");
  if (offerResponse) { const bid = document.querySelector(`[data-bid="${CSS.escape(offerResponse.dataset.id)}"]`)?.value || ""; offerResponse.disabled = true; mutate(`/api/guide/offers/${encodeURIComponent(offerResponse.dataset.id)}/respond`, "POST", { response: offerResponse.dataset.offerResponse, bidAmount: bid }).then(refreshCurrent).catch(error => { offerResponse.disabled = false; alert(error.message); }); }
});
$("#availabilityForm").addEventListener("submit", event => { event.preventDefault(); const form = event.currentTarget, button = form.querySelector("button"), values = Object.fromEntries(new FormData(form)); button.disabled = true; mutate("/api/guide/availability", "POST", values).then(() => { form.reset(); return refreshCurrent(); }).catch(error => { button.disabled = false; alert(error.message); }); });
$("#providerSelect").addEventListener("change", event => load(event.target.value));
$("#tourSearch").addEventListener("input", event => { tourSearch = event.target.value; renderTours(); });
$("#reportTour").addEventListener("change", updateReportLink);
$("#refresh").addEventListener("click", () => load(data?.providerId || data?.providerName || ""));
$("#retry").addEventListener("click", () => load());
mountTripBuilder({ getLanguage: () => language, onSaved: refreshCurrent });
applyLanguage();
const initialParams = new URLSearchParams(location.search);
load(initialParams.get("provider") || "").then(() => route(initialParams.get("view") || "today"));
