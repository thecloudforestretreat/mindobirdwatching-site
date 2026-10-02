(function () {
  'use strict';

  function track(eventName, details) {
    var payload = Object.assign({ event: eventName }, details || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, details || {});
    }
  }

  document.querySelectorAll('[data-youtube-lite]').forEach(function (button) {
    button.addEventListener('click', function () {
      var videoId = button.getAttribute('data-video-id');
      var title = button.getAttribute('data-video-title') || 'Mindo Bird Watching video';
      var placement = button.getAttribute('data-video-placement') || 'bear_page';
      if (!videoId) return;

      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId) + '?autoplay=1&rel=0&modestbranding=1';
      iframe.title = title;
      iframe.loading = 'lazy';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      button.replaceWith(iframe);

      track('video_play', {
        video_provider: 'youtube',
        video_id: videoId,
        video_title: title,
        video_placement: placement,
        page_language: document.documentElement.lang || ''
      });
    });
  });

  document.querySelectorAll('[data-bear-media-cta]').forEach(function (link) {
    link.addEventListener('click', function () {
      track(link.getAttribute('data-analytics-event'), {
        link_label: link.getAttribute('data-analytics-label') || link.textContent.trim(),
        link_url: link.href || '',
        page_language: document.documentElement.lang || ''
      });
    });
  });
})();
