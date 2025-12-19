/* /assets/js/head.js
   Universal <head> injector for MBW
   - Favicons + manifest
   - Theme color
   - OG defaults (safe to include everywhere)
   - Google Fonts (loaded as <link>, not @import)
*/

(function () {
  const HEAD = document.head;

  function addLink(rel, href, extra = {}) {
    if (!href) return;
    // prevent duplicates
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

  // ---------- Fonts (Safari-safe) ----------
  addLink("preconnect", "https://fonts.googleapis.com");
  addLink("preconnect", "https://fonts.gstatic.com", { crossorigin: "" });

  addLink(
    "stylesheet",
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Open+Sans:wght@400;600;700;800&display=swap"
  );

  // ---------- Favicons (root) ----------
  addLink("icon", "/favicon.ico");
  addLink("icon", "/favicon.svg", { type: "image/svg+xml" });
  addLink("apple-touch-icon", "/apple-touch-icon.png");
  addLink("manifest", "/site.webmanifest");

  // ---------- Theme color ----------
  addMeta("theme-color", "#0d5925");

  // ---------- OG defaults ----------
  addMeta("og:site_name", "Mindo Bird Watching", true);
  addMeta("og:type", "website", true);
  addMeta("og:image", "/assets/images/og/og-default-1200x630.jpg", true);

  // Optional: keep background hint consistent
  addMeta("msapplication-TileColor", "#C7DAAC");
})();
