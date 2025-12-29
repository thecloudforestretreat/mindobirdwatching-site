/* =========================================================
   MBW Site JS (Non-header utilities only)
   Version: v2.2 — Header logic moved to includes.js
========================================================= */

(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  ready(function () {
    // Header/menu/lang/nav is handled ONLY in /assets/js/includes.js
  });
})();
