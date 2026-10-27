/* =========================================================
   MBW Includes JS (Single Header + Mobile Menu + Language Switch)
   Version: v3.1 - Single shared header architecture
   Updated: 2026-08-26

   Responsibilities:
   - Inject the single shared header include
   - Inject the shared footer include
   - Localize the shared header based on page language
   - Keep EN/ES links pointed to matching translated page URLs
   - Initialize mobile menu and drill-down navigation
   - Set active nav state while ignoring language pills
   - Add form_source helper fields for Google Apps Script forms

   Important:
   - All pages use /assets/includes/header.html
   - Do not add separate language-specific header includes
========================================================= */

(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  function getCurrentLang() {
    var host = document.getElementById("siteHeader");
    var hostLang = host ? (host.getAttribute("data-current-lang") || "").toLowerCase() : "";
    var htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    var path = window.location.pathname || "/";

    if (hostLang === "es" || hostLang === "en") return hostLang;
    if (htmlLang.indexOf("es") === 0) return "es";
    if (path.indexOf("/es/") === 0 || path === "/es") return "es";
    return "en";
  }

  function normalizePath(p) {
    if (!p) return "/";
    try {
      if (p.indexOf("http://") === 0 || p.indexOf("https://") === 0) {
        p = new URL(p).pathname || "/";
      }
    } catch (e) {}

    if (p.charAt(0) !== "/") p = "/" + p;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  }

  function getPathname() {
    return normalizePath(window.location.pathname || "/");
  }

  function getRawLangUrl(lang) {
    var rawSelector = '.rawLangLinks a[hreflang="' + lang + '"], .rawLangLinks a[lang="' + lang + '"]';
    var rawLink = document.querySelector(rawSelector);
    var rawHref = rawLink ? rawLink.getAttribute("href") : "";

    if (rawHref) return rawHref;

    // Fallback to the page's standard hreflang declarations in <head>.
    // This makes the visible EN/ES switch follow the same translated URL pair
    // used by search engines, even when .rawLangLinks is missing from a page.
    var alternateSelector = 'link[rel="alternate"][hreflang="' + lang + '"]';
    var alternateLink = document.querySelector(alternateSelector);
    var alternateHref = alternateLink ? alternateLink.getAttribute("href") : "";

    if (alternateHref) return alternateHref;

    // Final safety fallback only when neither page-level source exists.
    if (lang === "es") return "/es/";
    return "/";
  }

  function getLanguageUrls() {
    return {
      en: getRawLangUrl("en"),
      es: getRawLangUrl("es")
    };
  }

  async function inject(id, url) {
    var el = document.getElementById(id);
    if (!el) return false;

    try {
      var res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed: " + url);
      el.innerHTML = await res.text();
      return true;
    } catch (e) {
      console.warn("MBW include failed:", url, e);
      return false;
    }
  }

  function getFormSourceFromPath() {
    var p = (window.location.pathname || "/").toLowerCase();

    if (p === "/book-tour/" || p.indexOf("/book-tour/") === 0) return "book-tour";
    if (p === "/contact/" || p.indexOf("/contact/") === 0) return "contact";
    if (p === "/es/reservar-tour/" || p.indexOf("/es/reservar-tour/") === 0) return "reservar-tour";
    if (p === "/es/contacto/" || p.indexOf("/es/contacto/") === 0) return "contacto";

    var segs = p.split("/").filter(Boolean);
    if (!segs.length) return "home";
    return segs[segs.length - 1];
  }

  function ensureHiddenInput(form, name, value) {
    if (!form) return;

    var el = form.querySelector('input[name="' + name + '"]');
    if (!el) {
      el = document.createElement("input");
      el.type = "hidden";
      el.name = name;
      form.appendChild(el);
    }

    if (typeof value !== "undefined") el.value = value;
  }

  function applyFormSource() {
    var forms = Array.prototype.slice.call(document.querySelectorAll("form"));
    if (!forms.length) return;

    var source = getFormSourceFromPath();
    var href = window.location.href;

    forms.forEach(function (form) {
      var action = (form.getAttribute("action") || "").toLowerCase();
      if (!action || action.indexOf("script.google.com/macros") === -1) return;

      ensureHiddenInput(form, "form_source", source);

      var sp = form.querySelector('input[name="source_page"]');
      if (sp) sp.value = href;
    });
  }

  async function injectChrome() {
    var headerHost = document.getElementById("siteHeader");
    var footerHost = document.getElementById("siteFooter");

    if (!headerHost && !footerHost) return;

    if (headerHost && !document.getElementById("mbwNavigationStyles")) {
      var navigationStyles = document.createElement("link");
      navigationStyles.id = "mbwNavigationStyles";
      navigationStyles.rel = "stylesheet";
      navigationStyles.href = "/assets/css/header.css?v=20261027-nav4";
      document.head.appendChild(navigationStyles);
    }
    if (footerHost && !document.getElementById("mbwJourneyStyles")) {
      var journeyStyles = document.createElement("link");
      journeyStyles.id = "mbwJourneyStyles";
      journeyStyles.rel = "stylesheet";
      journeyStyles.href = "/assets/css/journey.css?v=20261027-1";
      document.head.appendChild(journeyStyles);
    }
    var alreadyHasHeader = headerHost && headerHost.querySelector("[data-mbw-header]");
    var tasks = [];

    if (headerHost && !alreadyHasHeader) {
      tasks.push(inject("siteHeader", "/assets/includes/header.html"));
    }

    if (footerHost && !footerHost.children.length) {
      tasks.push(inject("siteFooter", "/assets/includes/footer.html"));
    }

    await Promise.all(tasks);
    window.dispatchEvent(new Event("mbw:includes:ready"));
  }

  function localizeHref(el, lang) {
    if (!el) return;
    var href = el.getAttribute("data-href-" + lang);
    if (href) el.setAttribute("href", href);
  }

  function localizeText(el, lang) {
    if (!el) return;
    var label = el.getAttribute("data-label-" + lang);
    if (!label) return;

    if (el.classList.contains("m-next")) {
      el.innerHTML = label + ' <span class="m-arrow" aria-hidden="true">&rsaquo;</span>';
    } else {
      el.textContent = label;
    }
  }

  function localizeAria(el, lang) {
    if (!el) return;
    var label = el.getAttribute("data-aria-" + lang);
    if (label) el.setAttribute("aria-label", label);
  }

  function localizeHeader(header) {
    if (!header) return;

    var lang = getCurrentLang();
    var isEs = lang === "es";
    var urls = getLanguageUrls();

    header.setAttribute("data-current-lang", lang);
    header.setAttribute("data-header-version", "v4-navigation");

    var brand = header.querySelector(".brand");
    if (brand) {
      brand.setAttribute("href", isEs ? "/es/" : "/");
      brand.setAttribute("aria-label", isEs ? "Inicio de Mindo Bird Watching" : "Mindo Bird Watching home");
    }

    header.querySelectorAll("[data-href-en], [data-href-es]").forEach(function (el) {
      localizeHref(el, lang);
    });

    header.querySelectorAll("[data-label-en], [data-label-es]").forEach(function (el) {
      localizeText(el, lang);
    });

    header.querySelectorAll("[data-aria-en], [data-aria-es]").forEach(function (el) {
      localizeAria(el, lang);
    });

    header.querySelectorAll('.lang a[data-lang="en"]').forEach(function (a) {
      a.setAttribute("href", urls.en);
      a.classList.toggle("is-active", lang === "en");
      if (lang === "en") a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    header.querySelectorAll('.lang a[data-lang="es"]').forEach(function (a) {
      a.setAttribute("href", urls.es);
      a.classList.toggle("is-active", lang === "es");
      if (lang === "es") a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    var primaryNav = header.querySelector('.nav[data-i18n-aria="primaryNav"]');
    if (primaryNav) primaryNav.setAttribute("aria-label", isEs ? "Principal" : "Primary");

    var mobileMain = header.querySelector('.m-main[data-i18n-aria="primaryNavMobile"]');
    if (mobileMain) mobileMain.setAttribute("aria-label", isEs ? "Principal móvil" : "Primary mobile");

    var menuPanel = header.querySelector("#menuPanel");
    if (menuPanel) menuPanel.setAttribute("aria-label", isEs ? "Menú móvil" : "Mobile menu");

    var menuBtn = header.querySelector(".menuBtn");
    if (menuBtn) menuBtn.setAttribute("aria-label", isEs ? "Abrir menú" : "Open menu");

    header.querySelectorAll(".m-submenu").forEach(function (submenu) {
      var label = submenu.getAttribute("data-aria-" + lang);
      if (label) submenu.setAttribute("aria-label", label);
    });

    updateMobileLangFooter(header, lang, urls);
  }

  function updateMobileLangFooter(header, lang, urls) {
    var panel = header.querySelector("#menuPanel");
    if (!panel) return;

    var footer = panel.querySelector("[data-lang-footer]");
    if (!footer) {
      footer = document.createElement("div");
      footer.className = "menuLangFooter";
      footer.setAttribute("data-lang-footer", "");
      panel.appendChild(footer);
    }

    var isEs = lang === "es";
    var current = isEs ? "ES" : "EN";
    var currentLabel = isEs ? "Actual" : "Current";
    var otherText = isEs ? "English" : "Español";
    var otherLang = isEs ? "en" : "es";
    var otherHref = isEs ? urls.en : urls.es;

    footer.setAttribute("aria-label", isEs ? "Idioma móvil" : "Language mobile");
    footer.innerHTML =
      '<div class="menuLangCurrent">' +
      currentLabel + ': <strong>' + current + '</strong>' +
      '</div>' +
      '<a class="pill menuLangSwitch" href="' + otherHref + '" data-lang="' + otherLang + '" data-lang-switch="1">' +
      otherText +
      '</a>';
  }

  function setActiveNav(header) {
    var current = getPathname();

    header.querySelectorAll(".nav a[aria-current='page'], #menuPanel a[aria-current='page']").forEach(function (el) {
      if (el.hasAttribute("data-lang") || el.hasAttribute("data-lang-switch")) return;
      el.removeAttribute("aria-current");
    });

    header.querySelectorAll(".nav a.is-active, #menuPanel a.is-active").forEach(function (el) {
      if (el.hasAttribute("data-lang") || el.hasAttribute("data-lang-switch")) return;
      el.classList.remove("is-active");
    });

    var candidates = Array.prototype.slice.call(header.querySelectorAll(".nav a[href], #menuPanel a[href]"))
      .filter(function (a) {
        if (!a) return false;
        var href = a.getAttribute("href") || "";
        if (!href) return false;
        if (href.charAt(0) === "#") return false;
        if (href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) return false;
        if (a.hasAttribute("data-lang")) return false;
        if (a.hasAttribute("data-lang-switch")) return false;
        if (a.closest(".lang")) return false;
        if (a.closest(".menuLangFooter")) return false;
        return true;
      });

    if (!candidates.length) return;

    var best = null;
    var bestLen = -1;

    candidates.forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var path = "/";

      try {
        path = normalizePath(new URL(href, window.location.origin).pathname);
      } catch (e) {
        path = normalizePath(href);
      }

      if (path === "/" || path === "/es") {
        if (current === path && path.length > bestLen) {
          best = a;
          bestLen = path.length;
        }
        return;
      }

      if (current === path || current.indexOf(path + "/") === 0) {
        if (path.length > bestLen) {
          best = a;
          bestLen = path.length;
        }
      }
    });

    if (!best) return;
    var selectedHref = best.getAttribute("href");
    candidates.forEach(function (link) {
      if (link.getAttribute("href") === selectedHref) {
        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");
        var group = link.closest(".dropdown");
        if (group) group.querySelector(".navTrigger").classList.add("is-active");
      }
    });

    best.classList.add("is-active");
    best.setAttribute("aria-current", "page");

    var dropdown = best.closest(".dropdownMenu");
    if (dropdown) {
      var parent = dropdown.closest(".dropdown");
      if (parent) {
        var parentPill = parent.querySelector(":scope > .pill");
        if (parentPill) parentPill.classList.add("is-active");
      }
    }
  }

  function initMenuToggle(header) {
    var btn = header.querySelector(".menuBtn"), panel = header.querySelector("#menuPanel");
    if (!btn || !panel || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    function setOpen(open, restoreFocus) {
      panel.hidden = !open;
      panel.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", getCurrentLang() === "es" ? (open ? "Cerrar menú" : "Abrir menú") : (open ? "Close menu" : "Open menu"));
      if (!open) panel.querySelectorAll("details[open]").forEach(function (el) { el.open = false; });
      if (restoreFocus) btn.focus();
    }
    btn.addEventListener("click", function () { setOpen(panel.hidden); });
    document.addEventListener("click", function (event) { if (!panel.hidden && !header.contains(event.target)) setOpen(false); });
    document.addEventListener("keydown", function (event) {
      if (panel.hidden) return;
      if (event.key === "Escape") { event.preventDefault(); setOpen(false, true); }
      if (event.key === "Tab") {
        var stops = Array.from(header.querySelectorAll("a[href],button,summary")).filter(function (el) { return el.getClientRects().length && !el.closest("[hidden]"); });
        var first = stops[0], last = stops[stops.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    window.matchMedia("(min-width:1200px)").addEventListener("change", function () { setOpen(false); });
  }

  function initMobileDrilldown(header) {
    // Native disclosure elements remain operable with keyboard and touch.
    var groups = header.querySelectorAll(".mobileGroup");
    groups.forEach(function (group) {
      if (group.dataset.bound) return;
      group.dataset.bound = "1";
      group.addEventListener("toggle", function () {
        if (group.open) groups.forEach(function (other) { if (other !== group) other.open = false; });
      });
    });
  }

  function initDesktopNavigation(header) {
    if (header.dataset.desktopBound) return;
    header.dataset.desktopBound = "1";
    var dropdowns = Array.from(header.querySelectorAll(".dropdown"));
    function close(dropdown, restoreFocus) {
      var trigger = dropdown.querySelector(".navTrigger");
      dropdown.classList.remove("is-open");
      dropdown.querySelector(".dropdownMenu").hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (restoreFocus) trigger.focus();
    }
    function open(dropdown) {
      if (!window.matchMedia("(min-width:1200px)").matches) return;
      dropdowns.forEach(function (other) { if (other !== dropdown) close(other); });
      dropdown.classList.add("is-open");
      dropdown.querySelector(".dropdownMenu").hidden = false;
      dropdown.querySelector(".navTrigger").setAttribute("aria-expanded", "true");
    }
    dropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector(".navTrigger"), timer;
      trigger.addEventListener("click", function (event) { if (event.detail === 0 && dropdown.classList.contains("is-open")) close(dropdown); else open(dropdown); });
      trigger.addEventListener("keydown", function (event) {
        if (event.key === "ArrowDown") { event.preventDefault(); open(dropdown); dropdown.querySelector(".dropdownMenu a").focus(); }
      });
      dropdown.addEventListener("pointerenter", function (event) { if (event.pointerType === "mouse") { clearTimeout(timer); open(dropdown); } });
      dropdown.addEventListener("pointerleave", function (event) { if (event.pointerType === "mouse") timer = setTimeout(function () { if (!dropdown.contains(document.activeElement)) close(dropdown); }, 250); });
      dropdown.addEventListener("focusout", function () { setTimeout(function () { if (!dropdown.contains(document.activeElement)) close(dropdown); }, 0); });
      dropdown.addEventListener("keydown", function (event) { if (event.key === "Escape") { event.preventDefault(); close(dropdown, true); } });
    });
    document.addEventListener("click", function (event) { dropdowns.forEach(function (dropdown) { if (!dropdown.contains(event.target)) close(dropdown); }); });
    window.matchMedia("(min-width:1200px)").addEventListener("change", function () { dropdowns.forEach(function (dropdown) { close(dropdown); }); });
  }

  function localizeFooter() {
    var footer = document.querySelector("#siteFooter .footer");
    if (!footer) return;
    var lang = getCurrentLang();
    footer.setAttribute("aria-label", lang === "es" ? "Pie de página" : "Footer");
    footer.querySelectorAll("[data-href-en]").forEach(function (el) { localizeHref(el, lang); });
    footer.querySelectorAll("[data-label-en]").forEach(function (el) { localizeText(el, lang); });
    var navigation = footer.querySelector("[data-footer-navigation]");
    if (navigation) navigation.setAttribute("aria-label", lang === "es" ? "Navegación al pie" : "Footer navigation");
  }

  function applyActivityBookingLinks() {
    var routes = {"/activities/canyoning/": "canyoning", "/es/actividades/canyoning/": "canyoning", "/activities/waterfall-tour/": "waterfall-tour", "/es/actividades/tour-de-cascadas/": "waterfall-tour", "/activities/chocolate-tour/": "chocolate-tour", "/es/actividades/tour-de-chocolate/": "chocolate-tour", "/activities/coffee-tour/": "coffee-tour", "/es/actividades/tour-de-cafe/": "coffee-tour", "/activities/ziplining/": "ziplining", "/es/actividades/canopy/": "ziplining", "/activities/frog-concert/": "frog-concert", "/es/actividades/concierto-de-ranas/": "frog-concert", "/activities/private-insect-macro-wildlife-search/": "private-insect-macro-wildlife-search", "/es/actividades/busqueda-privada-insectos-macrofauna/": "private-insect-macro-wildlife-search", "/activities/butterfly-tour/": "butterfly-tour", "/es/actividades/tour-de-mariposas/": "butterfly-tour", "/activities/mountain-biking/": "mountain-biking", "/es/actividades/ciclismo-de-montana/": "mountain-biking", "/activities/nature-walk/": "nature-walk", "/es/actividades/caminata-naturalista/": "nature-walk", "/activities/trail-running-mindo/": "trail-running-mindo", "/es/actividades/running-senderos-mindo/": "trail-running-mindo", "/activities/tubing/": "tubing", "/es/actividades/tubing/": "tubing", "/activities/quad-tour/": "quad-tour", "/es/actividades/tour-en-quad/": "quad-tour", "/activities/orchid-garden-tour/": "orchid-garden-tour", "/es/actividades/jardin-de-orquideas/": "orchid-garden-tour", "/activities/horseback-riding/": "horseback-riding", "/es/actividades/cabalgata/": "horseback-riding", "/activities/double-extreme-swing/": "double-extreme-swing", "/es/actividades/columpio-doble-extremo/": "double-extreme-swing", "/activities/sky-bike-sky-ride/": "sky-bike-sky-ride", "/es/actividades/sky-bike-sky-ride/": "sky-bike-sky-ride", "/activities/paintball/": "paintball", "/es/actividades/paintball/": "paintball", "/activities/": "", "/es/actividades/": "", "/activities/night-walk/": "night-walk", "/es/actividades/caminata-nocturna/": "night-walk"};
    var source = window.location.pathname;
    if (!Object.prototype.hasOwnProperty.call(routes, source)) return;
    var key = routes[source], isEs = getCurrentLang() === "es";
    document.querySelectorAll('#siteHeader .navBook, #siteFooter [data-booking-link]').forEach(function (link) {
      var target = new URL(isEs ? "/es/reservar-tour/" : "/book-tour/", window.location.origin);
      target.searchParams.set("experience", key === "night-walk" ? "night-walk" : "activities");
      if (key && key !== "night-walk") target.searchParams.set("activity", key);
      target.searchParams.set("source_page", source);
      target.hash = "request-form";
      link.setAttribute("href", target.pathname + target.search + target.hash);
    });
  }

  function initHeader() {
    var header = document.querySelector("#siteHeader [data-mbw-header], [data-mbw-header]");
    if (!header) return;

    localizeHeader(header);
    localizeFooter();
    initMenuToggle(header);
    initMobileDrilldown(header);
    initDesktopNavigation(header);
    setActiveNav(header);
    applyActivityBookingLinks();
  }

  ready(function () {
    injectChrome().then(function () {
      initHeader();
      applyFormSource();
    });
  });

  window.addEventListener("mbw:includes:ready", function () {
    initHeader();
    applyFormSource();
  });
})();
