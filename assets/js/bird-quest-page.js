(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function text(value) { return value === null || value === undefined ? "" : String(value); }
  function track(eventName, params) {
    params = params || {};
    if (window.gtag) window.gtag("event", eventName, params);
    window.dispatchEvent(new CustomEvent("mbw_analytics_event", { detail: { event: eventName, params: params } }));
  }

  var dataEl = $("birdQuestData");
  if (!dataEl) return;

  function normalizeBirdData(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.birds)) return payload.birds;
    return [];
  }
  function embeddedBirdData() {
    try {
      return normalizeBirdData(JSON.parse(dataEl.textContent || "[]"));
    } catch (error) {
      return [];
    }
  }
  function loadBirdData() {
    var src = dataEl.getAttribute("data-src");
    var fallback = embeddedBirdData();
    if (!src || !window.fetch) return Promise.resolve({ birds: fallback, source: "embedded" });
    return fetch(src, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Bird Quest data request failed: " + response.status);
        return response.json();
      })
      .then(function (payload) {
        var remoteBirds = normalizeBirdData(payload);
        return { birds: remoteBirds.length ? remoteBirds : fallback, source: remoteBirds.length ? "json" : "embedded" };
      })
      .catch(function (error) {
        track("bird_quest_data_load_error", { page_path: window.location.pathname, message: error.message });
        return { birds: fallback, source: "embedded" };
      });
  }

  loadBirdData().then(function (loaded) {
  var birds = loaded.birds || [];
  var dataSource = loaded.source || "embedded";
  var validCodes = new Set(birds.map(function (bird) { return bird.code; }));
  spotted = new Set(Array.from(spotted).filter(function (code) { return validCodes.has(code); }));
  try { localStorage.setItem(storageKey, JSON.stringify(Array.from(spotted))); } catch (error) {}
  var body = document.body;
  var lang = (body.getAttribute("data-page-language") || document.documentElement.lang || "en").toLowerCase() === "es" ? "es" : "en";
  var grid = $("birdQuestGrid");
  var modal = $("birdQuestModal");
  var search = $("birdQuestSearch");
  var kidToggle = $("birdQuestKidToggle");
  var emptyState = $("birdQuestEmpty");
  var storageKey = "mbwBirdQuestSpotted";
  var storageVersionKey = "mbwBirdQuestSpottedVersion";
  var storageVersion = "2";
  var filter = "all";
  var kidMode = false;
  var spotted = new Set();
  var completedTracked = false;
  try {
    if (localStorage.getItem(storageVersionKey) !== storageVersion) {
      localStorage.setItem(storageVersionKey, storageVersion);
    }
    spotted = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
  } catch (error) {
    spotted = new Set();
  }

  function local(en, es) { return lang === "es" ? (es || en) : en; }
  function baseParams(extra) {
    var params = {
      page_path: window.location.pathname,
      page_language: lang,
      data_source: dataSource,
      bird_count: birds.length,
      spotted_count: spotted.size,
      quest_points: birds.filter(function (b) { return spotted.has(b.code); }).reduce(function (sum, b) { return sum + Number(b.points || 0); }, 0)
    };
    extra = extra || {};
    Object.keys(extra).forEach(function (key) { params[key] = extra[key]; });
    return params;
  }
  function isDirectImageUrl(url) {
    url = text(url).trim();
    if (!url) return false;
    if (/media\.ebird\.org\/catalog/i.test(url)) return false;
    return /\/wiki\/Special:FilePath\//i.test(url) || /\.(avif|gif|jpe?g|png|webp)(\?|#|$)/i.test(url);
  }
  function imageMarkup(image, alt, eager) {
    if (!image || !isDirectImageUrl(image.url)) {
      return '<div class="birdQuestImagePlaceholder" aria-hidden="true">' + local('Image coming soon', 'Imagen próximamente') + '</div>';
    }
    return '<img src="' + image.url + '" alt="' + alt + '"' + (eager ? '' : ' loading="lazy" decoding="async"') + '>';
  }
  function imagesForBird(bird) {
    return (bird.images || []).filter(function (image) { return image && isDirectImageUrl(image.url); });
  }
  function metaTag(labelText, valueText, tone) {
    return '<span class="birdQuestTag ' + tone + '"><small>' + labelText + '</small><strong>' + valueText + '</strong></span>';
  }
  function label(value) {
    var labels = {
      both: ["Half + Full Day", "Medio + Día Completo"],
      full_day: ["Full Day", "Día Completo"],
      half_day: ["Half Day", "Medio Día"],
      custom_only: ["Custom", "Personalizado"],
      morning: ["Morning", "Mañana"],
      dawn: ["Dawn", "Amanecer"],
      early_morning: ["Early Morning", "Temprano"],
      easy: ["Easy", "Fácil"],
      moderate: ["Moderate", "Moderado"],
      hard: ["Hard", "Difícil"],
      specialist: ["Specialist", "Especialista"],
      hummingbird: ["Hummingbird", "Colibrí"],
      tanager: ["Tanager", "Tangara"],
      quetzal: ["Quetzal", "Quetzal"],
      toucan: ["Toucan", "Tucán"],
      manakin: ["Manakin", "Saltarín"],
      forest_color: ["Forest Color", "Color del Bosque"],
      icon: ["Icon", "Ícono"]
    };
    return labels[value] ? local(labels[value][0], labels[value][1]) : text(value).replace(/_/g, " ");
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(Array.from(spotted))); } catch (error) {}
    updateProgress();
    if (!completedTracked && birds.length && spotted.size === birds.length) {
      completedTracked = true;
      track('bird_quest_completed', baseParams());
    }
  }
  function pointsTotal() {
    return birds.filter(function (b) { return spotted.has(b.code); }).reduce(function (sum, b) { return sum + Number(b.points || 0); }, 0);
  }
  function questRank(points) {
    if (points >= 900) return local("Cloud Forest Master", "Maestro del Bosque");
    if (points >= 500) return local("Rare Bird Tracker", "Rastreador de Aves Raras");
    if (points >= 250) return local("Field Explorer", "Explorador de Campo");
    if (points > 0) return local("First Catch", "Primera Captura");
    return local("Quest Ready", "Reto Listo");
  }
  function ensureHud() {
    var hud = $("birdQuestHud");
    if (hud) return hud;
    document.body.insertAdjacentHTML("beforeend",
      '<aside class="birdQuestHud" id="birdQuestHud" aria-live="polite">' +
        '<button class="birdQuestHudMain" type="button" data-scroll-grid>' +
          '<span class="birdQuestHudRing"><strong id="birdQuestHudCaught">0</strong><small id="birdQuestHudTotal">/' + birds.length + '</small></span>' +
          '<span class="birdQuestHudText"><strong id="birdQuestHudRank">' + questRank(0) + '</strong><small><span id="birdQuestHudPoints">0</span> ' + local("pts", "pts") + '</small></span>' +
        '</button>' +
      '</aside>'
    );
    return $("birdQuestHud");
  }
  function showToast(message, detail) {
    var toast = $("birdQuestToast");
    if (!toast) {
      document.body.insertAdjacentHTML("beforeend", '<div class="birdQuestToast" id="birdQuestToast" role="status" aria-live="polite"></div>');
      toast = $("birdQuestToast");
    }
    toast.innerHTML = '<strong>' + message + '</strong>' + (detail ? '<span>' + detail + '</span>' : '');
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.classList.remove("is-visible"); }, 2200);
  }
  function updateProgress() {
    var count = spotted.size;
    var total = birds.length || 1;
    var points = pointsTotal();
    if ($("birdQuestProgressCount")) $("birdQuestProgressCount").textContent = count + "/" + birds.length;
    if ($("birdQuestTotalPoints")) $("birdQuestTotalPoints").textContent = points;
    if ($("birdQuestSpeciesCount")) $("birdQuestSpeciesCount").textContent = birds.length;
    if ($("birdQuestAudioCount")) $("birdQuestAudioCount").textContent = birds.filter(function (b) { return b.audio; }).length;
    if ($("birdQuestProgressRing")) $("birdQuestProgressRing").style.setProperty("--progress", ((count / total) * 100) + "%");
    ensureHud();
    if ($("birdQuestHud")) $("birdQuestHud").style.setProperty("--progress", ((count / total) * 100) + "%");
    if ($("birdQuestHudCaught")) $("birdQuestHudCaught").textContent = count;
    if ($("birdQuestHudTotal")) $("birdQuestHudTotal").textContent = "/" + birds.length;
    if ($("birdQuestHudPoints")) $("birdQuestHudPoints").textContent = points;
    if ($("birdQuestHudRank")) $("birdQuestHudRank").textContent = questRank(points);
  }
  function matches(bird) {
    var q = search ? search.value.trim().toLowerCase() : "";
    var haystack = [bird.nameEn, bird.nameEs, bird.scientific, bird.habitat, bird.routeNameEn, bird.routeNameEs, bird.badge, bird.rarity, bird.tourVisibility].join(" ").toLowerCase();
    if (q && haystack.indexOf(q) === -1) return false;
    if (filter === "all") return true;
    if (filter === "spotted") return spotted.has(bird.code);
    if (filter === "special") return ["special", "legendary"].indexOf(bird.rarity) !== -1 || Number(bird.points || 0) >= 55;
    return bird.badge === filter || bird.tourVisibility === filter;
  }
  function card(bird) {
    var isSpotted = spotted.has(bird.code);
    var image = imagesForBird(bird)[0] || (bird.images && bird.images[0]) || { url: "", altEn: bird.nameEn, altEs: bird.nameEs };
    var imageAlt = local(image.altEn, image.altEs);
    var previewFact = kidMode ? local(bird.kidFactEn, bird.kidFactEs) : ((local(bird.factsEn, bird.factsEs) || [])[0] || local(bird.idTipEn, bird.idTipEs));
    var imageCount = imagesForBird(bird).length;
    return '<article class="birdQuestCard' + (isSpotted ? ' is-spotted' : '') + '" data-code="' + bird.code + '">' +
      '<div class="birdQuestThumb' + (isDirectImageUrl(image.url) ? '' : ' is-image-missing') + '">' + imageMarkup(image, imageAlt, false) + '<div class="birdQuestBadges"><span class="birdQuestBadge ' + bird.badge + '">' + label(bird.badge) + '</span><span class="birdQuestPoints">' + bird.points + ' pts</span></div>' + (imageCount > 1 ? '<button class="birdQuestPhotoCount" type="button" data-open-bird="' + bird.code + '" aria-label="' + local('Open photo gallery', 'Abrir galería de fotos') + '">' + imageCount + ' ' + local('photos', 'fotos') + '</button>' : '') + '</div>' +
      '<div class="birdQuestCardBody"><div class="birdQuestName"><h2>' + local(bird.nameEn, bird.nameEs) + '</h2><span class="birdQuestAlt">' + local(bird.nameEs, bird.nameEn) + '</span><span class="birdQuestSci">' + bird.scientific + '</span></div>' +
      '<p class="birdQuestPreviewFact">' + previewFact + '</p>' +
      '<div class="birdQuestMeta">' + metaTag(local('Route', 'Ruta'), label(bird.tourVisibility), 'route') + metaTag(local('Level', 'Nivel'), label(bird.difficulty), 'level') + '</div>' +
      '<div class="birdQuestCardActions"><button class="btn secondary" type="button" data-open-bird="' + bird.code + '">' + local('Facts + Call', 'Datos + Canto') + '</button><button class="btn" type="button" data-spot-bird="' + bird.code + '" aria-pressed="' + isSpotted + '" title="' + local('Mark spotted', 'Marcar visto') + '">' + (isSpotted ? '✓' : '+') + '</button></div></div></article>';
  }
  function render() {
    var shown = birds.filter(matches);
    if (grid) grid.innerHTML = shown.map(card).join("");
    if (emptyState) emptyState.classList.toggle("is-visible", shown.length === 0);
  }
  function openBird(code, imageIndex) {
    var bird = birds.find(function (b) { return b.code === code; });
    if (!bird || !modal) return;
    var galleryImages = imagesForBird(bird);
    var image = galleryImages[imageIndex || 0] || (bird.images && bird.images[0]) || { url: "", altEn: bird.nameEn, altEs: bird.nameEs, credit: "" };
    imageIndex = Math.max(0, Math.min(Number(imageIndex || 0), Math.max(galleryImages.length - 1, 0)));
    var imageAlt = local(image.altEn, image.altEs);
    var facts = (kidMode ? [local(bird.kidFactEn, bird.kidFactEs), local(bird.idTipEn, bird.idTipEs), local(bird.unlockEn, bird.unlockEs)] : local(bird.factsEn, bird.factsEs)).filter(Boolean);
    var isSpotted = spotted.has(bird.code);
    var elevation = bird.elevationMinM && bird.elevationMaxM ? bird.elevationMinM + "-" + bird.elevationMaxM + " m" : local("Guide review", "Revisión del guía");
    modal.innerHTML = '<div class="birdQuestModalShell"><button class="birdQuestModalClose" type="button" data-close-bird aria-label="' + local('Close bird details', 'Cerrar detalles del ave') + '">×</button><section class="birdQuestGallery' + (isDirectImageUrl(image.url) ? '' : ' is-image-missing') + '"><div class="birdQuestGalleryMain">' + imageMarkup(image, imageAlt, true) + '</div>' + (galleryImages.length > 1 ? '<div class="birdQuestGalleryThumbs">' + galleryImages.map(function (thumb, i) { return '<button type="button" data-gallery-bird="' + bird.code + '" data-gallery-index="' + i + '" aria-pressed="' + (i === imageIndex) + '"><img src="' + thumb.url + '" alt=""></button>'; }).join('') + '</div>' : '') + '<div class="birdQuestGalleryBar"><small>' + (isDirectImageUrl(image.url) ? ((image.credit || local('Image credit pending review', 'Crédito de imagen por revisar')) + (galleryImages.length > 1 ? ' · ' + (imageIndex + 1) + '/' + galleryImages.length : '')) : local('Photo will be added after image review', 'La foto se agregará después de revisar la imagen')) + '</small><button class="btn" type="button" data-close-bird>' + local('Close', 'Cerrar') + '</button></div></section>' +
      '<section class="birdQuestDetail"><div class="birdQuestDetailTop"><div><h2>' + local(bird.nameEn, bird.nameEs) + '</h2><div class="birdQuestAlt">' + local(bird.nameEs, bird.nameEn) + ' · <span class="birdQuestSci">' + bird.scientific + '</span></div></div><span class="birdQuestDetailPoints">' + bird.points + '<small>pts</small></span></div>' +
      '<h3 class="birdQuestDetailLabel">' + local('Fun facts', 'Datos curiosos') + '</h3><ul class="birdQuestFactList">' + facts.map(function (fact) { return '<li>' + fact + '</li>'; }).join('') + '</ul>' +
      '<div class="birdQuestDetailMeta"><span><strong>' + local('Family', 'Familia') + '</strong>' + (bird.family || local('Guide review', 'Revisión del guía')) + '</span><span><strong>' + local('Elevation', 'Elevación') + '</strong>' + elevation + '</span></div>' +
      '<div class="birdQuestInfoBlock"><strong>' + local('Where to look', 'Dónde buscar') + '</strong>' + local(bird.whereEn, bird.whereEs) + '</div>' +
      '<div class="birdQuestInfoBlock"><strong>' + local('Listen to the call', 'Escucha el canto') + '</strong>' + local(bird.audioCaptionEn, bird.audioCaptionEs) + (bird.audio ? '<audio controls preload="none" src="' + bird.audio + '"></audio>' : '') + '<div class="birdQuestCredit">' + bird.audioCredit + '</div></div>' +
      '<div class="birdQuestActions"><button class="btn primary" type="button" data-spot-bird="' + bird.code + '" aria-pressed="' + isSpotted + '">' + (isSpotted ? local('Spotted', 'Visto') : local('Mark as Spotted', 'Marcar como visto')) + '</button>' + (bird.ebird ? '<a class="btn secondary" href="' + bird.ebird + '" target="_blank" rel="noreferrer">eBird</a>' : '') + '</div></section></div>';
    if (!modal.open) modal.showModal();
    var audio = modal.querySelector("audio");
    if (audio) audio.addEventListener("play", function () { track('bird_quest_audio_play', baseParams({ species_code: bird.code, bird_name: local(bird.nameEn, bird.nameEs) })); }, { once: true });
    track('bird_quest_open_species', baseParams({ bird_name: local(bird.nameEn, bird.nameEs), species_code: bird.code, image_index: imageIndex + 1, image_count: galleryImages.length || 0 }));
  }
  document.addEventListener("click", function (event) {
    var open = event.target.closest("[data-open-bird]");
    if (open) { openBird(open.getAttribute("data-open-bird")); return; }
    var gallery = event.target.closest("[data-gallery-bird]");
    if (gallery) {
      var galleryCode = gallery.getAttribute("data-gallery-bird");
      var galleryIndex = Number(gallery.getAttribute("data-gallery-index") || 0);
      openBird(galleryCode, galleryIndex);
      track('bird_quest_gallery_image_select', baseParams({ species_code: galleryCode, image_index: galleryIndex + 1 }));
      return;
    }
    var spot = event.target.closest("[data-spot-bird]");
    if (spot) {
      var code = spot.getAttribute("data-spot-bird");
      var bird = birds.find(function (b) { return b.code === code; });
      var nowSpotted = !spotted.has(code);
      if (nowSpotted) spotted.add(code); else spotted.delete(code);
      save(); render();
      if (modal.open) modal.close();
      showToast(
        nowSpotted ? local("Bird caught", "Ave capturada") : local("Removed from quest", "Quitada del reto"),
        bird ? local(bird.nameEn, bird.nameEs) + " · " + pointsTotal() + " " + local("pts", "pts") : ""
      );
      track('bird_quest_spotted_toggle', baseParams({ species_code: code, spotted: spotted.has(code) }));
      return;
    }
    var close = event.target.closest("[data-close-bird]");
    if (close) { track('bird_quest_modal_close', baseParams()); modal.close(); return; }
    var ebirdLink = event.target.closest(".birdQuestActions a[href*='ebird.org']");
    if (ebirdLink) { track('bird_quest_ebird_click', baseParams({ target_url: ebirdLink.href })); return; }
    var chip = event.target.closest("[data-filter]");
    if (chip) {
      filter = chip.getAttribute("data-filter");
      document.querySelectorAll("[data-filter]").forEach(function (button) { button.setAttribute("aria-pressed", String(button === chip)); });
      render(); track('bird_quest_filter', baseParams({ filter: filter })); return;
    }
    if (event.target.closest("[data-reset-quest]")) { spotted = new Set(); completedTracked = false; save(); render(); track('bird_quest_reset', baseParams()); return; }
    if (event.target.closest("[data-scroll-grid]")) { track('bird_quest_start_click', baseParams()); grid.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  if (search) {
    var searchTimer = null;
    search.addEventListener("input", function () {
      render();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { track('bird_quest_search', baseParams({ search_length: search.value.trim().length, has_search: search.value.trim().length > 0 })); }, 700);
    });
  }
  if (kidToggle) kidToggle.addEventListener("click", function () { kidMode = !kidMode; kidToggle.setAttribute("aria-pressed", String(kidMode)); kidToggle.textContent = kidMode ? local('Guide Mode', 'Modo guía') : local('Kid Mode', 'Modo niños'); if (modal.open) modal.close(); track('bird_quest_kid_mode', baseParams({ enabled: kidMode })); });
  if (modal) modal.addEventListener("click", function (event) { if (event.target === modal) { track('bird_quest_modal_close', baseParams({ close_method: 'backdrop' })); modal.close(); } });
  document.addEventListener("error", function (event) {
    if (!event.target || event.target.tagName !== "IMG") return;
    var holder = event.target.closest(".birdQuestThumb, .birdQuestGallery, .birdQuestGalleryMain");
    if (!holder) return;
    holder.classList.add("is-image-missing");
    event.target.remove();
    if (!holder.querySelector(".birdQuestImagePlaceholder")) holder.insertAdjacentHTML("afterbegin", '<div class="birdQuestImagePlaceholder" aria-hidden="true">' + local('Image coming soon', 'Imagen próximamente') + '</div>');
  }, true);

  updateProgress(); render(); track('bird_quest_page_view', baseParams());
  });
})();
