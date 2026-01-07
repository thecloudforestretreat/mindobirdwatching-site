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
})();
