import test from "node:test";
import assert from "node:assert/strict";
import { mobileIdentity } from "../functions/lib/mobile-auth.mjs";
import { configuredRole, guideMayRequest, hasTrustedAudience } from "../functions/_middleware.js";
import { crmCall } from "../functions/lib/mobile-crm.mjs";
import { assertMobileWriteReady, assertSameOrigin, mobileWriteReady, readJson, writesEnabled } from "../functions/lib/mobile-http.mjs";

const request = (url = "http://localhost/api/mobile/session", options = {}) => new Request(url, options);

test("role map authorizes only explicit owner and agent entries", async () => {
  const env = { LOCAL_TEST_IDENTITY: "owner@example.com", MBW_MOBILE_ROLE_MAP: JSON.stringify({ "owner@example.com": { role: "owner", staffCode: "JPG", name: "Juan" } }) };
  assert.deepEqual(await mobileIdentity(request(), env), { email: "owner@example.com", role: "owner", staffCode: "JPG", name: "Juan" });
  await assert.rejects(() => mobileIdentity(request(), { ...env, LOCAL_TEST_IDENTITY: "other@example.com" }), /not enabled/);
  await assert.rejects(() => mobileIdentity(request(), { ...env, MBW_MOBILE_ROLE_MAP: "not-json" }), /configuration is invalid/);
});

test("restricted guide navigation includes only Guide Nest and its read endpoints", () => {
  assert.equal(guideMayRequest(request("https://admin.mindobirdwatching.com/guide/")), true);
  assert.equal(guideMayRequest(request("https://admin.mindobirdwatching.com/api/guide/reports")), true);
  assert.equal(guideMayRequest(request("https://admin.mindobirdwatching.com/")), false);
  assert.equal(guideMayRequest(request("https://admin.mindobirdwatching.com/birding/")), false);
  assert.equal(guideMayRequest(request("https://admin.mindobirdwatching.com/guest-crm/")), false);
  assert.equal(guideMayRequest(request("https://admin.mindobirdwatching.com/api/mobile/guests")), false);
});

test("origin authentication trusts only the Admin and path-scoped Guide Nest audiences", () => {
  assert.equal(hasTrustedAudience(["62ad79ee3af18f90b4827d5a84be038d4df901a56cbc21abda1ac5991ea89060"]), true);
  assert.equal(hasTrustedAudience(["b4d788474b91e0b737ff8d49489f7b127fc63dd3ed9ece6464b999ca84aaa7e0"]), true);
  assert.equal(hasTrustedAudience(["unrelated-access-application"]), false);
  assert.equal(hasTrustedAudience("b4d788474b91e0b737ff8d49489f7b127fc63dd3ed9ece6464b999ca84aaa7e0"), false);
});

test("the origin denies identities that are absent from both explicit role maps", () => {
  const env = {
    MBW_MOBILE_ROLE_MAP: JSON.stringify({ "owner@example.com": { role: "owner" } }),
    MBW_GUIDE_ROLE_MAP: JSON.stringify({ "guide@example.com": { role: "guide" } }),
  };
  assert.equal(configuredRole(env, "owner@example.com"), "owner");
  assert.equal(configuredRole(env, "guide@example.com"), "guide");
  assert.equal(configuredRole(env, "other@example.com"), "");
  assert.equal(configuredRole({ ...env, MBW_GUIDE_ROLE_MAP: "invalid-json" }, "owner@example.com"), "");
});

test("writes fail closed unless flag, n8n token, and staff code all exist", () => {
  assert.equal(writesEnabled({ MBW_MOBILE_WRITE_ENABLE: "false", MBW_MOBILE_WRITE_ENABLED: "true" }), true);
  const env = { MBW_MOBILE_WRITE_ENABLE: "true", N8N_CRM_ADMIN_TOKEN: "secret" };
  assert.equal(mobileWriteReady(env, { staffCode: "JPG" }), true);
  assert.equal(mobileWriteReady(env, { staffCode: "" }), false);
  assert.throws(() => assertMobileWriteReady({ MBW_MOBILE_WRITE_ENABLE: "true" }, { staffCode: "JPG" }), /authentication is not configured/);
});

test("CRM reads and writes require the protected endpoint and token", async () => {
  await assert.rejects(() => crmCall({}, "list_inquiries"), /Protected CRM endpoint is not configured/);
  await assert.rejects(() => crmCall({ N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile" }, "list_inquiries"), /CRM authentication is not configured/);
});

test("write requests require the configured same origin", () => {
  const env = { MBW_ADMIN_ORIGIN: "https://admin.mindobirdwatching.com" };
  assert.doesNotThrow(() => assertSameOrigin(request("https://admin.mindobirdwatching.com/api/mobile/guests/1", { headers: { Origin: "https://admin.mindobirdwatching.com", "Sec-Fetch-Site": "same-origin" } }), env));
  assert.throws(() => assertSameOrigin(request("https://admin.mindobirdwatching.com/api/mobile/guests/1", { headers: { Origin: "https://evil.example" } }), env), /Same-origin/);
});

test("JSON reader rejects wrong content type and oversized bodies", async () => {
  await assert.rejects(() => readJson(request("http://localhost/", { method: "POST", body: "{}" })), /application\/json/);
  await assert.rejects(() => readJson(request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: "x".repeat(100) }) }), 20), /too large/);
});
