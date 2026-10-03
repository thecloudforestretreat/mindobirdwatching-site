/**
 * MBW Invoices Logger (Google Apps Script) - v8 FULL DROP-IN
 *
 * v8 updates:
 * - exposes the deployed version and header audit through doGet
 * - accepts the existing { fields: {...} } payload format
 * - also accepts a future { rows: [{...}, {...}] } batch payload format
 * - dedupes service rows by tour_key
 * - updates an existing keyed row with new nonblank source values when an event is resent
 * - falls back to stripe_event_id for rows without a tour_key
 * - falls back to invoice_id + transaction_id only for rows without a tour_key
 * - writes all new rows from one request in one setValues call
 * - keeps one script lock around the entire request
 */

var LOGGER_VERSION = "v8-upsert-batch-header-audit-2026-09-24";
var SHEET_ID = "1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU";
var SHEET_NAME = "stripe_invoices";
var SHARED_SECRET = "MBW_STRIPE_SHEETS_SECRET_2026";

var REQUIRED_HEADERS = [
  "stripe_event_id",
  "invoice_id",
  "transaction_id",
  "tour_key",
  "deposit_payment_intent_id",
  "deposit_applied_amount",
  "amount_before_deposit",
  "amount_remaining"
];

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var sheetInfo = getSheetInfo_();
    return jsonOut({
      ok: sheetInfo.missingHeaders.length === 0,
      message: "MBW invoices logger is running",
      version: LOGGER_VERSION,
      sheet: SHEET_NAME,
      header_count: sheetInfo.headers.length,
      missing_required_headers: sheetInfo.missingHeaders
    });
  } catch (err) {
    return jsonOut({
      ok: false,
      message: "MBW invoices logger configuration error",
      version: LOGGER_VERSION,
      error: errorMessage_(err)
    });
  }
}

function doPost(e) {
  var token = e && e.parameter && e.parameter.token
    ? String(e.parameter.token)
    : "";

  if (!token || token !== SHARED_SECRET) {
    return jsonOut({ ok: false, version: LOGGER_VERSION, error: "Unauthorized" });
  }

  if (!e || !e.postData || !e.postData.contents) {
    return jsonOut({ ok: false, version: LOGGER_VERSION, error: "Missing body" });
  }

  var payload;
  try {
    payload = JSON.parse(e.postData.contents || "{}");
  } catch (parseErr) {
    return jsonOut({
      ok: false,
      version: LOGGER_VERSION,
      error: "Invalid JSON: " + errorMessage_(parseErr)
    });
  }

  var incomingRows = normalizeIncomingRows_(payload);
  if (!incomingRows.length) {
    return jsonOut({
      ok: false,
      version: LOGGER_VERSION,
      error: "Payload must contain fields or rows"
    });
  }

  var lock = LockService.getScriptLock();
  var lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(30000);
    if (!lockAcquired) {
      return jsonOut({
        ok: false,
        version: LOGGER_VERSION,
        error: "Lock timeout: another logger request held the script lock for more than 30 seconds"
      });
    }

    var info = getSheetInfo_();
    if (info.missingHeaders.length) {
      return jsonOut({
        ok: false,
        version: LOGGER_VERSION,
        error: "Missing required stripe_invoices headers",
        missing_required_headers: info.missingHeaders
      });
    }

    var sh = info.sheet;
    var headers = info.headers;
    var headerIndex = info.headerIndex;
    var lastRow = sh.getLastRow();
    var existing = lastRow > 1
      ? sh.getRange(2, 1, lastRow - 1, headers.length).getValues()
      : [];

    var tourKeyRows = {};
    var eventNoTourRows = {};
    var invoiceTransactionNoTourRows = {};

    for (var i = 0; i < existing.length; i++) {
      var sheetRowNumber = i + 2;
      var existingTourKey = cellString_(existing[i], headerIndex, "tour_key");
      var existingEventId = cellString_(existing[i], headerIndex, "stripe_event_id");
      var existingInvoiceId = cellString_(existing[i], headerIndex, "invoice_id");
      var existingTransactionId = cellString_(existing[i], headerIndex, "transaction_id");

      if (existingTourKey) {
        tourKeyRows[existingTourKey] = sheetRowNumber;
      } else {
        if (existingEventId) eventNoTourRows[existingEventId] = sheetRowNumber;
        if (existingInvoiceId && existingTransactionId) {
          invoiceTransactionNoTourRows[existingInvoiceId + "\u001f" + existingTransactionId] = sheetRowNumber;
        }
      }
    }

    var rowsToAppend = [];
    var results = [];

    for (var r = 0; r < incomingRows.length; r++) {
      var fields = incomingRows[r];
      var stripeEventId = safeField(fields, "stripe_event_id");
      var invoiceId = safeField(fields, "invoice_id");
      var transactionId = safeField(fields, "transaction_id");
      var tourKey = safeField(fields, "tour_key");
      var existingRowNumber = 0;
      var duplicateReason = "";

      if (tourKey && tourKeyRows[tourKey]) {
        existingRowNumber = tourKeyRows[tourKey];
        duplicateReason = "Existing tour_key";
      } else if (!tourKey && stripeEventId && eventNoTourRows[stripeEventId]) {
        existingRowNumber = eventNoTourRows[stripeEventId];
        duplicateReason = "Existing stripe_event_id without tour_key";
      } else if (!tourKey && invoiceId && transactionId) {
        var invoiceTransactionKey = invoiceId + "\u001f" + transactionId;
        if (invoiceTransactionNoTourRows[invoiceTransactionKey]) {
          existingRowNumber = invoiceTransactionNoTourRows[invoiceTransactionKey];
          duplicateReason = "Existing invoice_id + transaction_id without tour_key";
        }
      }

      if (existingRowNumber) {
        var updatedColumns = updateExistingRow_(
          sh,
          existingRowNumber,
          headers,
          headerIndex,
          fields
        );

        results.push({
          appended: false,
          updated_existing: updatedColumns.length > 0,
          skipped_duplicate: updatedColumns.length === 0,
          reason: duplicateReason,
          sheet_row: existingRowNumber,
          tour_key: tourKey,
          stripe_event_id: stripeEventId,
          invoice_id: invoiceId,
          updated_columns: updatedColumns
        });
        continue;
      }

      var row = buildSheetRow_(headers, headerIndex, fields);
      rowsToAppend.push(row);

      var futureRowNumber = lastRow + rowsToAppend.length;
      if (tourKey) {
        tourKeyRows[tourKey] = futureRowNumber;
      } else {
        if (stripeEventId) eventNoTourRows[stripeEventId] = futureRowNumber;
        if (invoiceId && transactionId) {
          invoiceTransactionNoTourRows[invoiceId + "\u001f" + transactionId] = futureRowNumber;
        }
      }

      results.push({
        appended: true,
        updated_existing: false,
        skipped_duplicate: false,
        sheet_row: futureRowNumber,
        tour_key: tourKey,
        stripe_event_id: stripeEventId,
        invoice_id: invoiceId
      });
    }

    if (rowsToAppend.length) {
      sh.getRange(lastRow + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }

    SpreadsheetApp.flush();

    var singleResult = results.length === 1 ? results[0] : null;

    return jsonOut({
      ok: true,
      version: LOGGER_VERSION,
      sheet: SHEET_NAME,
      received: incomingRows.length,
      appended: singleResult ? singleResult.appended : undefined,
      updated_existing: singleResult ? singleResult.updated_existing : undefined,
      skipped_duplicate: singleResult ? singleResult.skipped_duplicate : undefined,
      appended_count: countResult_(results, "appended"),
      updated_existing_count: countResult_(results, "updated_existing"),
      skipped_duplicate_count: countResult_(results, "skipped_duplicate"),
      results: results
    });
  } catch (err) {
    return jsonOut({
      ok: false,
      version: LOGGER_VERSION,
      error: errorMessage_(err)
    });
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (releaseErr) {}
    }
  }
}

function getSheetInfo_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error("Sheet tab not found: " + SHEET_NAME);

  var lastCol = sh.getLastColumn();
  if (lastCol < 1) throw new Error("Sheet has no header row");

  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerIndex = {};
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i] || "").trim();
    if (header) headerIndex[header] = i;
  }

  var missingHeaders = [];
  for (var j = 0; j < REQUIRED_HEADERS.length; j++) {
    if (!Object.prototype.hasOwnProperty.call(headerIndex, REQUIRED_HEADERS[j])) {
      missingHeaders.push(REQUIRED_HEADERS[j]);
    }
  }

  return {
    sheet: sh,
    headers: headers,
    headerIndex: headerIndex,
    missingHeaders: missingHeaders
  };
}

function normalizeIncomingRows_(payload) {
  if (payload && Array.isArray(payload.rows)) {
    return payload.rows.filter(function (row) {
      return row && typeof row === "object" && !Array.isArray(row);
    });
  }

  var fields = payload && payload.fields ? payload.fields : payload;
  if (fields && typeof fields === "object" && !Array.isArray(fields)) {
    return [fields];
  }

  return [];
}

function buildSheetRow_(headers, headerIndex, fields) {
  var row = new Array(headers.length);
  for (var i = 0; i < row.length; i++) row[i] = "";

  for (var key in headerIndex) {
    if (
      Object.prototype.hasOwnProperty.call(headerIndex, key) &&
      fields &&
      Object.prototype.hasOwnProperty.call(fields, key)
    ) {
      row[headerIndex[key]] = fields[key] == null ? "" : fields[key];
    }
  }

  return row;
}

function updateExistingRow_(sh, rowNumber, headers, headerIndex, fields) {
  var range = sh.getRange(rowNumber, 1, 1, headers.length);
  var values = range.getValues()[0];
  var updatedColumns = [];

  for (var key in headerIndex) {
    if (!Object.prototype.hasOwnProperty.call(headerIndex, key)) continue;
    if (!fields || !Object.prototype.hasOwnProperty.call(fields, key)) continue;

    var incoming = fields[key];
    if (incoming === null || incoming === undefined || String(incoming).trim() === "") continue;

    var idx = headerIndex[key];
    var current = values[idx];
    if (String(current == null ? "" : current) === String(incoming)) continue;

    values[idx] = incoming;
    updatedColumns.push(key);
  }

  if (updatedColumns.length) range.setValues([values]);
  return updatedColumns;
}

function cellString_(row, headerIndex, key) {
  if (!Object.prototype.hasOwnProperty.call(headerIndex, key)) return "";
  return String(row[headerIndex[key]] == null ? "" : row[headerIndex[key]]).trim();
}

function safeField(fields, key) {
  if (!fields || !Object.prototype.hasOwnProperty.call(fields, key)) return "";
  return String(fields[key] == null ? "" : fields[key]).trim();
}

function countResult_(results, key) {
  var count = 0;
  for (var i = 0; i < results.length; i++) {
    if (results[i] && results[i][key] === true) count++;
  }
  return count;
}

function errorMessage_(err) {
  return String(err && err.message ? err.message : err);
}
