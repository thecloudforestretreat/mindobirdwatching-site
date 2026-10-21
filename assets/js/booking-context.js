(function () {
  "use strict";
  var form = document.querySelector('form[action="/api/book-tour"], form[action="/api/contact"]');
  if (!form) return;
  var params = new URLSearchParams(window.location.search || "");
  var experiences = {
    "night-walk": ["Night Walk", "Caminata nocturna"],
    "quito-day-trip": ["Quito to Mindo Day Trip", "Viaje de un día de Quito a Mindo"]
  };
  var primary = Array.prototype.slice.call(form.querySelectorAll('[name="preferred_tour_type"]'));
  var notes = Array.prototype.slice.call(form.querySelectorAll("[data-booking-context]"));

  function selectedExperience() {
    var selected = primary.find(function (field) { return field.tagName === "SELECT" || field.checked; });
    var value = selected ? selected.value : "";
    return Object.keys(experiences).find(function (key) { return experiences[key].indexOf(value) !== -1; });
  }

  function updateNotes() {
    var selected = selectedExperience();
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
    var source = params.get("source_page") || "";
    if (/^\/(?:[a-z0-9-]+\/)*$/i.test(source) && source.length <= 512) {
      var sourceField = form.querySelector('[name="source_page"]');
      if (sourceField) sourceField.value = window.location.origin + source;
    }
  }
  form.addEventListener("change", updateNotes);
  form.addEventListener("reset", function () { window.setTimeout(updateNotes, 0); });
  updateNotes();
})();
