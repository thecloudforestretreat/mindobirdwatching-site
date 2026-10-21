const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
let data;
let toastTimer;

function empty(message) { return `<div class="empty">${esc(message)}</div>`; }
function countLabel(value) { return value ? `${esc(value)} guest${String(value) === "1" ? "" : "s"}` : "Guest count not set"; }
const icon = name => `<span class="buttonIcon buttonIcon--${name}" aria-hidden="true"></span>`;
function tourCard(tour) {
  const phone = tour.phone ? `<a class="whatsapp" href="${esc(tour.whatsappUrl)}" target="_blank" rel="noopener noreferrer">${icon("whatsapp")}WhatsApp</a>` : `<button type="button" disabled>Phone unavailable</button>`;
  return `<article class="tourCard"><div class="tourHead"><h2>${esc(tour.guestName)}</h2><span>Booked</span></div><div class="tourInfo"><div><small>Date &amp; time</small><strong>${esc(tour.dateLabel)}${tour.startTime ? ` · ${esc(tour.startTime)}` : ""}</strong></div><div><small>Service</small><strong>${esc(tour.service)}</strong></div><div class="wide"><small>Pickup</small><strong>${esc(tour.pickup || "Pickup not set")}</strong></div><div><small>Guests</small><strong>${countLabel(tour.guestCount)}</strong></div><div><small>Phone</small><strong>${esc(tour.phone || "Not available")}</strong></div></div><div class="tourActions">${phone}<button type="button" data-copy="${encodeURIComponent(tour.guestMessage)}">${icon("copy")}Copy guest message</button><a href="/guide-tour-recap/?booking=${encodeURIComponent(tour.bookingId || tour.assignmentId)}">${icon("bird")}Sightings report</a>${tour.calendarUrl ? `<a href="${esc(tour.calendarUrl)}" target="_blank" rel="noopener noreferrer">${icon("calendar")}Open calendar</a>` : ""}</div></article>`;
}

function renderTours() {
  $("#tourList").innerHTML = data.tours.length ? data.tours.map(tourCard).join("") : empty(data.providerName ? `No booked assignments are currently assigned to ${data.providerName}.` : "Choose a guide to preview booked assignments.");
  const groups = Map.groupBy ? Map.groupBy(data.tours, item => item.serviceDate || "pending") : data.tours.reduce((map, item) => map.set(item.serviceDate || "pending", [...(map.get(item.serviceDate || "pending") || []), item]), new Map());
  $("#calendarList").innerHTML = data.tours.length ? [...groups.entries()].map(([, tours]) => `<section class="dateGroup"><h2>${esc(tours[0].dateLabel)}</h2>${tours.map(tour => `<div class="dateItem"><time>${esc(tour.startTime || "Pending")}</time><div><strong>${esc(tour.service)} · ${esc(tour.guestName)}</strong><small>${esc(tour.pickup || "Pickup not set")}</small></div></div>`).join("")}</section>`).join("") : empty("No booked assignments to place on the calendar.");
  $("#reportTour").innerHTML = data.tours.length ? data.tours.map(tour => `<option value="${esc(tour.bookingId || tour.assignmentId)}">${esc(tour.dateLabel)} · ${esc(tour.guestName)}</option>`).join("") : `<option value="">No booked tour available</option>`;
  updateReportLink();
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
    ["google", "https://mindobirdwatching.com/assets/images/icons/mbw_gr.png", "Google review", "Request a Google review", data.links.google],
    ["tripadvisor", "https://mindobirdwatching.com/assets/images/icons/mbw_icons_trip_advisor.png", "Tripadvisor", "Request a Tripadvisor review", data.links.tripadvisor],
    ["social", "https://mindobirdwatching.com/assets/images/icons/mbw_ig.png", "Instagram", "Share birding updates", data.links.instagram],
    ["facebook", "https://mindobirdwatching.com/assets/images/icons/mbw_fb.png", "Facebook", "Share the MBW page", data.links.facebook],
    ["youtube", "https://mindobirdwatching.com/assets/images/icons/mbw_yt.png", "YouTube", "Share the MBW channel", data.links.youtube],
    ["shop", "https://mindobirdwatching.com/assets/images/icons/mbw_shop.png", "MBW Shop", "Share the official shop", data.links.shop],
  ];
  $("#shareList").innerHTML = items.map(([kind, image, title, subtitle, url]) => `<article class="shareCard shareCard--${kind}"><span><img src="${esc(image)}" alt=""></span><div><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></div><button class="copyButton" type="button" data-copy="${encodeURIComponent(shareMessage(kind, url))}">${icon("copy")}Copy</button></article>`).join("");
}

function renderPreview() {
  const panel = $("#adminPreview");
  panel.hidden = !data.preview;
  if (!data.preview) return;
  $("#providerSelect").innerHTML = data.providers.length ? data.providers.map(name => `<option value="${esc(name)}" ${name === data.providerName ? "selected" : ""}>${esc(name)}</option>`).join("") : `<option value="">No guide records found</option>`;
}

function render() { renderPreview(); renderTours(); renderShare(); }

async function load(provider = "") {
  $("#error").hidden = true; $("#loading").hidden = false; $("#workspace").hidden = true; $("#nav").hidden = true;
  try {
    const url = new URL("/api/guide/bootstrap", location.origin); if (provider) url.searchParams.set("provider", provider);
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" }); const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Guide data could not load.");
    data = body; render(); $("#loading").hidden = true; $("#workspace").hidden = false; $("#nav").hidden = false;
  } catch (error) { $("#loading").hidden = true; $("#errorText").textContent = error.message; $("#error").hidden = false; }
}

function route(name) {
  document.querySelectorAll(".view").forEach(view => { view.hidden = view.dataset.view !== name; });
  document.querySelectorAll(".nav button").forEach(button => button.classList.toggle("active", button.dataset.route === name));
  history.replaceState({}, "", name === "today" ? "/guide/" : `/guide/?view=${name}`); scrollTo(0, 0);
}

function updateReportLink() { const reference = $("#reportTour").value; $("#openReport").href = reference ? `/guide-tour-recap/?booking=${encodeURIComponent(reference)}` : "/guide-tour-recap/"; }
async function copyText(text) { await navigator.clipboard.writeText(text); $("#toast").textContent = "Copied to clipboard"; $("#toast").hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 1800); }

document.addEventListener("click", event => { const nav = event.target.closest("[data-route]"); if (nav) route(nav.dataset.route); const copy = event.target.closest("[data-copy]"); if (copy) copyText(decodeURIComponent(copy.dataset.copy)).catch(() => alert("Copy is unavailable in this browser.")); });
$("#providerSelect").addEventListener("change", event => load(event.target.value));
$("#reportTour").addEventListener("change", updateReportLink);
$("#refresh").addEventListener("click", () => load(data?.providerName || ""));
$("#retry").addEventListener("click", () => load());
load().then(() => route(new URLSearchParams(location.search).get("view") || "today"));
