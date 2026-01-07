/* /assets/js/head.js */

(function () {
  const HEAD = document.head;

  function addLink(rel, href, extra = {}) {
    if (!href) return;
    const exists = HEAD.querySelector(`link[rel="${rel}"][href="${href}"]`);
    if (exists) return;

    const l = document.createElement("link");
    l.rel = rel;
    l.href = href;
    Object.entries(extra).forEach(([k, v]) => l.setAttribute(k, v));
    HEAD.appendChild(l);
  }

  function addMeta(nameOrProp, content, isProp = false) {
    if (!content) return;
    const selector = isProp
      ? `meta[property="${nameOrProp}"]`
      : `meta[name="${nameOrProp}"]`;
    if (HEAD.querySelector(selector)) return;

    const m = document.createElement("meta");
    if (isProp) m.setAttribute("property", nameOrProp);
    else m.setAttribute("name", nameOrProp);
    m.setAttribute("content", content);
    HEAD.appendChild(m);
  }

  function addScript(src, attrs = {}) {
    if (!src) return null;
    const exists = HEAD.querySelector(`script[src="${src}"]`);
    if (exists) return exists;

    const s = document.createElement("script");
    s.src = src;
    Object.entries(attrs).forEach(([k, v]) => {
      if (v === true) s.setAttribute(k, k);
      else if (v !== false && v != null) s.setAttribute(k, String(v));
    });
    HEAD.appendChild(s);
    return s;
  }

  const VERSION = "20251231-final";

  function injectHeaderCSS() {
    const existing = [...HEAD.querySelectorAll('link[rel="stylesheet"]')].find(
      (l) => l.href.includes("/assets/css/header.css")
    );

    const url = `/assets/css/header.css?v=${VERSION}`;

    if (existing) {
      existing.href = url;
    } else {
      addLink("stylesheet", url);
    }
  }

  injectHeaderCSS();

  addLink("preconnect", "https://fonts.googleapis.com");
  addLink("preconnect", "https://fonts.gstatic.com", { crossorigin: "" });

  addLink(
    "stylesheet",
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Open+Sans:wght@400;600;700;800&display=swap"
  );

  addLink("icon", "/favicon.ico");
  addLink("icon", "/favicon.svg", { type: "image/svg+xml" });
  addLink("apple-touch-icon", "/apple-touch-icon.png");
  addLink("manifest", "/site.webmanifest");

  addMeta("theme-color", "#0d5925");
  addMeta("og:site_name", "Mindo Bird Watching", true);
  addMeta("og:type", "website", true);
  addMeta("og:image", "/assets/images/og/og-default-1200x630.jpg", true);
  addMeta("msapplication-TileColor", "#C7DAAC");

  (function injectGA4() {
    var MEASUREMENT_ID = "G-1ZYLW22XWP";

    try {
      if (typeof window.gtag === "function") return;

      var existing = HEAD.querySelector(
        'script[src^="https://www.googletagmanager.com/gtag/js?id="]'
      );
      if (existing) return;

      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };

      addScript(
        "https://www.googletagmanager.com/gtag/js?id=" +
          encodeURIComponent(MEASUREMENT_ID),
        { async: true }
      );

      window.gtag("js", new Date());
      window.gtag("config", MEASUREMENT_ID);
    } catch (e) {}
  })();

  (function trackOutboundAndWhatsAppClicks() {
    function safeText(el) {
      try {
        const t = el && (el.getAttribute("aria-label") || el.textContent);
        return t ? String(t).trim().replace(/\s+/g, " ").slice(0, 120) : "";
      } catch (e) {
        return "";
      }
    }

    function getLang() {
      try {
        return document.documentElement && document.documentElement.lang
          ? document.documentElement.lang
          : "";
      } catch (e) {
        return "";
      }
    }

    function isModifiedClick(ev) {
      return !!(
        ev.metaKey ||
        ev.ctrlKey ||
        ev.shiftKey ||
        ev.altKey ||
        ev.button !== 0
      );
    }

    function getAbsoluteUrl(href) {
      try {
        return new URL(href, window.location.href);
      } catch (e) {
        return null;
      }
    }

    function isWhatsAppUrl(u) {
      if (!u) return false;
      const host = (u.hostname || "").toLowerCase();
      const href = (u.href || "").toLowerCase();
      if (host === "wa.me") return true;
      if (host.endsWith("whatsapp.com")) return true;
      if (href.indexOf("api.whatsapp.com") !== -1) return true;
      return false;
    }

    function isExperienceEcuadorUrl(u) {
      if (!u) return false;
      const host = (u.hostname || "").toLowerCase();
      if (host === "experienceecuador.com") return true;
      if (host.endsWith(".experienceecuador.com")) return true;
      return false;
    }

    function sendEvent(eventName, params, done) {
      try {
        if (typeof window.gtag !== "function") {
          if (typeof done === "function") done();
          return;
        }

        let finished = false;
        function finishOnce() {
          if (finished) return;
          finished = true;
          if (typeof done === "function") done();
        }

        window.gtag(
          "event",
          eventName,
          Object.assign({}, params || {}, {
            event_callback: finishOnce,
            event_timeout: 1200,
          })
        );

        setTimeout(finishOnce, 900);
      } catch (e) {
        if (typeof done === "function") done();
      }
    }

    function handleClick(ev) {
      try {
        const a =
          ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
        if (!a) return;

        const hrefAttr = a.getAttribute("href") || "";
        if (!hrefAttr) return;

        const url = getAbsoluteUrl(hrefAttr);
        if (!url) return;

        const isWA = isWhatsAppUrl(url);
        const isEE = isExperienceEcuadorUrl(url);
        if (!isWA && !isEE) return;

        const eventName = isWA
          ? "mbw_whatsapp_click"
          : "mbw_outbound_experienceecuador_click";

        const params = {
          link_url: url.href,
          link_domain: url.hostname || "",
          link_path: url.pathname || "",
          link_text: safeText(a),
          page_location: window.location && window.location.href ? window.location.href : "",
          page_path: window.location && window.location.pathname ? window.location.pathname : "",
          page_lang: getLang(),
        };

        const target = (a.getAttribute("target") || "").toLowerCase();
        const newTab = target === "_blank";

        if (newTab || isModifiedClick(ev)) {
          sendEvent(eventName, params);
          return;
        }

        ev.preventDefault();

        let navigated = false;
        sendEvent(eventName, params, function () {
          if (navigated) return;
          navigated = true;
          window.location.href = url.href;
        });

        setTimeout(function () {
          if (navigated) return;
          navigated = true;
          window.location.href = url.href;
        }, 1100);
      } catch (e) {}
    }

    try {
      document.addEventListener("click", handleClick, true);
    } catch (e) {}
  })();
})();
