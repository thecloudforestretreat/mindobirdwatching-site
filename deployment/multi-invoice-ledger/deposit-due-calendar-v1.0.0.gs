/**
 * MBW Deposit Balance Due Calendar Sync v1.0.0
 *
 * Isolated from the five-minute Stripe invoice sync so Calendar latency or
 * authorization can never block invoice or expense accounting.
 */

var MBW_DEPOSIT_DUE_CALENDAR_HANDLER = "syncDepositDueCalendar";
var MBW_DEPOSIT_DUE_CALENDAR_ID = "mindobirdwatching@gmail.com";
var MBW_DEPOSIT_DUE_TIMEZONE = "America/Guayaquil";

/** Read-only deposit audit. Safe to run before enabling Calendar writes. */
function auditDepositDueCalendar() {
  var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
  var deposits = requireSyncSheet_(ss, MBW_SYNC_DEPOSITS_SHEET);
  var audit = buildDepositDueAudit_(deposits, new Date());
  console.log(JSON.stringify(audit));
  return audit;
}

/**
 * Daily, idempotent Calendar sync for deposit balances.
 * Creates one internal all-day event on balance_due_date, reuses its stored
 * event ID, never invites guests, and removes only future reminders when a
 * balance is paid, cancelled, or refunded. Past events remain as history.
 */
function syncDepositDueCalendar() {
  // Keep Calendar concurrency isolated from the five-minute accounting sync,
  // which deliberately uses the project-wide script lock.
  var lock = LockService.getUserLock();
  if (!lock.tryLock(5000)) {
    return logSyncResult_({ ok: true, skipped: true, reason: "another_sync_is_running" });
  }
  try {
    var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
    var deposits = requireSyncSheet_(ss, MBW_SYNC_DEPOSITS_SHEET);
    var headers = ensureDepositCalendarHeaders_(deposits);
    var lastRow = getLastNonBlankRowInColumn_(deposits, headers.index.deposit_id + 1);
    if (lastRow < 2) return logSyncResult_({ ok: true, scanned: 0, created: 0, updated: 0 });

    var values = deposits.getRange(2, 1, lastRow - 1, headers.values.length).getValues();
    var calendar = CalendarApp.getCalendarById(MBW_DEPOSIT_DUE_CALENDAR_ID);
    if (!calendar) throw new Error("Deposit due calendar is unavailable: " + MBW_DEPOSIT_DUE_CALENDAR_ID);

    var today = depositDateOnly_(new Date());
    var created = 0;
    var updated = 0;
    var closed = 0;
    var skipped = 0;
    var errors = 0;

    for (var i = 0; i < values.length; i++) {
      var row = rowToObject_(headers.values, values[i]);
      var rowNumber = i + 2;
      var eventId = cleanSyncValue_(row.calendar_event_id);
      var candidate = depositDueCandidate_(row);
      try {
        if (!candidate) {
          if (eventId) {
            var existingClosedEvent = calendar.getEventById(eventId);
            var existingDueDate = depositDateOnly_(row.balance_due_date);
            if (existingClosedEvent && existingDueDate && existingDueDate.getTime() >= today.getTime()) {
              existingClosedEvent.deleteEvent();
              setDepositCalendarFields_(deposits, headers.index, rowNumber, {
                calendar_sync: "N/A",
                calendar_event_id: "",
                calendar_synced_at: depositTimestamp_(),
                calendar_sync_error: ""
              });
              closed++;
            }
          }
          skipped++;
          continue;
        }

        var event = eventId ? calendar.getEventById(eventId) : null;
        var title = depositDueEventTitle_(candidate);
        var description = depositDueEventDescription_(candidate);
        if (!event) {
          event = calendar.createAllDayEvent(title, candidate.dueDate, { description: description });
          event.setColor(CalendarApp.EventColor.YELLOW);
          event.removeAllReminders();
          event.addPopupReminder(7 * 24 * 60);
          event.addPopupReminder(24 * 60);
          created++;
        } else {
          event.setTitle(title);
          event.setDescription(description);
          event.setAllDayDate(candidate.dueDate);
          event.setColor(CalendarApp.EventColor.YELLOW);
          updated++;
        }
        setDepositCalendarFields_(deposits, headers.index, rowNumber, {
          calendar_sync: "Yes",
          calendar_event_id: event.getId(),
          calendar_synced_at: depositTimestamp_(),
          calendar_sync_error: ""
        });
      } catch (error) {
        errors++;
        setDepositCalendarFields_(deposits, headers.index, rowNumber, {
          calendar_sync: "No",
          calendar_synced_at: depositTimestamp_(),
          calendar_sync_error: String(error && error.message ? error.message : error).slice(0, 500)
        });
      }
    }

    SpreadsheetApp.flush();
    return logSyncResult_({
      ok: errors === 0,
      scanned: values.length,
      created: created,
      updated: updated,
      future_events_closed: closed,
      skipped: skipped,
      errors: errors,
      calendar_id: MBW_DEPOSIT_DUE_CALENDAR_ID
    });
  } finally {
    lock.releaseLock();
  }
}

function setupDepositDueCalendarSync() {
  var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
  var deposits = requireSyncSheet_(ss, MBW_SYNC_DEPOSITS_SHEET);
  ensureDepositCalendarHeaders_(deposits);
  removeDepositDueCalendarTriggers_();
  ScriptApp.newTrigger(MBW_DEPOSIT_DUE_CALENDAR_HANDLER)
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .inTimezone(MBW_DEPOSIT_DUE_TIMEZONE)
    .create();
  return logSyncResult_({
    ok: true,
    handler: MBW_DEPOSIT_DUE_CALENDAR_HANDLER,
    schedule: "daily at 06:00 America/Guayaquil",
    calendar_id: MBW_DEPOSIT_DUE_CALENDAR_ID,
    audit: buildDepositDueAudit_(deposits, new Date())
  });
}

function checkDepositDueCalendarSyncStatus() {
  var ss = SpreadsheetApp.openById(MBW_SYNC_SPREADSHEET_ID);
  var deposits = requireSyncSheet_(ss, MBW_SYNC_DEPOSITS_SHEET);
  var headers = ensureDepositCalendarHeaders_(deposits);
  var lastRow = getLastNonBlankRowInColumn_(deposits, headers.index.deposit_id + 1);
  var values = lastRow > 1
    ? deposits.getRange(2, 1, lastRow - 1, headers.values.length).getValues()
    : [];
  var synced = 0;
  var errors = 0;
  values.forEach(function (valuesRow) {
    var row = rowToObject_(headers.values, valuesRow);
    if (cleanSyncValue_(row.calendar_event_id)) synced++;
    if (cleanSyncValue_(row.calendar_sync_error)) errors++;
  });
  var triggerCount = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === MBW_DEPOSIT_DUE_CALENDAR_HANDLER;
  }).length;
  return logSyncResult_({
    ok: errors === 0,
    trigger_count: triggerCount,
    synced_event_count: synced,
    error_count: errors,
    audit: buildDepositDueAudit_(deposits, new Date())
  });
}

function buildDepositDueAudit_(sheet, now) {
  var headers = getUniqueHeaders_(sheet);
  var lastRow = getLastNonBlankRowInColumn_(sheet, headers.index.deposit_id + 1);
  var values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, headers.values.length).getValues()
    : [];
  var today = depositDateOnly_(now);
  var audit = {
    ok: true,
    populated_rows: values.length,
    outstanding: 0,
    overdue: 0,
    due_today: 0,
    future_due: 0,
    missing_required_fields: 0,
    duplicate_deposit_ids: 0,
    duplicate_payment_intents: 0,
    invalid_due_dates: 0,
    due_date_mismatches: 0,
    rows_needing_attention: []
  };
  var ids = {};
  var paymentIntents = {};
  values.forEach(function (valuesRow, index) {
    var row = rowToObject_(headers.values, valuesRow);
    var rowNumber = index + 2;
    var id = cleanSyncValue_(row.deposit_id);
    var pi = cleanSyncValue_(row.stripe_payment_intent_id);
    if (id) ids[id] = (ids[id] || 0) + 1;
    if (pi) paymentIntents[pi] = (paymentIntents[pi] || 0) + 1;
    var candidate = depositDueCandidate_(row);
    if (!candidate) return;
    audit.outstanding++;
    var required = [
      "deposit_id", "inquiry_id", "guest_id", "tour_date", "balance_due_date",
      "guest_first_name", "guest_last_name", "guest_email", "guest_phone",
      "home_country", "party_size", "total_booking_price", "balance_remaining"
    ];
    var missing = required.filter(function (name) { return !cleanSyncValue_(row[name]); });
    if (missing.length) {
      audit.missing_required_fields++;
      audit.rows_needing_attention.push({ row: rowNumber, deposit_id: id, issue: "missing " + missing.join(", ") });
    }
    var tourDate = depositDateOnly_(row.tour_date);
    if (!tourDate || !candidate.dueDate) {
      audit.invalid_due_dates++;
      audit.rows_needing_attention.push({ row: rowNumber, deposit_id: id, issue: "invalid tour or balance due date" });
      return;
    }
    var expected = new Date(tourDate.getTime());
    expected.setDate(expected.getDate() - 14);
    if (expected.getTime() !== candidate.dueDate.getTime()) {
      audit.due_date_mismatches++;
      audit.rows_needing_attention.push({ row: rowNumber, deposit_id: id, issue: "balance due date is not 14 days before tour" });
    }
    if (candidate.dueDate.getTime() < today.getTime()) audit.overdue++;
    else if (candidate.dueDate.getTime() === today.getTime()) audit.due_today++;
    else audit.future_due++;
  });
  Object.keys(ids).forEach(function (id) { if (ids[id] > 1) audit.duplicate_deposit_ids++; });
  Object.keys(paymentIntents).forEach(function (id) { if (paymentIntents[id] > 1) audit.duplicate_payment_intents++; });
  audit.ok = !audit.missing_required_fields && !audit.duplicate_deposit_ids &&
    !audit.duplicate_payment_intents && !audit.invalid_due_dates && !audit.due_date_mismatches;
  return audit;
}

function depositDueCandidate_(row) {
  var statuses = [row.booking_status, row.deposit_status].map(cleanSyncValue_).join(" ").toLowerCase();
  var balance = depositMoney_(row.balance_remaining);
  var fullyPaid = cleanSyncValue_(row.is_fully_paid).toLowerCase() === "yes";
  var dueDate = depositDateOnly_(row.balance_due_date);
  if (!cleanSyncValue_(row.deposit_id) || !dueDate || balance <= 0.005 || fullyPaid || /cancel|refund/.test(statuses)) return null;
  return {
    depositId: cleanSyncValue_(row.deposit_id),
    inquiryId: cleanSyncValue_(row.inquiry_id),
    guestName: [cleanSyncValue_(row.guest_first_name), cleanSyncValue_(row.guest_last_name)].filter(Boolean).join(" ") || "Guest",
    tourDate: depositDateOnly_(row.tour_date),
    dueDate: dueDate,
    balance: balance,
    totalBookingPrice: depositMoney_(row.total_booking_price),
    totalPaid: depositMoney_(row.total_amount_paid)
  };
}

function depositDueEventTitle_(candidate) {
  return "Deposit balance due — " + candidate.guestName + " — US$" + candidate.balance.toFixed(2);
}

function depositDueEventDescription_(candidate) {
  return [
    "Internal Mindo Bird Watching balance reminder.",
    "Deposit ID: " + candidate.depositId,
    "Inquiry ID: " + (candidate.inquiryId || "Not recorded"),
    "Tour date: " + depositDateText_(candidate.tourDate),
    "Booking total: US$" + candidate.totalBookingPrice.toFixed(2),
    "Paid to date: US$" + candidate.totalPaid.toFixed(2),
    "Balance due: US$" + candidate.balance.toFixed(2),
    "Accounting sheet: https://docs.google.com/spreadsheets/d/" + MBW_SYNC_SPREADSHEET_ID + "/edit#gid=1617210202",
    "Guests are not invited to this internal event."
  ].join("\n");
}

function ensureDepositCalendarHeaders_(sheet) {
  var required = ["calendar_event_id", "calendar_synced_at", "calendar_sync_error"];
  var headers = getUniqueHeaders_(sheet);
  required.forEach(function (name) {
    if (headers.index[name] !== undefined) return;
    var column = headers.values.length + 1;
    sheet.getRange(1, Math.max(column - 1, 1)).copyTo(
      sheet.getRange(1, column),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
    sheet.getRange(1, column).setValue(name);
    sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1)
      .setFontFamily("Calibri")
      .setFontSize(9);
    headers = getUniqueHeaders_(sheet);
  });
  return headers;
}

function setDepositCalendarFields_(sheet, index, rowNumber, values) {
  Object.keys(values).forEach(function (name) {
    if (index[name] === undefined) return;
    sheet.getRange(rowNumber, index[name] + 1).setValue(values[name]);
  });
}

function depositDateOnly_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    var existing = Utilities.formatDate(value, MBW_DEPOSIT_DUE_TIMEZONE, "yyyy-MM-dd");
    return new Date(existing + "T12:00:00");
  }
  var text = cleanSyncValue_(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  var parsed = new Date(text + "T12:00:00");
  return isNaN(parsed.getTime()) ? null : parsed;
}

function depositDateText_(value) {
  return value ? Utilities.formatDate(value, MBW_DEPOSIT_DUE_TIMEZONE, "yyyy-MM-dd") : "Not recorded";
}

function depositMoney_(value) {
  var cleaned = String(value === null || value === undefined ? "" : value).replace(/[$,\s]/g, "");
  var amount = Number(cleaned);
  return cleaned !== "" && isFinite(amount) ? amount : 0;
}

function depositTimestamp_() {
  return Utilities.formatDate(new Date(), "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
}

function removeDepositDueCalendarTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === MBW_DEPOSIT_DUE_CALENDAR_HANDLER) ScriptApp.deleteTrigger(trigger);
  });
}
