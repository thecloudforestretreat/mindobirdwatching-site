(function () {
  "use strict";

  function track(eventName, params) {
    params = params || {};
    if (window.gtag) window.gtag("event", eventName, params);
    window.dispatchEvent(new CustomEvent("mbw_analytics_event", { detail: { event: eventName, params: params } }));
  }

  function setHeaderLangLink(link, href, current) {
    if (!link || !href) return;
    link.setAttribute("href", href);
    if (current) {
      link.setAttribute("aria-current", "page");
      link.classList.add("is-active");
    } else {
      link.removeAttribute("aria-current");
      link.classList.remove("is-active");
    }
  }

  function syncHeaderLanguageLinks(headerHost) {
    if (!headerHost) return;
    var currentLang = (headerHost.getAttribute("data-current-lang") || document.documentElement.lang || "en").toLowerCase();
    var enHref = headerHost.getAttribute("data-href-en") || "/";
    var esHref = headerHost.getAttribute("data-href-es") || "/es/";
    var header = headerHost.querySelector("[data-mbw-header]") || headerHost.querySelector(".topbar") || headerHost;

    if (header && header.setAttribute) header.setAttribute("data-current-lang", currentLang);

    headerHost.querySelectorAll('a[data-lang="en"]').forEach(function (link) {
      setHeaderLangLink(link, enHref, currentLang === "en");
    });
    headerHost.querySelectorAll('a[data-lang="es"]').forEach(function (link) {
      setHeaderLangLink(link, esHref, currentLang === "es");
    });

    var footerCurrent = headerHost.querySelector(".menuLangCurrent strong");
    if (footerCurrent) footerCurrent.textContent = currentLang.toUpperCase();

    headerHost.querySelectorAll(".menuLangSwitch, a[data-lang-switch]").forEach(function (link) {
      if (currentLang === "es") {
        link.setAttribute("href", enHref);
        link.setAttribute("data-lang", "en");
        link.textContent = "English";
      } else {
        link.setAttribute("href", esHref);
        link.setAttribute("data-lang", "es");
        link.textContent = "Español";
      }
    });
  }

  function loadInclude(id, url) {
    var el = document.getElementById(id);
    if (!el || el.children.length) return;
    fetch(url, { cache: "no-cache" })
      .then(function (res) { return res.ok ? res.text() : ""; })
      .then(function (html) {
        if (html) el.innerHTML = html;
        if (id === "siteHeader") syncHeaderLanguageLinks(el);
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

  document.addEventListener("mbw_include_loaded", function (event) {
    if (event.detail && event.detail.id === "siteHeader") {
      syncHeaderLanguageLinks(document.getElementById("siteHeader"));
    }
  });

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
