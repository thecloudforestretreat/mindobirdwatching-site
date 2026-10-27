/** =========================================================
 * MBW Book a Tour Form
 * Google Sheet + Brevo Transactional Email
 *
 * Deploy as Web App:
 *   - Execute as: Me
 *   - Who has access: Anyone
 *
 * Script Properties required:
 *   CF_SHARED_SECRET
 *   BREVO_API_KEY
 *
 * Optional existing Script Property:
 *   TURNSTILE_SECRET
 *
 * Notes:
 *   - Sheet tab name: book_tour
 *   - Column headers are snake_case
 *   - Cloudflare Turnstile is verified in the Cloudflare Pages Function
 *   - Apps Script requires cf_secret from Cloudflare
 *   - Guest confirmation email is Spanish when source_page contains /es/
 *   - Customer confirmation sends from bookings@mindobirdwatching.com
 *   - Customer replies go to tours@mindobirdwatching.com
 *   - Internal notification sends from notifications@mindobirdwatching.com
 *   - Internal notification goes to bookings@mindobirdwatching.com
 * ========================================================= */

const SPREADSHEET_ID = "1rdPmYmhCehx_3bI737dkg8NyiutwIu3NAav7B-mbwlw";
const SHEET_NAME = "book_tour";

const NOTIFY_TO_EMAIL = "bookings@mindobirdwatching.com";

const CUSTOMER_FROM_EMAIL = "bookings@mindobirdwatching.com";
const CUSTOMER_REPLY_TO_EMAIL = "tours@mindobirdwatching.com";

const INTERNAL_FROM_EMAIL = "notifications@mindobirdwatching.com";

const FROM_NAME = "Mindo Bird Watching";

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

const EMAIL_SUBJECT_CONFIRMATION_EN = "We received your tour request ✅";
const EMAIL_SUBJECT_CONFIRMATION_ES = "Recibimos tu solicitud de tour ✅";
const EMAIL_SUBJECT_INTERNAL = "New Tour Request - Book a Tour";


/* =========================================================
 * SCRIPT PROPERTIES
 * ========================================================= */

function getScriptProperty_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getCfSharedSecret_() {
  return getScriptProperty_("CF_SHARED_SECRET") || "";
}

function getBrevoApiKey_() {
  return getScriptProperty_("BREVO_API_KEY") || "";
}


/* =========================================================
 * SHEET
 * ========================================================= */

function ensureSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);

  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }

  const headers = [
    "timestamp",
    "submitted_at",
    "first_name",
    "last_name",
    "email",
    "country",
    "country_code",
    "phone_number",
    "message_questions",
    "dates_of_visit",
    "number_of_guests",
    "preferred_tour_type",
    "accommodation_needs",
    "special_interests",
    "how_did_you_hear_about_us",
    "source_page",
    "user_agent",
    "ip_best-effort",
    "status",
    "notes",
    "tour_add_ons",
    "tour_type",
    "tour_category",
    "interest_category",
    "service_type",
    "product_selected",
    "duration_preference",
    "grouping_preference",
    "transportation_needed",
    "tour_items",
    "tour_items_json",
    "tour_count",
    "tour_content",
    "contact_intent_id",
    "website_visitor_id",
    "website_session_id",
    "attribution_status",
    "attribution_quality",
    "first_touch_source",
    "first_touch_medium",
    "first_touch_campaign",
    "first_touch_content",
    "first_touch_term",
    "first_touch_landing_page",
    "first_touch_referrer",
    "first_touch_date",
    "last_touch_source",
    "last_touch_medium",
    "last_touch_campaign",
    "last_touch_content",
    "last_touch_term",
    "last_touch_landing_page",
    "last_touch_referrer",
    "last_touch_date",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid"
  ];

  if (sh.getMaxColumns() < headers.length) {
    sh.insertColumnsAfter(
      sh.getMaxColumns(),
      headers.length - sh.getMaxColumns()
    );
  }

  const firstRow = sh.getRange(1, 1, 1, headers.length).getValues()[0];

  const isEmpty = firstRow.every(function(v) {
    return String(v || "").trim() === "";
  });

  if (isEmpty) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sh.autoResizeColumns(1, headers.length);
  } else {
    const existing = sh
      .getRange(1, 1, 1, sh.getLastColumn())
      .getDisplayValues()[0]
      .map(String);

    const missing = headers.filter(function(header) {
      return existing.indexOf(header) < 0;
    });

    if (missing.length) {
      const requiredColumns = sh.getLastColumn() + missing.length;

      if (sh.getMaxColumns() < requiredColumns) {
        sh.insertColumnsAfter(
          sh.getMaxColumns(),
          requiredColumns - sh.getMaxColumns()
        );
      }

      sh
        .getRange(1, sh.getLastColumn() + 1, 1, missing.length)
        .setValues([missing]);

      sh
        .getRange(1, 1, 1, sh.getLastColumn())
        .setFontWeight("bold");
    }
  }

  return sh;
}


function appendDataRow_(sh, data) {
  const headers = sh
    .getRange(1, 1, 1, sh.getLastColumn())
    .getDisplayValues()[0]
    .map(String);

  sh.appendRow(
    headers.map(function(header) {
      if (header === "ip_best-effort") {
        return data.ip_best_effort || "";
      }

      return data[header] === undefined || data[header] === null
        ? ""
        : data[header];
    })
  );
}


/* =========================================================
 * DATA HELPERS
 * ========================================================= */

function sanitize_(v) {
  if (v === null || v === undefined) {
    return "";
  }

  return String(v).trim();
}

function escapeHtml_(v) {
  return sanitize_(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlWithBreaks_(v) {
  return escapeHtml_(v).replace(/\r?\n/g, "<br>");
}

function getParam_(obj, key) {
  if (!obj) {
    return "";
  }

  if (obj[key] !== undefined) {
    return sanitize_(obj[key]);
  }

  const alt = key.replace(/_([a-z])/g, function(_, c) {
    return c.toUpperCase();
  });

  if (obj[alt] !== undefined) {
    return sanitize_(obj[alt]);
  }

  return "";
}

function nowIso_() {
  const d = new Date();

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isSpanish_(data) {
  const sp = data && data.source_page ? String(data.source_page) : "";
  return sp.indexOf("/es/") !== -1;
}


/* =========================================================
 * BREVO
 * ========================================================= */

function sendBrevoEmail_(options) {
  const apiKey = getBrevoApiKey_();

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is missing from Script Properties.");
  }

  const toRecipient = {
    email: options.toEmail
  };

  if (options.toName) {
    toRecipient.name = options.toName;
  }

  const payload = {
    sender: {
      name: options.senderName || FROM_NAME,
      email: options.senderEmail
    },
    to: [toRecipient],
    subject: options.subject,
    htmlContent: options.htmlContent
  };

  if (options.replyToEmail) {
    payload.replyTo = {
      email: options.replyToEmail
    };

    if (options.replyToName) {
      payload.replyTo.name = options.replyToName;
    }
  }

  const response = UrlFetchApp.fetch(BREVO_SEND_URL, {
    method: "post",
    contentType: "application/json",
    headers: {
      "api-key": apiKey,
      "accept": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(
      "Brevo API error " + statusCode + ": " + responseText
    );
  }

  return responseText;
}


/* =========================================================
 * SIGNATURE
 * ========================================================= */

function getSignatureIcons_() {
  return [
    {
      href: "https://www.mindobirdwatching.com",
      img: "https://i.imgur.com/fSPayjc.png",
      alt: "Website",
      w: 30,
      h: 30
    },
    {
      href: "https://www.instagram.com/mindobirdwatching/",
      img: "https://cdn-icons-png.flaticon.com/512/2111/2111463.png",
      alt: "Instagram",
      w: 30,
      h: 30
    },
    {
      href: "https://www.tiktok.com/@mindobirdwatching",
      img: "https://cdn-icons-png.flaticon.com/512/3046/3046121.png",
      alt: "TikTok",
      w: 30,
      h: 30
    },
    {
      href: "https://t.me/+ANc1KHoV2Y82NmI5",
      img: "https://cdn-icons-png.flaticon.com/512/2111/2111646.png",
      alt: "Telegram",
      w: 30,
      h: 30
    },
    {
      href: "https://www.facebook.com/mindobirdwatching",
      img: "https://cdn-icons-png.flaticon.com/512/733/733547.png",
      alt: "Facebook",
      w: 30,
      h: 30
    },
    {
      href: "https://x.com/mindobirds",
      img: "https://cdn-icons-png.flaticon.com/512/5968/5968958.png",
      alt: "X",
      w: 30,
      h: 30
    },
    {
      href: "https://www.youtube.com/@MindoBirdWatching",
      img: "https://cdn-icons-png.flaticon.com/512/1384/1384060.png",
      alt: "YouTube",
      w: 30,
      h: 30
    },
    {
      href: "https://pin.it/6O8GN1PRz",
      img: "https://i.imgur.com/kSrXjXZ.png",
      alt: "Pinterest",
      w: 30,
      h: 30
    },
    {
      href: "https://g.page/r/CdMlIYMGgBIvEAE/review",
      img: "https://i.imgur.com/fBPIjvV.png",
      alt: "Google Review",
      w: 35,
      h: 35
    },
    {
      href: "https://wa.me/13054585402",
      img: "https://i.imgur.com/0sfOKs8.png",
      alt: "WhatsApp",
      w: 30,
      h: 30
    },
    {
      href: "https://mindobirdwatching.com/shop",
      img: "https://i.imgur.com/g53OeDX.png",
      alt: "Shop",
      w: 30,
      h: 30
    }
  ];
}

function buildIconRowHtml_() {
  const icons = getSignatureIcons_();

  return icons
    .map(function(i) {
      return (
        '<td style="padding:0 6px 0 0; vertical-align:middle;">' +
          '<a href="' +
          i.href +
          '" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">' +
            '<img src="' +
            i.img +
            '" alt="' +
            i.alt +
            '" width="' +
            i.w +
            '" height="' +
            i.h +
            '" style="display:block; border:0; outline:none;">' +
          '</a>' +
        '</td>'
      );
    })
    .join("");
}

function buildSignatureHtml_() {
  return (
    '<div style="margin-top:18px;">' +
      '<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#1a1a1a; line-height:1.5;">' +
        '<div>Warm Regards,</div>' +
        '<div style="margin-top:10px; font-weight:700;">The Mindo Bird Watching Team</div>' +
        '<div><a href="https://www.mindobirdwatching.com" target="_blank" rel="noopener noreferrer">www.mindobirdwatching.com</a></div>' +
      '</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px; border-collapse:collapse;">' +
        '<tr>' + buildIconRowHtml_() + '</tr>' +
      '</table>' +
    '</div>'
  );
}

function buildSignatureHtmlEs_() {
  return (
    '<div style="margin-top:18px;">' +
      '<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; color:#1a1a1a; line-height:1.5;">' +
        '<div>Saludos cordiales,</div>' +
        '<div style="margin-top:10px; font-weight:700;">El equipo de Mindo Bird Watching</div>' +
        '<div><a href="https://www.mindobirdwatching.com" target="_blank" rel="noopener noreferrer">www.mindobirdwatching.com</a></div>' +
      '</div>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px; border-collapse:collapse;">' +
        '<tr>' + buildIconRowHtml_() + '</tr>' +
      '</table>' +
    '</div>'
  );
}


/* =========================================================
 * CUSTOMER CONFIRMATION - EN
 * ========================================================= */

function buildConfirmationEmailHtmlEn_(data) {
  const firstName = data.first_name || "there";

  const fullName = [data.first_name, data.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const phone = [data.country_code, data.phone_number]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    '<div style="font-family:Arial,Helvetica,sans-serif; color:#1a1a1a; line-height:1.6; font-size:14px;">' +
      '<p style="margin:0 0 10px;">Hi ' + escapeHtml_(firstName) + ',</p>' +
      '<p style="margin:0 0 12px;">Thanks for reaching out. We received your tour request and we will get back to you shortly with next steps.</p>' +
      '<div style="border:1px solid #e6e6e6; border-radius:12px; padding:14px; background:#fafafa;">' +
        '<div style="font-weight:700; margin-bottom:8px;">Your request details</div>' +
        '<div><strong>Name:</strong> ' + escapeHtml_(fullName) + '</div>' +
        '<div><strong>Email:</strong> ' + escapeHtml_(data.email) + '</div>' +
        (phone ? '<div><strong>Phone / WhatsApp:</strong> ' + escapeHtml_(phone) + '</div>' : '') +
        (data.dates_of_visit ? '<div><strong>Dates of visit:</strong> ' + escapeHtml_(data.dates_of_visit) + '</div>' : '') +
        (data.number_of_guests ? '<div><strong>Guests:</strong> ' + escapeHtml_(data.number_of_guests) + '</div>' : '') +
        (data.preferred_tour_type ? '<div><strong>Preferred tour type:</strong> ' + escapeHtml_(data.preferred_tour_type) + '</div>' : '') +
        (data.tour_add_ons ? '<div><strong>Optional additions:</strong> ' + escapeHtml_(data.tour_add_ons) + '</div>' : '') +
        (data.accommodation_needs ? '<div><strong>Accommodation needs:</strong> ' + escapeHtml_(data.accommodation_needs) + '</div>' : '') +
        (data.special_interests ? '<div><strong>Special interests:</strong> ' + escapeHtml_(data.special_interests) + '</div>' : '') +
        (data.message_questions ? '<div style="margin-top:10px;"><strong>Message:</strong><br>' + htmlWithBreaks_(data.message_questions) + '</div>' : '') +
      '</div>' +
      '<p style="margin:12px 0 0; color:#555;">If anything changes (dates, group size, goals), just reply to this email.</p>' +
      buildBrandSignatureHtml_(data, false) +
    '</div>'
  );
}


/* =========================================================
 * CUSTOMER CONFIRMATION - ES
 * ========================================================= */

// Localize known form selections for customer email display only.
// Raw submissions, CRM values, free text, and English emails stay unchanged.
function spanishSelectionLabel_(value) {
  const labels = {
    "Half-Day Tour": "Avistamiento de medio día",
    "Full-Day Tour": "Avistamiento de día completo",
    "Photography-Focused Tour": "Tour enfocado en fotografía",
    "Night Walk": "Caminata nocturna",
    "Quito to Mindo Day Trip": "Viaje de un día de Quito a Mindo",
    "Custom / Private Tour": "Tour privado personalizado",
    "Not Sure Yet": "Aún no estoy seguro",
    "Multi-Day": "Tour de varios días",
    "Activities": "Actividades",
    "Activity": "Actividad",
    "Canyoning": "Canyoning",
    "Waterfall Tour": "Tour de cascadas",
    "Chocolate Tour": "Tour de chocolate",
    "Coffee Tour": "Tour de café",
    "Ziplining": "Canopy",
    "Frog Concert": "Concierto de ranas",
    "Private Insect & Macro Wildlife Search": "Búsqueda Privada de Insectos y Macrofauna",
    "Butterfly Tour": "Mariposario",
    "Mountain Biking": "Ciclismo de montaña",
    "Nature Walk": "Caminata naturalista",
    "Trail Running": "Running en senderos",
    "Tubing": "Tubing",
    "Quad Tour": "Tour en quad",
    "Orchid Garden Tour": "Jardín de orquídeas",
    "Horseback Riding": "Cabalgata",
    "Double Extreme Swing": "Columpio extremo doble",
    "Sky Bike / Sky Ride": "Sky Bike / Sky Ride",
    "Paintball": "Paintball",
    "Combination": "Combinación",
    "Private Tour": "Tour privado",
    "Join a Small Group": "Unirse a un grupo pequeño",
    "Either Private or Small Group": "Tour privado o grupo pequeño; cualquiera de las dos opciones",
    "Additional Birding Day": "Día adicional de avistamiento de aves",
    "Transportation": "Transporte",
    "Accommodation Assistance": "Ayuda con el alojamiento",
    "Other Activity or Tour": "Otra actividad o tour"
  };
  const text = String(value || "");
  return Object.prototype.hasOwnProperty.call(labels, text) ? labels[text] : text;
}

function spanishAddOnsLabel_(value) {
  return String(value || "").split(" | ").map(function(item) {
    if (item.indexOf("Tour Format: ") === 0) {
      return "Formato del tour: " + spanishSelectionLabel_(item.slice(13));
    }
    if (item.indexOf("Other: ") === 0) return "Otra actividad: " + item.slice(7);
    return spanishSelectionLabel_(item);
  }).join(" | ");
}

function buildConfirmationEmailHtmlEs_(data) {
  const firstName = data.first_name || "hola";

  const fullName = [data.first_name, data.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const phone = [data.country_code, data.phone_number]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    '<div style="font-family:Arial,Helvetica,sans-serif; color:#1a1a1a; line-height:1.6; font-size:14px;">' +
      '<p style="margin:0 0 10px;">Hola ' + escapeHtml_(firstName) + ',</p>' +
      '<p style="margin:0 0 12px;">Gracias por escribirnos. Recibimos tu solicitud de tour y pronto te enviaremos los próximos pasos.</p>' +
      '<div style="border:1px solid #e6e6e6; border-radius:12px; padding:14px; background:#fafafa;">' +
        '<div style="font-weight:700; margin-bottom:8px;">Detalles de tu solicitud</div>' +
        '<div><strong>Nombre:</strong> ' + escapeHtml_(fullName) + '</div>' +
        '<div><strong>Email:</strong> ' + escapeHtml_(data.email) + '</div>' +
        (phone ? '<div><strong>Teléfono / WhatsApp:</strong> ' + escapeHtml_(phone) + '</div>' : '') +
        (data.dates_of_visit ? '<div><strong>Fechas de visita:</strong> ' + escapeHtml_(data.dates_of_visit) + '</div>' : '') +
        (data.number_of_guests ? '<div><strong>Personas:</strong> ' + escapeHtml_(data.number_of_guests) + '</div>' : '') +
        (data.preferred_tour_type ? '<div><strong>Tipo de tour preferido:</strong> ' + escapeHtml_(spanishSelectionLabel_(data.preferred_tour_type)) + '</div>' : '') +
        (data.tour_add_ons ? '<div><strong>Adiciones opcionales:</strong> ' + escapeHtml_(spanishAddOnsLabel_(data.tour_add_ons)) + '</div>' : '') +
        (data.accommodation_needs ? '<div><strong>Necesidades de alojamiento:</strong> ' + escapeHtml_(data.accommodation_needs) + '</div>' : '') +
        (data.special_interests ? '<div><strong>Intereses especiales:</strong> ' + escapeHtml_(data.special_interests) + '</div>' : '') +
        (data.message_questions ? '<div style="margin-top:10px;"><strong>Mensaje:</strong><br>' + htmlWithBreaks_(data.message_questions) + '</div>' : '') +
      '</div>' +
      '<p style="margin:12px 0 0; color:#555;">Si algo cambia (fechas, tamaño del grupo, objetivos), solo responde a este email.</p>' +
      buildBrandSignatureHtml_(data, true) +
    '</div>'
  );
}


/* =========================================================
 * INTERNAL NOTIFICATION
 * ========================================================= */

function buildInternalEmailHtml_(data) {
  const fullName = [data.first_name, data.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  const phone = [data.country_code, data.phone_number]
    .filter(Boolean)
    .join(" ")
    .trim();

  const spanish = isSpanish_(data);

  return (
    '<div style="font-family:Arial,Helvetica,sans-serif; color:#1a1a1a; line-height:1.6; font-size:14px;">' +
      '<div style="font-weight:800; font-size:16px; margin-bottom:10px;">New Book a Tour submission</div>' +
      '<div style="margin-bottom:10px;"><strong>Language:</strong> ' + (spanish ? "Spanish" : "English") + '</div>' +
      '<div style="border:1px solid #e6e6e6; border-radius:12px; padding:14px; background:#fafafa;">' +
        '<div><strong>submitted_at:</strong> ' + escapeHtml_(data.submitted_at) + '</div>' +
        '<div><strong>Name:</strong> ' + escapeHtml_(fullName) + '</div>' +
        '<div><strong>Email:</strong> ' + escapeHtml_(data.email) + '</div>' +
        (phone ? '<div><strong>Phone:</strong> ' + escapeHtml_(phone) + '</div>' : '') +
        (data.dates_of_visit ? '<div><strong>dates_of_visit:</strong> ' + escapeHtml_(data.dates_of_visit) + '</div>' : '') +
        (data.number_of_guests ? '<div><strong>number_of_guests:</strong> ' + escapeHtml_(data.number_of_guests) + '</div>' : '') +
        (data.preferred_tour_type ? '<div><strong>preferred_tour_type:</strong> ' + escapeHtml_(data.preferred_tour_type) + '</div>' : '') +
        (data.tour_add_ons ? '<div><strong>tour_add_ons:</strong> ' + escapeHtml_(data.tour_add_ons) + '</div>' : '') +
        (data.accommodation_needs ? '<div><strong>accommodation_needs:</strong> ' + escapeHtml_(data.accommodation_needs) + '</div>' : '') +
        (data.special_interests ? '<div><strong>special_interests:</strong> ' + escapeHtml_(data.special_interests) + '</div>' : '') +
        (data.how_did_you_hear_about_us ? '<div><strong>how_did_you_hear_about_us:</strong> ' + escapeHtml_(data.how_did_you_hear_about_us) + '</div>' : '') +
        (data.source_page ? '<div><strong>source_page:</strong> ' + escapeHtml_(data.source_page) + '</div>' : '') +
        (data.user_agent ? '<div><strong>user_agent:</strong> ' + escapeHtml_(data.user_agent) + '</div>' : '') +
        (data.ip_best_effort ? '<div><strong>ip-best-effort:</strong> ' + escapeHtml_(data.ip_best_effort) + '</div>' : '') +
        (data.message_questions ? '<div style="margin-top:10px;"><strong>message_questions:</strong><br>' + htmlWithBreaks_(data.message_questions) + '</div>' : '') +
      '</div>' +
    '</div>'
  );
}


/* =========================================================
 * SETUP / HEALTH CHECK
 * ========================================================= */

function setupHeaders() {
  ensureSheet_();
}

function doGet() {
  return jsonResponse_({
    ok: true,
    message: "MBW Book a Tour endpoint is live."
  });
}


/* =========================================================
 * POST
 * ========================================================= */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    let payload = {};

    const contentType =
      e && e.postData && e.postData.type
        ? e.postData.type
        : "";

    if (
      contentType.indexOf("application/json") !== -1 &&
      e.postData &&
      e.postData.contents
    ) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }


    /* -------------------------------------------------------
     * SECURITY
     * ------------------------------------------------------- */

    const cfSharedSecret = getCfSharedSecret_();

    if (!cfSharedSecret) {
      return jsonResponse_({
        ok: false,
        message: "Server config error: CF_SHARED_SECRET not set."
      });
    }

    const providedSecret = getParam_(payload, "cf_secret");

    if (!providedSecret || providedSecret !== cfSharedSecret) {
      return jsonResponse_({
        ok: false,
        message: "Unauthorized source"
      });
    }


    /* -------------------------------------------------------
     * DATA
     * ------------------------------------------------------- */

    const sh = ensureSheet_();

    // Backward compatibility: accept older field names too.
    const msg =
      getParam_(payload, "message_questions") ||
      getParam_(payload, "message");

    const heard =
      getParam_(payload, "how_did_you_hear_about_us") ||
      getParam_(payload, "how_hear");

    const ip =
      getParam_(payload, "ip_best_effort") ||
      getParam_(payload, "ip-best-effort") ||
      getParam_(payload, "ip");

    const submittedAt = nowIso_();

    const data = {
      timestamp: submittedAt,
      submitted_at: submittedAt,
      first_name: getParam_(payload, "first_name"),
      last_name: getParam_(payload, "last_name"),
      email: getParam_(payload, "email"),
      country: getParam_(payload, "country"),
      country_code: getParam_(payload, "country_code"),
      phone_number: getParam_(payload, "phone_number"),
      message_questions: msg,
      dates_of_visit: getParam_(payload, "dates_of_visit"),
      number_of_guests: getParam_(payload, "number_of_guests"),
      preferred_tour_type: getParam_(payload, "preferred_tour_type"),
      tour_add_ons: getParam_(payload, "tour_add_ons"),
      tour_type: getParam_(payload, "tour_type"),
      tour_category: getParam_(payload, "tour_category"),
      interest_category: getParam_(payload, "interest_category"),
      service_type: getParam_(payload, "service_type"),
      product_selected: getParam_(payload, "product_selected"),
      duration_preference: getParam_(payload, "duration_preference"),
      grouping_preference: getParam_(payload, "grouping_preference"),
      transportation_needed: getParam_(payload, "transportation_needed"),
      tour_items: getParam_(payload, "tour_items"),
      tour_items_json: getParam_(payload, "tour_items_json"),
      tour_count: getParam_(payload, "tour_count"),
      tour_content: getParam_(payload, "tour_content"),
      accommodation_needs: getParam_(payload, "accommodation_needs"),
      special_interests: getParam_(payload, "special_interests"),
      how_did_you_hear_about_us: heard,
      source_page: getParam_(payload, "source_page"),
      user_agent: getParam_(payload, "user_agent"),
      ip_best_effort: ip,
      contact_intent_id: getParam_(payload, "contact_intent_id"),
      website_visitor_id: getParam_(payload, "website_visitor_id"),
      website_session_id: getParam_(payload, "website_session_id"),
      attribution_status: getParam_(payload, "attribution_status"),
      attribution_quality: getParam_(payload, "attribution_quality"),
      first_touch_source: getParam_(payload, "first_touch_source"),
      first_touch_medium: getParam_(payload, "first_touch_medium"),
      first_touch_campaign: getParam_(payload, "first_touch_campaign"),
      first_touch_content: getParam_(payload, "first_touch_content"),
      first_touch_term: getParam_(payload, "first_touch_term"),
      first_touch_landing_page: getParam_(payload, "first_touch_landing_page"),
      first_touch_referrer: getParam_(payload, "first_touch_referrer"),
      first_touch_date: getParam_(payload, "first_touch_date"),
      last_touch_source: getParam_(payload, "last_touch_source"),
      last_touch_medium: getParam_(payload, "last_touch_medium"),
      last_touch_campaign: getParam_(payload, "last_touch_campaign"),
      last_touch_content: getParam_(payload, "last_touch_content"),
      last_touch_term: getParam_(payload, "last_touch_term"),
      last_touch_landing_page: getParam_(payload, "last_touch_landing_page"),
      last_touch_referrer: getParam_(payload, "last_touch_referrer"),
      last_touch_date: getParam_(payload, "last_touch_date"),
      utm_source: getParam_(payload, "utm_source"),
      utm_medium: getParam_(payload, "utm_medium"),
      utm_campaign: getParam_(payload, "utm_campaign"),
      utm_content: getParam_(payload, "utm_content"),
      utm_term: getParam_(payload, "utm_term"),
      gclid: getParam_(payload, "gclid"),
      gbraid: getParam_(payload, "gbraid"),
      wbraid: getParam_(payload, "wbraid"),
      fbclid: getParam_(payload, "fbclid")
    };


    /* -------------------------------------------------------
     * VALIDATION
     * ------------------------------------------------------- */

    const requiredMissing =
      !data.first_name ||
      !data.last_name ||
      !data.email ||
      !data.phone_number ||
      !data.message_questions;

    if (requiredMissing) {
      return jsonResponse_({
        ok: false,
        message:
          "Missing required fields. Please fill First Name, Last Name, Email, Phone Number, and Message."
      });
    }


    /* -------------------------------------------------------
     * SAVE FIRST
     * ------------------------------------------------------- */

    data.status = "";
    data.notes = "";

    appendDataRow_(sh, data);


    /* -------------------------------------------------------
     * SEND EMAILS
     * ------------------------------------------------------- */

    let warning = "";

    try {
      const spanish = isSpanish_(data);

      // Customer confirmation.
      sendBrevoEmail_({
        senderName: FROM_NAME,
        senderEmail: CUSTOMER_FROM_EMAIL,
        toEmail: data.email,
        toName: [data.first_name, data.last_name]
          .filter(Boolean)
          .join(" ")
          .trim(),
        replyToEmail: CUSTOMER_REPLY_TO_EMAIL,
        replyToName: "Mindo Bird Watching Tours",
        subject: spanish
          ? EMAIL_SUBJECT_CONFIRMATION_ES
          : EMAIL_SUBJECT_CONFIRMATION_EN,
        htmlContent: spanish
          ? buildConfirmationEmailHtmlEs_(data)
          : buildConfirmationEmailHtmlEn_(data)
      });

      // Internal booking notification.
      sendBrevoEmail_({
        senderName: FROM_NAME,
        senderEmail: INTERNAL_FROM_EMAIL,
        toEmail: NOTIFY_TO_EMAIL,
        replyToEmail: data.email,
        replyToName: [data.first_name, data.last_name]
          .filter(Boolean)
          .join(" ")
          .trim(),
        subject:
          '[' + brandProfile_(data).code + '] ' + EMAIL_SUBJECT_INTERNAL +
          (spanish ? " [LANG: ES]" : " [LANG: EN]") +
          " - " +
          data.first_name +
          " " +
          data.last_name,
        htmlContent: buildBrandInternalEmailHtml_(data)
      });

    } catch (mailErr) {
      console.error("Brevo email error:", mailErr);

      warning =
        "Saved your request, but email sending failed temporarily.";
    }


    /* -------------------------------------------------------
     * RESPONSE
     * ------------------------------------------------------- */

    return jsonResponse_({
      ok: true,
      warning: warning
    });

  } catch (err) {
    console.error("Book a Tour endpoint error:", err);

    return jsonResponse_({
      ok: false,
      message: "Server error. Please try again in a moment."
    });

  } finally {
    lock.releaseLock();
  }
}
