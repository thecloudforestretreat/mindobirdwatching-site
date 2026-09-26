/* MBW Admin Recommendations Dashboard build 2026.09.26.4 - protected admin asset */
(function () {
  "use strict";

  document.documentElement.dataset.recommendationsBuild = "2026.09.26.4";

  var STORAGE_KEY = "mbw-recommendations-dashboard-v1";
  var CATEGORY_LABELS = {
    accommodations: "Accommodations",
    restaurants: "Restaurants",
    services: "Services & experiences"
  };

  var seedPartners = [
    {
      id: "cabanas-armonia",
      category: "accommodations",
      type: "Cabins",
      name: "Cabañas Armonía & Orchid Garden",
      area: "Mindo",
      status: "current",
      statusText: "Rates confirmed",
      regularPrice: "$42.00",
      ourPrice: "$25.00",
      savings: "Save 40%",
      pricingBasis: "Bungalow / single occupancy",
      rateValidTo: "December 31, 2027",
      contact: "Tatiana Oñate",
      phone: "+593 99 943 5098",
      email: "cabanasarmonia@hotmail.com",
      website: "https://www.mindocabanasarmonia.com/",
      mapUrl: "https://www.google.com/maps?q=-0.054828999233723,-78.776379970554",
      address: "Lluvia de Oro & Sixto Durán Ballén, Casa 2, Manzana 49, Mindo",
      image: "https://s3-cdn.hotellinksolutions.com/hls/data/10325/gallery/thumbs/sm_large__bbp0691_1749158760.jpg",
      imageAlt: "Cabañas Armonía and Orchid Garden in Mindo",
      recommendation: "yes",
      followUp: "2027-10-01",
      followUpDue: false,
      owner: "Juan",
      preferred: true,
      verifiedResponse: true,
      responseVerifiedAt: "2026-09-25",
      replyTaskId: "cabanas-armonia-2026-09-25",
      replyAcknowledged: false,
      replySubject: "Colaboración local: Mindo Bird Watching + Cabañas Armonía y Jardín de Orquídeas",
      replyDraft: "Estimada Tatiana,\n\nMuchas gracias por la información y por compartir las tarifas 2026–2027. Confirmamos que recibimos el documento y los detalles sobre el desayuno, el box breakfast para salidas tempranas y las amenidades de Cabañas Armonía.\n\nNos alegra poder considerar a Cabañas Armonía como alojamiento aliado para nuestros viajeros. Incorporaremos la información en nuestro directorio interno y nos comunicaremos directamente contigo cuando tengamos una solicitud de reserva.\n\nSaludos cordiales,\nJuan\nMindo Bird Watching",
      breakfast: "07:30–09:00; box breakfast available by advance request",
      amenities: ["Breakfast included", "Early box breakfast", "Free orchid garden", "Free parking", "Wi-Fi", "Hot-water shower", "Private bathrooms", "Hummingbird viewing", "Tourist information", "24-hour taxi support"],
      services: [
        { name: "Orchid garden tour", price: "$4 agency" },
        { name: "Canopy – 10 cables", price: "$16 agency" },
        { name: "Canopy – 3 cables", price: "$8 agency" },
        { name: "Extreme swing", price: "$7 agency" },
        { name: "Birdwatching tour", price: "$60 up to 3; +$20 each" },
        { name: "Additional breakfast", price: "$4" },
        { name: "Tourist menu", price: "$10" }
      ],
      roomRates: [
        { room: "Bungalow", single: "$25", double: "$38", triple: "$57", family: "$74" },
        { room: "Deluxe room", single: "$35", double: "$45", triple: "$67.50", family: "$80" },
        { room: "Jacuzzi suite", single: "$70", double: "$80", triple: "—", family: "—" },
        { room: "Glamping", single: "$80", double: "$120", triple: "$150", family: "$160" }
      ],
      guestSummary: "Cabañas Armonía is a family-run stay in central Mindo surrounded by an orchid garden. Breakfast, Wi-Fi, parking, private bathrooms, hot-water showers, and complimentary orchid-garden access are included. Early box breakfasts can be arranged in advance for birding departures.",
      note: "Direct partner response received September 25, 2026. Agency rates are confidential, exclude taxes, and are valid through December 31, 2027."
    },
    {
      id: "sachatamia-lodge",
      category: "accommodations",
      type: "Lodge",
      name: "Sachatamia Lodge",
      area: "Mindo",
      status: "current",
      statusText: "Rates current",
      regularPrice: "$60.79",
      ourPrice: "$53.40",
      savings: "Save 12%",
      pricingBasis: "Per person / night",
      rateValidTo: "2027",
      contact: "Andrea",
      phone: "",
      email: "info@sachatamia.com",
      website: "https://www.sachatamia.com/",
      recommendation: "pending",
      followUp: "2027-10-01",
      followUpDue: false,
      owner: "Juan",
      preferred: true,
      verifiedResponse: true,
      responseVerifiedAt: "2026-09-21",
      replyTaskId: "sachatamia-2026-09-21",
      replyAcknowledged: false,
      replySubject: "Colaboración local: Mindo Bird Watching + Sachatamia Lodge",
      replyDraft: "Estimada Andrea,\n\nMuchas gracias por su respuesta y por compartir los convenios 2026 y 2027. Confirmamos que recibimos ambos documentos, junto con la información del desayuno y la posibilidad de preparar box breakfast desde las 04:00 cuando se solicita la noche anterior.\n\nIncorporaremos estos datos en nuestro directorio interno de aliados y utilizaremos este correo para futuras solicitudes de reserva. Agradecemos mucho la disposición de Sachatamia Lodge para trabajar con Mindo Bird Watching.\n\nSaludos cordiales,\nJuan\nMindo Bird Watching",
      breakfast: "08:00–10:00; box breakfast from 04:00 by prior request",
      amenities: ["Breakfast included", "Box breakfast from 04:00", "Heated covered pool", "Whirlpool", "Meeting room", "Games and sports courts", "Wildlife observation", "Reserve walks"],
      note: "Agency pricing is confidential. Keep partner rates visible only to authorized admin users."
    },
    {
      id: "bellavista-cloud-forest",
      category: "accommodations",
      type: "Lodge",
      name: "Bellavista Cloud Forest",
      area: "Tandayapa Valley",
      status: "review",
      statusText: "Needs review",
      regularPrice: "$60.00",
      ourPrice: "$54.00",
      savings: "Save 10%",
      pricingBasis: "Confirm basis",
      rateValidTo: "Confirm tariff year",
      contact: "Rosa Rogel",
      phone: "+593 9 9416 5868",
      email: "info@bellavistacloudforest.com",
      website: "https://www.bellavistacloudforest.com/",
      recommendation: "pending",
      followUp: "2026-10-02",
      followUpDue: true,
      owner: "Juan",
      preferred: true,
      verifiedResponse: true,
      responseVerifiedAt: "2026-09-21",
      replyTaskId: "bellavista-2026-09-21",
      replyAcknowledged: false,
      replySubject: "Colaboración local: Mindo Bird Watching + Bellavista Cloud Forest Lodge",
      replyDraft: "Estimada Rosa,\n\nMuchas gracias por su respuesta y por enviarnos las tarifas de alojamiento, agencias y birding. Confirmamos que recibimos los archivos y ya estamos organizando la información para nuestro directorio interno.\n\nAntes de cerrar la revisión, ¿nos podría confirmar si las tablas que aparecen como 2026 dentro del archivo “Birding tours 2027” corresponden efectivamente a la temporada 2027?\n\nAgradecemos mucho la disposición de Bellavista Cloud Forest para colaborar con Mindo Bird Watching.\n\nSaludos cordiales,\nJuan\nMindo Bird Watching",
      breakfast: "Confirm schedule and early box breakfast",
      amenities: ["Private cloud-forest reserve", "Restaurant", "Guided hikes", "Birding", "Lodging", "Transfers", "Tour packages"],
      note: "The Birding Tours 2027 filename contains a 2026 tariff reference. Confirm the correct validity year before publishing."
    },
    {
      id: "toucan-platinum-suites",
      category: "accommodations",
      type: "Suites",
      name: "Toucan Platinum Suites",
      area: "Mindo",
      status: "review",
      statusText: "Validity missing",
      regularPrice: "—",
      ourPrice: "$70.00",
      savings: "Agency rate",
      pricingBasis: "Starting price / room",
      rateValidTo: "Not supplied",
      contact: "Maria Viteri",
      phone: "+593 98 265 0335",
      email: "toursecuadorexplorer@gmail.com",
      website: "https://www.lodgemindoecuador.com/",
      recommendation: "pending",
      followUp: "2026-10-05",
      followUpDue: false,
      owner: "Juan",
      preferred: true,
      verifiedResponse: true,
      responseVerifiedAt: "2026-09-25",
      replyTaskId: "maria-viteri-2026-09-25",
      replyAcknowledged: false,
      replySubject: "Colaboración local: Mindo Bird Watching + Toucan Platinum Suites",
      replyDraft: "Estimada María,\n\nMuchas gracias por su respuesta y por compartir las tarifas de Toucan Platinum Suites y Royal River Suites & Spa. Confirmamos que recibimos el documento y la información sobre el desayuno de 07:00 a 10:00, el desayuno para llevar y el servicio de restaurante.\n\nPara completar nuestro registro, ¿nos podría confirmar la fecha de vigencia de las tarifas y con cuánta anticipación debemos solicitar el desayuno para llevar antes de las 07:00?\n\nAgradecemos mucho su disposición para trabajar con Mindo Bird Watching.\n\nSaludos cordiales,\nJuan\nMindo Bird Watching",
      breakfast: "07:00–10:00; takeaway breakfast available",
      amenities: ["Breakfast included", "Takeaway breakfast", "Balconies", "Kitchens", "Jacuzzi rooms", "Pool", "Massage area", "Wi-Fi", "Satellite TV"],
      note: "Restaurant service is for breakfast only. No lunch or dinner. Confirm tariff validity dates."
    },
    {
      id: "royal-river-suites",
      category: "accommodations",
      type: "Suites",
      name: "Royal River Suites",
      area: "Mindo",
      status: "review",
      statusText: "Validity missing",
      regularPrice: "—",
      ourPrice: "$115.00",
      savings: "Agency rate",
      pricingBasis: "Starting price / room",
      rateValidTo: "Not supplied",
      contact: "Maria Viteri",
      phone: "+593 98 265 0335",
      email: "toursecuadorexplorer@gmail.com",
      website: "https://mindoroyalsuites.com/en/",
      recommendation: "pending",
      followUp: "2026-10-05",
      followUpDue: false,
      owner: "Juan",
      preferred: true,
      verifiedResponse: true,
      responseVerifiedAt: "2026-09-25",
      replyTaskId: "maria-viteri-2026-09-25",
      replyAcknowledged: false,
      replySubject: "Colaboración local: Mindo Bird Watching + Toucan Platinum Suites",
      replyDraft: "Estimada María,\n\nMuchas gracias por su respuesta y por compartir las tarifas de Toucan Platinum Suites y Royal River Suites & Spa. Confirmamos que recibimos el documento y la información sobre el desayuno de 07:00 a 10:00, el desayuno para llevar y el servicio de restaurante.\n\nPara completar nuestro registro, ¿nos podría confirmar la fecha de vigencia de las tarifas y con cuánta anticipación debemos solicitar el desayuno para llevar antes de las 07:00?\n\nAgradecemos mucho su disposición para trabajar con Mindo Bird Watching.\n\nSaludos cordiales,\nJuan\nMindo Bird Watching",
      breakfast: "07:00–10:00; takeaway breakfast available",
      amenities: ["Breakfast included", "Takeaway breakfast", "Jacuzzi suites", "Kitchen or kitchenette", "Balcony", "Pool", "Restaurant", "Gardens and river", "Hanging beds", "Massage room"],
      note: "Confirm tariff validity dates and final room-by-room inclusions before recommending."
    },
    {
      id: "casa-de-vista-alta",
      category: "accommodations",
      type: "Hotel",
      name: "Casa de Vista Alta",
      area: "Mindo",
      status: "pending",
      statusText: "Awaiting rates",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Pending",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: "Vicky",
      phone: "",
      email: "info@casadevistaalta.com",
      website: "",
      recommendation: "pending",
      followUp: "2026-10-02",
      followUpDue: true,
      owner: "Juan",
      preferred: true,
      verifiedResponse: true,
      responseVerifiedAt: "2026-09-25",
      replyTaskId: "casa-vista-alta-2026-09-25",
      replyAcknowledged: false,
      replySubject: "Colaboración local: Mindo Bird Watching + Casa de Vista Alta Hotel",
      replyDraft: "Estimada Vicky,\n\nMuchas gracias por su respuesta y por el interés en trabajar con Mindo Bird Watching. Entendemos que están revisando las tarifas y quedamos atentos a la información cuando esté lista la próxima semana.\n\nCuando sea posible, nos ayudaría recibir la vigencia de las tarifas, el horario de desayuno, la opción de box breakfast para salidas tempranas y el mejor contacto para reservas.\n\nSaludos cordiales,\nJuan\nMindo Bird Watching",
      breakfast: "To confirm",
      note: "Vicky is reviewing the tariff and expects to provide the information soon."
    },
    {
      id: "las-terrazas-de-dana",
      category: "accommodations",
      type: "Lodge",
      name: "Las Terrazas de Dana Boutique Lodge & Spa",
      area: "Mindo",
      status: "review",
      statusText: "Contact verified",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Request rates",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: "David Brito",
      phone: "+593 93 956 5819",
      email: "",
      website: "https://www.lasterrazasdedana.com/",
      recommendation: "pending",
      followUp: "",
      followUpDue: false,
      owner: "",
      breakfast: "To confirm",
      note: "Public contact verified September 19, 2026. Request agency terms and a direct reservation contact."
    },
    {
      id: "terrabambu-lodge",
      category: "accommodations",
      type: "Lodge",
      name: "Terrabambú Lodge",
      area: "Mindo",
      status: "review",
      statusText: "Contact verified",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Request rates",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: "Reservations",
      phone: "+593 2 217 0252 / +593 9 992 45686",
      email: "reservas@terrabambu.com",
      website: "https://terrabambu.com/",
      recommendation: "pending",
      followUp: "",
      followUpDue: false,
      owner: "",
      breakfast: "To confirm",
      note: "Public contact verified September 19, 2026. Request agency pricing and conditions."
    },
    {
      id: "la-casa-de-cecilia",
      category: "accommodations",
      type: "Hostel",
      name: "La Casa de Cecilia",
      area: "Mindo",
      status: "review",
      statusText: "Contact verified",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Request rates",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: "Reservations",
      phone: "+593 2 217 0243 / +593 99 334 5393",
      email: "casadececiliamindo@gmail.com",
      website: "https://www.lacasadececilia.com/",
      recommendation: "pending",
      followUp: "",
      followUpDue: false,
      owner: "",
      breakfast: "To confirm",
      note: "Nine past pickups. Public contact verified September 19, 2026."
    },
    {
      id: "secret-garden-quito",
      category: "accommodations",
      type: "Hostel",
      name: "The Secret Garden Hostel Quito",
      area: "Quito",
      status: "review",
      statusText: "Contact verified",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Request rates",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: "Reservations",
      phone: "+593 99 357 2714 / +593 99 198 0027",
      email: "hola@secretgardenquito.com",
      website: "https://www.secretgardenquito.com/",
      recommendation: "pending",
      followUp: "",
      followUpDue: false,
      owner: "",
      breakfast: "To confirm",
      note: "Public contact verified September 19, 2026."
    },
    {
      id: "mindo-chocolate-makers",
      category: "services",
      type: "Experience",
      name: "Mindo Chocolate Makers",
      area: "Mindo",
      status: "pending",
      statusText: "Awaiting rates",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Pending",
      pricingBasis: "Per experience",
      rateValidTo: "Pending",
      contact: "Experience team",
      phone: "",
      email: "ecuador@mindochocolate.com",
      website: "https://www.elquetzaldemindo.com/",
      recommendation: "pending",
      followUp: "2026-10-02",
      followUpDue: true,
      owner: "Juan",
      preferred: true,
      verifiedResponse: true,
      responseVerifiedAt: "2026-09-25",
      replyTaskId: "mindo-chocolate-2026-09-25",
      replyAcknowledged: false,
      replySubject: "Colaboración local: Mindo Bird Watching + Mindo Chocolate Makers",
      replyDraft: "Estimados amigos de Mindo Chocolate Makers,\n\nMuchas gracias por su respuesta y por aclararnos que trabajan como experiencia y no como alojamiento. Nos interesa mucho poder recomendar a nuestros viajeros sus experiencias de chocolate, cacao y café.\n\nPara completar nuestro registro, ¿nos podrían compartir las tarifas para operadores o aliados locales, la duración y horarios de cada experiencia, las condiciones de reserva y cualquier material o fotografía autorizada para promoción?\n\nQuedamos atentos y agradecemos mucho su interés en colaborar con Mindo Bird Watching.\n\nSaludos cordiales,\nJuan\nMindo Bird Watching",
      breakfast: "Café and restaurant available",
      amenities: ["Chocolate tour", "Cacao legend tour", "Coffee tour", "Make-your-own chocolate bar", "Café", "Restaurant"],
      note: "Request operator pricing and booking terms for chocolate, cacao, coffee, and make-your-own-bar experiences."
    }
  ];

  var guestEstimateSnapshot = {
    "cabanas-armonia": { estimated_guest_count: 8, estimated_stay_count: 4, last_guest_date: "2026-07-12" },
    "sachatamia-lodge": { estimated_guest_count: 2, estimated_stay_count: 2, last_guest_date: "2026-08-24" },
    "bellavista-cloud-forest": { estimated_guest_count: 1, estimated_stay_count: 1, last_guest_date: "2026-08-31" },
    "toucan-platinum-suites": { estimated_guest_count: 1, estimated_stay_count: 1, last_guest_date: "2026-08-26" },
    "royal-river-suites": { estimated_guest_count: 2, estimated_stay_count: 1, last_guest_date: "2026-08-06" },
    "casa-de-vista-alta": { estimated_guest_count: 6, estimated_stay_count: 3, last_guest_date: "2026-09-15" },
    "las-terrazas-de-dana": { estimated_guest_count: 7, estimated_stay_count: 3, last_guest_date: "2026-09-01" },
    "terrabambu-lodge": { estimated_guest_count: 19, estimated_stay_count: 7, last_guest_date: "2026-09-24" },
    "la-casa-de-cecilia": { estimated_guest_count: 6, estimated_stay_count: 6, last_guest_date: "2026-09-18" },
    "secret-garden-quito": { estimated_guest_count: 1, estimated_stay_count: 1, last_guest_date: "2026-05-01" }
  };

  var elements = {
    cards: document.getElementById("recommendationsCards"),
    detail: document.getElementById("recommendationsDetail"),
    empty: document.getElementById("recommendationsEmpty"),
    search: document.getElementById("recommendationsSearch"),
    type: document.getElementById("recommendationsType"),
    decision: document.getElementById("recommendationsDecision"),
    signal: document.getElementById("recommendationsSignal"),
    title: document.getElementById("recommendationsSectionTitle"),
    count: document.getElementById("recommendationsResultCount"),
    dataStatus: document.getElementById("recommendationsDataStatus"),
    dataMessage: document.getElementById("recommendationsDataMessage"),
    toast: document.getElementById("recommendationsToast"),
    dialog: document.getElementById("addRecommendationDialog"),
    form: document.getElementById("addRecommendationForm")
  };

  var state = loadState();
  var partners = seedPartners.map(function (partner) {
    var merged = Object.assign({ preferred: false, estimateStatus: "loading", estimatedGuests: 0, estimatedStays: 0, lastGuestDate: "" }, partner, state.updates[partner.id] || {});
    if (merged.verifiedResponse) merged.preferred = true;
    return merged;
  }).concat((state.customPartners || []).map(function (partner) {
    return Object.assign({ preferred: false, estimateStatus: "not-matched", estimatedGuests: 0, estimatedStays: 0, lastGuestDate: "" }, partner);
  }));
  var activeCategory = "accommodations";
  var selectedId = partners.find(function (partner) { return partner.category === activeCategory; }).id;
  var currentView = "cards";
  var expandedPartnerId = "";
  var toastTimer;

  function loadState() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        updates: parsed.updates && typeof parsed.updates === "object" ? parsed.updates : {},
        customPartners: Array.isArray(parsed.customPartners) ? parsed.customPartners : []
      };
    } catch (error) {
      return { updates: {}, customPartners: [] };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("This browser could not save the change");
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character];
    });
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      elements.toast.classList.remove("is-visible");
    }, 1900);
  }

  function storePartnerUpdate(partner) {
    if (partner.custom) {
      state.customPartners = partners.filter(function (item) { return item.custom; });
    } else {
      state.updates[partner.id] = {
        recommendation: partner.recommendation,
        followUp: partner.followUp,
        followUpDue: partner.followUpDue,
        owner: partner.owner,
        note: partner.note,
        preferred: Boolean(partner.preferred),
        replyAcknowledged: Boolean(partner.replyAcknowledged)
      };
    }
    saveState();
  }

  function categoryPartners(category) {
    return partners.filter(function (partner) { return partner.category === category; });
  }

  function recommendationLabel(value) {
    if (value === "yes") return "Recommended";
    if (value === "no") return "Not recommended";
    return "Pending decision";
  }

  function breakfastSignal(partner) {
    var value = String(partner.breakfast || "").toLowerCase();
    if (/takeaway|box breakfast (from|available)|boxed breakfast/.test(value)) return "available";
    if (/confirm.*(box|takeaway)|box breakfast.*confirm/.test(value)) return "confirm";
    return "none";
  }

  function friendlyDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "Not available";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"));
  }

  function guestSignal(partner) {
    if (partner.estimateStatus === "loading") return '<span class="recommendationSignal recommendationSignal--pending">Loading guest estimate</span>';
    if (partner.estimateStatus !== "ready" && partner.estimateStatus !== "snapshot") return '<span class="recommendationSignal recommendationSignal--pending">Guest estimate unavailable</span>';
    var guests = Math.max(0, Number(partner.estimatedGuests) || 0);
    if (!guests) return '<span class="recommendationSignal recommendationSignal--guests">No matched MBW stays</span>';
    return '<span class="recommendationSignal recommendationSignal--guests" title="Estimate from completed tours and matched invoice pickup locations"><strong>~' + guests + '</strong> MBW guest' + (guests === 1 ? '' : 's') + '</span>';
  }

  function hasGuestEstimate(partner) {
    return (partner.estimateStatus === "ready" || partner.estimateStatus === "snapshot") && Number(partner.estimatedGuests) > 0;
  }

  function preferredMarkup(partner, detail) {
    if (partner.verifiedResponse) {
      return '<span class="recommendationVerified' + (detail ? ' recommendationVerified--detail' : '') + '" title="The partner responded directly and these details were verified">★ <span>Verified response</span></span>';
    }
    var active = Boolean(partner.preferred);
    var label = active ? "Preferred" : "Prefer";
    var attribute = detail ? "data-detail-preferred" : "data-preferred";
    return '<button class="' + (detail ? 'recommendationsDetailPreferred' : 'recommendationPreferred') + '" type="button" ' + attribute + ' aria-pressed="' + active + '" aria-label="' + (active ? 'Remove preferred status for ' : 'Mark as preferred: ') + escapeHtml(partner.name) + '" title="' + (active ? 'Remove preferred status' : 'Mark as preferred') + '">' + (active ? '★' : '☆') + ' <span>' + label + '</span></button>';
  }

  function amenitiesMarkup(partner) {
    if (!Array.isArray(partner.amenities) || !partner.amenities.length) return "";
    var serviceRows = (partner.services || []).map(function (service) {
      return '<div class="recommendationsServiceRow"><span>' + escapeHtml(service.name) + '</span><strong>' + escapeHtml(service.price) + '</strong></div>';
    }).join("");
    var rateRows = (partner.roomRates || []).map(function (rate) {
      return '<tr><th scope="row">' + escapeHtml(rate.room) + '</th><td>' + escapeHtml(rate.single) + '</td><td>' + escapeHtml(rate.double) + '</td><td>' + escapeHtml(rate.triple) + '</td><td>' + escapeHtml(rate.family) + '</td></tr>';
    }).join("");
    return '<section class="recommendationsEnrichment"' + (expandedPartnerId === partner.id ? '' : ' hidden') + '>' +
      '<h3>Amenities &amp; services</h3>' +
      '<div class="recommendationsAmenityList">' + partner.amenities.map(function (amenity) { return '<span>' + escapeHtml(amenity) + '</span>'; }).join("") + '</div>' +
      (serviceRows ? '<h3>Services &amp; experiences</h3><div class="recommendationsServiceList">' + serviceRows + '</div>' : '') +
      (rateRows ? '<h3>Internal agency room rates</h3><div class="recommendationsRateWrap"><table class="recommendationsRateTable"><thead><tr><th>Room</th><th>Single</th><th>Double</th><th>Triple</th><th>Family</th></tr></thead><tbody>' + rateRows + '</tbody></table></div><p class="recommendationsConfidential">Internal only. Rates exclude taxes and must not be included in guest-ready copy.</p>' : '') +
    '</section>';
  }

  function guestSummaryText(partner) {
    var lines = [partner.name, partner.guestSummary || ""];
    if (partner.address) lines.push("Location: " + partner.address);
    if (partner.mapUrl) lines.push("Google Maps: " + partner.mapUrl);
    if (partner.website) lines.push("Website: " + partner.website);
    return lines.filter(Boolean).join("\n\n");
  }

  function replyNeeded(partner) {
    return Boolean(partner.verifiedResponse && partner.replyDraft && !partner.replyAcknowledged);
  }

  function replyConversationCount() {
    var tasks = {};
    partners.filter(replyNeeded).forEach(function (partner) {
      tasks[partner.replyTaskId || partner.id] = true;
    });
    return Object.keys(tasks).length;
  }

  function gmailReplyUrl(partner) {
    return "https://mail.google.com/mail/u/0/#search/" + encodeURIComponent('subject:"' + partner.replySubject + '"');
  }

  function replyPanelMarkup(partner) {
    if (!partner.verifiedResponse || !partner.replyDraft) return "";
    var status = partner.replyAcknowledged ? "Reply marked sent" : "Reply needed";
    return '<section class="recommendationsReplyPanel' + (partner.replyAcknowledged ? ' is-complete' : '') + '">' +
      '<div class="recommendationsReplyHeader"><div><span>Partner response</span><h3>' + status + '</h3></div><span class="recommendationsReplyStatus">' + (partner.replyAcknowledged ? 'Acknowledged' : 'Action needed') + '</span></div>' +
      '<p>Review the Spanish acknowledgment, copy it, then open the existing Gmail conversation. Sending remains a deliberate final step.</p>' +
      '<div class="recommendationsReplyActions"><button type="button" data-copy-reply>Copy reply draft</button><a href="' + escapeHtml(gmailReplyUrl(partner)) + '" target="_blank" rel="noopener noreferrer">Open Gmail thread ↗</a><button type="button" data-mark-replied>' + (partner.replyAcknowledged ? 'Mark reply needed' : 'Mark replied') + '</button></div>' +
      '<details><summary>Preview reply</summary><pre>' + escapeHtml(partner.replyDraft) + '</pre></details>' +
    '</section>';
  }

  function isFollowUpDue(dateValue) {
    if (!dateValue) return false;
    var followUpDate = new Date(dateValue + "T12:00:00");
    var cutoff = new Date();
    cutoff.setHours(23, 59, 59, 999);
    cutoff.setDate(cutoff.getDate() + 7);
    return followUpDate <= cutoff;
  }

  function updateMetrics() {
    document.getElementById("metricPartners").textContent = partners.length;
    document.getElementById("metricRecommended").textContent = partners.filter(function (partner) { return partner.recommendation === "yes"; }).length;
    document.getElementById("metricPending").textContent = partners.filter(function (partner) { return partner.recommendation === "pending"; }).length;
    document.getElementById("metricDue").textContent = partners.filter(function (partner) { return partner.followUpDue; }).length;
    document.getElementById("metricPreferred").textContent = partners.filter(function (partner) { return partner.preferred; }).length;
    document.getElementById("metricReplies").textContent = replyConversationCount();
    document.querySelectorAll("[data-category-count]").forEach(function (element) {
      element.textContent = categoryPartners(element.dataset.categoryCount).length;
    });
  }

  function updateTypeOptions() {
    var previous = elements.type.value;
    var types = categoryPartners(activeCategory).map(function (partner) { return partner.type; }).filter(function (value, index, list) {
      return list.indexOf(value) === index;
    }).sort();
    elements.type.innerHTML = '<option value="all">All subtypes</option>' + types.map(function (type) {
      return '<option value="' + escapeHtml(type) + '">' + escapeHtml(type) + '</option>';
    }).join("");
    elements.type.value = types.indexOf(previous) >= 0 ? previous : "all";
  }

  function filteredPartners() {
    var query = elements.search.value.trim().toLowerCase();
    return partners.filter(function (partner) {
      var searchable = [partner.name, partner.type, partner.area, partner.contact, partner.email, partner.phone].join(" ").toLowerCase();
      return partner.category === activeCategory &&
        (!query || searchable.indexOf(query) >= 0) &&
        (elements.type.value === "all" || partner.type === elements.type.value) &&
        (elements.decision.value === "all" || partner.recommendation === elements.decision.value) &&
        (elements.signal.value === "all" ||
          (elements.signal.value === "preferred" && partner.preferred) ||
          (elements.signal.value === "boxed_breakfast" && breakfastSignal(partner) === "available") ||
          (elements.signal.value === "verified_response" && partner.verifiedResponse) ||
          (elements.signal.value === "reply_needed" && replyNeeded(partner)) ||
          (elements.signal.value === "guest_history" && hasGuestEstimate(partner)));
    });
  }

  function cardMarkup(partner) {
    var hasEmail = Boolean(partner.email);
    var hasPhone = Boolean(partner.phone);
    var breakfast = breakfastSignal(partner);
    return '' +
      '<article class="recommendationCard' + (partner.id === selectedId ? ' is-selected' : '') + '" data-partner-id="' + escapeHtml(partner.id) + '">' +
        '<div class="recommendationCardTop">' +
          '<div><div class="recommendationType">' + escapeHtml(partner.type) + '</div><h3>' + escapeHtml(partner.name) + '</h3><div class="recommendationLocation">⌖ ' + escapeHtml(partner.area || "Area pending") + '</div></div>' +
          '<div class="recommendationCardStatus">' + preferredMarkup(partner, false) + '<span class="recommendationBadge recommendationBadge--' + escapeHtml(partner.status) + '">' + escapeHtml(partner.statusText) + '</span></div>' +
        '</div>' +
        '<div class="recommendationSignals">' +
          (breakfast === 'available' ? '<span class="recommendationSignal recommendationSignal--breakfast">🥡 Box breakfast</span>' : breakfast === 'confirm' ? '<span class="recommendationSignal">? Confirm box breakfast</span>' : '') +
          (replyNeeded(partner) ? '<span class="recommendationSignal recommendationSignal--reply">Reply needed</span>' : partner.verifiedResponse && partner.replyAcknowledged ? '<span class="recommendationSignal recommendationSignal--replied">Replied</span>' : '') +
          (partner.category === 'accommodations' ? guestSignal(partner) : '') +
        '</div>' +
        '<div class="recommendationPricing">' +
          '<div><span>Regular price</span><strong>' + escapeHtml(partner.regularPrice) + '</strong></div>' +
          '<div><span>Our price</span><strong>' + escapeHtml(partner.ourPrice) + '</strong></div>' +
          '<div class="recommendationSavings">' + escapeHtml(partner.savings) + '</div>' +
        '</div>' +
        '<div class="recommendationContact">' +
          '<div><small>Direct contact</small><strong>' + escapeHtml(partner.contact || "Add contact") + '</strong></div>' +
          '<div class="recommendationCopyActions">' +
            '<button class="recommendationCopyButton" type="button" data-copy="email"' + (hasEmail ? '' : ' disabled') + '>Copy email</button>' +
            '<button class="recommendationCopyButton" type="button" data-copy="phone"' + (hasPhone ? '' : ' disabled') + '>Copy WhatsApp</button>' +
          '</div>' +
        '</div>' +
        '<div class="recommendationDecision"><span>Recommend?</span>' +
          ['yes', 'no', 'pending'].map(function (decision) {
            return '<button class="recommendationDecisionButton" type="button" data-decision="' + decision + '" aria-pressed="' + (partner.recommendation === decision) + '">' + (decision === 'yes' ? 'Yes' : decision === 'no' ? 'No' : 'Pending') + '</button>';
          }).join("") +
        '</div>' +
        '<div class="recommendationCardBottom">' +
          '<div class="recommendationFollowUp' + (partner.followUpDue ? ' is-due' : '') + '">Next follow-up<strong>' + escapeHtml(partner.followUp || "Not scheduled") + '</strong></div>' +
          '<button class="recommendationDetailButton" type="button" data-view-detail="' + escapeHtml(partner.id) + '">Open profile →</button>' +
        '</div>' +
      '</article>';
  }

  function renderCards() {
    var filtered = filteredPartners();
    elements.cards.classList.toggle("is-list", currentView === "list");
    elements.cards.innerHTML = filtered.map(cardMarkup).join("");
    elements.cards.style.display = filtered.length ? "grid" : "none";
    elements.empty.style.display = filtered.length ? "none" : "block";
    elements.count.textContent = filtered.length + " partner" + (filtered.length === 1 ? "" : "s") + " shown";

    if (filtered.length && !filtered.some(function (partner) { return partner.id === selectedId; })) {
      selectedId = filtered[0].id;
    }
    renderDetail();
  }

  function renderDetail() {
    var partner = partners.find(function (item) { return item.id === selectedId; });
    if (!partner || partner.category !== activeCategory) {
      partner = categoryPartners(activeCategory)[0];
      selectedId = partner ? partner.id : "";
    }

    if (!partner) {
      elements.detail.style.display = "none";
      return;
    }

    elements.detail.style.display = "block";
    elements.detail.innerHTML = '' +
      (partner.image ? '<div class="recommendationsPartnerImage"><img src="' + escapeHtml(partner.image) + '" alt="' + escapeHtml(partner.imageAlt || partner.name) + '" loading="lazy" referrerpolicy="no-referrer" /><span>Official property photo</span></div>' : '') +
      '<div class="recommendationsDetailHeader">' +
        '<div class="recommendationsDetailHeaderTop"><div><div class="recommendationType">Selected partner profile</div><h2 tabindex="-1" id="selectedPartnerHeading">' + escapeHtml(partner.name) + '</h2></div>' + preferredMarkup(partner, true) + '</div>' +
        '<p>' + escapeHtml(partner.type) + ' · ' + escapeHtml(partner.area || "Area pending") + ' · ' + escapeHtml(recommendationLabel(partner.recommendation)) + '</p>' +
      '</div>' +
      '<div class="recommendationsDetailBody">' +
        '<div class="recommendationsDetailActions">' +
          '<button class="recommendationsDetailAction recommendationsDetailAction--primary" type="button" data-detail-copy="email"' + (partner.email ? '' : ' disabled') + '>Copy email</button>' +
          '<button class="recommendationsDetailAction" type="button" data-detail-copy="phone"' + (partner.phone ? '' : ' disabled') + '>Copy WhatsApp</button>' +
          (partner.website ? '<a class="recommendationsDetailAction" href="' + escapeHtml(partner.website) + '" target="_blank" rel="noopener noreferrer">Open website ↗</a>' : '') +
          (partner.mapUrl ? '<a class="recommendationsDetailAction" href="' + escapeHtml(partner.mapUrl) + '" target="_blank" rel="noopener noreferrer">Open map ↗</a>' : '') +
          (partner.mapUrl ? '<button class="recommendationsDetailAction" type="button" data-copy-map>Copy map link</button>' : '') +
          (partner.guestSummary ? '<button class="recommendationsDetailAction recommendationsDetailAction--share" type="button" data-copy-summary>Copy guest summary</button>' : '') +
          (partner.amenities ? '<button class="recommendationsDetailAction" type="button" data-toggle-enrichment>' + (expandedPartnerId === partner.id ? 'Hide amenities' : 'Amenities & services') + '</button>' : '') +
        '</div>' +
        '<div class="recommendationsDetailLabel">Partner details</div>' +
        '<div class="recommendationsFacts">' +
          '<div class="recommendationsFact"><span>Contact</span><strong>' + escapeHtml(partner.contact || "Pending") + '</strong></div>' +
          '<div class="recommendationsFact"><span>Email</span><strong>' + escapeHtml(partner.email || "Pending") + '</strong></div>' +
          '<div class="recommendationsFact"><span>WhatsApp / phone</span><strong>' + escapeHtml(partner.phone || "Pending") + '</strong></div>' +
          '<div class="recommendationsFact"><span>Pricing basis</span><strong>' + escapeHtml(partner.pricingBasis) + '</strong></div>' +
          '<div class="recommendationsFact"><span>Rate validity</span><strong>' + escapeHtml(partner.rateValidTo) + '</strong></div>' +
          (partner.address ? '<div class="recommendationsFact"><span>Address</span><strong>' + escapeHtml(partner.address) + '</strong></div>' : '') +
          '<div class="recommendationsFact"><span>Breakfast / service</span><strong>' + escapeHtml(partner.breakfast) + '</strong></div>' +
          '<div class="recommendationsFact"><span>Box breakfast</span><strong>' + (breakfastSignal(partner) === 'available' ? 'Available' : breakfastSignal(partner) === 'confirm' ? 'Needs confirmation' : 'Not recorded') + '</strong></div>' +
          '<div class="recommendationsFact"><span>Estimated MBW guests</span><strong>' + (hasGuestEstimate(partner) ? '~' + Math.max(0, Number(partner.estimatedGuests) || 0) : 'No matches') + '</strong></div>' +
          '<div class="recommendationsFact"><span>Estimated guest stays</span><strong>' + ((partner.estimateStatus === 'ready' || partner.estimateStatus === 'snapshot') ? Math.max(0, Number(partner.estimatedStays) || 0) : 'Unavailable') + '</strong></div>' +
          '<div class="recommendationsFact"><span>Last matched pickup</span><strong>' + ((partner.estimateStatus === 'ready' || partner.estimateStatus === 'snapshot') ? escapeHtml(friendlyDate(partner.lastGuestDate)) : 'Unavailable') + '</strong></div>' +
          (partner.verifiedResponse ? '<div class="recommendationsFact recommendationsFact--verified"><span>Information status</span><strong>Direct response · ' + escapeHtml(friendlyDate(partner.responseVerifiedAt)) + '</strong></div>' : '') +
        '</div>' +
        (partner.category === 'accommodations' ? '<p class="recommendationsEstimateNote">Invoice estimate only. A matched pickup location suggests the guest stayed here, but it is not a confirmed lodging record.</p>' : '') +
        replyPanelMarkup(partner) +
        amenitiesMarkup(partner) +
        '<div class="recommendationsDetailLabel">Attention</div>' +
        '<div class="recommendationsNotice">' + escapeHtml(partner.note || "No notes yet.") + '</div>' +
        '<div class="recommendationsDetailLabel">Follow-up tracking</div>' +
        '<div class="recommendationsFollowUpFields">' +
          '<label class="recommendationsField"><span>Next follow-up</span><input id="detailFollowUp" type="date" value="' + escapeHtml(partner.followUp || "") + '" /></label>' +
          '<label class="recommendationsField"><span>Owner</span><input id="detailOwner" value="' + escapeHtml(partner.owner || "") + '" placeholder="Assign owner" /></label>' +
          '<label class="recommendationsField recommendationsField--full"><span>Internal note</span><textarea id="detailNote">' + escapeHtml(partner.note || "") + '</textarea></label>' +
        '</div>' +
        '<button class="recommendationsSaveFollowUp" id="savePartnerTracking" type="button">Save tracking</button>' +
      '</div>';
  }

  async function copyText(value, label) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      var textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast(label + " copied");
  }

  function switchCategory(category) {
    activeCategory = category;
    document.querySelectorAll("[data-category]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.category === category));
    });
    elements.title.textContent = CATEGORY_LABELS[category];
    var first = categoryPartners(category)[0];
    selectedId = first ? first.id : "";
    updateTypeOptions();
    renderCards();
  }

  function addPartner(formData) {
    var name = String(formData.get("name") || "").trim();
    var category = String(formData.get("category") || "accommodations");
    var id = "custom-" + Date.now();
    var partner = {
      id: id,
      custom: true,
      category: category,
      type: String(formData.get("type") || "Partner").trim(),
      name: name,
      area: String(formData.get("area") || "").trim(),
      status: "pending",
      statusText: "New entry",
      regularPrice: "—",
      ourPrice: "—",
      savings: "Pending",
      pricingBasis: "Pending",
      rateValidTo: "Pending",
      contact: String(formData.get("contact") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      website: String(formData.get("website") || "").trim(),
      recommendation: "pending",
      followUp: "",
      followUpDue: false,
      owner: "",
      preferred: false,
      estimateStatus: "not-matched",
      estimatedGuests: 0,
      estimatedStays: 0,
      lastGuestDate: "",
      breakfast: "To confirm",
      note: "New partner entry. Add pricing, service details, and review notes."
    };
    partners.push(partner);
    state.customPartners.push(partner);
    saveState();
    elements.form.reset();
    elements.dialog.close();
    updateMetrics();
    switchCategory(category);
    selectedId = id;
    renderCards();
    showToast(name + " added");
  }

  document.querySelectorAll("[data-category]").forEach(function (button) {
    button.addEventListener("click", function () { switchCategory(button.dataset.category); });
  });

  [elements.search, elements.type, elements.decision, elements.signal].forEach(function (element) {
    element.addEventListener(element === elements.search ? "input" : "change", renderCards);
  });

  document.querySelectorAll("[data-view]").forEach(function (button) {
    button.addEventListener("click", function () {
      currentView = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach(function (item) {
        item.setAttribute("aria-pressed", String(item === button));
      });
      renderCards();
    });
  });

  elements.cards.addEventListener("click", function (event) {
    var card = event.target.closest("[data-partner-id]");
    if (!card) return;
    var partner = partners.find(function (item) { return item.id === card.dataset.partnerId; });
    if (!partner) return;

    var copyButton = event.target.closest("[data-copy]");
    if (copyButton) {
      var copyKey = copyButton.dataset.copy;
      copyText(partner[copyKey], copyKey === "email" ? "Email" : "WhatsApp");
      return;
    }

    var decisionButton = event.target.closest("[data-decision]");
    if (decisionButton) {
      partner.recommendation = decisionButton.dataset.decision;
      storePartnerUpdate(partner);
      updateMetrics();
      renderCards();
      showToast("Recommendation updated");
      return;
    }

    var preferredButton = event.target.closest("[data-preferred]");
    if (preferredButton) {
      partner.preferred = !partner.preferred;
      storePartnerUpdate(partner);
      updateMetrics();
      renderCards();
      showToast(partner.preferred ? "Marked as preferred" : "Preferred status removed");
      return;
    }

    var detailButton = event.target.closest("[data-view-detail]");
    if (detailButton) {
      selectedId = detailButton.dataset.viewDetail;
      expandedPartnerId = "";
      renderCards();
      window.requestAnimationFrame(function () {
        var heading = document.getElementById("selectedPartnerHeading");
        if (heading) { heading.focus({ preventScroll: true }); elements.detail.scrollIntoView({ behavior: "smooth", block: "start" }); }
      });
    }
  });

  elements.detail.addEventListener("click", function (event) {
    var partner = partners.find(function (item) { return item.id === selectedId; });
    if (!partner) return;

    var copyButton = event.target.closest("[data-detail-copy]");
    if (copyButton) {
      var copyKey = copyButton.dataset.detailCopy;
      copyText(partner[copyKey], copyKey === "email" ? "Email" : "WhatsApp");
      return;
    }

    if (event.target.closest("[data-copy-map]")) {
      copyText(partner.mapUrl, "Google Maps link");
      return;
    }

    if (event.target.closest("[data-copy-summary]")) {
      copyText(guestSummaryText(partner), "Guest summary");
      return;
    }

    if (event.target.closest("[data-copy-reply]")) {
      copyText(partner.replyDraft, "Reply draft");
      return;
    }

    if (event.target.closest("[data-mark-replied]")) {
      var nextState = !partner.replyAcknowledged;
      partners.filter(function (item) { return (item.replyTaskId || item.id) === (partner.replyTaskId || partner.id); }).forEach(function (item) {
        item.replyAcknowledged = nextState;
        storePartnerUpdate(item);
      });
      updateMetrics();
      renderCards();
      showToast(nextState ? "Reply marked as sent" : "Reply returned to queue");
      return;
    }

    if (event.target.closest("[data-toggle-enrichment]")) {
      expandedPartnerId = expandedPartnerId === partner.id ? "" : partner.id;
      renderDetail();
      return;
    }

    if (event.target.closest("[data-detail-preferred]")) {
      partner.preferred = !partner.preferred;
      storePartnerUpdate(partner);
      updateMetrics();
      renderCards();
      showToast(partner.preferred ? "Marked as preferred" : "Preferred status removed");
      return;
    }

    if (event.target.id === "savePartnerTracking") {
      partner.followUp = document.getElementById("detailFollowUp").value;
      partner.owner = document.getElementById("detailOwner").value.trim();
      partner.note = document.getElementById("detailNote").value.trim();
      partner.followUpDue = isFollowUpDue(partner.followUp);
      storePartnerUpdate(partner);
      updateMetrics();
      renderCards();
      showToast("Tracking saved");
    }
  });

  document.getElementById("addRecommendation").addEventListener("click", function () {
    elements.dialog.showModal();
  });
  document.getElementById("closeRecommendationDialog").addEventListener("click", function () { elements.dialog.close(); });
  document.getElementById("cancelRecommendationDialog").addEventListener("click", function () { elements.dialog.close(); });
  elements.form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;
    addPartner(new FormData(elements.form));
  });

  async function loadGuestEstimates() {
    try {
      var response = await fetch("/api/admin/recommendation-guest-estimates/", { headers: { accept: "application/json" }, cache: "no-store" });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok || !payload.ok || !Array.isArray(payload.estimates)) throw new Error(payload.message || "Estimate request failed");

      var byPartner = {};
      payload.estimates.forEach(function (estimate) { byPartner[estimate.partner_id] = estimate; });
      partners.forEach(function (partner) {
        if (partner.category !== "accommodations" || partner.custom) return;
        var liveEstimate = byPartner[partner.id];
        var estimate = liveEstimate || guestEstimateSnapshot[partner.id] || {};
        partner.estimateStatus = liveEstimate ? "ready" : (guestEstimateSnapshot[partner.id] ? "snapshot" : "ready");
        partner.estimatedGuests = Math.max(0, Number(estimate.estimated_guest_count) || 0);
        partner.estimatedStays = Math.max(0, Number(estimate.estimated_stay_count) || 0);
        partner.lastGuestDate = estimate.last_guest_date || "";
      });
      elements.dataStatus.textContent = "Invoice estimates live";
      elements.dataMessage.textContent = payload.source_last_tour_date ? "Completed tours through " + friendlyDate(payload.source_last_tour_date) + ". Same guest and property within 14 days counts as one estimated stay." : "Completed tours are matched by pickup location; repeat tours within 14 days are deduplicated.";
    } catch (error) {
      partners.forEach(function (partner) {
        if (partner.category !== "accommodations" || partner.custom) return;
        var estimate = guestEstimateSnapshot[partner.id];
        if (!estimate) {
          partner.estimateStatus = "unavailable";
          return;
        }
        partner.estimateStatus = "snapshot";
        partner.estimatedGuests = estimate.estimated_guest_count;
        partner.estimatedStays = estimate.estimated_stay_count;
        partner.lastGuestDate = estimate.last_guest_date;
      });
      elements.dataStatus.textContent = "Invoice snapshot";
      elements.dataMessage.textContent = "Showing the latest verified invoice snapshot through Sep 24, 2026. Activate the workflow for automatic refreshes.";
    }
    renderCards();
  }

  updateMetrics();
  updateTypeOptions();
  renderCards();
  loadGuestEstimates();
})();
