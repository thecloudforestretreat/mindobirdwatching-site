(function () {
  'use strict';

  var tracked = new Set();

  function trackVideo(iframe) {
    var videoId = iframe.dataset.videoId || '';
    var placement = iframe.dataset.videoPlacement || 'bear_page';
    var key = videoId + ':' + placement;
    if (tracked.has(key)) return;
    tracked.add(key);

    var details = {
      video_provider: 'youtube',
      video_id: videoId,
      video_title: iframe.dataset.videoTitle || iframe.title || '',
      video_placement: placement,
      page_language: document.documentElement.lang || ''
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: 'video_play' }, details));
    if (typeof window.gtag === 'function') window.gtag('event', 'video_play', details);
  }

  var frames = Array.from(document.querySelectorAll('iframe[data-video-track]'));
  if (!frames.length) return;

  var priorReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (typeof priorReady === 'function') priorReady();
    frames.forEach(function (iframe) {
      try {
        new window.YT.Player(iframe, {
          events: {
            onStateChange: function (event) {
              if (event.data === window.YT.PlayerState.PLAYING) trackVideo(iframe);
            }
          }
        });
      } catch (error) {
        /* Playback remains functional if analytics initialization is unavailable. */
      }
    });
  };

  if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
    var api = document.createElement('script');
    api.src = 'https://www.youtube.com/iframe_api';
    api.async = true;
    document.head.appendChild(api);
  } else if (window.YT && window.YT.Player) {
    window.onYouTubeIframeAPIReady();
  }
})();
