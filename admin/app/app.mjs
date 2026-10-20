import { api } from "./modules/api.mjs";
import { loadSnapshot, saveSnapshot, clearSnapshot } from "./modules/cache.mjs";
import { STATUS_FILTERS, addIsoDays, filterRecords, followupUrgency, priorityFor, recordDates, serviceSummary, weekDates } from "./modules/action-desk.mjs";

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const pretty = value => String(value || "—").replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
const money = (value, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value || 0));
const date = value => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Guayaquil" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00-05:00`)) : "Not set";
const time = value => value ? String(value).slice(0, 5) : "Time not set";
const phoneDigits = value => String(value || "").replace(/\D/g, "");
const STATUS_OPTIONS = ["new", "contacted", "planning", "qualified", "quoted", "follow_up", "deposit_pending", "deposit_paid", "payment_pending", "booked", "completed", "cancelled", "did_not_book", "duplicate"];
const state = { session: null, data: null, route: "actions", cached: false, guest: null, deskView: "list", statusFilter: "all", selectedDate: "", weekStart: "" };

function connection(mode, label) { const node = $("#connectionState"); node.dataset.state = mode; node.querySelector("b").textContent = label; }
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

function deskCard(record, action = null) {
  const bookings = relatedBookings(record), today = todayIso(), status = record.effectiveStatus || record.status;
  const priority = priorityFor(record, bookings, today, action), followup = followupUrgency(today, record.followupDate), services = serviceSummary(record, bookings);
  const dates = recordDates(record, bookings), first = dates[0] || priority.tourDate, last = dates.at(-1) || first;
  const tourDate = first ? (last && last !== first ? `${shortDate(first)}–${shortDate(last)}` : shortDate(first)) : "Not set";
  const count = services.count ? `${services.count} service${services.count === 1 ? "" : "s"}` : "Service pending";
  return `<button class="actionCard ${statusClass(status)}" data-guest="${esc(record.inquiryId)}" data-task="${esc(action?.type || "")}" type="button">
    <div class="cardTop"><strong>${esc(record.name || action?.guest || "Guest")}</strong><span class="priorityBadge priority-${priority.band}">${esc(priority.band)}</span></div>
    <div class="serviceLine"><span class="serviceIcons" aria-hidden="true">${esc(services.icons)}</span><span class="serviceName">${esc(services.primary)}</span><span class="serviceCount">${esc(record.partySize || "?")} ${Number(record.partySize) === 1 ? "guest" : "guests"} · ${esc(count)}</span></div>
    <div class="cardFacts"><span class="statusBadge ${statusClass(status)}">${esc(pretty(status))}</span><span class="tourDate"><b>Tour</b> ${esc(tourDate)}</span><span class="followupDate followup-${followup.tone}"><b>Follow-up</b> ${esc(followup.label)}</span></div>
    ${action?.reason ? `<div class="actionReason">${esc(action.reason)} · ${esc(record.assignedTo || action.owner || "Unassigned")}</div>` : ""}
  </button>`;
}

function renderStatusFilters() {
  $("#statusFilters").innerHTML = STATUS_FILTERS.map(value => `<button type="button" data-status-filter="${value}" class="${state.statusFilter === value ? "active" : ""}">${esc(value === "all" ? "All active" : pretty(value))}</button>`).join("");
}

function renderCalendar() {
  const today = todayIso();
  if (!state.weekStart) state.weekStart = today;
  if (!state.selectedDate) state.selectedDate = today;
  const dates = weekDates(state.weekStart), all = filterRecords(deskRecords(), state.data?.bookings || [], { status: state.statusFilter });
  $("#calendarRange").textContent = `${shortDate(dates[0])} – ${shortDate(dates.at(-1))}`;
  $("#weekStrip").innerHTML = dates.map(value => {
    const count = all.filter(record => recordDates(record, relatedBookings(record)).includes(value)).length;
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
    return `<button type="button" data-calendar-date="${value}" class="${state.selectedDate === value ? "selected" : ""}"><small>${weekday}</small><strong>${Number(value.slice(-2))}</strong><span>${count ? `${count}` : ""}</span></button>`;
  }).join("");
  $("#calendarSelection").textContent = `${shortDate(state.selectedDate)} · ${state.statusFilter === "all" ? "all active statuses" : pretty(state.statusFilter)}`;
}

function renderActions() {
  const actions = state.data?.actions || [];
  const urgent = actions.filter(item => item.priority === 0).length;
  const due = actions.filter(item => ["follow-up", "interaction-follow-up"].includes(item.type)).length;
  $("#actionSummary").innerHTML = `<div class="summaryItem"><strong>${actions.length}</strong><span>Open</span></div><div class="summaryItem"><strong>${urgent}</strong><span>Urgent</span></div><div class="summaryItem"><strong>${due}</strong><span>Follow-ups</span></div>`;
  renderStatusFilters();
  document.querySelectorAll("[data-desk-view]").forEach(button => button.classList.toggle("active", button.dataset.deskView === state.deskView));
  $("#calendarPanel").hidden = state.deskView !== "calendar";
  if (state.deskView === "calendar") renderCalendar();
  const filteredMode = state.statusFilter !== "all" || state.deskView === "calendar";
  let records = filteredMode
    ? filterRecords(deskRecords(), state.data?.bookings || [], { status: state.statusFilter, selectedDate: state.deskView === "calendar" ? state.selectedDate : "" })
    : actions.map(item => recordById(item.inquiryId)).filter(Boolean);
  records = [...new Map(records.map(record => [record.inquiryId, record])).values()];
  records.sort((left, right) => priorityFor(right, relatedBookings(right), todayIso(), actionFor(right)).score - priorityFor(left, relatedBookings(left), todayIso(), actionFor(left)).score || (left.name || "").localeCompare(right.name || ""));
  $("#actionList").innerHTML = records.length ? records.map(record => deskCard(record, actionFor(record))).join("") : empty(filteredMode ? "No active records match this date and status." : "Nothing needs immediate action from the current CRM records.");
}

function guestCard(item) {
  return `<button class="guestCard" data-guest="${esc(item.inquiryId)}" type="button"><div class="cardTop"><strong>${esc(item.name || "Guest")}</strong><span class="badge">${esc(pretty(item.effectiveStatus || item.status))}</span></div><p>${esc(item.tours?.[0]?.tour || "Tour not selected")}</p><div class="cardMeta"><span>${esc(item.assignedTo || "Unassigned")}</span><span>${esc(item.requestedDate ? date(item.requestedDate) : item.inquiryId)}</span></div></button>`;
}

function renderGuests(records = state.data?.recentGuests || []) { $("#guestList").innerHTML = records.length ? records.map(guestCard).join("") : empty("No matching guests were found."); }
function renderToday() {
  const records = state.data?.today || [];
  $("#todayList").innerHTML = records.length ? records.map(item => `<button class="todayCard" data-guest="${esc(item.inquiryId)}" type="button"><div class="cardTop"><strong>${esc(item.startTime ? time(item.startTime) : "Time pending")} · ${esc(item.guest)}</strong>${item.risk ? `<span class="badge badge--urgent">Attention</span>` : `<span class="badge">Ready</span>`}</div><p>${esc(item.tour || "Tour")} · ${esc(item.partySize || "?")} guests</p><div class="todayMeta"><span>${esc(item.pickup || "Pickup not set")}</span></div>${item.risk ? `<p><strong>${esc(item.risk)}</strong></p>` : ""}</button>`).join("") : empty("No tours are recorded for today in Ecuador.");
}

function renderMore() {
  const identity = state.session?.identity || {};
  $("#identityName").textContent = identity.name || identity.email || "—";
  $("#identityRole").textContent = pretty(identity.role);
  $("#lastChecked").textContent = state.data?.checkedAt ? new Date(state.data.checkedAt).toLocaleString() : "—";
  $("#writeState").textContent = state.session?.capabilities?.write ? "Enabled" : "Read only";
}

function render() { renderActions(); renderGuests(); renderToday(); renderMore(); $("#cachedNotice").hidden = !state.cached; }
function route(name) {
  state.route = ["actions", "guests", "today", "more"].includes(name) ? name : "actions";
  document.querySelectorAll(".view").forEach(view => { view.hidden = view.dataset.view !== state.route; });
  document.querySelectorAll("#bottomNav button").forEach(button => button.classList.toggle("active", button.dataset.route === state.route));
  window.history.replaceState({}, "", state.route === "actions" ? "/app/" : `/app/?view=${state.route}`);
  $("#appMain").focus({ preventScroll: true }); window.scrollTo(0, 0);
}

function journeyMarkup(journey) { return `<div class="journey">${journey.map(item => `<div class="journeyStep" data-state="${esc(item.state)}"><i></i><div><strong>${esc(item.label)}</strong><small>${esc(item.evidence)}</small></div></div>`).join("")}</div>`; }
function paymentMarkup(records) { return records.length ? records.map(item => `<div class="recordItem"><strong>${esc(item.invoiceNo || "Payment")}</strong><p>${esc(pretty(item.status))} · ${esc(money(item.totalPaid, item.currency))} paid</p><small>${item.balance ? `${esc(money(item.balance, item.currency))} balance` : "No recorded balance"}</small></div>`).join("") : `<div class="recordItem"><p>No payment ledger entries.</p></div>`; }
function assignmentMarkup(records, canWrite) { return records.length ? records.map(item => `<form class="recordItem assignmentForm" data-assignment="${esc(item.assignmentId)}" data-updated="${esc(item.updatedAt)}"><strong>${esc(item.providerName || pretty(item.providerRole))}</strong><p>${esc(item.serviceType || item.product || "Assignment")} · ${esc(date(item.serviceDate))}</p><label class="field"><span>Status</span><select name="assignment_status" ${canWrite ? "" : "disabled"}>${["pending","confirmed","completed","cancelled"].map(value => `<option value="${value}" ${item.status === value ? "selected" : ""}>${esc(pretty(value))}</option>`).join("")}</select></label><label class="field"><span>Provider informed</span><select name="provider_informed" ${canWrite ? "" : "disabled"}><option value="No" ${item.providerInformed ? "" : "selected"}>No</option><option value="Yes" ${item.providerInformed ? "selected" : ""}>Yes</option></select></label><div class="formActions"><button type="submit" ${canWrite ? "" : "disabled"}>Save assignment</button></div></form>`).join("") : `<div class="recordItem"><p>No provider assignments.</p></div>`; }
function interactionMarkup(records) { return records.length ? records.slice().sort((a,b) => String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, 20).map(item => `<div class="recordItem"><strong>${esc(pretty(item.channel))} · ${esc(pretty(item.direction))}</strong><p>${esc(item.note)}</p><small>${esc(item.occurredAt ? new Date(item.occurredAt).toLocaleString() : "Date unavailable")} · ${esc(item.createdBy || "Staff")}</small></div>`).join("") : `<div class="recordItem"><p>No communications logged.</p></div>`; }

async function openGuest(id, task = "") {
  const dialog = $("#guestDialog"), body = $("#guestDetail");
  $("#guestDialogTitle").textContent = "Loading…"; body.innerHTML = `<section class="stateCard"><div class="spinner"></div><p>Loading the current guest record.</p></section>`; if (!dialog.open) dialog.showModal();
  try {
    const result = await api.guest(id); state.guest = result; const guest = result.record; const canWrite = Boolean(state.session?.capabilities?.write);
    const selectedStatus = STATUS_OPTIONS.includes(guest.effectiveStatus) ? guest.effectiveStatus : guest.status;
    $("#guestDialogTitle").textContent = guest.name || "Guest";
    const whatsapp = phoneDigits(guest.phone);
    body.innerHTML = `<section class="detailHero"><h2>${esc(guest.name || "Guest")}</h2><p>${esc(guest.email || "Email not recorded")}</p><p>${esc(guest.phone || "Phone not recorded")}</p><div class="contactLinks">${whatsapp ? `<a href="https://wa.me/${esc(whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}${guest.email ? `<a href="mailto:${encodeURIComponent(guest.email)}">Email</a>` : ""}</div></section>
      <section class="detailSection"><div class="detailTitle"><h3>Guest Journey</h3><span class="badge">${esc(pretty(guest.effectiveStatus || guest.status))}</span></div>${guest.needsReconciliation ? `<p class="formNote formNote--warn">Legacy booking or payment records need reconciliation before this inquiry is treated as current.</p>` : ""}${journeyMarkup(result.journey)}</section>
      <section class="detailSection" data-section="status"><h3>Inquiry status</h3><form id="statusForm"><label class="field"><span>Saved CRM status</span><select name="status" ${canWrite ? "" : "disabled"}>${STATUS_OPTIONS.map(value => `<option value="${value}" ${selectedStatus === value ? "selected" : ""}>${esc(pretty(value))}</option>`).join("")}</select></label><div class="formActions"><button type="submit" ${canWrite ? "" : "disabled"}>Save status</button></div>${guest.status !== selectedStatus ? `<p class="formNote">The operational status is derived as ${esc(pretty(selectedStatus))}. Saving makes that status canonical in the CRM.</p>` : ""}${canWrite ? "" : `<p class="formNote formNote--warn">Changes are disabled until the production write configuration is complete.</p>`}</form></section>
      <section class="detailSection" data-section="follow-up"><h3>Next follow-up</h3><form id="followupForm"><label class="field"><span>Date</span><input type="date" name="followup_date" value="${esc(guest.followupDate)}" ${canWrite ? "" : "disabled"}></label><div class="formActions"><button type="submit" ${canWrite ? "" : "disabled"}>Save follow-up</button></div>${canWrite ? "" : `<p class="formNote formNote--warn">Changes are disabled until the production write configuration is complete.</p>`}</form></section>
      <section class="detailSection" data-section="payments"><h3>Payments</h3><div class="recordList">${paymentMarkup(result.data.payments)}</div><div class="toolLinks"><a href="/zelle-invoice-generator/?inquiry_id=${encodeURIComponent(guest.inquiryId)}" target="_blank" rel="noopener noreferrer">Zelle invoice</a><a href="https://mindobirdwatching.com/book-tour/create/" target="_blank" rel="noopener noreferrer">Stripe invoice</a></div></section>
      <section class="detailSection" data-section="confirmation"><h3>Confirmation</h3><p>Open the existing generator with this inquiry reference, then verify the guest details before sending.</p><div class="toolLinks"><a href="/tour-confirmation-generator/?inquiry_id=${encodeURIComponent(guest.inquiryId)}" target="_blank" rel="noopener noreferrer">Open confirmation generator</a></div></section>
      <section class="detailSection" data-section="operations"><h3>Operations</h3><div class="recordList">${assignmentMarkup(result.data.assignments, canWrite)}</div></section>
      <section class="detailSection" data-section="communication"><h3>Communication</h3><form id="interactionForm"><label class="field"><span>Channel</span><select name="channel" ${canWrite ? "" : "disabled"}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Phone</option><option value="in_person">In person</option><option value="other">Other</option></select></label><label class="field"><span>Direction</span><select name="direction" ${canWrite ? "" : "disabled"}><option value="outgoing">Outgoing</option><option value="incoming">Incoming</option><option value="internal">Internal note</option></select></label><label class="field"><span>Note</span><textarea name="note" maxlength="4000" required ${canWrite ? "" : "disabled"}></textarea></label><label class="field"><span>Follow-up date (optional)</span><input type="date" name="followupAt" ${canWrite ? "" : "disabled"}></label><div class="formActions"><button type="submit" ${canWrite ? "" : "disabled"}>Log communication</button></div></form><div class="recordList">${interactionMarkup(result.data.interactions)}</div></section>`;
    $("#statusForm")?.addEventListener("submit", saveStatus); $("#followupForm")?.addEventListener("submit", saveFollowup); $("#interactionForm")?.addEventListener("submit", saveInteraction); body.querySelectorAll(".assignmentForm").forEach(form => form.addEventListener("submit", saveAssignment));
    if (task) setTimeout(() => body.querySelector(`[data-section="${CSS.escape(task === "interaction-follow-up" ? "communication" : task)}"]`)?.scrollIntoView({ behavior: "smooth" }), 80);
  } catch (error) { body.innerHTML = `<div class="emptyCard">${esc(error.message)}</div>`; }
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
  event.preventDefault(); const guest = state.guest.record, data = Object.fromEntries(new FormData(event.currentTarget)); const button = event.currentTarget.querySelector("button"); button.disabled = true;
  try { await api.addInteraction(guest.inquiryId, { ...data, type: data.direction === "internal" ? "internal_note" : data.direction === "incoming" ? "guest_message" : "staff_reply" }); toast("Communication logged."); await openGuest(guest.inquiryId, "communication"); await refresh(false); } catch (error) { toast(error.message); button.disabled = false; }
}
async function saveAssignment(event) {
  event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form)), button = form.querySelector("button"); button.disabled = true;
  try { await api.patchAssignment(form.dataset.assignment, { expectedUpdatedAt: form.dataset.updated, patch: data }); toast("Assignment saved and verified."); await openGuest(state.guest.record.inquiryId, "operations"); await refresh(false); } catch (error) { toast(error.message); button.disabled = false; }
}

async function refresh(showLoading = true) {
  if (showLoading) connection("loading", "Refreshing");
  try { const result = await api.bootstrap(); state.data = result; state.cached = false; await saveSnapshot(state.session.identity.email, result); connection("online", "Live"); render(); }
  catch (error) { connection(state.data ? "cached" : "error", state.data ? "Saved" : "Unavailable"); if (!state.data) throw error; toast("Could not refresh. Saved data remains visible."); }
}

async function start() {
  const loadingMessage = $("#loadingMessage");
  const loadingStages = [
    setTimeout(() => { if (loadingMessage) loadingMessage.textContent = "Reconciling bookings, payments, and guest status."; }, 900),
    setTimeout(() => { if (loadingMessage) loadingMessage.textContent = "Prioritizing tours, transportation, and follow-ups."; }, 2600),
  ];
  try {
    state.session = await api.session();
    try { await refresh(false); }
    catch (networkError) { const saved = await loadSnapshot(state.session.identity.email); if (!saved) throw networkError; state.data = saved.data; state.cached = true; connection("cached", "Saved"); render(); }
    loadingStages.forEach(clearTimeout); $("#loadingState").hidden = true; $("#workspace").hidden = false; $("#bottomNav").hidden = false;
    const params = new URLSearchParams(location.search); route(params.get("view") || "actions"); if (params.get("guest")) openGuest(params.get("guest"), params.get("task") || "");
  } catch (error) { loadingStages.forEach(clearTimeout); $("#loadingState").hidden = true; $("#errorState").hidden = false; $("#errorMessage").textContent = error.message; connection("error", "Unavailable"); }
}

$("#bottomNav").addEventListener("click", event => { const button = event.target.closest("button[data-route]"); if (button) route(button.dataset.route); });
document.addEventListener("click", event => { const button = event.target.closest("[data-guest]"); if (button) openGuest(button.dataset.guest, button.dataset.task || ""); });
$("#closeGuest").addEventListener("click", () => $("#guestDialog").close());
$("#guestDialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
$("#retryButton").addEventListener("click", () => location.reload());
$("#refreshButton").addEventListener("click", () => refresh());
$("#actionsView").addEventListener("click", event => {
  const view = event.target.closest("[data-desk-view]");
  if (view) { state.deskView = view.dataset.deskView; if (state.deskView === "calendar" && !state.selectedDate) state.selectedDate = todayIso(); renderActions(); return; }
  const status = event.target.closest("[data-status-filter]");
  if (status) { state.statusFilter = status.dataset.statusFilter; renderActions(); return; }
  const day = event.target.closest("[data-calendar-date]");
  if (day) { state.selectedDate = day.dataset.calendarDate; renderActions(); }
});
$("#previousWeek").addEventListener("click", () => { state.weekStart = addIsoDays(state.weekStart || todayIso(), -7); state.selectedDate = state.weekStart; renderActions(); });
$("#nextWeek").addEventListener("click", () => { state.weekStart = addIsoDays(state.weekStart || todayIso(), 7); state.selectedDate = state.weekStart; renderActions(); });
$("#guestSearchForm").addEventListener("submit", async event => { event.preventDefault(); const query = $("#guestSearch").value.trim(); if (query.length < 2) return toast("Enter at least two characters."); $("#guestList").innerHTML = empty("Searching…"); try { const result = await api.search(query); renderGuests(result.records); } catch (error) { $("#guestList").innerHTML = empty(error.message); } });
$("#clearCacheButton").addEventListener("click", async () => { if (state.session?.identity?.email) await clearSnapshot(state.session.identity.email); toast("Saved snapshot cleared."); });
window.addEventListener("online", () => refresh(false)); window.addEventListener("offline", () => connection("cached", "Offline"));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" }).catch(() => {});
start();
