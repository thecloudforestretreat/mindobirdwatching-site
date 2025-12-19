/* =========================================================
   MBW Global Site JS (single include system)
   - Loads /assets/includes/header.html into #siteHeader
   - Loads /assets/includes/footer.html into #siteFooter
   - Locale from URL: /es/... => "es", else "en"
   - Updates nav labels + hrefs from data attributes in header.html
   - Sets EN/ES switch hrefs from <link rel="alternate" hreflang="en|es">
   - Sets active nav pill based on window.location.pathname
   - Initializes hamburger after header is injected
   - Avoids duplicate listeners if run more than once
   ========================================================= */

(function () {
  "use strict";

  function normalizePath(p) {
    try {
      if (!p) return "/";
      let path = String(p).split("?")[0].split("#")[0];
      if (!path.startsWith("/")) path = "/" + path;
      if (path !== "/" && !path.endsWith("/")) path += "/";
      return path;
    } catch {
      return "/";
    }
  }

  function getLocaleFromPathname() {
    const p = normalizePath(window.location.pathname);
    return p.startsWith("/es/") ? "es" : "en";
  }

  function getAlternateHref(lang) {
    const el = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`);
    if (!el) return null;
    const href = el.getAttribute("href");
    return href ? href : null;
  }

  async function fetchInclude(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return await res.text();
  }

  function setLangSwitchLinks(scope) {
    const locale = getLocaleFromPathname();

    const enHref = getAlternateHref("en") || "/home/";
    const esHref = getAlternateHref("es") || "/es/";

    scope.querySelectorAll('.lang a[data-lang]').forEach((a) => {
      const lang = (a.getAttribute("data-lang") || "").toLowerCase();
      if (lang === "en") a.setAttribute("href", enHref);
      if (lang === "es") a.setAttribute("href", esHref);

      const isActive = lang === locale;
      a.classList.toggle("active", isActive);
      if (isActive) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function applyNavLocale(scope) {
    const locale = getLocaleFromPathname();

    // Brand link
    const brand = scope.querySelector(".brand");
    if (brand) {
      brand.setAttribute("href", locale === "es" ? "/es/" : "/home/");
      brand.setAttribute("aria-label", locale === "es" ? "Mindo Bird Watching inicio" : "Mindo Bird Watching home");
    }

    // Header aria labels
    const ariaMap = {
      en: {
        brandHome: "Mindo Bird Watching home",
        langSwitch: "Language switch",
        primaryNav: "Primary",
        openMenu: "Open menu",
        mobileMenu: "Mobile menu",
        langSwitchMobile: "Language switch (mobile)",
        primaryNavMobile: "Primary (mobile)",
      },
      es: {
        brandHome: "Mindo Bird Watching inicio",
        langSwitch: "Selector de idioma",
        primaryNav: "Principal",
        openMenu: "Abrir menú",
        mobileMenu: "Menú móvil",
        langSwitchMobile: "Selector de idioma (móvil)",
        primaryNavMobile: "Principal (móvil)",
      },
    };

    scope.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria");
      const val = (ariaMap[locale] && ariaMap[locale][key]) ? ariaMap[locale][key] : null;
      if (val) el.setAttribute("aria-label", val);
    });

    // Nav links (desktop + mobile)
    scope.querySelectorAll('a.pill[data-href-en][data-href-es]').forEach((a) => {
      const href = locale === "es" ? a.getAttribute("data-href-es") : a.getAttribute("data-href-en");
      if (href) a.setAttribute("href", href);

      const label = locale === "es" ? a.getAttribute("data-label-es") : a.getAttribute("data-label-en");
      if (label) a.textContent = label;
    });
  }

  function setActiveNavPills(scope) {
    const current = normalizePath(window.location.pathname);

    scope.querySelectorAll("nav a.pill").forEach((a) => {
      let linkPath = "/";
      try {
        linkPath = normalizePath(new URL(a.getAttribute("href") || "", window.location.origin).pathname);
      } catch {
        linkPath = normalizePath(a.getAttribute("href") || "/");
      }

      const exact = current === linkPath;
      const section = linkPath !== "/" && current.startsWith(linkPath);
      const active = exact || section;

      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function initHamburger(scope) {
    const btn = scope.querySelector(".menuBtn");
    const panel = scope.querySelector("#menuPanel");
    if (!btn || !panel) return;

    // Prevent duplicate listeners if site.js is executed again
    if (btn.dataset.hamburgerInit === "1") return;
    btn.dataset.hamburgerInit = "1";

    function closeMenu() {
      panel.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }

    btn.addEventListener("click", function () {
      const open = panel.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("click", function (e) {
      if (!panel.classList.contains("is-open")) return;
      const inside = panel.contains(e.target) || btn.contains(e.target);
      if (!inside) closeMenu();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  async function mountIncludes() {
    const headerMount = document.getElementById("siteHeader");
    const footerMount = document.getElementById("siteFooter");

    if (headerMount) {
      const html = await fetchInclude("/assets/includes/header.html");
      headerMount.innerHTML = html;

      // Ensure header is localized and interactive
      applyNavLocale(headerMount);
      setLangSwitchLinks(headerMount);
      setActiveNavPills(headerMount);
      initHamburger(headerMount);
    }

    if (footerMount) {
      const html = await fetchInclude("/assets/includes/footer.html");
      footerMount.innerHTML = html;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    mountIncludes().catch((err) => console.error("[MBW] include load error:", err));
  });
})();
