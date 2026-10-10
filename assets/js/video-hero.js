(() => {
  const hero = document.querySelector('[data-video-hero]');
  if (!hero) return;
  const video = hero.querySelector('video'), poster = hero.querySelector('img'), button = hero.querySelector('button');
  const es = hero.dataset.lang === 'es';
  const labels = es ? ['Reproducir video', 'Pausar video'] : ['Play video', 'Pause video'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let manualPause = false, visible = true, started = false;
  video.muted = true;
  const update = () => { button.textContent = labels[video.paused ? 0 : 1]; };
  const start = () => {
    if (!started) {
      video.src = matchMedia('(max-width:767px)').matches ? '/assets/video/hero-mobile-02.mp4' : '/assets/video/hero-desktop-02.mp4';
      started = true;
    }
    video.play().catch(update);
  };
  const reconcile = () => {
    if (document.hidden || !visible || manualPause || reduced.matches || navigator.connection?.saveData) video.pause();
    else start();
  };
  button.addEventListener('click', () => {
    if (video.paused) { manualPause = false; start(); }
    else { manualPause = true; video.pause(); }
  });
  video.addEventListener('playing', () => { hero.classList.add('is-playing', 'has-frame'); update(); });
  video.addEventListener('pause', () => { hero.classList.remove('is-playing'); update(); });
  video.addEventListener('error', () => { hero.classList.remove('is-playing', 'has-frame'); button.hidden = true; });
  document.addEventListener('visibilitychange', reconcile);
  reduced.addEventListener('change', reconcile);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (button.hidden === false) reconcile(); }, {threshold: .05}).observe(hero);
  const ready = () => { button.hidden = false; requestAnimationFrame(() => requestAnimationFrame(reconcile)); };
  if (poster.complete) ready(); else poster.addEventListener('load', ready, {once:true});
})();
