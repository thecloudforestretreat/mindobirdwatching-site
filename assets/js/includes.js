/* =========================================================
   MBW Site JS (Header + Mobile Menu + Language Switch)
   Version: v2.3 — Stable & Unified
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
     Inject header + footer
  ----------------------------- */
  async function injectChrome() {
    const headerHost = document.getElementById("siteHeader");
    const footerHost = document.getElementById("siteFooter");

    if (!headerHost && !footerHost) return;
    if (document.querySelector("[data-mbw-header]")) return;

    const lang = getCurrentLang();
    const headerUrl =
      lang === "es"
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

    wrap.querySelectorAll("a[data-lang]").forEach(a => {
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
    footer.innerHTML = `
      <div class="menuLangCurrent">Current: <strong>${current}</strong></div>
      <a class="pill menuLangSwitch" href="${href}" data-lang-switch="1">
        ${other}
      </a>
    `;

    panel.appendChild(footer);
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
    initMenuToggle(header);
    initMobileDrilldown(header);
  }

  ready(() => {
    injectChrome().then(initHeader);
  });

  window.addEventListener("mbw:includes:ready", initHeader);

})();
