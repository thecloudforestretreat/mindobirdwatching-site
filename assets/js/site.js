(function () {
  function normalizePath(p) {
    if (!p) return "/";
    if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
    return p;
  }

  function setActiveNav() {
    const path = normalizePath(window.location.pathname);
    const slug = path.startsWith("/es/") ? path.replace("/es/", "/") : path;

    const keyMap = {
      "/home": "home",
      "/about-us": "about-us",
      "/our-guide": "our-guide",
      "/tours": "tours",
      "/bird-gallery": "bird-gallery",
      "/bird-of-the-week": "bird-of-the-week",
      "/reviews": "reviews",
      "/blog": "blog",
      "/contact": "contact"
    };

    const key = keyMap[slug] || "";

    document.querySelectorAll('[data-mbw-header] .pill').forEach(a => {
      a.classList.remove("active");
      const k = a.getAttribute("data-nav");
      if (k && k === key) a.classList.add("active");
    });
  }

  function setLangSwitch() {
    const path = normalizePath(window.location.pathname);

    const enToEs = {
      "/about-us": "/es/sobre-nosotros",
      "/home": "/es/inicio",
      "/our-guide": "/es/nuestro-guia",
      "/tours": "/es/tours",
      "/bird-gallery": "/es/galeria",
      "/bird-of-the-week": "/es/ave-de-la-semana",
      "/reviews": "/es/resenas",
      "/blog": "/es/blog",
      "/contact": "/es/contacto",
      "/book-tour": "/es/reservar"
    };

    const esToEn = {};
    Object.keys(enToEs).forEach(en => { esToEn[enToEs[en]] = en; });

    const isEs = path.startsWith("/es/");
    const base = normalizePath(isEs ? path.replace(/^\/es/, "") : path);

    const enPath = isEs ? (esToEn[normalizePath(path)] || base) : base;
    const esPath = isEs ? normalizePath(path) : (enToEs[base] || ("/es" + base));

    document.querySelectorAll('[data-mbw-header] [data-lang="en"]').forEach(a => {
      a.href = enPath + "/";
      a.classList.toggle("active", !isEs);
      if (!isEs) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });

    document.querySelectorAll('[data-mbw-header] [data-lang="es"]').forEach(a => {
      a.href = esPath + "/";
      a.classList.toggle("active", isEs);
      if (isEs) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  function initMobileMenu() {
    const root = document.querySelector("[data-mbw-header]");
    if (!root) return;

    const btn = root.querySelector("[data-menu-btn]");
    const closeBtn = root.querySelector("[data-menu-close]");
    const mobile = root.querySelector("[data-mobile]");
    if (!btn || !mobile) return;

    function open() {
      mobile.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    }

    function close() {
      mobile.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }

    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      expanded ? close() : open();
    });

    if (closeBtn) closeBtn.addEventListener("click", close);

    // Close when a mobile link is clicked
    mobile.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.matches && (t.matches("a") || t.closest("a"))) close();
    });

    // Close on escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setActiveNav();
    setLangSwitch();
    initMobileMenu();
  });
})();
