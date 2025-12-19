(function () {
  const path = (location.pathname || "/").replace(/\/+$/, "") || "/";
  const links = document.querySelectorAll('[data-nav] a');

  links.forEach(a => {
    const href = (a.getAttribute("href") || "").replace(/\/+$/, "") || "/";
    if (href === path) a.classList.add("active");
  });
})();
