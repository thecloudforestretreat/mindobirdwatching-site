(function(){
  "use strict";

  function initCarousel(root){
    if(!root || root.dataset.speciesCarouselReady === "true") return;

    var slides = Array.prototype.slice.call(root.querySelectorAll(".carouselSlide"));
    var dots = Array.prototype.slice.call(root.querySelectorAll(".carouselDot[data-slide]"));
    var prev = root.querySelector("[data-carousel-prev]");
    var next = root.querySelector("[data-carousel-next]");

    if(!slides.length || dots.length !== slides.length){
      root.dataset.speciesCarouselInvalid = "true";
      return;
    }

    root.dataset.speciesCarouselReady = "true";
    root.setAttribute("tabindex", root.getAttribute("tabindex") || "0");

    var index = slides.findIndex(function(slide){ return slide.classList.contains("active"); });
    if(index < 0) index = 0;

    var startX = 0;
    var startY = 0;

    function show(nextIndex){
      index = (nextIndex + slides.length) % slides.length;

      slides.forEach(function(slide, i){
        var active = i === index;
        slide.classList.toggle("active", active);
        slide.setAttribute("aria-hidden", active ? "false" : "true");
      });

      dots.forEach(function(dot, i){
        var active = i === index;
        dot.classList.toggle("active", active);
        dot.setAttribute("aria-current", active ? "true" : "false");
      });
    }

    if(prev){
      prev.addEventListener("click", function(){ show(index - 1); });
    }

    if(next){
      next.addEventListener("click", function(){ show(index + 1); });
    }

    dots.forEach(function(dot, i){
      dot.addEventListener("click", function(){ show(i); });
    });

    root.addEventListener("keydown", function(event){
      if(event.key === "ArrowLeft"){
        event.preventDefault();
        show(index - 1);
      }else if(event.key === "ArrowRight"){
        event.preventDefault();
        show(index + 1);
      }
    });

    root.addEventListener("touchstart", function(event){
      if(!event.changedTouches || !event.changedTouches.length) return;
      startX = event.changedTouches[0].clientX;
      startY = event.changedTouches[0].clientY;
    }, {passive:true});

    root.addEventListener("touchend", function(event){
      if(!event.changedTouches || !event.changedTouches.length) return;
      var dx = event.changedTouches[0].clientX - startX;
      var dy = event.changedTouches[0].clientY - startY;
      if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)){
        show(index + (dx < 0 ? 1 : -1));
      }
    }, {passive:true});

    show(index);
  }

  function initAll(scope){
    var node = scope || document;

    if(node.matches && node.matches("[data-species-carousel]")){
      initCarousel(node);
    }

    if(node.querySelectorAll){
      node.querySelectorAll("[data-species-carousel]").forEach(initCarousel);
    }
  }

  function boot(){
    initAll(document);

    if("MutationObserver" in window){
      var observer = new MutationObserver(function(mutations){
        mutations.forEach(function(mutation){
          mutation.addedNodes.forEach(function(node){
            if(node && node.nodeType === 1){
              initAll(node);
            }
          });
        });
      });

      observer.observe(document.documentElement, {
        childList:true,
        subtree:true
      });
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  }else{
    boot();
  }
})();
