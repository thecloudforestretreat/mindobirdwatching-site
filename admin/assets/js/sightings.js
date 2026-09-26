(() => {
  "use strict";
  const ROOT = "https://mindobirdwatching.com/api/admin/";
  const FALLBACK_IMAGE = "https://mindobirdwatching.com/assets/images/birds/mbw_image_coming_soon_02.jpg";
  let birds = [];
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const searchable = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const displayDate = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value || "Unknown date") : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }); };
  const birdFor = (code) => birds.find((bird) => bird.speciesCode === code) || {};

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
    return `<article class="sightingCard" data-species-code="${esc(group.code)}">
      <div class="sightingCardMedia"><img loading="lazy" src="${esc(species.image || FALLBACK_IMAGE)}" alt="${esc(english)}" onerror="this.src='${FALLBACK_IMAGE}'"><span>${esc(String(latest.source || "unknown").toUpperCase())}</span></div>
      <div class="sightingCardBody">
        <div class="sightingCardTitle"><div><h3>${esc(english)}</h3><strong>${esc(spanish)}</strong><small><em>${esc(scientific)}</em> · ${esc(group.code)}</small></div><span>${group.sightings.length} recent</span></div>
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
    const groups = groupRows(rows);
    $("countBadge").textContent = `${groups.length} bird${groups.length === 1 ? "" : "s"} · ${rows.length} reports`;
    $("sightingsList").innerHTML = groups.map((group) => cardMarkup(group, stats)).join("") || '<div class="birdingEmpty">No matching reports were found yet.</div>';
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
    const params = new URLSearchParams({ source: liveStats ? "ebird" : $("sourceFilter").value, days: liveStats ? "30" : $("daysFilter").value, limit: "10" });
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
      const rows = Array.isArray(data.sightings) ? data.sightings.slice(0, 10) : [];
      render(rows, data.stats);
      $("status").textContent = rows.length ? `Showing ${rows.length} recent report${rows.length === 1 ? "" : "s"} as bird cards.` : (data.message || "No matching sightings found for the selected filters.");
      $("status").dataset.tone = rows.length ? "success" : "warning";
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
      button.textContent = data.stats.last_30_days_limited ? "eBird live — at least 10 reports" : "eBird live stats refreshed";
    } catch (error) { button.textContent = error.message || "Could not refresh — try again"; }
    finally { button.disabled = false; }
  }

  $("searchButton").addEventListener("click", loadSightings);
  $("refreshButton").addEventListener("click", loadSightings);
  $("birdSearch").addEventListener("keydown", (event) => { if (event.key === "Enter") loadSightings(); });
  $("sightingsList").addEventListener("click", (event) => { const button = event.target.closest("[data-live-stats]"); if (button) loadLiveStats(button); });
  loadBirds().then(loadSightings);
})();
