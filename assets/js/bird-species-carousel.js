(() => {
  "use strict";

  const SELECTOR = "[data-species-carousel]";

  const initialize = (carousel) => {
    if (!(carousel instanceof HTMLElement) || carousel.dataset.carouselReady === "true") return;

    const slides = Array.from(carousel.querySelectorAll(".carouselSlide"));
    const dots = Array.from(carousel.querySelectorAll(".carouselDot"));
    const previous = carousel.querySelector("[data-carousel-prev]");
    const next = carousel.querySelector("[data-carousel-next]");

    if (slides.length < 2 || dots.length !== slides.length || !previous || !next) {
      carousel.dataset.carouselError = "invalid-markup";
      return;
    }

    let current = Math.max(0, slides.findIndex((slide) => slide.classList.contains("active")));

    const show = (requested) => {
      current = (requested + slides.length) % slides.length;
      slides.forEach((slide, index) => {
        const active = index === current;
        slide.classList.toggle("active", active);
        slide.setAttribute("aria-hidden", String(!active));
      });
      dots.forEach((dot, index) => {
        const active = index === current;
        dot.classList.toggle("active", active);
        dot.setAttribute("aria-current", active ? "true" : "false");
      });
    };

    previous.addEventListener("click", () => show(current - 1));
    next.addEventListener("click", () => show(current + 1));
    dots.forEach((dot, index) => dot.addEventListener("click", () => show(index)));
    carousel.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      show(current + (event.key === "ArrowRight" ? 1 : -1));
    });

    if (!carousel.hasAttribute("tabindex")) carousel.tabIndex = 0;
    carousel.dataset.carouselReady = "true";
    delete carousel.dataset.carouselError;
    show(current);
  };

  const initializeWithin = (root = document) => {
    if (root.matches?.(SELECTOR)) initialize(root);
    root.querySelectorAll?.(SELECTOR).forEach(initialize);
  };

  const start = () => {
    initializeWithin();
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) initializeWithin(node);
      }));
    }).observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
