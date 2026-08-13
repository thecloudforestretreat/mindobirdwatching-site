(() => {
  "use strict";

  const initialize = (carousel) => {
    if (carousel.dataset.carouselReady === "true") return;

    const slides = Array.from(carousel.querySelectorAll(".carouselSlide"));
    const dots = Array.from(carousel.querySelectorAll(".carouselDot"));
    const previous = carousel.querySelector("[data-carousel-prev]");
    const next = carousel.querySelector("[data-carousel-next]");

    if (slides.length < 2 || dots.length !== slides.length || !previous || !next) return;

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
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        show(current - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        show(current + 1);
      }
    });

    carousel.tabIndex = carousel.hasAttribute("tabindex") ? carousel.tabIndex : 0;
    carousel.dataset.carouselReady = "true";
    show(current);
  };

  const initializeAll = () => document.querySelectorAll("[data-species-carousel]").forEach(initialize);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAll, { once: true });
  } else {
    initializeAll();
  }
})();
