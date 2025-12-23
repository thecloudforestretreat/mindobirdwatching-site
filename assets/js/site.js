/* /assets/js/site.js
   ExperienceEcuador.com — Global header behavior
   - Works with injected /assets/includes/header.html
   - Hamburger open/close + scroll lock
   - Mobile drill-down menus (data-target / data-back)
   - Language switch (EN <-> ES) and header link rewriting based on current language
*/
(function () {
  "use strict";

  const HEADER_MOUNT_ID = "siteHeader";
  const TOGGLE_ID = "eeNavToggle";

  function qs(root, sel) {
    return root ? root.querySelector(sel) : null;
  }
  function qsa(root, sel) {
    return root ? Array.from(root.querySelectorAll(sel)) : [];
  }

  function normalizePath(p) {
    let path = String(p || "/").trim();
    if (!path.startsWith("/")) path = "/" + path;
    // keep trailing slash style
    if (!path.endsWith("/")) path += "/";
    // collapse doubles
    path = path.replace(/\/{2,}/g, "/");
    return path;
  }

  function isSpanishPath(pathname) {
    const p = normalizePath(pathname);
    return p === "/es/" || p.startsWith("/es/");
  }

  // Explicit page mappings (top-level slugs and key sections)
  const EN_TO_ES = {
    "/": "/es/",
    "/about/": "/es/sobre-nosotros/",
    "/mission/": "/es/mision/",
    "/contact/": "/es/contacto/",
    "/trip-builder/": "/es/planificador-de-viaje/",
    "/regions/": "/es/regiones/",
    "/experiences/": "/es/experiencias/",
    "/experiences/adventure/": "/es/experiencias/aventura/",
    "/experiences/nature/": "/es/experiencias/naturaleza/",
    "/experiences/wildlife-birding/": "/es/experiencias/vida-silvestre-y-avistamiento-de-aves/",
    "/experiences/relaxation/": "/es/experiencias/relajacion/",
    "/experiences/culinary/": "/es/experiencias/gastronomia/",
    "/experiences/culture/": "/es/experiencias/cultura/",
    "/regions/galapagos/": "/es/regiones/galapagos/",
    "/regions/coast/": "/es/regiones/costa/",
    "/regions/andes/": "/es/regiones/andes/",
    "/regions/amazon/": "/es/regiones/amazon/"
  };

  // Build reverse map automatically
  const ES_TO_EN = (function () {
    const m = {};
    Object.keys(EN_TO_ES).forEach((en) => {
      m[EN_TO_ES[en]] = en;
    });
    return m;
  })();

  // Fallback rules for deeper pages so you do not have to map everything manually:
  // - /regions/... -> /es/regiones/... (translate only the section slug if needed)
  // - /experiences/... -> /es/experiencias/... (translate only the section slug if needed)
  // - /es/regiones/... -> /regions/...
  // - /es/experiencias/... -> /experiences/...
  function translatePath(pathname, toLang) {
    const from = normalizePath(pathname);
    const target = String(toLang || "en").toLowerCase() === "es" ? "es" : "en";

    // Already in target language
    if (target === "es" && isSpanishPath(from)) return from;
    if (target === "en" && !isSpanishPath(from)) return from;

    // Direct map
    if (target === "es" && EN_TO_ES[from]) return normalizePath(EN_TO_ES[from]);
    if (target === "en" && ES_TO_EN[from]) return normalizePath(ES_TO_EN[from]);

    // Fallback section prefix mapping for deep pages
    if (target === "es") {
      // /regions/... -> /es/regiones/...
      if (from.startsWith("/regions/")) {
        return normalizePath("/es/regiones/" + from.slice("/regions/".length));
      }
      // /experiences/... -> /es/experiencias/...
      if (from.startsWith("/experiences/")) {
        return normalizePath("/es/experiencias/" + from.slice("/experiences/".length));
      }
      // Other pages: prefix with /es/ and keep the rest (best-effort)
      if (from === "/") return "/es/";
      return normalizePath("/es" + from);
    }

    // target === "en"
    if (from.startsWith("/es/regiones/")) {
      return normalizePath("/regions/" + from.slice("/es/regiones/".length));
    }
    if (from.startsWith("/es/experiencias/")) {
      return normalizePath("/experiences/" + from.slice("/es/experiencias/".length));
    }
    if (from.startsWith("/es/")) {
      const stripped = "/" + from.slice("/es/".length);
      return normalizePath(stripped);
    }

    return normalizePath("/");
  }

  function setBodyLock(locked) {
    document.documentElement.classList.toggle("nav-open", locked);
    document.body.style.overflow = locked ? "hidden" : "";
    document.body.style.touchAction = "";
  }

  function showMain(headerEl) {
    const main = qs(headerEl, ".nav-mobile .m-main");
    const subs = qsa(headerEl, ".nav-mobile .m-submenu");
    if (main) main.hidden = false;
    subs.forEach((s) => (s.hidden = true));
  }

  function showSubmenu(headerEl, selector) {
    const main = qs(headerEl, ".nav-mobile .m-main");
    const subs = qsa(headerEl, ".nav-mobile .m-submenu");
    const target = selector ? qs(headerEl, selector) : null;
    if (!target) return;

    if (main) main.hidden = true;
    subs.forEach((s) => (s.hidden = true));
    target.hidden = false;
  }

  function closeMobile(headerEl) {
    const toggle = qs(headerEl, `#${TOGGLE_ID}`);
    if (toggle) toggle.checked = false;
    setBodyLock(false);
    showMain(headerEl);
  }

  function openMobile(headerEl) {
    const toggle = qs(headerEl, `#${TOGGLE_ID}`);
    if (toggle) toggle.checked = true;
    setBodyLock(true);
  }

  function initMobileViews(headerEl) {
    showMain(headerEl);

    const mobileNav = qs(headerEl, ".nav.nav-mobile");
    if (!mobileNav) return;

    // Event delegation
    mobileNav.addEventListener("click", (e) => {
      const t = e.target;

      // Drill-down forward
      const next = t.closest(".m-next");
      if (next && mobileNav.contains(next)) {
        e.preventDefault();
        const targetSel = next.getAttribute("data-target") || "";
        if (targetSel) showSubmenu(headerEl, targetSel);
        return;
      }

      // Back to main
      const back = t.closest("[data-back]");
      if (back && mobileNav.contains(back)) {
        e.preventDefault();
        showMain(headerEl);
        return;
      }

      // Normal link click inside mobile menu closes the menu
      const link = t.closest("a[href]");
      if (link && mobileNav.contains(link)) {
        const href = link.getAttribute("href") || "";
        if (!href || href.charAt(0) === "#") return;
        closeMobile(headerEl);
      }
    });
  }

  function initLanguage(headerEl) {
    const current = normalizePath(window.location.pathname || "/");
    const onEs = isSpanishPath(current);
    const targetLang = onEs ? "en" : "es";
    const switchHref = translatePath(current, targetLang);

    // Update all language switch anchors in header (desktop + mobile)
    const switches = qsa(headerEl, "[data-lang-switch]");
    switches.forEach((a) => {
      a.setAttribute("href", switchHref);

      // Label
      if (a.classList.contains("nav-link")) {
        a.textContent = onEs ? "EN" : "ES";
      } else {
        a.textContent = onEs ? "English" : "Español";
      }

      // Click handler (in case href is blocked by other listeners)
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href") || "";
        if (!href || href === "#") return;
        e.preventDefault();
        closeMobile(headerEl);
        window.location.href = href;
      });
    });

    // Rewrite internal header links to match current language
    // This keeps one shared header include working on both / and /es/
    const allLinks = qsa(headerEl, 'a[href^="/"]');

    allLinks.forEach((link) => {
      // Skip the language switch itself (already handled)
      if (link.hasAttribute("data-lang-switch")) return;

      const hrefRaw = link.getAttribute("href") || "";
      const href = normalizePath(hrefRaw);

      // Leave assets alone
      if (href.startsWith("/assets/") || href.startsWith("/favicon") || href.startsWith("/site.webmanifest") || href.startsWith("/apple-touch-icon")) {
        return;
      }

      // Convert link to current language
      const newHref = onEs ? translatePath(href, "es") : translatePath(href, "en");
      link.setAttribute("href", newHref);
    });

    // Set document lang attribute (best-effort)
    document.documentElement.setAttribute("lang", onEs ? "es" : "en");
  }

  function initHeader(headerEl) {
    if (!headerEl || headerEl.__eeNavInit) return;
    headerEl.__eeNavInit = true;

    const toggle = qs(headerEl, `#${TOGGLE_ID}`);
    const toggleBtn = qs(headerEl, `.nav-toggle-btn[for="${TOGGLE_ID}"]`);
    const mobileNav = qs(headerEl, ".nav.nav-mobile");

    if (!toggle || !toggleBtn || !mobileNav) return;

    initMobileViews(headerEl);

    toggle.addEventListener("change", () => {
      if (toggle.checked) openMobile(headerEl);
      else closeMobile(headerEl);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMobile(headerEl);
    });

    document.addEventListener("click", (e) => {
      if (!toggle.checked) return;
      if (!headerEl.contains(e.target)) closeMobile(headerEl);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 901) closeMobile(headerEl);
    });

    // Language setup (switch + link rewriting)
    initLanguage(headerEl);
  }

  function tryInitFromMount() {
    const mount = document.getElementById(HEADER_MOUNT_ID);
    if (!mount) return false;

    const headerEl = qs(mount, ".topbar") || qs(mount, "header");
    if (!headerEl) return false;

    initHeader(headerEl);
    return true;
  }

  // Try now
  tryInitFromMount();

  // Observe injection
  const mount = document.getElementById(HEADER_MOUNT_ID);
  if (mount) {
    const mo = new MutationObserver(() => {
      if (tryInitFromMount()) mo.disconnect();
    });
    mo.observe(mount, { childList: true, subtree: true });
  }

  // Safety
  window.addEventListener("load", () => {
    tryInitFromMount();
  });
})();
