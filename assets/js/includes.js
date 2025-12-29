/* =========================================================
   MBW Site JS (Header + Mobile Menu + Language Switch)
   Version: v2.4 — Lang mapping + Active nav
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
    if (window.location.pathname.startsWith("/es")) return "es";
    return "en";
  }

  function normPath(p) {
    let s = String(p || "/");
    // remove query/hash if any accidentally included
    s = s.split("?")[0].split("#")[0];
    // ensure leading slash
    if (!s.startsWith("/")) s = "/" + s;
    // normalize trailing slash (keep root "/")
    if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
    return s;
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

  function setAriaCurrent(el, on) {
    if (!el) return;
    if (on) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  }

  /* -----------------------------
     Form source helper
     Adds hidden input: form_source
     Also sets source_page if present
  ----------------------------- */
  function getFormSourceFromPath() {
    const p = (window.location.pathname || "/").toLowerCase();

    if (p === "/book-tour" || p.startsWith("/book-tour/")) return "book-tour";
    if (p === "/contact" || p.startsWith("/contact/")) return "contact";

    if (p === "/es/reservar-tour" || p.startsWith("/es/reservar-tour/")) return "reservar-tour";
    if (p === "/es/contacto" || p.startsWith("/es/contacto/")) return "contacto";

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
    // Footer is shared for BOTH languages
    if (footerHost) tasks.push(inject("siteFooter", "/assets/includes/footer.html"));

    await Promise.all(tasks);

    window.dispatchEvent(new Event("mbw:includes:ready"));
  }

  /* -----------------------------
     Language UI (Desktop active state)
  ----------------------------- */
  function setDesktopLangActive(header, lang) {
    const wrap = header.querySelector(".lang.langDesktop") || header.querySelector(".lang");
    if (!wrap) return;

    wrap.querySelectorAll("a[data-lang]").forEach(a => {
      const active = a.dataset.lang === lang;
      a.classList.toggle("is-active", active);
      setAriaCurrent(a, active);
    });
  }

  /* -----------------------------
     Find best EN/ES mapping for current page
     Uses data-href-en / data-href-es in the header.
  ----------------------------- */
  function findBestLangPair(header) {
    const current = normPath(window.location.pathname);
    const candidates = Array.from(header.querySelectorAll("[data-href-en][data-href-es]"));

    for (const el of candidates) {
      const en = normPath(el.getAttribute("data-href-en"));
      const es = normPath(el.getAttribute("data-href-es"));
      if (current === en || current === es) {
        return { enHref: el.getAttribute("data-href-en"), esHref: el.getAttribute("data-href-es") };
      }
    }

    // fallback: if URL is /es/... try convert to /... and see if any matches
    if (current.startsWith("/es/") || current === "/es") {
      const maybeEn = current === "/es" ? "/home" : current.replace(/^\/es\//, "/");
      for (const el of candidates) {
        const en = normPath(el.getAttribute("data-href-en"));
        if (en === normPath(maybeEn)) {
          return { enHref: el.getAttribute("data-href-en"), esHref: el.getAttribute("data-href-es") };
        }
      }
    }

    // last resort
    return { enHref: "/home/", esHref: "/es/" };
  }

  function setLangSwitchLinks(header, lang) {
    const pair = findBestLangPair(header);

    // Desktop pills in the header top-right
    const enA = header.querySelector('.lang a[data-lang="en"]');
    const esA = header.querySelector('.lang a[data-lang="es"]');

    if (enA) enA.setAttribute("href", pair.enHref);
    if (esA) esA.setAttribute("href", pair.esHref);

    // Also update mobile footer switch if it exists
    const mobileSwitch = header.querySelector(".menuLangFooter .menuLangSwitch");
    if (mobileSwitch) {
      const toHref = (lang === "es") ? pair.enHref : pair.esHref;
      mobileSwitch.setAttribute("href", toHref);
    }
  }

  function ensureMobileLangFooter(header, lang) {
    const panel = header.querySelector("#menuPanel");
    if (!panel) return;

    // If already present, we still want to update href to correct mapped page
    const existing = panel.querySelector(".menuLangFooter");
    if (existing) return;

    const isEs = lang === "es";
    const current = isEs ? "Español" : "English";
    const other = isEs ? "English" : "Español";

    const footer = document.createElement("div");
    footer.className = "menuLangFooter";
    footer.setAttribute("data-lang-footer", "1");
    footer.innerHTML = `
      <div class="menuLangCurrent">Current: <strong>${current}</strong></div>
      <a class="pill menuLangSwitch" href="${isEs ? "/home/" : "/es/"}" data-lang-switch="1">
        ${other}
      </a>
    `;

    panel.appendChild(footer);
  }

  /* -----------------------------
     Active nav highlighting (desktop + mobile)
  ----------------------------- */
  function setActiveNav(header) {
    const current = normPath(window.location.pathname);

    // Desktop
    const desktopLinks = Array.from(header.querySelectorAll("nav.nav a.pill[href]"));
    desktopLinks.forEach(a => {
      const href = normPath(a.getAttribute("href"));
      const en = a.getAttribute("data-href-en") ? normPath(a.getAttribute("data-href-en")) : null;
      const es = a.getAttribute("data-href-es") ? normPath(a.getAttribute("data-href-es")) : null;

      const match = (current === href) || (en && current === en) || (es && current === es);
      a.classList.toggle("is-active", match);
      setAriaCurrent(a, match);
    });

    // Mobile (main + submenus)
    const mobileLinks = Array.from(header.querySelectorAll(".menuPanel a.pill[href]"));
    mobileLinks.forEach(a => {
      const href = normPath(a.getAttribute("href"));
      const en = a.getAttribute("data-href-en") ? normPath(a.getAttribute("data-href-en")) : null;
      const es = a.getAttribute("data-href-es") ? normPath(a.getAttribute("data-href-es")) : null;

      const match = (current === href) || (en && current === en) || (es && current === es);
      a.classList.toggle("is-active", match);
      setAriaCurrent(a, match);
    });
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

    document.addEventListener("click", e => {
      if (!panel.classList.contains("is-open")) return;
      if (header.contains(e.target)) return;
      panel.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("keydown", e => {
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
      subs.forEach(s => s.hidden = true);
    }

    function showSub(id) {
      const target = panel.querySelector(id);
      if (!target) return;
      main.hidden = true;
      subs.forEach(s => s.hidden = true);
      target.hidden = false;
    }

    if (panel.dataset.bound === "1") return;
    panel.dataset.bound = "1";

    showMain();

    nexts.forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        showSub(btn.dataset.target);
      });
    });

    backs.forEach(btn => {
      btn.addEventListener("click", e => {
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

    // NEW: map EN/ES switch to the current page counterpart
    setLangSwitchLinks(header, lang);

    // NEW: highlight active nav item correctly
    setActiveNav(header);

    initMenuToggle(header);
    initMobileDrilldown(header);
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
