import { api } from "./modules/api.mjs?v=services-20261020-v8";
import { loadSnapshot, saveSnapshot, clearSnapshot } from "./modules/cache.mjs";
import { STATUS_MORE_FILTERS, addIsoDays, filterByRep, filterRecords, followupUrgency, priorityFor, recordDates, serviceSummary, weekDates } from "./modules/action-desk.mjs?v=services-20261021-v9";

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const pretty = value => String(value || "—").replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
const money = (value, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value || 0));
const date = value => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Guayaquil" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00-05:00`)) : "Not set";
const time = value => value ? String(value).slice(0, 5) : "Time not set";
const phoneDigits = value => String(value || "").replace(/\D/g, "");
const STATUS_OPTIONS = ["new", "contacted", "planning", "qualified", "quoted", "follow_up", "deposit_pending", "deposit_paid", "payment_pending", "booked", "completed", "cancelled", "did_not_book", "spam", "duplicate"];
const REP_OPTIONS = ["", "SS", "JPG"];
const GUEST_MORE_FILTERS = ["contacted", "planning", "qualified", "follow_up", "quoted", "deposit_pending", "deposit_paid", "payment_pending", "completed", "cancelled", "did_not_book", "archived", "all"];
const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;
const FOREGROUND_SYNC_MIN_AGE_MS = 5 * 60 * 1000;
const RECONNECT_SYNC_MIN_AGE_MS = 60 * 1000;
const AUTO_RETRY_COOLDOWN_MS = 60 * 1000;
const SERVICE_TIME_DEFAULTS = { MBW004: { start: "06:00", end: "09:00" }, MBW005: { start: "05:00", end: "10:00" }, MBW006: { start: "05:00", end: "15:00" }, MBW016: { start: "19:00", end: "21:00" } };
const productCode = value => String(value || "").trim().toUpperCase().match(/^(MBW\d+)/)?.[1] || "";
const serviceTimes = tour => SERVICE_TIME_DEFAULTS[productCode(tour?.product)] || { start: "", end: "" };
const state = { session: null, data: null, route: "actions", cached: false, guest: null, currentGuestId: "", actionQueue: [], guestQueue: [], todayQueue: [], deskView: "list", repFilter: "all", statusFilter: "all", summaryFilter: "open", selectedDate: "", weekStart: "", guestStatusFilter: "active", guestSearchResults: null, lastSyncedAt: 0, snapshotSavedAt: 0, connectionMode: "loading" };
let refreshPromise = null, lastAutomaticAttemptAt = 0;

function elapsedLabel(timestamp) {
  const elapsed = Math.max(0, Date.now() - Number(timestamp || 0));
  if (elapsed < 45 * 1000) return "now";
  if (elapsed < 60 * 60 * 1000) return `${Math.max(1, Math.floor(elapsed / 60000))}m ago`;
  if (elapsed < 24 * 60 * 60 * 1000) return `${Math.floor(elapsed / 3600000)}h ago`;
  return `${Math.floor(elapsed / 86400000)}d ago`;
}
function connection(mode, label = "") {
  const node = $("#connectionState");
  state.connectionMode = mode;
  node.dataset.state = mode;
  const timestamp = mode === "online" ? state.lastSyncedAt : state.snapshotSavedAt || state.lastSyncedAt;
  node.querySelector("b").textContent = label || (mode === "online" && timestamp ? `Synced ${elapsedLabel(timestamp)}` : mode === "cached" && timestamp ? `Saved ${elapsedLabel(timestamp)}` : pretty(mode));
  node.title = timestamp ? new Date(timestamp).toLocaleString() : "";
}
function updateConnectionAge() {
  if (["online", "cached"].includes(state.connectionMode)) connection(state.connectionMode);
}
function empty(message) { return `<div class="emptyCard">${esc(message)}</div>`; }
function toast(message) { const node = $("#toast"); node.textContent = message; node.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.hidden = true; }, 3200); }
function todayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(state.data?.checkedAt || Date.now()));
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function shortDate(value) { return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "Date not set"; }
function statusClass(value) { return `status-${String(value || "new").replace(/_/g, "-")}`; }
function deskRecords() { return state.data?.inquiries || state.data?.recentGuests || []; }
function relatedBookings(record) { return (state.data?.bookings || []).filter(item => item.inquiryId === record.inquiryId && !item.archived); }
function actionFor(record) { return (state.data?.actions || []).find(item => item.inquiryId === record.inquiryId) || null; }
function recordById(id) { return deskRecords().find(item => item.inquiryId === id); }
function countryFlag(code) { const value = String(code || "").toUpperCase(); return /^[A-Z]{2}$/.test(value) ? String.fromCodePoint(...[...value].map(letter => 127397 + letter.charCodeAt(0))) : ""; }
function brandBadge(record) { const labels = { MT: "Mindo Tours", CAT: "Chocó Andino Tours" }, code = record?.brand; return labels[code] ? `<span class="brandBadge brandBadge--${code.toLowerCase()}" title="Originating brand: ${esc(labels[code])}">${esc(code)}</span>` : ""; }
function identityMarkup(record, fallback = "Guest") { const flag = countryFlag(record?.countryCode); return `<span class="identityLine"><span class="guestName">${esc(record?.name || fallback)}</span>${flag ? `<span class="countryFlag" title="${esc(record.country || record.countryCode)}" aria-label="${esc(record.country || record.countryCode)}">${flag}</span>` : ""}${brandBadge(record)}</span>`; }
function toolUrl(base, guest) {
  const primary = guest.tours?.[0] || {};
  const params = new URLSearchParams({ source: "guest_crm", inquiry_id: guest.inquiryId || "", guest_id: guest.guestId || "", booking_id: guest.bookingId || "", guest: guest.name || "", full_name: guest.name || "", email: guest.email || "", guest_email: guest.email || "", phone: guest.phone || "", guest_phone: guest.phone || "", guests: guest.partySize || "", guest_count: guest.partySize || "", date: guest.requestedDate || primary.date || "", start_date: guest.requestedDate || primary.date || "", end_date: guest.requestedDateEnd || guest.requestedDate || primary.date || "", tour_date: guest.requestedDate || primary.date || "", tour_date_end: guest.requestedDateEnd || "", tour: primary.tour || "", tour_type: primary.tour || "", service_type: primary.serviceType || "", product_selected: primary.product || "", pickup: primary.pickup || guest.pickup || "", pickup_location: primary.pickup || guest.pickup || "", status: guest.effectiveStatus || guest.status || "", payment_status: guest.paymentStatus || "", invoice_no: guest.invoiceNo || "", country: guest.country || "", quoted_amount: primary.price || "", tour_items_json: JSON.stringify(guest.tours || []) });
  return `${base}${base.includes("?") ? "&" : "?"}${params.toString()}`;
}
function pipelineActionsMarkup(guest) {
  const status = guest.effectiveStatus || guest.status, whatsapp = phoneDigits(guest.phone);
  const actions = [
    [whatsapp ? `https://wa.me/${whatsapp}` : "", "WhatsApp"],
    [guest.email ? toolUrl("/custom-email-generator/", guest) : "", "Generate Email"],
    [toolUrl("https://mindobirdwatching.com/book-tour/create/", guest), "Create Stripe Invoice"],
    [toolUrl("/zelle-invoice-generator/", guest), "Create Zelle Invoice"]
  ];
  return `<details class="detailSection pipelineSection collapsibleSection" open><summary class="detailTitle"><h3>Next action</h3><span class="badge">${esc(pretty(status))}</span></summary><div class="pipelineActions">${actions.map(([href,label], index) => href ? `<a class="pipelineAction ${index === 0 ? "primaryAction" : ""}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : `<span class="pipelineAction disabledAction" aria-disabled="true">${esc(label)}</span>`).join("")}</div></details>`;
}
function guestDocumentsMarkup(guest) {
  return `<details class="detailSection collapsibleSection"><summary class="detailTitle"><h3>Guest documents</h3><span class="badge">CRM linked</span></summary><div class="pipelineActions"><a class="pipelineAction" href="${esc(toolUrl("/itinerary-generator/", guest))}" target="_blank" rel="noopener noreferrer">Generate Itinerary</a><a class="pipelineAction" href="${esc(toolUrl("/tour-confirmation-generator/", guest))}" target="_blank" rel="noopener noreferrer">Create Confirmation</a></div></details>`;
}

function planDateMismatch(plan, guest) {
  const fallbackDates = recordDates(guest, relatedBookings(guest));
  const guestStart = guest.requestedDate || fallbackDates[0], guestEnd = guest.requestedDateEnd || guestStart, planEnd = plan.endDate || plan.startDate;
  if (!guestStart || !plan.startDate) return false;
  return guestStart !== plan.startDate || guestEnd !== planEnd;
}

function planAttentionItems() {
  return (state.data?.customPlans || []).map(plan => {
    const guest = recordById(plan.inquiryId);
    if (!guest) return null;
    const dateMismatch = planDateMismatch(plan, guest);
    if (plan.status !== "admin_review" && !dateMismatch) return null;
    return { plan, guest, dateMismatch };
  }).filter(Boolean).sort((left, right) => String(right.plan.updatedAt || "").localeCompare(String(left.plan.updatedAt || "")));
}

function renderPlanAttention() {
  const panel = $("#planAttentionPanel"), items = planAttentionItems();
  panel.hidden = !items.length;
  if (!items.length) { panel.innerHTML = ""; return; }
  panel.innerHTML = `<div class="planAttentionHeading"><div><p class="eyebrow">Custom itineraries</p><h2 id="planAttentionHeading">Plans needing attention</h2></div><span>${items.length}</span></div><div class="planAttentionList">${items.map(({ plan, guest, dateMismatch }) => {
    const params = new URLSearchParams({ view: "plans", provider: plan.providerId, plan: plan.planId, mode: "admin" });
    const title = plan.title?.en || plan.title?.es || `${plan.guestName || guest.name} custom itinerary`;
    const reason = plan.status === "admin_review" ? "Guide submitted this itinerary for admin review." : "CRM dates do not match the itinerary dates.";
    const updated = plan.updatedAt ? new Date(plan.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Update time unavailable";
    const latest = [...(plan.history || [])].sort((left, right) => String(right.changedAt || "").localeCompare(String(left.changedAt || "")))[0];
    return `<article class="planAttentionCard"><div><strong>${esc(guest.name || plan.guestName || "Guest")}</strong><span class="badge ${dateMismatch ? "badge--warn" : ""}">${plan.status === "admin_review" ? "Review" : "Check dates"}</span></div><p>${esc(title)}</p><small>${esc(reason)}</small><div class="planAttentionMeta"><span>${esc(`${plan.days?.length || 0} day${plan.days?.length === 1 ? "" : "s"}`)}</span><span>${esc(`Updated ${updated}`)}</span>${latest?.actor ? `<span>${esc(`Last activity: ${latest.actor}`)}</span>` : ""}</div><div class="planAttentionActions"><button type="button" data-guest="${esc(plan.inquiryId)}">Open guest</button><a href="/guide/?${esc(params.toString())}" target="_blank" rel="noopener noreferrer">Review plan</a></div></article>`;
  }).join("")}</div>`;
}

function customPlanMarkup(guest) {
  const plans = (state.data?.customPlans || []).filter(plan => plan.inquiryId === guest.inquiryId);
  if (!plans.length) return "";
  const statusLabels = { guide_drafting: "Working draft", admin_review: "Ready for review", changes_requested: "Changes requested", approved: "Approved" };
  return plans.map(plan => {
    const params = new URLSearchParams({ view: "plans", provider: plan.providerId, plan: plan.planId, mode: "admin" });
    const title = plan.title?.en || plan.title?.es || `${plan.guestName || guest.name} custom itinerary`;
    const dates = plan.startDate ? (plan.endDate && plan.endDate !== plan.startDate ? `${shortDate(plan.startDate)}–${shortDate(plan.endDate)}` : shortDate(plan.startDate)) : "Dates to be confirmed";
    const status = statusLabels[plan.status] || "In progress";
    const fallbackDates = recordDates(guest, relatedBookings(guest)), guestStart = guest.requestedDate || fallbackDates[0] || "", guestEnd = guest.requestedDateEnd || guestStart;
    const currentDates = guestStart ? (guestEnd !== guestStart ? `${shortDate(guestStart)}–${shortDate(guestEnd)}` : shortDate(guestStart)) : "Not set";
    const dateWarning = planDateMismatch(plan, guest) ? `<details class="planDateWarning"><summary><strong>Dates need review.</strong> Compare before updating the CRM.</summary><div class="dateComparison"><span><small>Current CRM</small><b>${esc(currentDates)}</b></span><span><small>Itinerary</small><b>${esc(dates)}</b></span></div><p>This changes only the CRM guest date range. It does not alter the guide’s itinerary or run a plan-save workflow.</p><button type="button" data-reconcile-plan="${esc(plan.planId)}" data-start-date="${esc(plan.startDate)}" data-end-date="${esc(plan.endDate || plan.startDate)}">Confirm CRM date update</button></details>` : "";
    return `<section class="detailSection customPlanCard"><div class="detailTitle"><div><p class="eyebrow">Collaborative planning</p><h3>Custom itinerary</h3></div><span class="badge">${esc(status)}</span></div><div class="recordItem"><strong>${esc(title)}</strong><p>${esc(dates)} · Assigned to ${esc(plan.providerName || "guide")}</p><small>Open the workspace to review the guide’s preliminary itinerary, leave feedback, and complete the admin review.</small></div>${dateWarning}<div class="toolLinks"><a href="/guide/?${esc(params.toString())}" target="_blank" rel="noopener noreferrer">Open itinerary workspace</a></div></section>`;
  }).join("");
}

function guestSummaryMarkup(item, fallback = "Guest", assignee = "") {
  const status = item.effectiveStatus || item.status, bookings = relatedBookings(item), services = serviceSummary(item, bookings), followup = followupUrgency(todayIso(), item.followupDate), dates = recordDates(item, bookings), first = dates[0], last = dates.at(-1) || first;
  const tourDate = first ? (last !== first ? `${shortDate(first)}–${shortDate(last)}` : shortDate(first)) : "Not set";
  return `<div class="cardTop"><strong>${identityMarkup(item, fallback)}</strong><span class="statusBadge ${statusClass(status)}">${esc(pretty(status))}</span></div><div class="serviceLine"><span class="serviceIcons" aria-hidden="true">${esc(services.icons)}</span><span class="serviceName">${esc(services.primary)}</span><span class="serviceCount">${esc(item.partySize || "?")} ${Number(item.partySize) === 1 ? "guest" : "guests"} · ${services.count} service${services.count === 1 ? "" : "s"}</span></div><div class="cardFacts"><span class="assignedRep">${esc(item.assignedTo || assignee || "Unassigned")}</span><span class="tourDate"><b>Tour</b> ${esc(tourDate)}</span><span class="followupDate followup-${followup.tone}"><b>F/U</b> ${esc(followup.label)}</span></div>`;
}

function deskCard(record, action = null) {
  const bookings = relatedBookings(record), today = todayIso(), status = record.effectiveStatus || record.status;
  const displayAction = action?.type === "operations" && status !== "booked" ? null : action;
  const priority = priorityFor(record, bookings, today, displayAction), dates = recordDates(record, bookings), first = dates[0] || priority.tourDate;
  const bookingConflict = dates.length && bookings.find(item => item.startDate && !dates.includes(item.startDate));
  return `<button class="actionCard ${statusClass(status)}" data-guest="${esc(record.inquiryId)}" data-task="${esc(action?.type || "")}" type="button">
    ${guestSummaryMarkup(record, action?.guest || "Guest", displayAction?.owner)}
    ${bookingConflict ? `<div class="actionCue actionReason--warn"><span>Booking ledger says ${esc(shortDate(bookingConflict.startDate))}; itinerary says ${esc(shortDate(first))}. Review.</span><span class="priorityBadge priority-${priority.band}">${esc(priority.label)}</span></div>` : displayAction?.reason && !["follow-up","interaction-follow-up"].includes(displayAction.type) ? `<div class="actionCue"><span>${esc(displayAction.reason)}</span><span class="priorityBadge priority-${priority.band}">${esc(priority.label)}</span></div>` : ""}
  </button>`;
}

function repFilterMarkup(id, active) {
  const labels = { all: "Rep: All", unassigned: "Unassigned", jpg: "JPG", ss: "SS" };
  return `<label class="repFilter ${active ? "active" : ""}"><span class="srOnly">Filter by assigned rep</span><select id="${id}" aria-label="Filter by assigned rep">${Object.entries(labels).map(([value, label]) => `<option value="${value}" ${state.repFilter === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
}

function renderStatusFilters() {
  const moreSelected = STATUS_MORE_FILTERS.includes(state.statusFilter);
  $("#statusFilters").innerHTML = `${repFilterMarkup("actionRepFilter", state.statusFilter === "all")}<button type="button" data-status-filter="new" class="${state.statusFilter === "new" ? "active" : ""}">New</button><button type="button" data-status-filter="booked" class="${state.statusFilter === "booked" ? "active" : ""}">Booked</button><label class="statusMore ${moreSelected ? "active" : ""}"><span class="statusMoreLabel">More</span><select id="moreStatusFilter" aria-label="More statuses"><option value="">More</option>${STATUS_MORE_FILTERS.map(value => `<option value="${value}" ${state.statusFilter === value ? "selected" : ""}>${esc(pretty(value))}</option>`).join("")}</select></label>`;
}

function renderGuestStatusFilters() {
  const moreSelected = GUEST_MORE_FILTERS.includes(state.guestStatusFilter);
  $("#guestStatusFilters").innerHTML = `${repFilterMarkup("guestRepFilter", state.guestStatusFilter === "active")}<button type="button" data-guest-status-filter="new" class="${state.guestStatusFilter === "new" ? "active" : ""}">New</button><button type="button" data-guest-status-filter="booked" class="${state.guestStatusFilter === "booked" ? "active" : ""}">Booked</button><label class="statusMore ${moreSelected ? "active" : ""}"><span class="statusMoreLabel">More</span><select id="guestMoreStatusFilter" aria-label="More guest statuses"><option value="">More</option>${GUEST_MORE_FILTERS.map(value => `<option value="${value}" ${state.guestStatusFilter === value ? "selected" : ""}>${value === "all" ? "All records" : pretty(value)}</option>`).join("")}</select></label>`;
}

function renderCalendar() {
  const today = todayIso();
  if (!state.weekStart) state.weekStart = today;
  if (!state.selectedDate) state.selectedDate = today;
  const dates = weekDates(state.weekStart), all = filterByRep(filterRecords(deskRecords(), state.data?.bookings || [], { status: state.statusFilter }), state.repFilter);
  $("#calendarRange").textContent = `${shortDate(dates[0])} – ${shortDate(dates.at(-1))}`;
  $("#weekStrip").innerHTML = dates.map(value => {
    const count = all.filter(record => recordDates(record, relatedBookings(record)).includes(value)).length;
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
    return `<button type="button" data-calendar-date="${value}" class="${state.selectedDate === value ? "selected" : ""}"><small>${weekday}</small><strong>${Number(value.slice(-2))}</strong><span>${count ? `${count}` : ""}</span></button>`;
  }).join("");
  $("#calendarSelection").textContent = `${shortDate(state.selectedDate)} · ${state.statusFilter === "all" ? "all active statuses" : pretty(state.statusFilter)}`;
}

function renderActions() {
  const repRecords = filterByRep(deskRecords(), state.repFilter), repIds = new Set(repRecords.map(record => record.inquiryId));
  const actions = (state.data?.actions || []).filter(item => repIds.has(item.inquiryId));
  const urgent = actions.filter(item => item.priority === 0).length;
  const due = actions.filter(item => ["follow-up", "interaction-follow-up"].includes(item.type)).length;
  $("#actionSummary").innerHTML = `<button type="button" class="summaryItem ${state.summaryFilter === "open" ? "active" : ""}" data-summary-filter="open"><strong>${actions.length}</strong><span>Open</span></button><button type="button" class="summaryItem ${state.summaryFilter === "urgent" ? "active" : ""}" data-summary-filter="urgent"><strong>${urgent}</strong><span>Urgent</span></button><button type="button" class="summaryItem ${state.summaryFilter === "followups" ? "active" : ""}" data-summary-filter="followups"><strong>${due}</strong><span>Follow-ups</span></button>`;
  renderStatusFilters();
  document.querySelectorAll("[data-desk-view]").forEach(button => button.classList.toggle("active", button.dataset.deskView === state.deskView));
  $("#calendarPanel").hidden = state.deskView !== "calendar";
  if (state.deskView === "calendar") renderCalendar();
  renderPlanAttention();
  const filteredMode = state.statusFilter !== "all" || state.deskView === "calendar";
  const visibleActions = state.summaryFilter === "urgent" ? actions.filter(item => item.priority === 0) : state.summaryFilter === "followups" ? actions.filter(item => ["follow-up", "interaction-follow-up"].includes(item.type)) : actions;
  let records = filteredMode
    ? filterRecords(repRecords, state.data?.bookings || [], { status: state.statusFilter, selectedDate: state.deskView === "calendar" ? state.selectedDate : "" })
    : visibleActions.map(item => recordById(item.inquiryId)).filter(Boolean);
  records = [...new Map(records.map(record => [record.inquiryId, record])).values()];
  records.sort((left, right) => priorityFor(right, relatedBookings(right), todayIso(), actionFor(right)).score - priorityFor(left, relatedBookings(left), todayIso(), actionFor(left)).score || (left.name || "").localeCompare(right.name || ""));
  state.actionQueue = records.map(record => record.inquiryId);
  $("#actionList").innerHTML = records.length ? records.map(record => deskCard(record, actionFor(record))).join("") : empty(filteredMode ? "No active records match this date and status." : "Nothing needs immediate action from the current CRM records.");
}

function guestCard(item) {
  const status = item.effectiveStatus || item.status;
  return `<button class="guestCard ${statusClass(status)}" data-guest="${esc(item.inquiryId)}" type="button">${guestSummaryMarkup(item)}</button>`;
}

function guestStatus(item) { return item.effectiveStatus || item.status || "new"; }
function guestVisible(item, filter) {
  const status = guestStatus(item), archived = item.archived || ["duplicate", "archived"].includes(status);
  if (filter === "all") return true;
  if (filter === "archived") return archived;
  if (filter === "active") return !archived && !["completed", "cancelled", "canceled", "did_not_book"].includes(status);
  return !archived && status === filter;
}
function renderGuests(records = state.guestSearchResults || state.data?.recentGuests || [], explicitSearch = state.guestSearchResults !== null) {
  const visible = filterByRep(explicitSearch ? records : records.filter(item => guestVisible(item, state.guestStatusFilter)), state.repFilter);
  state.guestQueue = visible.map(item => item.inquiryId);
  $("#guestList").innerHTML = visible.length ? visible.map(guestCard).join("") : empty(explicitSearch ? "No matching guests were found." : "No guests match this status.");
}
function updateGuideViewLink() {
  const select = $("#guideViewSelect"), link = $("#guideViewLink"), provider = select.value;
  if (!provider) { link.removeAttribute("href"); link.setAttribute("aria-disabled", "true"); return; }
  link.href = `/guide/?provider=${encodeURIComponent(provider)}`;
  link.removeAttribute("aria-disabled");
}
function renderGuideView() {
  const panel = $("#guideViewPanel"), isOwner = state.session?.identity?.role === "owner";
  panel.hidden = !isOwner;
  if (!isOwner) return;
  const select = $("#guideViewSelect"), current = select.value;
  const guides = (state.data?.providers || []).filter(item => item.active !== false && item.role === "guide" && item.name).sort((left, right) => left.name.localeCompare(right.name));
  select.innerHTML = `<option value="">Select a guide</option>${guides.map(item => `<option value="${esc(item.providerId || item.name)}">${esc(item.name)}</option>`).join("")}`;
  if ([...select.options].some(option => option.value === current)) select.value = current;
  updateGuideViewLink();
}
function renderToday() {
  const today = todayIso(), end = addIsoDays(today, 7), closed = new Set(["completed", "cancelled", "canceled", "did_not_book", "spam", "duplicate", "archived"]), records = (state.data?.upcoming || state.data?.today || []).filter(item => !closed.has(item.status)), todayRecords = records.filter(item => item.date === today), later = records.filter(item => item.date > today && item.date <= end);
  state.todayQueue = [...new Set(records.map(item => item.inquiryId).filter(Boolean))];
  renderGuideView();
  const cards = rows => rows.map(item => `<button class="todayCard ${statusClass(item.status)}" data-guest="${esc(item.inquiryId)}" data-task="operations" type="button"><div class="cardTop"><strong>${esc(item.startTime ? time(item.startTime) : "Time pending")} · ${esc(item.guest)}</strong><span class="operationsBadge ${item.risk ? "operationsBadge--attention" : "operationsBadge--ready"}">${item.risk ? "Attention" : "Ready"}</span></div><p>${esc(item.tour || "Tour")} · ${esc(item.partySize || "?")} ${Number(item.partySize) === 1 ? "guest" : "guests"}</p><div class="todayFacts"><span class="statusBadge ${statusClass(item.status)}">${esc(pretty(item.status))}</span><span class="serviceDate"><b>${esc(shortDate(item.date))}</b></span></div><div class="todayMeta"><span>${esc(item.pickup || "Pickup not set")}</span><span>${item.source === "assignment" ? "Assignment schedule" : "Itinerary"}</span></div>${item.risk ? `<p><strong>${esc(item.risk)}</strong></p>` : ""}</button>`).join("");
  $("#todayList").innerHTML = `<section class="scheduleGroup"><h2>Today <span>${todayRecords.length} service${todayRecords.length === 1 ? "" : "s"}</span></h2>${todayRecords.length ? cards(todayRecords) : empty("No services are recorded for today in Ecuador.")}</section><section class="scheduleGroup"><h2>Next 7 days <span>${later.length} service${later.length === 1 ? "" : "s"}</span></h2>${later.length ? cards(later) : empty("No additional services are recorded for the next seven days.")}</section>`;
}

function renderMore() {
  const identity = state.session?.identity || {};
  $("#identityName").textContent = identity.name || identity.email || "—";
  $("#identityRole").textContent = pretty(identity.role);
  const lastSync = state.lastSyncedAt || state.snapshotSavedAt;
  $("#lastChecked").textContent = lastSync ? new Date(lastSync).toLocaleString() : "—";
  $("#writeState").textContent = state.session?.capabilities?.write ? "Enabled" : "Read only";
  document.querySelectorAll("[data-owner-only]").forEach(node => { node.hidden = identity.role !== "owner"; });
  $("#newGuestButton").disabled = !state.session?.capabilities?.write;
}

function render() { renderActions(); renderGuestStatusFilters(); renderGuests(); renderToday(); renderMore(); updateGuestNavigator(); $("#cachedNotice").hidden = !state.cached; }
function route(name) {
  state.route = ["actions", "guests", "today", "more"].includes(name) ? name : "actions";
  document.querySelectorAll(".view").forEach(view => { view.hidden = view.dataset.view !== state.route; });
  document.querySelectorAll("#bottomNav button").forEach(button => button.classList.toggle("active", button.dataset.route === state.route));
  document.querySelectorAll(".dialogNav button").forEach(button => button.classList.toggle("active", button.dataset.dialogRoute === state.route));
  window.history.replaceState({}, "", state.route === "actions" ? "/app/" : `/app/?view=${state.route}`);
  $("#appMain").focus({ preventScroll: true }); window.scrollTo(0, 0);
}

function journeyMarkup(journey) { return `<div class="journey">${journey.map(item => `<div class="journeyStep journey-${String(item.label || "step").toLowerCase().replace(/[^a-z0-9]+/g, "-")}" data-state="${esc(item.state)}"><i></i><div><strong>${esc(item.label)}</strong><small>${esc(item.evidence)}</small></div></div>`).join("")}</div>`; }
function hydrateAssignedRep(guest, canWrite) {
  const input = $("#profileForm input[name=assigned_to]"); if (!input) return;
  const current = String(guest.assignedTo || "").toUpperCase(), values = REP_OPTIONS.includes(current) ? REP_OPTIONS : [...REP_OPTIONS, current];
  const select = document.createElement("select"); select.name = "assigned_to"; select.disabled = !canWrite;
  values.forEach(value => { const option = document.createElement("option"); option.value = value; option.textContent = value || "Unassigned"; option.selected = current === value; select.append(option); });
  input.replaceWith(select);
}
function enhanceServiceCreate() {
  const form = $("#serviceCreateForm"), actions = form?.querySelector(".serviceCreateActions"); if (!form || !actions) return;
  const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "cancelAction"; cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => { form.reset(); const details = form.closest("details"); if (details) details.open = false; });
  actions.append(cancel);
}
function profileMarkup(guest, canWrite) {
  const fallback = String(guest.name || "").trim().split(/\s+/), firstName = guest.firstName || fallback[0] || "", lastName = guest.lastName || fallback.slice(1).join(" ");
  return `<details class="profileEditor"><summary>Edit guest details</summary><form id="profileForm"><div class="fieldGrid"><label class="field"><span>First name</span><input name="first_name" maxlength="80" value="${esc(firstName)}" autocomplete="given-name" required ${canWrite ? "" : "disabled"}></label><label class="field"><span>Last name</span><input name="last_name" maxlength="80" value="${esc(lastName)}" autocomplete="family-name" ${canWrite ? "" : "disabled"}></label></div><div class="fieldGrid"><label class="field"><span>Phone</span><input name="phone_number" maxlength="60" value="${esc(guest.phone)}" inputmode="tel" autocomplete="tel" ${canWrite ? "" : "disabled"}></label><label class="field"><span>Country</span><input name="country" maxlength="120" value="${esc(guest.country)}" autocomplete="country-name" ${canWrite ? "" : "disabled"}></label></div><label class="field"><span>Email</span><input type="email" name="email" maxlength="254" value="${esc(guest.email)}" autocomplete="email" ${canWrite ? "" : "disabled"}></label><div class="fieldGrid"><label class="field"><span>Assigned rep</span><input name="assigned_to" maxlength="30" value="${esc(guest.assignedTo)}" ${canWrite ? "" : "disabled"}></label><label class="field"><span>Guests</span><input type="number" name="guest_count" min="1" max="99" value="${esc(guest.partySize || "1")}" ${canWrite ? "" : "disabled"}></label></div><label class="field"><span>Pickup</span><input name="pickup_location" maxlength="500" value="${esc(guest.pickup)}" ${canWrite ? "" : "disabled"}></label><label class="field"><span>Guest notes</span><textarea name="notes" maxlength="3000" ${canWrite ? "" : "disabled"}>${esc(guest.notes)}</textarea></label><div class="formActions"><button type="submit" ${canWrite ? "" : "disabled"}>Save details</button></div></form></details>`;
}
function readinessMarkup(model) {
  if (!model) return "";
  const label = model.status === "completed" ? "Complete" : model.status === "cancelled" ? "Cancelled" : model.ready ? "Ready" : `${model.readyCount}/${model.totalCount} ready`;
  return `<div class="serviceReadiness"><div class="readinessSummary"><strong>${esc(label)}</strong>${model.nextAction && model.nextAction !== "Ready" ? `<span>Next: ${esc(model.nextAction)}</span>` : ""}</div><div class="readinessChecks">${model.checks.map(check => `<span class="readinessCheck readinessCheck--${esc(check.state)}" title="${esc(check.label)}: ${esc(check.evidence)}"><b>${esc(check.label)}</b> ${esc(check.evidence)}</span>`).join("")}</div></div>`;
}
function serviceMarkup(guest, readiness, canWrite) {
  const readinessById = new Map((readiness || []).map(item => [item.serviceId, item]));
  return `<div class="serviceRecords">${(guest.tours || []).map(item => `<form class="serviceRecord serviceStatusForm ${statusClass(item.status)}" data-service="${esc(item.id)}"><div class="serviceIdentity"><strong>${esc(item.tour || item.product || "Service")}</strong><small>${esc(date(item.date))} · ${esc(item.guests || guest.partySize || "?")} ${Number(item.guests || guest.partySize) === 1 ? "guest" : "guests"}</small></div><div class="serviceStatusControls"><select name="status" aria-label="Status for ${esc(item.tour || item.product || "service")}" ${canWrite ? "" : "disabled"}>${["planning","quoted","deposit_pending","deposit_paid","payment_pending","booked","completed","cancelled"].map(value => `<option value="${value}" ${item.status === value ? "selected" : ""}>${esc(pretty(value))}</option>`).join("")}</select><button type="submit" ${canWrite ? "" : "disabled"}>Save</button></div>${readinessMarkup(readinessById.get(item.id))}</form>`).join("") || `<div class="recordItem"><p>No itinerary services recorded.</p></div>`}</div>`;
}
function serviceCreateMarkup(guest, canWrite) {
  return `<details class="serviceCreate"><summary>Add another tour, activity, or transfer</summary><form id="serviceCreateForm"><label class="field"><span>Service type</span><select name="service_type" ${canWrite ? "" : "disabled"}>${["Birdwatching","Activity","Transportation","Accommodation","Other"].map(value => `<option value="${value}">${value}</option>`).join("")}</select></label><label class="field"><span>Tour or activity</span><input name="tour" maxlength="300" required placeholder="Night Walk, birding day, airport transfer…" ${canWrite ? "" : "disabled"}></label><label class="field"><span>Product code / service</span><input name="product_selected" maxlength="240" placeholder="Optional, for example MBW016 - Night Walk" ${canWrite ? "" : "disabled"}></label><label class="field"><span>Date</span><input type="date" name="date" required ${canWrite ? "" : "disabled"}></label><label class="field"><span>Guests</span><input type="number" name="guests" min="1" max="99" value="${esc(guest.partySize || "1")}" required ${canWrite ? "" : "disabled"}></label><label class="field"><span>Status</span><select name="status" ${canWrite ? "" : "disabled"}>${["planning","quoted","deposit_pending","deposit_paid","payment_pending","booked"].map(value => `<option value="${value}">${esc(pretty(value))}</option>`).join("")}</select></label><label class="field"><span>Price per person (optional)</span><input type="number" name="price_per_person" min="0" step="0.01" inputmode="decimal" ${canWrite ? "" : "disabled"}></label><label class="field"><span>Pickup (optional)</span><input name="pickup_location" maxlength="500" value="${esc(guest.pickup || "")}" ${canWrite ? "" : "disabled"}></label><label class="field"><span>Notes (optional)</span><textarea name="notes" maxlength="1000" ${canWrite ? "" : "disabled"}></textarea></label><div class="serviceCreateActions"><button type="submit" data-intent="save" ${canWrite ? "" : "disabled"}>Save service</button><button type="submit" data-intent="invoice" class="secondaryAction" ${canWrite ? "" : "disabled"}>Save & open Stripe</button></div></form></details>`;
}
function paymentMarkup(records) { return records.length ? records.map(item => item.nonPayable ? `<div class="recordItem"><strong>${esc(item.invoiceNo || "Invoice")}</strong><p>${esc(pretty(item.status))} · ${item.status === "uncollectible" ? "Review before collection" : "Not payable"}</p><small>Historical invoice retained. Booking and deposits unchanged.</small></div>` : `<div class="recordItem"><strong>${esc(item.invoiceNo || "Payment")}</strong><p>${esc(pretty(item.status))} · ${esc(money(item.totalPaid, item.currency))} paid</p><small>${item.balance ? `${esc(money(item.balance, item.currency))} balance` : "No recorded balance"}</small></div>`).join("") : `<div class="recordItem"><p>No payment ledger entries.</p></div>`; }
function assignmentMarkup(records, canWrite) { return records.length ? records.map(item => `<form class="recordItem assignmentForm" data-assignment="${esc(item.assignmentId)}" data-updated="${esc(item.updatedAt)}"><strong>${esc(item.providerName || pretty(item.providerRole))}</strong><p>${esc(item.serviceType || item.product || "Assignment")} · ${esc(date(item.serviceDate))}</p><label class="field"><span>Status</span><select name="assignment_status" ${canWrite ? "" : "disabled"}>${["pending","confirmed","completed","cancelled"].map(value => `<option value="${value}" ${item.status === value ? "selected" : ""}>${esc(pretty(value))}</option>`).join("")}</select></label><label class="field"><span>Provider informed</span><select name="provider_informed" ${canWrite ? "" : "disabled"}><option value="No" ${item.providerInformed ? "" : "selected"}>No</option><option value="Yes" ${item.providerInformed ? "selected" : ""}>Yes</option></select></label><div class="formActions"><button type="submit" ${canWrite ? "" : "disabled"}>Save assignment</button></div></form>`).join("") : `<div class="recordItem"><p>No provider assignments.</p></div>`; }
function assignmentCreateMarkup(guest, canWrite) {
  const providers = state.data?.providers || [], tours = (guest.tours || []).map((item, index) => ({ item, index })).filter(entry => entry.item.status === "booked");
  if (!tours.length) return `<p class="formNote">Provider assignments become available when a service is Booked.</p>`;
  const selected = tours.find(entry => entry.item.date >= todayIso()) || tours[0], first = selected.item, defaults = serviceTimes(first);
  return `<details class="assignmentCreate"><summary>Add guide, driver, or provider</summary><form id="assignmentCreateForm"><label class="field"><span>Service</span><select name="service_index" ${canWrite ? "" : "disabled"}>${tours.map(entry => `<option value="${entry.index}" ${entry === selected ? "selected" : ""}>${esc(entry.item.tour || entry.item.product || "Service")} · ${esc(shortDate(entry.item.date))}</option>`).join("")}</select></label><label class="field"><span>Service date</span><input type="date" name="service_date" value="${esc(first.date || "")}" required ${canWrite ? "" : "disabled"}></label><label class="field"><span>Provider</span><select name="provider_index" ${canWrite ? "" : "disabled"}>${providers.map((item,index) => `<option value="${index}" ${item.isDefault ? "selected" : ""}>${esc(item.name)} · ${esc(pretty(item.role))}</option>`).join("")}<option value="other">Other provider</option></select></label><label class="field"><span>Other provider name</span><input name="provider_name_other" maxlength="160" ${canWrite ? "" : "disabled"}></label><label class="field"><span>Role</span><select name="provider_role" ${canWrite ? "" : "disabled"}>${["guide","driver","activity_provider","accommodation","other"].map(value => `<option value="${value}">${esc(pretty(value))}</option>`).join("")}</select></label><div class="timeGrid"><label class="field"><span>Start</span><input type="time" name="start_time" value="${esc(first.startTime || defaults.start)}" ${canWrite ? "" : "disabled"}></label><label class="field"><span>End</span><input type="time" name="end_time" value="${esc(first.endTime || defaults.end)}" ${canWrite ? "" : "disabled"}></label></div><label class="field"><span>Pickup</span><input name="pickup_location" value="${esc(first.pickup || guest.pickup || "")}" maxlength="500" ${canWrite ? "" : "disabled"}></label><label class="field"><span>Drop-off</span><input name="dropoff_location" value="${esc(first.dropoff || "")}" maxlength="500" ${canWrite ? "" : "disabled"}></label><label class="field"><span>Status</span><select name="assignment_status" ${canWrite ? "" : "disabled"}><option value="pending">Pending</option><option value="confirmed">Confirmed</option></select></label><label class="field"><span>Provider informed</span><select name="provider_informed" ${canWrite ? "" : "disabled"}><option value="No">No</option><option value="Yes">Yes</option></select></label><div class="formActions"><button type="submit" ${canWrite ? "" : "disabled"}>Add assignment</button></div></form></details>`;
}
function interactionMarkup(records) { return records.length ? records.slice().sort((a,b) => String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, 20).map(item => `<div class="recordItem"><strong>${esc(pretty(item.channel))} · ${esc(pretty(item.direction))}</strong><p>${esc(item.note)}</p><small>${esc(item.occurredAt ? new Date(item.occurredAt).toLocaleString() : "Date unavailable")} · ${esc(item.createdBy || "Staff")}</small></div>`).join("") : `<div class="recordItem"><p>No communications logged.</p></div>`; }

function currentGuestQueue() {
  if (state.route === "actions") return state.actionQueue;
  if (state.route === "today") return state.todayQueue;
  return state.guestQueue;
}
function updateGuestNavigator() {
  const queue = currentGuestQueue(), index = queue.indexOf(state.currentGuestId), hasCurrent = index >= 0;
  $("#guestQueuePosition").textContent = hasCurrent ? `${index + 1} of ${queue.length}` : "—";
  $("#previousGuest").disabled = !hasCurrent || index === 0;
  $("#nextGuest").disabled = !hasCurrent || index === queue.length - 1;
}
function navigateGuest(offset) {
  const queue = currentGuestQueue(), index = queue.indexOf(state.currentGuestId), nextId = queue[index + offset];
  if (!nextId) return;
  $("#guestDialog").scrollTop = 0;
  openGuest(nextId, state.route === "today" ? "operations" : "");
}

async function openGuest(id, task = "") {
  const dialog = $("#guestDialog"), body = $("#guestDetail"), preview = recordById(id) || state.data?.recentGuests?.find(item => item.inquiryId === id);
  state.currentGuestId = id;
  updateGuestNavigator();
  $("#guestDialogTitle").textContent = preview?.name || "Loading…";
  body.innerHTML = preview ? `<section class="detailHero detailHero--record ${statusClass(preview.effectiveStatus || preview.status)}">${guestSummaryMarkup(preview)}</section><div class="detailLoading" aria-label="Loading current guest workspace"><i></i><i></i></div>` : `<section class="stateCard"><div class="spinner"></div><p>Loading the current guest record.</p></section>`;
  if (!dialog.open) dialog.showModal();
  try {
    const result = await api.guest(id); state.guest = result; const guest = result.record;
    const selectedStatus = STATUS_OPTIONS.includes(guest.effectiveStatus) ? guest.effectiveStatus : guest.status;
    const warnings = Array.isArray(result.warnings) ? result.warnings : [];
    const canWrite = Boolean(state.session?.capabilities?.write) && warnings.length === 0;
    const historyWarning = warnings.length ? `<div class="cachedNotice detailWarning"><strong>Some CRM history is temporarily unavailable.</strong><span>Missing: ${esc(warnings.map(pretty).join(", "))}. Refresh this guest before acting on those sections.</span><button id="retryGuestDetails" type="button">Retry</button></div>` : "";
    $("#guestDialogTitle").textContent = guest.name || "Guest";
    updateGuestNavigator();
    const whatsapp = phoneDigits(guest.phone);
    body.innerHTML = `${historyWarning}<section class="detailHero detailHero--record ${statusClass(guest.effectiveStatus || guest.status)}">${guestSummaryMarkup(guest)}<div class="detailContactMeta"><span>${esc(guest.country || "Country not recorded")}</span><span>${esc(guest.email || "Email not recorded")}</span><span>${esc(guest.phone || "Phone not recorded")}</span></div><div class="contactLinks">${whatsapp ? `<a href="https://wa.me/${esc(whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}${guest.email ? `<a href="${esc(toolUrl("/custom-email-generator/", guest))}" target="_blank" rel="noopener noreferrer">Email draft</a>` : ""}</div></section>
      <section class="detailSection" data-section="profile"><h3>Guest details</h3>${profileMarkup(guest, canWrite)}</section>
      <section class="detailSection"><div class="detailTitle"><h3>Services & readiness</h3><span class="badge">${guest.tours?.length || 0}</span></div>${serviceMarkup(guest, result.readiness, canWrite)}${serviceCreateMarkup(guest, canWrite)}</section>
      ${customPlanMarkup(guest)}
      <details class="detailSection collapsibleSection ${statusClass(guest.effectiveStatus || guest.status)}" open><summary class="detailTitle"><h3>Guest Journey</h3><span class="badge">${esc(pretty(guest.effectiveStatus || guest.status))}</span></summary>${guest.needsReconciliation ? `<p class="formNote formNote--warn">Legacy booking or payment records need reconciliation before this inquiry is treated as current.</p>` : ""}${journeyMarkup(result.journey)}</details>
      ${pipelineActionsMarkup(guest)}
      ${guestDocumentsMarkup(guest)}
      <section class="detailSection" data-section="status"><h3>Inquiry status</h3><form id="statusForm"><label class="field"><span>Saved CRM status</span><select name="status" ${canWrite ? "" : "disabled"}>${STATUS_OPTIONS.map(value => `<option value="${value}" ${selectedStatus === value ? "selected" : ""}>${esc(pretty(value))}</option>`).join("")}</select></label><div class="formActions"><button type="submit" ${canWrite ? "" : "disabled"}>Save status</button></div>${guest.status !== selectedStatus ? `<p class="formNote">The operational status is derived as ${esc(pretty(selectedStatus))}. Saving makes that status canonical in the CRM.</p>` : ""}${canWrite ? "" : `<p class="formNote formNote--warn">Changes are disabled until the production write configuration is complete.</p>`}</form></section>
      <section class="detailSection" data-section="follow-up"><h3>Next follow-up</h3><form id="followupForm"><label class="field"><span>Date</span><input type="date" name="followup_date" value="${esc(guest.followupDate)}" ${canWrite ? "" : "disabled"}></label><div class="formActions"><button type="submit" ${canWrite ? "" : "disabled"}>Save follow-up</button></div>${canWrite ? "" : `<p class="formNote formNote--warn">Changes are disabled until the production write configuration is complete.</p>`}</form></section>
      <section class="detailSection" data-section="payments"><h3>Payments</h3><p class="paymentHint">Suggested: ${guest.countryCode === "US" ? "Zelle or Stripe" : "Stripe"}. Review the guest and amount before creating or sending an invoice.</p><div class="recordList">${paymentMarkup(result.data.payments)}</div><div class="toolLinks"><a href="${esc(toolUrl("/zelle-invoice-generator/", guest))}" target="_blank" rel="noopener noreferrer">Zelle invoice</a><a href="${esc(toolUrl("https://mindobirdwatching.com/book-tour/create/", guest))}" target="_blank" rel="noopener noreferrer">Stripe invoice</a></div></section>
      <section class="detailSection" data-section="confirmation"><h3>Confirmation</h3><p>Open the existing generator with this guest and tour information, then verify the details before sending.</p><div class="toolLinks"><a href="${esc(toolUrl("/tour-confirmation-generator/", guest))}" target="_blank" rel="noopener noreferrer">Open confirmation generator</a></div></section>
      <section class="detailSection" data-section="operations"><h3>Operations</h3>${assignmentCreateMarkup(guest, canWrite)}<div class="recordList">${assignmentMarkup(result.data.assignments, canWrite)}</div></section>
      <section class="detailSection" data-section="communication"><h3>Communication</h3><form id="interactionForm"><label class="field"><span>Channel</span><select name="channel" ${canWrite ? "" : "disabled"}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Phone</option><option value="in_person">In person</option><option value="other">Other</option></select></label><label class="field"><span>Guest message (incoming)</span><textarea name="guest_note" maxlength="4000" placeholder="Paste or summarize what the guest sent" ${canWrite ? "" : "disabled"}></textarea></label><label class="field"><span>Our response (outgoing)</span><textarea name="staff_note" maxlength="4000" placeholder="Paste or summarize your reply" ${canWrite ? "" : "disabled"}></textarea></label><label class="field"><span>Follow-up date (optional)</span><input type="date" name="followupAt" ${canWrite ? "" : "disabled"}></label><div class="formActions"><button type="submit" ${canWrite ? "" : "disabled"}>Log exchange</button></div><p class="formNote">Enter either message, or both to save the full conversation in order.</p></form><div class="recordList">${interactionMarkup(result.data.interactions)}</div></section>`;
    $("#retryGuestDetails")?.addEventListener("click", () => openGuest(id, task));
    hydrateAssignedRep(guest, canWrite); enhanceServiceCreate();
    $("#profileForm")?.addEventListener("submit", saveProfile); $("#statusForm")?.addEventListener("submit", saveStatus); $("#followupForm")?.addEventListener("submit", saveFollowup); $("#interactionForm")?.addEventListener("submit", saveInteraction); $("#serviceCreateForm")?.addEventListener("submit", createService); $("#assignmentCreateForm")?.addEventListener("submit", createAssignment); $("#assignmentCreateForm select[name=service_index]")?.addEventListener("change", syncAssignmentService); body.querySelectorAll(".serviceStatusForm").forEach(form => form.addEventListener("submit", saveServiceStatus)); body.querySelectorAll(".assignmentForm").forEach(form => form.addEventListener("submit", saveAssignment));
    if (task) setTimeout(() => body.querySelector(`[data-section="${CSS.escape(task === "interaction-follow-up" ? "communication" : task)}"]`)?.scrollIntoView({ behavior: "smooth" }), 80);
  } catch (error) {
    const detail = error.message && error.message !== "Request failed." ? `<small>${esc(error.message)}</small>` : "";
    body.innerHTML = `<div class="emptyCard detailFailure"><strong>Guest details could not load from the CRM.</strong><p>The guest list is still available. Retry before making changes to this guest.</p>${detail}<button id="retryGuestDetails" class="primary" type="button">Retry guest details</button></div>`;
    $("#retryGuestDetails")?.addEventListener("click", () => openGuest(id, task));
  }
}

async function saveProfile(event) {
  event.preventDefault(); const form = event.currentTarget, guest = state.guest.record, patch = Object.fromEntries(new FormData(form)), button = form.querySelector("button"); button.disabled = true;
  try { await api.patchGuest(guest.inquiryId, { expectedUpdatedAt: guest.updatedAt, patch }); toast("Guest details saved and verified."); await openGuest(guest.inquiryId, "profile"); await refresh(false); } catch (error) { toast(error.message); button.disabled = false; }
}

async function reconcilePlanDates(button) {
  const guest = state.guest?.record, startDate = button.dataset.startDate, endDate = button.dataset.endDate || startDate;
  if (!guest || !/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") || !/^\d{4}-\d{2}-\d{2}$/.test(endDate || "")) return toast("The itinerary dates are incomplete.");
  if (endDate < startDate) return toast("The itinerary end date cannot be before its start date.");
  button.disabled = true; button.textContent = "Updating CRM…";
  try {
    await api.patchGuest(guest.inquiryId, { expectedUpdatedAt: guest.updatedAt, patch: { requested_date: startDate, requested_date_start: startDate, requested_date_end: endDate } });
    await refresh(false); await openGuest(guest.inquiryId); toast("CRM dates reconciled and verified.");
  } catch (error) {
    toast(error.message); button.disabled = false; button.textContent = "Confirm CRM date update";
  }
}

function openNewGuest() {
  if (!state.session?.capabilities?.write) return toast("Guest creation is read only for this account.");
  const dialog = $("#newGuestDialog"), form = $("#newGuestForm"); form.reset(); form.elements.guest_count.value = "1"; form.elements.followup_date.value = addIsoDays(todayIso(), 3); dialog.showModal(); setTimeout(() => form.elements.full_name.focus(), 50);
}

async function createGuest(event) {
  event.preventDefault(); const form = event.currentTarget, button = form.querySelector("button[type=submit]"), guest = Object.fromEntries(new FormData(form)); button.disabled = true;
  try {
    const result = await api.createGuest({ guest }); $("#newGuestDialog").close(); toast(result.returningGuest ? "Returning guest inquiry created." : "Guest created and verified."); await refresh(false); route("guests"); await openGuest(result.record.inquiryId);
  } catch (error) {
    if (error.body?.inquiryId) { $("#newGuestDialog").close(); toast(error.message); await openGuest(error.body.inquiryId); }
    else { toast(error.message); button.disabled = false; }
  }
}

async function saveStatus(event) {
  event.preventDefault(); const guest = state.guest.record; const button = event.currentTarget.querySelector("button"); const status = new FormData(event.currentTarget).get("status"); button.disabled = true;
  try { await api.patchGuest(guest.inquiryId, { expectedUpdatedAt: guest.updatedAt, patch: { status } }); toast("Status saved and verified."); await openGuest(guest.inquiryId, "status"); await refresh(false); } catch (error) { toast(error.message); button.disabled = false; }
}

async function saveFollowup(event) {
  event.preventDefault(); const guest = state.guest.record; const button = event.currentTarget.querySelector("button"); button.disabled = true;
  try { await api.patchGuest(guest.inquiryId, { expectedUpdatedAt: guest.updatedAt, patch: { followup_date: new FormData(event.currentTarget).get("followup_date") } }); toast("Follow-up saved and verified."); await openGuest(guest.inquiryId, "follow-up"); await refresh(false); } catch (error) { toast(error.message); button.disabled = false; }
}
async function saveInteraction(event) {
  event.preventDefault(); const guest = state.guest.record, data = Object.fromEntries(new FormData(event.currentTarget)); const button = event.currentTarget.querySelector("button");
  const entries = [
    { direction: "incoming", type: "guest_message", note: String(data.guest_note || "").trim(), followupAt: "" },
    { direction: "outgoing", type: "staff_reply", note: String(data.staff_note || "").trim(), followupAt: data.followupAt || "" },
  ].filter(item => item.note);
  if (!entries.length) return toast("Enter the guest message, your response, or both.");
  button.disabled = true; let saved = 0;
  try {
    const occurredAt = Date.now();
    for (const [index, entry] of entries.entries()) { await api.addInteraction(guest.inquiryId, { channel: data.channel, occurredAt: new Date(occurredAt + index * 1000).toISOString(), ...entry }); saved += 1; }
    toast(entries.length === 2 ? "Guest message and response logged." : "Communication logged."); await openGuest(guest.inquiryId, "communication"); await refresh(false);
  } catch (error) {
    toast(saved ? `${saved} message saved; ${error.message}` : error.message);
    if (saved) { await openGuest(guest.inquiryId, "communication"); await refresh(false); }
    else button.disabled = false;
  }
}
async function createService(event) {
  event.preventDefault();
  const form = event.currentTarget, guest = state.guest.record, data = Object.fromEntries(new FormData(form));
  const intent = event.submitter?.dataset.intent || "save", buttons = [...form.querySelectorAll("button")];
  const invoiceWindow = intent === "invoice" ? window.open("about:blank", "_blank") : null;
  buttons.forEach(button => { button.disabled = true; });
  try {
    const result = await api.addService(guest.inquiryId, { expectedUpdatedAt: guest.updatedAt, service: data });
    toast("Service added and verified.");
    if (invoiceWindow) {
      const invoiceGuest = { ...result.record, tours: [result.service], requestedDate: result.service.date, requestedDateEnd: result.service.date, partySize: result.service.guests || result.record.partySize };
      invoiceWindow.location.href = toolUrl("https://mindobirdwatching.com/book-tour/create/", invoiceGuest);
    }
    await openGuest(guest.inquiryId); await refresh(false);
  } catch (error) {
    if (invoiceWindow) invoiceWindow.close(); toast(error.message); buttons.forEach(button => { button.disabled = false; });
  }
}
async function saveServiceStatus(event) {
  event.preventDefault(); const form = event.currentTarget, guest = state.guest.record, button = form.querySelector("button"), status = new FormData(form).get("status"); button.disabled = true;
  try { await api.patchService(guest.inquiryId, form.dataset.service, { expectedUpdatedAt: guest.updatedAt, status }); toast("Service status saved and verified."); await openGuest(guest.inquiryId); await refresh(false); } catch (error) { toast(error.message); button.disabled = false; }
}
async function saveAssignment(event) {
  event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form)), button = form.querySelector("button"); button.disabled = true;
  try { await api.patchAssignment(form.dataset.assignment, { expectedUpdatedAt: form.dataset.updated, patch: data }); toast("Assignment saved and verified."); await openGuest(state.guest.record.inquiryId, "operations"); await refresh(false); } catch (error) { toast(error.message); button.disabled = false; }
}
function syncAssignmentService(event) {
  const tour = state.guest?.record?.tours?.[Number(event.currentTarget.value)]; if (!tour) return;
  const form = event.currentTarget.form, defaults = serviceTimes(tour); form.elements.service_date.value = tour.date || ""; form.elements.start_time.value = tour.startTime || defaults.start; form.elements.end_time.value = tour.endTime || defaults.end; form.elements.pickup_location.value = tour.pickup || state.guest.record.pickup || ""; form.elements.dropoff_location.value = tour.dropoff || "";
}
async function createAssignment(event) {
  event.preventDefault(); const form = event.currentTarget, guest = state.guest.record, data = Object.fromEntries(new FormData(form)), tour = guest.tours?.[Number(data.service_index)] || {}, provider = data.provider_index === "other" ? null : state.data?.providers?.[Number(data.provider_index)], button = form.querySelector("button");
  button.disabled = true;
  const providerName = provider?.name || "Other", providerOther = provider ? "" : String(data.provider_name_other || "").trim();
  try { await api.createAssignment({ inquiryId: guest.inquiryId, guestId: guest.guestId, bookingId: guest.bookingId, guestName: guest.name, guestPhone: guest.phone, guestCount: tour.guests || guest.partySize, assignment: { service_item_id: tour.id, service_date: data.service_date || tour.date, start_time: data.start_time, end_time: data.end_time, service_type: tour.serviceType || "Other", product_selected: tour.product, provider_id: provider?.providerId || "", provider_role: provider?.role || data.provider_role, provider_name: providerName, provider_name_other: providerOther, pickup_location: data.pickup_location, dropoff_location: data.dropoff_location, assignment_status: data.assignment_status, provider_informed: data.provider_informed, internal_note: tour.id ? `Service reference: ${tour.id}` : "" } }); toast("Assignment added and verified."); await openGuest(guest.inquiryId, "operations"); await refresh(false); } catch (error) { toast(error.message); button.disabled = false; }
}

async function refresh(showLoading = true, { quiet = false } = {}) {
  if (refreshPromise) return refreshPromise;
  if (showLoading) connection("loading", "Refreshing");
  refreshPromise = (async () => {
    try {
      const result = await api.bootstrap(), syncedAt = Date.now();
      state.data = result; state.cached = false; state.lastSyncedAt = syncedAt; state.snapshotSavedAt = syncedAt;
      await saveSnapshot(state.session.identity.email, result);
      connection("online"); render();
      return true;
    } catch (error) {
      if (!state.data) { connection("error", "Unavailable"); throw error; }
      state.cached = true; connection("cached"); render();
      if (!quiet) toast("Could not refresh. Saved data remains visible.");
      return false;
    } finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

async function maybeAutomaticRefresh(minimumAge = AUTO_SYNC_INTERVAL_MS) {
  if (!state.session || !state.data || !navigator.onLine || document.visibilityState !== "visible") return;
  const reference = state.lastSyncedAt || state.snapshotSavedAt;
  if (reference && Date.now() - reference < minimumAge) return;
  if (Date.now() - lastAutomaticAttemptAt < AUTO_RETRY_COOLDOWN_MS) return;
  lastAutomaticAttemptAt = Date.now();
  await refresh(false, { quiet: true });
}

async function start() {
  const loadingMessage = $("#loadingMessage"), loadingReveal = $("#loadingReveal");
  const setLoadingStage = (progress, message) => {
    const current = Number(loadingReveal?.dataset.progress || 0);
    if (loadingReveal && progress >= current) { loadingReveal.dataset.progress = String(progress); loadingReveal.style.setProperty("--load-progress", `${progress}%`); }
    if (loadingMessage && message) loadingMessage.textContent = message;
  };
  setLoadingStage(14, "Verifying your private staff access.");
  const loadingStages = [
    setTimeout(() => setLoadingStage(58, "Reconciling bookings, payments, and guest status."), 900),
    setTimeout(() => setLoadingStage(82, "Prioritizing tours, transportation, and follow-ups."), 2600),
  ];
  try {
    state.session = await api.session();
    setLoadingStage(38, "Loading current CRM records.");
    try { await refresh(false); }
    catch (networkError) {
      const saved = await loadSnapshot(state.session.identity.email); if (!saved) throw networkError;
      state.data = saved.data; state.cached = true; state.snapshotSavedAt = saved.savedAt; connection("cached"); render();
      [4000, 15000].forEach(delay => setTimeout(() => { if (state.cached && navigator.onLine) refresh(false); }, delay));
    }
    setLoadingStage(100, "MBW Nest ready.");
    await new Promise(resolve => setTimeout(resolve, 180));
    loadingStages.forEach(clearTimeout); $("#loadingState").hidden = true; $("#workspace").hidden = false; $("#bottomNav").hidden = false;
    const params = new URLSearchParams(location.search); route(params.get("view") || "actions"); if (params.get("guest")) openGuest(params.get("guest"), params.get("task") || "");
  } catch (error) { loadingStages.forEach(clearTimeout); $("#loadingState").hidden = true; $("#errorState").hidden = false; $("#errorMessage").textContent = error.message; connection("error", "Unavailable"); }
}

$("#bottomNav").addEventListener("click", event => { const button = event.target.closest("button[data-route]"); if (button) { if ($("#guestDialog").open) $("#guestDialog").close(); route(button.dataset.route); } });
$(".dialogNav").addEventListener("click", event => { const button = event.target.closest("button[data-dialog-route]"); if (button) { $("#guestDialog").close(); route(button.dataset.dialogRoute); } });
document.addEventListener("click", event => { const button = event.target.closest("[data-guest]"); if (button) openGuest(button.dataset.guest, button.dataset.task || ""); });
$("#closeGuest").addEventListener("click", () => $("#guestDialog").close());
$("#previousGuest").addEventListener("click", () => navigateGuest(-1));
$("#nextGuest").addEventListener("click", () => navigateGuest(1));
$("#guestDialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
$("#newGuestButton").addEventListener("click", openNewGuest);
$("#closeNewGuest").addEventListener("click", () => $("#newGuestDialog").close());
$("#newGuestDialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
$("#newGuestForm").addEventListener("submit", createGuest);
$("#guestDetail").addEventListener("click", event => { const button = event.target.closest("[data-reconcile-plan]"); if (button) reconcilePlanDates(button); });
$("#retryButton").addEventListener("click", () => location.reload());
$("#refreshButton").addEventListener("click", () => refresh());
$("#actionsView").addEventListener("click", event => {
  const summary = event.target.closest("[data-summary-filter]");
  if (summary) { state.summaryFilter = summary.dataset.summaryFilter; state.statusFilter = "all"; state.deskView = "list"; renderActions(); return; }
  const view = event.target.closest("[data-desk-view]");
  if (view) { state.deskView = view.dataset.deskView; if (state.deskView === "calendar" && !state.selectedDate) state.selectedDate = todayIso(); renderActions(); return; }
  const status = event.target.closest("[data-status-filter]");
  if (status) { state.statusFilter = status.dataset.statusFilter; renderActions(); return; }
  const day = event.target.closest("[data-calendar-date]");
  if (day) { state.selectedDate = day.dataset.calendarDate; renderActions(); }
});
$("#actionsView").addEventListener("change", event => {
  if (event.target.id === "actionRepFilter") { state.repFilter = event.target.value; state.statusFilter = "all"; state.summaryFilter = "open"; render(); return; }
  if (event.target.id === "moreStatusFilter" && event.target.value) { state.statusFilter = event.target.value; renderActions(); }
});
$("#previousWeek").addEventListener("click", () => { state.weekStart = addIsoDays(state.weekStart || todayIso(), -7); state.selectedDate = state.weekStart; renderActions(); });
$("#nextWeek").addEventListener("click", () => { state.weekStart = addIsoDays(state.weekStart || todayIso(), 7); state.selectedDate = state.weekStart; renderActions(); });
$("#guestSearchForm").addEventListener("submit", async event => { event.preventDefault(); const query = $("#guestSearch").value.trim(); if (query.length < 2) return toast("Enter at least two characters."); $("#guestList").innerHTML = empty("Searching…"); try { const result = await api.search(query); state.guestSearchResults = result.records; renderGuests(result.records, true); } catch (error) { $("#guestList").innerHTML = empty(error.message); } });
$("#guestSearch").addEventListener("input", event => { if (!event.currentTarget.value.trim()) { state.guestSearchResults = null; renderGuests(); } });
$("#guestsView").addEventListener("click", event => { const button = event.target.closest("[data-guest-status-filter]"); if (!button) return; state.guestStatusFilter = button.dataset.guestStatusFilter; state.guestSearchResults = null; $("#guestSearch").value = ""; renderGuestStatusFilters(); renderGuests(); });
$("#guestsView").addEventListener("change", event => {
  if (event.target.id === "guestRepFilter") { state.repFilter = event.target.value; state.guestStatusFilter = "active"; state.guestSearchResults = null; $("#guestSearch").value = ""; render(); return; }
  if (event.target.id !== "guestMoreStatusFilter" || !event.target.value) return;
  state.guestStatusFilter = event.target.value; state.guestSearchResults = null; $("#guestSearch").value = ""; renderGuestStatusFilters(); renderGuests();
});
$("#guideViewSelect").addEventListener("change", updateGuideViewLink);
$("#clearCacheButton").addEventListener("click", async () => { if (state.session?.identity?.email) await clearSnapshot(state.session.identity.email); toast("Saved snapshot cleared."); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") maybeAutomaticRefresh(FOREGROUND_SYNC_MIN_AGE_MS); });
window.addEventListener("focus", () => maybeAutomaticRefresh(FOREGROUND_SYNC_MIN_AGE_MS));
window.addEventListener("online", () => { connection(state.cached ? "cached" : "online"); maybeAutomaticRefresh(RECONNECT_SYNC_MIN_AGE_MS); });
window.addEventListener("offline", () => connection("offline", "Offline"));
setInterval(updateConnectionAge, 30 * 1000);
setInterval(() => maybeAutomaticRefresh(AUTO_SYNC_INTERVAL_MS), 60 * 1000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/app/sw.js?v=31", { scope: "/app/" }).catch(() => {});
start();
