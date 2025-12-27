/* =========================================================
   MBW Site JS (Header + Mobile Menu Drill-Down + Language UI) (v2.1)

   Requires header markup inside injected header:
   - <header data-mbw-header>
   - .menuBtn
   - .menuPanel#menuPanel
   - .m-main (top-level list)
   - .m-submenu (submenu lists) each has id like #m-tours
   - .m-next buttons with data-target="#m-..."
   - .m-back buttons with data-back

   Language UI behavior:
   - Desktop: highlight current language pill inside .lang (adds .is-active)
   - Mobile: hide header-bar language (CSS) and render language controls at bottom
     of hamburger panel:
       "Current: English/Español"
       and a single switch pill that navigates to the other language.
   ========================================================= */

(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  function getCurrentLang() {
    // Prefer explicit <html lang="...">
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.startsWith("es")) return "es";
    return "en";
  }

  function setDesktopLangActive(header, lang) {
    const langWrap = header.querySelector(".lang");
    if (!langWrap) return;

    const links = Array.from(langWrap.querySelectorAll('a[data-lang]'));
    if (!links.length) return;

    links.forEach((a) => {
      const l = (a.getAttribute("data-lang") || "").toLowerCase();
      const active = l === lang;
      a.classList.toggle("is-active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function ensureMobileLangFooter(header, lang) {
    const panel = header.querySelector("#menuPanel");
    if (!panel) return;

    // Only add once per panel
    if (panel.querySelector(".menuLangFooter")) return;

    const isEs = lang === "es";
    const currentLabel = isEs ? "Español" : "English";
    const otherLabel = isEs ? "English" : "Español";

    // Pick switch URL by reusing language links already in header
    const enLink = header.querySelector('.lang a[data-lang="en"]');
    const esLink = header.querySelector('.lang a[data-lang="es"]');
    const otherHref = isEs
      ? (enLink ? enLink.getAttribute("href") : "/home/")
      : (esLink ? esLink.getAttribute("href") : "/es/");

    const footer = document.createElement("div");
    footer.className = "menuLangFooter";
    footer.innerHTML =
      '<div class="menuLangCurrent">Current: <strong>' +
      currentLabel +
      '</strong></div>' +
      '<a class="pill menuLangSwitch" href="' +
      otherHref +
      '" data-lang-switch="1">Switch to ' +
      otherLabel +
      "</a>";

    panel.appendChild(footer);

    // Ensure it's always at the bottom even if other scripts re-render
    panel.style.display = panel.style.display; // no-op to avoid lint complaints
  }

  function initHeaderMenuToggle(header) {
    const menuBtn = header.querySelector(".menuBtn");
    const panel = header.querySelector("#menuPanel");
    if (!menuBtn || !panel) return;

    if (menuBtn.dataset.bound === "1") return;
    menuBtn.dataset.bound = "1";

    menuBtn.addEventListener("click", () => {
      const open = panel.classList.toggle("is-open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // Close when tapping outside (mobile)
    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("is-open")) return;
      if (header.contains(e.target)) return;
      panel.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
    });

    // Close on ESC
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!panel.classList.contains("is-open")) return;
      panel.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
    });
  }

  function initMobileDrilldown(header) {
    const panel = header.querySelector("#menuPanel");
    if (!panel) return;

    const main = panel.querySelector(".m-main");
    const submenus = Array.from(panel.querySelectorAll(".m-submenu"));
    const nextBtns = Array.from(panel.querySelectorAll(".m-next[data-target]"));
    const backBtns = Array.from(panel.querySelectorAll(".m-back[data-back]"));

    if (!main || !submenus.length) return;

    function showMain() {
      main.hidden = false;
      submenus.forEach((sm) => (sm.hidden = true));
    }

    function showSubmenu(selector) {
      const target = panel.querySelector(selector);
      if (!target) return;
      main.hidden = true;
      submenus.forEach((sm) => (sm.hidden = true));
      target.hidden = false;
    }

    if (panel.dataset.drillBound === "1") return;
    panel.dataset.drillBound = "1";

    showMain();

    nextBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const target = btn.getAttribute("data-target");
        if (target) showSubmenu(target);
      });
    });

    backBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        showMain();
      });
    });

    const menuBtn = header.querySelector(".menuBtn");
    if (menuBtn) {
      menuBtn.addEventListener("click", () => window.setTimeout(showMain, 0));
    }
  }

  function initLanguageUI(header) {
    const lang = getCurrentLang();
    setDesktopLangActive(header, lang);
    ensureMobileLangFooter(header, lang);
  }

  function initMBWHeader() {
    const header = document.querySelector("[data-mbw-header]");
    if (!header) return;

    initHeaderMenuToggle(header);
    initMobileDrilldown(header);
    initLanguageUI(header);
  }

  // Run on normal pages
  ready(initMBWHeader);

  // Run after header/footer injection
  window.addEventListener("mbw:includes:ready", initMBWHeader);

  // Light retry in case injection happens without dispatching event
  let tries = 0;
  const t = setInterval(() => {
    tries += 1;
    initMBWHeader();
    if (document.querySelector("[data-mbw-header]") || tries >= 20) clearInterval(t);
  }, 250);
})();
