/* =========================================================
   MBW Mobile Menu Drill-Down (v1)
   Requires:
   - .menuPanel#menuPanel
   - .m-main (top-level list)
   - .m-submenu (submenu lists) each has id like #m-tours
   - .m-next buttons with data-target="#m-..."
   - .m-back buttons with data-back
   ========================================================= */
(function () {
  "use strict";

  const header = document.querySelector('[data-mbw-header]');
  if (!header) return;

  const panel = header.querySelector("#menuPanel");
  if (!panel) return;

  const main = panel.querySelector(".m-main");
  const submenus = Array.from(panel.querySelectorAll(".m-submenu"));
  const nextBtns = Array.from(panel.querySelectorAll(".m-next[data-target]"));
  const backBtns = Array.from(panel.querySelectorAll(".m-back[data-back]"));

  if (!main || !submenus.length) return;

  function showMain() {
    main.hidden = false;
    submenus.forEach(sm => sm.hidden = true);
  }

  function showSubmenu(selector) {
    const target = panel.querySelector(selector);
    if (!target) return;
    main.hidden = true;
    submenus.forEach(sm => sm.hidden = true);
    target.hidden = false;
  }

  // Bind once
  if (panel.dataset.drillBound === "1") return;
  panel.dataset.drillBound = "1";

  // Default state whenever panel is opened/closed
  showMain();

  nextBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      if (target) showSubmenu(target);
    });
  });

  backBtns.forEach(btn => {
    btn.addEventListener("click", () => showMain());
  });

  // When hamburger opens the menu, always reset to main
  const menuBtn = header.querySelector(".menuBtn");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      // If your existing code toggles .is-open, we just reset view
      // after the click runs.
      window.setTimeout(showMain, 0);
    });
  }
})();
