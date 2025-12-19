/* /assets/js/head.js
   Injects: favicon + manifest + theme color + OG defaults
   Works on any page that includes this script with `defer`.
*/
(function () {
  const head = document.head;
  if (!head) return;

  const PAGE_BG = "#C7DAAC";
  const THEME = "#0d5925";

  const OG_DEFAULT = "/assets/images/og/og-default-1200x630.jpg";
  const SITE_NAME = "Mindo Bird Watching";

  // Helper: upsert <meta> and <link>
  function upsertMeta(attrName, attrValue, content) {
    let el = head.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attrName, attrValue);
      head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function upsertLink(rel, href, extra = {}) {
    let selector = `link[rel="${rel}"]`;
    if (extra.sizes) selector += `[sizes="${extra.sizes}"]`;
    if (extra.type) selector += `[type="${extra.type}"]`;

    let el = head.querySelector(selector);
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      if (extra.sizes) el.setAttribute("sizes", extra.sizes);
      if (extra.type) el.setAttribute("type", extra.type);
      head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  // Favicons + manifest (ROOT paths)
  upsertLink("icon", "/favicon.ico", { sizes: "any" });
  upsertLink("icon", "/favicon.svg", { type: "image/svg+xml" });
  upsertLink("apple-touch-icon", "/apple-touch-icon.png");
  upsertLink("manifest", "/site.webmanifest");

  // Theme / PWA colors
  upsertMeta("name", "theme-color", THEME);
  upsertMeta("name", "msapplication-TileColor", THEME);

  // OG defaults (page-specific pages can override by adding their own OG tags in HTML)
  const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;

  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:url", canonical);

  // If page already has og:title/og:description, keep them. Otherwise set safe defaults.
  if (!head.querySelector('meta[property="og:title"]')) {
    upsertMeta("property", "og:title", document.title || SITE_NAME);
  }
  if (!head.querySelector('meta[property="og:description"]')) {
    upsertMeta("property", "og:description", "Private birding tours in Mindo, Ecuador.");
  }

  // Image
  if (!head.querySelector('meta[property="og:image"]')) {
    upsertMeta("property", "og:image", OG_DEFAULT);
  }
  upsertMeta("property", "og:image:width", "1200");
  upsertMeta("property", "og:image:height", "630");

  // Optional: background color guard (in case any page has old inline bg)
  document.documentElement.style.backgroundColor = PAGE_BG;
})();
