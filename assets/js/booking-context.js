(function () {
  "use strict";
  var form = document.querySelector('form[action="/api/book-tour"], form[action="/api/contact"]');
  if (!form) return;
  var params = new URLSearchParams(window.location.search || "");
  var experiences = {
    "night-walk": ["Night Walk", "Caminata nocturna"],
    "quito-day-trip": ["Quito to Mindo Day Trip", "Viaje de un día de Quito a Mindo"]
  };
  var catalog = window.MBWExperienceCatalog || [];
  experiences.activities = ["Activity", "Activities", "Actividades"];
  experiences["half-day"] = ["Half-Day Tour"];
  experiences["full-day"] = ["Full-Day Tour"];
  experiences.photography = ["Photography-Focused Tour"];
  experiences.custom = ["Custom / Private Tour"];
  var activityChoice = form.querySelector('[name="activity_choice"]');
  var activityWrap = form.querySelector('[data-activity-choice-wrap]');
  var primary = Array.prototype.slice.call(form.querySelectorAll('[name="preferred_tour_type"]'));
  var notes = Array.prototype.slice.call(form.querySelectorAll("[data-booking-context]"));

  function selectedExperience() {
    var selected = primary.find(function (field) { return field.tagName === "SELECT" || field.checked; });
    var value = selected ? selected.value : "";
    return Object.keys(experiences).find(function (key) { return experiences[key].indexOf(value) !== -1; });
  }

  var sourcePairs = [
    ["/quito-to-mindo-day-trip/", "/es/viaje-de-un-dia-quito-mindo/"],
    ["/quito-to-mindo-cloud-forest-day-trip/", "/es/excursion-quito-mindo-bosque-nublado/"],
    ["/activities/night-walk/", "/es/actividades/caminata-nocturna/"],
    ["/mindo-night-walk/", "/es/caminata-nocturna-mindo/"],
    ["/book-tour/", "/es/reservar-tour/"],
    ["/contact/", "/es/contacto/"]
  ];
  catalog.forEach(function (item) { sourcePairs.push([item.path, item.espath]); });
  var source = params.get("source_page") || "";
  var validSource = /^\/(?:[a-z0-9-]+\/)*$/i.test(source) && source.length <= 512;
  var itineraryMode = params.get("itinerary") === "1";
  var formatFields = Array.prototype.slice.call(form.querySelectorAll("[data-tour-format]"));
  var transport = form.querySelector('[data-tour-add-on][value="Transportation"]');
  var transportLabel = transport ? transport.closest("label") : null;
  var savedTransport = null;
  var wasDayTrip = false;

  function updateLanguageLinks() {
    if (itineraryMode) return;
    var selected = selectedExperience();
    document.querySelectorAll('a[data-lang], .rawLangLinks a[hreflang]').forEach(function (link) {
      var lang = link.getAttribute("data-lang") || link.getAttribute("hreflang");
      if (lang !== "en" && lang !== "es") return;
      var target = new URL(link.getAttribute("href"), window.location.origin);
      if (target.origin !== window.location.origin && target.origin !== "https://mindobirdwatching.com") return;
      if (["/book-tour/", "/es/reservar-tour/", "/contact/", "/es/contacto/"].indexOf(target.pathname) === -1) return;
      // Rebuild only navigation context; never copy guest input or tracking identifiers.
      target.search = "";
      target.hash = "";
      if (selected) {
        target.searchParams.set("experience", selected);
        var activity = activityChoice && catalog.find(function (item) { return item.en === activityChoice.value; });
        if (selected === "activities" && activity) target.searchParams.set("activity", activity.key);
        if (validSource) {
          var pair = sourcePairs.find(function (paths) { return paths.indexOf(source) !== -1; });
          target.searchParams.set("source_page", pair ? pair[lang === "es" ? 1 : 0] : source);
        }
        target.hash = form.getAttribute("action") === "/api/book-tour" ? "request-form" : "contactForm";
      }
      link.setAttribute("href", target.pathname + target.search + target.hash);
    });
  }

  function updatePackage(selected) {
    var dayTrip = selected === "quito-day-trip";
    if (dayTrip && !wasDayTrip && !formatFields.some(function (field) { return field.checked; })) {
      var privateFormat = formatFields.find(function (field) { return field.value === "Private Tour"; });
      if (privateFormat) {
        privateFormat.checked = true;
        privateFormat.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    var transportChanged = false;
    if (transport) {
      var previousChecked = transport.checked, previousDisabled = transport.disabled;
      if (dayTrip && savedTransport === null) savedTransport = { checked: transport.checked, disabled: transport.disabled };
      if (dayTrip) {
        transport.checked = false;
        transport.disabled = true;
      } else if (savedTransport !== null) {
        transport.checked = savedTransport.checked;
        transport.disabled = savedTransport.disabled;
        savedTransport = null;
      }
      if (transportLabel) transportLabel.hidden = dayTrip;
      transportChanged = previousChecked !== transport.checked || previousDisabled !== transport.disabled;
    }
    wasDayTrip = dayTrip;
    if (transportChanged) transport.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function updateNotes() {
    var selected = selectedExperience();
    if (activityChoice) {
      var isActivity = selected === "activities";
      activityChoice.disabled = !isActivity;
      activityChoice.required = isActivity;
      if (activityWrap) activityWrap.hidden = !isActivity;
      // Activity formats vary; do not require a birding group/private choice.
      formatFields.forEach(function (field) {
        field.required = !isActivity && field === formatFields[0];
        field.disabled = isActivity;
        var fieldset = field.closest("fieldset");
        if (fieldset) fieldset.hidden = isActivity;
      });
    }
    updatePackage(selected);
    updateLanguageLinks();
    var nightAddOn = form.querySelector('[data-tour-add-on][value="Night Walk"]');
    notes.forEach(function (note) {
      var key = note.getAttribute("data-booking-context");
      note.hidden = key !== selected && !(key === "night-walk" && nightAddOn && nightAddOn.checked && !nightAddOn.disabled);
    });
  }

  // Only supported experience names and internal paths may initialize the form.
  // Guests can change every preselected choice before submitting.
  var requestedKey = params.get("experience");
  var requested = Object.prototype.hasOwnProperty.call(experiences, requestedKey) ? experiences[requestedKey] : null;
  if (requested && params.get("itinerary") !== "1") {
    primary.forEach(function (field) {
      if (field.tagName === "SELECT") {
        var option = Array.prototype.find.call(field.options, function (item) { return requested.indexOf(item.value) !== -1; });
        if (option) field.value = option.value;
      } else {
        field.checked = requested.indexOf(field.value) !== -1;
      }
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
    if (validSource) {
      var sourceField = form.querySelector('[name="source_page"]');
      if (sourceField) sourceField.value = window.location.origin + source;
    }
  }
  if (activityChoice && requestedKey === "activities") {
    var requestedActivity = catalog.find(function (item) { return item.key === params.get("activity"); });
    if (requestedActivity) activityChoice.value = requestedActivity.en;
  }
  form.addEventListener("change", updateNotes);
  form.addEventListener("reset", function () { window.setTimeout(function () {
      if (savedTransport) savedTransport.checked = transport.defaultChecked;
      updateNotes();
    }, 0); });
  window.addEventListener("mbw:includes:ready", updateLanguageLinks);
  updateNotes();
})();
