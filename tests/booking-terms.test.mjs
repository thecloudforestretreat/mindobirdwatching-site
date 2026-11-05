import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("booking terms disclose non-refundable custom-tour supplier commitments in both languages", async () => {
  const [english, spanish] = await Promise.all([
    read("terms-conditions/index.html"),
    read("es/terminos-y-condiciones/index.html"),
  ]);

  assert.match(english, /Deposits for custom and multi-day tours/);
  assert.match(english, /non-refundable third-party charges/);
  assert.match(english, /Tours cancelled by the operator are 100% refundable/);
  assert.match(english, /dateModified": "2026-11-05"/);
  assert.match(spanish, /Depósitos para tours personalizados y de varios días/);
  assert.match(spanish, /cargos no reembolsables de terceros/);
  assert.match(spanish, /Los tours cancelados por el operador son 100% reembolsables/);
  assert.match(spanish, /dateModified": "2026-11-05"/);
  for (const page of [english, spanish]) {
    const structuredData = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(structuredData, "policy page must retain JSON-LD");
    assert.doesNotThrow(() => JSON.parse(structuredData));
    assert.equal((page.match(/<article\b/g) || []).length, (page.match(/<\/article>/g) || []).length);
  }
});

test("deposit and itinerary pages link the booking terms before payment", async () => {
  const [depositPage, depositScript, itinerary] = await Promise.all([
    read("book-tour/deposit/index.html"),
    read("book-tour/deposit/deposit.js"),
    read("admin/itinerary-generator/index.html"),
  ]);

  assert.match(depositPage, /href="\/terms-conditions\/" id="terms"/);
  assert.match(depositPage, /non-refundable supplier-cost provisions/);
  assert.match(depositScript, /\/es\/terminos-y-condiciones\//);
  assert.match(itinerary, /paymentTermsNotice/);
  assert.match(itinerary, /https:\/\/mindobirdwatching\.com\/terms-conditions\//);
});

test("Stripe checkout and invoice integrations record the policy version", async () => {
  const [stripeWorker, shopWorker, englishTerms, spanishTerms] = await Promise.all([
    read("mbw-stripe-checkout-worker-v44.js"),
    read("workers/mbw-shop-api/src/index.js"),
    read("terms-conditions/index.html"),
    read("es/terminos-y-condiciones/index.html"),
  ]);

  for (const source of [stripeWorker, shopWorker]) {
    assert.match(source, /consent_collection\[terms_of_service\]/);
    assert.match(source, /BOOKING_TERMS_VERSION = "2026-11-05"/);
    assert.match(source, /terms_acceptance_required/);
    assert.match(source, /terms_content_sha256/);
    assert.match(source, /terms_accepted_at/);
    assert.match(source, /terms_consent/);
    assert.match(source, new RegExp(createHash("sha256").update(englishTerms).digest("hex")));
    assert.match(source, new RegExp(createHash("sha256").update(spanishTerms).digest("hex")));
  }
  assert.match(stripeWorker, /invForm\.set\("footer", invoiceTermsFooter/);
});
