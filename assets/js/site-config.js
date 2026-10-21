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

  var ATTRIBUTION_SCRIPT_URL = "/assets/js/mbw-attribution.js?v=20261021-1";

  function loadAttribution() {
    if (window.MBWAttribution && typeof window.MBWAttribution.prepareContactUrl === "function") {
      return Promise.resolve(window.MBWAttribution);
    }

    if (window.MBWAttributionReady && typeof window.MBWAttributionReady.then === "function") {
      return window.MBWAttributionReady;
    }

    window.MBWAttributionReady = new Promise(function (resolve, reject) {
      var script = document.querySelector('script[data-mbw-attribution="true"]');

      function finish() {
        if (window.MBWAttribution && typeof window.MBWAttribution.prepareContactUrl === "function") {
          resolve(window.MBWAttribution);
          return;
        }
        reject(new Error("MBW attribution collector did not initialize"));
      }

      if (script) {
        script.addEventListener("load", finish, { once: true });
        script.addEventListener("error", function () {
          reject(new Error("MBW attribution collector could not be loaded"));
        }, { once: true });
        return;
      }

      script = document.createElement("script");
      script.src = ATTRIBUTION_SCRIPT_URL;
      script.async = true;
      script.setAttribute("data-mbw-attribution", "true");
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", function () {
        reject(new Error("MBW attribution collector could not be loaded"));
      }, { once: true });
      document.head.appendChild(script);
    });

    return window.MBWAttributionReady;
  }

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

    shop_product_en: "Hi Mindo Bird Watching, I have a question about this shop product, its options, shipping, or sizing. Can you help me?\n\nProduct: {url}",
    shop_product_es: "Hola Mindo Bird Watching, tengo una pregunta sobre este producto, sus opciones, el envío o las tallas. ¿Me pueden ayudar?\n\nProducto: {url}",

    chocolate_tour_en: "Hi Mindo Bird Watching, I am interested in a chocolate tour experience in Mindo. Can you help me check availability, timing, price, and next steps?\n\nPage: {url}",
    chocolate_tour_es: "Hola Mindo Bird Watching, me interesa una experiencia de tour de chocolate en Mindo. ¿Me pueden ayudar a confirmar disponibilidad, horario, precio y próximos pasos?\n\nPágina: {url}",

    trail_running_en: "Hi Mindo Bird Watching, I am interested in a private trail running or active run/walk route in Mindo. Can you help me check guide availability, route options, pace, price, and next steps?\n\nPage: {url}",
    trail_running_es: "Hola Mindo Bird Watching, me interesa una ruta privada de running o run/walk activo en Mindo. ¿Me pueden ayudar a confirmar disponibilidad del guía, opciones de ruta, ritmo, precio y próximos pasos?\n\nPágina: {url}",

    active_adventure_en: "Hi Mindo Bird Watching, I am interested in planning a private active adventure in Mindo. Can you help me compare trail running, waterfalls, birding routes, pace, availability, price, and next steps?\n\nPage: {url}",
    active_adventure_es: "Hola Mindo Bird Watching, me interesa planificar una aventura activa privada en Mindo. ¿Me pueden ayudar a comparar running, cascadas, rutas con aves, ritmo, disponibilidad, precio y próximos pasos?\n\nPágina: {url}",

    contact_en: "Hi Mindo Bird Watching, I would like to contact your team about birdwatching in Mindo.\n\nPage: {url}",
    contact_es: "Hola Mindo Bird Watching, quiero contactar a su equipo sobre avistamiento de aves en Mindo.\n\nPágina: {url}",

    bird_quest_en: "Hi Mindo Bird Watching, I am interested in the Bird Quest experience. Can you help me review the route, availability, price, and next steps?\n\nPage: {url}",
    bird_quest_es: "Hola Mindo Bird Watching, me interesa la experiencia Bird Quest. ¿Me pueden ayudar a revisar la ruta, disponibilidad, precio y próximos pasos?\n\nPágina: {url}",

    birdwatching_tour_inquiry_en: "Hi Mindo Bird Watching, I am interested in a private birdwatching tour in Mindo. Can you help me choose the best option for my dates and interests?\n\nPage: {url}",
    birdwatching_tour_inquiry_es: "Hola Mindo Bird Watching, me interesa un tour privado de avistamiento de aves en Mindo. ¿Me pueden ayudar a elegir la mejor opción para mis fechas e intereses?\n\nPágina: {url}",

    custom_private_tour_en: "Hi Mindo Bird Watching, I am interested in a custom private tour. Can you help me plan the route, timing, availability, and price?\n\nPage: {url}",
    custom_private_tour_es: "Hola Mindo Bird Watching, me interesa un tour privado personalizado. ¿Me pueden ayudar a planificar la ruta, horario, disponibilidad y precio?\n\nPágina: {url}",

    hummingbird_sanctuary_en: "Hi Mindo Bird Watching, I am interested in visiting a hummingbird sanctuary in Mindo. Can you help me with the best option, timing, availability, and price?\n\nPage: {url}",
    hummingbird_sanctuary_es: "Hola Mindo Bird Watching, me interesa visitar un santuario de colibríes en Mindo. ¿Me pueden ayudar con la mejor opción, horario, disponibilidad y precio?\n\nPágina: {url}",

    night_walk_en: "Hi Mindo Bird Watching, I am interested in a Mindo night walk. Can you help me check availability, start time, price, and what we may see?\n\nPage: {url}",
    night_walk_es: "Hola Mindo Bird Watching, me interesa una caminata nocturna en Mindo. ¿Me pueden ayudar a confirmar disponibilidad, hora de inicio, precio y qué podríamos observar?\n\nPágina: {url}",

    spectacled_bear_guide_en: "Hi Mindo Bird Watching, I am researching spectacled bears in Ecuador and would like local guidance on realistic viewing options. Can you help me?\n\nPage: {url}",
    spectacled_bear_guide_es: "Hola Mindo Bird Watching, estoy investigando sobre los osos de anteojos en Ecuador y quisiera orientación local sobre opciones realistas de observación. ¿Me pueden ayudar?\n\nPágina: {url}",

    spectacled_bear_tour_en: "Hi Mindo Bird Watching, I am interested in the spectacled bear tour. Can you help me check conditions, availability, itinerary, and price?\n\nPage: {url}",
    spectacled_bear_tour_es: "Hola Mindo Bird Watching, me interesa el tour del oso de anteojos. ¿Me pueden ayudar a confirmar condiciones, disponibilidad, itinerario y precio?\n\nPágina: {url}",

    things_to_do_mindo_en: "Hi Mindo Bird Watching, I am planning what to do in Mindo. Can you help me compare birding, wildlife, and other activity options for my dates?\n\nPage: {url}",
    things_to_do_mindo_es: "Hola Mindo Bird Watching, estoy planificando qué hacer en Mindo. ¿Me pueden ayudar a comparar opciones de avistamiento de aves, vida silvestre y otras actividades para mis fechas?\n\nPágina: {url}",

    ecuador_trip_planning_en: "Hi Mindo Bird Watching, I am planning a trip through Ecuador and would like help deciding where Mindo fits best. Can you review my dates and ideas?\n\nPage: {url}",
    ecuador_trip_planning_es: "Hola Mindo Bird Watching, estoy planificando un viaje por Ecuador y quisiera ayuda para decidir dónde encaja mejor Mindo. ¿Pueden revisar mis fechas e ideas?\n\nPágina: {url}",

    termsBookingEn: "Hi Mindo Bird Watching, I have a question about the booking or cancellation terms for a tour. Can you help me?\n\nPage: {url}",
    termsBookingEs: "Hola Mindo Bird Watching, tengo una pregunta sobre las condiciones de reserva o cancelación de un tour. ¿Me pueden ayudar?\n\nPágina: {url}",

    termsServiceEn: "Hi Mindo Bird Watching, I have a question about your terms of service. Can you help me clarify it?\n\nPage: {url}",
    termsServiceEs: "Hola Mindo Bird Watching, tengo una pregunta sobre sus términos de servicio. ¿Me pueden ayudar a aclararla?\n\nPágina: {url}"
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

  function prepareAttributedWhatsAppUrl(url, metadata) {
    return loadAttribution().then(function (attribution) {
      var prepared = attribution.prepareContactUrl(url, metadata || {});
      if (!prepared || !prepared.url || !prepared.contact_intent_id) {
        throw new Error("WhatsApp reference could not be created");
      }
      return prepared;
    });
  }

  function isWhatsAppAnchor(anchor) {
    if (!anchor || anchor.tagName !== "A") return false;
    if (anchor.hasAttribute("data-whatsapp-message-key")) return true;

    var href = String(anchor.getAttribute("href") || "").trim();
    return /^(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)(?:\/|$)/i.test(href) ||
      /^whatsapp:/i.test(href);
  }

  function protectWhatsAppClicks() {
    document.addEventListener("click", function (event) {
      var target = event.target;
      var anchor = target && typeof target.closest === "function" ? target.closest("a") : null;
      if (!isWhatsAppAnchor(anchor)) return;

      if (window.MBWAttribution && typeof window.MBWAttribution.prepareContactUrl === "function") return;

      event.preventDefault();
      event.stopImmediatePropagation();

      var href = anchor.getAttribute("href") || "";
      var targetName = anchor.getAttribute("target") || "_self";
      var pendingWindow = targetName === "_blank" ? window.open("", "_blank") : null;
      var metadata = {
        label: anchor.getAttribute("data-analytics-label") || anchor.getAttribute("aria-label") || anchor.textContent || "WhatsApp CTA",
        location: anchor.getAttribute("data-analytics-location") || anchor.getAttribute("data-whatsapp-source-page") || "site_whatsapp_link",
        tour: anchor.getAttribute("data-analytics-tour") || "",
        message_key: anchor.getAttribute("data-whatsapp-message-key") || "",
        agent_id: anchor.getAttribute("data-agent-id") || ""
      };

      prepareAttributedWhatsAppUrl(href, metadata).then(function (prepared) {
        if (pendingWindow && !pendingWindow.closed) {
          pendingWindow.location.replace(prepared.url);
          return;
        }
        window.location.href = prepared.url;
      }).catch(function (error) {
        if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
        if (window.console && typeof window.console.error === "function") {
          window.console.error("WhatsApp reference could not be prepared", error);
        }
        window.alert("WhatsApp is still loading. Please try again so your inquiry reference is included.");
      });
    }, true);
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
  window.MBW_SITE_CONFIG.loadAttribution = loadAttribution;
  window.MBW_SITE_CONFIG.prepareAttributedWhatsAppUrl = prepareAttributedWhatsAppUrl;
  window.MBW_SITE_CONFIG.updateWhatsAppLinks = updateWhatsAppLinks;

  loadAttribution().catch(function () {
    // A click receives a visible retry message if attribution still cannot load.
  });
  protectWhatsAppClicks();

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
