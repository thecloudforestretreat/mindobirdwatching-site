(function () {
  "use strict";

  function track(eventName, params) {
    params = params || {};
    if (window.gtag) window.gtag("event", eventName, params);
    window.dispatchEvent(new CustomEvent("mbw_analytics_event", { detail: { event: eventName, params: params } }));
  }

  function loadInclude(id, url) {
    var el = document.getElementById(id);
    if (!el || el.children.length) return;
    fetch(url, { cache: "no-cache" })
      .then(function (res) { return res.ok ? res.text() : ""; })
      .then(function (html) {
        if (html) el.innerHTML = html;
        document.dispatchEvent(new CustomEvent("mbw_include_loaded", { detail: { id: id } }));
      })
      .catch(function () {});
  }

  function setFilter(filter) {
    var cards = document.querySelectorAll("[data-bird-card]");
    var buttons = document.querySelectorAll("[data-filter]");
    var visible = 0;
    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-filter") === filter ? "true" : "false");
    });
    cards.forEach(function (card) {
      var tour = card.getAttribute("data-tour") || "both";
      var show = filter === "all" || (filter === "both" ? tour === "both" : tour === filter || tour === "both");
      card.hidden = !show;
      if (show) visible++;
    });
    var count = document.getElementById("birdResultCount");
    if (count) count.textContent = String(visible);
    track("bird_filter_change", { filter: filter, visible_count: visible, page_path: window.location.pathname });
  }

  function initIncludes() {
    loadInclude("siteHeader", "/assets/includes/header.html");
    loadInclude("siteFooter", "/assets/includes/footer.html");
  }

  document.addEventListener("click", function (event) {
    var filterButton = event.target.closest("[data-filter]");
    if (filterButton) {
      setFilter(filterButton.getAttribute("data-filter"));
      return;
    }

    var audioButton = event.target.closest(".birdAudioBtn");
    if (audioButton) {
      var src = audioButton.getAttribute("data-audio-src");
      var birdName = audioButton.getAttribute("data-bird-name") || "";
      var player = document.getElementById("birdAudioPlayer");
      if (!src || !player) return;
      player.src = src;
      player.play().catch(function () {});
      track("bird_audio_play", { bird_name: birdName, audio_src: src, page_path: window.location.pathname });
      return;
    }

    var analyticsElement = event.target.closest("[data-analytics-event]");
    if (analyticsElement) {
      var eventName = analyticsElement.getAttribute("data-analytics-event");
      if (!eventName || eventName === "bird_audio_play" || eventName === "bird_filter_change") return;
      track(eventName, {
        label: analyticsElement.getAttribute("data-analytics-label") || analyticsElement.textContent.trim(),
        bird_name: analyticsElement.getAttribute("data-analytics-bird") || "",
        link_url: analyticsElement.getAttribute("data-analytics-link-url") || analyticsElement.getAttribute("href") || "",
        location: analyticsElement.getAttribute("data-analytics-location") || "",
        page_path: window.location.pathname
      });
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initIncludes();
      var cards = document.querySelectorAll("[data-bird-card]");
      var count = document.getElementById("birdResultCount");
      if (count) count.textContent = String(cards.length);
      track("bird_page_view", { page_path: window.location.pathname, bird_count: cards.length });
    });
  } else {
    initIncludes();
  }
})();
