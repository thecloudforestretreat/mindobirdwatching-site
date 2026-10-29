const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const LANGUAGE_KEY = "mbw-guide-language-v1";
const TIP_URL = "https://mindobirdwatching.com/tip-your-guide/";
const COPY = {
  es: {
    private: "Privado", opening: "Abriendo el Nido", loadingTours: "Cargando tus tours asignados.", unavailable: "Guide Nest no está disponible", retry: "Intentar de nuevo",
    bookedAssignments: "Tours reservados", myTours: "Mis tours", auditMode: "Modo de auditoría", returnNest: "Volver a MBW Nest", previewGuide: "Guide View", previewNote: "Elige un guía para revisar su vista. Los tours y ofertas son de solo lectura; los planes personalizados son colaborativos.",
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
    futureWork: "Próximas oportunidades", offers: "Ofertas", offersPrivacy: "Las ofertas están separadas de tus tours confirmados. Solo aparecen en el calendario después de la aprobación de MBW.", noOffers: "No hay ofertas disponibles en este momento.", interested: "Me interesa", pass: "No disponible", bidOptional: "Tarifa opcional (USD)", responseSaved: "Respuesta guardada", pendingResponse: "Sin respuesta", adminReadOnly: "La vista de administrador es de solo lectura.",
    upcoming: "Próximos", allTours: "Todos los tours", sevenDays: "7 días", thirtyDays: "30 días", allDates: "Todos", searchTours: "Buscar tours", searchPlaceholder: "Huésped, servicio, país o recogida", today: "Hoy", tomorrow: "Mañana", nextTour: "Próximo tour", needsAttention: "requieren atención", allSet: "Todo al día", showingTours: "tours visibles", noMatchingTours: "No hay tours que coincidan con estos filtros.", lastSynced: "Sincronizado", openMap: "Abrir mapa", tip: "Propina", shareLinks: "Compartir enlaces",
    collaborativePlanning: "Planificación colaborativa", tourPlans: "Planes", assignedPlans: "Planes asignados", opportunities: "Oportunidades", plansPrivacy: "Solo el guía asignado y el equipo administrador de MBW pueden ver y editar estos planes. Los costos base son únicamente los proporcionados por el guía.", noPlans: "No tienes planes personalizados asignados.", guestBrief: "Información inicial", itinerary: "Itinerario", guideEstimate: "Costos base proporcionados por Neicer", protected: "Protegidos", sourceBreakdown: "Desglose proporcionado", editDay: "Editar día", dayTitle: "Título del día", dayDetails: "Actividades y detalles", dayTotal: "Costo total del día", costNote: "Nota sobre los costos", costBreakdown: "Desglose de costos", addCostLine: "Agregar costo estándar", addDate: "Agregar fecha o día", breakdownMismatch: "El desglose no coincide con el costo total del día.", additionalCosts: "Costos adicionales", noAdditionalCosts: "Todavía no hay costos adicionales.", addCost: "Agregar costo", category: "Categoría", description: "Descripción", amount: "Monto USD", day: "Día", verification: "Verificación", needsVerification: "Por verificar", estimated: "Estimado", confirmedCost: "Confirmado", transportation: "Transporte", guideCost: "Guía", food: "Alimentación", lodging: "Alojamiento", entrance: "Ingresos", reserve: "Reserva", activity: "Actividad", other: "Otro", collaboration: "Comentarios y preguntas", collaborationHelp: "Deja aquí preguntas, cambios propuestos o respuestas para el equipo MBW.", commentPlaceholder: "Escribe una pregunta o comentario para el equipo MBW", addComment: "Agregar comentario", saveDraft: "Guardar borrador", saveChanges: "Guardar cambios", submitReview: "Enviar a revisión", requestChanges: "Solicitar cambios", approvePlan: "Aprobar plan", reopenPlan: "Reabrir plan", guideDrafting: "En preparación", adminReview: "Revisión de admin", changesRequested: "Cambios solicitados", approved: "Aprobado", revisedTotal: "Total de trabajo", savedPlan: "Plan guardado", originalRequest: "Solicitud", travelerNeeds: "Viajero", pickupDropoff: "Recogida y regreso", duplicateDay: "Duplicar día", deleteDay: "Eliminar día", deleteDayConfirm: "¿Eliminar este día del itinerario?", unsavedChanges: "Cambios sin guardar", savingPlan: "Guardando…", savedAt: "Guardado", refreshConflict: "Este plan cambió en otra sesión. Actualiza la página antes de volver a guardar.", reviewIncomplete: "Completa los campos señalados y corrige los totales antes de enviar a revisión.", approvedLocked: "El plan aprobado está bloqueado. MBW debe reabrirlo para editarlo.", activityHistory: "Historial de cambios", noHistory: "Todavía no hay cambios guardados.", statusChanged: "Cambió el estado", planUpdated: "Actualizó el plan", commentAdded: "Agregó un comentario", languageEdited: "Idioma editado", translationPending: "El otro idioma puede requerir revisión.", newPlan: "Nuevo plan", adminPlanIntake: "Creación de administrador", createPlan: "Crear un plan asignado", createPlanHelp: "Crea el encargo inicial y asígnalo al guía seleccionado. El guía podrá completar días, actividades y costos desde su portal.", guestName: "Nombre del huésped", inquiryReference: "Referencia de consulta", planTitle: "Título del plan", planTitlePlaceholder: "Huésped · Itinerario personalizado", startDate: "Fecha de inicio", endDate: "Fecha final", guestCount: "Número de viajeros", dropoff: "Regreso", interests: "Intereses", assignedGuide: "Guía asignado", createAndAssign: "Crear y asignar plan", planCreated: "Plan creado y asignado", planCreatedAction: "Creó el plan",
  },
  en: {
    private: "Private", opening: "Opening Guide Nest", loadingTours: "Loading your assigned tours.", unavailable: "Guide Nest unavailable", retry: "Try again",
    bookedAssignments: "Booked assignments", myTours: "My Tours", auditMode: "Audit mode", returnNest: "Return to MBW Nest", previewGuide: "Guide View", previewNote: "Choose a guide to review their view. Tours and offers are read-only; custom plans are collaborative.",
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
    futureWork: "Future opportunities", offers: "Offers", offersPrivacy: "Offers remain separate from confirmed tours. They enter your calendar only after MBW approval.", noOffers: "No tour offers are available right now.", interested: "Interested", pass: "Pass", bidOptional: "Optional bid (USD)", responseSaved: "Response saved", pendingResponse: "No response", adminReadOnly: "Admin preview is read-only.",
    upcoming: "Upcoming", allTours: "All tours", sevenDays: "7 days", thirtyDays: "30 days", allDates: "All", searchTours: "Search tours", searchPlaceholder: "Guest, service, country, or pickup", today: "Today", tomorrow: "Tomorrow", nextTour: "Next tour", needsAttention: "need attention", allSet: "All set", showingTours: "tours shown", noMatchingTours: "No tours match these filters.", lastSynced: "Last synced", openMap: "Open map", tip: "Tip", shareLinks: "Share links",
    collaborativePlanning: "Collaborative planning", tourPlans: "Tour Plans", assignedPlans: "Assigned plans", opportunities: "Opportunities", plansPrivacy: "Only the assigned guide and MBW administrators can view or edit these plans. Base costs are limited to figures provided by the guide.", noPlans: "No custom plans are assigned to you.", guestBrief: "Guest brief", itinerary: "Itinerary", guideEstimate: "Base costs provided by Neicer", protected: "Protected", sourceBreakdown: "Provided breakdown", editDay: "Edit day", dayTitle: "Day title", dayDetails: "Activities and details", dayTotal: "Day total", costNote: "Cost note", costBreakdown: "Cost breakdown", addCostLine: "Add standard cost", addDate: "Add date or day", breakdownMismatch: "The breakdown does not match the day total.", additionalCosts: "Additional costs", noAdditionalCosts: "No additional costs have been added yet.", addCost: "Add cost", category: "Category", description: "Description", amount: "Amount USD", day: "Day", verification: "Verification", needsVerification: "Needs verification", estimated: "Estimated", confirmedCost: "Confirmed", transportation: "Transportation", guideCost: "Guide", food: "Food", lodging: "Lodging", entrance: "Entrance fees", reserve: "Reserve fee", activity: "Activity", other: "Other", collaboration: "Feedback & questions", collaborationHelp: "Use this area for questions, proposed changes, or replies to the MBW team.", commentPlaceholder: "Write a question or comment for the MBW team", addComment: "Add comment", saveDraft: "Save draft", saveChanges: "Save changes", submitReview: "Submit for review", requestChanges: "Request changes", approvePlan: "Approve plan", reopenPlan: "Reopen plan", guideDrafting: "Guide drafting", adminReview: "Admin review", changesRequested: "Changes requested", approved: "Approved", revisedTotal: "Working total", savedPlan: "Plan saved", originalRequest: "Request", travelerNeeds: "Traveler", pickupDropoff: "Pickup & return", duplicateDay: "Duplicate day", deleteDay: "Delete day", deleteDayConfirm: "Delete this itinerary day?", unsavedChanges: "Unsaved changes", savingPlan: "Saving…", savedAt: "Saved", refreshConflict: "This plan changed in another session. Refresh before saving again.", reviewIncomplete: "Complete the highlighted fields and correct the totals before submitting for review.", approvedLocked: "The approved plan is locked. MBW must reopen it before editing.", activityHistory: "Change history", noHistory: "No saved changes yet.", statusChanged: "Changed the status", planUpdated: "Updated the plan", commentAdded: "Added a comment", languageEdited: "Editing language", translationPending: "The other language may still need review.", newPlan: "New plan", adminPlanIntake: "Admin creation", createPlan: "Create an assigned plan", createPlanHelp: "Create the initial brief and assign it to the selected guide. The guide can then complete the days, activities, and costs from their portal.", guestName: "Guest name", inquiryReference: "Inquiry reference", planTitle: "Plan title", planTitlePlaceholder: "Guest · Custom itinerary", startDate: "Start date", endDate: "End date", guestCount: "Travelers", dropoff: "Return", interests: "Interests", assignedGuide: "Assigned guide", createAndAssign: "Create and assign plan", planCreated: "Plan created and assigned", planCreatedAction: "Created the plan",
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
let planDrafts = new Map();
let planView = "assigned";
let dirtyPlans = new Set();
let savingPlans = new Set();
const t = key => COPY[language][key] || key;
const localized = value => value && typeof value === "object" ? (value[language] || value.es || value.en || "") : String(value ?? "");
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
  const enabled = data?.features?.opportunities === true;
  $("#planTabs").hidden = !enabled;
  document.querySelector('[data-plan-view="opportunities"]').hidden = !enabled;
  if (!enabled) planView = "assigned";
  document.querySelectorAll("[data-plan-view]").forEach(button => button.classList.toggle("active", button.dataset.planView === planView));
  $("#assignedPlansPanel").hidden = planView !== "assigned";
  $("#opportunitiesPanel").hidden = planView !== "opportunities";
  const canRespond = data?.identity?.role === "guide";
  const offers = data?.offers || [];
  $("#offerList").innerHTML = offers.length ? offers.map(offer => `<article class="offerCard"><div class="offerHead"><div><h2>${esc(offer.service)}</h2><p>${esc(dateLabel(offer.serviceDate))}${offer.startTime ? ` · ${esc(offer.startTime)}` : ""}${offer.pickup ? ` · ${esc(offer.pickup)}` : ""}</p></div><span>${esc(offer.response ? t(offer.response === "pass" ? "pass" : "interested") : t("pendingResponse"))}</span></div>${canRespond ? `<label>${t("bidOptional")}<input type="number" min="1" step="0.01" inputmode="decimal" data-bid="${esc(offer.assignmentId)}" value="${esc(offer.bidAmount || "")}"></label><div class="offerActions"><button type="button" data-offer-response="interested" data-id="${esc(offer.assignmentId)}">${t("interested")}</button><button type="button" data-offer-response="pass" data-id="${esc(offer.assignmentId)}">${t("pass")}</button></div>` : `<p>${t("adminReadOnly")}</p>`}</article>`).join("") : empty(t("noOffers"));
}

const money = value => new Intl.NumberFormat(language === "es" ? "es-EC" : "en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const planStatusLabel = value => t({ guide_drafting: "guideDrafting", admin_review: "adminReview", changes_requested: "changesRequested", approved: "approved" }[value] || "guideDrafting");
const costCategoryLabel = value => t({ transportation: "transportation", guide: "guideCost", food: "food", lodging: "lodging", entrance: "entrance", reserve: "reserve", activity: "activity", other: "other" }[value] || "other");
const verificationLabel = value => t({ needs_verification: "needsVerification", estimated: "estimated", confirmed: "confirmedCost" }[value] || "needsVerification");

function planFor(id) {
  const source = data?.plans?.find(item => item.planId === id);
  if (!source) return null;
  if (!planDrafts.has(id)) planDrafts.set(id, structuredClone(source));
  return planDrafts.get(id);
}

const costCategories = ["transportation", "guide", "food", "lodging", "entrance", "reserve", "activity", "other"];
const sourceCostOptions = selected => costCategories.map(category => `<option value="${category}" ${category === selected ? "selected" : ""}>${esc(costCategoryLabel(category))}</option>`).join("");
const localizedDraft = value => value && typeof value === "object" ? value : { es: String(value || ""), en: String(value || "") };
const isAdmin = () => data?.identity?.role !== "guide";
const historyLabel = action => t({ plan_created: "planCreatedAction", status_changed: "statusChanged", comment_added: "commentAdded", plan_updated: "planUpdated" }[action] || "planUpdated");

function markPlanDirty(planId) {
  dirtyPlans.add(planId);
  updatePlanSaveState(planId);
}

function updatePlanSaveState(planId, savedAt = "") {
  const workspace = document.querySelector(`[data-plan="${CSS.escape(planId)}"]`);
  if (!workspace) return;
  const state = workspace.querySelector("[data-plan-save-state]");
  if (!state) return;
  if (savingPlans.has(planId)) state.textContent = t("savingPlan");
  else if (dirtyPlans.has(planId)) state.textContent = t("unsavedChanges");
  else if (savedAt) state.textContent = `${t("savedAt")} ${new Date(savedAt).toLocaleTimeString(language === "es" ? "es-EC" : "en-US", { hour: "numeric", minute: "2-digit" })}`;
  else state.textContent = "";
  workspace.classList.toggle("planWorkspace--dirty", dirtyPlans.has(planId));
}

function planValidationErrors(plan) {
  const errors = [];
  for (const day of plan.days || []) {
    if (!day.date) errors.push({ dayId: day.id, field: "date" });
    if (!localized(day.title).trim()) errors.push({ dayId: day.id, field: "title" });
    if (!localized(day.details).trim()) errors.push({ dayId: day.id, field: "details" });
    const costs = day.sourceCosts || [];
    const total = costs.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if (costs.length && Math.abs(total - Number(day.originalCost || 0)) > 0.009) errors.push({ dayId: day.id, field: "costs" });
    if (!costs.length && Number(day.originalCost || 0) > 0 && !localized(day.costNote).trim()) errors.push({ dayId: day.id, field: "costNote" });
  }
  return errors;
}

function showPlanValidation(planId, errors) {
  const workspace = document.querySelector(`[data-plan="${CSS.escape(planId)}"]`);
  workspace?.querySelectorAll(".planFieldError").forEach(node => node.classList.remove("planFieldError"));
  for (const error of errors) {
    const editor = workspace?.querySelector(`[data-plan-day-editor][data-day-id="${CSS.escape(error.dayId)}"]`);
    const field = error.field === "costs" ? editor?.querySelector(".sourceCostEditor") : editor?.querySelector(`[name="${CSS.escape(error.field)}"]`);
    field?.classList.add("planFieldError");
    editor?.closest("details")?.setAttribute("open", "");
  }
}

function syncPlanDayEditors(planId) {
  const plan = planFor(planId);
  if (!plan) return;
  document.querySelectorAll(`[data-plan-day-editor][data-plan-id="${CSS.escape(planId)}"]`).forEach(editor => {
    const day = plan.days.find(item => item.id === editor.dataset.dayId);
    if (!day) return;
    day.date = editor.querySelector('[name="date"]')?.value || day.date;
    day.title = localizedDraft(day.title); day.title[language] = editor.querySelector('[name="title"]')?.value.trim() || day.title[language];
    day.details = localizedDraft(day.details); day.details[language] = editor.querySelector('[name="details"]')?.value.trim() || "";
    day.costNote = localizedDraft(day.costNote); day.costNote[language] = editor.querySelector('[name="costNote"]')?.value.trim() || "";
    day.originalCost = Number(editor.querySelector('[name="originalCost"]')?.value || 0);
    day.sourceCosts = [...editor.querySelectorAll("[data-source-cost-row]")].map((row, index) => ({
      id: row.dataset.costId || `${day.id}-source-${index + 1}`,
      category: row.querySelector('[name="sourceCategory"]')?.value || "other",
      amount: Number(row.querySelector('[name="sourceAmount"]')?.value || 0),
    })).filter(item => item.amount > 0);
  });
  plan.days.sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));
  plan.startDate = plan.days[0]?.date || plan.startDate;
  plan.endDate = plan.days.at(-1)?.date || plan.endDate;
  plan.originalTotal = plan.days.reduce((sum, day) => sum + Number(day.originalCost || 0), 0);
}
function syncAllPlanEditors() { for (const plan of data?.plans || []) syncPlanDayEditors(plan.planId); }

function renderPlanDay(plan, day, index) {
  const sourceCosts = Array.isArray(day.sourceCosts) ? day.sourceCosts : [];
  const locked = plan.status === "approved";
  const sourceTotal = sourceCosts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const mismatch = sourceCosts.length && Math.abs(sourceTotal - Number(day.originalCost || 0)) > 0.009;
  const readCosts = sourceCosts.length ? `<dl class="sourceCosts" aria-label="${esc(t("sourceBreakdown"))}">${sourceCosts.map(item => `<div><dt>${esc(costCategoryLabel(item.category))}</dt><dd>${esc(money(item.amount))}</dd></div>`).join("")}</dl>` : "";
  const editCosts = sourceCosts.map((item, costIndex) => `<div class="sourceCostEditRow" data-source-cost-row data-cost-id="${esc(item.id || `${day.id}-source-${costIndex + 1}`)}"><label><span>${t("category")}</span><select name="sourceCategory" ${locked ? "disabled" : ""}>${sourceCostOptions(item.category)}</select></label><label><span>${t("amount")}</span><input name="sourceAmount" type="number" min="0.01" max="100000" step="0.01" inputmode="decimal" value="${esc(item.amount)}" ${locked ? "disabled" : ""}></label>${locked ? "" : `<button type="button" data-remove-source-cost data-plan-id="${esc(plan.planId)}" data-day-id="${esc(day.id)}" aria-label="${esc(t("remove"))}">×</button>`}</div>`).join("");
  const note = localized(day.costNote);
  return `<article data-plan-day="${esc(day.id)}"><time>${index + 1}<small>${esc(dateLabel(day.date))}</small></time><div><strong>${esc(localized(day.title))}</strong><p>${esc(localized(day.details))}</p>${readCosts}${note ? `<small class="sourceCostNote">${esc(note)}</small>` : ""}${mismatch ? `<small class="sourceCostWarning">${esc(t("breakdownMismatch"))}</small>` : ""}<details class="planDayEditor"><summary>${t("editDay")}</summary><div data-plan-day-editor data-plan-id="${esc(plan.planId)}" data-day-id="${esc(day.id)}"><div class="planDayFields"><label><span>${t("date")}</span><input name="date" type="date" value="${esc(day.date)}" required ${locked ? "disabled" : ""}></label><label><span>${t("dayTotal")}</span><input name="originalCost" type="number" min="0" max="100000" step="0.01" inputmode="decimal" value="${esc(day.originalCost || 0)}" ${locked ? "disabled" : ""}></label><label class="wide"><span>${t("dayTitle")}</span><input name="title" maxlength="240" value="${esc(localized(day.title))}" required ${locked ? "disabled" : ""}></label><label class="wide"><span>${t("dayDetails")}</span><textarea name="details" maxlength="1800" ${locked ? "disabled" : ""}>${esc(localized(day.details))}</textarea></label><label class="wide"><span>${t("costNote")}</span><textarea name="costNote" maxlength="500" ${locked ? "disabled" : ""}>${esc(note)}</textarea></label></div><h4>${t("costBreakdown")}</h4><div class="sourceCostEditor">${editCosts}</div>${locked ? "" : `<div class="planDayTools"><button class="addSourceCost" type="button" data-add-source-cost data-plan-id="${esc(plan.planId)}" data-day-id="${esc(day.id)}">${t("addCostLine")}</button><button type="button" data-duplicate-plan-day data-plan-id="${esc(plan.planId)}" data-day-id="${esc(day.id)}">${t("duplicateDay")}</button><button class="danger" type="button" data-delete-plan-day data-plan-id="${esc(plan.planId)}" data-day-id="${esc(day.id)}">${t("deleteDay")}</button></div>`}</div></details></div><b>${day.originalCost ? esc(money(day.originalCost)) : "—"}</b></article>`;
}

function renderPlans() {
  if (!data) return;
  const enabled = data?.features?.plans === true;
  const canCreate = enabled && isAdmin();
  $("#plansNav").hidden = !enabled;
  $("#newPlanButton").hidden = !canCreate;
  $("#newPlanGuide").textContent = data.providerName || (language === "es" ? "Selecciona un guía" : "Choose a guide");
  if (!canCreate) $("#newPlanPanel").hidden = true;
  if (!enabled) { $("#planList").innerHTML = ""; return; }
  const plans = data.plans || [];
  if (!plans.length) { $("#planList").innerHTML = empty(t("noPlans")); return; }
  $("#planList").innerHTML = plans.map((source, planIndex) => {
    const plan = planFor(source.planId);
    const locked = plan.status === "approved";
    const addedTotal = plan.adjustments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const brief = plan.brief || {};
    const dayOptions = plan.days.map(day => `<option value="${esc(day.id)}">${esc(dateLabel(day.date))} · ${esc(localized(day.title))}</option>`).join("");
    const costs = plan.adjustments.length ? plan.adjustments.map(item => `<article class="planCost"><div><strong>${esc(costCategoryLabel(item.category))} · ${esc(item.description)}</strong><small>${esc(localized(plan.days.find(day => day.id === item.dayId)?.title) || t("itinerary"))} · ${esc(verificationLabel(item.verification))} · ${esc(item.addedBy || "")}</small></div><b>${esc(money(item.amount))}</b>${locked ? "" : `<button type="button" data-remove-plan-cost="${esc(item.id)}" data-plan-id="${esc(plan.planId)}" aria-label="${esc(t("remove"))}">×</button>`}</article>`).join("") : empty(t("noAdditionalCosts"));
    const comments = plan.comments.length ? plan.comments.map(item => `<article class="planComment"><div><strong>${esc(item.author)}</strong><span>${esc(item.role === "guide" ? (language === "es" ? "Guía" : "Guide") : "MBW")}</span></div><p>${esc(item.message)}</p><small>${esc(item.createdAt ? new Date(item.createdAt).toLocaleString(language === "es" ? "es-EC" : "en-US") : "")}</small></article>`).join("") : "";
    const history = plan.history?.length ? [...plan.history].reverse().slice(0, 12).map(item => `<li><strong>${esc(item.actor)}</strong> ${esc(historyLabel(item.action))}<time>${esc(new Date(item.changedAt).toLocaleString(language === "es" ? "es-EC" : "en-US"))}</time></li>`).join("") : `<li>${esc(t("noHistory"))}</li>`;
    const actions = locked ? `<span class="planLocked">${t("approvedLocked")}</span>${isAdmin() ? `<button class="primary" type="button" data-save-plan="${esc(plan.planId)}" data-plan-status="changes_requested">${t("reopenPlan")}</button>` : ""}` : isAdmin() ? `<button type="button" data-save-plan="${esc(plan.planId)}" data-plan-status="${esc(plan.status)}">${t("saveChanges")}</button><button type="button" data-save-plan="${esc(plan.planId)}" data-plan-status="changes_requested">${t("requestChanges")}</button>${plan.status === "admin_review" ? `<button class="primary" type="button" data-save-plan="${esc(plan.planId)}" data-plan-status="approved">${t("approvePlan")}</button>` : ""}` : `<button type="button" data-save-plan="${esc(plan.planId)}" data-plan-status="guide_drafting">${t("saveDraft")}</button><button class="primary" type="button" data-save-plan="${esc(plan.planId)}" data-plan-status="admin_review">${t("submitReview")}</button>`;
    const localeStamp = plan.localeUpdatedAt?.[language];
    return `<details class="planWorkspace" data-plan="${esc(plan.planId)}" ${plans.length === 1 || planIndex === 0 ? "open" : ""}><summary class="planHero"><div><span>${esc(planStatusLabel(plan.status))}</span><h2>${esc(localized(plan.title))}</h2><p>${esc(dateLabel(plan.startDate))} – ${esc(dateLabel(plan.endDate))} · ${esc(plan.providerName)}</p></div><img src="/assets/images/app/mbw-app-gold-transparent-180.png" alt=""></summary>
      <section class="planSection"><h3>${t("guestBrief")}</h3><div class="planBrief"><div><small>${t("travelerNeeds")}</small><strong>${esc(`${brief.guestCount || "1"} · ${localized(brief.traveler)}`)}</strong></div><div><small>${t("pickupDropoff")}</small><strong>${esc(`${localized(brief.pickup)} → ${localized(brief.dropoff)}`)}</strong></div><div><small>${t("lodging")}</small><strong>${esc(localized(brief.lodging))}</strong></div><div class="wide"><small>${t("originalRequest")}</small><strong>${esc(localized(brief.request))}</strong></div><div class="wide"><small>${language === "es" ? "Intereses" : "Interests"}</small><strong>${esc(localized(brief.interests))}</strong></div></div></section>
      <section class="planSection"><div class="planSectionHead"><h3>${t("itinerary")}</h3><span>${t("guideEstimate")}: <b>${esc(money(plan.originalTotal))}</b> · ${t("protected")}</span></div><p class="planLanguageNote">${t("languageEdited")}: <b>${language === "es" ? "Español" : "English"}</b>${localeStamp ? ` · ${esc(new Date(localeStamp).toLocaleString(language === "es" ? "es-EC" : "en-US"))}` : ""}. ${t("translationPending")}</p><div class="planDays">${plan.days.map((day, index) => renderPlanDay(plan, day, index)).join("")}</div>${locked ? "" : `<button class="addPlanDay" type="button" data-add-plan-day="${esc(plan.planId)}">${t("addDate")}</button>`}</section>
      <section class="planSection"><div class="planSectionHead"><h3>${t("additionalCosts")}</h3><span>${t("revisedTotal")}: <b>${esc(money(plan.originalTotal + addedTotal))}</b></span></div><div class="planCosts">${costs}</div>${locked ? "" : `<form class="planCostForm" data-plan-cost-form="${esc(plan.planId)}"><label><span>${t("day")}</span><select name="dayId">${dayOptions}</select></label><label><span>${t("category")}</span><select name="category">${costCategories.map(category => `<option value="${category}">${esc(costCategoryLabel(category))}</option>`).join("")}</select></label><label class="wide"><span>${t("description")}</span><input name="description" maxlength="300" required></label><label><span>${t("amount")}</span><input name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></label><label><span>${t("verification")}</span><select name="verification"><option value="needs_verification">${t("needsVerification")}</option><option value="estimated">${t("estimated")}</option><option value="confirmed">${t("confirmedCost")}</option></select></label><button class="primary wide" type="submit">${t("addCost")}</button></form>`}</section>
      <section class="planSection"><h3>${t("collaboration")}</h3><p class="planSectionHelp">${t("collaborationHelp")}</p><div class="planComments">${comments}</div>${locked ? "" : `<form class="planCommentForm" data-plan-comment-form="${esc(plan.planId)}"><textarea name="message" maxlength="1000" required placeholder="${esc(t("commentPlaceholder"))}"></textarea><button type="submit">${t("addComment")}</button></form>`}</section>
      <details class="planHistory planSection"><summary>${t("activityHistory")}</summary><ol>${history}</ol></details>
      <div class="planActions"><span data-plan-save-state aria-live="polite"></span>${actions}</div></details>`;
  }).join("");
  for (const plan of plans) updatePlanSaveState(plan.planId);
}

async function savePlan(planId, status) {
  const plan = planFor(planId);
  if (!plan) return;
  syncPlanDayEditors(planId);
  if (["admin_review", "approved"].includes(status)) {
    const errors = planValidationErrors(plan);
    if (errors.length) { showPlanValidation(planId, errors); throw new Error(t("reviewIncomplete")); }
  }
  plan.status = status;
  savingPlans.add(planId); updatePlanSaveState(planId);
  const result = await mutate(`/api/guide/plans/${encodeURIComponent(planId)}`, "POST", { providerId: data.providerId, providerName: data.providerName, updatedAt: plan.updatedAt || "", editLanguage: language, status, days: plan.days, adjustments: plan.adjustments, comments: plan.comments });
  if (result.plan) planDrafts.set(planId, result.plan);
  savingPlans.delete(planId); dirtyPlans.delete(planId); updatePlanSaveState(planId, result.plan?.updatedAt || new Date().toISOString());
  $("#toast").textContent = t("savedPlan"); $("#toast").hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 1800);
  await refreshCurrent();
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
  if (data) { renderPreview(); renderTours(); renderAvailability(); renderOffers(); renderPlans(); renderShare(); renderHistory(); }
}

function render() { applyLanguage(); renderPreview(); renderTours(); renderAvailability(); renderOffers(); renderPlans(); renderShare(); renderHistory(); }

async function mutate(url, method = "POST", body = {}) {
  const response = await fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || result.verified === false) {
    const error = new Error(result.code === "PLAN_STALE" ? t("refreshConflict") : result.error || (language === "es" ? "No se confirmó el cambio." : "The change was not confirmed."));
    error.code = result.code; error.validationErrors = result.validationErrors || [];
    throw error;
  }
  return result;
}

async function refreshCurrent() { await load(data?.providerId || data?.providerName || ""); }

async function load(provider = "") {
  $("#error").hidden = true; $("#loading").hidden = false; $("#workspace").hidden = true; $("#nav").hidden = true;
  try {
    const url = new URL("/api/guide/bootstrap", location.origin); if (provider) url.searchParams.set("provider", provider);
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" }); const body = await response.json();
    if (!response.ok) throw new Error(body.error || (language === "es" ? "No se pudieron cargar los tours." : "Guide data could not load."));
    data = body; reports = []; reportsLoaded = false; reportsLoading = false; planDrafts = new Map(); dirtyPlans = new Set(); savingPlans = new Set(); if (!localStorage.getItem(LANGUAGE_KEY)) language = data.identity?.role === "guide" ? "es" : "en"; render(); $("#loading").hidden = true; $("#workspace").hidden = false; $("#nav").hidden = false;
  } catch (error) { $("#loading").hidden = true; $("#errorText").textContent = error.message; $("#error").hidden = false; }
}

function route(name) {
  if (name === "offers") { name = "plans"; planView = "opportunities"; }
  if (name === "plans" && data?.features?.plans !== true) name = "today";
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
  const planViewButton = event.target.closest("[data-plan-view]");
  if (planViewButton) { syncAllPlanEditors(); planView = planViewButton.dataset.planView; renderOffers(); }
  if (event.target.closest("#newPlanButton")) {
    const panel = $("#newPlanPanel"); panel.hidden = !panel.hidden;
    if (!panel.hidden) { const start = $("#newPlanForm [name=startDate]"); if (!start.value) { start.value = todayInEcuador(); $("#newPlanForm [name=endDate]").value = start.value; } $("#newPlanForm [name=guestName]").focus(); }
  }
  if (event.target.closest("#closeNewPlan")) $("#newPlanPanel").hidden = true;
  const clearCalendarSelection = event.target.closest("[data-clear-calendar-selection]");
  if (clearCalendarSelection) { selectedCalendarDate = ""; selectedAssignmentId = ""; renderTours(); }
  const copy = event.target.closest("[data-copy]"); if (copy) copyText(decodeURIComponent(copy.dataset.copy)).catch(() => alert(language === "es" ? "No se puede copiar en este navegador." : "Copy is unavailable in this browser."));
  const languageButton = event.target.closest("[data-language]");
  if (languageButton) { syncAllPlanEditors(); language = languageButton.dataset.language; localStorage.setItem(LANGUAGE_KEY, language); applyLanguage(); }
  const removeAvailability = event.target.closest("[data-remove-availability]");
  if (removeAvailability) { removeAvailability.disabled = true; mutate(`/api/guide/availability/${encodeURIComponent(removeAvailability.dataset.removeAvailability)}`, "DELETE").then(refreshCurrent).catch(error => { removeAvailability.disabled = false; alert(error.message); }); }
  const offerResponse = event.target.closest("[data-offer-response]");
  if (offerResponse) { const bid = document.querySelector(`[data-bid="${CSS.escape(offerResponse.dataset.id)}"]`)?.value || ""; offerResponse.disabled = true; mutate(`/api/guide/offers/${encodeURIComponent(offerResponse.dataset.id)}/respond`, "POST", { response: offerResponse.dataset.offerResponse, bidAmount: bid }).then(refreshCurrent).catch(error => { offerResponse.disabled = false; alert(error.message); }); }
  const removeSourceCost = event.target.closest("[data-remove-source-cost]");
  if (removeSourceCost) { const planId = removeSourceCost.dataset.planId; removeSourceCost.closest("[data-source-cost-row]")?.remove(); syncPlanDayEditors(planId); markPlanDirty(planId); renderPlans(); return; }
  const addSourceCost = event.target.closest("[data-add-source-cost]");
  if (addSourceCost) { const planId = addSourceCost.dataset.planId, plan = planFor(planId); syncPlanDayEditors(planId); const day = plan?.days.find(item => item.id === addSourceCost.dataset.dayId); if (day) day.sourceCosts.push({ id: crypto.randomUUID(), category: "transportation", amount: 0 }); markPlanDirty(planId); renderPlans(); return; }
  const addPlanDay = event.target.closest("[data-add-plan-day]");
  if (addPlanDay) { const planId = addPlanDay.dataset.addPlanDay, plan = planFor(planId); syncPlanDayEditors(planId); if (plan) { const latest = plan.days.map(item => item.date).filter(Boolean).sort().at(-1) || plan.endDate || todayInEcuador(); plan.days.push({ id: `day-${crypto.randomUUID()}`, date: addDays(latest, 1), title: { es: "Nuevo día por planificar", en: "New day to plan" }, details: { es: "", en: "" }, sourceCosts: [], costNote: { es: "", en: "" }, originalCost: 0 }); markPlanDirty(planId); renderPlans(); } return; }
  const duplicateDay = event.target.closest("[data-duplicate-plan-day]");
  if (duplicateDay) { const planId = duplicateDay.dataset.planId, plan = planFor(planId); syncPlanDayEditors(planId); const source = plan?.days.find(item => item.id === duplicateDay.dataset.dayId); if (source) { const copy = structuredClone(source); copy.id = `day-${crypto.randomUUID()}`; copy.date = addDays(source.date, 1); plan.days.push(copy); markPlanDirty(planId); renderPlans(); } return; }
  const deleteDay = event.target.closest("[data-delete-plan-day]");
  if (deleteDay) { const planId = deleteDay.dataset.planId, plan = planFor(planId); if (plan && plan.days.length > 1 && confirm(t("deleteDayConfirm"))) { syncPlanDayEditors(planId); plan.days = plan.days.filter(item => item.id !== deleteDay.dataset.dayId); plan.adjustments = plan.adjustments.filter(item => item.dayId !== deleteDay.dataset.dayId); markPlanDirty(planId); renderPlans(); } return; }
  const removePlanCost = event.target.closest("[data-remove-plan-cost]");
  if (removePlanCost) { const planId = removePlanCost.dataset.planId, plan = planFor(planId); syncPlanDayEditors(planId); plan.adjustments = plan.adjustments.filter(item => item.id !== removePlanCost.dataset.removePlanCost); markPlanDirty(planId); renderPlans(); }
  const savePlanButton = event.target.closest("[data-save-plan]");
  if (savePlanButton) { savePlanButton.disabled = true; const planId = savePlanButton.dataset.savePlan; savePlan(planId, savePlanButton.dataset.planStatus).catch(error => { savingPlans.delete(planId); updatePlanSaveState(planId); savePlanButton.disabled = false; alert(error.message); }); }
});
document.addEventListener("submit", event => {
  const newPlanForm = event.target.closest("#newPlanForm");
  if (newPlanForm) {
    event.preventDefault();
    const button = newPlanForm.querySelector('button[type="submit"]'), values = Object.fromEntries(new FormData(newPlanForm));
    button.disabled = true;
    mutate("/api/guide/plans", "POST", { ...values, providerId: data.providerId, providerName: data.providerName }).then(async result => {
      newPlanForm.reset(); $("#newPlanPanel").hidden = true; $("#toast").textContent = t("planCreated"); $("#toast").hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 1800); await refreshCurrent();
      if (result.plan?.planId) document.querySelector(`[data-plan="${CSS.escape(result.plan.planId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(error => { button.disabled = false; alert(error.message); });
    return;
  }
  const costForm = event.target.closest("[data-plan-cost-form]");
  if (costForm) { event.preventDefault(); const planId = costForm.dataset.planCostForm, plan = planFor(planId), values = Object.fromEntries(new FormData(costForm)); syncPlanDayEditors(planId); plan.adjustments.push({ id: crypto.randomUUID(), dayId: values.dayId, category: values.category, description: values.description.trim(), amount: Number(values.amount), verification: values.verification }); markPlanDirty(planId); renderPlans(); return; }
  const commentForm = event.target.closest("[data-plan-comment-form]");
  if (commentForm) { event.preventDefault(); const planId = commentForm.dataset.planCommentForm, plan = planFor(planId), values = Object.fromEntries(new FormData(commentForm)); syncPlanDayEditors(planId); plan.comments.push({ id: crypto.randomUUID(), message: values.message.trim() }); markPlanDirty(planId); renderPlans(); }
});
$("#availabilityForm").addEventListener("submit", event => { event.preventDefault(); const form = event.currentTarget, button = form.querySelector("button"), values = Object.fromEntries(new FormData(form)); button.disabled = true; mutate("/api/guide/availability", "POST", values).then(() => { form.reset(); return refreshCurrent(); }).catch(error => { button.disabled = false; alert(error.message); }); });
$("#providerSelect").addEventListener("change", event => { if (!dirtyPlans.size || confirm(language === "es" ? "Hay cambios sin guardar. ¿Cambiar de guía y descartarlos?" : "You have unsaved changes. Switch guides and discard them?")) load(event.target.value); else event.target.value = data.providerId || data.providerName; });
$("#tourSearch").addEventListener("input", event => { tourSearch = event.target.value; renderTours(); });
$("#newPlanForm [name=startDate]").addEventListener("change", event => { const end = $("#newPlanForm [name=endDate]"); if (!end.value || end.value < event.target.value) end.value = event.target.value; end.min = event.target.value; });
$("#reportTour").addEventListener("change", updateReportLink);
$("#refresh").addEventListener("click", () => { if (!dirtyPlans.size || confirm(language === "es" ? "Hay cambios sin guardar. ¿Actualizar y descartarlos?" : "You have unsaved changes. Refresh and discard them?")) load(data?.providerId || data?.providerName || ""); });
$("#retry").addEventListener("click", () => load());
applyLanguage();
document.addEventListener("input", event => { const workspace = event.target.closest?.("[data-plan]"); if (workspace) markPlanDirty(workspace.dataset.plan); });
window.addEventListener("beforeunload", event => { if (dirtyPlans.size) { event.preventDefault(); event.returnValue = ""; } });
const initialParams = new URLSearchParams(location.search);
load(initialParams.get("provider") || "").then(() => route(initialParams.get("view") || "today"));
