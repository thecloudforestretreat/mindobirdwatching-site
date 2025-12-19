/* =========================================================
   MBW Universal Head Tags Injector
   - Adds favicon links, manifest, theme-color, and OG defaults
   - Only adds tags if they are missing (safe on any page)
   ========================================================= */

(function () {
  function ensureMeta(attrName, attrValue, content) {
    const selector = `meta[${attrName}="${attrValue}"]`;
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attrName, attrValue);
      el.setAttribute("content", content);
      document.head.appendChild(el);
    }
  }

  function ensureLink(rel, href, extra) {
    const selector = `link[rel="${rel}"][href="${href}"]`;
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      el.setAttribute("href", href);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
      }
      document.head.appendChild(el);
    }
  }

  function ensureIcon(rel, href, type, sizes) {
    const selector = `link[rel="${rel}"][href="${href}"]`;
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      el.setAttribute("href", href);
      if (type) el.setAttribute("type", type);
      if (sizes) el.setAttribute("sizes", sizes);
      document.head.appendChild(el);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    /* Favicons and manifest (your root files) */
    ensureIcon("icon", "/favicon.ico", null, "any");
    ensureIcon("icon", "/favicon.svg", "image/svg+xml", null);
    ensureLink("apple-touch-icon", "/apple-touch-icon.png");
    ensureLink("manifest", "/site.webmanifest");

    /* Theme colors */
    ensureMeta("name", "theme-color", "#0d5925");

    /* OG defaults (pages can override by defining their own tags in HTML) */
    ensureMeta("property", "og:site_name", "Mindo Bird Watching");
    ensureMeta("property", "og:type", "website");
    ensureMeta("property", "og:title", document.title || "Mindo Bird Watching");
    ensureMeta(
      "property",
      "og:description",
      "Private birding in Mindo, Ecuador. Local guide, personalized tours, and the best cloud forest routes."
    );
    ensureMeta("property", "og:image", "/assets/images/og/og-default-1200x630.jpg");
    ensureMeta("property", "og:image:width", "1200");
    ensureMeta("property", "og:image:height", "630");
    ensureMeta("property", "og:image:alt", "Mindo Bird Watching");

    /* Twitter defaults */
    ensureMeta("name", "twitter:card", "summary_large_image");
    ensureMeta("name", "twitter:title", document.title || "Mindo Bird Watching");
    ensureMeta(
      "name",
      "twitter:description",
      "Private birding in Mindo, Ecuador. Local guide, personalized tours, and the best cloud forest routes."
    );
    ensureMeta("name", "twitter:image", "/assets/images/og/og-default-1200x630.jpg");
  });
})();
