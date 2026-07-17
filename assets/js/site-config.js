/* /assets/js/site-config.js
   Mindo Bird Watching centralized site configuration

   Purpose:
   - Keep changeable contact settings in one place
   - Update WhatsApp links dynamically across the site
   - Avoid hardcoding the WhatsApp number on every page

   How to update:
   - Change the whatsappNumberDigits variable only
   - Use digits only, no +, spaces, dashes, or parentheses
   - Upload this file again and purge its CDN cache after changing the value
*/

(function () {
  "use strict";

  window.MBW_SITE_CONFIG = window.MBW_SITE_CONFIG || {};

  // This is the only WhatsApp number stored in the site files.
  var whatsappNumberDigits = "13054585402";

  window.MBW_SITE_CONFIG.contact = {
    whatsappNumberDigits: whatsappNumberDigits,
    whatsappDisplayNumber: "+" + whatsappNumberDigits,
    email: "mindobirdwatching@gmail.com"
  };

  window.MBW_SITE_CONFIG.whatsappMessages = {
    default_en: "Hi Mindo Bird Watching, I am interested in planning a birdwatching tour in Mindo. Can you help me check availability?\n\nPage: {url}",
    default_es: "Hola Mindo Bird Watching, me interesa planificar un tour de avistamiento de aves en Mindo. ¿Me pueden ayudar a consultar disponibilidad?\n\nPágina: {url}",

    book_tour_en: "Hi Mindo Bird Watching, I would like to send a tour request for Mindo. Can you help me check availability and next steps?\n\nPage: {url}",
    book_tour_es: "Hola Mindo Bird Watching, quiero enviar una solicitud de tour en Mindo. ¿Me pueden ayudar a confirmar disponibilidad y próximos pasos?\n\nPágina: {url}",

    chocolate_tour_en: "Hi Mindo Bird Watching, I am interested in a chocolate tour experience in Mindo. Can you help me check availability, timing, price, and next steps?\n\nPage: {url}",
    chocolate_tour_es: "Hola Mindo Bird Watching, me interesa una experiencia de tour de chocolate en Mindo. ¿Me pueden ayudar a confirmar disponibilidad, horario, precio y próximos pasos?\n\nPágina: {url}",

    contact_en: "Hi Mindo Bird Watching, I would like to contact your team about birdwatching in Mindo.\n\nPage: {url}",
    contact_es: "Hola Mindo Bird Watching, quiero contactar a su equipo sobre avistamiento de aves en Mindo.\n\nPágina: {url}"
  };

  function getPageLanguage() {
    var bodyLang = document.body ? document.body.getAttribute("data-page-language") : "";
    var htmlLang = document.documentElement ? document.documentElement.getAttribute("lang") : "";
    var lang = String(bodyLang || htmlLang || "en").toLowerCase();

    return lang.indexOf("es") === 0 ? "es" : "en";
  }

  function getFallbackMessageKey(messageKey) {
    if (messageKey && window.MBW_SITE_CONFIG.whatsappMessages[messageKey]) {
      return messageKey;
    }

    return getPageLanguage() === "es" ? "default_es" : "default_en";
  }

  function buildWhatsAppUrl(messageKey) {
    var config = window.MBW_SITE_CONFIG;
    var number = String(config.contact.whatsappNumberDigits || "").replace(/\D/g, "");
    var safeMessageKey = getFallbackMessageKey(messageKey);
    var template = config.whatsappMessages[safeMessageKey] || "";
    var sourceUrl = window.location.href;
    var message = String(template).replace("{url}", sourceUrl);

    if (!number) {
      return "#";
    }

    return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
  }

  function updateWhatsAppLinks(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var links = scope.querySelectorAll("[data-whatsapp-message-key]");
    var sourcePage = window.location.pathname || "/";

    Array.prototype.forEach.call(links, function (link) {
      var originalMessageKey = link.getAttribute("data-whatsapp-message-key");
      var safeMessageKey = getFallbackMessageKey(originalMessageKey);
      var url = buildWhatsAppUrl(safeMessageKey);

      link.setAttribute("href", url);
      link.setAttribute("data-whatsapp-message-key", safeMessageKey);
      link.setAttribute("data-analytics-link-url", "dynamic_whatsapp");
      link.setAttribute("data-analytics-source-page", sourcePage);
      link.setAttribute("data-analytics-message-key", safeMessageKey);
      link.setAttribute("data-whatsapp-source-page", sourcePage);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });
  }

  function observeDynamicWhatsAppLinks() {
    if (!("MutationObserver" in window)) {
      return;
    }

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.forEach.call(mutation.addedNodes, function (node) {
          if (!node || node.nodeType !== 1) {
            return;
          }

          if (node.matches && node.matches("[data-whatsapp-message-key]")) {
            updateWhatsAppLinks(node.parentNode || document);
            return;
          }

          if (node.querySelector && node.querySelector("[data-whatsapp-message-key]")) {
            updateWhatsAppLinks(node);
          }
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  window.MBW_SITE_CONFIG.buildWhatsAppUrl = buildWhatsAppUrl;
  window.MBW_SITE_CONFIG.updateWhatsAppLinks = updateWhatsAppLinks;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      updateWhatsAppLinks();
      observeDynamicWhatsAppLinks();
    });
  } else {
    updateWhatsAppLinks();
    observeDynamicWhatsAppLinks();
  }
})();
