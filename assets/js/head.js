/* =========================================================
   MBW Universal Head Injector (v1)
   - Forces CSS + fonts to load consistently (Safari-safe)
   - Centralizes favicon + manifest
   - Adds default OG/Twitter image
   ========================================================= */

(function () {
  const VERSION = "20251219-1"; // bump this any time Safari acts cached

  const head = document.head;
  if (!head) return;

  // Helper to create <link>
  function addLink(rel, href, extra = {}) {
    // Avoid duplicates
    const existing = head.querySelector(`link[rel="${rel}"][href="${href}"]`);
    if (existing) return existing;

    const l = document.createElement("link");
    l.rel = rel;
    l.href = href;
    Object.entries(extra).forEach(([k, v]) => l.setAttribute(k, v));
    head.appendChild(l);
    return l;
  }

  // Helper to create <meta>
  function addMeta(nameOrProp, content, isProp = false) {
    const selector = isProp
      ? `meta[property="${nameOrProp}"]`
      : `meta[name="${nameOrProp}"]`;
    const existing = head.querySelector(selector);
    if (existing) return existing;

    const m = document.createElement("meta");
    if (isProp) m.setAttribute("property", nameOrProp);
    else m.setAttribute("name", nameOrProp);
    m.setAttribute("content", content);
    head.appendChild(m);
    return m;
  }

  // ---- Fonts (match your site.css)
  addLink("preconnect", "https://fonts.googleapis.com");
  addLink("preconnect", "https://fonts.gstatic.com", { crossorigin: "" });

  addLink(
    "stylesheet",
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Open+Sans:wght@400;600;700;800&display=swap"
  );

  // ---- Force-load site CSS with cache-bust (Safari fix)
  addLink("stylesheet", `/assets/css/site.css?v=${VERSION}`);

  // ---- Favicons / manifest (root paths)
  addLink("icon", "/favicon.ico", { sizes: "any" });
  addLink("icon", "/favicon.svg", { type: "image/svg+xml" });
  addLink("apple-touch-icon", "/apple-touch-icon.png");
  addLink("manifest", "/site.webmanifest");

  // Theme color (matches your manifest theme color)
  addMeta("theme-color", "#0d5925");

  // ---- Default OG / Twitter (use your uploaded OG image)
  addMeta("og:site_name", "Mindo Bird Watching", true);
  addMeta("og:type", "website", true);

  // Only set og:image if the page doesn't define its own
  if (!head.querySelector('meta[property="og:image"]')) {
    addMeta("og:image", "/assets/images/og/og-default-1200x630.jpg", true);
    addMeta("og:image:width", "1200", true);
    addMeta("og:image:height", "630", true);
  }

  if (!head.querySelector('meta[name="twitter:card"]')) {
    addMeta("twitter:card", "summary_large_image");
  }
  if (!head.querySelector('meta[name="twitter:image"]')) {
    addMeta("twitter:image", "/assets/images/og/og-default-1200x630.jpg");
  }
})();
