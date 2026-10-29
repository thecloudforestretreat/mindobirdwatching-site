(function () {
  "use strict";

  var form = document.getElementById("guestStorySubmission");
  if (!form) return;

  var input = document.getElementById("guestStoryPhotos");
  var drop = document.getElementById("guestStoryDropzone");
  var list = document.getElementById("guestStoryFileList");
  var status = document.getElementById("guestStoryStatus");
  var submit = document.getElementById("guestStorySubmit");
  var progress = document.getElementById("guestStoryProgress");
  var progressBar = progress ? progress.querySelector("span") : null;
  var selected = [];
  var maxFiles = 10;
  var maxFileBytes = 15 * 1024 * 1024;
  var maxTotalBytes = 75 * 1024 * 1024;
  var allowed = ["image/jpeg", "image/png", "image/webp"];
  var lang = form.getAttribute("data-language") === "es" ? "es" : "en";
  var copy = {
    en: {
      empty: "No images selected yet.",
      tooMany: "Choose no more than 10 images.",
      badType: "Use JPEG, PNG, or WebP images only.",
      tooLarge: "Each image must be 15 MB or smaller.",
      total: "The combined upload must be 75 MB or smaller.",
      security: "Please complete the security check.",
      uploading: "Uploading your story and photos…",
      success: "Thank you—your story and photos were received. Submission reference: ",
      failed: "The upload did not complete. Please try again.",
      submit: "Send my story and photos",
      remove: "Remove",
    },
    es: {
      empty: "Aún no has seleccionado imágenes.",
      tooMany: "Selecciona un máximo de 10 imágenes.",
      badType: "Usa únicamente imágenes JPEG, PNG o WebP.",
      tooLarge: "Cada imagen debe pesar 15 MB o menos.",
      total: "La carga combinada debe pesar 75 MB o menos.",
      security: "Completa la verificación de seguridad.",
      uploading: "Subiendo tu historia y fotografías…",
      success: "Gracias: recibimos tu historia y fotografías. Referencia: ",
      failed: "La carga no se completó. Inténtalo de nuevo.",
      submit: "Enviar mi historia y fotografías",
      remove: "Eliminar",
    },
  }[lang];

  function bytes(value) {
    return value >= 1024 * 1024 ? (value / (1024 * 1024)).toFixed(1) + " MB" : Math.ceil(value / 1024) + " KB";
  }

  function setStatus(message, tone) {
    status.textContent = message || "";
    status.dataset.tone = tone || "";
    status.hidden = !message;
  }

  function validateFiles(files) {
    if (files.length > maxFiles) return copy.tooMany;
    var total = 0;
    for (var i = 0; i < files.length; i += 1) {
      if (allowed.indexOf(files[i].type) < 0) return copy.badType;
      if (files[i].size > maxFileBytes) return copy.tooLarge;
      total += files[i].size;
    }
    if (total > maxTotalBytes) return copy.total;
    return "";
  }

  function renderFiles() {
    list.innerHTML = "";
    if (!selected.length) {
      var empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = copy.empty;
      list.appendChild(empty);
      return;
    }
    selected.forEach(function (file, index) {
      var item = document.createElement("li");
      var details = document.createElement("span");
      var name = document.createElement("strong");
      var size = document.createElement("small");
      var remove = document.createElement("button");
      name.textContent = file.name;
      size.textContent = bytes(file.size);
      details.appendChild(name);
      details.appendChild(size);
      remove.type = "button";
      remove.textContent = copy.remove;
      remove.addEventListener("click", function () {
        selected.splice(index, 1);
        renderFiles();
      });
      item.appendChild(details);
      item.appendChild(remove);
      list.appendChild(item);
    });
  }

  function addFiles(fileList) {
    var candidates = selected.concat(Array.prototype.slice.call(fileList || []));
    var error = validateFiles(candidates);
    if (error) {
      setStatus(error, "error");
      return;
    }
    selected = candidates;
    setStatus("", "");
    renderFiles();
  }

  input.addEventListener("change", function () {
    addFiles(input.files);
    input.value = "";
  });

  ["dragenter", "dragover"].forEach(function (eventName) {
    drop.addEventListener(eventName, function (event) {
      event.preventDefault();
      drop.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach(function (eventName) {
    drop.addEventListener(eventName, function (event) {
      event.preventDefault();
      drop.classList.remove("is-dragging");
    });
  });
  drop.addEventListener("drop", function (event) { addFiles(event.dataTransfer.files); });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    setStatus("", "");
    var error = validateFiles(selected);
    if (!selected.length) error = lang === "es" ? "Selecciona al menos una imagen." : "Select at least one image.";
    if (error) {
      setStatus(error, "error");
      drop.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!form.reportValidity()) return;
    var token = form.querySelector('[name="cf-turnstile-response"]');
    if (!token || !token.value) {
      setStatus(copy.security, "error");
      return;
    }

    var data = new FormData(form);
    data.delete("photos");
    selected.forEach(function (file) { data.append("photos", file, file.name); });
    data.set("source_page", window.location.href);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", form.action, true);
    xhr.responseType = "json";
    submit.disabled = true;
    submit.textContent = copy.uploading;
    progress.hidden = false;
    progressBar.style.width = "2%";
    setStatus(copy.uploading, "working");

    xhr.upload.addEventListener("progress", function (uploadEvent) {
      if (!uploadEvent.lengthComputable) return;
      var percent = Math.max(2, Math.min(98, Math.round((uploadEvent.loaded / uploadEvent.total) * 100)));
      progressBar.style.width = percent + "%";
    });
    xhr.addEventListener("load", function () {
      var response = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300 && response.ok) {
        progressBar.style.width = "100%";
        setStatus(copy.success + response.submission_id, "success");
        form.reset();
        selected = [];
        renderFiles();
        if (window.turnstile) window.turnstile.reset();
        status.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setStatus(response.message || copy.failed, "error");
        if (window.turnstile) window.turnstile.reset();
      }
    });
    xhr.addEventListener("error", function () {
      setStatus(copy.failed, "error");
      if (window.turnstile) window.turnstile.reset();
    });
    xhr.addEventListener("loadend", function () {
      submit.disabled = false;
      submit.textContent = copy.submit;
      window.setTimeout(function () { progress.hidden = true; }, 1200);
    });
    xhr.send(data);
  });

  renderFiles();
}());
