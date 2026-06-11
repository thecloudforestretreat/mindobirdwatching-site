/* /assets/js/site-config.js
   Mindo Bird Watching centralized site configuration
   Created: 2026-06-10

   Purpose:
   - Keep changeable contact settings in one place
   - Update WhatsApp links dynamically across the site
   - Avoid hardcoding the WhatsApp number on every page

   How to update:
   - Change the whatsappNumberDigits variable only
   - Use digits only, no +, spaces, dashes, or parentheses
   - Example: "13054585402"
*/

(function () {
  "use strict";

  window.MBW_SITE_CONFIG = window.MBW_SITE_CONFIG || {};

  // To change agents, edit this one value and upload this file again.
  var whatsappNumberDigits = "593969076501";

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

    contact_en: "Hi Mindo Bird Watching, I would like to contact your team about birdwatching in Mindo.\n\nPage: {url}",
    contact_es: "Hola Mindo Bird Watching, quiero contactar a su equipo sobre avistamiento de aves en Mindo.\n\nPágina: {url}"
  };

  function buildWhatsAppUrl(messageKey) {
    var config = window.MBW_SITE_CONFIG;
    var number = String(config.contact.whatsappNumberDigits || "").replace(/\D/g, "");
    var template = config.whatsappMessages[messageKey] || config.whatsappMessages.default_en;
    var message = String(template || "").replace("{url}", window.location.href);

    return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
  }

  function updateWhatsAppLinks() {
    var links = document.querySelectorAll("[data-whatsapp-message-key]");

    Array.prototype.forEach.call(links, function (link) {
      var url = buildWhatsAppUrl(link.getAttribute("data-whatsapp-message-key"));
      link.setAttribute("href", url);
      link.setAttribute("data-analytics-link-url", url);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateWhatsAppLinks);
  } else {
    updateWhatsAppLinks();
  }
})();
