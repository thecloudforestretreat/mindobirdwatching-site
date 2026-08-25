/* Mindo Bird Watching — first-party attribution collector
 * Version: 1.1.0
 * Stores anonymous visitor/session attribution and sends it to Cloudflare D1.
 */
(function () {
  "use strict";

  if (window.MBWAttribution && window.MBWAttribution.version) return;
  if (window.top !== window.self) return;

  var VERSION = "1.1.0";
  var ENDPOINT = "/api/attribution/session";
  var CONTACT_ENDPOINT = "/api/attribution/contact-intent";
  var STORAGE_KEY = "mbw_attribution_v1";
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var MAX_STORAGE_AGE_MS = 180 * 24 * 60 * 60 * 1000;
  var EXCLUDED_PATHS = [/^\/admin(?:\/|$)/i, /^\/book-tour\/pay(?:\/|$)/i];
  var TRACKING_KEYS = [
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

  if (EXCLUDED_PATHS.some(function (pattern) {
    return pattern.test(window.location.pathname || "/");
  })) return;

  function nowIso() {
    return new Date().toISOString();
  }

  function validDate(value) {
    var parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function makeId(prefix) {
    var value;
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      value = window.crypto.randomUUID();
    } else if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      value = Array.prototype.map.call(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    } else {
      value = Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
    return prefix + "_" + value;
  }

  function makeContactIntentId() {
    var timePart = Date.now().toString(36).slice(-6);
    var randomPart = "";

    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(5);
      window.crypto.getRandomValues(bytes);
      randomPart = Array.prototype.map.call(bytes, function (byte) {
        return (byte % 36).toString(36);
      }).join("");
    } else {
      randomPart = Math.random().toString(36).slice(2, 7).padEnd(5, "0");
    }

    return "ci_" + timePart + randomPart;
  }

  function readStorage() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      if (validDate(parsed.updated_at) < Date.now() - MAX_STORAGE_AGE_MS) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeStorage(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function cleanValue(value, maxLength) {
    if (value === null || value === undefined) return null;
    var cleaned = String(value).trim();
    return cleaned ? cleaned.slice(0, maxLength || 255) : null;
  }

  function trackingParameters() {
    var input = new URLSearchParams(window.location.search || "");
    var values = {};
    TRACKING_KEYS.forEach(function (key) {
      values[key] = cleanValue(input.get(key), key.indexOf("clid") !== -1 || key === "gbraid" || key === "wbraid" ? 512 : 255);
    });
    return values;
  }

  function safeLandingPage() {
    var safe = new URL(window.location.origin + window.location.pathname);
    var current = new URLSearchParams(window.location.search || "");
    TRACKING_KEYS.forEach(function (key) {
      var value = cleanValue(current.get(key), 512);
      if (value) safe.searchParams.set(key, value);
    });
    return safe.toString().slice(0, 2048);
  }

  function safeReferrer() {
    if (!document.referrer) return null;
    try {
      var referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin) return null;
      return (referrer.origin + referrer.pathname).slice(0, 2048);
    } catch (error) {
      return null;
    }
  }

  function referrerHost() {
    if (!document.referrer) return "";
    try {
      var referrer = new URL(document.referrer);
      return referrer.origin === window.location.origin ? "" : referrer.hostname.toLowerCase();
    } catch (error) {
      return "";
    }
  }

  function classifyTouch(params) {
    var host = referrerHost();
    var source = params.utm_source;
    var medium = params.utm_medium;

    if (!source && (params.gclid || params.gbraid || params.wbraid)) {
      source = "google";
      medium = "paid_search";
    } else if (!source && params.fbclid) {
      source = "meta";
      medium = "paid_social";
    } else if (!source && host) {
      if (/google\.|bing\.|yahoo\.|duckduckgo\./i.test(host)) {
        source = host.replace(/^www\./, "").split(".")[0];
        medium = "organic";
      } else if (/facebook\.|instagram\.|t\.co$|twitter\.|linkedin\./i.test(host)) {
        source = host.replace(/^www\./, "").split(".")[0];
        medium = "social";
      } else {
        source = host.replace(/^www\./, "");
        medium = "referral";
      }
    } else if (!source) {
      source = "direct";
      medium = "none";
    }

    return {
      source: cleanValue(source),
      medium: cleanValue(medium || (source ? "unknown" : null)),
      campaign: params.utm_campaign,
      content: params.utm_content,
      term: params.utm_term,
      landing_page: safeLandingPage(),
      referrer: safeReferrer(),
      date: nowIso()
    };
  }

  function hasInboundSignal(params) {
    return TRACKING_KEYS.some(function (key) { return Boolean(params[key]); }) || Boolean(referrerHost());
  }

  function createState() {
    var timestamp = nowIso();
    var params = trackingParameters();
    var touch = classifyTouch(params);
    return {
      version: VERSION,
      visitor_id: makeId("v"),
      first_seen_at: timestamp,
      last_seen_at: timestamp,
      consent_status: "unknown",
      first_touch: touch,
      last_touch: touch,
      click_ids: {
        gclid: params.gclid,
        gbraid: params.gbraid,
        wbraid: params.wbraid,
        fbclid: params.fbclid
      },
      session_id: makeId("s"),
      session_started_at: timestamp,
      last_activity_at: timestamp,
      updated_at: timestamp
    };
  }

  function updateState(existing) {
    var state = existing || createState();
    var timestamp = nowIso();
    var params = trackingParameters();
    var isNewSession = !validDate(state.last_activity_at) ||
      validDate(state.last_activity_at) < Date.now() - SESSION_TIMEOUT_MS;

    if (!state.visitor_id || !state.first_touch) return createState();

    if (!state.click_ids || typeof state.click_ids !== "object") {
      state.click_ids = { gclid: null, gbraid: null, wbraid: null, fbclid: null };
    }

    if (!state.session_id || !state.session_started_at) {
      isNewSession = true;
    }

    if (isNewSession) {
      state.session_id = makeId("s");
      state.session_started_at = timestamp;
    }

    if (isNewSession || hasInboundSignal(params)) {
      state.last_touch = classifyTouch(params);
    }

    ["gclid", "gbraid", "wbraid", "fbclid"].forEach(function (key) {
      if (params[key]) state.click_ids[key] = params[key];
    });

    state.last_seen_at = timestamp;
    state.last_activity_at = timestamp;
    state.updated_at = timestamp;
    state.version = VERSION;
    return state;
  }

  function currentUtm(state) {
    var touch = state.last_touch || {};
    return {
      source: touch.source,
      medium: touch.medium,
      campaign: touch.campaign,
      content: touch.content,
      term: touch.term
    };
  }

  function statusFor(state) {
    var touch = state.last_touch || {};
    if (touch.source === "direct") return "direct";
    if (touch.source && touch.medium) return "captured";
    if (touch.source || touch.medium) return "partial";
    return "unavailable";
  }

  function payloadFor(state) {
    return {
      visitor: {
        visitor_id: state.visitor_id,
        first_seen_at: state.first_seen_at,
        last_seen_at: state.last_seen_at,
        consent_status: state.consent_status || "unknown"
      },
      session: {
        session_id: state.session_id,
        session_started_at: state.session_started_at,
        last_activity_at: state.last_activity_at,
        first_touch: state.first_touch,
        last_touch: state.last_touch,
        utm: currentUtm(state),
        click_ids: state.click_ids,
        attribution_status: statusFor(state)
      }
    };
  }

  function send(state) {
    return window.fetch(ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payloadFor(state))
    }).then(function (response) {
      if (!response.ok) throw new Error("Attribution endpoint returned " + response.status);
      return response.json();
    }).catch(function (error) {
      if (window.console && typeof window.console.warn === "function") {
        window.console.warn("MBW attribution was not saved", error);
      }
      return { ok: false };
    });
  }

  function contactType(anchor) {
    var href = (anchor.getAttribute("href") || "").trim();
    if (!href) return null;
    if (anchor.hasAttribute("data-whatsapp-message-key")) return "whatsapp";
    if (/^(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)(?:\/|$)/i.test(href)) return "whatsapp";
    if (/^whatsapp:/i.test(href)) return "whatsapp";
    if (/^mailto:/i.test(href)) return "email_link";
    return null;
  }

  function whatsappDestination(url, anchor) {
    var configured = cleanValue(anchor.getAttribute("data-whatsapp-number"), 32);
    if (configured) return configured.replace(/\D/g, "");

    var pathNumber = (url.pathname || "").replace(/\D/g, "");
    if (pathNumber) return pathNumber;

    return cleanValue(url.searchParams.get("phone"), 32);
  }

  function agentForDestination(destination, anchor) {
    var explicit = cleanValue(anchor.getAttribute("data-agent-id"), 64);
    if (explicit) return explicit;

    var digits = String(destination || "").replace(/\D/g, "");
    if (digits === "13054585402") return "susana";
    if (digits === "593969076501") return "mbw_admin";
    return null;
  }

  function addReferenceToWhatsApp(anchor, contactIntentId) {
    var href = anchor.getAttribute("href") || "";
    var url;
    try {
      url = new URL(href, window.location.origin);
    } catch (error) {
      return null;
    }

    var language = (document.documentElement.lang || "en").toLowerCase();
    var referenceLabel = language.indexOf("es") === 0 ? "Referencia" : "Reference";
    var referenceLine = referenceLabel + ": " + contactIntentId;
    var message = cleanValue(url.searchParams.get("text"), 3500) || "";
    if (message.indexOf(contactIntentId) === -1) {
      message = message ? message + "\n\n" + referenceLine : referenceLine;
    }
    url.searchParams.set("text", message);
    anchor.setAttribute("href", url.toString());

    return {
      destination: whatsappDestination(url, anchor),
      agent_id: agentForDestination(whatsappDestination(url, anchor), anchor)
    };
  }

  function addReferenceToEmail(anchor, contactIntentId) {
    var href = anchor.getAttribute("href") || "";
    var url;
    try {
      url = new URL(href);
    } catch (error) {
      return null;
    }

    var language = (document.documentElement.lang || "en").toLowerCase();
    var referenceLabel = language.indexOf("es") === 0 ? "Referencia" : "Reference";
    var referenceLine = referenceLabel + ": " + contactIntentId;
    var body = cleanValue(url.searchParams.get("body"), 3500) || "";
    if (body.indexOf(contactIntentId) === -1) {
      body = body ? body + "\n\n" + referenceLine : referenceLine;
    }
    url.searchParams.set("body", body);
    anchor.setAttribute("href", url.toString());

    return {
      destination: cleanValue(url.pathname, 320),
      agent_id: cleanValue(anchor.getAttribute("data-agent-id"), 64)
    };
  }

  function contactPayload(anchor, channel, contactIntentId, details) {
    var dataset = anchor.dataset || {};
    var label = cleanValue(dataset.analyticsLabel, 320) ||
      cleanValue(anchor.getAttribute("aria-label"), 320) ||
      cleanValue(anchor.textContent, 320);

    return {
      contact_intent_id: contactIntentId,
      visitor_id: state.visitor_id,
      session_id: state.session_id,
      channel: channel,
      agent_id: details && details.agent_id,
      destination: details && details.destination,
      message_key: cleanValue(anchor.getAttribute("data-whatsapp-message-key"), 128),
      tour_interest: cleanValue(dataset.analyticsTour || dataset.analyticsGuide || label, 320),
      page_url: safeLandingPage(),
      cta_location: cleanValue(dataset.analyticsLocation, 128),
      cta_label: label,
      page_language: cleanValue(dataset.analyticsPageLanguage || document.documentElement.lang || "en", 12),
      intent_status: "opened",
      attribution_quality: statusFor(state) === "captured" ? "verified" : "partial",
      occurred_at: nowIso()
    };
  }

  function sendContactIntent(payload) {
    return window.fetch(CONTACT_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (response.status === 409) {
        return send(state).then(function () {
          return window.fetch(CONTACT_ENDPOINT, {
            method: "POST",
            credentials: "same-origin",
            keepalive: true,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
          });
        });
      }
      return response;
    }).catch(function (error) {
      if (window.console && typeof window.console.warn === "function") {
        window.console.warn("MBW contact intent was not saved", error);
      }
      return null;
    });
  }

  function handleContactClick(event) {
    var target = event.target;
    var anchor = target && typeof target.closest === "function" ? target.closest("a") : null;
    if (!anchor) return;

    var channel = contactType(anchor);
    if (!channel) return;

    var contactIntentId = makeContactIntentId();
    var details = channel === "whatsapp"
      ? addReferenceToWhatsApp(anchor, contactIntentId)
      : addReferenceToEmail(anchor, contactIntentId);

    if (!details) return;
    sendContactIntent(contactPayload(anchor, channel, contactIntentId, details));
  }

  var state = updateState(readStorage());
  writeStorage(state);

  window.MBWAttribution = {
    version: VERSION,
    getIds: function () {
      return {
        visitor_id: state.visitor_id,
        session_id: state.session_id
      };
    },
    getAttribution: function () {
      return JSON.parse(JSON.stringify(payloadFor(state)));
    },
    setConsent: function (status) {
      if (["unknown", "accepted", "rejected"].indexOf(status) === -1) return false;
      state.consent_status = status;
      state.updated_at = nowIso();
      writeStorage(state);
      send(state);
      return true;
    },
    refresh: function () {
      state = updateState(state);
      writeStorage(state);
      return send(state);
    },
    createContactIntent: function (anchor) {
      if (!anchor || anchor.tagName !== "A") return null;
      var channel = contactType(anchor);
      if (!channel) return null;
      var contactIntentId = makeContactIntentId();
      var details = channel === "whatsapp"
        ? addReferenceToWhatsApp(anchor, contactIntentId)
        : addReferenceToEmail(anchor, contactIntentId);
      if (!details) return null;
      sendContactIntent(contactPayload(anchor, channel, contactIntentId, details));
      return contactIntentId;
    }
  };

  document.addEventListener("click", handleContactClick, true);
  send(state);
})();
