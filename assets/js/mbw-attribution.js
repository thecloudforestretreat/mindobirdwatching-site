/* Mindo Bird Watching — first-party attribution collector
 * Version: 1.0.0
 * Stores anonymous visitor/session attribution and sends it to Cloudflare D1.
 */
(function () {
  "use strict";

  if (window.MBWAttribution && window.MBWAttribution.version) return;
  if (window.top !== window.self) return;

  var VERSION = "1.0.0";
  var ENDPOINT = "/api/attribution/session";
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
    }
  };

  send(state);
})();
