/**
 * MBW Stripe Invoices -> Invoices Sync
 * Production drop-in v1.5.4
 *
 * Purpose:
 * - Leaves all historical rows untouched.
 * - Imports only future paid Stripe invoice rows with an invoice_no.
 * - Uses invoice_no as the human/accounting reference.
 * - Preserves Stripe invoice_id and transaction_id.
 * - Carries inquiry_id, guest_id, booking_id, and quote_id forward.
 * - Copies formatting, validation, and row formulas from the prior invoices row.
 * - Prevents duplicates using tour_key, with a safe fallback identity.
 * - Defensively skips Stripe applied-deposit credit rows.
 * - Creates one Stripe Fee expense per paid Stripe invoice.
 * - Creates or updates one expense obligation per ready invoice service row,
 *   regardless of payment method or completion status.
 * - Waits for product, guide/provider, and calculated payout before creating service expenses.
 * - Never overwrites a reconciled service expense.
 * - Supports manual/Zelle invoice rows that do not have a Stripe tour_key.
 * - Adds unique ledger IDs and advanced source/status metadata.
 * - Recognizes historical split Stripe-fee rows without rebuilding them.
 * - Adds and maintains a duplicate-safe expense_key column.
 * - Applies the prior populated invoice row's format, validation, row height,
 *   and formulas to every newly imported invoice row.
 * - Preserves invoice formulas when Stripe staging fields are blank.
 * - Leaves accounting-calculated guide and reconciliation fields owned by the
 *   invoices sheet instead of overwriting them from staging.
 * - Treats an overlapping scheduled/manual execution as a safe skip instead
 *   of raising a lock-timeout exception.
 * - Preserves expense_id and invoice_no hyperlinks during automatic updates.
 * - Installs invoice formulas before restoring validation, preventing new-row
 *   validation failures while dependent inputs are still blank.
 * - Stamps created_at, updated_at, paid_at, and source_system as UTC RFC 3339
 *   values for every Stripe-synced invoice service row.
 */

var MBW_SYNC_SPREADSHEET_ID = "1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU";
var MBW_SYNC_SOURCE_SHEET = "stripe_invoices";
var MBW_SYNC_TARGET_SHEET = "invoices";
var MBW_SYNC_EXPENSES_SHEET = "expenses";
var MBW_SYNC_GUIDE_QUEUE_SHEET = "guide_payment_queue";
var MBW_SYNC_DEPOSITS_SHEET = "deposits";
var MBW_SYNC_CURSOR_PROPERTY = "MBW_STRIPE_INVOICES_LAST_SYNCED_ROW";
var MBW_SYNC_LAST_SUCCESS_PROPERTY = "MBW_STRIPE_INVOICES_LAST_SUCCESS_AT";
var MBW_SYNC_MIN_INTERVAL_MS = 4 * 60 * 1000;
var MBW_SYNC_HANDLER = "syncStripeInvoicesToInvoices";
var MBW_EXPENSE_SYNC_HANDLER = "syncInvoicesToExpenses";
var MBW_SYNC_RECENT_AUDIT_ROWS = 500;
// Never audit or recover pre-automation historical staging rows.
var MBW_SYNC_RECOVERY_START_ROW = 190;
// Expense automation begins with the reconciled production transition.
// Earlier invoice and expense rows remain historical and are never backfilled.
var MBW_EXPENSE_SYNC_START_DATE = "2026-09-12";

/**
 * Run this exactly once after adding this file.
 * Existing source rows become the baseline and are not imported.
 * A five-minute automatic trigger is then installed.
 */
function setupStripeInvoiceSync() {
  var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
  var source = requireSyncSheet_(ss, MBW_SYNC_SOURCE_SHEET);
  requireSyncSheet_(ss, MBW_SYNC_TARGET_SHEET);
  var expenses = requireSyncSheet_(ss, MBW_SYNC_EXPENSES_SHEET);
  ensureExpenseKeyHeader_(expenses);
  validateSyncHeaders_(source);

  var properties = PropertiesService.getScriptProperties();
  var existingCursor = properties.getProperty(MBW_SYNC_CURSOR_PROPERTY);
  if (existingCursor === null) {
    properties.setProperty(
      MBW_SYNC_CURSOR_PROPERTY,
      String(Math.max(source.getLastRow(), 1))
    );
  }

  removeStripeInvoiceSyncTriggers_();
  ScriptApp.newTrigger(MBW_SYNC_HANDLER).timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger(MBW_EXPENSE_SYNC_HANDLER).timeBased().everyMinutes(15).create();

  var result = {
    ok: true,
    baseline_source_row: existingCursor === null ? Math.max(source.getLastRow(), 1) : Number(existingCursor),
    cursor_preserved: existingCursor !== null,
    historical_rows_imported: 0,
    trigger: "invoice import every 5 minutes",
    expense_trigger: "expense reconciliation every 15 minutes",
    expense_sync_enabled: true
  };
  console.log(JSON.stringify(result));
  return result;
}

/**
 * Automatic sync handler. It can also be run manually for testing.
 */
function syncStripeInvoicesToInvoices(e) {
  if (e && e.triggerUid) {
    var triggerSecond = Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "ss"));
    if (triggerSecond < 35) {
      return logSyncResult_({
        ok: true,
        skipped: true,
        reason: "legacy_duplicate_trigger_window"
      });
    }
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return logSyncResult_({
      ok: true,
      skipped: true,
      reason: "another_sync_is_running"
    });
  }

  try {
    var properties = PropertiesService.getScriptProperties();
    var savedCursor = properties.getProperty(MBW_SYNC_CURSOR_PROPERTY);
    if (savedCursor === null) {
      throw new Error("Sync is not initialized. Run setupStripeInvoiceSync once first.");
    }

    var nowMs = Date.now();
    var lastSuccessMs = Number(properties.getProperty(MBW_SYNC_LAST_SUCCESS_PROPERTY) || 0);
    if (lastSuccessMs && nowMs - lastSuccessMs < MBW_SYNC_MIN_INTERVAL_MS) {
      return logSyncResult_({
        ok: true,
        skipped: true,
        reason: "recent_success",
        seconds_since_last_success: Math.round((nowMs - lastSuccessMs) / 1000)
      });
    }

    var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
    var source = requireSyncSheet_(ss, MBW_SYNC_SOURCE_SHEET);
    var target = requireSyncSheet_(ss, MBW_SYNC_TARGET_SHEET);
        var depositResult = syncUnrecordedStripeDepositsUnlocked_(ss, source);

        

    var sourceHeaders = getUniqueHeaders_(source);
    var targetHeaders = getUniqueHeaders_(target);
    validateRequiredHeaders_(sourceHeaders.index, targetHeaders.index);

    var cursor = Math.max(Number(savedCursor) || 1, 1);
    var runStartedMs = Date.now();
    var processedThrough = cursor;
    var maxImportsPerRun = 1;
    var maxRuntimeMs = 240000;
    var sourceLastRow = source.getLastRow();
    var rowCount = Math.max(sourceLastRow - cursor, 0);
    var sourceRows = rowCount
      ? source.getRange(cursor + 1, 1, rowCount, sourceHeaders.values.length).getValues()
      : [];
    var existingKeys = buildExistingInvoiceKeys_(target, targetHeaders.index);
    var imported = 0;
    var skipped = 0;
    var backfilled = 0;
    var recovered = 0;

    for (var i = 0; i < sourceRows.length; i++) {
      if (imported >= maxImportsPerRun || Date.now() - runStartedMs >= maxRuntimeMs) break;
      var sourceRowNumber = cursor + 1 + i;
      var rowObject = rowToObject_(sourceHeaders.values, sourceRows[i]);
      var invoiceNo = cleanSyncValue_(rowObject.invoice_no);

      // Checkout/deposit events without a customer-facing invoice number are
      // intentionally left in the raw sheet until they belong to an invoice.
      if (!invoiceNo) {
        skipped++;
        properties.setProperty(MBW_SYNC_CURSOR_PROPERTY, String(sourceRowNumber));
        processedThrough = sourceRowNumber;
        continue;
      }

      // Stripe can expose an applied deposit as a negative invoice line. It is
      // a balance credit, not a tour/service sale, and must not enter invoices.
      if (isAppliedDepositCreditRow_(rowObject)) {
        skipped++;
        properties.setProperty(MBW_SYNC_CURSOR_PROPERTY, String(sourceRowNumber));
        processedThrough = sourceRowNumber;
        continue;
      }

      var identity = buildSourceIdentity_(rowObject);
      if (existingKeys[identity]) {
        if (backfillExistingInvoiceIdentityFields_(
          target,
          targetHeaders.index,
          Number(existingKeys[identity]),
          rowObject
        )) backfilled++;
        skipped++;
        properties.setProperty(MBW_SYNC_CURSOR_PROPERTY, String(sourceRowNumber));
        processedThrough = sourceRowNumber;
        continue;
      }

      if (!cleanSyncValue_(rowObject.product_selected) || !cleanSyncValue_(rowObject.tour_date)) {
        skipped++;
        properties.setProperty(MBW_SYNC_CURSOR_PROPERTY, String(sourceRowNumber));
        processedThrough = sourceRowNumber;
        continue;
      }

      var appendedRow = appendInvoiceRow_(target, targetHeaders.index, rowObject);
      existingKeys[identity] = appendedRow;
      imported++;
      properties.setProperty(MBW_SYNC_CURSOR_PROPERTY, String(sourceRowNumber));
        processedThrough = sourceRowNumber;
    }

    var auditResult = recoverMissingRecentInvoiceRows_(
      source, target, sourceHeaders, targetHeaders, existingKeys, MBW_SYNC_RECENT_AUDIT_ROWS
    );
    recovered += auditResult.recovered;
    backfilled += auditResult.backfilled;

    if (imported > 0 || recovered > 0 || backfilled > 0 || (depositResult && depositResult.created > 0)) {
      SpreadsheetApp.flush();
    }
    var remainingRows = Math.max(sourceLastRow - processedThrough, 0);
    if (remainingRows === 0) {
      properties.setProperty(MBW_SYNC_LAST_SUCCESS_PROPERTY, String(Date.now()));
    }
    return logSyncResult_({
      ok: true,
      scanned: sourceRows.length,
      deposits_created: depositResult ? depositResult.created : 0,
      imported: imported,
      recovered: recovered,
      backfilled: backfilled,
      skipped: skipped,
      recent_audit_failures: auditResult.failures,
      last_synced_row: processedThrough,
      remaining_rows: remainingRows,
      partial_batch: remainingRows > 0,
      expenses_deferred_to_separate_trigger: true
    });
  } finally {
    lock.releaseLock();
  }
}




function recoverMissingRecentInvoiceRows_(source, target, sourceHeaders, targetHeaders, existingKeys, limit) {
  var lastRow = source.getLastRow();
  if (lastRow < 2) return { recovered: 0, backfilled: 0, failures: 0 };
  var boundedLimit = Math.max(Number(limit) || 0, 1);
  var firstRow = Math.max(MBW_SYNC_RECOVERY_START_ROW, lastRow - boundedLimit + 1);
  if (firstRow > lastRow) return { recovered: 0, backfilled: 0, failures: 0 };
  var rows = source.getRange(firstRow, 1, lastRow - firstRow + 1, sourceHeaders.values.length).getValues();
  var recovered = 0;
  var backfilled = 0;
  var failures = 0;
  for (var i = 0; i < rows.length; i++) {
    var rowObject = rowToObject_(sourceHeaders.values, rows[i]);
    if (!cleanSyncValue_(rowObject.invoice_no) || isAppliedDepositCreditRow_(rowObject) || !cleanSyncValue_(rowObject.product_selected) || !cleanSyncValue_(rowObject.tour_date)) continue;
    var identity = buildSourceIdentity_(rowObject);
    if (existingKeys[identity]) {
      if (backfillExistingInvoiceIdentityFields_(target, targetHeaders.index, Number(existingKeys[identity]), rowObject)) backfilled++;
      continue;
    }
    try {
      var appendedRow = appendInvoiceRow_(target, targetHeaders.index, rowObject);
      existingKeys[identity] = appendedRow;
      recovered++;
    } catch (error) {
      failures++;
      console.error("Recent invoice audit could not restore source row " + (firstRow + i) + ": " + error);
    }
  }
  return { recovered: recovered, backfilled: backfilled, failures: failures };
}

function recoverMissingInvoiceRows() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
    var source = requireSyncSheet_(ss, MBW_SYNC_SOURCE_SHEET);
    var target = requireSyncSheet_(ss, MBW_SYNC_TARGET_SHEET);
    var sourceHeaders = getUniqueHeaders_(source);
    var targetHeaders = getUniqueHeaders_(target);
    validateRequiredHeaders_(sourceHeaders.index, targetHeaders.index);
    var existingKeys = buildExistingInvoiceKeys_(target, targetHeaders.index);
    var result = recoverMissingRecentInvoiceRows_(source, target, sourceHeaders, targetHeaders, existingKeys, Math.max(source.getLastRow() - 1, 1));
    SpreadsheetApp.flush();
    result.ok = true;
    result.expenses = syncInvoicesToExpensesUnlocked_(ss);
    SpreadsheetApp.flush();
    return logSyncResult_(result);
  } finally {
    lock.releaseLock();
  }
}

function syncUnrecordedStripeDepositsUnlocked_(ss, source) {
  var deposits = requireSyncSheet_(ss, MBW_SYNC_DEPOSITS_SHEET);
  var sourceHeaders = getUniqueHeaders_(source);
  var depositHeaders = getUniqueHeaders_(deposits);
  ["deposit_id", "inquiry_id", "guest_id", "booking_status", "deposit_status", "deposit_date", "tour_date", "balance_due_date", "guest_first_name", "guest_last_name", "guest_email", "guest_phone", "home_country", "party_size", "service_type", "product_selected", "payment_method", "deposit_paid_to", "stripe_payment_intent_id", "deposit_amount_paid", "total_amount_paid", "is_fully_paid", "transfer_to_invoices", "source_system", "notes"].forEach(function (header) {
    if (depositHeaders.index[header] === undefined) throw new Error("Missing required deposits header: " + header);
  });
  var existing = {};
  var piCol = depositHeaders.index.stripe_payment_intent_id + 1;
  var lastDepositDataRow = getLastNonBlankRowInColumn_(deposits, piCol);
  if (lastDepositDataRow > 1) {
    deposits.getRange(2, piCol, lastDepositDataRow - 1, 1).getDisplayValues().forEach(function (row) {
      var value = cleanSyncValue_(row[0]);
      if (value) existing[value] = true;
    });
  }
  var created = 0;
  var alreadyExisting = 0;
  var sourceIdentityCol = sourceHeaders.index.transaction_id !== undefined
    ? sourceHeaders.index.transaction_id + 1
    : (sourceHeaders.index.invoice_id !== undefined ? sourceHeaders.index.invoice_id + 1 : 1);
  var lastSourceDataRow = getLastNonBlankRowInColumn_(source, sourceIdentityCol);
  if (lastSourceDataRow <= 1) return { created: 0, existing: 0 };
  var rows = source.getRange(2, 1, lastSourceDataRow - 1, sourceHeaders.values.length).getValues();
  rows.forEach(function (row) {
      
    var item = rowToObject_(sourceHeaders.values, row);
    var purpose = cleanSyncValue_(item.payment_purpose).toLowerCase();
    var status = cleanSyncValue_(item.record_status).toLowerCase();
    var depositStatus = cleanSyncValue_(item.deposit_status).toLowerCase();
    var paymentIntent = cleanSyncValue_(item.stripe_payment_intent || item.transaction_id);
    if (purpose !== "tour_deposit" || !paymentIntent) return;
    if (status && status !== "paid") return;
    if (depositStatus && depositStatus !== "available" && depositStatus !== "paid") return;
    if (existing[paymentIntent]) { alreadyExisting++; return; }
    var output = new Array(depositHeaders.values.length).fill("");
    function put(name, value) {
      if (depositHeaders.index[name] !== undefined) output[depositHeaders.index[name]] = value;
    }
    var amount = Number(item.amount_received || item.gross_payment_amount || 0);
    put("deposit_id", "DEP-STRIPE-" + paymentIntent);
    put("inquiry_id", cleanSyncValue_(item.inquiry_id));
    put("guest_id", cleanSyncValue_(item.guest_id));
    put("booking_status", "Deposit Paid");
    put("deposit_status", "Deposit Paid");
    put("deposit_date", cleanSyncValue_(item.date_paid));
    put("tour_date", cleanSyncValue_(item.tour_date));
    put("guest_first_name", cleanSyncValue_(item.guest_first_name));
    put("guest_last_name", cleanSyncValue_(item.guest_last_name));
    put("guest_email", cleanSyncValue_(item.guest_email));
    put("guest_phone", cleanSyncValue_(item.guest_phone));
    put("home_country", cleanSyncValue_(item.home_country));
    put("party_size", cleanSyncValue_(item.party_size));
    var tourDate = item.tour_date || "";
    var balanceDueDate = "";
    if (tourDate) {
      var dueDate = tourDate instanceof Date
        ? new Date(tourDate.getTime())
        : new Date(cleanSyncValue_(tourDate) + "T12:00:00");
      if (!isNaN(dueDate.getTime())) {
        dueDate.setDate(dueDate.getDate() - 14);
        balanceDueDate = dueDate;
      }
    }
    put("tour_date", tourDate);
    put("balance_due_date", balanceDueDate);
    put("service_type", cleanSyncValue_(item.service_type) || "Reservation Deposit");
    put("product_selected", cleanSyncValue_(item.product_selected) || "DEP001");
    put("payment_method", "Stripe");
    put("deposit_paid_to", "Stripe");
    put("tour_guide", cleanSyncValue_(item.tour_guide || item.guide_name || item.guide));
    put("receipt_link", cleanSyncValue_(item.receipt_link || item.receipt_url || item.hosted_invoice_url));
    var bookingTotal = Number(item.total_booking_price || item.booking_total || item.accepted_quote_total || 0);
    put("total_booking_price", bookingTotal > 0 ? bookingTotal : "");
    put("marketing_brand_id", cleanSyncValue_(item.marketing_brand_id || item.selling_brand) || "mbw");
    put("billing_brand_id", cleanSyncValue_(item.billing_brand_id || item.billing_brand) || "mbw");
    put("stripe_payment_intent_id", paymentIntent);
    put("deposit_amount_paid", amount);
    put("total_amount_paid", amount);
    put("is_fully_paid", "No");
    put("transfer_to_invoices", "No");
    put("source_system", "stripe_checkout");
    put("notes", "Paid Stripe tour deposit; booking total and remaining balance pending final itinerary invoice.");
    put("calendar_sync", "No");
    var nextRow = deposits.getLastRow() + 1;
    if (nextRow > 2) deposits.getRange(nextRow - 1, 1, 1, depositHeaders.values.length).copyTo(deposits.getRange(nextRow, 1, 1, depositHeaders.values.length), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    deposits.getRange(nextRow, 1, 1, output.length).setValues([output]);
    existing[paymentIntent] = true;
    created++;
  });
  return { created: created, existing: alreadyExisting };
}

/** Removes only this automation's triggers. It does not change sheet data. */
function removeStripeInvoiceSyncTriggers() {
  removeStripeInvoiceSyncTriggers_();
  var result = { ok: true, removed: true };
  console.log(JSON.stringify(result));
  return result;
}

/** Read-only status check. */
function checkStripeInvoiceSyncStatus() {
  var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
  var source = requireSyncSheet_(ss, MBW_SYNC_SOURCE_SHEET);
  var cursor = PropertiesService.getScriptProperties().getProperty(MBW_SYNC_CURSOR_PROPERTY);
  var triggerCount = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === MBW_SYNC_HANDLER;
  }).length;
  var expenseTriggerCount = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === MBW_EXPENSE_SYNC_HANDLER;
  }).length;

  var result = {
    ok: true,
    initialized: cursor !== null,
    last_synced_row: cursor === null ? null : Number(cursor),
    current_source_last_row: source.getLastRow(),
    pending_rows: cursor === null ? null : Math.max(source.getLastRow() - Number(cursor), 0),
    trigger_count: triggerCount,
    expense_trigger_count: expenseTriggerCount
  };
  console.log(JSON.stringify(result));
  return result;
}

/**
 * Manual expense sync. Safe to run repeatedly.
 * Existing legacy expense rows are matched and stamped with expense_key before
 * any new row is added. Reconciled service expenses are never changed.
 */
function syncInvoicesToExpenses() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return logSyncResult_({
      ok: true,
      skipped: true,
      reason: "another_sync_is_running"
    });
  }
  try {
    var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
    var result = syncInvoicesToExpensesUnlocked_(ss);
    SpreadsheetApp.flush();
    return logSyncResult_(result);
  } finally {
    lock.releaseLock();
  }
}

function syncInvoicesToExpensesUnlocked_(ss) {
  var invoices = requireSyncSheet_(ss, MBW_SYNC_TARGET_SHEET);
  var expenses = requireSyncSheet_(ss, MBW_SYNC_EXPENSES_SHEET);
  var invoiceHeaders = getUniqueHeaders_(invoices);
  var expenseKeyColumn = ensureExpenseKeyHeader_(expenses);
  var expenseHeaders = getUniqueHeaders_(expenses);
  validateExpenseSyncHeaders_(invoiceHeaders.index, expenseHeaders.index);

  var lastInvoiceDataRow = getLastNonBlankRowInColumn_(invoices, invoiceHeaders.index.invoice_no + 1);
  var invoiceRows = lastInvoiceDataRow > 1
    ? invoices.getRange(2, 1, lastInvoiceDataRow - 1, invoiceHeaders.values.length).getValues()
    : [];
  var invoiceObjects = invoiceRows.map(function (row, index) {
    var obj = rowToObject_(invoiceHeaders.values, row);
    obj.__rowNumber = index + 2;
    return obj;
  }).filter(function (row) {
    return !!cleanSyncValue_(row.invoice_no) && isManagedExpenseInvoiceRow_(row);
  });

  var expenseState = buildExpenseState_(expenses, expenseHeaders);
  var stripeGroups = groupStripeInvoiceRowsForExpenses_(invoiceObjects);
  var result = {
    ok: true,
    stripe_fees_created: 0,
    service_expenses_created: 0,
    service_expenses_updated: 0,
    existing_expenses_linked: 0,
    reconciled_expenses_locked: 0,
    service_rows_waiting: 0,
    expense_key_column: expenseKeyColumn,
    stripe_fee_conflicts: 0,
    guide_queue_created: 0,
    guide_queue_existing: 0,
    guide_queue_skipped: 0
  };

  Object.keys(stripeGroups).forEach(function (groupKey) {
    var rows = stripeGroups[groupKey];
    var feeRecord = buildStripeFeeExpense_(rows);
    if (feeRecord) {
      var feeOutcome = upsertExpenseRecord_(expenses, expenseHeaders, expenseState, feeRecord, true);
      addExpenseOutcome_(result, feeOutcome, "stripe");
    }
  });

  invoiceObjects.forEach(function (invoiceRow) {
    var serviceRecord = buildServiceExpense_(invoiceRow);
    if (!serviceRecord) {
      if (shouldWaitForServiceExpense_(invoiceRow)) result.service_rows_waiting++;
      return;
    }
    var serviceOutcome = upsertExpenseRecord_(expenses, expenseHeaders, expenseState, serviceRecord, false);
    addExpenseOutcome_(result, serviceOutcome, "service");
  });

  var queueOutcome = syncGuidePaymentQueue_(ss, invoiceObjects);
  result.guide_queue_created = queueOutcome.created;
  result.guide_queue_existing = queueOutcome.existing;
  result.guide_queue_skipped = queueOutcome.skipped;

  return result;
}


function syncGuidePaymentQueue_(ss, invoiceObjects) {
  var sheet = ss.getSheetByName(MBW_SYNC_GUIDE_QUEUE_SHEET);
  var outcome = { created: 0, existing: 0, skipped: 0 };
  if (!sheet) return outcome;

  var headers = getUniqueHeaders_(sheet);
  [
    "tour_key", "invoice_no", "tour_date", "guide", "amount_due",
    "cash_paid", "advance_withheld", "other_offset", "remaining_due",
    "payment_status", "notes"
  ].forEach(function (name) {
    if (!Object.prototype.hasOwnProperty.call(headers.index, name)) {
      throw new Error("Missing required guide payment queue header: " + name);
    }
  });

  var byKey = {};
  var lastRow = getLastNonBlankRowInColumn_(sheet, headers.index.tour_key + 1);
  if (lastRow > 1) {
    var rows = sheet.getRange(2, 1, lastRow - 1, headers.values.length).getValues();
    rows.forEach(function (row, index) {
      var key = cleanSyncValue_(row[headers.index.tour_key]);
      if (key) byKey[key] = index + 2;
    });
  }

  var todayKey = dateKeySync_(new Date());
  invoiceObjects.forEach(function (invoiceRow) {
    var tourDate = normalizeSyncDate_(invoiceRow.tour_date);
    var tourDateKey = dateKeySync_(tourDate);
    if (!tourDate || !tourDateKey || tourDateKey < todayKey ||
        cleanSyncValue_(invoiceRow.tour_completed).toLowerCase() === "yes") {
      outcome.skipped++;
      return;
    }

    var serviceRecord = buildServiceExpense_(invoiceRow);
    if (!serviceRecord) {
      outcome.skipped++;
      return;
    }

    var key = cleanSyncValue_(serviceRecord.tour_key) || buildServiceSourceIdentity_(invoiceRow);
    if (!key) {
      outcome.skipped++;
      return;
    }
    var amountDue = roundSyncMoney_(Math.abs(parseSyncMoney_(invoiceRow.total_amount_owed_to_guide)));
    if (!(amountDue > 0)) {
      var basePayout = Math.abs(parseSyncMoney_(invoiceRow.guide_base_payout));
      var guideTip = Math.abs(parseSyncMoney_(invoiceRow.tip_paid_to_guide));
      var guideFee = Math.abs(parseSyncMoney_(invoiceRow.fees_charged_to_guide));
      var guideReduction = Math.abs(parseSyncMoney_(invoiceRow.guide_cost_reduction));
      amountDue = roundSyncMoney_(Math.max(0, basePayout + guideTip - guideFee - guideReduction));
    }
    if (!(amountDue > 0)) {
      amountDue = roundSyncMoney_(Math.abs(parseSyncMoney_(serviceRecord.amount)));
    }

    if (byKey[key]) {
      var existingRow = byKey[key];
      var existingValues = sheet.getRange(existingRow, 1, 1, headers.values.length).getValues()[0];
      var existingStatus = cleanSyncValue_(existingValues[headers.index.payment_status]).toLowerCase();
      if (existingStatus !== "settled" && existingStatus !== "paid") {
        var cashPaid = Math.abs(parseSyncMoney_(existingValues[headers.index.cash_paid]));
        var advanceWithheld = Math.abs(parseSyncMoney_(existingValues[headers.index.advance_withheld]));
        var otherOffset = Math.abs(parseSyncMoney_(existingValues[headers.index.other_offset]));
        var remainingDue = roundSyncMoney_(Math.max(0, amountDue - cashPaid - advanceWithheld - otherOffset));
        sheet.getRange(existingRow, headers.index.amount_due + 1).setValue(amountDue);
        sheet.getRange(existingRow, headers.index.remaining_due + 1).setValue(remainingDue);
      }
      outcome.existing++;
      return;
    }
    if (!(amountDue > 0)) {
      outcome.skipped++;
      return;
    }

    var targetRow = findFirstBlankGuideQueueRow_(sheet, headers.index.tour_key);
    ensureGuideQueueRowTemplate_(sheet, targetRow);
    var rowValues = new Array(headers.values.length).fill("");
    var record = {
      tour_key: key,
      invoice_no: cleanSyncValue_(serviceRecord.invoice_no),
      tour_date: tourDate,
      guide: cleanSyncValue_(serviceRecord.paid_to),
      amount_due: amountDue,
      cash_paid: 0,
      advance_withheld: 0,
      other_offset: 0,
      remaining_due: amountDue,
      payment_status: "Pending",
      settlement_id: "",
      receipt_reference: "",
      notes: "Future service obligation; not payable until completed.",
      cash_payment_date: "",
      offset_reference: "",
      settled_date: ""
    };
    Object.keys(record).forEach(function (name) {
      if (Object.prototype.hasOwnProperty.call(headers.index, name)) {
        rowValues[headers.index[name]] = record[name];
      }
    });
    sheet.getRange(targetRow, 1, 1, headers.values.length).setValues([rowValues]);
    byKey[key] = targetRow;
    outcome.created++;
  });

  return outcome;
}

function findFirstBlankGuideQueueRow_(sheet, tourKeyIndex) {
  var column = tourKeyIndex + 1;
  var lastDataRow = getLastNonBlankRowInColumn_(sheet, column);
  if (lastDataRow >= 2) {
    var values = sheet.getRange(2, column, lastDataRow - 1, 1).getDisplayValues();
    for (var i = 0; i < values.length; i++) {
      if (!cleanSyncValue_(values[i][0])) return i + 2;
    }
  }
  var targetRow = Math.max(lastDataRow + 1, 2);
  if (targetRow > sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
  return targetRow;
}

function ensureGuideQueueRowTemplate_(sheet, targetRow) {
  var width = sheet.getLastColumn();
  if (targetRow <= 2) return;
  var templateRow = findPriorPopulatedRow_(sheet, targetRow, 1);
  if (!templateRow) return;
  var template = sheet.getRange(templateRow, 1, 1, width);
  var destination = sheet.getRange(targetRow, 1, 1, width);
  destination.clearContent();
  destination.clearDataValidations();
  template.copyTo(destination, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sheet.setRowHeight(targetRow, sheet.getRowHeight(templateRow));
  template.copyTo(destination, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
}

function ensureExpenseKeyHeader_(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (cleanSyncValue_(headers[i]) === "expense_key") return i + 1;
  }
  for (var j = 0; j < headers.length; j++) {
    if (!cleanSyncValue_(headers[j])) {
      sheet.getRange(1, j + 1).setValue("expense_key");
      return j + 1;
    }
  }
  sheet.getRange(1, lastColumn + 1).setValue("expense_key");
  return lastColumn + 1;
}

function validateExpenseSyncHeaders_(invoiceIndex, expenseIndex) {
  [
    "invoice_no", "date_paid", "tour_date", "product_selected", "tour_guide",
    "payment_method", "invoice_id", "transaction_id", "transaction_fee_total",
    "total_amount_owed_to_guide", "tour_key"
  ].forEach(function (name) {
    if (!Object.prototype.hasOwnProperty.call(invoiceIndex, name)) {
      throw new Error("Missing required invoices header for expense sync: " + name);
    }
  });
  [
    "expense_id", "expense_date", "expense_month", "expense_type", "invoice_no",
    "tour_date", "tour_completed", "paid_to", "payment_method", "amount",
    "payment_reference", "notes", "expense_category", "accrual_month", "reconciled",
    "guide_paid_actual", "fees_paid_actual", "expense_reconciled_flag", "expense_key"
  ].forEach(function (name) {
    if (!Object.prototype.hasOwnProperty.call(expenseIndex, name)) {
      throw new Error("Missing required expenses header: " + name);
    }
  });
}

function groupStripeInvoiceRowsForExpenses_(rows) {
  var groups = {};
  rows.forEach(function (row) {

    if (cleanSyncValue_(row.payment_method).toLowerCase() !== "stripe") return;
    var invoiceId = cleanSyncValue_(row.invoice_id);
    var transactionId = cleanSyncValue_(row.transaction_id);
    var invoiceNo = cleanSyncValue_(row.invoice_no);
    var key = invoiceId && transactionId
      ? invoiceId + "|" + transactionId
      : "invoice_no|" + invoiceNo;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  return groups;
}

function buildStripeFeeExpense_(rows) {
  if (!rows.length) return null;
  var totalFee = rows.reduce(function (sum, row) {
    return sum + Math.abs(parseSyncMoney_(row.transaction_fee_total));
  }, 0);
  totalFee = roundSyncMoney_(totalFee);
  if (!(totalFee > 0)) return null;

  var first = rows[0];
  var invoiceNo = cleanSyncValue_(first.invoice_no);
  var invoiceId = cleanSyncValue_(first.invoice_id);
  var transactionId = cleanSyncValue_(first.transaction_id);
  var tourDate = earliestSyncDate_(rows.map(function (row) { return row.tour_date; }));
  var paidDate = normalizeSyncDate_(first.date_paid) || new Date();
  var key = "stripe_fee|" + (invoiceId || invoiceNo) + "|" + (transactionId || invoiceNo);
  return {
    expense_key: key,
    legacy_type: "Stripe Fee",
    legacy_paid_to: "Stripe",
    expense_id: invoiceNo,
    expense_date: paidDate,
    expense_month: monthKeySync_(paidDate),
    expense_type: "Stripe Fee",
    invoice_no: invoiceNo,
    tour_date: tourDate || "",
    tour_completed: "No",
    paid_to: "Stripe",
    payment_method: "Stripe",
    amount: -totalFee,
    receipt_link: "",
    payment_reference: transactionId || invoiceId,
    notes: "Automatically created from Stripe invoice fees.",
    expense_category: "Fees",
    accrual_month: monthKeySync_(tourDate || paidDate),
    reconciled: "Yes",
    guide_paid_actual: 0,
    fees_paid_actual: totalFee,
    expense_reconciled_flag: "Yes",
    ledger_entry_id: "",
    paid_date: paidDate,
    product_selected: "",
    service_type: "Payment fee",
    tour_key: "",
    invoice_id: invoiceId,
    transaction_id: transactionId,
    source_type: "Automatic",
    source_record_id: key,
    expense_status: "Paid",
    locked_at: "",
    fee_group_key: buildFeeGroupKey_(invoiceNo, invoiceId, transactionId)
  };
}

function shouldWaitForServiceExpense_(row) {
  return Boolean(
    cleanSyncValue_(row.invoice_no) &&
    cleanSyncValue_(row.product_selected) &&
    !isAppliedDepositCreditRow_(row)
  );
}

function isManagedExpenseInvoiceRow_(row) {
  var paidDateKey = dateKeySync_(row.date_paid);
  return !!paidDateKey && paidDateKey >= MBW_EXPENSE_SYNC_START_DATE;
}

function buildServiceExpense_(row) {
  if (!shouldWaitForServiceExpense_(row)) return null;
  var guide = cleanSyncValue_(row.tour_guide);
  var tourKey = cleanSyncValue_(row.tour_key);
  var payout = Math.abs(parseSyncMoney_(row.total_amount_owed_to_guide));
  if (!guide || !(payout > 0)) return null;

  var serviceType = cleanSyncValue_(row.service_type);
  var normalizedType = serviceType.toLowerCase();
  var expenseType = "Guide Payout";
  var category = "COGS";
  if (normalizedType.indexOf("transport") >= 0) {
    expenseType = "Transportation";
    category = "Transportation COGS";
  } else if (normalizedType.indexOf("lodg") >= 0 || normalizedType.indexOf("accommodation") >= 0) {
    expenseType = "Lodging Pass-Through";
    category = "Vendor Pass-Through";
  } else if (normalizedType.indexOf("reimburse") >= 0 || cleanSyncValue_(row.product_selected).toUpperCase() === "MBW099") {
    expenseType = "Guide Reimbursement";
    category = "Guide Payable Offset";
  }

  var tourDate = normalizeSyncDate_(row.tour_date);
  if (!tourDate) return null;
  var invoiceNo = cleanSyncValue_(row.invoice_no);
  var sourceIdentity = buildServiceSourceIdentity_(row);
  var expenseKey = "service|" + sourceIdentity;
  return {
    expense_key: expenseKey,
    legacy_type: expenseType,
    legacy_paid_to: guide,
    expense_id: invoiceNo,
    expense_date: tourDate,
    expense_month: monthKeySync_(tourDate),
    expense_type: expenseType,
    invoice_no: invoiceNo,
    tour_date: tourDate,
    tour_completed: cleanSyncValue_(row.tour_completed) || "No",
    paid_to: guide,
    payment_method: "Pending",
    amount: -roundSyncMoney_(payout),
    receipt_link: "",
    payment_reference: "",
    notes: "Product " + cleanSyncValue_(row.product_selected) + ". Expense obligation created from invoice service " + sourceIdentity + ".",
    expense_category: category,
    accrual_month: monthKeySync_(tourDate),
    reconciled: "No",
    guide_paid_actual: 0,
    fees_paid_actual: 0,
    expense_reconciled_flag: "No",
    ledger_entry_id: "",
    paid_date: "",
    product_selected: cleanSyncValue_(row.product_selected),
    service_type: serviceType,
    tour_key: tourKey,
    invoice_id: cleanSyncValue_(row.invoice_id),
    transaction_id: cleanSyncValue_(row.transaction_id),
    source_type: "Automatic",
    source_record_id: expenseKey,
    expense_status: "Pending",
    locked_at: ""
  };
}

function buildServiceSourceIdentity_(row) {
  var tourKey = cleanSyncValue_(row.tour_key);
  if (tourKey) return tourKey;
  var parts = [
    cleanSyncValue_(row.invoice_no),
    String(row.__rowNumber || ""),
    cleanSyncValue_(row.product_selected),
    dateKeySync_(row.tour_date),
    cleanSyncValue_(row.party_size)
  ];
  var routeType = cleanSyncValue_(row.route_type);
  if (routeType) parts.push(routeType);
  return parts.join("|");
}

function buildFeeGroupKey_(invoiceNo, invoiceId, transactionId) {
  return [
    cleanSyncValue_(invoiceId) || cleanSyncValue_(invoiceNo),
    cleanSyncValue_(transactionId) || cleanSyncValue_(invoiceNo)
  ].join("|");
}

function buildExpenseState_(sheet, headers) {
  var state = {
    byKey: {},
    legacy: {},
    legacyRelaxed: {},
    claimedRows: {},
    feeGroups: {},
    feeGroupsByInvoiceNo: {},
    usedLedgerNumbers: {},
    nextLedgerNumber: 1
  };
  var lastRow = getLastNonBlankRowInColumn_(sheet, headers.index.expense_id + 1);
  if (lastRow < 2) return state;
  var values = sheet.getRange(2, 1, lastRow - 1, headers.values.length).getValues();
  values.forEach(function (row, index) {
    var obj = rowToObject_(headers.values, row);
    var rowNumber = index + 2;
    obj.__rowNumber = rowNumber;
    var key = cleanSyncValue_(obj.expense_key);
    if (key) state.byKey[key] = obj;
    var ledgerMatch = cleanSyncValue_(obj.ledger_entry_id).match(/^EXP-(\d+)$/i);
    if (ledgerMatch) {
      state.usedLedgerNumbers[Number(ledgerMatch[1])] = true;
    }
    if (cleanSyncValue_(obj.expense_type).toLowerCase() === "stripe fee") {
      var feeGroupKey = buildFeeGroupKey_(obj.invoice_no, obj.invoice_id, obj.transaction_id);
      if (!state.feeGroups[feeGroupKey]) state.feeGroups[feeGroupKey] = [];
      state.feeGroups[feeGroupKey].push(obj);
      var feeInvoiceNo = cleanSyncValue_(obj.invoice_no).toLowerCase();
      if (feeInvoiceNo) {
        if (!state.feeGroupsByInvoiceNo[feeInvoiceNo]) state.feeGroupsByInvoiceNo[feeInvoiceNo] = [];
        state.feeGroupsByInvoiceNo[feeInvoiceNo].push(obj);
      }
    }
    var legacyKey = buildLegacyExpenseKey_(obj.invoice_no, obj.expense_type, obj.tour_date, obj.paid_to, obj.amount);
    if (!state.legacy[legacyKey]) state.legacy[legacyKey] = [];
    state.legacy[legacyKey].push(obj);
    var relaxedKey = buildRelaxedLegacyExpenseKey_(obj.invoice_no, obj.expense_type, obj.paid_to, obj.amount);
    if (!state.legacyRelaxed[relaxedKey]) state.legacyRelaxed[relaxedKey] = [];
    state.legacyRelaxed[relaxedKey].push(obj);
  });
  while (state.usedLedgerNumbers[state.nextLedgerNumber]) state.nextLedgerNumber++;
  return state;
}

function buildRelaxedLegacyExpenseKey_(invoiceNo, expenseType, paidTo, amount) {
  return [
    cleanSyncValue_(invoiceNo).toLowerCase(),
    cleanSyncValue_(expenseType).toLowerCase(),
    cleanSyncValue_(paidTo).toLowerCase(),
    roundSyncMoney_(Math.abs(parseSyncMoney_(amount))).toFixed(2)
  ].join("|");
}

function buildLegacyExpenseKey_(invoiceNo, expenseType, tourDate, paidTo, amount) {
  return [
    cleanSyncValue_(invoiceNo).toLowerCase(),
    cleanSyncValue_(expenseType).toLowerCase(),
    dateKeySync_(tourDate),
    cleanSyncValue_(paidTo).toLowerCase(),
    roundSyncMoney_(Math.abs(parseSyncMoney_(amount))).toFixed(2)
  ].join("|");
}

function findLegacyExpenseMatch_(state, record) {
  var key = buildLegacyExpenseKey_(
    record.invoice_no,
    record.legacy_type,
    record.tour_date,
    record.legacy_paid_to,
    record.amount
  );
  var candidates = state.legacy[key] || [];
  for (var i = 0; i < candidates.length; i++) {
    var rowNumber = candidates[i].__rowNumber;
    if (!state.claimedRows[rowNumber]) {
      state.claimedRows[rowNumber] = true;
      return candidates[i];
    }
  }
  var relaxedKey = buildRelaxedLegacyExpenseKey_(
    record.invoice_no,
    record.legacy_type,
    record.legacy_paid_to,
    record.amount
  );
  var relaxedCandidates = state.legacyRelaxed[relaxedKey] || [];
  for (var j = 0; j < relaxedCandidates.length; j++) {
    var relaxedRowNumber = relaxedCandidates[j].__rowNumber;
    if (!state.claimedRows[relaxedRowNumber]) {
      state.claimedRows[relaxedRowNumber] = true;
      return relaxedCandidates[j];
    }
  }
  return null;
}

function upsertExpenseRecord_(sheet, headers, state, record, isStripeFee) {
  var existing = state.byKey[record.expense_key];
  var linkedLegacy = false;
  if (!existing && isStripeFee) {
    var exactFeeRows = state.feeGroups[record.fee_group_key] || [];
    var invoiceFeeRows = state.feeGroupsByInvoiceNo[cleanSyncValue_(record.invoice_no).toLowerCase()] || [];
    var feeRows = [];
    var seenFeeRows = {};
    exactFeeRows.concat(invoiceFeeRows).forEach(function (row) {
      var rowKey = String(row.__rowNumber || "");
      if (seenFeeRows[rowKey]) return;
      seenFeeRows[rowKey] = true;
      feeRows.push(row);
    });
    if (feeRows.length) {
      var existingFeeTotal = roundSyncMoney_(feeRows.reduce(function (sum, row) {
        return sum + Math.abs(parseSyncMoney_(row.amount));
      }, 0));
      var wantedFeeTotal = roundSyncMoney_(Math.abs(parseSyncMoney_(record.amount)));
      if (Math.abs(existingFeeTotal - wantedFeeTotal) <= 0.01) {
        return { action: "unchanged" };
      }
      return {
        action: "conflict",
        reason: "Existing Stripe fee rows total " + existingFeeTotal.toFixed(2) +
          " but invoice rows total " + wantedFeeTotal.toFixed(2) + "."
      };
    }
  }
  if (!existing) {
    existing = findLegacyExpenseMatch_(state, record);
    if (existing) {
      sheet.getRange(existing.__rowNumber, headers.index.expense_key + 1).setValue(record.expense_key);
      existing.expense_key = record.expense_key;
      state.byKey[record.expense_key] = existing;
      linkedLegacy = true;
    }
  }

  if (existing) {
    ensureExistingExpenseLedgerId_(sheet, headers, state, existing);
    if (linkedLegacy) return { action: "linked" };
    if (isStripeFee) return { action: "unchanged" };
    if (isExpenseReconciled_(existing)) return { action: "locked" };
    if (isExpenseManuallyControlled_(existing)) {
      if (expenseStatusMatches_(existing, record)) return { action: "unchanged" };
      updateExpenseStatusOnly_(sheet, headers, existing.__rowNumber, record);
      return { action: "updated" };
    }
    if (expenseRecordMatches_(existing, record)) return { action: "unchanged" };
    writeExpenseRecord_(sheet, headers, existing.__rowNumber, record, true);
    return { action: "updated" };
  }

  record.ledger_entry_id = nextExpenseLedgerId_(state);
  var targetRow = findFirstBlankExpenseRow_(sheet, headers.index.expense_id);
  ensureExpenseRowTemplate_(sheet, targetRow);
  writeExpenseRecord_(sheet, headers, targetRow, record, false);
  record.__rowNumber = targetRow;
  state.byKey[record.expense_key] = record;
  if (isStripeFee) {
    if (!state.feeGroups[record.fee_group_key]) state.feeGroups[record.fee_group_key] = [];
    state.feeGroups[record.fee_group_key].push(record);
    var feeInvoiceNo = cleanSyncValue_(record.invoice_no).toLowerCase();
    if (feeInvoiceNo) {
      if (!state.feeGroupsByInvoiceNo[feeInvoiceNo]) state.feeGroupsByInvoiceNo[feeInvoiceNo] = [];
      state.feeGroupsByInvoiceNo[feeInvoiceNo].push(record);
    }
  }
  return { action: "created" };
}

function expenseStatusMatches_(existing, record) {
  return cleanSyncValue_(existing.tour_completed) === cleanSyncValue_(record.tour_completed) &&
    monthKeySync_(existing.expense_month) === cleanSyncValue_(record.expense_month) &&
    monthKeySync_(existing.accrual_month) === cleanSyncValue_(record.accrual_month);
}

function expenseRecordMatches_(existing, record) {
  var dateFields = { expense_date: true, tour_date: true };
  var monthFields = { expense_month: true, accrual_month: true };
  var moneyFields = { amount: true };
  var comparedFields = [
    "expense_date", "expense_month", "expense_type", "tour_date",
    "tour_completed", "paid_to", "amount", "expense_category",
    "accrual_month", "product_selected", "service_type", "tour_key",
    "invoice_id", "transaction_id"
  ];

  return comparedFields.every(function (field) {
    if (dateFields[field]) return dateKeySync_(existing[field]) === dateKeySync_(record[field]);
    if (monthFields[field]) return monthKeySync_(existing[field]) === cleanSyncValue_(record[field]);
    if (moneyFields[field]) {
      return roundSyncMoney_(parseSyncMoney_(existing[field])) ===
        roundSyncMoney_(parseSyncMoney_(record[field]));
    }
    if ((field === "product_selected" || field === "service_type") &&
        cleanSyncValue_(existing[field]) === "") return true;
    return cleanSyncValue_(existing[field]) === cleanSyncValue_(record[field]);
  });
}

function nextExpenseLedgerId_(state) {
  while (state.usedLedgerNumbers[state.nextLedgerNumber]) state.nextLedgerNumber++;
  var id = "EXP-" + String(state.nextLedgerNumber).padStart(6, "0");
  state.usedLedgerNumbers[state.nextLedgerNumber] = true;
  state.nextLedgerNumber++;
  return id;
}

function ensureExistingExpenseLedgerId_(sheet, headers, state, row) {
  if (cleanSyncValue_(row.ledger_entry_id)) return;
  if (!Object.prototype.hasOwnProperty.call(headers.index, "ledger_entry_id")) return;
  var ledgerId = nextExpenseLedgerId_(state);
  sheet.getRange(row.__rowNumber, headers.index.ledger_entry_id + 1).setValue(ledgerId);
  row.ledger_entry_id = ledgerId;
}

function isExpenseManuallyControlled_(row) {
  var sourceType = cleanSyncValue_(row.source_type).toLowerCase();
  return sourceType === "manual" || sourceType === "legacy migrated" || !!cleanSyncValue_(row.locked_at);
}

function updateExpenseStatusOnly_(sheet, headers, rowNumber, record) {
  ["tour_completed", "expense_month", "accrual_month"].forEach(function (header) {
    if (!Object.prototype.hasOwnProperty.call(headers.index, header)) return;
    if (!Object.prototype.hasOwnProperty.call(record, header)) return;
    setMappedInvoiceValue_(sheet.getRange(rowNumber, headers.index[header] + 1), record[header]);
  });
}

function writeExpenseRecord_(sheet, headers, rowNumber, record, preservePaymentFields) {
  var protectedWhenUpdating = {
    expense_id: true,
    invoice_no: true,
    receipt_link: true,
    payment_reference: true,
    payment_method: true,
    reconciled: true,
    guide_paid_actual: true,
    fees_paid_actual: true,
    expense_reconciled_flag: true,
    ledger_entry_id: true,
    source_type: true,
    source_record_id: true,
    locked_at: true,
        notes: true
  };
  Object.keys(record).forEach(function (header) {
    if (header === "legacy_type" || header === "legacy_paid_to" || header === "fee_group_key") return;
    if (!Object.prototype.hasOwnProperty.call(headers.index, header)) return;
    if (preservePaymentFields && protectedWhenUpdating[header]) return;
    setMappedInvoiceValue_(sheet.getRange(rowNumber, headers.index[header] + 1), record[header]);
  });
}

function isExpenseReconciled_(row) {
  return cleanSyncValue_(row.reconciled).toLowerCase() === "yes" ||
    cleanSyncValue_(row.expense_reconciled_flag).toLowerCase() === "yes";
}

function addExpenseOutcome_(result, outcome, kind) {
  if (outcome.action === "linked") result.existing_expenses_linked++;
  if (outcome.action === "locked") result.reconciled_expenses_locked++;
  if (kind === "stripe" && outcome.action === "created") result.stripe_fees_created++;
  if (kind === "stripe" && outcome.action === "conflict") result.stripe_fee_conflicts++;
  if (kind === "service" && outcome.action === "created") result.service_expenses_created++;
  if (kind === "service" && outcome.action === "updated") result.service_expenses_updated++;
}

function findFirstBlankExpenseRow_(sheet, expenseIdIndex) {
  var column = expenseIdIndex + 1;
  var lastDataRow = getLastNonBlankRowInColumn_(sheet, column);
  if (lastDataRow >= 2) {
    var values = sheet.getRange(2, column, lastDataRow - 1, 1).getDisplayValues();
    for (var i = 0; i < values.length; i++) {
      if (!cleanSyncValue_(values[i][0])) return i + 2;
    }
  }
  var targetRow = Math.max(lastDataRow + 1, 2);
  if (targetRow > sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
  return targetRow;
}

function ensureExpenseRowTemplate_(sheet, targetRow) {
  var width = sheet.getLastColumn();
  if (targetRow <= 2) return;
  var templateRow = findPriorPopulatedRow_(sheet, targetRow, 1);
  if (!templateRow) return;
  var template = sheet.getRange(templateRow, 1, 1, width);
  var destination = sheet.getRange(targetRow, 1, 1, width);
  destination.setFontFamily("Calibri").setFontSize(9);

  // Expense rows are ledger records, not formula-driven rows. Always clear the
  // destination before writing and copy only presentation/validation metadata.
  // Copying template formulas propagated stale #ERROR values into audit fields
  // and could prevent later service obligations from being created.
  destination.clearContent();
  destination.clearDataValidations();
  template.copyTo(destination, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sheet.setRowHeight(targetRow, sheet.getRowHeight(templateRow));
  template.copyTo(destination, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
}

function getLastNonBlankRowInColumn_(sheet, column) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  var values = sheet.getRange(2, column, lastRow - 1, 1).getDisplayValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (cleanSyncValue_(values[i][0])) return i + 2;
  }
  return 1;
}

function findPriorPopulatedRow_(sheet, targetRow, column) {
  if (targetRow <= 2) return 0;
  var values = sheet.getRange(2, column, targetRow - 2, 1).getDisplayValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (cleanSyncValue_(values[i][0])) return i + 2;
  }
  return 0;
}

function parseSyncMoney_(value) {
  if (typeof value === "number") return isFinite(value) ? value : 0;
  var normalized = cleanSyncValue_(value).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  var number = Number(normalized);
  return isFinite(number) ? number : 0;
}

function roundSyncMoney_(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeSyncDate_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return value;
  var text = cleanSyncValue_(value);
  if (!text) return null;
  var match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  var parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function earliestSyncDate_(values) {
  var dates = values.map(normalizeSyncDate_).filter(function (value) { return !!value; });
  if (!dates.length) return null;
  dates.sort(function (a, b) { return a.getTime() - b.getTime(); });
  return dates[0];
}

function dateKeySync_(value) {
  var date = normalizeSyncDate_(value);
  if (!date) return cleanSyncValue_(value);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function monthKeySync_(value) {
  var date = normalizeSyncDate_(value);
  return date ? Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM") : "";
}

function normalizeInvoiceServiceType_(value) {
  var text = cleanSyncValue_(value);
  if (!text) return "";
  var normalized = text.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  var mapping = {
    "accommodation": "Accommodation",
    "birding": "Birdwatching",
    "birdwatching": "Birdwatching",
    "meal": "Meal",
    "private transfer": "Transportation",
    "transportation": "Transportation",
    "wildlife": "Wildlife",
    "wildlife tour": "Wildlife",
    "private macro wildlife search": "Wildlife"
  };
  return mapping[normalized] || text;
}

function backfillExistingInvoiceIdentityFields_(target, targetIndex, targetRow, sourceRow) {
  var changed = false;
  ["home_country", "service_type"].forEach(function (header) {
    if (!Object.prototype.hasOwnProperty.call(targetIndex, header)) return;
    var cell = target.getRange(targetRow, targetIndex[header] + 1);
    if (cleanSyncValue_(cell.getValue())) return;
    var value = sourceRow[header];
    if (header === "service_type") value = normalizeInvoiceServiceType_(value);
    if (!cleanSyncValue_(value)) return;
    if (setMappedInvoiceValue_(cell, value)) changed = true;
  });
  return changed;
}

function appendInvoiceRow_(target, targetIndex, sourceRow) {
  var targetRow = findFirstBlankInvoiceRow_(target, targetIndex.invoice_no);
  ensureInvoiceRowTemplate_(target, targetRow);

  var mapping = getStripeToInvoiceMapping_();
  Object.keys(mapping).forEach(function (sourceHeader) {
    var targetHeader = mapping[sourceHeader];
    if (!Object.prototype.hasOwnProperty.call(targetIndex, targetHeader)) return;
    var value = sourceRow[sourceHeader];
    if (value === undefined || value === null) value = "";
    if (targetHeader === "tour_completed" && cleanSyncValue_(value) === "") value = "No";
    if (targetHeader === "service_type") value = normalizeInvoiceServiceType_(value);
    try {
      setMappedInvoiceValue_(
        target.getRange(targetRow, targetIndex[targetHeader] + 1),
        value
      );
    } catch (mappedWriteError) {
      console.log(JSON.stringify({
        warning: "protected_invoice_cell_skipped",
        row: targetRow,
        header: targetHeader,
        error: String(mappedWriteError && mappedWriteError.message ? mappedWriteError.message : mappedWriteError)
      }));
    }
  });
  stampInvoiceAuditFields_(target, targetIndex, targetRow, sourceRow);
  return targetRow;
}

/**
 * Writes immutable/auditable lifecycle metadata for rows created by the Stripe
 * staging sync. Timestamps are stored as UTC RFC 3339 text so downstream tools
 * and local LLM workflows never need to guess a timezone.
 */
function stampInvoiceAuditFields_(sheet, headerIndex, rowNumber, sourceRow) {
  var nowIso = new Date().toISOString();
  var sourceIso = normalizeUtcIso_(sourceRow.created_at_iso) || nowIso;
  var purpose = cleanSyncValue_(sourceRow.payment_purpose).toLowerCase();
  var invoiceNo = cleanSyncValue_(sourceRow.invoice_no).toUpperCase();
  var sourceSystem = purpose === "tip" || invoiceNo.indexOf("TIP-") === 0
    ? "tip_checkout"
    : "stripe_invoice_sync";

  setInvoiceAuditValueIfBlank_(sheet, headerIndex, rowNumber, "created_at", sourceIso);
  setInvoiceAuditValueIfBlank_(sheet, headerIndex, rowNumber, "paid_at", sourceIso);
  setInvoiceAuditValueIfBlank_(sheet, headerIndex, rowNumber, "source_system", sourceSystem);
  setInvoiceAuditValue_(sheet, headerIndex, rowNumber, "updated_at", nowIso);
}

function setInvoiceAuditValueIfBlank_(sheet, headerIndex, rowNumber, header, value) {
    if (!Object.prototype.hasOwnProperty.call(headerIndex, header)) return;
      var cell = sheet.getRange(rowNumber, headerIndex[header] + 1);
        if (cleanSyncValue_(cell.getDisplayValue()) !== "") return;
          try {
              cell.setValue(value);
                } catch (auditWriteError) {
                    console.log(JSON.stringify({
                          warning: "protected_invoice_audit_skipped",
                                row: rowNumber,
                                      header: header,
                                            error: String(auditWriteError && auditWriteError.message ? auditWriteError.message : auditWriteError)
                                                }));
                                                  }
                                                  }

function setInvoiceAuditValue_(sheet, headerIndex, rowNumber, header, value) {
    if (!Object.prototype.hasOwnProperty.call(headerIndex, header)) return;
      try {
          sheet.getRange(rowNumber, headerIndex[header] + 1).setValue(value);
            } catch (auditWriteError) {
                console.log(JSON.stringify({
                      warning: "protected_invoice_audit_skipped",
                            row: rowNumber,
                                  header: header,
                                        error: String(auditWriteError && auditWriteError.message ? auditWriteError.message : auditWriteError)
                                            }));
                                              }
                                              }

function normalizeUtcIso_(value) {
  var text = cleanSyncValue_(value);
  if (!text) return "";
  var parsed = new Date(text.replace(/ ET$/, "-05:00"));
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function setMappedInvoiceValue_(cell, value) {
  var rule = cell.getDataValidation();

  // A blank staging value must never erase an invoice calculation. If the
  // destination is a formula cell, the invoices sheet remains authoritative.
  if (cell.getFormula()) {
        return true;
          
  }
    
  if (!rule || cleanSyncValue_(value) === "") {
    cell.setValue(value);
    return true;
  }

  var criteria = rule.getCriteriaType();
  var args = rule.getCriteriaValues();
  var allowed = null;

  if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    allowed = args[0] || [];
  } else if (criteria === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    allowed = args[0].getDisplayValues().reduce(function (all, row) {
      return all.concat(row);
    }, []);
  }

  if (allowed) {
    var normalized = cleanSyncValue_(value);
    var valid = allowed.some(function (candidate) {
      return cleanSyncValue_(candidate) === normalized;
    });
    if (!valid) {
      console.log(JSON.stringify({
        warning: "invalid_dropdown_value_skipped",
        cell: cell.getA1Notation(),
        value: normalized
      }));
      return false;
    }
  }

  try {
    cell.setValue(value);
    return true;
  } catch (err) {
    console.log(JSON.stringify({
      warning: "mapped_value_skipped",
      cell: cell.getA1Notation(),
      value: cleanSyncValue_(value),
      error: String(err && err.message ? err.message : err)
    }));
    return false;
  }
}

/** Clears only the incomplete sandbox test row left by the validation stop. */
function cleanupPartialStripeSyncTestMBW0042() {
  var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
  var target = requireSyncSheet_(ss, MBW_SYNC_TARGET_SHEET);
  var headers = getUniqueHeaders_(target);
  var invoiceColumn = headers.index.invoice_no + 1;
  var values = target.getRange(2, invoiceColumn, target.getMaxRows() - 1, 1).getDisplayValues();
  var mapping = getStripeToInvoiceMapping_();
  var clearedRows = [];

  for (var i = 0; i < values.length; i++) {
    if (cleanSyncValue_(values[i][0]) !== "MBW-0042") continue;
    var row = i + 2;
    var tourKey = target.getRange(row, headers.index.tour_key + 1).getDisplayValue();
    var invoiceId = target.getRange(row, headers.index.invoice_id + 1).getDisplayValue();
    if (cleanSyncValue_(invoiceId) !== "in_1U8jSC1v3u4QBG7yFqOoPuGY") continue;
    if (cleanSyncValue_(tourKey)) continue;

    Object.keys(mapping).forEach(function (sourceHeader) {
      var targetHeader = mapping[sourceHeader];
      if (!Object.prototype.hasOwnProperty.call(headers.index, targetHeader)) return;
      target.getRange(row, headers.index[targetHeader] + 1).clearContent();
    });
    clearedRows.push(row);
  }

  SpreadsheetApp.flush();
  return logSyncResult_({ ok: true, cleared_partial_rows: clearedRows });
}

/**
 * One-time restoration of the historical live MBW-0042 row cleared during
 * sandbox cleanup. Values come from the pre-cleanup accounting export and
 * the matching live stripe_invoices record.
 */
function restoreHistoricalLiveMBW0042Row94() {
  var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
  var target = requireSyncSheet_(ss, MBW_SYNC_TARGET_SHEET);
  var headers = getUniqueHeaders_(target);
  var row = 94;
  var receiptUrl = "https://pay.stripe.com/receipts/invoices/CAcQARoXChVhY2N0XzFTejU5UzB3QUFsWXdxYVYomP3y0gYyBgkXSaR22zosFmqqEILlKevgb36HB4oBSPnOZ9Fhxzjrc3wGApyCrMI-B_dAHZI_Y9iUu8A?s=ap";
  var values = {
    date_paid: new Date(2026, 6, 19),
    tour_date: new Date(2026, 6, 23),
    tour_completed: "Yes",
    guest_first_name: "Ellie",
    guest_last_name: "Mayhew",
    guest_email: "elliemayhew24@icloud.com",
    guest_phone: "447464605650",
    home_country: "United Kingdom",
    party_size: 2,
    service_type: "Birdwatching",
    product_selected: "MBW004",
    tour_guide: "Chicho",
    payment_method: "Stripe",
    payment_reference_note: "",
    guest_rate_override: 60,
    standard_guest_price: "",
    charged_guest_price: "",
    pricing_reason: "",
    pricing_notes: "",
    discount_rate_guest: "",
    discount_reason: "",
    amount_received: 120,
    transaction_fee_total: 5.58,
    mbw_fee_pct_override: "",
    total_tip_collected: "",
    tip_paid_to_guide_override: "",
    pickup_location: "Mindo Garden\nhttps://maps.app.goo.gl/5cHn5m3znFuPHF2J6?g_st=iw\n\nwe are staying just outside of Mindo, about 5km away from town (Mindo Garden way, Via al Mariposario).\n",
    other_guests: "Kirsty Macphie",
    notes: "",
    guide_pay_model: "per_person",
    guide_base_rate: 35,
    guide_base_payout: 70,
    guide_tip_pct_used: "",
    tip_paid_to_guide: 0,
    tip_paid_to_mbw: 0,
    total_amount_owed_to_guide: 67.21,
    guide_paid_actual: "Yes",
    fees_paid_actual: "Yes",
    expense_reconciled_flag: "Yes",
    invoice_no_txt: "",
    tour_key: "",
    inquiry_id: "",
    guest_id: "",
    booking_id: "",
    stripe_customer_id: "",
    quote_id: ""
  };

  Object.keys(values).forEach(function (header) {
    if (Object.prototype.hasOwnProperty.call(headers.index, header)) {
      target.getRange(row, headers.index[header] + 1).setValue(values[header]);
    }
  });

  ["invoice_no", "invoice_id", "transaction_id"].forEach(function (header) {
    target.getRange(row, headers.index[header] + 1)
      .setFormula('=HYPERLINK("' + receiptUrl + '","MBW-0042")');
  });

  SpreadsheetApp.flush();
  return logSyncResult_({ ok: true, restored: true, row: row, invoice_no: "MBW-0042", environment: "live" });
}

/**
 * One-time repair: restores the missing second line of the sandbox MBW-0042
 * test after the original import stopped on an incompatible dropdown value.
 * It targets the immutable Stripe invoice ID and exact tour_key, so it cannot
 * affect the historical live MBW-0042 invoice.
 */
function recoverMissingSandboxMBW0042Item() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
    var source = requireSyncSheet_(ss, MBW_SYNC_SOURCE_SHEET);
    var target = requireSyncSheet_(ss, MBW_SYNC_TARGET_SHEET);
    var sourceHeaders = getUniqueHeaders_(source);
    var targetHeaders = getUniqueHeaders_(target);
    var wantedInvoiceId = "in_1U8jSC1v3u4QBG7yFqOoPuGY";
    var wantedTourKey = "in_1U8jSC1v3u4QBG7yFqOoPuGY|2|MBW016|2026-08-28|1";

    var existingKeys = buildExistingInvoiceKeys_(target, targetHeaders.index);
    var identity = "tour_key:" + wantedTourKey;
    if (existingKeys[identity]) {
      return logSyncResult_({
        ok: true,
        recovered: false,
        already_present: true,
        invoice_id: wantedInvoiceId,
        tour_key: wantedTourKey
      });
    }

    var lastRow = source.getLastRow();
    if (lastRow < 2) throw new Error("stripe_invoices has no data rows.");
    var rows = source.getRange(2, 1, lastRow - 1, sourceHeaders.values.length).getValues();
    var matched = null;
    var sourceRowNumber = null;

    for (var i = 0; i < rows.length; i++) {
      var candidate = rowToObject_(sourceHeaders.values, rows[i]);
      if (
        cleanSyncValue_(candidate.invoice_id) === wantedInvoiceId &&
        cleanSyncValue_(candidate.tour_key) === wantedTourKey
      ) {
        matched = candidate;
        sourceRowNumber = i + 2;
        break;
      }
    }

    if (!matched) {
      throw new Error("Exact sandbox MBW-0042 MBW016 source row was not found.");
    }

    var targetRowNumber = appendInvoiceRow_(target, targetHeaders.index, matched);
    SpreadsheetApp.flush();
    return logSyncResult_({
      ok: true,
      recovered: true,
      source_row: sourceRowNumber,
      target_row: targetRowNumber,
      invoice_id: wantedInvoiceId,
      tour_key: wantedTourKey
    });
  } finally {
    lock.releaseLock();
  }
}

/** Corrects the restored historical row's dates using noon to avoid UTC shifts. */
function correctRestoredHistoricalMBW0042Dates() {
  var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
  var target = requireSyncSheet_(ss, MBW_SYNC_TARGET_SHEET);
  var headers = getUniqueHeaders_(target);
  var row = 94;

  target.getRange(row, headers.index.date_paid + 1).setValue(new Date(2026, 6, 19, 12, 0, 0));
  target.getRange(row, headers.index.tour_date + 1).setValue(new Date(2026, 6, 23, 12, 0, 0));
  SpreadsheetApp.flush();

  return logSyncResult_({
    ok: true,
    corrected: true,
    row: row,
    invoice_no: "MBW-0042",
    date_paid: "2026-07-19",
    tour_date: "2026-07-23"
  });
}

function findFirstBlankInvoiceRow_(sheet, invoiceNoIndex) {
  var column = invoiceNoIndex + 1;
  var lastDataRow = getLastNonBlankRowInColumn_(sheet, column);
  var targetRow = Math.max(lastDataRow + 1, 2);

  // Append after the final populated invoice instead of filling an internal
  // blank. Historical/manual repairs can leave a gap above newer records; if
  // the importer reuses that gap, a newly paid invoice appears out of order.
  if (targetRow > sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
  return targetRow;
}
function ensureInvoiceRowTemplate_(sheet, targetRow) {
  var width = sheet.getLastColumn();
  if (targetRow <= 2) throw new Error("The invoices sheet needs an existing formula row as its template.");

  var destination = sheet.getRange(targetRow, 1, 1, width);
  destination.setFontFamily("Calibri").setFontSize(9);
  var destinationFormulas = destination.getFormulasR1C1()[0];
  var prepared = destinationFormulas.some(function (formula) { return !!formula; });
  if (prepared && !rowHasFormulaError_(destination)) return;

  var templateRow = findPriorHealthyInvoiceTemplateRow_(sheet, targetRow, width);
  if (!templateRow) throw new Error("No healthy invoice template row was found before row " + targetRow + ".");
  var template = sheet.getRange(templateRow, 1, 1, width);

  // Existing blank invoice rows already carry formatting and validation. Only
  // restore missing formulas so protected calculated cells cannot block a paid
  // invoice from reaching the accounting ledger.
  var formulas = template.getFormulasR1C1()[0];
  var destinationFormulas = destination.getFormulasR1C1()[0];
  for (var c = 0; c < formulas.length; c++) {
    if (!formulas[c] || destinationFormulas[c]) continue;
    try {
      sheet.getRange(targetRow, c + 1).setFormulaR1C1(formulas[c]);
    } catch (formulaError) {
      console.log(JSON.stringify({
        warning: "protected_invoice_formula_skipped",
        row: targetRow,
        column: c + 1,
        error: String(formulaError && formulaError.message ? formulaError.message : formulaError)
      }));
    }
  }
  sheet.setRowHeight(targetRow, sheet.getRowHeight(templateRow));
}

function findPriorHealthyInvoiceTemplateRow_(sheet, targetRow, width) {
  var startRow = Math.max(2, targetRow - 100);
  var rowCount = targetRow - startRow;
  if (rowCount < 1) return null;
  var range = sheet.getRange(startRow, 1, rowCount, width);
  var displays = range.getDisplayValues();
  var formulas = range.getFormulasR1C1();
  for (var i = rowCount - 1; i >= 0; i--) {
    var hasFormula = formulas[i].some(function (formula) { return !!formula; });
    var hasInvoice = cleanSyncValue_(displays[i][0]) !== "";
    if ((hasFormula || hasInvoice) && !displayRowHasFormulaError_(displays[i])) return startRow + i;
  }
  return null;
}

function rowHasFormulaError_(range) {
  return displayRowHasFormulaError_(range.getDisplayValues()[0]);
}

function displayRowHasFormulaError_(values) {
  return values.some(function (value) {
    return /^#(ERROR!|REF!|N\/A|VALUE!|NAME\?|DIV\/0!|NUM!|NULL!)/i.test(cleanSyncValue_(value));
  });
}

function repairStripeSyncTestMBW0040() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
    var source = requireSyncSheet_(ss, MBW_SYNC_SOURCE_SHEET);
    var target = requireSyncSheet_(ss, MBW_SYNC_TARGET_SHEET);
    var sourceHeaders = getUniqueHeaders_(source);
    var targetHeaders = getUniqueHeaders_(target);
    var sourceRows = source.getRange(2, 1, Math.max(source.getLastRow() - 1, 1), sourceHeaders.values.length).getValues();
    var sourceObject = null;

    for (var i = sourceRows.length - 1; i >= 0; i--) {
      var candidate = rowToObject_(sourceHeaders.values, sourceRows[i]);
      if (cleanSyncValue_(candidate.invoice_no) === "MBW-0040") {
        sourceObject = candidate;
        break;
      }
    }
    if (!sourceObject) throw new Error("MBW-0040 was not found in stripe_invoices.");

    var invoiceColumn = targetHeaders.index.invoice_no + 1;
    var targetValues = target.getRange(2, invoiceColumn, target.getMaxRows() - 1, 1).getDisplayValues();
    var misplacedRow = 0;
    for (var r = 0; r < targetValues.length; r++) {
      if (cleanSyncValue_(targetValues[r][0]) === "MBW-0040") misplacedRow = r + 2;
    }
    if (!misplacedRow) throw new Error("MBW-0040 was not found in invoices.");

    var correctRow = findFirstBlankInvoiceRow_(target, targetHeaders.index.invoice_no);
    if (correctRow === misplacedRow) {
      return logSyncResult_({ ok: true, repaired: false, reason: "already_in_first_blank_row", row: correctRow });
    }

    ensureInvoiceRowTemplate_(target, correctRow);
    var mapping = getStripeToInvoiceMapping_();
    Object.keys(mapping).forEach(function (sourceHeader) {
      var targetHeader = mapping[sourceHeader];
      if (!Object.prototype.hasOwnProperty.call(targetHeaders.index, targetHeader)) return;
      var column = targetHeaders.index[targetHeader] + 1;
      target.getRange(correctRow, column).setValue(sourceObject[sourceHeader] == null ? "" : sourceObject[sourceHeader]);
      target.getRange(misplacedRow, column).clearContent();
    });

    SpreadsheetApp.flush();
    return logSyncResult_({ ok: true, repaired: true, from_row: misplacedRow, to_row: correctRow, invoice_no: "MBW-0040" });
  } finally {
    lock.releaseLock();
  }
}

function getStripeToInvoiceMapping_() {
  return {
    invoice_no: "invoice_no",
    date_paid: "date_paid",
    tour_date: "tour_date",
    tour_completed: "tour_completed",
    guest_first_name: "guest_first_name",
    guest_last_name: "guest_last_name",
    guest_email: "guest_email",
    guest_phone: "guest_phone",
    home_country: "home_country",
    party_size: "party_size",
    product_selected: "product_selected",
    tour_guide: "tour_guide",
    payment_method: "payment_method",
    invoice_id: "invoice_id",
    transaction_id: "transaction_id",
    payment_reference_note: "payment_reference_note",
    guest_rate_override: "guest_rate_override",
    standard_price_per_person: "standard_guest_price",
    final_price_per_person: "charged_guest_price",
    pricing_reason: "pricing_reason",
    pricing_notes: "pricing_notes",
    discount_rate_guest: "discount_rate_guest",
    discount_reason: "discount_reason",
    amount_received: "amount_received",
    transaction_fee_total: "transaction_fee_total",
    mbw_fee_pct_override: "mbw_fee_pct_override",
    total_tip_collected: "total_tip_collected",
    tip_paid_to_guide_override: "tip_paid_to_guide_override",
    pickup_location: "pickup_location",
    other_guests: "other_guests",
    notes: "notes",
    invoice_no_txt: "invoice_no_txt",
    tour_key: "tour_key",
    inquiry_id: "inquiry_id",
    guest_id: "guest_id",
    booking_id: "booking_id",
    deposit_applied_amount: "deposit_applied_amount",
    deposit_payment_intent_id: "deposit_payment_intent_id",
    deposit_payment_method: "deposit_payment_method",
    stripe_customer_id: "stripe_customer_id",
    amount_before_deposit: "amount_before_deposit",
    amount_remaining: "amount_remaining",
    quote_id: "quote_id",
    promo_code: "promo_code",
    promo_discount_total: "promo_discount_total",
    promo_discount_per_guest: "promo_discount_per_guest",
    promo_eligible_guests: "promo_eligible_guests",
    promo_campaign: "promo_campaign"
  };
}

function buildExistingInvoiceKeys_(target, targetIndex) {
  var keys = {};
  var lastRow = getLastNonBlankRowInColumn_(target, targetIndex.invoice_no + 1);
  if (lastRow < 2) return keys;

  var headers = target.getRange(1, 1, 1, target.getLastColumn()).getValues()[0];
  var values = target.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var i = 0; i < values.length; i++) {
    var obj = rowToObject_(headers, values[i]);
    if (!cleanSyncValue_(obj.invoice_no)) continue;
    keys[buildTargetIdentity_(obj)] = i + 2;
  }
  return keys;
}

function buildStableInvoiceIdentity_(row) {
  return [
    "invoice_item",
    cleanSyncValue_(row.invoice_id) || cleanSyncValue_(row.invoice_no),
    cleanSyncValue_(row.transaction_id),
    normalizeSyncDateIdentity_(row.tour_date),
    cleanSyncValue_(row.product_selected),
    normalizeSyncAmountIdentity_(row.amount_received)
  ].join("|");
}

function normalizeSyncDateIdentity_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "America/Guayaquil", "yyyy-MM-dd");
  }
  return cleanSyncValue_(value).slice(0, 10);
}

function normalizeSyncAmountIdentity_(value) {
  var cleaned = String(value === null || value === undefined ? "" : value).replace(/[$,\s]/g, "");
  var amount = Number(cleaned);
  return cleaned !== "" && isFinite(amount) ? amount.toFixed(2) : cleanSyncValue_(value);
}

function buildSourceIdentity_(row) {
  var tourKey = cleanSyncValue_(row.tour_key);
  if (tourKey) return "tour_key:" + tourKey;
  return buildStableInvoiceIdentity_(row);
}

function isAppliedDepositCreditRow_(row) {
  var amount = Number(String(row.amount_received == null ? "" : row.amount_received).replace(/[$,\s]/g, ""));
  if (!(amount < 0)) return false;

  var hasServiceIdentity = Boolean(
    cleanSyncValue_(row.product_selected) ||
    cleanSyncValue_(row.service_type) ||
    cleanSyncValue_(row.tour_title) ||
    cleanSyncValue_(row.tour_date)
  );
  if (!hasServiceIdentity) return true;

  var text = [row.notes, row.pricing_notes, row.tour_title, row.service_type]
    .map(cleanSyncValue_)
    .join(" ")
    .toLowerCase();
  return text.indexOf("deposit") >= 0 && (text.indexOf("credit") >= 0 || text.indexOf("applied") >= 0);
}

function buildTargetIdentity_(row) {
  var tourKey = cleanSyncValue_(row.tour_key);
  if (tourKey) return "tour_key:" + tourKey;
  return buildStableInvoiceIdentity_(row);
}

function repairMBW0148() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
    var source = requireSyncSheet_(ss, MBW_SYNC_SOURCE_SHEET);
    var target = requireSyncSheet_(ss, MBW_SYNC_TARGET_SHEET);
    var sourceHeaders = getUniqueHeaders_(source);
    var targetHeaders = getUniqueHeaders_(target);
    var sourceValues = source.getRange(2, 1, Math.max(source.getLastRow() - 1, 1), sourceHeaders.values.length).getValues();
    var wanted = [];
    for (var i = 0; i < sourceValues.length; i++) {
      var candidate = rowToObject_(sourceHeaders.values, sourceValues[i]);
      if (cleanSyncValue_(candidate.invoice_no) === "MBW-0148" && !isAppliedDepositCreditRow_(candidate)) wanted.push(candidate);
    }
    if (wanted.length !== 3) throw new Error("Expected exactly 3 MBW-0148 service rows; found " + wanted.length + ".");

    var existing = buildExistingInvoiceKeys_(target, targetHeaders.index);
    var importedRows = [];
    wanted.forEach(function (row) {
      var identity = buildSourceIdentity_(row);
      if (existing[identity]) return;
      importedRows.push(appendInvoiceRow_(target, targetHeaders.index, row));
      existing[identity] = true;
    });
    SpreadsheetApp.flush();
    return logSyncResult_({
      ok: true,
      invoice_no: "MBW-0148",
      expected_source_rows: wanted.length,
      imported_rows: importedRows,
      imported_count: importedRows.length
    });
  } finally {
    lock.releaseLock();
  }
}

function validateSyncHeaders_(source) {
  var sourceHeaders = getUniqueHeaders_(source);
  ["invoice_no", "invoice_id", "transaction_id", "tour_key", "inquiry_id", "guest_id", "booking_id", "quote_id"].forEach(function (name) {
    if (!Object.prototype.hasOwnProperty.call(sourceHeaders.index, name)) {
      throw new Error("Missing required stripe_invoices header: " + name);
    }
  });
}

function validateRequiredHeaders_(sourceIndex, targetIndex) {
  ["invoice_no", "invoice_id", "transaction_id", "tour_key", "inquiry_id", "guest_id", "booking_id", "quote_id"].forEach(function (name) {
    if (!Object.prototype.hasOwnProperty.call(sourceIndex, name)) {
      throw new Error("Missing required stripe_invoices header: " + name);
    }
    if (!Object.prototype.hasOwnProperty.call(targetIndex, name)) {
      throw new Error("Missing required invoices header: " + name);
    }
  });
}

function getUniqueHeaders_(sheet) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) throw new Error(sheet.getName() + " has no headers.");
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var index = {};
  for (var i = 0; i < headers.length; i++) {
    var name = String(headers[i] || "").trim();
    if (!name) continue;
    if (Object.prototype.hasOwnProperty.call(index, name)) {
      throw new Error("Duplicate header in " + sheet.getName() + ": " + name);
    }
    index[name] = i;
  }
  return { values: headers, index: index };
}

function rowToObject_(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var name = String(headers[i] || "").trim();
    if (name) obj[name] = row[i];
  }
  return obj;
}

function cleanSyncValue_(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function requireSyncSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Sheet tab not found: " + name);
  return sheet;
}

function removeStripeInvoiceSyncTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === MBW_SYNC_HANDLER || handler === MBW_EXPENSE_SYNC_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function logSyncResult_(result) {
  console.log(JSON.stringify(result));
  return result;
}
