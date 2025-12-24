/* =========================================================
   MBW Includes Loader (v1)
   - Injects /assets/includes/header.html into #siteHeader
   - Injects /assets/includes/footer.html into #siteFooter
   - Then dispatches: window event "mbw:includes:ready"
   ========================================================= */
(function () {
  "use strict";

  async function inject(id, url) {
    const el = document.getElementById(id);
    if (!el) return;
    const res = await fetch(url, { cache: "no-store" });
    el.innerHTML = await res.text();
  }

  Promise.all([
    inject("siteHeader", "/assets/includes/header.html"),
    inject("siteFooter", "/assets/includes/footer.html"),
  ]).then(() => {
    window.dispatchEvent(new Event("mbw:includes:ready"));
  });
})();
