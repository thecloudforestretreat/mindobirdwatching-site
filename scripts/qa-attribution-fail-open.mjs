import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const siteConfigSource = fs.readFileSync(new URL("assets/js/site-config.js", root), "utf8");
const siteSource = fs.readFileSync(new URL("assets/js/site.js", root), "utf8");
const endpointSource = fs.readFileSync(new URL("functions/api/attribution/client-error.js", root), "utf8");

function nextTurn() {
  return new Promise(resolve => setImmediate(resolve));
}

async function testBrowserFailOpen() {
  const documentListeners = {};
  const beaconPayloads = [];
  const pendingWindow = {
    closed: false,
    opener: {},
    location: { replace(value) { pendingWindow.destination = value; } },
  };
  let attributionScript = null;

  const document = {
    readyState: "complete",
    body: { getAttribute() { return "en"; } },
    documentElement: { getAttribute() { return "en"; } },
    head: {
      appendChild(node) {
        attributionScript = node;
        node.parentNode = document.head;
      },
      removeChild(node) {
        if (attributionScript === node) attributionScript = null;
      },
    },
    createElement(tagName) {
      return {
        tagName: String(tagName).toUpperCase(),
        attributes: {},
        addEventListener(type, handler) { this[`on${type}`] = handler; },
        setAttribute(name, value) { this.attributes[name] = value; },
      };
    },
    querySelector(selector) {
      return selector === 'script[data-mbw-attribution="true"]' ? attributionScript : null;
    },
    querySelectorAll() { return []; },
    addEventListener(type, handler) { documentListeners[type] = handler; },
  };

  const window = {
    MBW_SITE_CONFIG: {},
    location: { href: "https://mindobirdwatching.com/tours/?utm_source=meta" },
    navigator: {
      sendBeacon(url, body) {
        beaconPayloads.push({ url, body });
        return true;
      },
    },
    console,
    open() { return pendingWindow; },
    fetch() { return Promise.resolve({ ok: true }); },
    setTimeout(handler) { queueMicrotask(handler); return 1; },
  };

  const sandbox = {
    window,
    document,
    MutationObserver: class { observe() {} },
    Blob,
    Promise,
    URL,
    console,
    Math,
    Date,
  };
  vm.runInNewContext(siteConfigSource, sandbox, { filename: "site-config.js" });
  await nextTurn();

  const originalHref = "https://wa.me/13054585402?text=Hello";
  const anchor = {
    tagName: "A",
    textContent: "WhatsApp",
    attributes: { href: originalHref, target: "_blank" },
    hasAttribute() { return false; },
    getAttribute(name) { return this.attributes[name] || null; },
    closest() { return this; },
  };
  const event = {
    target: anchor,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };

  documentListeners.click(event);
  await nextTurn();
  await nextTurn();

  assert.equal(event.prevented, true, "WhatsApp click should be held briefly");
  assert.equal(event.stopped, true, "other click handlers should not race the protected click");
  assert.equal(pendingWindow.destination, originalHref, "failed attribution must fail open to WhatsApp");
  assert.equal(beaconPayloads.length, 1, "failure should be reported once");
  assert.equal(beaconPayloads[0].url, "/api/attribution/client-error");
  assert.equal(typeof window.alert, "undefined", "fail-open must not depend on a blocking alert");
}

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }
  bind(...args) { this.args = args; return this; }
  async run() {
    if (this.sql.includes("INSERT OR IGNORE INTO attribution_failure_alerts")) {
      return { meta: { changes: 1 } };
    }
    return { meta: { changes: 1 } };
  }
  async first() {
    if (this.sql.includes("COUNT(*) AS failure_count")) return { failure_count: 3 };
    return null;
  }
}

class FakeDb {
  prepare(sql) { return new FakeStatement(this, sql); }
  async batch(statements) { return statements.map(() => ({ success: true })); }
}

async function testServerAlertThreshold() {
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(endpointSource).toString("base64")}`;
  const endpoint = await import(moduleUrl);
  const deliveries = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    deliveries.push({ url, options, payload: JSON.parse(options.body) });
    return { ok: true, status: 200 };
  };

  try {
    const waits = [];
    const request = new Request("https://mindobirdwatching.com/api/attribution/client-error", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://mindobirdwatching.com" },
      body: JSON.stringify({
        failure_id: "af_qa123456789",
        error_type: "timeout",
        page_url: "https://mindobirdwatching.com/tours/?utm_source=meta&utm_campaign=qa&private=drop-me",
        cta_location: "hero",
        cta_label: "WhatsApp",
        occurred_at: new Date().toISOString(),
      }),
    });
    const response = await endpoint.onRequestPost({
      request,
      env: {
        MBW_ATTRIBUTION_DB: new FakeDb(),
        MBW_ATTRIBUTION_ALERT_WEBHOOK_URL: "https://n8n.example.test/webhook/mbw-attribution-alert",
        MBW_ATTRIBUTION_ALERT_WEBHOOK_SECRET: "test-only",
      },
      waitUntil(promise) { waits.push(promise); },
    });
    const body = await response.json();
    await Promise.all(waits);

    assert.equal(response.status, 202);
    assert.equal(body.fail_open, true);
    assert.equal(body.alert_queued, true);
    assert.equal(deliveries.length, 1, "threshold should queue one external alert");
    assert.equal(deliveries[0].payload.failure_count, 3);
    assert.match(deliveries[0].payload.message, /Guests were sent to WhatsApp/);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testStaticGuards() {
  assert.match(siteConfigSource, /ATTRIBUTION_WAIT_MS = 1800/);
  assert.match(siteConfigSource, /pendingWindow\.location\.replace\(href\)/);
  assert.match(siteConfigSource, /reportAttributionFailure\(error, metadata\)/);
  assert.doesNotMatch(siteConfigSource, /WhatsApp is still loading\. Please try again/);
  assert.doesNotMatch(siteSource, /WhatsApp is still loading\. Please try again/);
  assert.match(siteSource, /openAttributedWhatsApp/);
  assert.match(endpointSource, /ALERT_THRESHOLD = 3/);
  assert.match(endpointSource, /ALERT_COOLDOWN_MINUTES = 60/);
  assert.match(endpointSource, /if \(!source\) return false/);
  assert.match(endpointSource, /occurred_at: new Date\(\)\.toISOString\(\)/);
}

testStaticGuards();
await testBrowserFailOpen();
await testServerAlertThreshold();
console.log("Attribution fail-open and alert QA passed");
