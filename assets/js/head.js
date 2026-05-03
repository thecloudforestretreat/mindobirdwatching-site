/* /assets/js/head.js
   Mindo Bird Watching head helper
   Updated: 2026-05-03

   Responsibilities:
   - Load shared head assets that are safe to inject globally
   - Add favicon, manifest, theme color, default Open Graph fallback metadata
   - Cache-bust header.css from one central place

   Important:
   - Do not load GA4 here.
   - Do not create click listeners here.
   - All analytics must live in /assets/js/site.js.
*/

(function () {
  "use strict";

  var HEAD = document.head || document.getElementsByTagName("head")[0];
  if (!HEAD) return;

  var VERSION = "20260503-live-ready";

  function addLink(rel, href, extra) {
    if (!href) return null;
    extra = extra || {};

    var selector = 'link[rel="' + rel + '"][href="' + href + '"]';
    var exists = HEAD.querySelector(selector);
    if (exists) return exists;

    var link = document.createElement("link");
    link.rel = rel;
    link.href = href;

    Object.keys(extra).forEach(function (key) {
      var value = extra[key];
      if (value === true) link.setAttribute(key, key);
      else if (value !== false && value !== null && value !== undefined) link.setAttribute(key, String(value));
    });

    HEAD.appendChild(link);
    return link;
  }

  function addMeta(nameOrProperty, content, isProperty) {
    if (!content) return null;

    var selector = isProperty
      ? 'meta[property="' + nameOrProperty + '"]'
      : 'meta[name="' + nameOrProperty + '"]';

    var exists = HEAD.querySelector(selector);
    if (exists) return exists;

    var meta = document.createElement("meta");
    if (isProperty) meta.setAttribute("property", nameOrProperty);
    else meta.setAttribute("name", nameOrProperty);
    meta.setAttribute("content", content);
    HEAD.appendChild(meta);
    return meta;
  }

  function stylesheetHrefContains(path) {
    var links = HEAD.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i += 1) {
      if ((links[i].href || "").indexOf(path) !== -1) return links[i];
    }
    return null;
  }

  function injectHeaderCSS() {
    var url = "/assets/css/header.css?v=" + encodeURIComponent(VERSION);
    var existing = stylesheetHrefContains("/assets/css/header.css");

    if (existing) existing.href = url;
    else addLink("stylesheet", url);
  }

  function injectFontHints() {
    addLink("preconnect", "https://fonts.googleapis.com");
    addLink("preconnect", "https://fonts.gstatic.com", { crossorigin: "" });
    addLink(
      "stylesheet",
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Open+Sans:wght@400;600;700;800&display=swap"
    );
  }

  function injectIconsAndDefaults() {
    addLink("icon", "/favicon.ico");
    addLink("icon", "/favicon.svg", { type: "image/svg+xml" });
    addLink("apple-touch-icon", "/apple-touch-icon.png");
    addLink("manifest", "/site.webmanifest");

    addMeta("theme-color", "#0d5925");
    addMeta("msapplication-TileColor", "#C7DAAC");

    addMeta("og:site_name", "Mindo Bird Watching", true);
    addMeta("og:type", "website", true);
    addMeta("og:image", "/assets/images/og/og-default-1200x630.jpg", true);
  }

  injectHeaderCSS();
  injectFontHints();
  injectIconsAndDefaults();
})();
