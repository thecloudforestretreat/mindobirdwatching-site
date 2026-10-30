import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "../functions/api/mobile/bootstrap.js";

const env = {
  LOCAL_TEST_IDENTITY: "owner@example.test",
  MBW_MOBILE_ROLE_MAP: JSON.stringify({ "owner@example.test": { role: "owner", staffCode: "JPG" } }),
  MBW_MOBILE_WRITE_ENABLE: "true",
  N8N_CRM_ADMIN_TOKEN: "test-token",
  N8N_CRM_ADMIN_URL: "https://n8n.example.test/webhook/mobile",
};

test("bootstrap returns the complete sanitized desk dataset for filters and calendar", async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(new URLSearchParams(options.body).get("payload"));
      if (body.action === "list_inquiries") return Response.json({ ok: true, records: [
        { inquiry_id: "I-1", guest_id: "G-1", full_name: "Booked Guest", email: "private@example.test", phone_raw: "123", status: "booked", requested_date: "2026-10-21", guest_count: "2", country: "United States", brand_source: "Mindo Tours" },
        { inquiry_id: "I-2", guest_id: "G-2", full_name: "Quoted Guest", email: "private2@example.test", status: "quoted", requested_date: "2027-07-04" },
      ] });
      if (body.action === "list_providers") return Response.json({ ok: true, records: [{ provider_id: "PROV-TEST", provider_name: "Test Guide", provider_role: "guide", service_type: "Birdwatching", is_default: "Yes" }] });
      if (body.action === "list_assignments") return Response.json({ ok: true, records: [{
        assignment_id: "PLAN-ROW-1", assignment_kind: "tour_plan", assignment_group_id: "PLAN-robert-2027",
        provider_id: "PROV-TEST", provider_name: "Test Guide", updated_at: "2026-10-29T20:00:00Z",
        internal_note: JSON.stringify({ planId: "robert-2027", inquiryId: "I-1", providerId: "PROV-TEST", providerName: "Test Guide", mbwPricing: { days: [{ dayId: "day-1", sellPrice: 999 }], notes: "PRIVATE MARGIN" } }),
      }] });
      return Response.json({ ok: true, records: [] });
    };
    const response = await onRequestGet({ request: new Request("http://localhost/api/mobile/bootstrap"), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.dataVersion, "2026-10-24-invoice-status-v5");
    assert.equal(body.inquiries.length, 2);
    assert.deepEqual(body.inquiries.map(item => item.effectiveStatus), ["booked", "quoted"]);
    assert.equal(body.inquiries[0].email, undefined);
    assert.equal(body.inquiries[0].phone, undefined);
    assert.equal(body.inquiries[0].countryCode, "US");
    assert.equal(body.inquiries[0].brand, "MT");
    assert.deepEqual(body.bookings, []);
    assert.equal(body.customPlans.length, 1);
    assert.equal(body.customPlans[0].inquiryId, "INQ-20261023224230-9029");
    assert.equal(body.customPlans[0].providerName, "Test Guide");
    assert.equal(body.customPlans[0].mbwPricing, undefined);
    assert.doesNotMatch(JSON.stringify(body.customPlans), /PRIVATE MARGIN|sellPrice/i);
    assert.deepEqual(body.providers, [{ providerId: "PROV-TEST", name: "Test Guide", role: "guide", serviceType: "Birdwatching", isDefault: true, active: true }]);
    assert.ok(Array.isArray(body.upcoming));
  } finally {
    globalThis.fetch = savedFetch;
  }
});
