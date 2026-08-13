(function () {
  "use strict";

  var pages = [
    { id: "admin", label: "Admin Hub", href: "https://admin.mindobirdwatching.com/" },
    { id: "guest-crm", label: "Guest CRM", href: "https://admin.mindobirdwatching.com/guest-crm/" },
    { id: "email", label: "Email Generator", href: "https://admin.mindobirdwatching.com/custom-email-generator/" },
    { id: "staff", label: "Staff Info", href: "https://admin.mindobirdwatching.com/staff-info/" },
    { id: "itinerary", label: "Itinerary", href: "https://admin.mindobirdwatching.com/itinerary-generator/" },
    { id: "zelle", label: "Zelle Invoice", href: "https://admin.mindobirdwatching.com/zelle-invoice-generator/" },
    {
      id: "stripe",
      label: "Stripe Invoice",
      href: "https://mindobirdwatching.com/book-tour/create/",
      external: true
    },
    { id: "confirmation", label: "Tour Confirmation", href: "https://admin.mindobirdwatching.com/tour-confirmation-generator/" },
    { id: "reports", label: "Reports", href: "https://admin.mindobirdwatching.com/reports/" }
  ];

  function normalizePath(pathname) {
    var path = pathname || "/";
    if (!path.endsWith("/")) path += "/";
    return path;
  }

  function currentPageId(host) {
    if (host.dataset.adminPage) return host.dataset.adminPage;

    var path = normalizePath(window.location.pathname);
    if (path === "/") return "admin";

    for (var i = 0; i < pages.length; i += 1) {
      if (!pages[i].external && normalizePath(new URL(pages[i].href).pathname) === path) {
        return pages[i].id;
      }
    }

    return "";
  }

  function makeLink(page, activeId) {
    var link = document.createElement("a");
    link.className = "adminGlobalNav__link" + (page.external ? " adminGlobalNav__external" : "");
    link.href = page.href;
    link.textContent = page.label;

    if (page.id === activeId) {
      link.setAttribute("aria-current", "page");
      link.addEventListener("click", function (event) {
        event.preventDefault();
      });
    } else if (page.id !== "admin") {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    return link;
  }

  function render(host) {
    if (host.dataset.adminNavReady === "true") return;

    var activeId = currentPageId(host);
    var nav = document.createElement("nav");
    var inner = document.createElement("div");
    var label = document.createElement("span");
    var logo = document.createElement("img");
    var brandText = document.createElement("span");
    var links = document.createElement("div");

    nav.className = "adminGlobalNav";
    nav.setAttribute("aria-label", "Admin pages");
    inner.className = "adminGlobalNav__inner";
    label.className = "adminGlobalNav__label";
    logo.className = "adminGlobalNav__logo";
    logo.src = "https://mindobirdwatching.com/assets/images/logo/mbw-logo-mark-1024.png";
    logo.alt = "";
    brandText.textContent = "MBW Admin";
    label.appendChild(logo);
    label.appendChild(brandText);
    links.className = "adminGlobalNav__links";

    pages.forEach(function (page) {
      links.appendChild(makeLink(page, activeId));
    });

    inner.appendChild(label);
    inner.appendChild(links);
    nav.appendChild(inner);
    host.appendChild(nav);
    host.dataset.adminNavReady = "true";
  }

  function init() {
    var hosts = document.querySelectorAll("[data-admin-nav]");
    hosts.forEach(render);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
