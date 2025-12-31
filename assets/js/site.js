/* /assets/js/site.js
   MBW mobile menu controller (drill-down) - STABLE
   Fixes:
   - Works even when header is injected asynchronously (includes.js)
   - Hamburger opens main menu only (submenus hidden)
   - .m-next opens submenu via data-target (e.g. '#m-tours')
   - .m-back returns via data-back
   - Does NOT add extra classes to .lang (so site.css can hide it on mobile)
   ASCII only
*/

(function () {
  function qs(root, sel) { return (root || document).querySelector(sel); }
  function qsa(root, sel) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function initHeader(header) {
    if (!header || header.__mbwMenuInit) return;
    header.__mbwMenuInit = true;

    var btn = qs(header, ".menuBtn");
    var panel = qs(header, ".menuPanel");
    if (!btn || !panel) return;

    var mainView = qs(panel, ".m-main") || panel;
    var subViews = qsa(panel, ".m-submenu");

    // Fallback: if markup does not use .m-submenu, treat any element with id starting "m-" as a submenu view
    if (!subViews.length) {
      subViews = qsa(panel, "[id^='m-']").filter(function (el) {
        return el !== panel && el !== mainView;
      });
    }

    function setHidden(el, on) {
      if (!el) return;
      if (on) el.setAttribute("hidden", "");
      else el.removeAttribute("hidden");
    }

    function closeAllSubmenus() {
      subViews.forEach(function (sv) { setHidden(sv, true); });
      setHidden(mainView, false);
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

      // .m-next opens submenu
      while (el && el !== panel && !(el.classList && el.classList.contains("m-next"))) {
        el = el.parentNode;
      }
      if (el && el.classList && el.classList.contains("m-next")) {
        var targetSel = el.getAttribute("data-target");
        if (!targetSel) return;
        var targetMenu = qs(panel, targetSel);
        if (!targetMenu) return;

        setHidden(mainView, true);
        subViews.forEach(function (sv) { setHidden(sv, true); });
        setHidden(targetMenu, false);
        e.preventDefault();
        return;
      }

      // .m-back goes back
      el = e.target;
      while (el && el !== panel && !(el.classList && el.classList.contains("m-back"))) {
        el = el.parentNode;
      }
      if (el && el.classList && el.classList.contains("m-back")) {
        var backSel = el.getAttribute("data-back");

        subViews.forEach(function (sv) { setHidden(sv, true); });

        if (backSel) {
          var backMenu = qs(panel, backSel);
          if (backMenu) setHidden(backMenu, false);
          else setHidden(mainView, false);
        } else {
          closeAllSubmenus();
        }
        e.preventDefault();
        return;
      }
    });

    // Initial state
    closeAllSubmenus();
    btn.setAttribute("aria-expanded", "false");
  }

  function bootOnce() {
    qsa(document, "header.topbar[data-mbw-header]").forEach(initHeader);
  }

  // Retry because header is injected async by includes.js
  function bootWithRetry() {
    var tries = 0;
    var maxTries = 40; // ~4s
    var timer = setInterval(function () {
      tries += 1;
      bootOnce();
      if (qsa(document, "header.topbar[data-mbw-header]").length && tries >= 3) {
        clearInterval(timer);
      }
      if (tries >= maxTries) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootWithRetry);
  } else {
    bootWithRetry();
  }
})();
