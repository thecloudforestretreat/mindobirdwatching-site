/* /assets/js/site.js
   MBW shared behavior:
   - Normalize desktop and mobile nav ordering across all pages
   - Set active nav pill based on current path
*/

(function () {
  // ===== CONFIG: NAV ORDER =====
  // Desktop order
  const DESKTOP_ORDER = [
    "/home",
    "/about-us",
    "/our-guide",
    "/tours",
    "/bird-gallery",
    "/bird-of-the-week",
    "/book-tour",
    "/contact",
  ];

  // Mobile rows (2 rows)
  const MOBILE_ROWS = [
    ["/home", "/about-us", "/our-guide", "/contact"],
    ["/tours", "/bird-gallery", "/book-tour", "/bird-of-the-week"],
  ];

  // ===== HELPERS =====
  function normalizePath(path) {
    if (!path) return "/";
    // Ensure leading slash
    if (!path.startsWith("/")) path = "/" + path;

    // Strip query/hash
    path = path.split("?")[0].split("#")[0];

    // Remove trailing slash except root
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

    return path;
  }

  function getCurrentPath() {
    return normalizePath(window.location.pathname || "/");
  }

  function mapAnchorsByHref(container) {
    const map = new Map();
    const anchors = Array.from(container.querySelectorAll("a[href]"));

    anchors.forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      const key = normalizePath(href);
      // If duplicates exist, keep first
      if (!map.has(key)) map.set(key, a);
    });

    return map;
  }

  function clearActive(container) {
    Array.from(container.querySelectorAll(".pill.active")).forEach((el) =>
      el.classList.remove("active")
    );
  }

  function setActive(container, currentPath) {
    // mark exact match active
    const anchors = Array.from(container.querySelectorAll("a[href]"));
    anchors.forEach((a) => {
      const href = normalizePath(a.getAttribute("href"));
      if (href === currentPath) a.classList.add("active");
    });
  }

  function reorderNav(container, desiredOrder) {
    if (!container) return;

    const byHref = mapAnchorsByHref(container);
    const originalAnchors = Array.from(container.querySelectorAll("a[href]"));

    // Build final list:
    // 1) desired in order (if present)
    // 2) then any extras that were not part of desiredOrder (keep original order)
    const used = new Set();
    const finalAnchors = [];

    desiredOrder.forEach((href) => {
      const key = normalizePath(href);
      const a = byHref.get(key);
      if (a) {
        finalAnchors.push(a);
        used.add(a);
      }
    });

    originalAnchors.forEach((a) => {
      if (!used.has(a)) finalAnchors.push(a);
    });

    // Apply: wipe and re-append
    container.innerHTML = "";
    finalAnchors.forEach((a) => container.appendChild(a));
  }

  function rebuildMobileNav(navMobile) {
    if (!navMobile) return;

    const byHref = mapAnchorsByHref(navMobile);

    // Create rows if missing
    let rows = Array.from(navMobile.querySelectorAll(".nav-row"));
    if (rows.length < 2) {
      navMobile.innerHTML = "";
      for (let i = 0; i < 2; i++) {
        const row = document.createElement("div");
        row.className = "nav-row";
        navMobile.appendChild(row);
      }
      rows = Array.from(navMobile.querySelectorAll(".nav-row"));
    }

    // Keep any existing anchors to append later as extras
    const allExisting = Array.from(navMobile.querySelectorAll("a[href]"));

    // Fill each row based on MOBILE_ROWS
    rows.forEach((row) => (row.innerHTML = ""));

    const used = new Set();

    MOBILE_ROWS.forEach((rowLinks, rowIndex) => {
      const row = rows[rowIndex];
      if (!row) return;

      rowLinks.forEach((href) => {
        const key = normalizePath(href);
        const a = byHref.get(key);
        if (a) {
          row.appendChild(a);
          used.add(a);
        }
      });
    });

    // Append extras (anchors not in configured rows) to the last row
    const lastRow = rows[rows.length - 1];
    allExisting.forEach((a) => {
      if (!used.has(a) && lastRow) lastRow.appendChild(a);
    });
  }

  // ===== RUN =====
  function initNav() {
    const currentPath = getCurrentPath();

    // Desktop
    const navDesktop = document.querySelector("nav.nav[data-nav]");
    if (navDesktop) {
      reorderNav(navDesktop, DESKTOP_ORDER);
      clearActive(navDesktop);
      setActive(navDesktop, currentPath);
    }

    // Mobile
    const navMobile = document.querySelector("nav.nav-mobile[data-nav]");
    if (navMobile) {
      rebuildMobileNav(navMobile);
      clearActive(navMobile);
      setActive(navMobile, currentPath);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNav);
  } else {
    initNav();
  }
})();
