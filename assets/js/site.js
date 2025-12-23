/* =========================================================
   MBW Global Site JS (single include system)
   - Loads /assets/includes/header.html into #siteHeader
   - Loads /assets/includes/footer.html into #siteFooter
   - Locale from URL: /es/... => "es", else "en"
   - Updates nav labels + hrefs from data attributes in header.html
   - Sets EN/ES switch hrefs from <link rel="alternate" hreflang="en|es">
   - Sets active nav pill based on window.location.pathname (HOME exact-match only)
   - Initializes hamburger after header is injected
   - Re-hydrates only if the header node itself gets replaced (no subtree loops)
   ========================================================= */

(function () {
  "use strict";

  const HOME_PATHS = new Set(["/", "/home/", "/es/"]);

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
    return p.startsWith("/es/") || p === "/es/" ? "es" : "en";
  }

  function getAlternateHref(lang) {
    const el = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`);
    if (!el) return null;
    const href = el.getAttribute("href");
    return href ? href : null;
  }

  async function fetchInclude(url, timeoutMs = 6000) {
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    } finally {
      window.clearTimeout(t);
    }
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

    const brand = scope.querySelector(".brand");
    if (brand) {
      brand.setAttribute("href", locale === "es" ? "/es/" : "/home/");
      brand.setAttribute(
        "aria-label",
        locale === "es" ? "Mindo Bird Watching inicio" : "Mindo Bird Watching home"
      );
    }

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
      const val = ariaMap[locale]?.[key];
      if (val) el.setAttribute("aria-label", val);
    });

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

      // IMPORTANT: home should NOT be a section match
      const section =
        !HOME_PATHS.has(linkPath) &&
        linkPath !== "/" &&
        current.startsWith(linkPath);

      const active = exact || section;

      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function closeAllMenus() {
    document.querySelectorAll(".menuPanel.is-open").forEach((panel) => panel.classList.remove("is-open"));
    document.querySelectorAll(".menuBtn[aria-expanded='true']").forEach((btn) =>
      btn.setAttribute("aria-expanded", "false")
    );
  }

  function initHamburger(scope) {
    const btn = scope.querySelector(".menuBtn");
    const panel = scope.querySelector("#menuPanel");
    if (!btn || !panel) return;

    if (btn.dataset.hamburgerInit === "1") return;
    btn.dataset.hamburgerInit = "1";

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const willOpen = !panel.classList.contains("is-open");
      closeAllMenus();

      if (willOpen) {
        panel.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
    });

    if (document.documentElement.dataset.mbwHamburgerDoc === "1") return;
    document.documentElement.dataset.mbwHamburgerDoc = "1";

    document.addEventListener("click", function (e) {
      const openPanel = document.querySelector(".menuPanel.is-open");
      if (!openPanel) return;

      const openBtn = document.querySelector(".menuBtn[aria-expanded='true']");
      const inside = openPanel.contains(e.target) || (openBtn && openBtn.contains(e.target));
      if (!inside) closeAllMenus();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllMenus();
    });
  }

  function hydrateHeader(scope) {
    if (!scope || scope.dataset.mbwHydrating === "1") return;
    scope.dataset.mbwHydrating = "1";
    try {
      applyNavLocale(scope);
      setLangSwitchLinks(scope);
      setActiveNavPills(scope);
      initHamburger(scope);
    } finally {
      scope.dataset.mbwHydrating = "0";
    }
  }

  async function mountIncludes() {
    const headerMount = document.getElementById("siteHeader");
    const footerMount = document.getElementById("siteFooter");

    if (headerMount) {
      const hasHeader = !!headerMount.querySelector("header.topbar");
      if (!hasHeader) {
        const html = await fetchInclude("/assets/includes/header.html", 6000);
        if (html) headerMount.innerHTML = html;
      }
      hydrateHeader(headerMount);

      // IMPORTANT: Observe only direct children replacement (no subtree loop)
      if (headerMount.dataset.observeHeader !== "1") {
        headerMount.dataset.observeHeader = "1";
        const mo = new MutationObserver(() => {
          const hdr = headerMount.querySelector("header.topbar");
          if (hdr) hydrateHeader(headerMount);
        });
        mo.observe(headerMount, { childList: true }); // <-- FIX
      }
    }

    if (footerMount) {
      const hasFooter = !!footerMount.querySelector("footer.footer");
      if (!hasFooter) {
        const html = await fetchInclude("/assets/includes/footer.html", 6000);
        if (html) footerMount.innerHTML = html;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    mountIncludes().catch(() => {});
  });
})();
