import assert from "node:assert/strict";
import test from "node:test";

import { onRequestGet } from "../functions/api/admin/bird-sightings/index.js";

class MemoryCache {
  constructor() { this.entries = new Map(); }
  async match(request) {
    const response = this.entries.get(request.url);
    return response ? response.clone() : undefined;
  }
  async put(request, response) { this.entries.set(request.url, response.clone()); }
}

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;

function request(query = "source=guide&days=30&limit=100") {
  return new Request(`https://mindobirdwatching.com/api/admin/bird-sightings?${query}`, {
    headers: { origin: "https://admin.mindobirdwatching.com" },
  });
}

function context(query) {
  return { request: request(query), env: { N8N_ADMIN_BIRD_SIGHTINGS_WEBHOOK_URL: "https://n8n.example/webhook" } };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.caches = originalCaches;
});

test("fresh cache prevents repeated workflow and Sheets reads", async () => {
  globalThis.caches = { default: new MemoryCache() };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ ok: true, sightings: [
      { speciesCode: "chotou1", source: "guide" },
      { speciesCode: "andcot1", source: "guide" },
    ] });
  };

  const first = await onRequestGet(context("source=guide&days=30&limit=100"));
  assert.equal(first.status, 200);
  assert.equal((await first.json()).cache, "miss");

  const second = await onRequestGet(context("source=guide&days=30&limit=1"));
  const body = await second.json();
  assert.equal(second.status, 200);
  assert.equal(body.cache, "hit");
  assert.equal(body.sightings.length, 1);
  assert.equal(calls, 1);
});

test("simultaneous identical requests share one workflow execution", async () => {
  globalThis.caches = { default: new MemoryCache() };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return Response.json({ ok: true, sightings: [{ speciesCode: "chotou1", source: "guide" }] });
  };

  const [first, second] = await Promise.all([
    onRequestGet(context("speciesCode=chotou1&source=guide&days=30&limit=100")),
    onRequestGet(context("speciesCode=chotou1&source=guide&days=30&limit=100")),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls, 1);
});

test("stale cache keeps the page available during a workflow 429", async () => {
  const cache = new MemoryCache();
  globalThis.caches = { default: cache };
  const cacheKey = request("speciesCode=chotou1&source=guide&days=30");
  await cache.put(cacheKey, Response.json({
    storedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    body: { ok: true, sightings: [{ speciesCode: "chotou1", source: "guide" }] },
  }));
  globalThis.fetch = async () => new Response('{"message":"rate limited"}', { status: 429 });

  const response = await onRequestGet(context("speciesCode=chotou1&source=guide&days=30&limit=100"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.degraded, true);
  assert.equal(body.cache, "stale");
  assert.match(body.warning, /cached sightings/i);
  assert.equal(body.sightings.length, 1);
});

test("combined-source failure falls back directly to eBird without workflow fan-out", async () => {
  globalThis.caches = { default: new MemoryCache() };
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).startsWith("https://n8n.example")) return new Response('{"message":"rate limited"}', { status: 429 });
    return Response.json([{ speciesCode: "andcot1", comName: "Andean Cock-of-the-rock", sciName: "Rupicola peruvianus", obsDt: "2026-10-11 08:00", locName: "Mindo" }]);
  };

  const ctx = context("source=all&days=30&limit=100");
  ctx.env.EBIRD_API_KEY = "test-key";
  const response = await onRequestGet(ctx);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.fallback, "ebird");
  assert.equal(body.sightings.length, 1);
  assert.equal(urls.filter((url) => url.startsWith("https://n8n.example")).length, 1);
  assert.equal(urls.filter((url) => url.startsWith("https://api.ebird.org")).length, 1);
});

test("live-stat requests bypass the browsing cache", async () => {
  globalThis.caches = { default: new MemoryCache() };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ ok: true, sightings: [{ speciesCode: "chotou1", source: "ebird", observed_at: "2026-10-11 08:00", ebird_sub_id: `S${calls}` }] });
  };

  const query = "speciesCode=chotou1&source=ebird&days=30&limit=100&liveStats=1&trackDemand=1";
  assert.equal((await onRequestGet(context(query))).status, 200);
  assert.equal((await onRequestGet(context(query))).status, 200);
  assert.equal(calls, 2);
});
