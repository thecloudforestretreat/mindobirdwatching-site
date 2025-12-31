/* /assets/js/site.js
   MBW mobile menu controller (drill-down) - FINAL STABILIZED
   Fixes:
   - On open: ALWAYS show main view only, hide all submenus (even if markup shipped visible)
   - Works even if [hidden] was missing or overridden by legacy CSS
   - Header-row language pills are marked desktop-only
*/

(function () {
  function qs(root, sel) { return (root || document).querySelector(sel); }
  function qsa(root, sel) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function forceHide(el) {
    if (!el) return;
    el.setAttribute("hidden", "");
    el.style.display = "none";
  }

  function forceShow(el) {
    if (!el) return;
    el.removeAttribute("hidden");
    el.style.display = "";
  }

  function initHeader(header) {
    if (!header) return;

    var btn = qs(header, ".menuBtn");
    var panel = qs(header, ".menuPanel");
    if (!btn || !panel) return;

    // Mark header-row language cluster as desktop-only so CSS can hide it on mobile
    var lang = qs(header, ".lang");
    if (lang && !lang.classList.contains("langDesktop")) lang.classList.add("langDesktop");

    // Views
    var mainView = qs(panel, ".m-main") || qs(panel, ".menuList") || panel;
    var subViews = qsa(panel, ".m-submenu");

    // Fallback: treat any element with id starting "m-" as submenu if .m-submenu isn't present
    if (subViews.length === 0) {
      qsa(panel, "[id^='m-']").forEach(function (el) {
        if (el !== mainView) subViews.push(el);
      });
    }

    function resetDrilldown() {
      subViews.forEach(forceHide);
      forceShow(mainView);
    }

    function openPanel() {
      panel.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      resetDrilldown();
    }

    function closePanel() {
      panel.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      resetDrilldown();
    }

    function togglePanel(e) {
      if (e) e.preventDefault();
      if (panel.classList.contains("is-open")) closePanel();
      else openPanel();
    }

    btn.addEventListener("click", togglePanel, { passive: false });
    btn.addEventListener("touchend", togglePanel, { passive: false });

    document.addEventListener("click", function (e) {
      if (!panel.classList.contains("is-open")) return;
      if (header.contains(e.target)) return;
      closePanel();
    });

    panel.addEventListener("click", function (e) {
      var el = e.target;

      // Open submenu (.m-next)
      while (el && el !== panel && !(el.classList && el.classList.contains("m-next"))) {
        el = el.parentNode;
      }
      if (el && el.classList && el.classList.contains("m-next")) {
        var targetSel = el.getAttribute("data-target");
        if (!targetSel) return;
        var targetMenu = qs(panel, targetSel);
        if (!targetMenu) return;

        forceHide(mainView);
        subViews.forEach(forceHide);
        forceShow(targetMenu);
        e.preventDefault();
        return;
      }

      // Back (.m-back)
      el = e.target;
      while (el && el !== panel && !(el.classList && el.classList.contains("m-back"))) {
        el = el.parentNode;
      }
      if (el && el.classList && el.classList.contains("m-back")) {
        var backSel = el.getAttribute("data-back");
        subViews.forEach(forceHide);

        if (backSel) {
          var backMenu = qs(panel, backSel);
          if (backMenu) forceShow(backMenu);
          else forceShow(mainView);
        } else {
          forceShow(mainView);
        }

        e.preventDefault();
        return;
      }
    });

    // Initial state
    resetDrilldown();
    btn.setAttribute("aria-expanded", "false");
  }

  function boot() {
    qsa(document, "header.topbar[data-mbw-header]").forEach(initHeader);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
