/* =========================================================
   MBW Includes JS (Single Header + Mobile Menu + Language Switch)
   Version: v3.0 - Single shared header architecture
   Updated: 2026-05-20

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
    var selector = '.rawLangLinks a[hreflang="' + lang + '"], .rawLangLinks a[lang="' + lang + '"]';
    var a = document.querySelector(selector);
    if (a && a.getAttribute("href")) return a.getAttribute("href");
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
    header.setAttribute("data-header-version", "v3-single-header");

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

    best.classList.add("is-active");
    best.setAttribute("aria-current", "page");

    var dropdown = best.closest(".dropdownMenu");
    if (dropdown) {
      var parent = dropdown.closest(".dropdown");
      if (parent) {
        var parentPill = parent.querySelector(":scope > a.pill");
        if (parentPill) parentPill.classList.add("is-active");
      }
    }
  }

  function initMenuToggle(header) {
    var btn = header.querySelector(".menuBtn");
    var panel = header.querySelector("#menuPanel");
    if (!btn || !panel) return;
    if (btn.dataset.bound === "1") return;

    btn.dataset.bound = "1";

    btn.addEventListener("click", function () {
      var open = panel.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", function (e) {
      if (!panel.classList.contains("is-open")) return;
      if (header.contains(e.target)) return;
      panel.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) {
        panel.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  function initMobileDrilldown(header) {
    var panel = header.querySelector("#menuPanel");
    if (!panel) return;

    var main = panel.querySelector(".m-main");
    var subs = panel.querySelectorAll(".m-submenu");
    var nexts = panel.querySelectorAll(".m-next[data-target]");
    var backs = panel.querySelectorAll(".m-back[data-back]");

    if (!main) return;
    if (panel.dataset.bound === "1") return;

    panel.dataset.bound = "1";

    function showMain() {
      main.hidden = false;
      subs.forEach(function (s) {
        s.hidden = true;
      });
    }

    function showSub(id) {
      var target = panel.querySelector(id);
      if (!target) return;

      main.hidden = true;
      subs.forEach(function (s) {
        s.hidden = true;
      });
      target.hidden = false;
    }

    showMain();

    nexts.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        showSub(btn.dataset.target);
      });
    });

    backs.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        showMain();
      });
    });

    var menuBtn = header.querySelector(".menuBtn");
    if (menuBtn) {
      menuBtn.addEventListener("click", function () {
        setTimeout(showMain, 0);
      });
    }
  }

  function initHeader() {
    var header = document.querySelector("#siteHeader [data-mbw-header], [data-mbw-header]");
    if (!header) return;

    localizeHeader(header);
    initMenuToggle(header);
    initMobileDrilldown(header);
    setActiveNav(header);
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
