/* =========================================================
   MBW Global Site JS (Single Source of Truth)
   - Loads /assets/includes/header.html + footer.html (once)
   - Uses page <link rel="alternate" hreflang=".."> for EN/ES links
   - Sets active state for nav + language
   - Initializes hamburger after header injection
   ========================================================= */

(function () {
  "use strict";

  function normalizePath(p) {
    if (!p) return "/";
    let path = String(p).split("?")[0].split("#")[0];
    if (!path.startsWith("/")) path = "/" + path;
    if (path !== "/" && !path.endsWith("/")) path += "/";
    return path;
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

  function setActiveLangLinks(scope) {
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

  function setActiveNavPills(scope) {
    const current = normalizePath(window.location.pathname);

    scope.querySelectorAll('nav a.pill').forEach((a) => {
      const href = a.getAttribute("href") || "/";
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

  function initHamburger(scope) {
    const btn = scope.querySelector(".menuBtn");
    const panel = scope.querySelector("#menuPanel");
    if (!btn || !panel) return;

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

    if (headerMount) {
      const html = await fetchInclude("/assets/includes/header.html");
      headerMount.innerHTML = html;

      setActiveLangLinks(headerMount);
      setActiveNavPills(headerMount);
      initHamburger(headerMount);
    }

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
