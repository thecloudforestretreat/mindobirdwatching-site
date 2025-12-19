/* =========================================================
   MBW Global Site JS
   - Loads global header + footer includes (if mounts exist)
   - Chooses header-en vs header-es based on URL (/es/...)
   - Sets active state for:
     - EN/ES language switch (desktop + mobile)
     - Nav pills (desktop + mobile)
   - Initializes hamburger menu AFTER header is injected
   ========================================================= */

(function () {
  "use strict";

  // ---------- helpers ----------
  function normalizePath(p) {
    try {
      if (!p) return "/";
      // ensure leading slash, remove query/hash, force trailing slash (except root)
      let path = p.split("?")[0].split("#")[0];
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
    // Pull from <link rel="alternate" hreflang="xx" href="...">
    const el = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`);
    if (!el) return null;
    const href = el.getAttribute("href");
    if (!href) return null;
    return href;
  }

  async function fetchInclude(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return await res.text();
  }

  // ---------- active state ----------
  function setActiveLangLinks(scope) {
    const locale = getLocaleFromPathname();
    const enHref = getAlternateHref("en") || "/home/";
    const esHref = getAlternateHref("es") || "/es/";

    const langLinks = scope.querySelectorAll('.lang a[data-lang]');
    langLinks.forEach((a) => {
      const lang = a.getAttribute("data-lang");
      // set correct destination using hreflang alternates
      if (lang === "en") a.setAttribute("href", enHref);
      if (lang === "es") a.setAttribute("href", esHref);

      // active state
      const isActive = lang === locale;
      a.classList.toggle("active", isActive);
      if (isActive) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  function setActiveNavPills(scope) {
    const current = normalizePath(window.location.pathname);

    // Mark active for nav pills in both desktop + mobile
    const pillLinks = scope.querySelectorAll('nav a.pill');

    pillLinks.forEach((a) => {
      let href = a.getAttribute("href") || "";
      // support absolute or relative
      let linkPath = "/";
      try {
        linkPath = normalizePath(new URL(href, window.location.origin).pathname);
      } catch {
        linkPath = normalizePath(href);
      }

      // exact match is best; fallback: current starts with linkPath (for section roots)
      const exact = current === linkPath;
      const section =
        linkPath !== "/" &&
        current.startsWith(linkPath);

      const active = exact || section;
      a.classList.toggle("active", active);
      if (active) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  // ---------- hamburger ----------
  function initHamburger(scope) {
    const btn = scope.querySelector(".menuBtn");
    const panel = scope.querySelector("#menuPanel");

    if (!btn || !panel) return;

    // prevent duplicate listeners if init runs again
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

  // ---------- mounts loader ----------
  async function loadGlobalHeaderFooter() {
    const headerMount = document.getElementById("siteHeader");
    const footerMount = document.getElementById("siteFooter");

    // HEADER
    if (headerMount) {
      const locale = getLocaleFromPathname();
      const headerUrl =
        locale === "es"
          ? "/assets/includes/header-es.html"
          : "/assets/includes/header-en.html";

      const html = await fetchInclude(headerUrl);
      headerMount.innerHTML = html;

      // After injection, initialize behavior + states
      setActiveLangLinks(headerMount);
      setActiveNavPills(headerMount);
      initHamburger(headerMount);
    }

    // FOOTER
    if (footerMount) {
      const html = await fetchInclude("/assets/includes/footer.html");
      footerMount.innerHTML = html;
    }
  }

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", function () {
    loadGlobalHeaderFooter().catch((err) => {
      console.error("[MBW] Include load error:", err);
    });
  });
})();
