/* =========================================================
   MBW Site JS (Header + Mobile Menu Drill-Down) (v2)
   Works with injected header/footer (async) AND normal pages.

   Requires header markup inside injected header:
   - <header data-mbw-header>
   - .menuBtn
   - .menuPanel#menuPanel
   - .m-main (top-level list)
   - .m-submenu (submenu lists) each has id like #m-tours
   - .m-next buttons with data-target="#m-..."
   - .m-back buttons with data-back

   Notes:
   - Safe to call multiple times (won't double-bind).
   - Re-inits automatically after your inject() finishes
     if you dispatch: window.dispatchEvent(new Event("mbw:includes:ready"))
   ========================================================= */

(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  function initHeaderMenuToggle(header) {
    const menuBtn = header.querySelector(".menuBtn");
    const panel = header.querySelector("#menuPanel");

    if (!menuBtn || !panel) return;

    // Bind once per header instance
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

    // Bind once per panel instance
    if (panel.dataset.drillBound === "1") return;
    panel.dataset.drillBound = "1";

    // Default state
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

    // When hamburger opens, always reset to main
    const menuBtn = header.querySelector(".menuBtn");
    if (menuBtn) {
      menuBtn.addEventListener("click", () => window.setTimeout(showMain, 0));
    }
  }

  function initMBWHeader() {
    const header = document.querySelector('[data-mbw-header]');
    if (!header) return;

    initHeaderMenuToggle(header);
    initMobileDrilldown(header);
  }

  // Run on normal pages
  ready(initMBWHeader);

  // Run after header/footer injection
  window.addEventListener("mbw:includes:ready", initMBWHeader);

  // Optional: light retry in case something injects without dispatching event
  // (won't double bind because of dataset guards)
  let tries = 0;
  const t = setInterval(() => {
    tries += 1;
    initMBWHeader();
    if (document.querySelector('[data-mbw-header]') || tries >= 20) clearInterval(t);
  }, 250);
})();
