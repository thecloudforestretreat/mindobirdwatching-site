import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../deployment/multi-invoice-ledger/stripe-invoices-sync-v1.4.4.gs", import.meta.url),
  "utf8",
);

const helper = source.match(/function ensureInvoiceRowTemplate_\(sheet, targetRow\) \{[\s\S]*?\n\}/)?.[0] || "";

assert(helper, "ensureInvoiceRowTemplate_ must exist");
assert.doesNotMatch(
  helper,
  /clearDataValidations\(/,
  "invoice imports must not clear validation across protected calculated cells",
);
assert.doesNotMatch(
  helper,
  /template\.copyTo\(destination/,
  "invoice imports must not copy an entire row across protected calculated cells",
);
assert.match(helper, /destination\.getFormulasR1C1\(\)/);
assert.match(helper, /protected_invoice_formula_skipped/);
assert.match(helper, /continue;/);
assert.match(
  helper,
  /destination\.setFontFamily\("Calibri"\)\.setFontSize\(9\)/,
  "new invoice rows must always use Calibri 9",
);

const expenseHelper = source.match(/function ensureExpenseRowTemplate_\(sheet, targetRow\) \{[\s\S]*?\n\}/)?.[0] || "";
assert(expenseHelper, "ensureExpenseRowTemplate_ must exist");
assert.match(
  expenseHelper,
  /destination\.setFontFamily\("Calibri"\)\.setFontSize\(9\)/,
  "new expense rows must always use Calibri 9",
);

const mappedSetter = source.match(/function setMappedInvoiceValue_\(cell, value\) \{[\s\S]*?\n\}/)?.[0] || "";
assert(mappedSetter, "setMappedInvoiceValue_ must exist");
assert.match(
  mappedSetter,
  /if \(cell\.getFormula\(\)\) \{\s*return true;/,
  "protected calculated invoice fields must remain formula-owned",
);

const appendRowFinder = source.match(/function findFirstBlankInvoiceRow_\(sheet, invoiceNoIndex\) \{[\s\S]*?\n\}/)?.[0] || "";
assert(appendRowFinder, "findFirstBlankInvoiceRow_ must exist");
assert.match(
  appendRowFinder,
  /lastPopulatedIndex/,
  "invoice imports must append after the final populated invoice row",
);
assert.doesNotMatch(
  appendRowFinder,
  /if \(!cleanSyncValue_\(values\[i\]\[0\]\)\) return i \+ 2/,
  "invoice imports must not reuse an internal blank row",
);

const syncHandler = source.match(/function syncStripeInvoicesToInvoices\(e\) \{[\s\S]*?var lock = LockService\.getScriptLock\(\);/)?.[0] || "";
assert(syncHandler, "sync handler must accept the time-trigger event");
assert.match(syncHandler, /e && e\.triggerUid/);
assert.match(syncHandler, /triggerSecond < 35/);
assert.match(syncHandler, /legacy_duplicate_trigger_window/);

assert.match(
  source,
  /function normalizeInvoiceServiceType_\(value\)/,
  "invoice sync must normalize Stripe service categories",
);
assert.match(
  source,
  /"private transfer": "Transportation"/,
  "private transfer lines must enter accounting as Transportation",
);
assert.match(
  source,
  /function backfillExistingInvoiceIdentityFields_\(/,
  "existing invoice rows must support safe blank-field backfills",
);
assert.match(
  source,
  /\["home_country", "service_type"\]/,
  "backfills must be limited to the missing country and service identity fields",
);
assert.match(
  source,
  /keys\[buildTargetIdentity_\(obj\)\] = i \+ 2/,
  "existing invoice identities must retain their destination row number",
);
assert.match(
  source,
  /function recoverMissingRecentInvoiceRows_\(/,
  "the sync must audit a bounded recent source window for rows left behind the cursor",
);
assert.match(
  source,
  /var MBW_SYNC_RECENT_AUDIT_ROWS = 500/,
  "the automatic integrity audit must remain bounded",
);
assert.match(
  source,
  /var MBW_SYNC_RECOVERY_START_ROW = 190/,
  "recovery must begin after the preserved historical baseline",
);
assert.match(
  source,
  /Math\.max\(MBW_SYNC_RECOVERY_START_ROW, lastRow - boundedLimit \+ 1\)/,
  "a short staging sheet must not reopen historical source rows",
);
assert.match(
  source,
  /immutable tour_key/,
  "recovery must preserve valid repeated products using immutable line identity",
);
assert.match(
  source,
  /function shouldExcludeInvoiceSourceRow_\(row\)/,
  "invoice sync must share one eligibility gate across normal and recovery imports",
);
assert.match(
  source,
  /canonicalSyncToken_\(row\.exclude_from_invoice_sync\)/,
  "explicitly excluded staging rows must never enter invoices",
);
assert.match(
  source,
  /"replaced by itemized repair"/,
  "superseded invoice summaries must remain excluded after itemized repair",
);
assert.match(
  source,
  /!cleanSyncValue_\(row\.product_selected\) \|\| !cleanSyncValue_\(row\.tour_date\)/,
  "recovery must require a product and tour date before creating an invoice service row",
);
assert.match(
  source,
  /return !hasServiceIdentity;/,
  "invoice-level shells without a service identity must remain out of accounting",
);
assert.equal(
  (source.match(/shouldExcludeInvoiceSourceRow_\(rowObject\)/g) || []).length,
  2,
  "normal cursor imports and recovery audits must enforce the same eligibility gate",
);
assert.match(
  source,
  /function recoverMissingInvoiceRows\(\)/,
  "a repeat-safe manual full-history repair must remain available",
);

console.log("protected invoice row sync QA passed");
