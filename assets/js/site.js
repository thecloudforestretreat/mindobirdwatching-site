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

/* ============================
   WhatsApp Smart CTA (MBW)
   Desktop: bird button opens menu
   Mobile (coarse pointer): bird button opens WhatsApp directly
   ============================ */

(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function isMobileLike() {
    // Works in real phones AND in some preview containers where width can be misleading
    var byWidth = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    var byPointer = window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    return !!(byWidth || byPointer);
  }

  function setImgForViewport(root) {
    var img = qs(".mbwWaFabImg", root);
    if (!img) return;

    var d = (root.getAttribute("data-wa-img-desktop") || "").toString();
    var m = (root.getAttribute("data-wa-img-mobile") || "").toString();
    var target = isMobileLike() ? (m || d) : (d || m);

    if (target && img.getAttribute("src") !== target) img.setAttribute("src", target);
  }

  function initFab(root) {
    if (!root || root.__mbwWaInit) return;
    root.__mbwWaInit = true;

    var btn = qs(".mbwWaFabBtn", root);
    var closeBtn = qs(".mbwWaFabClose", root);
    var backdrop = qs(".mbwWaFabBackdrop", root);
    var actions = qsa(".mbwWaFabAction", root);

    if (!btn) return;

    function buildWaLink(template) {
      var numRaw = (root.getAttribute("data-wa-number") || "").toString();
      var num = numRaw.replace(/[^\d]/g, "");
      if (!num) return "";

      var url = window.location.href;
      var msg = (template || "").replace("{url}", url);
      var encoded = encodeURIComponent(msg);

      return "https://wa.me/" + num + "?text=" + encoded;
    }

    function openLink(link) {
      // window.open can be blocked on mobile; fall back to location change
      var w = window.open(link, "_blank", "noopener,noreferrer");
      if (!w) window.location.href = link;
    }

    function openPanel() {
      root.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
    }

    function closePanel() {
      root.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }

    function togglePanel(e) {
      if (e) e.preventDefault();

      // Mobile-like: go straight to WhatsApp with a general message
      if (isMobileLike()) {
        var link = buildWaLink("Hi! I would like to book a birding tour. Page: {url}");
        if (link) openLink(link);
        return;
      }

      // Desktop: open/close menu
      if (root.classList.contains("is-open")) closePanel();
      else openPanel();
    }

    // Set correct image on load and when media conditions change
    setImgForViewport(root);
    if (window.matchMedia) {
      var mq1 = window.matchMedia("(max-width: 900px)");
      var mq2 = window.matchMedia("(hover: none) and (pointer: coarse)");

      function onChange() { setImgForViewport(root); closePanel(); }

      if (mq1.addEventListener) mq1.addEventListener("change", onChange);
      else if (mq1.addListener) mq1.addListener(onChange);

      if (mq2.addEventListener) mq2.addEventListener("change", onChange);
      else if (mq2.addListener) mq2.addListener(onChange);
    }

    btn.addEventListener("click", togglePanel, { passive: false });

    if (closeBtn) closeBtn.addEventListener("click", function (e) { e.preventDefault(); closePanel(); }, { passive: false });
    if (backdrop) backdrop.addEventListener("click", function () { closePanel(); }, { passive: true });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePanel();
    });

    // Desktop menu actions
    actions.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Just in case: if a preview shows the panel on a touch device
        if (isMobileLike()) {
          var linkM = buildWaLink("Hi! I would like to book a birding tour. Page: {url}");
          if (linkM) openLink(linkM);
          return;
        }

        var template = a.getAttribute("data-wa-template") || "";
        var link = buildWaLink(template);
        if (!link) return;

        closePanel();
        openLink(link);
      }, { passive: false });
    });
  }

  function boot() {
    qsa(".mbwWaFab").forEach(initFab);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
