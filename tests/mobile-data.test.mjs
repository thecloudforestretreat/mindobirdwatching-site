import test from "node:test";
import assert from "node:assert/strict";
import { loadMobileData } from "../functions/lib/mobile-data.mjs";

const env = {
  N8N_CRM_ADMIN_TOKEN: "test-token",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
};

test("mobile bootstrap reads CRM sheets sequentially to respect n8n rate limits", async () => {
  const savedFetch = globalThis.fetch;
  let inFlight = 0;
  let maxInFlight = 0;
  const actions = [];
  try {
    globalThis.fetch = async (_url, options) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const body = JSON.parse(new URLSearchParams(options.body).get("payload"));
      actions.push(body.action);
      await new Promise(resolve => setTimeout(resolve, 2));
      inFlight -= 1;
      return Response.json({ ok: true, records: [] });
    };
    await loadMobileData(env);
    assert.equal(maxInFlight, 1);
    assert.deepEqual(actions, ["list_inquiries", "list_interactions", "list_assignments", "list_providers", "list_bookings", "list_payments"]);
  } finally {
    globalThis.fetch = savedFetch;
  }
});
