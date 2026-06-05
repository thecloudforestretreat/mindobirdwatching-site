/* /assets/js/head.js
   Mindo Bird Watching global head asset helper
   Updated: 2026-06-05

   Responsibilities:
   - Load the Google Tag Manager container
   - Load shared head assets
   - Apply cache-busted header.css
   - Add font preconnects and font stylesheet
   - Add favicon, Apple touch icon, and manifest links
   - Add safe default metadata fallbacks only when missing

   Important:
   - GTM-PQV9F24V is currently an empty container
   - Do NOT configure GA4 in GTM during this installation phase
   - Do NOT initialize gtag here
   - Do NOT add analytics click listeners here
   - GA4 and custom event tracking remain centralized in /assets/js/site.js
*/

(function () {
  "use strict";

  var HEAD = document.head || document.getElementsByTagName("head")[0];
  if (!HEAD) return;

  var VERSION = "20260605-gtm-install";
  var GTM_ID = "GTM-PQV9F24V";

  function injectGoogleTagManager() {
    window.dataLayer = window.dataLayer || [];

    if (document.querySelector('script[src*="googletagmanager.com/gtm.js?id=' + GTM_ID + '"]')) {
      return;
    }

    window.dataLayer.push({
      "gtm.start": new Date().getTime(),
      event: "gtm.js"
    });

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(GTM_ID);
    HEAD.appendChild(script);
  }

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

  function hasStylesheetContaining(path) {
    var links = HEAD.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i += 1) {
      var href = links[i].getAttribute("href") || "";
      if (href.indexOf(path) !== -1) return links[i];
    }
    return null;
  }

  function injectHeaderCss() {
    var url = "/assets/css/header.css?v=" + encodeURIComponent(VERSION);
    var existing = hasStylesheetContaining("/assets/css/header.css");

    if (existing) {
      existing.setAttribute("href", url);
      return existing;
    }

    return addLink("stylesheet", url);
  }

  function injectFontAssets() {
    addLink("preconnect", "https://fonts.googleapis.com");
    addLink("preconnect", "https://fonts.gstatic.com", { crossorigin: "" });

    addLink(
      "stylesheet",
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Open+Sans:wght@400;600;700;800&display=swap"
    );
  }

  function injectIconsAndManifest() {
    addLink("icon", "/favicon.ico");
    addLink("icon", "/favicon.svg", { type: "image/svg+xml" });
    addLink("apple-touch-icon", "/apple-touch-icon.png");
    addLink("manifest", "/site.webmanifest");
  }

  function injectSafeMetaFallbacks() {
    addMeta("theme-color", "#0d5925");
    addMeta("msapplication-TileColor", "#C7DAAC");

    addMeta("og:site_name", "Mindo Bird Watching", true);
    addMeta("og:type", "website", true);
    addMeta("og:image", "/assets/images/og/og-default-1200x630.jpg", true);
  }

  injectGoogleTagManager();
  injectHeaderCss();
  injectFontAssets();
  injectIconsAndManifest();
  injectSafeMetaFallbacks();
})();
