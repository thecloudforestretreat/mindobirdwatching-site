const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
const labels = {
  es: {
    new: "Nueva", draft: "Borrador", submitted: "Enviada", approved: "Aprobada", revision_requested: "Revisión solicitada", declined: "No disponible", prepare: "Preparar cotización", review: "Revisar cotización",
    request: "Resumen de la solicitud", requirements: "Requisitos", checks: "Pendientes y verificaciones", suggested: "Estructura sugerida", party: "Pasajeros", dates: "Fechas", noRequests: "No hay solicitudes de viaje para cotizar.",
    option: "Opción", optionName: "Nombre de la opción", style: "Tipo de servicio", private: "Privado", shared: "Compartido", recommended: "Recomendado", optionSummary: "Resumen de esta opción", addDay: "+ Agregar día", duplicate: "Duplicar", remove: "Eliminar",
    day: "Día", date: "Fecha", title: "Título del día", start: "Inicio / recogida", end: "Final / regreso", startTime: "Hora de salida", endTime: "Hora aproximada de regreso", agenda: "Agenda operativa", drive: "Tiempo estimado en vehículo", walking: "Minutos totales caminando", longest: "Caminata continua más larga", terrain: "Terreno, pendientes y escaleras", rest: "Paradas y descansos", suitability: "¿Es apropiado para las limitaciones indicadas?", yes: "Sí", modified: "Sí, con modificaciones", no: "No", unknown: "Pendiente", accessibility: "Modificaciones o notas de accesibilidad", inclusions: "Incluye", exclusions: "No incluye", verification: "Disponibilidad o detalles por verificar",
    costs: "Costos netos", addCost: "+ Agregar costo", category: "Categoría", description: "Descripción", amount: "Monto", quantity: "Cantidad", basis: "Base", costStatus: "Estado", included: "Incluido", confirmed: "Confirmado", estimate: "Estimado", verify: "Verificar", unavailable: "No disponible", total: "Total neto", pending: "pendientes",
    guide: "Guía", transport: "Transporte", entrance: "Entradas", accommodation: "Hospedaje", meal: "Alimentación", activity: "Actividad", other: "Otro", totalBasis: "Total", perDay: "Por día", perVehicle: "Por vehículo", perPerson: "Por persona", perRoomNight: "Por habitación/noche", perPersonDay: "Por persona/día", saved: "Borrador guardado", sent: "Cotización enviada", saving: "Guardando…",
  },
  en: {
    new: "New", draft: "Draft", submitted: "Submitted", approved: "Approved", revision_requested: "Revision requested", declined: "Unavailable", prepare: "Prepare quote", review: "Review quote",
    request: "Request summary", requirements: "Requirements", checks: "Pending checks", suggested: "Suggested structure", party: "Travelers", dates: "Dates", noRequests: "No custom trip requests need a quote.",
    option: "Option", optionName: "Option name", style: "Service style", private: "Private", shared: "Shared", recommended: "Recommended", optionSummary: "Option summary", addDay: "+ Add day", duplicate: "Duplicate", remove: "Remove",
    day: "Day", date: "Date", title: "Day title", start: "Start / pickup", end: "End / drop-off", startTime: "Start time", endTime: "Approximate finish", agenda: "Operational agenda", drive: "Estimated driving time", walking: "Total walking minutes", longest: "Longest continuous walk", terrain: "Terrain, inclines, and steps", rest: "Rest stops", suitability: "Is this suitable for the stated limitations?", yes: "Yes", modified: "Yes, with modifications", no: "No", unknown: "Pending", accessibility: "Accessibility modifications or notes", inclusions: "Included", exclusions: "Not included", verification: "Availability or details to verify",
    costs: "Net costs", addCost: "+ Add cost", category: "Category", description: "Description", amount: "Amount", quantity: "Quantity", basis: "Basis", costStatus: "Status", included: "Included", confirmed: "Confirmed", estimate: "Estimate", verify: "Verify", unavailable: "Unavailable", total: "Net total", pending: "pending",
    guide: "Guide", transport: "Transportation", entrance: "Entrance", accommodation: "Accommodation", meal: "Meals", activity: "Activity", other: "Other", totalBasis: "Total", perDay: "Per day", perVehicle: "Per vehicle", perPerson: "Per person", perRoomNight: "Per room/night", perPersonDay: "Per person/day", saved: "Draft saved", sent: "Quote submitted", saving: "Saving…",
  },
};

let language = "es";
let requests = [];
let current = null;
let quote = null;
let editable = false;
let savedCallback = () => {};
const t = key => labels[language]?.[key] || labels.es[key] || key;
const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function blankCost() { return { cost_id: id("cost"), category: "guide", description: "", amount: 0, quantity: 1, basis: "total", status: "estimate", included: true, note: "" }; }
function blankDay(number) { return { day_id: id("day"), day_number: number, date: "", title: "", start_location: "", end_location: "", start_time: "", end_time: "", agenda: "", drive_time: "", walking_minutes: 0, longest_walk_minutes: 0, terrain: "", rest_stops: "", suitability: "unknown", accessibility_notes: "", inclusions: "", exclusions: "", verification_notes: "", costs: [blankCost()] }; }
function starterQuote(request) {
  const days = (request.proposedDays || []).map((day, index) => ({ ...blankDay(index + 1), date: /^\d{4}-/.test(day.date || "") ? day.date : "", title: day.location || `${t("day")} ${index + 1}`, agenda: day.activity || "", verification_notes: [...(day.logistics || []), ...(day.pricing_needed || []).map(value => `${t("costs")}: ${value}`)].join("\n") }));
  return { guide_summary: "", options: [{ option_id: id("option"), name: t("recommended"), service_style: "recommended", summary: "", days: days.length ? days : [blankDay(1)] }] };
}
function optionTotal(option) { return option.days.flatMap(day => day.costs).filter(cost => cost.status !== "unavailable").reduce((sum, cost) => sum + Number(cost.amount || 0) * Number(cost.quantity || 0), 0); }
function pendingCount(option) { return option.days.flatMap(day => day.costs).filter(cost => ["estimate", "verify"].includes(cost.status)).length; }
function optionsMarkup(values, selected) { return values.map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${esc(label)}</option>`).join(""); }
function field(label, fieldName, value, type = "text", attrs = "") { return `<label class="builderField"><span>${esc(label)}</span><input type="${type}" data-field="${fieldName}" value="${esc(value)}" ${attrs}></label>`; }

function renderBrief() {
  const profile = current.guestProfile || {};
  const checks = [...(current.unknowns || []), ...(current.checks || [])];
  document.querySelector("#tripBuilderTitle").textContent = current.title;
  document.querySelector("#tripRequestBrief").innerHTML = `<div class="briefTitle"><span class="brandPill">${esc(current.brandId)}</span><h2>${t("request")}</h2></div><p>${esc(current.summary)}</p><div class="briefFacts">${profile.party_size ? `<span><b>${t("party")}</b>${esc(profile.party_size)}</span>` : ""}${current.requestedDates?.length ? `<span><b>${t("dates")}</b>${esc(current.requestedDates.join(" · "))}</span>` : ""}${current.responseDeadline ? `<span><b>Deadline</b>${esc(current.responseDeadline)}</span>` : ""}${profile.age_or_group ? `<span><b>Profile</b>${esc(profile.age_or_group)}</span>` : ""}${profile.experience_level ? `<span><b>Experience</b>${esc(profile.experience_level)}</span>` : ""}</div>${current.requirements?.length ? `<details open><summary>${t("requirements")}</summary><ul>${current.requirements.map(item => `<li>${esc(item)}</li>`).join("")}</ul></details>` : ""}${checks.length ? `<details><summary>${t("checks")}</summary><ul>${checks.map(item => `<li>${esc(item)}</li>`).join("")}</ul></details>` : ""}`;
}

function renderCost(cost, optionIndex, dayIndex, costIndex) {
  return `<div class="costRow" data-option="${optionIndex}" data-day="${dayIndex}" data-cost="${costIndex}"><select data-cost-field="category">${optionsMarkup([["guide",t("guide")],["transport",t("transport")],["entrance",t("entrance")],["accommodation",t("accommodation")],["meal",t("meal")],["activity",t("activity")],["other",t("other")]],cost.category)}</select><input data-cost-field="description" value="${esc(cost.description)}" placeholder="${esc(t("description"))}"><input data-cost-field="amount" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(cost.amount)}" aria-label="${esc(t("amount"))}"><input data-cost-field="quantity" type="number" min="0" step="1" inputmode="numeric" value="${esc(cost.quantity)}" aria-label="${esc(t("quantity"))}"><select data-cost-field="basis">${optionsMarkup([["total",t("totalBasis")],["per_day",t("perDay")],["per_vehicle",t("perVehicle")],["per_person",t("perPerson")],["per_room_night",t("perRoomNight")],["per_person_day",t("perPersonDay")]],cost.basis)}</select><select data-cost-field="status">${optionsMarkup([["confirmed",t("confirmed")],["estimate",t("estimate")],["verify",t("verify")],["unavailable",t("unavailable")]],cost.status)}</select><label class="costIncluded"><input data-cost-field="included" type="checkbox" ${cost.included !== false ? "checked" : ""}> ${t("included")}</label><button type="button" data-remove-cost aria-label="${esc(t("remove"))}">×</button></div>`;
}

function renderDay(day, optionIndex, dayIndex) {
  const total = day.costs.filter(cost => cost.status !== "unavailable").reduce((sum, cost) => sum + Number(cost.amount || 0) * Number(cost.quantity || 0), 0);
  return `<details class="builderDay" data-option="${optionIndex}" data-day="${dayIndex}" open><summary><span>${t("day")} ${dayIndex + 1} · ${esc(day.title || t("title"))}</span><b>${money(total)}</b></summary><div class="dayActions"><button type="button" data-duplicate-day>${t("duplicate")}</button><button type="button" data-remove-day>${t("remove")}</button></div><div class="dayGrid">${field(t("date"),"date",day.date,"date")}${field(t("title"),"title",day.title)}${field(t("start"),"start_location",day.start_location)}${field(t("end"),"end_location",day.end_location)}${field(t("startTime"),"start_time",day.start_time,"time")}${field(t("endTime"),"end_time",day.end_time,"time")}<label class="builderField spanTwo"><span>${t("agenda")}</span><textarea data-field="agenda" rows="4">${esc(day.agenda)}</textarea></label>${field(t("drive"),"drive_time",day.drive_time)}${field(t("walking"),"walking_minutes",day.walking_minutes,"number",'min="0" max="900"')}${field(t("longest"),"longest_walk_minutes",day.longest_walk_minutes,"number",'min="0" max="600"')}${field(t("terrain"),"terrain",day.terrain)}${field(t("rest"),"rest_stops",day.rest_stops)}<label class="builderField"><span>${t("suitability")}</span><select data-field="suitability">${optionsMarkup([["unknown",t("unknown")],["yes",t("yes")],["modified",t("modified")],["no",t("no")]],day.suitability)}</select></label><label class="builderField spanTwo"><span>${t("accessibility")}</span><textarea data-field="accessibility_notes">${esc(day.accessibility_notes)}</textarea></label><label class="builderField"><span>${t("inclusions")}</span><textarea data-field="inclusions">${esc(day.inclusions)}</textarea></label><label class="builderField"><span>${t("exclusions")}</span><textarea data-field="exclusions">${esc(day.exclusions)}</textarea></label><label class="builderField spanTwo"><span>${t("verification")}</span><textarea data-field="verification_notes">${esc(day.verification_notes)}</textarea></label></div><section class="dayCosts"><div class="costHead"><h4>${t("costs")}</h4><button type="button" data-add-cost>${t("addCost")}</button></div><div class="costLabels"><span>${t("category")}</span><span>${t("description")}</span><span>${t("amount")}</span><span>${t("quantity")}</span><span>${t("basis")}</span><span>${t("costStatus")}</span></div>${day.costs.map((cost, costIndex) => renderCost(cost, optionIndex, dayIndex, costIndex)).join("")}</section></details>`;
}

function renderOptions() {
  document.querySelector("#tripGuideSummary").value = quote.guide_summary || "";
  document.querySelector("#tripOptions").innerHTML = quote.options.map((option, optionIndex) => `<article class="tripOption" data-option="${optionIndex}"><header><div><span>${t("option")} ${optionIndex + 1}</span><strong>${esc(option.name)}</strong></div><div class="optionTotal"><b>${money(optionTotal(option))}</b><small>${pendingCount(option)} ${t("pending")}</small></div></header><div class="optionFields">${field(t("optionName"),"option_name",option.name)}<label class="builderField"><span>${t("style")}</span><select data-field="service_style">${optionsMarkup([["private",t("private")],["shared",t("shared")],["recommended",t("recommended")]],option.service_style)}</select></label><label class="builderField spanTwo"><span>${t("optionSummary")}</span><textarea data-field="option_summary">${esc(option.summary || "")}</textarea></label></div><div class="optionActions"><button type="button" data-add-day>${t("addDay")}</button><button type="button" data-duplicate-option>${t("duplicate")}</button>${quote.options.length > 1 ? `<button type="button" data-remove-option>${t("remove")}</button>` : ""}</div><div class="optionDays">${option.days.map((day, dayIndex) => renderDay(day, optionIndex, dayIndex)).join("")}</div></article>`).join("");
  document.querySelectorAll("#tripBuilder input, #tripBuilder textarea, #tripBuilder select, #tripBuilder button[type=button]").forEach(node => { if (!editable && !["BUTTON"].includes(node.tagName)) node.disabled = true; });
  document.querySelector("#saveTripDraft").hidden = !editable;
  document.querySelector("#submitTripQuote").hidden = !editable;
  document.querySelector("#addTripOption").hidden = !editable;
}

function updateFromInput(target) {
  if (target.id === "tripGuideSummary") { quote.guide_summary = target.value; return; }
  const optionEl = target.closest("[data-option]");
  if (!optionEl) return;
  const option = quote.options[Number(optionEl.dataset.option)];
  const dayEl = target.closest("[data-day]");
  const costEl = target.closest("[data-cost]");
  if (costEl) {
    const cost = option.days[Number(costEl.dataset.day)].costs[Number(costEl.dataset.cost)];
    const key = target.dataset.costField;
    cost[key] = target.type === "checkbox" ? target.checked : ["amount","quantity"].includes(key) ? Number(target.value || 0) : target.value;
  } else if (dayEl) {
    const day = option.days[Number(dayEl.dataset.day)];
    const key = target.dataset.field;
    day[key] = ["walking_minutes","longest_walk_minutes"].includes(key) ? Number(target.value || 0) : target.value;
  } else if (target.dataset.field === "option_name") option.name = target.value;
  else if (target.dataset.field === "option_summary") option.summary = target.value;
  else if (target.dataset.field === "service_style") option.service_style = target.value;
}

function renderErrors(errors = []) {
  const box = document.querySelector("#tripBuilderErrors");
  box.hidden = !errors.length;
  box.innerHTML = errors.length ? `<strong>${esc(errors[0])}</strong>${errors.length > 1 ? `<ul>${errors.slice(1).map(error => `<li>${esc(error)}</li>`).join("")}</ul>` : ""}` : "";
}

async function save(mode) {
  updateFromInput(document.querySelector("#tripGuideSummary"));
  renderErrors();
  const state = document.querySelector("#builderSaveState");
  state.textContent = t("saving");
  document.querySelector("#saveTripDraft").disabled = true;
  document.querySelector("#submitTripQuote").disabled = true;
  try {
    const response = await fetch(`/api/guide/quotes/${encodeURIComponent(current.assignmentId)}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, studioRevision: current.studioRevision, quote }) });
    const result = await response.json();
    if (!response.ok || result.verified === false) throw Object.assign(new Error(result.error || "Save failed"), { errors: result.errors || [] });
    quote = result.quote;
    current.studioRevision = result.studioRevision;
    state.textContent = mode === "submit" ? t("sent") : t("saved");
    if (mode === "submit") document.querySelector("#tripBuilder").close();
    await savedCallback();
  } catch (error) { renderErrors(error.errors?.length ? error.errors : [error.message]); state.textContent = ""; }
  finally { document.querySelector("#saveTripDraft").disabled = false; document.querySelector("#submitTripQuote").disabled = false; }
}

export function mountTripBuilder({ getLanguage, onSaved }) {
  savedCallback = onSaved || savedCallback;
  const dialog = document.querySelector("#tripBuilder");
  document.querySelector("#quoteRequestList").addEventListener("click", event => {
    const button = event.target.closest("[data-open-trip]");
    if (!button) return;
    current = requests.find(item => item.assignmentId === button.dataset.openTrip);
    language = getLanguage();
    editable = button.dataset.readonly !== "true";
    quote = current.quote ? structuredClone(current.quote) : starterQuote(current);
    renderBrief(); renderOptions(); renderErrors();
    dialog.showModal();
  });
  dialog.addEventListener("input", event => updateFromInput(event.target));
  dialog.addEventListener("change", event => { updateFromInput(event.target); if (event.target.matches('[data-cost-field="amount"],[data-cost-field="quantity"],[data-cost-field="status"]')) renderOptions(); });
  dialog.addEventListener("click", event => {
    const optionEl = event.target.closest(".tripOption"), dayEl = event.target.closest(".builderDay");
    const optionIndex = optionEl ? Number(optionEl.dataset.option) : -1, dayIndex = dayEl ? Number(dayEl.dataset.day) : -1;
    if (event.target.closest("[data-add-day]")) { quote.options[optionIndex].days.push(blankDay(quote.options[optionIndex].days.length + 1)); renderOptions(); }
    if (event.target.closest("[data-duplicate-day]")) { const copy = structuredClone(quote.options[optionIndex].days[dayIndex]); copy.day_id = id("day"); quote.options[optionIndex].days.splice(dayIndex + 1, 0, copy); renderOptions(); }
    if (event.target.closest("[data-remove-day]")) { quote.options[optionIndex].days.splice(dayIndex, 1); renderOptions(); }
    if (event.target.closest("[data-add-cost]")) { quote.options[optionIndex].days[dayIndex].costs.push(blankCost()); renderOptions(); }
    const costEl = event.target.closest(".costRow");
    if (event.target.closest("[data-remove-cost]") && costEl) { quote.options[optionIndex].days[dayIndex].costs.splice(Number(costEl.dataset.cost), 1); renderOptions(); }
    if (event.target.closest("[data-duplicate-option]")) { const copy = structuredClone(quote.options[optionIndex]); copy.option_id = id("option"); copy.name += ` · ${t("duplicate")}`; quote.options.splice(optionIndex + 1, 0, copy); renderOptions(); }
    if (event.target.closest("[data-remove-option]")) { quote.options.splice(optionIndex, 1); renderOptions(); }
  });
  document.querySelector("#addTripOption").addEventListener("click", () => { quote.options.push({ option_id: id("option"), name: `${t("option")} ${quote.options.length + 1}`, service_style: "private", summary: "", days: [blankDay(1)] }); renderOptions(); });
  document.querySelector("#saveTripDraft").addEventListener("click", () => save("draft"));
  document.querySelector("#submitTripQuote").addEventListener("click", () => save("submit"));
}

export function renderTripQuoteRequests(items, { currentLanguage = "es", readOnly = false } = {}) {
  language = currentLanguage;
  requests = items || [];
  const target = document.querySelector("#quoteRequestList");
  target.innerHTML = requests.length ? requests.map(request => {
    const status = request.status || "new";
    const total = request.quote?.options?.reduce((sum, option) => sum + Number(option.net_total || 0), 0) || 0;
    const locked = readOnly || ["submitted", "approved"].includes(status);
    return `<article class="quoteRequestCard"><header><div><span class="brandPill">${esc(request.brandId)}</span><h2>${esc(request.title)}</h2></div><span class="quoteStatus quoteStatus--${esc(status)}">${esc(t(status))}</span></header><p>${esc(request.summary)}</p><div class="quoteRequestMeta"><span>${request.guestProfile?.party_size ? `${esc(request.guestProfile.party_size)} pax` : ""}</span><span>${esc((request.requestedDates || []).join(" · "))}</span>${request.responseDeadline ? `<span>Due ${esc(request.responseDeadline)}</span>` : ""}${total ? `<strong>${money(total)} net</strong>` : ""}</div><button type="button" class="primary" data-open-trip="${esc(request.assignmentId)}" data-readonly="${locked}">${status === "new" ? t("prepare") : t("review")}</button></article>`;
  }).join("") : `<div class="empty">${esc(t("noRequests"))}</div>`;
}

