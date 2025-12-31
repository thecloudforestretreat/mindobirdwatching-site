/* /assets/js/site.js
   MBW mobile menu controller (drill-down) - DROP-IN FILE (ASCII ONLY)

   Fixes:
   - Works with injected headers (includes.js) by re-initializing when headers appear
   - Hamburger opens main menu only (submenus hidden)
   - .m-next opens submenu via data-target (e.g. '#m-tours')
   - .m-back returns via data-back
*/

(function () {
  function qs(root, sel) { return (root || document).querySelector(sel); }
  function qsa(root, sel) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function initHeader(header) {
    if (!header || header.__mbwInited) return;
    header.__mbwInited = true;

    var btn = qs(header, ".menuBtn");
    var panel = qs(header, ".menuPanel");
    if (!btn || !panel) return;

    // Mark header-row language cluster as desktop-only so CSS can hide it on mobile
    var lang = qs(header, ".lang");
    if (lang) lang.classList.add("langDesktop");

    var mainView = qs(panel, ".m-main") || panel;
    var subViews = qsa(panel, ".m-submenu");

    function closeAllSubmenus() {
      subViews.forEach(function (sv) { sv.setAttribute("hidden", ""); });
      if (mainView) mainView.removeAttribute("hidden");
    }

    function openPanel() {
      panel.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      closeAllSubmenus();
    }

    function closePanel() {
      panel.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      closeAllSubmenus();
    }

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (panel.classList.contains("is-open")) closePanel();
      else openPanel();
    });

    document.addEventListener("click", function (e) {
      if (!panel.classList.contains("is-open")) return;
      if (header.contains(e.target)) return;
      closePanel();
    });

    panel.addEventListener("click", function (e) {
      var el = e.target;

      // .m-next (open submenu)
      while (el && el !== panel && !(el.classList && el.classList.contains("m-next"))) {
        el = el.parentNode;
      }
      if (el && el.classList && el.classList.contains("m-next")) {
        var targetSel = el.getAttribute("data-target");
        if (!targetSel) return;
        var targetMenu = qs(panel, targetSel);
        if (!targetMenu) return;

        if (mainView) mainView.setAttribute("hidden", "");
        subViews.forEach(function (sv) { sv.setAttribute("hidden", ""); });
        targetMenu.removeAttribute("hidden");
        e.preventDefault();
        return;
      }

      // .m-back (go back)
      el = e.target;
      while (el && el !== panel && !(el.classList && el.classList.contains("m-back"))) {
        el = el.parentNode;
      }
      if (el && el.classList && el.classList.contains("m-back")) {
        var backSel = el.getAttribute("data-back");
        subViews.forEach(function (sv) { sv.setAttribute("hidden", ""); });
        if (backSel) {
          var backMenu = qs(panel, backSel);
          if (backMenu) backMenu.removeAttribute("hidden");
          else if (mainView) mainView.removeAttribute("hidden");
        } else {
          closeAllSubmenus();
        }
        e.preventDefault();
        return;
      }
    });

    // Initial state (important if HTML is injected with submenus visible)
    closeAllSubmenus();
    btn.setAttribute("aria-expanded", "false");
  }

  function initAll() {
    qsa(document, "header.topbar[data-mbw-header]").forEach(initHeader);
  }

  function observeForInjectedHeaders() {
    var mo = new MutationObserver(function () {
      initAll();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  function boot() {
    initAll();
    observeForInjectedHeaders();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
