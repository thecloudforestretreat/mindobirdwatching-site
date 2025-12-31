/* /assets/js/site.js
   MBW mobile menu controller (drill-down) - STABLE
   Works even if:
   - header is <div class="topbar"> (not <header>)
   - data-mbw-header attribute is missing
   - menu button/panel use ids (#menuBtn/#menuPanel) or classes (.menuBtn/.menuPanel)
   - legacy CSS shipped submenus visible

   Behavior:
   - Hamburger toggles panel
   - On open: show main menu only, hide all submenus
   - .m-next opens submenu via data-target selector
   - .m-back goes back via data-back selector
*/

(function () {
  function qs(root, sel) { return (root || document).querySelector(sel); }
  function qsa(root, sel) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function findBtn(header) {
    return qs(header, ".menuBtn") || qs(header, "#menuBtn") || qs(header, "[data-menu-btn]");
  }

  function findPanel(header) {
    return qs(header, ".menuPanel") || qs(header, "#menuPanel") || qs(header, "[data-menu-panel]");
  }

  function forceHide(el) {
    if (!el) return;
    el.setAttribute("hidden", "");
    el.style.display = "none";
    el.setAttribute("aria-hidden", "true");
  }

  function forceShow(el) {
    if (!el) return;
    el.removeAttribute("hidden");
    el.style.display = "";
    el.setAttribute("aria-hidden", "false");
  }

  function initHeader(topbar) {
    if (!topbar) return;

    var btn = findBtn(topbar);
    var panel = findPanel(topbar);
    if (!btn || !panel) return;

    var mainView =
      qs(panel, ".m-main") ||
      qs(panel, ".menuList") ||
      panel;

    var subViews = qsa(panel, ".m-submenu");

    if (subViews.length === 0) {
      qsa(panel, "[id^='m-']").forEach(function (el) {
        if (el !== mainView) subViews.push(el);
      });
    }

    function legacySubmenuBlocks() {
      return qsa(panel, ".submenu, .subMenu, .submenuList, .menuSub, ul ul, ol ol");
    }

    function resetDrilldown() {
      subViews.forEach(forceHide);
      legacySubmenuBlocks().forEach(function (el) {
        if (el === mainView) return;
        forceHide(el);
      });
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

    if (!btn.__mbwBound) {
      btn.__mbwBound = true;
      btn.addEventListener("click", togglePanel, { passive: false });
      btn.addEventListener("touchend", togglePanel, { passive: false });
    }

    if (!document.__mbwDocBound) {
      document.__mbwDocBound = true;
      document.addEventListener("click", function (e) {
        var openPanels = qsa(document, "#siteHeader .menuPanel.is-open, #siteHeader #menuPanel.is-open");
        if (openPanels.length === 0) return;

        openPanels.forEach(function (p) {
          var h = p.closest("#siteHeader .topbar") || p.closest(".topbar");
          if (h && h.contains(e.target)) return;
          p.classList.remove("is-open");
        });
      });
    }

    if (!panel.__mbwBound) {
      panel.__mbwBound = true;
      panel.addEventListener("click", function (e) {
        var el = e.target;

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
    }

    resetDrilldown();
    btn.setAttribute("aria-expanded", "false");
  }

  function boot() {
    var bars = qsa(document, "#siteHeader .topbar");
    if (bars.length === 0) bars = qsa(document, ".topbar");
    bars.forEach(initHeader);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
