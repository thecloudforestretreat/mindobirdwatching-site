import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../admin/guest-crm/index.html", import.meta.url), "utf8");
const router = fs.readFileSync(new URL("../deployment/multi-invoice-ledger/crm-router.gs", import.meta.url), "utf8");
const workflow = JSON.parse(fs.readFileSync(new URL("../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json", import.meta.url), "utf8"));

test("legacy inquiries remain guest records by default", () => {
  assert.match(html, /function normalizeRecordType\(value\)[\s\S]*?\?type:"guest"/);
  assert.match(html, /function isGuestRecord\(record\)/);
  assert.match(router, /record_type[\s\S]*?fallback: "guest"/);
});

test("trade partners have a separate view, action, lifecycle, and profile fields", () => {
  assert.match(html, /option value="tradePartners">Trade Partners/);
  assert.match(html, /id="moveTradePartnerBtn"/);
  assert.match(html, /id="tradePartnerPanel"/);
  for (const id of ["organizationNameInput", "contactRoleInput", "relationshipStageInput", "partnerTypeInput", "companyWebsiteInput", "pricingModelInput", "rateSheetVersionInput", "ratesSentAtInput", "referringPartnerIdInput"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /rates_requested/);
  assert.match(html, /active_partner/);
});

test("collaborations are a separate non-guest queue with explicit commercial terms", () => {
  assert.match(html, /option value="collaborations">Collaborations/);
  assert.match(html, /id="moveCollaborationBtn"/);
  assert.match(html, /id="statCollaborations"/);
  assert.match(html, /function isCollaborationRecord\(record\)/);
  assert.match(html, /vf==="collaborations"\)arr=arr\.filter\(isCollaborationRecord\)/);
  assert.match(html, /complimentary">Complimentary \/ No Charge/);
  assert.match(html, /function commercialTermsLabel\(record\)/);
});

test("guest reporting excludes trade partners while preserving an all-contacts view", () => {
  assert.match(html, /vf==="tradePartners"\)arr=arr\.filter\(isTradePartnerRecord\)/);
  assert.match(html, /vf!=="allContacts"\)arr=arr\.filter\(isGuestRecord\)/);
  assert.match(html, /state\.records\.filter\(isGuestRecord\)\.forEach\(record/);
  assert.match(html, /state\.records\.filter\(record=>isGuestRecord\(record\).*MbwCrmPreparation/);
  assert.match(html, /state\.records=original\.filter\(isGuestRecord\)/);
});

test("trade partner fields are persisted by the CRM router", () => {
  for (const header of ["record_type", "organization_name", "contact_role", "relationship_stage", "partner_type", "company_website", "pricing_model", "rate_sheet_version", "rates_sent_at", "referring_partner_id"]) {
    assert.match(router, new RegExp(`"${header}"`));
  }
  assert.match(router, /relationship_stage: \{ values: \["new", "contacted", "rates_requested", "rates_sent", "negotiating", "active_partner", "completed", "inactive"\]/);
  assert.match(router, /pricing_model: \{ values: \["retail", "net_rate", "commission", "custom", "complimentary"\]/);
  assert.match(router, /payment_status: \{ values: \["unpaid", "deposit_pending", "deposit_paid", "partial", "paid", "no_payment_required", "refunded"\]/);
});

test("all CRM inquiry writes map the trade partner fields", () => {
  const names = ["Append CRM Inquiry - New Guest", "Append CRM Inquiry - Returning Guest", "Update CRM Inquiry - Google Sheets"];
  for (const name of names) {
    const node = workflow.nodes.find(item => item.name === name);
    assert.ok(node, `missing ${name}`);
    const mapping = node.parameters.columns.value;
    for (const field of ["record_type", "organization_name", "contact_role", "relationship_stage", "partner_type", "company_website", "pricing_model", "rate_sheet_version", "rates_sent_at", "referring_partner_id"]) {
      assert.ok(Object.hasOwn(mapping, field), `${name} does not map ${field}`);
    }
  }
});

test("trade partner conversion defaults to custom commercial terms", () => {
  assert.match(html, /function moveToTradePartner\(\)[\s\S]*?pricingModelInput\.value="custom"/);
});

test("collaboration conversion preserves paid versus complimentary semantics", () => {
  assert.match(html, /function moveToCollaboration\(\)[\s\S]*?recordTypeInput\.value="collaboration"/);
  assert.match(html, /paymentStatusInput\.value\)==="no_payment_required"\?"complimentary":"custom"/);
  assert.match(html, /relationshipStageInput\.value="completed"/);
  assert.match(html, /record--collaboration/);
});

test("inline CRM scripts still parse", () => {
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (match[1].trim() && !match[0].includes("src=")) new Function(match[1]);
  }
});
