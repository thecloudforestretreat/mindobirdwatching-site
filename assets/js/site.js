/* =========================================================
   MBW Global Site JS (Single approved includes)
   - Loads ONLY:
     /assets/includes/header.html
     /assets/includes/footer.html
   - Sets active state for:
     - Nav pills (desktop + mobile)
     - EN/ES language links (desktop + mobile)
   - Initializes hamburger menu AFTER header is injected
   ========================================================= */

(function () {
  "use strict";

  function normalizePath(p) {
    try {
      if (!p) return "/";
      let path = p.split("?")[0].split("#")[0];
      if (!path.startsWith("/")) path = "/" + path;
      if (path !== "/" && !path.endsWith("/")) path += "/";
      return path;
    } catch {
      return "/";
    }
  }

  function getAlternateHref(lang) {
    const el = document.querySelector(`link[rel="alternate"][hreflang="${lang}"]`);
    if (!el) return null;
    const href = el.getAttribute("href");
    return href || null;
  }

  async function fetchInclude(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return await res.text();
  }

  function setActiveNavPills(scope) {
    const current = normalizePath(window.location.pathname);
    const pillLinks = scope.querySelectorAll("a.pill");

    pillLinks.forEach((a) => {
      let href = a.getAttribute("href") || "";
      let linkPath = "/";

      try {
        linkPath = normalizePath(new URL(href, window.location.origin).pathname);
      } catch {
        linkPath = normalizePath(href);
      }

      const exact = current === linkPath;
      const section = linkPath !== "/" && current.startsWith(linkPath);
      const active = exact || section;

      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function setActiveLangLinks(scope) {
    const path = normalizePath(window.location.pathname);
    const isEs = path.startsWith("/es/");
    const locale = isEs ? "es" : "en";

    const enHref = getAlternateHref("en") || "/home/";
    const esHref = getAlternateHref("es") || "/es/";

    const langLinks = scope.querySelectorAll('.lang a[data-lang]');
    langLinks.forEach((a) => {
      const lang = (a.getAttribute("data-lang") || "").toLowerCase();

      if (lang === "en") a.setAttribute("href", enHref);
      if (lang === "es") a.setAttribute("href", esHref);

      const active = lang === locale;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function initHamburger(scope) {
    const btn = scope.querySelector(".menuBtn");
    const panel = scope.querySelector("#menuPanel");
    if (!btn || !panel) return;

    // Prevent duplicate listeners if script runs twice
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

  async function loadGlobalHeaderFooter() {
    const headerMount = document.getElementById("siteHeader");
    const footerMount = document.getElementById("siteFooter");

    // Header
    if (headerMount) {
      const html = await fetchInclude("/assets/includes/header.html");
      headerMount.innerHTML = html;

      setActiveLangLinks(headerMount);
      setActiveNavPills(headerMount);
      initHamburger(headerMount);
    }

    // Footer
    if (footerMount) {
      const html = await fetchInclude("/assets/includes/footer.html");
      footerMount.innerHTML = html;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadGlobalHeaderFooter().catch((err) => {
      console.error("[MBW] Include load error:", err);
    });
  });
})();
