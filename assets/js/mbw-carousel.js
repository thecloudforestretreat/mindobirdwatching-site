/* MBW Global Carousel Controls
   Requires: data-mbw-carousel on the carousel shell.
   Supports: arrows, dots, autoplay, pause on hover/focus, keyboard arrows and touch swipe.
*/
(function(){
  function ready(fn){
    if(document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function(){
    var carousels = document.querySelectorAll('[data-mbw-carousel]');

    carousels.forEach(function(carousel){
      var track = carousel.querySelector('.mbwCarouselTrack, .wildlifeCarouselTrack');
      if(!track) return;

      var slides = Array.prototype.slice.call(track.children);
      if(slides.length <= 1) return;

      var dotsWrap = carousel.querySelector('.mbwCarouselDots, .wildlifeCarouselDots');
      var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.querySelectorAll('span, button')) : [];
      var prev = carousel.querySelector('[data-mbw-carousel-prev]');
      var next = carousel.querySelector('[data-mbw-carousel-next]');
      var index = 0;
      var timer = null;
      var delay = parseInt(carousel.getAttribute('data-mbw-carousel-delay') || '6500', 10);
      var autoplay = carousel.getAttribute('data-mbw-carousel-autoplay') !== 'false';
      var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function render(){
        track.style.transform = 'translateX(' + (-index * 100) + '%)';
        dots.forEach(function(dot, i){
          dot.classList.toggle('is-active', i === index);
          dot.setAttribute('aria-current', i === index ? 'true' : 'false');
        });
      }

      function go(nextIndex){
        index = (nextIndex + slides.length) % slides.length;
        render();
      }

      function stop(){
        if(timer){
          window.clearInterval(timer);
          timer = null;
        }
      }

      function start(){
        stop();
        if(!autoplay || prefersReducedMotion) return;
        timer = window.setInterval(function(){ go(index + 1); }, delay);
      }

      if(prev){
        prev.addEventListener('click', function(){
          go(index - 1);
          start();
        });
      }

      if(next){
        next.addEventListener('click', function(){
          go(index + 1);
          start();
        });
      }

      dots.forEach(function(dot, i){
        dot.setAttribute('role', 'button');
        dot.setAttribute('tabindex', '0');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', function(){ go(i); start(); });
        dot.addEventListener('keydown', function(e){
          if(e.key === 'Enter' || e.key === ' '){
            e.preventDefault();
            go(i);
            start();
          }
        });
      });

      carousel.addEventListener('mouseenter', stop);
      carousel.addEventListener('mouseleave', start);
      carousel.addEventListener('focusin', stop);
      carousel.addEventListener('focusout', start);

      carousel.setAttribute('tabindex', carousel.getAttribute('tabindex') || '0');
      carousel.addEventListener('keydown', function(e){
        if(e.key === 'ArrowLeft'){
          e.preventDefault();
          go(index - 1);
          start();
        }
        if(e.key === 'ArrowRight'){
          e.preventDefault();
          go(index + 1);
          start();
        }
      });

      var touchStartX = null;
      carousel.addEventListener('touchstart', function(e){
        if(!e.touches || !e.touches.length) return;
        touchStartX = e.touches[0].clientX;
        stop();
      }, {passive:true});

      carousel.addEventListener('touchend', function(e){
        if(touchStartX === null || !e.changedTouches || !e.changedTouches.length) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        if(Math.abs(dx) > 42){
          go(dx > 0 ? index - 1 : index + 1);
        }
        touchStartX = null;
        start();
      }, {passive:true});

      render();
      start();
    });
  });
})();
