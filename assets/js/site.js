/* /assets/js/site.js
   Mindo Bird Watching global site controller and analytics engine
   Updated: 2026-06-05
   Cutover-safe architecture: GTM ownership with delayed direct-GA4 fallback
   Page title fix: sends the native GA4 page_view through config so Realtime Pages and screens can populate

   Central responsibilities:
   - Push normalized mbw_event messages for GTM-managed GA4
   - Let GTM own GA4 when window.__mbwGtmOwnsGa4 is true
   - Preserve direct GA4 as a delayed fallback when GTM is unavailable or unpublished
   - Expose window.mbwAnalyticsTrack
   - Send page_view_enhanced once per page load
   - Send scroll_depth at 25, 50, 75, and 90 percent
   - Listen globally for clicks on [data-analytics-event]
   - Infer basic link analytics for ordinary links without data attributes
   - Track language switch, CTAs, internal links, outbound links, WhatsApp, email, phone, FAQ, and forms
   - Send page_title, page_path, page_url, page_location, page_type, page_language, canonical_url, and device_type with every event
   - Add debug_mode when localStorage.debug_mode is true, URL has ?debug_mode=true, or URL has ?mbw_debug=true
   - Preserve MBW mobile drill-down menu and WhatsApp smart CTA behavior
*/

(function () {
  "use strict";

  var GA_ID = "G-1ZYLW22XWP";
  var DIRECT_GA4_FALLBACK_DELAY_MS = 2500;
  var SCROLL_MILESTONES = [25, 50, 75, 90];
  var sentScroll = {};
  var startedForms = {};
  var visibleFormStates = {};
  var pendingDirectEvents = [];
  var directFallbackTimer = null;
  var directFallbackActive = false;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function absUrl(value) {
    try { return new URL(value || window.location.href, window.location.origin).href; }
    catch (e) { return value || ""; }
  }

  function cleanText(value) {
    return (value || "").toString().replace(/\s+/g, " ").trim();
  }

  function safeDataset(el, key) {
    if (!el || !el.dataset) return "";
    return el.dataset[key] || "";
  }

  function getMeta(name) {
    var el = document.querySelector('meta[name="' + name + '"]') || document.querySelector('meta[property="' + name + '"]');
    return el ? (el.getAttribute("content") || "") : "";
  }

  function getCanonical() {
    var el = document.querySelector('link[rel="canonical"]');
    return el ? absUrl(el.getAttribute("href") || "") : window.location.href;
  }

  function getPageType() {
    if (!document.body) return "unknown";
    return document.body.getAttribute("data-page-type") ||
      document.body.getAttribute("data-analytics-page-type") ||
      "unknown";
  }

  function getPageLanguage() {
    var htmlLang = document.documentElement ? document.documentElement.getAttribute("lang") : "";
    if (!document.body) return htmlLang || "unknown";
    return document.body.getAttribute("data-page-language") ||
      document.body.getAttribute("data-analytics-page-language") ||
      htmlLang ||
      "unknown";
  }

  function getDeviceType() {
    var width = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
    if (width > 0 && width < 768) return "mobile";
    if (width >= 768 && width < 1024) return "tablet";
    return "desktop";
  }

  function getDebugMode() {
    var search = window.location.search || "";
    if (/[?&](debug_mode|mbw_debug)=true(&|$)/i.test(search)) return true;
    try { return window.localStorage && window.localStorage.getItem("debug_mode") === "true"; }
    catch (e) { return false; }
  }

  function getPageContext() {
    var body = document.body;
    return {
      page_title: document.title || "",
      page_path: window.location.pathname || "/",
      page_url: window.location.href,
      page_location: window.location.href,
      canonical_url: getCanonical(),
      page_type: getPageType(),
      page_language: getPageLanguage(),
      content_group: body ? (
        body.getAttribute("data-content-group") ||
        body.getAttribute("data-analytics-content-group") ||
        ""
      ) : "",
      device_type: getDeviceType()
    };
  }

  function basePayload(extra) {
    var payload = getPageContext();

    if (getDebugMode()) payload.debug_mode = true;

    if (extra) {
      Object.keys(extra).forEach(function (key) {
        if (extra[key] !== undefined && extra[key] !== null && extra[key] !== "") payload[key] = extra[key];
      });
    }

    return payload;
  }

  function ensureGtag() {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

    if (!document.querySelector('script[src*="googletagmanager.com/gtag/js?id=' + GA_ID + '"]')) {
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
      (document.head || document.documentElement).appendChild(s);
    }

    if (!window.__mbwGa4Configured) {
      window.__mbwGa4Configured = true;
      window.gtag("js", new Date());

      /*
        Keep the native GA4 page_view enabled.
        Realtime cards such as "Views by Page title and screen name" are populated from
        the standard page_view event, while page_view_enhanced remains our custom audit event.
      */
      window.gtag("config", GA_ID, {
        send_page_view: true,
        page_title: document.title || "",
        page_location: window.location.href,
        page_path: window.location.pathname || "/",
        debug_mode: getDebugMode() || undefined
      });
    }
  }

  function gtmOwnsGa4() {
    return window.__mbwGtmOwnsGa4 === true;
  }

  function sendDirectEvent(name, eventPayload) {
    ensureGtag();
    window.gtag("event", name, eventPayload);
  }

  function activateDirectFallback() {
    directFallbackTimer = null;

    if (gtmOwnsGa4()) {
      pendingDirectEvents = [];
      return;
    }

    directFallbackActive = true;
    ensureGtag();

    pendingDirectEvents.forEach(function (queuedEvent) {
      window.gtag("event", queuedEvent.name, queuedEvent.payload);
    });
    pendingDirectEvents = [];
  }

  function scheduleDirectFallback() {
    if (directFallbackTimer !== null || directFallbackActive || gtmOwnsGa4()) return;
    directFallbackTimer = window.setTimeout(activateDirectFallback, DIRECT_GA4_FALLBACK_DELAY_MS);
  }

  function queueDirectFallbackEvent(name, eventPayload) {
    if (gtmOwnsGa4()) return;

    if (directFallbackActive) {
      sendDirectEvent(name, eventPayload);
      return;
    }

    pendingDirectEvents.push({
      name: name,
      payload: eventPayload
    });
    scheduleDirectFallback();
  }

  function sendEvent(name, payload) {
    if (!name) return;
    window.dataLayer = window.dataLayer || [];
    var eventPayload = basePayload(payload || {});
    var gtmPayload = {
      event: "mbw_event",
      mbw_event_name: name
    };

    Object.keys(eventPayload).forEach(function (key) {
      gtmPayload[key] = eventPayload[key];
    });

    /*
      Cutover behavior:
      - Every normalized event is available to GTM immediately.
      - When the GTM ownership flag is present, GTM is the only GA4 sender.
      - Without the flag, direct GA4 starts after a short delay and replays queued events.
    */
    window.dataLayer.push(gtmPayload);
    queueDirectFallbackEvent(name, eventPayload);
  }

  window.mbwAnalyticsTrack = sendEvent;
  window.mbwAnalyticsContext = getPageContext;

  window.mbwAnalyticsDebugTest = function () {
    sendEvent("debug_test_event", {
      label: "Debug test event",
      event_label: "Debug test event",
      test_source: "window.mbwAnalyticsDebugTest"
    });
  };

  window.mbwAnalyticsFormSuccess = function (formName, extra) {
    var payload = extra || {};
    payload.form_name = formName || payload.form_name || "form";
    sendEvent("form_submit_success", payload);
  };

  window.mbwAnalyticsFormError = function (formName, errorMessage, extra) {
    var payload = extra || {};
    payload.form_name = formName || payload.form_name || "form";
    payload.error_message = errorMessage || payload.error_message || "Form submission error";
    sendEvent("form_submit_error", payload);
  };

  function isSameHost(url) {
    try { return new URL(url, window.location.origin).hostname === window.location.hostname; }
    catch (e) { return false; }
  }

  function classifyLink(a) {
    var href = a.getAttribute("href") || "";
    var lower = href.toLowerCase();

    if (!href || href.charAt(0) === "#") return "anchor";
    if (lower.indexOf("wa.me/") !== -1 || lower.indexOf("api.whatsapp.com") !== -1 || lower.indexOf("whatsapp://") === 0) return "whatsapp";
    if (lower.indexOf("mailto:") === 0) return "email";
    if (lower.indexOf("tel:") === 0) return "phone";
    if (isSameHost(href)) return "internal";
    return "outbound";
  }

  function inferLinkEvent(a) {
    var linkType = classifyLink(a);
    if (linkType === "whatsapp") return "whatsapp_click";
    if (linkType === "email") return "email_click";
    if (linkType === "phone") return "phone_click";
    if (linkType === "internal" || linkType === "anchor") return "internal_link_click";
    if (linkType === "outbound") return "outbound_link_click";
    return "link_click";
  }

  function payloadFromElement(el) {
    var d = el.dataset || {};
    var label = d.analyticsLabel || cleanText(el.textContent) || el.getAttribute("aria-label") || el.getAttribute("title") || "";
    var payload = {
      label: label,
      event_label: label,
      cta_label: d.analyticsLabel || label,
      cta_location: d.analyticsLocation || "",
      link_text: label,
      section_name: d.analyticsSection || "",
      page_type: d.analyticsPageType || getPageType(),
      page_language: d.analyticsPageLanguage || getPageLanguage(),
      region: d.analyticsRegion || "",
      location_name: d.analyticsLocationName || "",
      bird_name: d.analyticsBird || "",
      species_name: d.analyticsSpecies || "",
      habitat: d.analyticsHabitat || "",
      tour_name: d.analyticsTour || "",
      tour_type: d.analyticsTourType || "",
      tour_location: d.analyticsTourLocation || "",
      guide_name: d.analyticsGuide || "",
      experience_type: d.analyticsExperience || "",
      partner_name: d.analyticsPartner || "",
      form_name: d.analyticsForm || "",
      target_language: d.analyticsTargetLanguage || "",
      content_group: d.analyticsContentGroup || getPageContext().content_group || "",
      media_label: d.analyticsMedia || "",
      media_location: d.analyticsMediaLocation || d.analyticsLocation || "",
      error_message: d.analyticsErrorMessage || ""
    };

    if (el.tagName && el.tagName.toLowerCase() === "a") {
      payload.link_url = absUrl(el.getAttribute("href") || "");
      payload.link_type = classifyLink(el);
    }

    return payload;
  }

  function trackAttributedClick(e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-analytics-event]") : null;
    if (!el) return false;
    sendEvent(el.getAttribute("data-analytics-event"), payloadFromElement(el));
    return true;
  }

  function trackUnattributedLink(e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    if (a.closest("[data-analytics-event]")) return;

    var eventName = inferLinkEvent(a);
    var payload = payloadFromElement(a);
    payload.event_label = cleanText(a.textContent) || a.getAttribute("aria-label") || a.getAttribute("title") || payload.link_url;
    payload.label = payload.event_label;
    payload.link_text = payload.event_label;
    sendEvent(eventName, payload);
  }

  function initCustomFaqClickTracking() {
    if (document.__mbwCustomFaqBound) return;
    document.__mbwCustomFaqBound = true;

    document.addEventListener("click", function (e) {
      var el = e.target && e.target.closest ? e.target.closest("[data-faq-question], .faq-question, .faq-toggle, .faq-card, .faq-item button, [aria-controls][aria-expanded]") : null;
      if (!el) return;
      if (el.closest("[data-analytics-event]")) return;
      if (el.tagName && el.tagName.toLowerCase() === "a") return;

      var expanded = el.getAttribute("aria-expanded");
      if (expanded === "false") return;

      var faqLabel = cleanText(el.textContent) || el.getAttribute("aria-label") || "FAQ expanded";
      sendEvent("faq_expand", {
        label: faqLabel,
        event_label: faqLabel,
        section_name: "faq"
      });
    }, true);
  }

  function trackPageView() {
    if (window.__mbwPageViewEnhancedSent) return;
    window.__mbwPageViewEnhancedSent = true;
    sendEvent("page_view_enhanced", {
      meta_description: getMeta("description"),
      og_url: getMeta("og:url"),
      referrer: document.referrer || "",
      viewport_width: window.innerWidth || 0,
      viewport_height: window.innerHeight || 0
    });
  }

  function getScrollPercent() {
    var doc = document.documentElement;
    var body = document.body;
    var scrollTop = window.pageYOffset || doc.scrollTop || (body && body.scrollTop) || 0;
    var scrollHeight = Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      doc.clientHeight,
      doc.scrollHeight,
      doc.offsetHeight
    );
    var winHeight = window.innerHeight || doc.clientHeight || 0;
    var trackLength = Math.max(scrollHeight - winHeight, 1);
    return Math.min(100, Math.round((scrollTop / trackLength) * 100));
  }

  function checkScrollDepth() {
    var pct = getScrollPercent();
    SCROLL_MILESTONES.forEach(function (m) {
      if (!sentScroll[m] && pct >= m) {
        sentScroll[m] = true;
        sendEvent("scroll_depth", { scroll_percent: m });
      }
    });
  }

  function initScrollTracking() {
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        checkScrollDepth();
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    checkScrollDepth();
  }

  function initNativeDetailsFaqTracking() {
    document.addEventListener("toggle", function (e) {
      var details = e.target;
      if (!details || details.tagName !== "DETAILS" || !details.open) return;
      if (details.getAttribute("data-analytics-event")) return;
      var summary = details.querySelector("summary");
      var faqLabel = summary ? cleanText(summary.textContent) : "FAQ expanded";
      sendEvent("faq_expand", {
        label: faqLabel,
        event_label: faqLabel,
        section_name: "faq"
      });
    }, true);
  }

  function getFormName(form) {
    return form.getAttribute("data-analytics-form") || form.getAttribute("name") || form.getAttribute("id") || "form";
  }

  function formPayload(form, extra) {
    var payload = extra || {};
    payload.form_name = getFormName(form);
    payload.section_name = safeDataset(form, "analyticsSection") || payload.section_name;
    return payload;
  }

  function initFormTracking() {
    document.addEventListener("focusin", function (e) {
      var field = e.target;
      if (!field || !field.closest) return;
      var form = field.closest("form");
      if (!form) return;
      var name = getFormName(form);
      if (startedForms[name]) return;
      startedForms[name] = true;
      sendEvent("form_start", formPayload(form));
    });

    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;

      var explicit = form.getAttribute("data-analytics-event");
      if (explicit) {
        sendEvent(explicit, payloadFromElement(form));
        return;
      }
      sendEvent("form_submit_attempt", formPayload(form));
    }, true);

    document.addEventListener("mbw:form-success", function (e) {
      var detail = e.detail || {};
      window.mbwAnalyticsFormSuccess(detail.form_name || detail.formName || "form", detail);
    });

    document.addEventListener("mbw:form-error", function (e) {
      var detail = e.detail || {};
      window.mbwAnalyticsFormError(detail.form_name || detail.formName || "form", detail.error_message || detail.errorMessage || "Form submission error", detail);
    });
  }

  function elementIsVisible(el) {
    if (!el) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function detectVisibleFormStates() {
    var successSelectors = [
      "[data-form-success]",
      ".form-success",
      ".success-message",
      ".contact-success",
      "[role='status']"
    ];

    var errorSelectors = [
      "[data-form-error]",
      ".form-error",
      ".error-message",
      ".contact-error",
      "[role='alert']"
    ];

    successSelectors.forEach(function (sel) {
      Array.prototype.slice.call(document.querySelectorAll(sel)).forEach(function (el) {
        if (!elementIsVisible(el)) return;
        var formName = el.getAttribute("data-analytics-form") || el.getAttribute("data-form-success") || "form";
        var key = "success:" + formName + ":" + cleanText(el.textContent);
        if (visibleFormStates[key]) return;
        visibleFormStates[key] = true;
        var successLabel = cleanText(el.textContent) || "Form success";
        sendEvent("form_submit_success", {
          label: successLabel,
          form_name: formName,
          event_label: successLabel
        });
      });
    });

    errorSelectors.forEach(function (sel) {
      Array.prototype.slice.call(document.querySelectorAll(sel)).forEach(function (el) {
        if (!elementIsVisible(el)) return;
        var formName = el.getAttribute("data-analytics-form") || el.getAttribute("data-form-error") || "form";
        var msg = cleanText(el.textContent) || "Form submission error";
        var key = "error:" + formName + ":" + msg;
        if (visibleFormStates[key]) return;
        visibleFormStates[key] = true;
        sendEvent("form_submit_error", {
          label: msg,
          form_name: formName,
          error_message: msg,
          event_label: msg
        });
      });
    });
  }

  function initVisibleFormStateObserver() {
    detectVisibleFormStates();
    if (!window.MutationObserver || window.__mbwFormStateObserver) return;
    window.__mbwFormStateObserver = new MutationObserver(function () {
      detectVisibleFormStates();
    });
    window.__mbwFormStateObserver.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"]
    });
  }

  function bootAnalytics() {
    scheduleDirectFallback();
    trackPageView();
    initScrollTracking();
    initNativeDetailsFaqTracking();
    initCustomFaqClickTracking();
    initFormTracking();
    initVisibleFormStateObserver();

    if (!document.__mbwAnalyticsClickBound) {
      document.__mbwAnalyticsClickBound = true;
      document.addEventListener("click", function (e) {
        if (trackAttributedClick(e)) return;
        trackUnattributedLink(e);
      }, true);
    }
  }

  ready(bootAnalytics);
})();

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

  if (!window.__mbwHeaderObserver && "MutationObserver" in window) {
    window.__mbwHeaderObserver = new MutationObserver(function () { boot(); });
    window.__mbwHeaderObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }
})();

/* MBW desktop dropdown controller - click-open with hover grace
   Keeps parent navigation available through the first submenu item. */

(function () {
  "use strict";

  function qsa(root, sel) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function isDesktop() {
    return (window.matchMedia && window.matchMedia("(min-width: 901px)").matches) ||
      (window.innerWidth || 0) >= 901;
  }

  function initHeaderDropdowns(topbar) {
    if (!topbar || topbar.__mbwDesktopDropdownsBound) return;

    var dropdowns = qsa(topbar, ".dropdown");
    if (!dropdowns.length) return;

    topbar.__mbwDesktopDropdownsBound = true;

    function closeDropdown(dropdown) {
      if (!dropdown) return;
      dropdown.classList.remove("is-open");
      var trigger = dropdown.querySelector(":scope > .pill");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    }

    function closeAll(except) {
      dropdowns.forEach(function (dropdown) {
        if (dropdown !== except) closeDropdown(dropdown);
      });
    }

    function openDropdown(dropdown) {
      if (!dropdown || !isDesktop()) return;
      closeAll(dropdown);
      dropdown.classList.add("is-open");
      var trigger = dropdown.querySelector(":scope > .pill");
      if (trigger) trigger.setAttribute("aria-expanded", "true");
    }

    dropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector(":scope > .pill");
      var closeTimer = null;

      if (!trigger) return;

      function clearCloseTimer() {
        if (!closeTimer) return;
        window.clearTimeout(closeTimer);
        closeTimer = null;
      }

      function scheduleClose() {
        clearCloseTimer();
        closeTimer = window.setTimeout(function () {
          closeDropdown(dropdown);
        }, 450);
      }

      trigger.addEventListener("click", function (event) {
        if (!isDesktop()) return;

        event.preventDefault();
        clearCloseTimer();

        if (dropdown.classList.contains("is-open")) {
          closeDropdown(dropdown);
        } else {
          openDropdown(dropdown);
        }
      });

      dropdown.addEventListener("mouseenter", function () {
        if (!isDesktop()) return;
        clearCloseTimer();
        openDropdown(dropdown);
      });

      dropdown.addEventListener("mouseleave", function () {
        if (!isDesktop()) return;
        scheduleClose();
      });

      dropdown.addEventListener("focusin", function () {
        if (!isDesktop()) return;
        clearCloseTimer();
        openDropdown(dropdown);
      });

      dropdown.addEventListener("focusout", function () {
        if (!isDesktop()) return;
        window.setTimeout(function () {
          if (!dropdown.contains(document.activeElement)) closeDropdown(dropdown);
        }, 80);
      });

      var menu = dropdown.querySelector(".dropdownMenu");
      if (menu) {
        menu.addEventListener("click", function () {
          closeDropdown(dropdown);
        });
      }
    });

    if (!document.__mbwDesktopDropdownDocBound) {
      document.__mbwDesktopDropdownDocBound = true;

      document.addEventListener("click", function (event) {
        if (!isDesktop()) return;
        var openDropdowns = qsa(document, "#siteHeader .dropdown.is-open");
        openDropdowns.forEach(function (dropdown) {
          if (!dropdown.contains(event.target)) closeDropdown(dropdown);
        });
      });

      document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") return;
        qsa(document, "#siteHeader .dropdown.is-open").forEach(closeDropdown);
      });

      window.addEventListener("resize", function () {
        if (isDesktop()) return;
        qsa(document, "#siteHeader .dropdown.is-open").forEach(closeDropdown);
      });
    }
  }

  function bootDesktopDropdowns() {
    qsa(document, "#siteHeader .topbar, .topbar[data-mbw-header]").forEach(initHeaderDropdowns);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootDesktopDropdowns);
  else bootDesktopDropdowns();

  if (!window.__mbwDesktopDropdownObserver && "MutationObserver" in window) {
    window.__mbwDesktopDropdownObserver = new MutationObserver(bootDesktopDropdowns);
    window.__mbwDesktopDropdownObserver.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
  }
})();

/* WhatsApp Smart CTA (MBW) v4 */

(function () {
  function getInlineWaQuestions() {
    var el = document.getElementById("mbwWaQuestions");
    if (!el) return null;
    try { return JSON.parse(el.textContent || el.innerText || "{}"); } catch (e) { return null; }
  }

  function normalizePath(p) {
    p = p || "/";
    if (p.length > 1 && p.charAt(p.length - 1) !== "/") p = p + "/";
    return p;
  }

  function isSpanishPath(p) {
    return p === "/es/" || p.indexOf("/es/") === 0;
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function cleanText(value) {
    return (value || "").toString().replace(/\s+/g, " ").trim();
  }

  function isMobileLike() {
    var byWidth = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    var byPointer = window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    var byTouch = ("ontouchstart" in window) || (navigator && navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    return !!(byWidth || byPointer || byTouch);
  }

  function getPageLabel() {
    var t = document.title || "";
    t = t.replace(/\s*\|\s*Mindo Bird Watching\s*$/i, "");
    return t.trim();
  }

  function setImgForViewport(root) {
    var img = qs(".mbwWaBirdImg", root);
    if (!img) return;

    var d = (root.getAttribute("data-wa-img-desktop") || "").toString();
    var m = (root.getAttribute("data-wa-img-mobile") || "").toString();
    var target = isMobileLike() ? (m || d) : (d || m);

    if (target && img.getAttribute("src") !== target) img.setAttribute("src", target);
  }

  function init(root) {
    if (!root || root.__mbwWaBirdInit) return;
    root.__mbwWaBirdInit = true;

    var btn = qs(".mbwWaBirdBtn", root);
    var closeBtn = qs(".mbwWaBirdClose", root);
    var backdrop = qs(".mbwWaBirdBackdrop", root);
    var actions = qsa(".mbwWaBirdAction", root);

    (function applyPerPageQuestions() {
      if (!actions || actions.length < 4) return;
      var data = getInlineWaQuestions();
      if (!data || !data.pages) return;

      var p = normalizePath(window.location.pathname || "/");
      var row = data.pages[p];
      if (!row) {
        var def = isSpanishPath(p) ? data.default_es : data.default_en;
        if (!def) return;
        row = def;
      }

      if (row.q1) actions[0].textContent = row.q1;
      if (row.q2) actions[1].textContent = row.q2;
      if (row.q3) actions[2].textContent = row.q3;
      if (row.q4) actions[3].textContent = row.q4;

      if (row.t1) actions[0].setAttribute("data-wa-template", row.t1);
      if (row.t2) actions[1].setAttribute("data-wa-template", row.t2);
      if (row.t3) actions[2].setAttribute("data-wa-template", row.t3);
      if (row.t4) actions[3].setAttribute("data-wa-template", row.t4);
    })();

    if (!btn) return;

    function buildLink(template) {
      var numRaw = (root.getAttribute("data-wa-number") || "").toString();
      var num = numRaw.replace(/[^\d]/g, "");
      if (!num) return "";

      var url = window.location.href;
      var msg = (template || "").replace("{url}", url);
      return "https://wa.me/" + num + "?text=" + encodeURIComponent(msg);
    }

    function openPanel() {
      root.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
    }

    function closePanel() {
      root.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }

    function trackWhatsApp(label, location, link) {
      if (window.mbwAnalyticsTrack) {
        window.mbwAnalyticsTrack("whatsapp_click", {
          label: label,
          event_label: label,
          cta_label: label,
          cta_location: location,
          link_url: link,
          link_type: "whatsapp"
        });
      }
    }

    function getPrimaryTemplate() {
      var data = getInlineWaQuestions();
      var p = normalizePath(window.location.pathname || "/");
      var row = (data && data.pages) ? data.pages[p] : null;
      if (!row && data) row = isSpanishPath(p) ? data.default_es : data.default_en;
      return (row && row.t1) ? row.t1 : ("Hi! I am interested in:\n" + (getPageLabel() || "a birding tour") + "\n\nPage: {url}");
    }

    function goWhatsApp(template, label, location) {
      var link = buildLink(template);
      if (!link) return;
      trackWhatsApp(label || "WhatsApp smart CTA", location || "floating_whatsapp", link);
      window.location.href = link;
    }

    function onBtnClick(e) {
      e.preventDefault();

      if (isMobileLike()) {
        goWhatsApp(getPrimaryTemplate(), "WhatsApp smart CTA", "floating_whatsapp_mobile");
        return;
      }

      if (root.classList.contains("is-open")) closePanel();
      else openPanel();
    }

    setImgForViewport(root);
    window.addEventListener("resize", function () { setImgForViewport(root); }, { passive: true });

    btn.addEventListener("click", onBtnClick, { passive: false });

    btn.addEventListener("touchstart", function (e) {
      if (!isMobileLike()) return;
      e.preventDefault();
      e.stopPropagation();
      onBtnClick(e);
    }, { passive: false });

    if (closeBtn) closeBtn.addEventListener("click", function (e) { e.preventDefault(); closePanel(); }, { passive: false });
    if (backdrop) backdrop.addEventListener("click", function () { closePanel(); }, { passive: true });

    actions.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (isMobileLike()) {
          goWhatsApp(getPrimaryTemplate(), "WhatsApp smart CTA", "floating_whatsapp_mobile");
          return;
        }

        var template = a.getAttribute("data-wa-template") || "";
        var link = buildLink(template);
        if (!link) return;

        trackWhatsApp(cleanText(a.textContent) || "WhatsApp smart CTA option", "floating_whatsapp_panel", link);
        closePanel();
        window.open(link, "_blank", "noopener,noreferrer");
      }, { passive: false });
    });
  }

  function boot() { qsa(".mbwWaBirdFab").forEach(init); }

  function bootSoon() {
    boot();
    window.setTimeout(boot, 400);
    window.setTimeout(boot, 1200);
    window.setTimeout(boot, 2500);
  }

  bootSoon();

  if (!window.__mbwWaBirdObserver && "MutationObserver" in window) {
    window.__mbwWaBirdObserver = new MutationObserver(function () {
      boot();
    });
    window.__mbwWaBirdObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }
})();

/* WhatsApp Legacy Cleanup (FINAL)
   This removes older widgets from previous attempts and prevents duplicate UI on mobile.
*/

(function () {
  function removeAll(sel) {
    document.querySelectorAll(sel).forEach(function (n) { n.remove(); });
  }

  function cleanup() {
    removeAll(".mbwWaFab");

    var birds = Array.prototype.slice.call(document.querySelectorAll(".mbwWaBirdFab"));
    if (birds.length > 1) {
      birds.slice(0, birds.length - 1).forEach(function (n) { n.remove(); });
    }

    removeAll(".mbwWaFabPanel");
    removeAll(".mbwWaFabBackdrop");
    removeAll(".mbwWaFabActions");
  }

  cleanup();
  window.setTimeout(cleanup, 500);
  window.setTimeout(cleanup, 1500);

  if (!window.__mbwWaCleanupObserver && "MutationObserver" in window) {
    window.__mbwWaCleanupObserver = new MutationObserver(function () { cleanup(); });
    window.__mbwWaCleanupObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
  }
})();
