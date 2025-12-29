/* =========================================================
   MBW Site JS (Header + Mobile Menu + Language Switch)
   Version: v2.5 — Unified + Active Nav Fix (ignore lang pills)
========================================================= */

(function () {
  "use strict";

  /* -----------------------------
     Helpers
  ----------------------------- */
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  function getCurrentLang() {
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.startsWith("es")) return "es";
    if ((window.location.pathname || "").startsWith("/es")) return "es";
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

  async function inject(id, url) {
    const el = document.getElementById(id);
    if (!el) return false;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      el.innerHTML = await res.text();
      return true;
    } catch (e) {
      console.warn("Include failed:", url);
      return false;
    }
  }

  /* -----------------------------
     Form source helper
  ----------------------------- */
  function getFormSourceFromPath() {
    const p = (window.location.pathname || "/").toLowerCase();

    if (p === "/book-tour/" || p.startsWith("/book-tour/")) return "book-tour";
    if (p === "/contact/" || p.startsWith("/contact/")) return "contact";

    if (p === "/es/reservar-tour/" || p.startsWith("/es/reservar-tour/")) return "reservar-tour";
    if (p === "/es/contacto/" || p.startsWith("/es/contacto/")) return "contacto";

    const segs = p.split("/").filter(Boolean);
    if (!segs.length) return "home";
    return segs[segs.length - 1];
  }

  function ensureHiddenInput(form, name, value) {
    if (!form) return;
    let el = form.querySelector('input[name="' + name + '"]');
    if (!el) {
      el = document.createElement("input");
      el.type = "hidden";
      el.name = name;
      form.appendChild(el);
    }
    if (typeof value !== "undefined") el.value = value;
  }

  function applyFormSource() {
    const forms = Array.from(document.querySelectorAll("form"));
    if (!forms.length) return;

    const source = getFormSourceFromPath();
    const href = window.location.href;

    forms.forEach((form) => {
      const action = (form.getAttribute("action") || "").toLowerCase();
      if (!action || action.indexOf("script.google.com/macros") === -1) return;

      ensureHiddenInput(form, "form_source", source);

      const sp = form.querySelector('input[name="source_page"]');
      if (sp) sp.value = href;
    });
  }

  /* -----------------------------
     Inject header + footer
  ----------------------------- */
  async function injectChrome() {
    const headerHost = document.getElementById("siteHeader");
    const footerHost = document.getElementById("siteFooter");

    if (!headerHost && !footerHost) return;
    if (document.querySelector("[data-mbw-header]")) return;

    const lang = getCurrentLang();
    const headerUrl = lang === "es"
      ? "/assets/includes/header-es.html"
      : "/assets/includes/header.html";

    const tasks = [];
    if (headerHost) tasks.push(inject("siteHeader", headerUrl));
    if (footerHost) tasks.push(inject("siteFooter", "/assets/includes/footer.html"));

    await Promise.all(tasks);

    window.dispatchEvent(new Event("mbw:includes:ready"));
  }

  /* -----------------------------
     Language UI
  ----------------------------- */
  function setDesktopLangActive(header, lang) {
    const wrap = header.querySelector(".lang");
    if (!wrap) return;

    wrap.querySelectorAll("a[data-lang]").forEach((a) => {
      const active = a.dataset.lang === lang;
      a.classList.toggle("is-active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function ensureMobileLangFooter(header, lang) {
    const panel = header.querySelector("#menuPanel");
    if (!panel || panel.querySelector(".menuLangFooter")) return;

    const isEs = lang === "es";
    const current = isEs ? "Español" : "English";
    const other = isEs ? "English" : "Español";

    const enLink = header.querySelector('.lang a[data-lang="en"]');
    const esLink = header.querySelector('.lang a[data-lang="es"]');

    const href = isEs
      ? (enLink ? enLink.getAttribute("href") : "/home/")
      : (esLink ? esLink.getAttribute("href") : "/es/");

    const footer = document.createElement("div");
    footer.className = "menuLangFooter";
    footer.innerHTML = (
      '<div class="menuLangCurrent">Current: <strong>' + current + '</strong></div>' +
      '<a class="pill menuLangSwitch" href="' + href + '" data-lang-switch="1">' +
      other +
      "</a>"
    );

    panel.appendChild(footer);
  }

  /* -----------------------------
     ACTIVE NAV (PERMANENT FIX)
     - Ignore language pills (EN/ES)
     - Only consider real nav links (desktop + mobile menu)
  ----------------------------- */
  function setActiveNav(header) {
    const current = getPathname();

    // Clear ONLY nav-related state (do not wipe language active)
    header.querySelectorAll(".nav a[aria-current='page'], #menuPanel a[aria-current='page']").forEach((el) => {
      el.removeAttribute("aria-current");
    });
    header.querySelectorAll(".nav a.is-active, #menuPanel a.is-active").forEach((el) => {
      el.classList.remove("is-active");
    });

    // Collect candidates: links in nav + menu panel, excluding language UI
    const candidates = Array.from(header.querySelectorAll(".nav a[href], #menuPanel a[href]"))
      .filter((a) => {
        if (!a) return false;
        const href = a.getAttribute("href") || "";
        if (!href) return false;
        if (href.startsWith("#")) return false;
        if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;

        // Exclude language links and lang switch pill
        if (a.hasAttribute("data-lang")) return false;
        if (a.hasAttribute("data-lang-switch")) return false;
        if (a.closest(".lang")) return false;
        if (a.closest(".menuLangFooter")) return false;

        return true;
      });

    if (!candidates.length) return;

    let best = null;
    let bestLen = -1;

    candidates.forEach((a) => {
      const href = a.getAttribute("href") || "";
      let path = "/";
      try {
        path = normalizePath(new URL(href, window.location.origin).pathname);
      } catch (e) {
        path = normalizePath(href);
      }

      // Treat "/" and "/es" as home and only match EXACT
      if (path === "/" || path === "/es") {
        if (current === path) {
          if (path.length > bestLen) {
            best = a;
            bestLen = path.length;
          }
        }
        return;
      }

      // Exact match wins
      if (current === path) {
        if (path.length > bestLen) {
          best = a;
          bestLen = path.length;
        }
        return;
      }

      // Prefix match for deeper pages
      if (current.startsWith(path + "/")) {
        if (path.length > bestLen) {
          best = a;
          bestLen = path.length;
        }
      }
    });

    if (!best) return;

    best.classList.add("is-active");
    best.setAttribute("aria-current", "page");

    // If it's a dropdown menu item, highlight the parent pill too
    const dropdown = best.closest(".dropdownMenu");
    if (dropdown) {
      const parent = dropdown.closest(".dropdown");
      if (parent) {
        const parentPill = parent.querySelector(':scope > a.pill');
        if (parentPill) parentPill.classList.add("is-active");
      }
    }
  }

  /* -----------------------------
     Menu Toggle
  ----------------------------- */
  function initMenuToggle(header) {
    const btn = header.querySelector(".menuBtn");
    const panel = header.querySelector("#menuPanel");
    if (!btn || !panel) return;
    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";

    btn.addEventListener("click", () => {
      const open = panel.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("is-open")) return;
      if (header.contains(e.target)) return;
      panel.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("is-open")) {
        panel.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* -----------------------------
     Mobile drill-down menus
  ----------------------------- */
  function initMobileDrilldown(header) {
    const panel = header.querySelector("#menuPanel");
    if (!panel) return;

    const main = panel.querySelector(".m-main");
    const subs = panel.querySelectorAll(".m-submenu");
    const nexts = panel.querySelectorAll(".m-next[data-target]");
    const backs = panel.querySelectorAll(".m-back[data-back]");

    if (!main) return;

    function showMain() {
      main.hidden = false;
      subs.forEach((s) => (s.hidden = true));
    }

    function showSub(id) {
      const target = panel.querySelector(id);
      if (!target) return;
      main.hidden = true;
      subs.forEach((s) => (s.hidden = true));
      target.hidden = false;
    }

    if (panel.dataset.bound === "1") return;
    panel.dataset.bound = "1";

    showMain();

    nexts.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        showSub(btn.dataset.target);
      });
    });

    backs.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        showMain();
      });
    });

    const menuBtn = header.querySelector(".menuBtn");
    if (menuBtn) {
      menuBtn.addEventListener("click", () => {
        setTimeout(showMain, 0);
      });
    }
  }

  /* -----------------------------
     Boot
  ----------------------------- */
  function initHeader() {
    const header = document.querySelector("[data-mbw-header]");
    if (!header) return;

    const lang = getCurrentLang();
    setDesktopLangActive(header, lang);
    ensureMobileLangFooter(header, lang);
    initMenuToggle(header);
    initMobileDrilldown(header);

    // Active nav (fixed)
    setActiveNav(header);
  }

  ready(() => {
    injectChrome().then(initHeader);
    applyFormSource();
  });

  window.addEventListener("mbw:includes:ready", () => {
    initHeader();
    applyFormSource();
  });
})();
