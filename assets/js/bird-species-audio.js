(() => {
  "use strict";
  const track = (audio) => {
    if (audio.dataset.analyticsPlayed === "true") return;
    audio.dataset.analyticsPlayed = "true";
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: audio.dataset.analyticsEvent || "bird_audio_play",
      analytics_label: audio.dataset.analyticsLabel || "",
      bird_name: audio.dataset.analyticsBird || "",
      location: audio.dataset.analyticsLocation || "species_audio",
      page_language: audio.dataset.analyticsPageLanguage || document.documentElement.lang || "",
      page_path: window.location.pathname
    });
  };
  const init = () => document.querySelectorAll("[data-bird-audio]").forEach((audio) => {
    if (audio.dataset.audioReady === "true") return;
    audio.dataset.audioReady = "true";
    audio.addEventListener("play", () => track(audio));
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
