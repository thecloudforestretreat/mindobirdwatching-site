(() => {
  "use strict";
  const ROOT = "https://mindobirdwatching.com/api/admin/";
  const FALLBACK_IMAGE = "https://mindobirdwatching.com/assets/images/birds/mbw_image_coming_soon_02.jpg";
  let birds = [];
  let currentRows = [];
  let currentStats = null;
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const searchable = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const displayDate = (value) => {
    const raw = String(value || "").trim();
    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.\d{3})?Z)?$/);
    if (dateOnly) {
      const [, year, month, day] = dateOnly.map(Number);
      return new Date(year, month - 1, day, 12).toLocaleDateString("en-US", { dateStyle: "medium" });
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? (raw || "Unknown date") : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  };
  const birdFor = (code) => birds.find((bird) => bird.speciesCode === code) || {};
  const truthy = (value) => value === true || ["1", "true", "yes", "y"].includes(String(value || "").trim().toLowerCase());
  const isRare = (row) => {
    const priority = String(row?.mbw_priority || row?.priority || "").trim().toLowerCase();
    return truthy(row?.notable) || truthy(row?.ebird_notable) || ["rare", "high", "priority", "alert", "notable"].includes(priority);
  };

  function selectedBird() {
    const raw = $("birdSearch").value.trim();
    const code = raw.match(/\(([a-z0-9-]+)\)$/i)?.[1];
    if (code) return birdFor(code);
    const query = searchable(raw);
    if (!query) return null;
    return birds.find((bird) => [bird.speciesCode, bird.englishName, bird.spanishName].some((value) => searchable(value) === query)) || null;
  }

  function groupRows(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const key = row.speciesCode || row.englishName || "unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return [...groups.entries()].map(([code, sightings]) => ({ code, sightings }));
  }

  function cardMarkup(group, apiStats) {
    const latest = group.sightings[0] || {};
    const species = birdFor(group.code);
    const english = species.englishName || latest.englishName || latest.commonName || group.code;
    const spanish = species.spanishName || latest.spanishName || "Spanish name pending";
    const scientific = species.scientificName || latest.scientificName || "Scientific name pending";
    const stats = apiStats && apiStats.speciesCode === group.code ? apiStats : null;
    const rare = group.sightings.some(isRare);
    return `<article class="sightingCard${rare ? " sightingCard--rare" : ""}" data-species-code="${esc(group.code)}">
      <div class="sightingCardMedia"><img loading="lazy" src="${esc(species.image || FALLBACK_IMAGE)}" alt="${esc(english)}" onerror="this.src='${FALLBACK_IMAGE}'"><span>${esc(String(latest.source || "unknown").toUpperCase())}</span></div>
      <div class="sightingCardBody">
        <div class="sightingCardTitle"><div><h3>${esc(english)}</h3><strong>${esc(spanish)}</strong><small><em>${esc(scientific)}</em> · ${esc(group.code)}</small></div><div class="sightingCardTitleMeta">${rare ? '<span class="sightingRareBadge" title="Flagged as rare or notable by eBird or MBW">Rare / notable</span>' : ""}<span>${group.sightings.length} recent</span></div></div>
        <div class="sightingStats">
          <div><small>Last reported</small><strong data-stat="last">${esc(displayDate(stats?.last_observed_at || latest.observed_at || latest.observedAt))}</strong></div>
          <div><small>Last 7 days</small><strong data-stat="seven">${stats ? esc(stats.last_7_days) + " times" : "—"}</strong></div>
          <div><small>Last 30 days</small><strong data-stat="thirty">${stats ? esc(stats.last_30_days) + " times" : "—"}</strong></div>
        </div>
        <p class="sightingLocation"><strong>Latest area:</strong> ${esc(latest.location_name || latest.locationName || "Not provided")}</p>
        <button class="birdingButton sightingLiveButton" type="button" data-live-stats="${esc(group.code)}">Check live eBird stats</button>
        <details><summary>Last ${group.sightings.length} matching report${group.sightings.length === 1 ? "" : "s"}</summary><ol>${group.sightings.map((row) => `<li><strong>${esc(displayDate(row.observed_at || row.observedAt))}</strong><span>${esc(row.source || "Unknown")} · ${esc(row.location_name || row.locationName || "Area not provided")}</span></li>`).join("")}</ol></details>
      </div>
    </article>`;
  }

  function render(rows, stats) {
    const allGroups = groupRows(rows);
    const rareOnly = $("rareFilter").value === "rare";
    const groups = allGroups.filter((group) => !rareOnly || group.sightings.some(isRare)).slice(0, 20).map((group) => ({ ...group, sightings: group.sightings.slice(0, 20) }));
    const shownReports = groups.reduce((total, group) => total + group.sightings.length, 0);
    $("countBadge").textContent = `${groups.length} bird${groups.length === 1 ? "" : "s"} · ${shownReports} reports shown`;
    const empty = rareOnly ? "No rare or notable sightings match these filters." : "No matching reports were found yet.";
    $("sightingsList").innerHTML = groups.map((group) => cardMarkup(group, stats)).join("") || `<div class="birdingEmpty">${empty}</div>`;
    return { birdCount: groups.length, shownReports, reviewedReports: rows.length, rareOnly };
  }

  function applyView() {
    const view = render(currentRows, currentStats);
    if (!currentRows.length) return view;
    $("status").textContent = view.birdCount ? `Showing ${view.birdCount} unique bird card${view.birdCount === 1 ? "" : "s"} from ${view.reviewedReports} recent report${view.reviewedReports === 1 ? "" : "s"}.` : "No rare or notable sightings match these filters.";
    $("status").dataset.tone = view.birdCount ? "success" : "warning";
    return view;
  }

  async function loadBirds() {
    try {
      const response = await fetch(ROOT + "bird-species", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      birds = Array.isArray(data.birds) ? data.birds : [];
      $("birdOptions").innerHTML = birds.map((bird) => `<option value="${esc(bird.englishName)} — ${esc(bird.spanishName || "")} (${esc(bird.speciesCode)})"></option>`).join("");
    } catch (_) {}
  }

  async function requestSightings({ speciesCode = "", liveStats = false } = {}) {
    const params = new URLSearchParams({ source: liveStats ? "ebird" : $("sourceFilter").value, days: liveStats ? "30" : $("daysFilter").value, limit: "100" });
    if (speciesCode) params.set("speciesCode", speciesCode);
    if (liveStats) { params.set("liveStats", "1"); params.set("trackDemand", "1"); }
    const response = await fetch(ROOT + "bird-sightings?" + params, { cache: "no-store" });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text || "{}"); }
    catch { throw new Error(`Sightings API returned a web page instead of data (${response.status})`); }
    if (!response.ok || data.ok === false) throw new Error(data.message || `Sightings API returned ${response.status}`);
    return data;
  }

  async function loadSightings() {
    const button = $("searchButton");
    button.disabled = true;
    $("status").textContent = "Loading sightings…";
    $("status").dataset.tone = "";
    try {
      const match = selectedBird();
      const data = await requestSightings({ speciesCode: match?.speciesCode || "" });
      currentRows = Array.isArray(data.sightings) ? data.sightings.slice(0, 100) : [];
      currentStats = data.stats || null;
      if (currentRows.length) applyView();
      else {
        render([], currentStats);
        $("status").textContent = data.message || "No matching sightings found for the selected filters.";
        $("status").dataset.tone = "warning";
      }
    } catch (error) {
      $("countBadge").textContent = "Unavailable";
      $("status").textContent = error.message + ". Please refresh in a moment.";
      $("status").dataset.tone = "error";
      $("sightingsList").innerHTML = '<div class="birdingEmpty">Sightings could not be loaded right now.</div>';
    } finally { button.disabled = false; }
  }

  async function loadLiveStats(button) {
    button.disabled = true;
    button.textContent = "Checking eBird…";
    try {
      const data = await requestSightings({ speciesCode: button.dataset.liveStats, liveStats: true });
      if (!data.stats?.available) throw new Error("Live eBird data is unavailable");
      const card = button.closest(".sightingCard");
      card.querySelector('[data-stat="last"]').textContent = displayDate(data.stats?.last_observed_at);
      card.querySelector('[data-stat="seven"]').textContent = `${data.stats.last_7_days}${data.stats.last_7_days_limited ? "+" : ""} times`;
      card.querySelector('[data-stat="thirty"]').textContent = `${data.stats.last_30_days}${data.stats.last_30_days_limited ? "+" : ""} times`;
      button.textContent = data.stats.last_30_days_limited ? "eBird live — at least 100 reports" : "eBird live stats refreshed";
    } catch (error) { button.textContent = error.message || "Could not refresh — try again"; }
    finally { button.disabled = false; }
  }

  $("searchButton").addEventListener("click", loadSightings);
  $("clearButton").addEventListener("click", () => {
    $("birdSearch").value = "";
    $("sourceFilter").value = "all";
    $("daysFilter").value = "30";
    $("rareFilter").value = "all";
    loadSightings().finally(() => $("birdSearch").focus());
  });
  $("refreshButton").addEventListener("click", loadSightings);
  $("rareFilter").addEventListener("change", applyView);
  $("birdSearch").addEventListener("keydown", (event) => { if (event.key === "Enter") loadSightings(); });
  $("sightingsList").addEventListener("click", (event) => { const button = event.target.closest("[data-live-stats]"); if (button) loadLiveStats(button); });
  loadBirds().then(loadSightings);
})();
