/**
 * MBW CRM Router for Google Sheets
 *
 * Purpose:
 * - Keep raw site tabs intact: contacts, book_tour.
 * - Normalize every incoming lead into crm_guests + crm_inquiries.
 * - Create follow-up tasks that can drive email/calendar reminders.
 *
 * Install:
 * 1. Add this code to the same Apps Script project as the spreadsheet, or to a
 *    container-bound script attached to the spreadsheet.
 * 2. Update SPREADSHEET_ID and CALENDAR_ID.
 * 3. Run setupCrm() once.
 * 4. Call routeContactSubmission_(data, rowNumber) from the contact form script.
 * 5. Call routeBookTourSubmission_(data, rowNumber) from the book-tour script.
 * 6. Optional: create a time trigger for routeAllNewRawRows() every 5 minutes.
 */

const SPREADSHEET_ID = "1rdPmYmhCehx_3bI737dkg8NyiutwIu3NAav7B-mbwlw";
const CRM_TIMEZONE = "America/Guayaquil";
const INTERNAL_NOTIFY_EMAIL = "mindobirdwatching@gmail.com";
const CALENDAR_ID = "primary";
const ATTRIBUTION_CRM_CONTACT_URL = "https://mindobirdwatching.com/api/attribution/crm-contact";
const MANUAL_FOLLOWUP_OVERRIDE_NOTE = "MBW manual follow-up override";
const MANUAL_REQUESTED_DATE_OVERRIDE_NOTE = "MBW manual requested date override";
const MANUAL_LAST_CONTACTED_OVERRIDE_NOTE = "MBW manual last-contacted override";
const MANUAL_STATUS_OVERRIDE_NOTE = "MBW manual status override";
let CACHED_SHEET_TIMEZONE = "";

const CRM_TABS = {
  guests: "crm_guests",
  inquiries: "crm_inquiries",
  followups: "crm_followups",
  bookings: "crm_bookings",
  payments: "crm_payments",
  emailTemplates: "crm_emails",
  emailLog: "crm_email_log",
  activity: "crm_activity_log",
  settings: "crm_settings"
};

const CRM_PIPELINE_REVIEW_TAB = "crm_pipeline_review";
const CRM_PIPELINE_REVIEW_HEADERS = [
  "inquiry_id",
  "created_at", "updated_at", "source_tab", "source_row", "status",
  "last_contacted_at", "followup_date", "next_action", "priority",
  "first_name", "last_name", "full_name", "email", "phone_normalized",
  "requested_date_start", "requested_date_end", "requested_date_text",
  "guest_count", "tour_type", "tour_category", "grouping_preference",
  "grouping_status", "accommodation_needs", "transportation_needed",
  "pickup_location", "special_interests", "message_questions"
];
const CRM_PIPELINE_REVIEW_ACTIVE_STATUSES = [
  "new", "contacted", "planning", "qualified", "quoted", "follow_up",
  "deposit_pending", "deposit_paid", "payment_pending", "booked"
];
const CRM_PIPELINE_REVIEW_EDITABLE_HEADERS = {
  status: true,
  last_contacted_at: true,
  followup_date: true,
  next_action: true,
  priority: true,
  first_name: true,
  last_name: true,
  full_name: true,
  email: true,
  phone_normalized: true,
  requested_date_start: true,
  requested_date_end: true,
  requested_date_text: true,
  guest_count: true,
  tour_type: true,
  tour_category: true,
  grouping_preference: true,
  grouping_status: true,
  accommodation_needs: true,
  transportation_needed: true,
  pickup_location: true,
  special_interests: true,
  message_questions: true
};

const CRM_HEADERS = {
  crm_guests: [
    "guest_id", "created_at", "updated_at", "first_contact_at", "last_contact_at",
    "first_name", "last_name", "full_name", "email", "email_normalized",
    "phone_raw", "phone_normalized", "country", "preferred_language", "guest_type",
    "vip_status", "source_first", "source_latest", "total_inquiries",
    "total_confirmed_bookings", "duplicate_key", "status", "notes",
    "last_completed_tour_date", "total_completed_tours", "lifetime_value"
  ],
  crm_inquiries: [
    "inquiry_id", "guest_id", "created_at", "updated_at", "source_type",
    "source_tab", "source_row", "source_page", "assigned_to", "status",
    "stage_changed_at", "last_contacted_at", "followup_date", "next_action",
    "priority", "first_name", "last_name", "full_name", "email",
    "email_normalized", "phone_raw", "phone_normalized", "requested_date_start",
    "requested_date_end", "requested_date_text", "guest_count", "guest_count_text",
    "tour_type", "tour_category", "accommodation_needs", "transportation_needed",
    "pickup_location", "special_interests", "message_questions", "internal_notes",
    "availability_status", "quote_status", "payment_status", "quoted_amount",
    "quoted_currency", "quote_options_json", "quote_sent_at", "quote_sent_channel",
    "quote_notes", "confirmed_date", "completed_date", "lost_reason",
    "source_record_id", "grouping_preference", "grouping_status", "departure_id",
    "country", "home_country", "tour_items", "tour_items_json", "tour_count",
    "product_selected", "service_type", "duration_preference",
    "is_archived", "archived_at", "archive_reason", "superseded_by_inquiry_id",
    "return_sequence", "phone_number", "interest_category", "requested_date",
    "invoice_no", "date_paid", "payment_method", "tour_completed", "notes",
    "tour_content", "itinerary_json", "itinerary_updated_at",
    "itinerary_version", "itinerary_status",
    "contact_intent_id", "website_visitor_id", "website_session_id",
    "attribution_status", "attribution_quality",
    "first_touch_source", "first_touch_medium", "first_touch_campaign",
    "first_touch_content", "first_touch_term", "first_touch_landing_page",
    "first_touch_referrer", "first_touch_date",
    "last_touch_source", "last_touch_medium", "last_touch_campaign",
    "last_touch_content", "last_touch_term", "last_touch_landing_page",
    "last_touch_referrer", "last_touch_date",
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "gclid", "gbraid", "wbraid", "fbclid",
    "meta_campaign_id", "meta_adset_id", "meta_ad_id"
  ],
  crm_followups: [
    "followup_id", "inquiry_id", "guest_id", "created_at", "due_at", "completed_at",
    "status", "followup_type", "assigned_to", "email_template", "calendar_event_id",
    "subject", "notes", "last_error", "channel", "send_status", "send_after",
    "template_key"
  ],
  crm_email_log: [
    "email_log_id", "created_at", "message_date", "direction", "inquiry_id",
    "guest_id", "email", "email_normalized", "gmail_thread_id",
    "gmail_message_id", "subject", "snippet", "template_key", "status",
    "matched_by", "notes"
  ],
  crm_emails: [
    "template_key", "email_type", "enabled", "trigger_status",
    "trigger_quote_status", "trigger_payment_status", "timing_rule",
    "recommended_followup_days", "email_subject", "email_body_auto",
    "email_body_text"
  ],
  crm_bookings: [
    "booking_id", "inquiry_id", "guest_id", "created_at", "updated_at",
    "booking_status", "tour_date_start", "tour_date_end", "tour_date_text",
    "party_size", "service_type", "product_selected", "tour_guide",
    "pickup_location", "total_booking_price", "quoted_currency", "deposit_required",
    "balance_due_date", "calendar_event_id", "operations_notes", "source_system",
    "source_key", "invoice_no", "tour_key", "completed_at", "is_archived",
    "archived_at", "archive_reason"
  ],
  crm_payments: [
    "payment_id", "booking_id", "inquiry_id", "guest_id", "created_at",
    "payment_status", "payment_date", "payment_method", "paid_to", "invoice_no", "invoice_id",
    "transaction_id", "payment_reference_note", "total_booking_price",
    "deposit_amount_paid", "additional_amount_paid", "total_amount_paid",
    "balance_remaining", "is_fully_paid", "notes"
  ],
  crm_activity_log: [
    "activity_id", "created_at", "guest_id", "inquiry_id", "booking_id", "actor",
    "activity_type", "old_value", "new_value", "notes"
  ],
  crm_settings: [
    "setting_key", "setting_value", "notes"
  ]
};

const CRM_FIELD_VALUES = {
  crm_guests: {
    status: { values: ["active", "inactive", "duplicate", "archived"], fallback: "active" }
  },
  crm_inquiries: {
    status: { values: ["new", "contacted", "planning", "qualified", "quoted", "follow_up", "deposit_pending", "deposit_paid", "payment_pending", "booked", "completed", "cancelled", "did_not_book"], fallback: "new" },
    availability_status: { values: ["pending", "available", "unavailable", "needs_check"], fallback: "pending" },
    quote_status: { values: ["not_sent", "sent", "revised", "accepted", "declined"], fallback: "not_sent" },
    payment_status: { values: ["unpaid", "deposit_pending", "deposit_paid", "partial", "paid", "refunded"], fallback: "unpaid" },
    transportation_needed: { values: ["Yes", "No", "Unknown"], fallback: "Unknown" },
    quoted_currency: { values: ["USD"], fallback: "USD" },
    grouping_preference: { values: ["unknown", "open_to_group", "private_only"], fallback: "unknown" },
    grouping_status: { values: ["unmatched", "candidate", "invited", "accepted", "confirmed", "declined"], fallback: "unmatched" }
  },
  crm_followups: {
    status: { values: ["open", "completed", "cancelled", "failed"], fallback: "open" },
    channel: { values: ["manual", "email", "telegram", "calendar"], fallback: "manual" },
    send_status: { values: ["pending", "sent", "skipped", "failed"], fallback: "pending" }
  },
  crm_bookings: {
    booking_status: { values: ["tentative", "deposit_pending", "deposit_paid", "booked", "completed", "cancelled"], fallback: "booked" }
  },
  crm_payments: {
    payment_status: { values: ["unpaid", "deposit_pending", "deposit_paid", "partial", "paid", "refunded"], fallback: "unpaid" }
  }
};

function setupCrm() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);
  resetCrmDataValidations_();
  createPipelineReviewView();
}

/**
 * One-time setup for the three durable Meta Ads identifiers.
 * Safe to run repeatedly: existing columns and data are preserved.
 */
function addMetaAttributionColumns() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheetWithHeaders_(ss, CRM_TABS.inquiries, CRM_HEADERS.crm_inquiries);
  Logger.log("Meta attribution columns verified: meta_campaign_id, meta_adset_id, meta_ad_id");
}

function setupCrmSchema_(ss) {
  Object.keys(CRM_HEADERS).forEach(function(tabName) {
    ensureSheetWithHeaders_(ss, tabName, CRM_HEADERS[tabName]);
  });
  seedSettings_();
}

function setupCrmVisualFormatting() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);
  resetCrmDataValidations_();
  setupCrmInquiryPipelineFormatting_();
  createPipelineReviewView();
}

function applyCancelledAndPlanningUpgrade() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);
  resetCrmDataValidations_();
  setupCrmInquiryPipelineFormatting_();
  normalizeCrmDateFieldsAndActions();
  syncCrmFollowupQueue();
  detectScheduleConflictsToFollowups();
  createCrmViewTabs();
  createPipelineReviewView();
  formatCrmDateColumns_();
  sortCrmInquiriesByCreatedAtDesc();
  Logger.log("CRM lifecycle upgrade complete: planning and cancelled are ready.");
}


function clearCrmImportedDataKeepHeaders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  [
    CRM_TABS.guests,
    CRM_TABS.inquiries,
    CRM_TABS.followups,
    CRM_TABS.bookings,
    CRM_TABS.payments,
    CRM_TABS.activity
  ].forEach(function(tabName) {
    const sh = ss.getSheetByName(tabName);
    if (!sh) return;
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow > 1 && lastCol > 0) {
      sh.getRange(2, 1, lastRow - 1, lastCol).clearContent();
    }
  });
  setupCrm();
}

function routeAllNewRawRows() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const startedAt = Date.now();
  const maxMillis = 90000; // Fast sync: leave time for Google Sheets writes to finish safely.
  const stats = { imported: 0, skipped: 0, stopped: false };
  const alreadyRouted = getRoutedSourceKeys_(ss);
  const whatsappGuestLookup = buildWhatsappGuestLookup_(ss);

  routeRawSheetRows_(ss, "contacts", alreadyRouted, mapContactRow_, startedAt, maxMillis, stats);
  routeRawSheetRows_(ss, "book_tour", alreadyRouted, mapBookTourRow_, startedAt, maxMillis, stats);
  routeRawSheetRows_(ss, "whatsapp_inquiries", alreadyRouted, function(row, rowNumber) {
    return mapWhatsappInquiryRow_(row, rowNumber, whatsappGuestLookup);
  }, startedAt, maxMillis, stats);
  routeRawSheetRows_(ss, "pending_guests", alreadyRouted, mapPendingGuestRow_, startedAt, maxMillis, stats);

  // Recurring routing is intentionally append/update-only. Destructive cleanup,
  // deduplication, invoice migration, and legacy repair functions must be run
  // manually after reviewing a current backup; they never belong in this trigger.

  // Keep the master sheet newest-first even when no new row was appended.
  // This also repairs ordering after an earlier sync ended before sorting.
  sortCrmInquiriesByCreatedAtDesc();
  refreshPipelineReview();

  Logger.log("CRM fast sync complete/pass ended. Imported: " + stats.imported + ", skipped: " + stats.skipped + ", stoppedEarly: " + stats.stopped);
}

/**
 * Run once after installing v11.
 *
 * Repairs WhatsApp CRM rows that were tracked only by a mutable sheet row
 * number, records the permanent raw inquiry_id, then imports any missing
 * WhatsApp inquiries.
 */
function repairWhatsappSourceTrackingAndImport() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);

  const rawSheet = ss.getSheetByName("whatsapp_inquiries");
  const inquirySheet = ss.getSheetByName(CRM_TABS.inquiries);
  if (!rawSheet || !inquirySheet) {
    throw new Error("Missing whatsapp_inquiries or crm_inquiries sheet.");
  }

  const whatsappGuestLookup = buildWhatsappGuestLookup_(ss);
  const rawEntries = getObjectsWithRowNumbers_(rawSheet).map(function(item) {
    return {
      rowNumber: item.rowNumber,
      raw: item.row,
      mapped: mapWhatsappInquiryRow_(item.row, item.rowNumber, whatsappGuestLookup)
    };
  }).filter(function(item) {
    return item.mapped && clean_(item.mapped.sourceRecordId);
  });

  let repaired = 0;
  getObjectsWithRowNumbers_(inquirySheet).forEach(function(item) {
    const row = item.row;
    if (splitMergedField_(row.source_tab).indexOf("whatsapp_inquiries") < 0) return;

    const rowEmail = clean_(row.email_normalized || row.email).toLowerCase();
    const rowPhone = clean_(row.phone_normalized) || normalizePhone_(row.phone_raw);
    const matches = rawEntries.filter(function(entry) {
      const mappedEmail = clean_(entry.mapped.emailNormalized || entry.mapped.email).toLowerCase();
      const mappedPhone = clean_(entry.mapped.phoneNormalized) || normalizePhone_(entry.mapped.phoneRaw);
      return (rowEmail && mappedEmail && rowEmail === mappedEmail) ||
        (rowPhone && mappedPhone && rowPhone === mappedPhone);
    });

    if (matches.length !== 1) return;
    const match = matches[0];
    const updated = Object.assign({}, row, {
      source_record_id: match.mapped.sourceRecordId
    });

    if (splitMergedField_(row.source_tab).length === 1) {
      updated.source_row = String(match.rowNumber);
    }
    writeObjectToRow_(inquirySheet, item.rowNumber, updated);
    repaired++;
  });

  Logger.log("WhatsApp source tracking repaired for " + repaired + " CRM row(s).");
  routeAllNewRawRows();
}

function runCrmMaintenance() {
  // Scheduled maintenance is read/format oriented only. Legacy consolidation,
  // archive repair, and deduplication require an explicit reviewed backup.
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);
  resetCrmDataValidations_();
  formatCrmDateColumns_();
  sortCrmInquiriesByCreatedAtDesc();
  refreshPipelineReview();
  Logger.log("Safe CRM maintenance complete.");
}

function runCrmMaintenancePhase1() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);
  repairLegacyDuplicateArchives();
  consolidateCompletedTripInquiries();
  resetCrmDataValidations_();
  normalizeCrmDateFieldsAndActions();
  Logger.log("CRM maintenance phase 1 complete. Next run runCrmMaintenancePhase2().");
}

function runCrmMaintenancePhase2() {
  syncCrmFollowupQueue();
  detectScheduleConflictsToFollowups();
  createCrmViewTabs();
  formatCrmDateColumns_();
  sortCrmInquiriesByCreatedAtDesc();
  Logger.log("CRM maintenance phase 2 complete. Next run runCrmMaintenancePhase3().");
}

function runCrmMaintenancePhase3() {
  refreshGuestLifecycleStats();
  Logger.log("CRM maintenance phase 3 complete.");
}


/**
 * Converts completed invoice shells into one trip inquiry with many booking services.
 * Safe to run repeatedly: archived rows stay archived and booking/payment links are idempotently relinked.
 */
function consolidateCompletedTripInquiries() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);
  const inquirySheet = ss.getSheetByName(CRM_TABS.inquiries);
  const bookingSheet = ss.getSheetByName(CRM_TABS.bookings);
  const paymentSheet = ss.getSheetByName(CRM_TABS.payments);
  const activitySheet = ss.getSheetByName(CRM_TABS.activity);
  const inquiries = getObjectsWithRowNumbers_(inquirySheet);
  const bookings = getObjectsWithRowNumbers_(bookingSheet);
  const payments = getObjectsWithRowNumbers_(paymentSheet);
  const groups = {};

  inquiries.forEach(function(item) {
    const row = item.row;
    const status = clean_(row.status).toLowerCase().replace(/[ -]+/g, "_");
    const archived = ["yes", "true", "1"].indexOf(clean_(row.is_archived).toLowerCase()) >= 0;
    if (archived || status !== "completed" || !clean_(row.guest_id)) return;
    const start = normalizeDateForSheet_(row.requested_date_start || row.requested_date || row.completed_date);
    const end = normalizeDateForSheet_(row.requested_date_end || start);
    if (!start) return;
    const key = clean_(row.guest_id) + "||" + start + "||" + (end || start);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const inquiryUpdates = [];
  const bookingUpdates = [];
  const paymentUpdates = [];
  let tripsMerged = 0;
  let rowsArchived = 0;

  Object.keys(groups).forEach(function(key) {
    const group = groups[key];
    if (!group.length) return;
    group.sort(function(a, b) {
      const aAccounting = /accounting|invoice/i.test(clean_(a.row.source_type) + " " + clean_(a.row.source_record_id)) ? 1 : 0;
      const bAccounting = /accounting|invoice/i.test(clean_(b.row.source_type) + " " + clean_(b.row.source_record_id)) ? 1 : 0;
      if (aAccounting !== bAccounting) return aAccounting - bAccounting;
      return String(a.row.created_at || "").localeCompare(String(b.row.created_at || ""));
    });
    const canonicalItem = group[0];
    const canonicalId = clean_(canonicalItem.row.inquiry_id);
    const memberIds = {};
    group.forEach(function(item) { memberIds[clean_(item.row.inquiry_id)] = true; });
    const relatedBookings = bookings.filter(function(item) { return memberIds[clean_(item.row.inquiry_id)]; });
    const itinerary = relatedBookings.map(function(item) {
      const row = item.row;
      return {
        id: clean_(row.booking_id) || makeId_("TI"),
        tour: clean_(row.product_selected || row.service_type || "Tour"),
        date: normalizeDateForSheet_(row.tour_date_start || row.tour_date_text),
        tour_date: normalizeDateForSheet_(row.tour_date_start || row.tour_date_text),
        guests: clean_(row.party_size || canonicalItem.row.guest_count),
        product_selected: clean_(row.product_selected),
        duration: clean_(row.duration_preference),
        status: clean_(row.booking_status || "completed"),
        pickup_location: clean_(row.pickup_location),
        price: clean_(row.total_booking_price),
        notes: clean_(row.operations_notes)
      };
    });
    const unique = [];
    const seen = {};
    itinerary.forEach(function(item) {
      const itemKey = [item.date, item.product_selected || item.tour, item.pickup_location].join("|").toLowerCase();
      if (!seen[itemKey]) { seen[itemKey] = true; unique.push(item); }
    });

    let canonical = Object.assign({}, canonicalItem.row);
    group.slice(1).forEach(function(item) {
      canonical.source_record_id = mergeDistinctText_(canonical.source_record_id, item.row.source_record_id);
      canonical.source_tab = mergeDistinctText_(canonical.source_tab, item.row.source_tab);
      canonical.invoice_no = mergeDistinctText_(canonical.invoice_no, item.row.invoice_no);
      canonical.internal_notes = mergeDistinctText_(canonical.internal_notes, item.row.internal_notes);
    });
    if (unique.length) {
      canonical.tour_items = JSON.stringify(unique);
      canonical.tour_items_json = canonical.tour_items;
      canonical.tour_count = String(unique.length);
      canonical.tour_content = String(unique.length);
      canonical.tour_type = unique.map(function(item) { return clean_(item.tour); }).filter(Boolean).join(" + ");
    }
    canonical.updated_at = nowIso_();
    inquiryUpdates.push({ rowNumber: canonicalItem.rowNumber, row: canonical });

    relatedBookings.forEach(function(item) {
      if (clean_(item.row.inquiry_id) === canonicalId) return;
      bookingUpdates.push({ rowNumber: item.rowNumber, row: Object.assign({}, item.row, { inquiry_id: canonicalId, updated_at: nowIso_() }) });
    });
    payments.forEach(function(item) {
      if (!memberIds[clean_(item.row.inquiry_id)] || clean_(item.row.inquiry_id) === canonicalId) return;
      paymentUpdates.push({ rowNumber: item.rowNumber, row: Object.assign({}, item.row, { inquiry_id: canonicalId }) });
    });

    group.slice(1).forEach(function(item) {
      const archived = Object.assign({}, item.row, {
        status: "duplicate", is_archived: "Yes", archived_at: nowIso_(),
        archive_reason: "merged_completed_trip", superseded_by_inquiry_id: canonicalId,
        internal_notes: mergeDistinctText_(item.row.internal_notes, "Merged into completed trip " + canonicalId + ".")
      });
      inquiryUpdates.push({ rowNumber: item.rowNumber, row: archived });
      rowsArchived++;
    });
    if (group.length > 1) tripsMerged++;
    if (group.length > 1) appendObject_(activitySheet, {
      activity_id: makeId_("ACT"), created_at: nowIso_(), guest_id: canonical.guest_id,
      inquiry_id: canonicalId, booking_id: "", actor: "maintenance",
      activity_type: "completed_trip_consolidated", old_value: String(group.length),
      new_value: canonicalId, notes: "Combined completed inquiry shells; preserved individual booking services."
    });
  });

  writeObjectsToRowsBatch_(inquirySheet, inquiryUpdates);
  writeObjectsToRowsBatch_(bookingSheet, bookingUpdates);
  writeObjectsToRowsBatch_(paymentSheet, paymentUpdates);
  Logger.log(JSON.stringify({ tripsMerged: tripsMerged, inquiryShellsArchived: rowsArchived, bookingsRelinked: bookingUpdates.length, paymentsRelinked: paymentUpdates.length }));
  return { tripsMerged: tripsMerged, inquiryShellsArchived: rowsArchived, bookingsRelinked: bookingUpdates.length, paymentsRelinked: paymentUpdates.length };
}

function repairLegacyDuplicateArchives() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) return;
  const items = getObjectsWithRowNumbers_(sh);
  const groups = {};

  items.forEach(function(item) {
    const notes = clean_(item.row.internal_notes);
    if (!/marked duplicate/i.test(notes)) return;
    const sourceMatch = notes.match(/Imported from raw\s+([A-Za-z0-9_ -]+?)\s+row\s+(\d+)/i);
    if (!sourceMatch) return;
    const sourceKey = clean_(sourceMatch[1]).toLowerCase().replace(/\s+/g, "_") + ":" + sourceMatch[2];
    const identity = clean_(item.row.guest_id) ||
      clean_(item.row.email_normalized || item.row.email).toLowerCase() ||
      normalizePhone_(item.row.phone_normalized || item.row.phone_raw);
    if (!identity) return;
    const key = identity + "||" + sourceKey;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const statusRank = {
    completed: 100, booked: 90, deposit_paid: 80, deposit_pending: 70,
    quoted: 60, qualified: 50, planning: 40, contacted: 30,
    follow_up: 20, new: 10, duplicate: 0
  };
  const updates = [];
  let archived = 0;
  let retained = 0;

  Object.keys(groups).forEach(function(key) {
    const group = groups[key];
    if (group.length < 2) return;
    group.sort(function(a, b) {
      function score(item) {
        const row = item.row;
        let value = statusRank[clean_(row.status)] || 0;
        if (clean_(row.quote_status) === "sent") value += 8;
        if (clean_(row.quote_status) === "accepted") value += 12;
        if (clean_(row.payment_status) !== "unpaid" && clean_(row.payment_status)) value += 15;
        if (normalizeDateForSheet_(row.requested_date_start)) value += 6;
        if (clean_(row.email_normalized || row.email)) value += 3;
        if (clean_(row.product_selected)) value += 2;
        return value;
      }
      const scoreDiff = score(b) - score(a);
      if (scoreDiff) return scoreDiff;
      return String(a.row.created_at || "").localeCompare(String(b.row.created_at || ""));
    });

    const canonical = group[0];
    const canonicalRow = Object.assign({}, canonical.row, {
      is_archived: "No",
      archived_at: "",
      archive_reason: "",
      superseded_by_inquiry_id: ""
    });
    if (clean_(canonicalRow.status) === "duplicate") {
      canonicalRow.status = clean_(canonicalRow.previous_status) || "planning";
    }
    if (clean_(canonicalRow.status) === "new" && clean_(canonicalRow.quote_status) === "sent") {
      canonicalRow.status = "quoted";
      canonicalRow.stage_changed_at = nowIso_();
      canonicalRow.next_action = "Follow up on quote if no reply";
    }
    if (clean_(canonicalRow.quote_status) === "accepted" && clean_(canonicalRow.payment_status) === "unpaid") {
      canonicalRow.status = "deposit_pending";
      canonicalRow.stage_changed_at = nowIso_();
      canonicalRow.next_action = "Send deposit/payment instructions";
    }
    updates.push({ rowNumber: canonical.rowNumber, row: canonicalRow });
    retained++;

    group.slice(1).forEach(function(item) {
      const duplicateRow = Object.assign({}, item.row, {
        previous_status: clean_(item.row.previous_status) || clean_(item.row.status),
        status: "duplicate",
        is_archived: "Yes",
        archived_at: clean_(item.row.archived_at) || nowIso_(),
        archive_reason: "legacy_duplicate",
        superseded_by_inquiry_id: canonical.row.inquiry_id,
        priority: "",
        availability_status: "unavailable",
        grouping_status: "unmatched",
        next_action: "No action - duplicate",
        followup_date: ""
      });
      updates.push({ rowNumber: item.rowNumber, row: duplicateRow });
      archived++;
    });
  });

  writeObjectsToRowsBatch_(sh, updates);
  Logger.log("Legacy duplicate repair retained " + retained + " canonical records and archived " + archived + " duplicate rows.");
}

function refreshGuestLifecycleStats() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);
  const guests = ss.getSheetByName(CRM_TABS.guests);
  const inquiries = getObjects_(ss.getSheetByName(CRM_TABS.inquiries));
  const bookings = getObjects_(ss.getSheetByName(CRM_TABS.bookings));
  const payments = getObjects_(ss.getSheetByName(CRM_TABS.payments));
  const guestRows = getObjectsWithRowNumbers_(guests);
  const guestUpdates = [];
  guestRows.forEach(function(item) {
    const guestId = clean_(item.row.guest_id);
    if (!guestId) return;
    const guestInquiries = inquiries.filter(function(row) { return clean_(row.guest_id) === guestId && clean_(row.is_archived).toLowerCase() !== 'yes'; });
    const guestBookings = bookings.filter(function(row) { return clean_(row.guest_id) === guestId && clean_(row.is_archived).toLowerCase() !== 'yes'; });
    const completedBookings = guestBookings.filter(function(row) { return clean_(row.booking_status) === 'completed'; });
    const completedDates = completedBookings.map(function(row) { return normalizeDateForSheet_(row.completed_at || row.tour_date_end || row.tour_date_start); }).filter(Boolean).sort();
    const totalValue = payments.filter(function(row) { return clean_(row.guest_id) === guestId; }).reduce(function(sum, row) { return sum + Number(row.total_amount_paid || 0); }, 0);
    const updated = Object.assign({}, item.row, {
      updated_at: nowIso_(),
      total_inquiries: String(guestInquiries.length),
      total_confirmed_bookings: String(guestBookings.filter(function(row) { return ['booked','completed'].indexOf(clean_(row.booking_status)) >= 0; }).length),
      total_completed_tours: String(completedBookings.length),
      last_completed_tour_date: completedDates.length ? completedDates[completedDates.length - 1] : '',
      lifetime_value: totalValue ? String(totalValue.toFixed(2)) : ''
    });
    guestUpdates.push({ rowNumber: item.rowNumber, row: updated });
  });
  writeObjectsToRowsBatch_(guests, guestUpdates);
  Logger.log('Guest lifecycle stats refreshed for ' + guestRows.length + ' guest profiles.');
}

function repairAndRebuildCrmFollowups() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const result = reconcileCrmFollowupQueue_(ss);
  detectScheduleConflictsToFollowups();
  sortCrmInquiriesByCreatedAtDesc();
  Logger.log(
    "CRM follow-up repair complete. Open tasks: " + result.openTasks +
    ", retained completed/sent tasks: " + result.closedTasks +
    ", removed stale/orphaned/duplicate tasks: " + result.removedTasks
  );
}

function timeRemaining_(startedAt, maxMillis, reserveMillis) {
  return Date.now() - startedAt < maxMillis - reserveMillis;
}

function repairCrmAfterRouterSetback() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const cleanupStats = cleanupCrmInquiryArtifacts_(ss);
  dedupeCrmInquiriesByInquiryId_(ss);
  dedupeCrmInquiriesByNaturalKey_(ss);
  mergePhoneFallbackInquiryDuplicates_(ss);
  prepareCrmForAutomation();
  Logger.log("CRM repair complete. Removed blank rows: " + cleanupStats.blankRows + ", removed blank invoice artifacts: " + cleanupStats.blankInvoiceArtifacts);
}

function sortCrmInquiriesByCreatedAtDesc() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh || sh.getLastRow() < 3) return;

  const createdAtCol = getColumnIndexByHeader_(sh, "created_at");
  if (!createdAtCol) return;

  sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn())
    .sort({ column: createdAtCol, ascending: false });
}

function handleCrmInquiryEdit(e) {
  if (!e || !e.range) return;

  const sh = e.range.getSheet();
  if (!sh) return;
  if (sh.getName() === CRM_PIPELINE_REVIEW_TAB) {
    syncPipelineReviewEdit_(e);
    return;
  }
  if (sh.getName() !== CRM_TABS.inquiries) return;
  if (e.range.getRow() <= 1) return;
  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;

  const editedCol = e.range.getColumn();
  const statusCol = getColumnIndexByHeader_(sh, "status");
  const stageChangedCol = getColumnIndexByHeader_(sh, "stage_changed_at");
  const lastContactedCol = getColumnIndexByHeader_(sh, "last_contacted_at");
  const followupCol = getColumnIndexByHeader_(sh, "followup_date");
  const nextActionCol = getColumnIndexByHeader_(sh, "next_action");
  const priorityCol = getColumnIndexByHeader_(sh, "priority");
  const quoteStatusCol = getColumnIndexByHeader_(sh, "quote_status");
  const paymentStatusCol = getColumnIndexByHeader_(sh, "payment_status");
  const requestedStartCol = getColumnIndexByHeader_(sh, "requested_date_start");
  const requestedEndCol = getColumnIndexByHeader_(sh, "requested_date_end");

  if (editedCol === requestedStartCol || editedCol === requestedEndCol) {
    if (clean_(e.range.getValue())) {
      e.range.setValue(normalizeDateForSheet_(e.range.getValue()));
      e.range.setNote(MANUAL_REQUESTED_DATE_OVERRIDE_NOTE);
    } else {
      e.range.clearNote();
    }
    recalcCrmInquiryRowFromEdit_(sh, e.range.getRow(), true);
    formatCrmDateColumns_();
    refreshPipelineReview();
    return;
  }

  if (editedCol === followupCol) {
    if (clean_(e.range.getValue())) {
      e.range.setNote(MANUAL_FOLLOWUP_OVERRIDE_NOTE);
    } else {
      e.range.clearNote();
      recalcCrmInquiryRowFromEdit_(sh, e.range.getRow(), false);
    }
    formatCrmDateColumns_();
    refreshPipelineReview();
    return;
  }

  const watchedCols = [
    statusCol,
    lastContactedCol,
    quoteStatusCol,
    paymentStatusCol,
    requestedStartCol,
    requestedEndCol
  ].filter(Boolean);
  if (watchedCols.indexOf(editedCol) < 0) return;

  if (editedCol === statusCol) {
    if (clean_(e.range.getValue())) {
      e.range.setNote(MANUAL_STATUS_OVERRIDE_NOTE);
    } else {
      e.range.clearNote();
    }
    if (stageChangedCol) sh.getRange(e.range.getRow(), stageChangedCol).setValue(nowIso_());
    syncBookingStatusFromInquiry_(sh, e.range.getRow());
  }

  if (editedCol === lastContactedCol && clean_(e.range.getValue())) {
    e.range.setValue(normalizeDateTimeForSheet_(e.range.getValue()));
    e.range.setNote(MANUAL_LAST_CONTACTED_OVERRIDE_NOTE);
  } else if (editedCol === lastContactedCol) {
    e.range.clearNote();
  }

  recalcCrmInquiryRowFromEdit_(sh, e.range.getRow(), true);
  formatCrmDateColumns_();
  refreshPipelineReview();
}

function syncBookingStatusFromInquiry_(inquiriesSheet, inquiryRowNumber) {
  const inquiry = getObjectAtRow_(inquiriesSheet, inquiryRowNumber);
  const inquiryId = clean_(inquiry.inquiry_id);
  const status = clean_(inquiry.status);
  if (!inquiryId || ["booked", "completed", "cancelled"].indexOf(status) < 0) return;

  const ss = inquiriesSheet.getParent();
  const bookings = ss.getSheetByName(CRM_TABS.bookings);
  if (!bookings) return;

  getObjectsWithRowNumbers_(bookings).forEach(function(item) {
    if (clean_(item.row.inquiry_id) !== inquiryId) return;
    const updated = Object.assign({}, item.row, {
      updated_at: nowIso_(),
      booking_status: status
    });
    writeObjectToRow_(bookings, item.rowNumber, updated);
  });
}

function recalcCrmInquiryRowFromEdit_(sh, rowNumber, preserveManualFollowup) {
  const row = getObjectAtRow_(sh, rowNumber);
  const dateRange = bestInquiryDateRange_(row, sh, rowNumber);
  const statusManual = isManualStatusOverride_(sh, rowNumber);
  const aligned = statusManual ? row : alignInquiryStatusFromSubstatuses_(row, dateRange);
  const action = nextActionForInquiry_(aligned, dateRange);
  const followupManual = preserveManualFollowup && isManualFollowupOverride_(sh, rowNumber);
  const followupDate = followupManual ? normalizeDateForSheet_(row.followup_date) : action.followupDate;

  const updated = Object.assign({}, aligned, {
    updated_at: nowIso_(),
    status: normalizeValidatedField_(CRM_TABS.inquiries, "status", aligned.status),
    requested_date_start: dateRange.start,
    requested_date_end: dateRange.end,
    transportation_needed: normalizeValidatedField_(CRM_TABS.inquiries, "transportation_needed", aligned.transportation_needed || row.transportation_needed || "Unknown"),
    followup_date: followupDate,
    next_action: action.action,
    priority: inferPriority_(dateRange.start),
    quoted_currency: "USD"
  });

  writeObjectToRow_(sh, rowNumber, updated);
  const followupCol = getColumnIndexByHeader_(sh, "followup_date");
  if (followupCol && followupManual) {
    sh.getRange(rowNumber, followupCol).setNote(MANUAL_FOLLOWUP_OVERRIDE_NOTE);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  upsertFollowupForInquiry_(ss, updated, action);
}

function installCrmTriggers() {
  removeCrmTriggers_();

  ScriptApp.newTrigger("routeAllNewRawRows")
    .timeBased()
    .everyMinutes(5)
    .create();

  ScriptApp.newTrigger("runCrmMaintenance")
    .timeBased()
    .everyDays(1)
    .atHour(4)
    .create();

  ScriptApp.newTrigger("sendDailyFollowupDigest")
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .create();

  ScriptApp.newTrigger("handleCrmInquiryEdit")
    .forSpreadsheet(SPREADSHEET_ID)
    .onEdit()
    .create();
}

function removeCrmTriggers_() {
  const managedHandlers = {
    routeAllNewRawRows: true,
    sendDailyFollowupDigest: true,
    runCrmMaintenance: true,
    handleCrmInquiryEdit: true
  };
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (managedHandlers[trigger.getHandlerFunction()]) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function getRoutedSourceKeys_(ss) {
  const rows = getObjects_(ss.getSheetByName(CRM_TABS.inquiries));
  const keys = {};
  rows.forEach(function(row) {
    addRoutedSourceKeysForRow_(keys, row);
  });
  return keys;
}

function addRoutedSourceKeysForRow_(keys, row) {
  const tabs = splitMergedField_(row.source_tab);
  const sourceRows = splitMergedField_(row.source_row);
  const sourceRecordIds = splitMergedField_(row.source_record_id);

  tabs.forEach(function(tab) {
    const canonicalTab = canonicalSourceTab_(tab);
    sourceRecordIds.forEach(function(sourceRecordId) {
      if (canonicalTab && sourceRecordId) keys["record:" + canonicalTab + ":" + sourceRecordId] = true;
    });
  });

  if (!tabs.length || !sourceRows.length) return;

  if (tabs.length === sourceRows.length) {
    tabs.forEach(function(tab, idx) {
      const canonicalTab = canonicalSourceTab_(tab);
      if (canonicalTab && sourceRows[idx]) keys["row:" + canonicalTab + ":" + sourceRows[idx]] = true;
    });
    return;
  }

  tabs.forEach(function(tab) {
    const canonicalTab = canonicalSourceTab_(tab);
    sourceRows.forEach(function(sourceRow) {
      if (canonicalTab && sourceRow) keys["row:" + canonicalTab + ":" + sourceRow] = true;
    });
  });
}

function splitMergedField_(value) {
  return clean_(value).split("|").map(function(part) {
    return clean_(part);
  }).filter(Boolean);
}

function canonicalSourceTab_(value) {
  const tab = clean_(value).toLowerCase();
  const aliases = {
    site_book_tour: "book_tour",
    book_tour: "book_tour",
    site_contact: "contacts",
    contact: "contacts",
    contacts: "contacts"
  };
  return aliases[tab] || tab;
}

function routeRawSheetRows_(ss, sourceTab, alreadyRouted, mapper, startedAt, maxMillis, stats) {
  if (stats.stopped) return;
  const sh = ss.getSheetByName(sourceTab);
  if (!sh) return;
  const objects = getObjectsWithRowNumbers_(sh);
  objects.some(function(item) {
    if (Date.now() - startedAt > maxMillis) {
      stats.stopped = true;
      return true;
    }
    const mapped = mapper(item.row, item.rowNumber);
    if (!mapped) {
      stats.skipped++;
      return false;
    }
    const sourceRecordId = clean_(mapped.sourceRecordId);
    const canonicalTab = canonicalSourceTab_(sourceTab);
    const recordKey = sourceRecordId ? "record:" + canonicalTab + ":" + sourceRecordId : "";
    const rowKey = "row:" + canonicalTab + ":" + item.rowNumber;
    if ((recordKey && alreadyRouted[recordKey]) || (!recordKey && alreadyRouted[rowKey])) {
      stats.skipped++;
      return false;
    }
    routeSubmissionToCrm_(mapped, ss);
    if (recordKey) alreadyRouted[recordKey] = true;
    alreadyRouted[rowKey] = true;
    stats.imported++;
    return false;
  });
}

function mapAttributionFields_(row) {
  row = row || {};
  return {
    contactIntentId: row.contact_intent_id,
    websiteVisitorId: row.website_visitor_id,
    websiteSessionId: row.website_session_id,
    attributionStatus: row.attribution_status,
    attributionQuality: row.attribution_quality,
    firstTouchSource: row.first_touch_source,
    firstTouchMedium: row.first_touch_medium,
    firstTouchCampaign: row.first_touch_campaign,
    firstTouchContent: row.first_touch_content,
    firstTouchTerm: row.first_touch_term,
    firstTouchLandingPage: row.first_touch_landing_page,
    firstTouchReferrer: row.first_touch_referrer,
    firstTouchDate: row.first_touch_date,
    lastTouchSource: row.last_touch_source,
    lastTouchMedium: row.last_touch_medium,
    lastTouchCampaign: row.last_touch_campaign,
    lastTouchContent: row.last_touch_content,
    lastTouchTerm: row.last_touch_term,
    lastTouchLandingPage: row.last_touch_landing_page,
    lastTouchReferrer: row.last_touch_referrer,
    lastTouchDate: row.last_touch_date,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    utmContent: row.utm_content,
    utmTerm: row.utm_term,
    gclid: row.gclid,
    gbraid: row.gbraid,
    wbraid: row.wbraid,
    fbclid: row.fbclid,
    metaCampaignId: row.meta_campaign_id,
    metaAdsetId: row.meta_adset_id,
    metaAdId: row.meta_ad_id,
    sourceRecordId: row.contact_intent_id
  };
}

function mapContactRow_(row, rowNumber) {
  return Object.assign({
    sourceType: "site_contact",
    sourceTab: "contacts",
    sourceRow: rowNumber,
    sourcePage: row.source_page,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phoneRaw: joinPhone_(row.country_code, row.phone_number),
    country: row.country || row.home_country,
    sourceContactAt: row.submitted_at,
    requestedDateText: row.dates_of_visit,
    guestCountText: row.number_of_guests,
    tourType: row.preferred_tour_type,
    tourAddOns: row.tour_add_ons,
    tourItemsJson: row.tour_items_json || row.tour_items,
    interestCategory: row.interest_category || row.tour_category || row.tour_type,
    serviceType: row.service_type,
    productSelected: row.product_selected,
    groupingPreference: row.grouping_preference,
    durationPreference: row.duration_preference,
    accommodationNeeds: row.accommodation_needs,
    pickupLocation: row.pickup_location || pickupLocationFromTourItems_(row.tour_items_json || row.tour_items),
    specialInterests: row.special_interests,
    messageQuestions: row.message_questions,
    internalNotes: "Imported from raw contacts row " + rowNumber + "."
  }, mapAttributionFields_(row));
}

function mapBookTourRow_(row, rowNumber) {
  return Object.assign({
    sourceType: "site_book_tour",
    sourceTab: "book_tour",
    sourceRow: rowNumber,
    sourcePage: row.source_page,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phoneRaw: joinPhone_(row.country_code, row.phone_number),
    country: row.country || row.home_country,
    sourceContactAt: row.submitted_at,
    requestedDateText: row.dates_of_visit,
    guestCountText: row.number_of_guests,
    tourType: row.preferred_tour_type,
    tourAddOns: row.tour_add_ons,
    tourItemsJson: row.tour_items_json || row.tour_items,
    interestCategory: row.interest_category || row.tour_category || row.tour_type,
    serviceType: row.service_type,
    productSelected: row.product_selected,
    groupingPreference: row.grouping_preference,
    durationPreference: row.duration_preference,
    accommodationNeeds: row.accommodation_needs,
    pickupLocation: row.pickup_location || pickupLocationFromTourItems_(row.tour_items_json || row.tour_items),
    specialInterests: row.special_interests,
    messageQuestions: row.message_questions,
    internalNotes: "Imported from raw book_tour row " + rowNumber + ". Existing raw status: " + clean_(row.status),
    rawStatus: row.status
  }, mapAttributionFields_(row));
}

/**
 * Repairs structured tour details for site submissions that were imported before
 * tour_add_ons, grouping preference, and tour_items_json were mapped into CRM.
 * Run once manually after deploying this version. It is safe to run again.
 */
function repairStructuredSiteRequestDetails() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const inquirySheet = ss.getSheetByName(CRM_TABS.inquiries);
  if (!inquirySheet) throw new Error("Missing crm_inquiries sheet.");
  const inquiries = getObjectsWithRowNumbers_(inquirySheet);
  const stats = { checked: 0, updated: 0, notFound: 0 };

  [
    { tab: "contacts", mapper: mapContactRow_ },
    { tab: "book_tour", mapper: mapBookTourRow_ }
  ].forEach(function(source) {
    const sourceSheet = ss.getSheetByName(source.tab);
    if (!sourceSheet) return;
    getObjectsWithRowNumbers_(sourceSheet).forEach(function(rawItem) {
      stats.checked++;
      const mapped = normalizeInput_(source.mapper(rawItem.row, rawItem.rowNumber));
      const dateRange = parseDateRange_(mapped.requestedDateText);
      const guestCount = parseGuestCount_(mapped.guestCountText);
      const details = buildStructuredSiteRequest_(mapped, dateRange, guestCount);
      const match = inquiries.find(function(item) {
        const tabs = splitMergedField_(item.row.source_tab);
        const rows = splitMergedField_(item.row.source_row);
        return tabs.indexOf(source.tab) >= 0 && rows.indexOf(String(rawItem.rowNumber)) >= 0;
      });
      if (!match) {
        stats.notFound++;
        return;
      }
      const updated = Object.assign({}, match.row, {
        updated_at: match.row.updated_at,
        tour_type: details.interestCategory,
        tour_category: details.interestCategory,
        interest_category: details.interestCategory,
        grouping_preference: details.groupingPreference,
        transportation_needed: normalizeTransportationNeeded_(details.transportationNeeded),
        pickup_location: keepBest_(mapped.pickupLocation, match.row.pickup_location),
        country: keepBest_(mapped.country, match.row.country),
        home_country: keepBest_(mapped.country, match.row.home_country),
        tour_items: details.tourItemsJson,
        tour_items_json: details.tourItemsJson,
        tour_count: String(details.tourItems.length),
        tour_content: String(details.tourItems.length),
        product_selected: details.productSelected,
        service_type: details.serviceType,
        duration_preference: details.durationPreference,
        requested_date: dateRange.start,
        internal_notes: mergeNotes_(match.row.internal_notes, "Structured site request details repaired from raw " + source.tab + " row " + rawItem.rowNumber + ".")
      });
      writeObjectToRow_(inquirySheet, match.rowNumber, updated);
      match.row = updated;
      stats.updated++;
    });
  });
  Logger.log(JSON.stringify(stats));
  return stats;
}

function mapWhatsappInquiryRow_(row, rowNumber, whatsappGuestLookup) {
  if (hasBadWorkflowArtifact_(row.guest_id) || hasBadWorkflowArtifact_(row.phone_number) || hasBadWorkflowArtifact_(row.guest_count)) {
    return null;
  }
  const guestProfile = findWhatsappGuestProfile_(row, whatsappGuestLookup || {});
  if (!isMeaningfulWhatsappInquiryRow_(row, guestProfile)) return null;
  return {
    sourceType: "whatsapp_telegram",
    sourceTab: "whatsapp_inquiries",
    sourceRow: rowNumber,
    firstName: guestProfile.first_name,
    lastName: guestProfile.last_name,
    fullName: guestProfile.full_name || row.full_name,
    email: guestProfile.email,
    phoneRaw: guestProfile.phone_number || row.phone_number,
    phoneNormalized: guestProfile.phone_normalized,
    country: guestProfile.country,
    sourceContactAt: row.created_at || guestProfile.first_contact_date || guestProfile.created_at,
    requestedDateText: row.requested_date,
    guestCountText: row.guest_count,
    tourType: row.tour_type,
    accommodationNeeds: row.accommodation_needed,
    transportationNeeded: row.transportation_needed,
    messageQuestions: row.notes,
    internalNotes: "Imported from raw whatsapp_inquiries row " + rowNumber + ".",
    sourceGuestId: row.guest_id,
    sourceRecordId: row.inquiry_id
  };
}

function mapPendingGuestRow_(row, rowNumber) {
  return {
    sourceType: "manual_pending_guest",
    sourceTab: "pending_guests",
    sourceRow: rowNumber,
    firstName: row.guest_first_name,
    lastName: row.guest_last_name,
    email: row.guest_email,
    phoneRaw: row.guest_phone,
    country: row.home_country,
    sourceContactAt: row.contact_date,
    requestedDateText: row.tour_date,
    guestCountText: row.party_size,
    tourType: row.service_type,
    pickupLocation: row.pickup_location,
    messageQuestions: row.notes,
    internalNotes: "Imported from manual pending_guests row " + rowNumber + ". Existing raw status: " + clean_(row.status),
    rawStatus: row.status
  };
}

function routeContactSubmission_(data, sourceRow) {
  return routeSubmissionToCrm_(Object.assign({
    sourceType: "site_contact",
    sourceTab: "contacts",
    sourceRow: sourceRow || "",
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phoneRaw: joinPhone_(data.country_code, data.phone_number),
    country: data.country || data.home_country,
    sourceContactAt: data.submitted_at,
    sourcePage: data.source_page,
    requestedDateText: data.dates_of_visit,
    guestCountText: data.number_of_guests,
    tourType: data.preferred_tour_type,
    tourAddOns: data.tour_add_ons,
    tourItemsJson: data.tour_items_json || data.tour_items,
    interestCategory: data.interest_category || data.tour_category || data.tour_type,
    serviceType: data.service_type,
    productSelected: data.product_selected,
    groupingPreference: data.grouping_preference,
    durationPreference: data.duration_preference,
    accommodationNeeds: data.accommodation_needs,
    pickupLocation: data.pickup_location || pickupLocationFromTourItems_(data.tour_items_json || data.tour_items),
    specialInterests: data.special_interests,
    messageQuestions: data.message_questions,
    internalNotes: "Raw contact form submission."
  }, mapAttributionFields_(data)));
}

function routeBookTourSubmission_(data, sourceRow) {
  return routeSubmissionToCrm_(Object.assign({
    sourceType: "site_book_tour",
    sourceTab: "book_tour",
    sourceRow: sourceRow || "",
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phoneRaw: joinPhone_(data.country_code, data.phone_number),
    country: data.country || data.home_country,
    sourceContactAt: data.submitted_at,
    sourcePage: data.source_page,
    requestedDateText: data.dates_of_visit,
    guestCountText: data.number_of_guests,
    tourType: data.preferred_tour_type,
    tourAddOns: data.tour_add_ons,
    tourItemsJson: data.tour_items_json || data.tour_items,
    interestCategory: data.interest_category || data.tour_category || data.tour_type,
    serviceType: data.service_type,
    productSelected: data.product_selected,
    groupingPreference: data.grouping_preference,
    durationPreference: data.duration_preference,
    accommodationNeeds: data.accommodation_needs,
    pickupLocation: data.pickup_location || pickupLocationFromTourItems_(data.tour_items_json || data.tour_items),
    specialInterests: data.special_interests,
    messageQuestions: data.message_questions,
    internalNotes: "Raw book-tour form submission."
  }, mapAttributionFields_(data)));
}

function routeWhatsappInquiry_(data, sourceRow) {
  return routeSubmissionToCrm_({
    sourceType: "whatsapp_telegram",
    sourceTab: "whatsapp_inquiries",
    sourceRow: sourceRow || "",
    firstName: data.first_name,
    lastName: data.last_name,
    fullName: data.full_name,
    email: data.email || data.guest_email,
    phoneRaw: data.phone_number,
    phoneNormalized: data.phone_normalized,
    country: data.country || data.home_country,
    sourceContactAt: data.created_at || data.first_contact_date,
    requestedDateText: data.requested_date,
    guestCountText: data.guest_count,
    tourType: data.tour_type,
    accommodationNeeds: data.accommodation_needed,
    transportationNeeded: data.transportation_needed,
    messageQuestions: data.notes,
    internalNotes: "Captured through WhatsApp/Telegram intake."
  });
}

function routeSubmissionToCrm_(input, ssOpt) {
  const ss = ssOpt || SpreadsheetApp.openById(SPREADSHEET_ID);

  const now = nowIso_();
  const normalized = normalizeInput_(input);
  const guest = upsertGuest_(ss, normalized, now);
  const inquiry = appendInquiry_(ss, guest, normalized, now);
  if (inquiry._created_new) {
    createInitialFollowup_(ss, inquiry, now);
    logActivity_(ss, guest.guest_id, inquiry.inquiry_id, "", "system", "inquiry_created", "", "new", normalized.sourceType);
  } else {
    logActivity_(ss, guest.guest_id, inquiry.inquiry_id, "", "system", "inquiry_merged", "", inquiry.status, normalized.sourceType);
  }

  syncInquiryAttributionToD1_(inquiry, guest, ss);

  return {
    guest_id: guest.guest_id,
    inquiry_id: inquiry.inquiry_id
  };
}

/**
 * Sends one CRM inquiry/guest match back to Cloudflare D1.
 *
 * The Cloudflare secret must be stored in this Apps Script project's Script
 * Properties under the name CF_SHARED_SECRET. A failed sync is logged without
 * blocking the CRM import; run syncAllCrmAttributionToD1() to retry safely.
 */
function syncInquiryAttributionToD1_(inquiry, guest, ssOpt) {
  const contactIntentId = latestContactIntentId_(inquiry && inquiry.contact_intent_id);
  const inquiryId = clean_(inquiry && inquiry.inquiry_id);
  if (!contactIntentId || !inquiryId) return { ok: true, skipped: true };

  const secret = PropertiesService.getScriptProperties().getProperty("CF_SHARED_SECRET");
  if (!secret) {
    Logger.log("D1 CRM attribution sync skipped: CF_SHARED_SECRET Script Property is missing.");
    return { ok: false, skipped: true, error: "shared_secret_missing" };
  }

  const response = UrlFetchApp.fetch(ATTRIBUTION_CRM_CONTACT_URL, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + secret
    },
    payload: JSON.stringify({
      inquiry_id: inquiryId,
      guest_id: clean_(guest && guest.guest_id) || clean_(inquiry.guest_id),
      contact_intent_id: contactIntentId,
      contact_channel: attributionChannelForInquiry_(inquiry),
      attribution_quality: clean_(inquiry.attribution_quality) || "unverified"
    }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    Logger.log("D1 CRM attribution sync failed for " + inquiryId + ": HTTP " + status + " " + body);
    return { ok: false, status: status, body: body };
  }

  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch (error) {
    Logger.log("D1 CRM attribution returned invalid JSON for " + inquiryId + ": " + error);
    return { ok: false, status: status, body: body, error: "invalid_json_response" };
  }

  if (parsed && parsed.attribution) {
    const ss = ssOpt || SpreadsheetApp.openById(SPREADSHEET_ID);
    backfillInquiryAttribution_(ss, inquiryId, parsed.attribution);
  }

  Logger.log("D1 CRM attribution synced and backfilled for " + inquiryId + ".");
  return { ok: true, status: status, body: body, attribution: parsed.attribution || null };
}

function latestContactIntentId_(value) {
  const candidates = clean_(value).split(/\s*\|\s*/).map(function(item) {
    return clean_(item);
  }).filter(function(item) {
    return /^[A-Za-z0-9_-]{12,128}$/.test(item);
  });
  return candidates.length ? candidates[candidates.length - 1] : "";
}

function backfillInquiryAttribution_(ss, inquiryId, attribution) {
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) throw new Error("Missing CRM inquiries sheet.");

  const match = getObjectsWithRowNumbers_(sh).find(function(item) {
    return clean_(item.row.inquiry_id) === clean_(inquiryId);
  });
  if (!match) throw new Error("CRM inquiry not found for attribution backfill: " + inquiryId);

  const a = attribution || {};
  const updates = {
    contact_intent_id: a.contact_intent_id,
    website_visitor_id: a.website_visitor_id,
    website_session_id: a.website_session_id,
    attribution_status: a.attribution_status,
    attribution_quality: a.attribution_quality,
    first_touch_source: a.first_touch_source,
    first_touch_medium: a.first_touch_medium,
    first_touch_campaign: a.first_touch_campaign,
    first_touch_content: a.first_touch_content,
    first_touch_term: a.first_touch_term,
    first_touch_landing_page: a.first_touch_landing_page,
    first_touch_referrer: a.first_touch_referrer,
    first_touch_date: a.first_touch_date,
    last_touch_source: a.last_touch_source,
    last_touch_medium: a.last_touch_medium,
    last_touch_campaign: a.last_touch_campaign,
    last_touch_content: a.last_touch_content,
    last_touch_term: a.last_touch_term,
    last_touch_landing_page: a.last_touch_landing_page,
    last_touch_referrer: a.last_touch_referrer,
    last_touch_date: a.last_touch_date,
    utm_source: a.utm_source,
    utm_medium: a.utm_medium,
    utm_campaign: a.utm_campaign,
    utm_content: a.utm_content,
    utm_term: a.utm_term,
    gclid: a.gclid,
    gbraid: a.gbraid,
    wbraid: a.wbraid,
    fbclid: a.fbclid,
    meta_campaign_id: a.meta_campaign_id,
    meta_adset_id: a.meta_adset_id,
    meta_ad_id: a.meta_ad_id
  };

  const merged = Object.assign({}, match.row);
  Object.keys(updates).forEach(function(key) {
    const value = clean_(updates[key]);
    if (!value) return;
    if (key === "contact_intent_id") {
      merged[key] = mergeDistinctText_(merged[key], value);
    } else {
      merged[key] = value;
    }
  });
  merged.updated_at = nowIso_();
  writeObjectToRow_(sh, match.rowNumber, merged);
  return merged;
}

/**
 * One-time repair for the two pre-upgrade inquiries that already contained
 * multiple valid contact-intent references before the D1 backfill.
 * Safe to run repeatedly.
 */
function repairMergedContactIntentReferences() {
  const repairs = {
    "INQ-20260909013136-0000": "ci_tdr46r6pqb4 | ci_uj8mjpirfnh",
    "INQ-20260826235233-1611": "ci_b1pklb6ehkg | ci_ddkgzqlz6e3"
  };
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) throw new Error("Missing CRM inquiries sheet.");

  let repaired = 0;
  getObjectsWithRowNumbers_(sh).forEach(function(item) {
    const inquiryId = clean_(item.row.inquiry_id);
    if (!repairs[inquiryId]) return;
    const updated = Object.assign({}, item.row, {
      contact_intent_id: repairs[inquiryId],
      updated_at: nowIso_()
    });
    writeObjectToRow_(sh, item.rowNumber, updated);
    repaired++;
  });
  Logger.log("Merged contact-intent references repaired: " + repaired + ".");
}

function attributionChannelForInquiry_(inquiry) {
  const sourceType = clean_(inquiry && inquiry.source_type).toLowerCase();
  const sourceTab = clean_(inquiry && inquiry.source_tab).toLowerCase();

  if (sourceType.indexOf("whatsapp") >= 0 || sourceTab.indexOf("whatsapp") >= 0) {
    return "whatsapp";
  }
  if (sourceType === "site_contact" || sourceType === "site_book_tour" ||
      sourceTab === "contacts" || sourceTab === "book_tour") {
    return "email_form";
  }
  if (sourceType.indexOf("email") >= 0 || sourceTab.indexOf("email") >= 0) {
    return "direct_email";
  }
  if (sourceType.indexOf("phone") >= 0 || sourceTab.indexOf("phone") >= 0) {
    return "phone";
  }
  return "other";
}

/**
 * Safe, idempotent retry utility for all attributed CRM inquiries.
 * Run manually after installing this version, or whenever a previous D1 sync
 * logged a temporary failure.
 */
function syncAllCrmAttributionToD1() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const inquirySheet = ss.getSheetByName(CRM_TABS.inquiries);
  const guestSheet = ss.getSheetByName(CRM_TABS.guests);
  if (!inquirySheet || !guestSheet) throw new Error("Missing CRM inquiry or guest sheet.");

  const guestsById = {};
  getObjects_(guestSheet).forEach(function(guest) {
    const guestId = clean_(guest.guest_id);
    if (guestId) guestsById[guestId] = guest;
  });

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  getObjects_(inquirySheet).forEach(function(inquiry) {
    if (!clean_(inquiry.contact_intent_id)) {
      skipped++;
      return;
    }

    try {
      const result = syncInquiryAttributionToD1_(
        inquiry,
        guestsById[clean_(inquiry.guest_id)] || { guest_id: inquiry.guest_id },
        ss
      );
      if (result && result.ok && !result.skipped) synced++;
      else if (result && result.skipped) skipped++;
      else failed++;
    } catch (error) {
      failed++;
      Logger.log("D1 CRM attribution retry failed for " + clean_(inquiry.inquiry_id) + ": " + error);
    }
  });

  Logger.log("D1 CRM attribution sync complete. Synced: " + synced + ", skipped: " + skipped + ", failed: " + failed + ".");
}

function upsertGuest_(ss, input, now) {
  const sh = ss.getSheetByName(CRM_TABS.guests);
  const rows = getObjects_(sh);
  const duplicateKey = buildDuplicateKey_(input);
  const sourceContactAt = input.sourceContactAt || now;
  let existingIndex = -1;

  rows.some(function(row, idx) {
    const sameKey = row.duplicate_key && row.duplicate_key === duplicateKey;
    const sameEmail = input.emailNormalized && row.email_normalized === input.emailNormalized;
    const samePhone = input.phoneNormalized && row.phone_normalized === input.phoneNormalized;
    if (sameKey || sameEmail || samePhone) {
      existingIndex = idx;
      return true;
    }
    return false;
  });

  if (existingIndex >= 0) {
    const row = rows[existingIndex];
    const updated = Object.assign({}, row, {
      updated_at: now,
      first_contact_at: chooseEarliestDateTime_(row.first_contact_at, sourceContactAt),
      last_contact_at: chooseLatestDateTime_(row.last_contact_at, sourceContactAt),
      first_name: keepBest_(row.first_name, input.firstName),
      last_name: keepBest_(row.last_name, input.lastName),
      full_name: keepBest_(row.full_name, input.fullName),
      email: keepBest_(row.email, input.email),
      email_normalized: keepBest_(row.email_normalized, input.emailNormalized),
      phone_raw: keepBest_(row.phone_raw, input.phoneRaw),
      phone_normalized: keepBest_(row.phone_normalized, input.phoneNormalized),
      country: keepBest_(row.country, input.country),
      source_latest: input.sourceType,
      total_inquiries: String(Number(row.total_inquiries || 0) + 1),
      notes: mergeNotes_(row.notes, input.internalNotes)
    });
    writeObjectToRow_(sh, existingIndex + 2, updated);
    return updated;
  }

  const guest = {
    guest_id: makeId_("G"),
    created_at: now,
    updated_at: now,
    first_contact_at: sourceContactAt,
    last_contact_at: sourceContactAt,
    first_name: input.firstName,
    last_name: input.lastName,
    full_name: input.fullName,
    email: input.email,
    email_normalized: input.emailNormalized,
    phone_raw: input.phoneRaw,
    phone_normalized: input.phoneNormalized,
    country: input.country,
    preferred_language: "",
    guest_type: "Lead",
    vip_status: "No",
    source_first: input.sourceType,
    source_latest: input.sourceType,
    total_inquiries: "1",
    total_confirmed_bookings: "0",
    duplicate_key: duplicateKey,
    status: "active",
    notes: input.internalNotes
  };
  appendObject_(sh, guest);
  return guest;
}

function appendInquiry_(ss, guest, input, now) {
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  const dateRange = parseDateRange_(input.requestedDateText);
  const guestCount = parseGuestCount_(input.guestCountText);
  const requestDetails = buildStructuredSiteRequest_(input, dateRange, guestCount);
  const sourceContactAt = input.sourceContactAt || now;
  const status = "new";
  const inquiry = {
    inquiry_id: makeId_("INQ"),
    guest_id: guest.guest_id,
    created_at: sourceContactAt,
    updated_at: now,
    source_type: input.sourceType,
    source_tab: input.sourceTab,
    source_row: input.sourceRow,
    source_page: input.sourcePage,
    assigned_to: "",
    status: inferInitialStatus_(input),
    stage_changed_at: now,
    last_contacted_at: "",
    followup_date: todayIso_(),
    next_action: "Review inquiry and reply",
    priority: inferPriority_(dateRange.start),
    first_name: input.firstName,
    last_name: input.lastName,
    full_name: input.fullName,
    email: input.email,
    email_normalized: input.emailNormalized,
    phone_raw: input.phoneRaw,
    phone_normalized: input.phoneNormalized,
    requested_date_start: dateRange.start,
    requested_date_end: dateRange.end,
    requested_date_text: input.requestedDateText,
    guest_count: guestCount.count,
    guest_count_text: input.guestCountText,
    tour_type: requestDetails.interestCategory,
    tour_category: requestDetails.interestCategory,
    accommodation_needs: input.accommodationNeeds,
    transportation_needed: normalizeTransportationNeeded_(requestDetails.transportationNeeded),
    pickup_location: input.pickupLocation,
    special_interests: input.specialInterests,
    message_questions: input.messageQuestions,
    internal_notes: input.internalNotes,
    availability_status: "pending",
    quote_status: "not_sent",
    payment_status: inferInitialPaymentStatus_(input),
    quoted_amount: "",
    quoted_currency: "USD",
    quote_options_json: "",
    quote_sent_at: "",
    quote_sent_channel: "",
    quote_notes: "",
    confirmed_date: "",
    completed_date: "",
    lost_reason: "",
    source_record_id: input.sourceRecordId,
    grouping_preference: requestDetails.groupingPreference,
    grouping_status: "unmatched",
    departure_id: "",
    country: input.country,
    home_country: input.country,
    tour_items: requestDetails.tourItemsJson,
    tour_items_json: requestDetails.tourItemsJson,
    tour_count: String(requestDetails.tourItems.length),
    product_selected: requestDetails.productSelected,
    service_type: requestDetails.serviceType,
    duration_preference: requestDetails.durationPreference,
    is_archived: "No",
    archived_at: "",
    archive_reason: "",
    superseded_by_inquiry_id: "",
    return_sequence: String(countGuestInquiries_(sh, guest.guest_id) + 1),
    interest_category: requestDetails.interestCategory,
    requested_date: dateRange.start,
    tour_content: String(requestDetails.tourItems.length),
    contact_intent_id: input.contactIntentId,
    website_visitor_id: input.websiteVisitorId,
    website_session_id: input.websiteSessionId,
    attribution_status: input.attributionStatus,
    attribution_quality: input.attributionQuality,
    first_touch_source: input.firstTouchSource,
    first_touch_medium: input.firstTouchMedium,
    first_touch_campaign: input.firstTouchCampaign,
    first_touch_content: input.firstTouchContent,
    first_touch_term: input.firstTouchTerm,
    first_touch_landing_page: input.firstTouchLandingPage,
    first_touch_referrer: input.firstTouchReferrer,
    first_touch_date: input.firstTouchDate,
    last_touch_source: input.lastTouchSource,
    last_touch_medium: input.lastTouchMedium,
    last_touch_campaign: input.lastTouchCampaign,
    last_touch_content: input.lastTouchContent,
    last_touch_term: input.lastTouchTerm,
    last_touch_landing_page: input.lastTouchLandingPage,
    last_touch_referrer: input.lastTouchReferrer,
    last_touch_date: input.lastTouchDate,
    utm_source: input.utmSource,
    utm_medium: input.utmMedium,
    utm_campaign: input.utmCampaign,
    utm_content: input.utmContent,
    utm_term: input.utmTerm,
    gclid: input.gclid,
    gbraid: input.gbraid,
    wbraid: input.wbraid,
    fbclid: input.fbclid,
    meta_campaign_id: input.metaCampaignId,
    meta_adset_id: input.metaAdsetId,
    meta_ad_id: input.metaAdId
  };

  const existing = findExistingInquiryForInput_(sh, guest, input, inquiry);
  if (existing) {
    const merged = mergeInquiryRows_(existing.row, inquiry, now);
    writeObjectToRow_(sh, existing.rowNumber, merged);
    merged._created_new = false;
    return merged;
  }

  appendObject_(sh, inquiry);
  inquiry._created_new = true;
  return inquiry;
}

function countGuestInquiries_(sh, guestId) {
  return getObjects_(sh).filter(function(row) {
    return clean_(row.guest_id) === clean_(guestId) && clean_(row.is_archived).toLowerCase() !== "yes";
  }).length;
}

function findExistingInquiryForInput_(sh, guest, input, candidate) {
  const rows = getObjectsWithRowNumbers_(sh);
  const email = clean_(input.emailNormalized).toLowerCase();
  const phone = clean_(input.phoneNormalized);
  const sourceRecordId = clean_(input.sourceRecordId);
  const candidateDate = normalizeInquiryDateForMatch_(candidate);
  let fallback = null;

  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    const row = item.row;
    if (sourceRecordId && splitMergedField_(row.source_record_id).indexOf(sourceRecordId) >= 0) {
      return item;
    }
    const sameEmail = Boolean(email) &&
      clean_(row.email_normalized || row.email).toLowerCase() === email;
    const samePhone = !email && Boolean(phone) &&
      (clean_(row.phone_normalized) || normalizePhone_(row.phone_raw)) === phone;
    const sameGuest = guest.guest_id && clean_(row.guest_id) === clean_(guest.guest_id);
    if (!sameEmail && !samePhone && !sameGuest) continue;

    const rowDate = normalizeInquiryDateForMatch_(row);
    const sameDate = candidateDate && rowDate && candidateDate === rowDate;
    const manualSource = clean_(input.sourceType) === "manual_pending_guest" || clean_(row.source_type) === "manual_pending_guest";
    const inputSourceTab = canonicalSourceTab_(input.sourceTab);
    const sameSource = splitMergedField_(row.source_tab).some(function(tab) {
      return canonicalSourceTab_(tab) === inputSourceTab;
    });

    if (sameDate) return item;
    if (manualSource && sameEmail && !fallback) fallback = item;
    if (!candidateDate && sameEmail && !fallback) fallback = item;
    if (!candidateDate && samePhone && sameSource && !fallback) fallback = item;
    if (!candidateDate && !email && sameGuest && sameSource && !fallback) fallback = item;
  }

  return fallback;
}

function mergeInquiryRows_(existing, incoming, now) {
  const merged = Object.assign({}, existing, {
    updated_at: now,
    created_at: chooseEarliestDateTime_(existing.created_at, incoming.created_at),
    source_type: preferSourceType_(existing.source_type, incoming.source_type),
    source_tab: mergeDistinctText_(existing.source_tab, incoming.source_tab),
    source_row: mergeDistinctText_(existing.source_row, incoming.source_row),
    source_record_id: mergeDistinctText_(existing.source_record_id, incoming.source_record_id),
    source_page: keepBest_(existing.source_page, incoming.source_page),
    status: chooseStrongerInquiryStatus_(existing.status, incoming.status),
    priority: chooseStrongerPriority_(existing.priority, incoming.priority),
    first_name: keepBest_(existing.first_name, incoming.first_name),
    last_name: keepBest_(existing.last_name, incoming.last_name),
    full_name: keepBest_(existing.full_name, incoming.full_name),
    email: keepBest_(existing.email, incoming.email),
    email_normalized: keepBest_(existing.email_normalized, incoming.email_normalized),
    phone_raw: keepBest_(existing.phone_raw, incoming.phone_raw),
    phone_normalized: keepBest_(existing.phone_normalized, incoming.phone_normalized),
    requested_date_start: keepBest_(incoming.requested_date_start, existing.requested_date_start),
    requested_date_end: keepBest_(incoming.requested_date_end, existing.requested_date_end),
    requested_date_text: keepBest_(incoming.requested_date_text, existing.requested_date_text),
    guest_count: keepBest_(incoming.guest_count, existing.guest_count),
    guest_count_text: keepBest_(incoming.guest_count_text, existing.guest_count_text),
    tour_type: clean_(incoming.interest_category) ? incoming.tour_type : preferSpecificTourType_(existing.tour_type, incoming.tour_type),
    tour_category: clean_(incoming.interest_category) ? incoming.tour_category : preferSpecificTourType_(existing.tour_category, incoming.tour_category),
    accommodation_needs: keepBest_(incoming.accommodation_needs, existing.accommodation_needs),
    transportation_needed: keepBest_(incoming.transportation_needed, existing.transportation_needed),
    pickup_location: keepBest_(incoming.pickup_location, existing.pickup_location),
    special_interests: keepBest_(incoming.special_interests, existing.special_interests),
    message_questions: keepBest_(incoming.message_questions, existing.message_questions),
    internal_notes: mergeNotes_(existing.internal_notes, incoming.internal_notes),
    availability_status: keepNonDefault_(existing.availability_status, incoming.availability_status, "pending"),
    quote_status: keepNonDefault_(existing.quote_status, incoming.quote_status, "not_sent"),
    payment_status: keepNonDefault_(existing.payment_status, incoming.payment_status, "unpaid"),
    quoted_amount: keepBest_(existing.quoted_amount, incoming.quoted_amount),
    quoted_currency: "USD",
    quote_options_json: keepBest_(incoming.quote_options_json, existing.quote_options_json),
    quote_sent_at: keepBest_(incoming.quote_sent_at, existing.quote_sent_at),
    quote_sent_channel: keepBest_(incoming.quote_sent_channel, existing.quote_sent_channel),
    quote_notes: keepBest_(incoming.quote_notes, existing.quote_notes),
    confirmed_date: keepBest_(existing.confirmed_date, incoming.confirmed_date),
    completed_date: keepBest_(existing.completed_date, incoming.completed_date),
    lost_reason: keepBest_(existing.lost_reason, incoming.lost_reason),
    grouping_preference: keepNonDefault_(existing.grouping_preference, incoming.grouping_preference, "unknown"),
    grouping_status: keepNonDefault_(existing.grouping_status, incoming.grouping_status, "unmatched"),
    departure_id: keepBest_(existing.departure_id, incoming.departure_id),
    country: keepBest_(incoming.country, existing.country),
    home_country: keepBest_(incoming.home_country || incoming.country, existing.home_country || existing.country),
    interest_category: keepBest_(incoming.interest_category, existing.interest_category),
    tour_items: keepBest_(incoming.tour_items, existing.tour_items),
    tour_items_json: keepBest_(incoming.tour_items_json, existing.tour_items_json),
    tour_count: keepBest_(incoming.tour_count, existing.tour_count),
    tour_content: keepBest_(incoming.tour_content, existing.tour_content),
    product_selected: keepBest_(incoming.product_selected, existing.product_selected),
    service_type: keepBest_(incoming.service_type, existing.service_type),
    duration_preference: keepBest_(incoming.duration_preference, existing.duration_preference),
    requested_date: keepBest_(incoming.requested_date, existing.requested_date),
    contact_intent_id: mergeDistinctText_(existing.contact_intent_id, incoming.contact_intent_id),
    website_visitor_id: keepBest_(existing.website_visitor_id, incoming.website_visitor_id),
    website_session_id: keepBest_(incoming.website_session_id, existing.website_session_id),
    attribution_status: keepBest_(incoming.attribution_status, existing.attribution_status),
    attribution_quality: keepBest_(incoming.attribution_quality, existing.attribution_quality),
    first_touch_source: keepBest_(existing.first_touch_source, incoming.first_touch_source),
    first_touch_medium: keepBest_(existing.first_touch_medium, incoming.first_touch_medium),
    first_touch_campaign: keepBest_(existing.first_touch_campaign, incoming.first_touch_campaign),
    first_touch_content: keepBest_(existing.first_touch_content, incoming.first_touch_content),
    first_touch_term: keepBest_(existing.first_touch_term, incoming.first_touch_term),
    first_touch_landing_page: keepBest_(existing.first_touch_landing_page, incoming.first_touch_landing_page),
    first_touch_referrer: keepBest_(existing.first_touch_referrer, incoming.first_touch_referrer),
    first_touch_date: chooseEarliestDateTime_(existing.first_touch_date, incoming.first_touch_date),
    last_touch_source: keepBest_(incoming.last_touch_source, existing.last_touch_source),
    last_touch_medium: keepBest_(incoming.last_touch_medium, existing.last_touch_medium),
    last_touch_campaign: keepBest_(incoming.last_touch_campaign, existing.last_touch_campaign),
    last_touch_content: keepBest_(incoming.last_touch_content, existing.last_touch_content),
    last_touch_term: keepBest_(incoming.last_touch_term, existing.last_touch_term),
    last_touch_landing_page: keepBest_(incoming.last_touch_landing_page, existing.last_touch_landing_page),
    last_touch_referrer: keepBest_(incoming.last_touch_referrer, existing.last_touch_referrer),
    last_touch_date: chooseLatestDateTime_(existing.last_touch_date, incoming.last_touch_date),
    utm_source: keepBest_(incoming.utm_source, existing.utm_source),
    utm_medium: keepBest_(incoming.utm_medium, existing.utm_medium),
    utm_campaign: keepBest_(incoming.utm_campaign, existing.utm_campaign),
    utm_content: keepBest_(incoming.utm_content, existing.utm_content),
    utm_term: keepBest_(incoming.utm_term, existing.utm_term),
    gclid: keepBest_(incoming.gclid, existing.gclid),
    gbraid: keepBest_(incoming.gbraid, existing.gbraid),
    wbraid: keepBest_(incoming.wbraid, existing.wbraid),
    fbclid: keepBest_(incoming.fbclid, existing.fbclid),
    meta_campaign_id: keepBest_(incoming.meta_campaign_id, existing.meta_campaign_id),
    meta_adset_id: keepBest_(incoming.meta_adset_id, existing.meta_adset_id),
    meta_ad_id: keepBest_(incoming.meta_ad_id, existing.meta_ad_id)
  });
  return merged;
}

function createInitialFollowup_(ss, inquiry, now) {
  const sh = ss.getSheetByName(CRM_TABS.followups);
  const followup = {
    followup_id: makeId_("FU"),
    inquiry_id: inquiry.inquiry_id,
    guest_id: inquiry.guest_id,
    created_at: now,
    due_at: inquiry.followup_date,
    completed_at: "",
    status: "open",
    followup_type: "internal_review",
    assigned_to: inquiry.assigned_to,
    email_template: "",
    calendar_event_id: "",
    subject: "Review new inquiry: " + inquiry.full_name,
    notes: inquiry.next_action,
    last_error: "",
    channel: "telegram",
    send_status: "pending",
    send_after: inquiry.followup_date,
    template_key: "new_inquiry_alert"
  };
  appendObject_(sh, followup);
}

function isMeaningfulWhatsappInquiryRow_(row, guestProfile) {
  return Boolean(
    clean_(row.full_name) ||
    clean_(row.first_name) ||
    clean_(row.last_name) ||
    clean_(row.phone_number) ||
    clean_(row.email) ||
    clean_(row.requested_date) ||
    clean_(row.tour_type) ||
    clean_(row.notes) ||
    clean_(guestProfile && guestProfile.full_name) ||
    clean_(guestProfile && guestProfile.phone_number) ||
    clean_(guestProfile && guestProfile.email)
  );
}

function isMeaningfulInvoiceRow_(row) {
  if (clean_(row.invoice_no) || clean_(row.invoice_no_txt)) return true;
  const hasGuestIdentity = Boolean(
    clean_(row.guest_first_name) ||
    clean_(row.guest_last_name) ||
    clean_(row.guest_email) ||
    clean_(row.guest_phone)
  );
  const hasBookingOrPaymentDetails = Boolean(
    clean_(row.tour_date) ||
    clean_(row.service_type) ||
    clean_(row.product_selected) ||
    clean_(row.amount_received) ||
    clean_(row.total_booking_price) ||
    clean_(row.payment_method) ||
    clean_(row.date_paid)
  );
  return hasGuestIdentity && hasBookingOrPaymentDetails;
}

function cleanupCrmInquiryArtifacts_(ss) {
  return {
    blankRows: deleteFullyBlankRows_(ss.getSheetByName(CRM_TABS.inquiries)),
    blankInvoiceArtifacts: deleteBlankInvoiceArtifactInquiries_(ss)
  };
}

function deleteFullyBlankRows_(sh) {
  if (!sh) return 0;
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return 0;
  const values = sh.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  let removed = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    const hasAnyValue = values[i].some(function(value) { return clean_(value); });
    if (!hasAnyValue) {
      sh.deleteRow(i + 2);
      removed++;
    }
  }
  return removed;
}

function deleteBlankInvoiceArtifactInquiries_(ss) {
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) return 0;
  const rows = getObjectsWithRowNumbers_(sh);
  let removed = 0;
  rows.sort(function(a, b) { return b.rowNumber - a.rowNumber; }).forEach(function(item) {
    const row = item.row;
    const notes = clean_(row.internal_notes);
    const isBlankInvoiceArtifact = notes.indexOf("Matched accounting invoice  to booking BOOK-INV-ROW-") >= 0;
    const hasGuestData = Boolean(clean_(row.full_name) || clean_(row.email) || clean_(row.phone_normalized) || clean_(row.requested_date_start) || clean_(row.tour_type));
    if (isBlankInvoiceArtifact && !hasGuestData) {
      sh.deleteRow(item.rowNumber);
      removed++;
    }
  });
  return removed;
}

function dedupeCrmInquiriesByInquiryId_(ss) {
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) return 0;
  const rows = getObjectsWithRowNumbers_(sh);
  const groups = {};
  rows.forEach(function(item) {
    const id = clean_(item.row.inquiry_id);
    if (!id) return;
    if (!groups[id]) groups[id] = [];
    groups[id].push(item);
  });

  const rowsToDelete = [];
  Object.keys(groups).forEach(function(id) {
    const items = groups[id];
    if (items.length < 2) return;
    items.sort(function(a, b) {
      const scoreDiff = inquiryRowPreservationScore_(b.row) - inquiryRowPreservationScore_(a.row);
      if (scoreDiff) return scoreDiff;
      return clean_(b.row.updated_at).localeCompare(clean_(a.row.updated_at));
    });
    const keep = items[0];
    const merged = items.slice(1).reduce(function(acc, item) {
      return mergeInquiryRows_(acc, item.row, nowIso_());
    }, keep.row);
    writeObjectToRow_(sh, keep.rowNumber, merged);
    items.slice(1).forEach(function(item) { rowsToDelete.push(item.rowNumber); });
  });

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    sh.deleteRow(rowNumber);
  });
  return rowsToDelete.length;
}

function repairDuplicateCrmInquiryIdsOnly() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const removedById = dedupeCrmInquiriesByInquiryId_(ss);
  const removedByNaturalKey = dedupeCrmInquiriesByNaturalKey_(ss);
  const removedByPhoneFallback = mergePhoneFallbackInquiryDuplicates_(ss);
  sortCrmInquiriesByCreatedAtDesc();
  Logger.log(
    "Duplicate inquiry repair complete. Removed by inquiry_id: " + removedById +
    ", removed by natural key: " + removedByNaturalKey +
    ", removed by phone fallback: " + removedByPhoneFallback
  );
}

function repairDuplicateCrmInquiries() {
  repairDuplicateCrmInquiryIdsOnly();
}

/**
 * One-time repair for imports that created a second inquiry with the same
 * guest and phone but omitted both email and requested date.
 */
function repairPhoneOnlyDuplicateInquiries() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) throw new Error("Missing " + CRM_TABS.inquiries + " sheet.");

  const rows = getObjectsWithRowNumbers_(sh);
  const groups = {};
  rows.forEach(function(item) {
    const row = item.row;
    const guestId = clean_(row.guest_id);
    const phone = clean_(row.phone_normalized) || normalizePhone_(row.phone_raw);
    if (!guestId || !phone) return;
    const key = guestId + "||" + phone;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const rowsToDelete = [];
  let mergedCount = 0;

  Object.keys(groups).forEach(function(key) {
    const group = groups[key];
    if (group.length < 2) return;

    const blankIdentityRows = group.filter(function(item) {
      const row = item.row;
      const email = clean_(row.email_normalized || row.email);
      const date = normalizeInquiryDateForMatch_(row);
      return !email && !date;
    });
    if (!blankIdentityRows.length) return;

    const keeper = chooseInquiryKeeper_(group);
    blankIdentityRows.forEach(function(duplicate) {
      if (duplicate.rowNumber === keeper.rowNumber) return;
      if (rowsToDelete.indexOf(duplicate.rowNumber) >= 0) return;

      const oldInquiryId = clean_(duplicate.row.inquiry_id);
      const newInquiryId = clean_(keeper.row.inquiry_id);
      const merged = mergeInquiryRows_(keeper.row, duplicate.row, nowIso_());

      writeObjectToRow_(sh, keeper.rowNumber, merged);
      keeper.row = merged;
      updateRelatedInquiryId_(ss, oldInquiryId, newInquiryId);
      cancelMergedInquiryFollowups_(ss, oldInquiryId, newInquiryId);
      rowsToDelete.push(duplicate.rowNumber);
      mergedCount++;
    });
  });

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    sh.deleteRow(rowNumber);
  });
  sortCrmInquiriesByCreatedAtDesc();
  Logger.log("Phone-only duplicate repair complete. Merged: " + mergedCount);
  return mergedCount;
}

function dedupeCrmInquiriesByNaturalKey_(ss) {
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) return 0;
  const rows = getObjectsWithRowNumbers_(sh);
  const groups = {};
  rows.forEach(function(item) {
    const key = crmInquiryNaturalDedupeKey_(item.row);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const rowsToDelete = [];
  Object.keys(groups).forEach(function(key) {
    const items = groups[key];
    if (items.length < 2) return;
    items.sort(function(a, b) {
      const scoreDiff = inquiryRowPreservationScore_(b.row) - inquiryRowPreservationScore_(a.row);
      if (scoreDiff) return scoreDiff;
      return clean_(b.row.updated_at).localeCompare(clean_(a.row.updated_at));
    });
    const keep = items[0];
    const merged = items.slice(1).reduce(function(acc, item) {
      return mergeInquiryRows_(acc, item.row, nowIso_());
    }, keep.row);
    writeObjectToRow_(sh, keep.rowNumber, merged);
    items.slice(1).forEach(function(item) { rowsToDelete.push(item.rowNumber); });
  });

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    sh.deleteRow(rowNumber);
  });
  return rowsToDelete.length;
}

/**
 * Run once after installing the canonical source-tab update.
 *
 * Merges inquiries created from the same physical raw-sheet row when an older
 * router used aliases such as site_book_tour instead of book_tour. The row with
 * the strongest saved CRM work is retained, so ownership, quoted status,
 * product selection, payment data, and notes are not replaced by import defaults.
 * Safe to run again.
 */
function repairCanonicalSourceDuplicates() {
  throw new Error("Disabled: this legacy repair is unsafe for merged source metadata. Use recoverCrmAfterCanonicalRepair_20260821 instead.");
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) throw new Error("Missing crm_inquiries sheet.");

  const rows = getObjectsWithRowNumbers_(sh);
  const groups = {};
  rows.forEach(function(item) {
    const tabs = splitMergedField_(item.row.source_tab);
    const sourceRows = splitMergedField_(item.row.source_row);
    if (!tabs.length || !sourceRows.length) return;

    tabs.forEach(function(tab) {
      const canonicalTab = canonicalSourceTab_(tab);
      sourceRows.forEach(function(sourceRow) {
        if (!canonicalTab || !sourceRow) return;
        const key = canonicalTab + "||" + sourceRow;
        if (!groups[key]) groups[key] = [];
        if (!groups[key].some(function(existing) { return existing.rowNumber === item.rowNumber; })) {
          groups[key].push(item);
        }
      });
    });
  });

  const rowsToDelete = [];
  let mergedCount = 0;
  Object.keys(groups).forEach(function(key) {
    const items = groups[key].filter(function(item) {
      return rowsToDelete.indexOf(item.rowNumber) < 0;
    });
    if (items.length < 2) return;

    items.sort(function(a, b) {
      const scoreDiff = inquiryRowPreservationScore_(b.row) - inquiryRowPreservationScore_(a.row);
      if (scoreDiff) return scoreDiff;
      return clean_(b.row.updated_at).localeCompare(clean_(a.row.updated_at));
    });

    const keeper = items[0];
    items.slice(1).forEach(function(duplicate) {
      const oldInquiryId = clean_(duplicate.row.inquiry_id);
      const newInquiryId = clean_(keeper.row.inquiry_id);
      keeper.row = mergeInquiryRows_(keeper.row, duplicate.row, nowIso_());
      updateRelatedInquiryId_(ss, oldInquiryId, newInquiryId);
      cancelMergedInquiryFollowups_(ss, oldInquiryId, newInquiryId);
      rowsToDelete.push(duplicate.rowNumber);
      mergedCount++;
    });
    if (clean_(keeper.row.requested_date_start)) {
      keeper.row.requested_date = keeper.row.requested_date_start;
    }
    writeObjectToRow_(sh, keeper.rowNumber, keeper.row);
  });

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    sh.deleteRow(rowNumber);
  });
  sortCrmInquiriesByCreatedAtDesc();
  refreshPipelineReview();
  Logger.log("Canonical source duplicate repair complete. Merged: " + mergedCount);
  return mergedCount;
}

/**
 * One-time recovery for the August 21, 2026 canonical-source repair incident.
 *
 * Before running, import the supplied pre-incident crm_inquiries CSV into this
 * spreadsheet as a tab named: crm_inquiries_recovery_20260821
 *
 * The function first copies the live master to a timestamped backup tab. It then
 * restores only the inquiry IDs proven missing or corrupted, removes only the
 * known automatic re-import shells, and retains unrelated newer rows.
 */
function recoverCrmAfterCanonicalRepair_20260821() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const master = ss.getSheetByName(CRM_TABS.inquiries);
  const recovery = ss.getSheetByName("crm_inquiries_recovery_20260821");
  if (!master) throw new Error("Missing crm_inquiries sheet.");
  if (!recovery) throw new Error("Import crm_inquiries (3).csv as a tab named crm_inquiries_recovery_20260821 first.");

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/New_York", "yyyyMMdd_HHmmss");
  const backupName = ("crm_pre_recovery_" + stamp).slice(0, 99);
  master.copyTo(ss).setName(backupName);

  // Exact duplicate inquiry IDs are storage artifacts, not judgment-based
  // guest matching. Collapse these first so every restored ID has one row.
  const removedExactIdDuplicates = dedupeCrmInquiriesByInquiryId_(ss);

  const snapshotRows = getObjects_(recovery).filter(function(row) { return clean_(row.inquiry_id); });
  const snapshotById = {};
  snapshotRows.forEach(function(row) { snapshotById[clean_(row.inquiry_id)] = row; });

  const damagedSharedIds = {
    "INQ-20260604161413-5226": true,
    "INQ-20260607005232-1237": true,
    "INQ-20260619085232-4995": true,
    "INQ-20260622213231-9804": true,
    "INQ-20260718072234-2428": true,
    "INQ-20260722120733-6376": true,
    "INQ-20260726030752-4118": true,
    "INQ-20260726225236-5026": true,
    "INQ-20260728192002-6613": true,
    "INQ-20260817103242-1603": true,
    "INQ-20260820222237-8310": true
  };

  const intentionalLezlieDuplicateId = "INQ-20260821111736-9133";
  const erroneousReimportIds = {
    "INQ-20260821123232-3719": true,
    "INQ-20260821123237-8568": true,
    "INQ-20260821123248-1316": true,
    "INQ-20260821123255-9253": true,
    "INQ-20260821123302-9315": true,
    "INQ-20260821123307-3552": true,
    "INQ-20260821123313-1773": true,
    "INQ-20260821123319-8781": true,
    "INQ-20260821123324-5395": true,
    "INQ-20260821123345-3289": true,
    "INQ-20260821123356-6183": true,
    "INQ-20260821123735-7148": true
  };

  let current = getObjectsWithRowNumbers_(master);
  const currentById = {};
  current.forEach(function(item) { currentById[clean_(item.row.inquiry_id)] = item; });
  let restoredMissing = 0;
  let restoredDamaged = 0;

  Object.keys(snapshotById).forEach(function(snapshotId) {
    const snapshot = snapshotById[snapshotId];
    const id = clean_(snapshot.inquiry_id);
    if (id === intentionalLezlieDuplicateId) return;
    const existing = currentById[id];
    if (!existing) {
      appendObject_(master, snapshot);
      restoredMissing++;
      return;
    }
    if (damagedSharedIds[id]) {
      const restored = Object.assign({}, snapshot);
      if (id === "INQ-20260820222237-8310" && clean_(restored.requested_date_start)) {
        restored.requested_date = restored.requested_date_start;
      }
      writeObjectToRow_(master, existing.rowNumber, restored);
      restoredDamaged++;
    }
  });

  current = getObjectsWithRowNumbers_(master);
  const rowsToDelete = current.filter(function(item) {
    return Boolean(erroneousReimportIds[clean_(item.row.inquiry_id)]);
  }).map(function(item) { return item.rowNumber; });
  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    master.deleteRow(rowNumber);
  });

  sortCrmInquiriesByCreatedAtDesc();
  refreshPipelineReview();
  const finalCount = Math.max(0, master.getLastRow() - 1);
  const result = {
    backup_tab: backupName,
    removed_exact_id_duplicates: removedExactIdDuplicates,
    restored_missing: restoredMissing,
    restored_damaged: restoredDamaged,
    removed_reimport_shells: rowsToDelete.length,
    final_record_count: finalCount
  };
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Repairs duplicates where one imported inquiry had no email but its
 * normalized phone belongs to an existing inquiry for the same guest.
 *
 * Rows are merged only when they share a guest, phone, and source tab, and
 * either have the same requested date or at least one row is undated. This
 * preserves genuinely separate, dated inquiries from returning guests.
 */
function mergePhoneFallbackInquiryDuplicates_(ss) {
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) return 0;

  const rows = getObjectsWithRowNumbers_(sh);
  const groups = {};

  rows.forEach(function(item) {
    const row = item.row;
    const phone = clean_(row.phone_normalized) || normalizePhone_(row.phone_raw);
    const guestId = clean_(row.guest_id);
    if (!phone || !guestId) return;

    const key = guestId + "||" + phone;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const rowsToDelete = [];

  Object.keys(groups).forEach(function(key) {
    let candidates = groups[key].filter(function(item) {
      return rowsToDelete.indexOf(item.rowNumber) < 0;
    });
    if (candidates.length < 2) return;

    candidates.sort(function(a, b) {
      const scoreDiff = inquiryKeeperScore_(b.row) - inquiryKeeperScore_(a.row);
      if (scoreDiff) return scoreDiff;
      return clean_(a.row.created_at).localeCompare(clean_(b.row.created_at));
    });

    for (let i = 0; i < candidates.length; i++) {
      const keeper = candidates[i];
      if (rowsToDelete.indexOf(keeper.rowNumber) >= 0) continue;

      for (let j = i + 1; j < candidates.length; j++) {
        const duplicate = candidates[j];
        if (rowsToDelete.indexOf(duplicate.rowNumber) >= 0) continue;
        if (!shouldMergePhoneFallbackInquiryRows_(keeper.row, duplicate.row)) continue;

        const oldInquiryId = clean_(duplicate.row.inquiry_id);
        const newInquiryId = clean_(keeper.row.inquiry_id);
        const merged = mergeInquiryRows_(keeper.row, duplicate.row, nowIso_());

        writeObjectToRow_(sh, keeper.rowNumber, merged);
        keeper.row = merged;
        updateRelatedInquiryId_(ss, oldInquiryId, newInquiryId);
        cancelMergedInquiryFollowups_(ss, oldInquiryId, newInquiryId);
        rowsToDelete.push(duplicate.rowNumber);
      }
    }
  });

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    sh.deleteRow(rowNumber);
  });
  return rowsToDelete.length;
}

function shouldMergePhoneFallbackInquiryRows_(a, b) {
  const aPhone = clean_(a.phone_normalized) || normalizePhone_(a.phone_raw);
  const bPhone = clean_(b.phone_normalized) || normalizePhone_(b.phone_raw);
  if (!aPhone || aPhone !== bPhone) return false;
  if (!clean_(a.guest_id) || clean_(a.guest_id) !== clean_(b.guest_id)) return false;

  const aTabs = splitMergedField_(a.source_tab);
  const bTabs = splitMergedField_(b.source_tab);
  const sameSource = aTabs.some(function(tab) { return bTabs.indexOf(tab) >= 0; });
  if (!sameSource) return false;

  const aEmail = clean_(a.email_normalized || a.email).toLowerCase();
  const bEmail = clean_(b.email_normalized || b.email).toLowerCase();
  if (aEmail && bEmail && aEmail !== bEmail) return false;

  const aDate = normalizeInquiryDateForMatch_(a);
  const bDate = normalizeInquiryDateForMatch_(b);
  return Boolean(aDate && bDate && aDate === bDate) || !aDate || !bDate;
}

function crmInquiryNaturalDedupeKey_(row) {
  const identity = clean_(row.email_normalized).toLowerCase() || clean_(row.phone_normalized) || clean_(row.email).toLowerCase();
  if (!identity) return "";
  const sourceTab = canonicalSourceTab_(splitMergedField_(row.source_tab)[0] || row.source_tab);
  const sourceRow = clean_(row.source_row);
  const date = normalizeDateForSheet_(row.requested_date_start) || normalizeDateForSheet_(row.requested_date_text);
  if (sourceTab && sourceRow) return [identity, date, sourceTab, sourceRow].join("||");
  if (date) return [identity, date].join("||");
  return "";
}

function lockAllCurrentCrmInquiryStatuses() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh || sh.getLastRow() < 2) return;
  const statusCol = getColumnIndexByHeader_(sh, "status");
  if (!statusCol) return;
  const values = sh.getRange(2, statusCol, sh.getLastRow() - 1, 1).getDisplayValues();
  values.forEach(function(row, idx) {
    if (clean_(row[0])) sh.getRange(idx + 2, statusCol).setNote(MANUAL_STATUS_OVERRIDE_NOTE);
  });
  Logger.log("Locked current crm_inquiries statuses: " + values.length);
}

function inquiryRowPreservationScore_(row) {
  const manualFields = ["last_contacted_at", "followup_date", "next_action", "internal_notes", "availability_status", "quote_status", "payment_status", "quoted_amount", "quote_options_json", "quote_sent_at", "quote_sent_channel", "quote_notes", "confirmed_date", "completed_date", "lost_reason", "pickup_location", "grouping_preference", "grouping_status", "departure_id"];
  let score = 0;
  manualFields.forEach(function(field) { if (clean_(row[field])) score += 1; });
  if (["booked", "completed", "cancelled", "did_not_book", "lost", "deposit_paid", "deposit_pending", "quoted", "planning"].indexOf(clean_(row.status)) >= 0) score += 5;
  return score;
}

function routeDepositsToPayments_(ss) {
  const deposits = ss.getSheetByName("deposits");
  const payments = ss.getSheetByName(CRM_TABS.payments);
  if (!deposits || !payments) return;

  const existing = {};
  getObjects_(payments).forEach(function(row) {
    if (row.payment_id) existing[String(row.payment_id)] = true;
  });

  getObjectsWithRowNumbers_(deposits).forEach(function(item) {
    const row = item.row;
    const paymentId = clean_(row.deposit_id) || "PAY-SOURCE-ROW-" + item.rowNumber;
    if (existing[paymentId]) return;

    const duplicateInput = normalizeInput_({
      sourceType: "manual_deposit",
      sourceTab: "deposits",
      sourceRow: item.rowNumber,
      firstName: row.guest_first_name,
      lastName: row.guest_last_name,
      email: row.guest_email,
      phoneRaw: row.guest_phone,
      country: row.home_country,
      sourceContactAt: row.deposit_date,
      requestedDateText: row.tour_date,
      guestCountText: row.party_size,
      tourType: row.service_type,
      internalNotes: "Imported from deposits row " + item.rowNumber + "."
    });
    const guest = upsertGuest_(ss, duplicateInput, nowIso_());

    appendObject_(payments, {
      payment_id: paymentId,
      booking_id: "",
      inquiry_id: "",
      guest_id: guest.guest_id,
      created_at: nowIso_(),
      payment_status: normalizePaymentStatus_(row.booking_status),
      payment_date: normalizeDateForSheet_(row.deposit_date),
      payment_method: row.payment_method,
      paid_to: row.deposit_paid_to,
      invoice_id: row.invoice_id,
      transaction_id: row.transaction_id,
      payment_reference_note: row.payment_reference_note,
      total_booking_price: row.total_booking_price,
      deposit_amount_paid: row.deposit_amount_paid,
      additional_amount_paid: row.additional_amount_paid,
      total_amount_paid: row.total_amount_paid,
      balance_remaining: row.balance_remaining,
      is_fully_paid: row.is_fully_paid,
      notes: row.notes
    });
    existing[paymentId] = true;
  });
}

function buildWhatsappGuestLookup_(ss) {
  const sh = ss.getSheetByName("whatsapp_guests");
  const lookup = { byGuestId: {}, byPhone: {}, byEmail: {} };
  if (!sh) return lookup;

  getObjects_(sh).forEach(function(row) {
    const guestId = clean_(row.guest_id);
    const phone = clean_(row.phone_normalized) || normalizePhone_(row.phone_number);
    const email = clean_(row.email).toLowerCase();
    if (guestId) lookup.byGuestId[guestId] = row;
    if (phone) lookup.byPhone[phone] = row;
    if (email) lookup.byEmail[email] = row;
  });
  return lookup;
}

function findWhatsappGuestProfile_(inquiryRow, lookup) {
  const guestId = clean_(inquiryRow.guest_id);
  const phone = normalizePhone_(inquiryRow.phone_number);
  const email = clean_(inquiryRow.email).toLowerCase();
  return lookup.byGuestId[guestId] ||
    lookup.byPhone[phone] ||
    lookup.byEmail[email] ||
    {};
}

function backfillCrmGuestsFromWhatsappGuests_(ss, lookup) {
  const sh = ss.getSheetByName(CRM_TABS.guests);
  if (!sh) return;

  const rows = getObjects_(sh);
  rows.forEach(function(row, idx) {
    if (row.email && row.first_name && row.last_name) return;
    const profile = findWhatsappGuestProfile_({
      guest_id: row.guest_id,
      phone_number: row.phone_normalized || row.phone_raw,
      email: row.email
    }, lookup);
    if (!profile || !Object.keys(profile).length) return;

    const updated = Object.assign({}, row, {
      updated_at: nowIso_(),
      first_name: keepBest_(row.first_name, profile.first_name),
      last_name: keepBest_(row.last_name, profile.last_name),
      full_name: keepBest_(row.full_name, profile.full_name),
      email: keepBest_(row.email, profile.email),
      email_normalized: keepBest_(row.email_normalized, clean_(profile.email).toLowerCase()),
      phone_raw: keepBest_(row.phone_raw, profile.phone_number),
      phone_normalized: keepBest_(row.phone_normalized, profile.phone_normalized || normalizePhone_(profile.phone_number)),
      country: keepBest_(row.country, profile.country),
      notes: mergeNotes_(row.notes, profile.notes)
    });
    writeObjectToRow_(sh, idx + 2, updated);
  });
}

function routeInvoicesToCrm_(ss) {
  const invoices = ss.getSheetByName("invoices");
  const bookings = ss.getSheetByName(CRM_TABS.bookings);
  const payments = ss.getSheetByName(CRM_TABS.payments);
  const inquiries = ss.getSheetByName(CRM_TABS.inquiries);
  if (!invoices || !bookings || !payments || !inquiries) return;

  const existingBookings = {};
  getObjects_(bookings).forEach(function(row) {
    if (row.booking_id) existingBookings[String(row.booking_id)] = true;
  });

  const existingPayments = {};
  getObjects_(payments).forEach(function(row) {
    if (row.payment_id) existingPayments[String(row.payment_id)] = true;
  });

  const inquiryRows = getObjects_(inquiries);

  getObjectsWithRowNumbers_(invoices).forEach(function(item) {
    const row = item.row;
    if (!isMeaningfulInvoiceRow_(row)) return;
    const invoiceNoActual = clean_(row.invoice_no) || clean_(row.invoice_no_txt);
    const invoiceNo = invoiceNoActual || "INV-ROW-" + item.rowNumber;
    const bookingId = "BOOK-" + invoiceNo;
    const paymentId = "INV-" + invoiceNo;
    const invoiceTourDate = normalizeDateForSheet_(row.tour_date);
    const invoiceBookingStatus = invoiceBookingStatus_(row);

    const input = normalizeInput_({
      sourceType: "accounting_invoice",
      sourceTab: "invoices",
      sourceRow: item.rowNumber,
      firstName: row.guest_first_name,
      lastName: row.guest_last_name,
      email: row.guest_email,
      phoneRaw: row.guest_phone,
      country: row.home_country,
      sourceContactAt: row.date_paid || row.tour_date,
      requestedDateText: row.tour_date,
      guestCountText: row.party_size,
      tourType: row.service_type,
      pickupLocation: row.pickup_location,
      messageQuestions: row.notes,
      internalNotes: "Imported from accounting invoices row " + item.rowNumber + ". Invoice: " + invoiceNo,
      rawStatus: invoiceBookingStatus
    });

    const guest = upsertGuest_(ss, input, nowIso_());
    const matched = findBestInquiryForInvoice_(inquiryRows, input, guest.guest_id);
    const inquiryId = matched ? matched.inquiry_id : "";

    if (!existingBookings[bookingId]) {
      appendObject_(bookings, {
        booking_id: bookingId,
        inquiry_id: inquiryId,
        guest_id: guest.guest_id,
        created_at: nowIso_(),
        updated_at: nowIso_(),
        booking_status: invoiceBookingStatus,
        tour_date_start: invoiceTourDate,
        tour_date_end: invoiceTourDate,
        tour_date_text: invoiceTourDate,
        party_size: row.party_size,
        service_type: row.service_type,
        product_selected: row.product_selected,
        tour_guide: row.tour_guide,
        pickup_location: row.pickup_location,
        total_booking_price: amountFromInvoiceRow_(row),
        quoted_currency: "USD",
        deposit_required: "",
        balance_due_date: "",
        calendar_event_id: "",
        operations_notes: row.notes
      });
      existingBookings[bookingId] = true;
    }

    if (!existingPayments[paymentId]) {
      appendObject_(payments, {
        payment_id: paymentId,
        booking_id: bookingId,
        inquiry_id: inquiryId,
        guest_id: guest.guest_id,
        created_at: nowIso_(),
        payment_status: row.date_paid || row.amount_received ? "paid" : "unpaid",
        payment_date: normalizeDateForSheet_(row.date_paid),
        payment_method: row.payment_method,
        paid_to: "",
        invoice_id: row.invoice_id || invoiceNo,
        transaction_id: row.transaction_id,
        payment_reference_note: row.payment_reference_note,
        total_booking_price: amountFromInvoiceRow_(row),
        deposit_amount_paid: "",
        additional_amount_paid: "",
        total_amount_paid: row.amount_received,
        balance_remaining: "",
        is_fully_paid: row.date_paid || row.amount_received ? "Yes" : "No",
        notes: row.notes
      });
      existingPayments[paymentId] = true;
    }

    if (matched) {
      updateInquiryFromInvoice_(inquiries, matched.rowNumber, matched, row, bookingId);
    }
  });
}

function findBestInquiryForInvoice_(inquiryRows, input, guestId) {
  const email = clean_(input.emailNormalized).toLowerCase();
  const phone = clean_(input.phoneNormalized);
  const tourDate = normalizeDateForSheet_(input.requestedDateText);
  let fallback = null;

  for (let i = 0; i < inquiryRows.length; i++) {
    const row = inquiryRows[i];
    const sameGuest = guestId && clean_(row.guest_id) === guestId;
    const sameEmail = email && clean_(row.email_normalized).toLowerCase() === email;
    const samePhone = phone && clean_(row.phone_normalized) === phone;
    if (!sameGuest && !sameEmail && !samePhone) continue;

    const rowDate = normalizeDateForSheet_(row.requested_date_start) || normalizeDateForSheet_(row.requested_date_text);
    const withRow = Object.assign({ rowNumber: i + 2 }, row);
    if (tourDate) {
      if (rowDate && tourDate === rowDate) return withRow;
      continue;
    }
    if (!fallback && (!rowDate || sameEmail || samePhone)) fallback = withRow;
  }
  return fallback;
}

function updateInquiryFromInvoice_(inquiriesSheet, rowNumber, inquiry, invoiceRow, bookingId) {
  const bookingStatus = invoiceBookingStatus_(invoiceRow);
  const completed = bookingStatus === "completed";
  const nextStatus = isManualStatusOverride_(inquiriesSheet, rowNumber) ? clean_(inquiry.status) : invoiceSafeInquiryStatus_(inquiry.status, bookingStatus);
  const updated = Object.assign({}, inquiry, {
    updated_at: nowIso_(),
    status: nextStatus,
    payment_status: invoiceRow.date_paid || invoiceRow.amount_received ? "paid" : inquiry.payment_status,
    confirmed_date: inquiry.confirmed_date || normalizeDateForSheet_(invoiceRow.date_paid),
    completed_date: inquiry.completed_date || (completed && nextStatus === "completed" ? normalizeDateForSheet_(invoiceRow.tour_date) : ""),
    internal_notes: mergeNotes_(inquiry.internal_notes, "Matched accounting invoice " + clean_(invoiceRow.invoice_no || invoiceRow.invoice_no_txt || bookingId.replace(/^BOOK-/, "")) + " to booking " + bookingId + ".")
  });
  writeObjectToRow_(inquiriesSheet, rowNumber, updated);
}

function invoiceSafeInquiryStatus_(currentStatus, invoiceStatus) {
  const current = clean_(currentStatus) || "new";
  const incoming = clean_(invoiceStatus);
  if (!incoming) return current;
  if (["did_not_book", "lost", "cancelled"].indexOf(current) >= 0) return current;
  if (current === "completed") return current;
  if (incoming === "completed" && current === "booked") return "completed";
  if (incoming === "booked" && ["", "new", "contacted", "planning", "qualified"].indexOf(current) >= 0) return "booked";
  return current;
}

function invoiceBookingStatus_(row) {
  const tourDate = normalizeDateForSheet_(row.tour_date);
  const markedCompleted = clean_(row.tour_completed).toLowerCase() === "yes";
  if (markedCompleted && tourDate && tourDate <= todayIso_()) return "completed";
  return "booked";
}

function repairCrmBookingAndPaymentPricesFromInvoices() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const invoices = ss.getSheetByName("invoices");
  const bookings = ss.getSheetByName(CRM_TABS.bookings);
  const payments = ss.getSheetByName(CRM_TABS.payments);
  if (!invoices || !bookings || !payments) return;

  const invoicesByNumber = {};
  getObjects_(invoices).forEach(function(row) {
    const invoiceNo = clean_(row.invoice_no) || clean_(row.invoice_no_txt);
    if (invoiceNo) invoicesByNumber[invoiceNo] = row;
  });

  getObjects_(bookings).forEach(function(row, idx) {
    const invoiceNo = clean_(row.booking_id).replace(/^BOOK-/, "");
    const invoice = invoicesByNumber[invoiceNo];
    const amount = invoice ? amountFromInvoiceRow_(invoice) : "";
    if (!amount) return;

    const updated = Object.assign({}, row, {
      updated_at: nowIso_(),
      total_booking_price: amount,
      quoted_currency: clean_(row.quoted_currency) || "USD"
    });
    writeObjectToRow_(bookings, idx + 2, updated);
  });

  getObjects_(payments).forEach(function(row, idx) {
    const invoiceNo = clean_(row.payment_id).replace(/^INV-/, "");
    const invoice = invoicesByNumber[invoiceNo];
    const amount = invoice ? amountFromInvoiceRow_(invoice) : "";
    if (!amount) return;

    const totalPaid = cleanMoneyValue_(row.total_amount_paid) || cleanMoneyValue_(invoice.amount_received);
    const updated = Object.assign({}, row, {
      total_booking_price: amount,
      total_amount_paid: totalPaid,
      is_fully_paid: totalPaid && Number(totalPaid) >= Number(amount) ? "Yes" : row.is_fully_paid
    });
    writeObjectToRow_(payments, idx + 2, updated);
  });
}

function amountFromInvoiceRow_(row) {
  return cleanMoneyValue_(row.final_invoice_total) ||
    cleanMoneyValue_(row.expected_total_with_tip) ||
    cleanMoneyValue_(row.amount_received);
}

function cleanMoneyValue_(value) {
  const text = clean_(value);
  if (!text) return "";
  if (text.indexOf("#") === 0 || text.toUpperCase().indexOf("REF") >= 0) return "";
  return text.replace(/[$,%\s,]/g, "");
}

function resetCrmDataValidations_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const specs = [
    { sheet: CRM_TABS.guests, column: "status", values: ["active", "inactive", "duplicate", "archived"] },
    { sheet: CRM_TABS.inquiries, column: "status", values: ["new", "contacted", "planning", "qualified", "quoted", "follow_up", "deposit_pending", "deposit_paid", "payment_pending", "booked", "completed", "cancelled", "did_not_book"] },
    { sheet: CRM_TABS.inquiries, column: "availability_status", values: ["pending", "available", "unavailable", "needs_check"] },
    { sheet: CRM_TABS.inquiries, column: "quote_status", values: ["not_sent", "sent", "revised", "accepted", "declined"] },
    { sheet: CRM_TABS.inquiries, column: "payment_status", values: ["unpaid", "deposit_pending", "deposit_paid", "partial", "paid", "refunded"] },
    { sheet: CRM_TABS.inquiries, column: "transportation_needed", values: ["Yes", "No", "Unknown"] },
    { sheet: CRM_TABS.inquiries, column: "quoted_currency", values: ["USD"] },
    { sheet: CRM_TABS.inquiries, column: "grouping_preference", values: ["unknown", "open_to_group", "private_only"] },
    { sheet: CRM_TABS.inquiries, column: "grouping_status", values: ["unmatched", "candidate", "invited", "accepted", "confirmed", "declined"] },
    { sheet: CRM_TABS.followups, column: "status", values: ["open", "completed", "cancelled", "failed"] },
    { sheet: CRM_TABS.followups, column: "channel", values: ["manual", "email", "telegram", "calendar"] },
    { sheet: CRM_TABS.followups, column: "send_status", values: ["pending", "sent", "skipped", "failed"] },
    { sheet: CRM_TABS.bookings, column: "booking_status", values: ["tentative", "deposit_pending", "deposit_paid", "booked", "completed", "cancelled"] },
    { sheet: CRM_TABS.payments, column: "payment_status", values: ["unpaid", "deposit_pending", "deposit_paid", "partial", "paid", "refunded"] }
  ];

  Object.keys(CRM_TABS).forEach(function(key) {
    const sh = ss.getSheetByName(CRM_TABS[key]);
    if (sh) sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  });

  specs.forEach(function(spec) {
    const sh = ss.getSheetByName(spec.sheet);
    if (!sh) return;
    const col = getColumnIndexByHeader_(sh, spec.column);
    if (!col || sh.getMaxRows() < 2) return;
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(spec.values, true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, col, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  });
}

function setupCrmInquiryPipelineFormatting_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) return;

  const lastCol = sh.getLastColumn();
  const maxRows = sh.getMaxRows();
  if (lastCol < 1 || maxRows < 2) return;

  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, lastCol)
    .setFontWeight("bold")
    .setBackground("#d9ead3")
    .setWrap(true);

  [
    "status", "followup_date", "next_action", "priority", "internal_notes",
    "availability_status", "quote_status", "payment_status", "quoted_amount",
    "quoted_currency", "quote_options_json", "quote_sent_at", "quote_sent_channel",
    "quote_notes", "confirmed_date", "completed_date", "lost_reason",
    "grouping_preference", "grouping_status", "departure_id"
  ].forEach(function(header) {
    const col = getColumnIndexByHeader_(sh, header);
    if (col) sh.getRange(1, col).setBackground("#fff2cc").setFontWeight("bold");
  });

  if (!sh.getFilter()) {
    sh.getRange(1, 1, Math.max(sh.getLastRow(), 2), lastCol).createFilter();
  }

  const statusCol = getColumnIndexByHeader_(sh, "status");
  const followupCol = getColumnIndexByHeader_(sh, "followup_date");
  const requestedCol = getColumnIndexByHeader_(sh, "requested_date_start");
  const priorityCol = getColumnIndexByHeader_(sh, "priority");
  const formatRange = sh.getRange(2, 1, maxRows - 1, lastCol);
  const rules = [];

  function statusRule(status, bg, fontColor) {
    if (!statusCol) return;
    let builder = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied("=$" + columnLetter_(statusCol) + "2=\"" + status + "\"")
      .setBackground(bg)
      .setRanges([formatRange]);
    if (fontColor) builder = builder.setFontColor(fontColor);
    rules.push(builder.build());
  }

  statusRule("new", "#fce5cd");
  statusRule("contacted", "#fff2cc");
  statusRule("planning", "#d9d2e9");
  statusRule("qualified", "#d9ead3");
  statusRule("quoted", "#cfe2f3");
  statusRule("follow_up", "#eadcf8");
  statusRule("deposit_pending", "#f9cb9c");
  statusRule("deposit_paid", "#b6d7a8");
  statusRule("booked", "#b7e1cd");
  statusRule("completed", "#38761d", "#ffffff");
  statusRule("cancelled", "#666666", "#ffffff");
  statusRule("did_not_book", "#f4cccc");

  if (followupCol) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied("=AND($" + columnLetter_(followupCol) + "2<>\"\",$" + columnLetter_(followupCol) + "2<=TODAY(),$" + columnLetter_(statusCol) + "2<>\"completed\",$" + columnLetter_(statusCol) + "2<>\"did_not_book\")")
      .setBackground("#f4cccc")
      .setRanges([sh.getRange(2, followupCol, maxRows - 1, 1)])
      .build());
  }

  if (priorityCol) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("urgent")
      .setBackground("#ea9999")
      .setRanges([sh.getRange(2, priorityCol, maxRows - 1, 1)])
      .build());
  }

  sh.setConditionalFormatRules(rules);

  [
    ["A", 160], ["B", 160], ["C", 145], ["D", 145], ["E", 130],
    ["J", 130], ["M", 120], ["N", 190], ["O", 90], ["R", 180],
    ["S", 220], ["U", 150], ["W", 120], ["Y", 180], ["AB", 180],
    ["AD", 220], ["AF", 180], ["AH", 320], ["AI", 260]
  ].forEach(function(item) {
    const col = columnNumber_(item[0]);
    if (col <= lastCol) sh.setColumnWidth(col, item[1]);
  });

  sh.getRange(2, 1, maxRows - 1, lastCol).setWrap(true);
}

function columnLetter_(column) {
  let temp = "";
  let letter = "";
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

function columnNumber_(letters) {
  return String(letters || "").toUpperCase().split("").reduce(function(sum, ch) {
    return sum * 26 + ch.charCodeAt(0) - 64;
  }, 0);
}

function getColumnIndexByHeader_(sh, headerName) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i] || "").trim() === headerName) return i + 1;
  }
  return 0;
}

function inferInitialStatus_(input) {
  const raw = clean_(input.rawStatus).toLowerCase();
  if (raw === "cancelled" || raw === "canceled") return "cancelled";
  if (raw === "completed") return "completed";
  if (raw === "booked") return "booked";
  if (raw === "not booked" || raw === "did not book" || raw === "lost" || raw === "did_not_book") return "did_not_book";
  if (raw === "deposit") return "deposit_pending";
  if (raw === "future") return "follow_up";
  if (raw === "pending") return "follow_up";
  return "new";
}

function inferInitialPaymentStatus_(input) {
  const status = inferInitialStatus_(input);
  if (status === "deposit_pending") return "deposit_pending";
  if (status === "deposit_paid") return "deposit_paid";
  return "unpaid";
}

function normalizePaymentStatus_(value) {
  const raw = clean_(value).toLowerCase();
  if (raw.indexOf("deposit paid") >= 0) return "deposit_paid";
  if (raw.indexOf("fully paid") >= 0) return "paid";
  if (raw.indexOf("balance") >= 0) return "partial";
  if (raw.indexOf("refund") >= 0) return "refunded";
  return "unpaid";
}

function normalizeTransportationNeeded_(value) {
  const raw = clean_(value).toLowerCase();
  if (!raw) return "Unknown";
  if (["yes", "y", "true"].indexOf(raw) >= 0 || raw.indexOf("quito") >= 0 || raw.indexOf("transport") >= 0 || raw.indexOf("pickup") >= 0) return "Yes";
  if (["no", "n", "false"].indexOf(raw) >= 0 || raw.indexOf("no transport") >= 0 || raw.indexOf("not needed") >= 0) return "No";
  if (raw.indexOf("unknown") >= 0 || raw.indexOf("unsure") >= 0 || raw.indexOf("not sure") >= 0) return "Unknown";
  return clean_(value);
}

function normalizeDateForSheet_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, getSheetTimeZone_(), "yyyy-MM-dd");
  }
  if (typeof value === "number" && isFinite(value)) {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Utilities.formatDate(d, getSheetTimeZone_(), "yyyy-MM-dd");
  }
  return parseTextDateToIso_(value);
}

function getSheetTimeZone_() {
  if (CACHED_SHEET_TIMEZONE) return CACHED_SHEET_TIMEZONE;
  try {
    CACHED_SHEET_TIMEZONE = SpreadsheetApp.openById(SPREADSHEET_ID).getSpreadsheetTimeZone() || Session.getScriptTimeZone() || CRM_TIMEZONE;
  } catch (error) {
    CACHED_SHEET_TIMEZONE = Session.getScriptTimeZone() || CRM_TIMEZONE;
  }
  return CACHED_SHEET_TIMEZONE;
}

function parseTextDateToIso_(value) {
  const text = clean_(value);
  if (!text) return "";

  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return [iso[1], pad2_(iso[2]), pad2_(iso[3])].join("-");

  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slash) return [slash[3], pad2_(slash[1]), pad2_(slash[2])].join("-");

  const monthMap = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12"
  };
  const wordDate = text.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\s+(20\d{2})\b/i);
  if (wordDate) {
    const month = monthMap[wordDate[1].toLowerCase()];
    if (month) return [wordDate[3], month, pad2_(wordDate[2])].join("-");
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, getSheetTimeZone_(), "yyyy-MM-dd");

  return "";
}

function pad2_(value) {
  return String(value || "").padStart(2, "0");
}

function normalizeDateTimeForSheet_(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, getSheetTimeZone_(), "yyyy-MM-dd HH:mm:ss");
  }
  if (typeof value === "number" && isFinite(value)) {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Utilities.formatDate(d, getSheetTimeZone_(), "yyyy-MM-dd HH:mm:ss");
  }
  const text = clean_(value);
  const isoDateOnly = text.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})$/);
  if (isoDateOnly) return [isoDateOnly[1], pad2_(isoDateOnly[2]), pad2_(isoDateOnly[3])].join("-") + " 00:00:00";
  const slashDateOnly = text.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (slashDateOnly) return [slashDateOnly[3], pad2_(slashDateOnly[1]), pad2_(slashDateOnly[2])].join("-") + " 00:00:00";
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, getSheetTimeZone_(), "yyyy-MM-dd HH:mm:ss");
  }
  return text;
}

function chooseEarliestDateTime_(a, b) {
  const aa = normalizeDateTimeForSheet_(a);
  const bb = normalizeDateTimeForSheet_(b);
  if (!aa) return bb;
  if (!bb) return aa;
  return aa <= bb ? aa : bb;
}

function chooseLatestDateTime_(a, b) {
  const aa = normalizeDateTimeForSheet_(a);
  const bb = normalizeDateTimeForSheet_(b);
  if (!aa) return bb;
  if (!bb) return aa;
  return aa >= bb ? aa : bb;
}

function valueForSheet_(sheetName, header, value) {
  const v = normalizeValidatedField_(sheetName, header, value);
  const h = String(header || "").toLowerCase();
  if (h.indexOf("phone") >= 0 || h.indexOf("id") >= 0) return "'" + String(v);
  return v;
}

function normalizeValidatedField_(sheetName, header, value) {
  const text = clean_(value);
  if (!text) return "";

  const sheetRules = CRM_FIELD_VALUES[sheetName] || {};
  const rule = sheetRules[String(header || "")];
  if (!rule) return value === null || value === undefined ? "" : value;

  const normalized = text.toLowerCase().replace(/[\s-]+/g, "_");
  if (String(header || "") === "status" && normalized === "lost") return "did_not_book";
  if (String(header || "") === "status" && normalized === "did_not_book") return "did_not_book";
  if (String(header || "") === "transportation_needed") {
    if (["yes", "y", "true", "needed"].indexOf(normalized) >= 0) return "Yes";
    if (["no", "n", "false", "not_needed"].indexOf(normalized) >= 0) return "No";
    if (["unknown", "unsure", "not_sure", "maybe", "pending"].indexOf(normalized) >= 0) return "Unknown";
  }
  if (String(header || "") === "quoted_currency") return "USD";

  const allowed = {};
  rule.values.forEach(function(item) {
    allowed[String(item).toLowerCase().replace(/[\s-]+/g, "_")] = item;
  });
  return allowed[normalized] || rule.fallback;
}

function cleanCrmValidationValues() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(CRM_FIELD_VALUES).forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;

    const rows = getObjectsWithRowNumbers_(sh);
    rows.forEach(function(item) {
      const cleaned = Object.assign({}, item.row);
      Object.keys(CRM_FIELD_VALUES[sheetName]).forEach(function(header) {
        cleaned[header] = normalizeValidatedField_(sheetName, header, item.row[header]);
      });
      writeObjectToRow_(sh, item.rowNumber, cleaned);
    });
  });
}

function prepareCrmForAutomation() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);
  resetCrmDataValidations_();
  normalizeCrmDateFieldsAndActions();
  syncCrmFollowupQueue();
  detectScheduleConflictsToFollowups();
  createCrmViewTabs();
  formatCrmDateColumns_();
  sortCrmInquiriesByCreatedAtDesc();
}

function normalizeCrmDateFieldsAndActions() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const inquiries = ss.getSheetByName(CRM_TABS.inquiries);
  const bookings = ss.getSheetByName(CRM_TABS.bookings);
  const payments = ss.getSheetByName(CRM_TABS.payments);
  if (!inquiries) return;

  const inquiryUpdates = [];
  const manualFollowupRows = [];
  const inquiryRowCount = Math.max(0, inquiries.getLastRow() - 1);
  const statusCol = getColumnIndexByHeader_(inquiries, "status");
  const followupCol = getColumnIndexByHeader_(inquiries, "followup_date");
  const requestedStartCol = getColumnIndexByHeader_(inquiries, "requested_date_start");
  const requestedEndCol = getColumnIndexByHeader_(inquiries, "requested_date_end");
  const statusNotes = statusCol && inquiryRowCount ? inquiries.getRange(2, statusCol, inquiryRowCount, 1).getNotes() : [];
  const followupNotes = followupCol && inquiryRowCount ? inquiries.getRange(2, followupCol, inquiryRowCount, 1).getNotes() : [];
  const requestedStartNotes = requestedStartCol && inquiryRowCount ? inquiries.getRange(2, requestedStartCol, inquiryRowCount, 1).getNotes() : [];
  const requestedEndNotes = requestedEndCol && inquiryRowCount ? inquiries.getRange(2, requestedEndCol, inquiryRowCount, 1).getNotes() : [];
  getObjectsWithRowNumbers_(inquiries).forEach(function(item) {
    const row = item.row;
    const noteIndex = item.rowNumber - 2;
    const dateManual = clean_(requestedStartNotes[noteIndex] && requestedStartNotes[noteIndex][0]).indexOf(MANUAL_REQUESTED_DATE_OVERRIDE_NOTE) >= 0 ||
      clean_(requestedEndNotes[noteIndex] && requestedEndNotes[noteIndex][0]).indexOf(MANUAL_REQUESTED_DATE_OVERRIDE_NOTE) >= 0;
    const dateRange = bestInquiryDateRange_(row, inquiries, item.rowNumber, dateManual);
    const statusManual = clean_(statusNotes[noteIndex] && statusNotes[noteIndex][0]).indexOf(MANUAL_STATUS_OVERRIDE_NOTE) >= 0;
    const aligned = statusManual ? row : alignInquiryStatusFromSubstatuses_(row, dateRange);
    const action = nextActionForInquiry_(aligned, dateRange);
    const followupManual = clean_(followupNotes[noteIndex] && followupNotes[noteIndex][0]).indexOf(MANUAL_FOLLOWUP_OVERRIDE_NOTE) >= 0;
    const updated = Object.assign({}, row, {
      status: normalizeValidatedField_(CRM_TABS.inquiries, "status", aligned.status),
      updated_at: nowIso_(),
      requested_date_start: dateRange.start,
      requested_date_end: dateRange.end,
      transportation_needed: normalizeValidatedField_(CRM_TABS.inquiries, "transportation_needed", aligned.transportation_needed || row.transportation_needed || "Unknown"),
      grouping_preference: normalizeValidatedField_(CRM_TABS.inquiries, "grouping_preference", row.grouping_preference || "unknown"),
      grouping_status: normalizeValidatedField_(CRM_TABS.inquiries, "grouping_status", row.grouping_status || "unmatched"),
      followup_date: followupManual ? normalizeDateForSheet_(row.followup_date) : action.followupDate,
      next_action: action.action,
      priority: inferPriority_(dateRange.start),
      quoted_currency: "USD"
    });
    inquiryUpdates.push({ rowNumber: item.rowNumber, row: updated });
    if (followupManual) {
      manualFollowupRows.push(item.rowNumber);
    }
  });
  writeObjectsToRowsBatch_(inquiries, inquiryUpdates);
  if (followupCol) {
    manualFollowupRows.forEach(function(rowNumber) {
      inquiries.getRange(rowNumber, followupCol).setNote(MANUAL_FOLLOWUP_OVERRIDE_NOTE);
    });
  }

  if (bookings) {
    const bookingUpdates = [];
    getObjectsWithRowNumbers_(bookings).forEach(function(item) {
      const start = normalizeDateForSheet_(item.row.tour_date_start || item.row.tour_date_text);
      const end = normalizeDateForSheet_(item.row.tour_date_end || start);
      const updated = Object.assign({}, item.row, {
        tour_date_start: start,
        tour_date_end: end || start,
        tour_date_text: start && end && start !== end ? start + " to " + end : start || item.row.tour_date_text
      });
      bookingUpdates.push({ rowNumber: item.rowNumber, row: updated });
    });
    writeObjectsToRowsBatch_(bookings, bookingUpdates);
  }

  if (payments) {
    const paymentUpdates = [];
    getObjectsWithRowNumbers_(payments).forEach(function(item) {
      const updated = Object.assign({}, item.row, {
        payment_date: normalizeDateForSheet_(item.row.payment_date)
      });
      paymentUpdates.push({ rowNumber: item.rowNumber, row: updated });
    });
    writeObjectsToRowsBatch_(payments, paymentUpdates);
  }
}

function syncCrmFollowupQueue() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return reconcileCrmFollowupQueue_(ss);
}

function reconcileCrmFollowupQueue_(ss) {
  const inquiries = ss.getSheetByName(CRM_TABS.inquiries);
  const followups = ss.getSheetByName(CRM_TABS.followups);
  if (!inquiries || !followups) return { openTasks: 0, closedTasks: 0, removedTasks: 0 };

  const inquiryItems = getObjectsWithRowNumbers_(inquiries);
  const existingRows = getObjects_(followups);
  const existingByKey = {};
  const scheduleConflictRows = [];

  existingRows.forEach(function(row) {
    if (clean_(row.followup_type) === "schedule_conflict") {
      if (clean_(row.status) === "open") scheduleConflictRows.push(row);
      return;
    }
    const inquiryId = clean_(row.inquiry_id);
    const followupType = clean_(row.followup_type);
    if (!inquiryId || !followupType) return;
    const key = inquiryId + "||" + followupType;
    if (!existingByKey[key]) existingByKey[key] = [];
    existingByKey[key].push(row);
  });

  const desiredRows = [];
  let closedTasks = 0;
  inquiryItems.forEach(function(item) {
    const row = item.row;
    const inquiryId = clean_(row.inquiry_id);
    if (!inquiryId) return;
    if (clean_(row.status) === "duplicate" || clean_(row.is_archived).toLowerCase() === "yes") return;

    const dateRange = bestInquiryDateRange_(row, inquiries, item.rowNumber);
    const aligned = isManualStatusOverride_(inquiries, item.rowNumber)
      ? row
      : alignInquiryStatusFromSubstatuses_(row, dateRange);
    const action = nextActionForInquiry_(aligned, dateRange);
    if (!action.followupDate || !action.followupType) return;
    if (["did_not_book", "lost"].indexOf(clean_(aligned.status)) >= 0) return;

    const key = inquiryId + "||" + clean_(action.followupType);
    const candidates = existingByKey[key] || [];
    const closed = candidates.find(function(existing) {
      return clean_(existing.status) === "completed" ||
        clean_(existing.send_status) === "sent";
    });

    if (closed) {
      desiredRows.push(closed);
      closedTasks++;
      return;
    }

    const existingOpen = candidates.find(function(existing) {
      return clean_(existing.status) === "open";
    });
    desiredRows.push(buildFollowupRow_(aligned, action, existingOpen));
  });

  const rebuiltRows = scheduleConflictRows.concat(desiredRows);
  const removedTasks = Math.max(0, existingRows.length - rebuiltRows.length);
  replaceSheetBodyWithObjects_(followups, rebuiltRows);

  return {
    openTasks: desiredRows.filter(function(row) { return clean_(row.status) === "open"; }).length,
    closedTasks: closedTasks,
    removedTasks: removedTasks
  };
}

function buildFollowupRow_(inquiry, action, existing) {
  return {
    followup_id: existing && existing.followup_id ? existing.followup_id : makeId_("FU"),
    inquiry_id: inquiry.inquiry_id,
    guest_id: inquiry.guest_id,
    created_at: existing && existing.created_at ? existing.created_at : nowIso_(),
    due_at: action.followupDate,
    completed_at: "",
    status: "open",
    followup_type: action.followupType,
    assigned_to: inquiry.assigned_to,
    email_template: action.emailTemplate,
    calendar_event_id: existing && existing.calendar_event_id ? existing.calendar_event_id : "",
    subject: action.action + ": " + inquiry.full_name,
    notes: inquiry.next_action || action.action,
    last_error: "",
    channel: action.channel || (action.emailTemplate ? "email" : "telegram"),
    send_status: "pending",
    send_after: action.followupDate,
    template_key: action.emailTemplate || action.followupType
  };
}

function replaceSheetBodyWithObjects_(sh, objects) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow > 1 && lastCol > 0) {
    sh.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
  if (!objects.length || !lastCol) return;
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const sheetName = sh.getName();
  const values = objects.map(function(obj) {
    return headers.map(function(header) {
      return obj[header] !== undefined ? valueForSheet_(sheetName, header, obj[header]) : "";
    });
  });
  sh.getRange(2, 1, values.length, lastCol).setValues(values);
}

function bestInquiryDateRange_(row, sh, rowNumber, knownManualOverride) {
  const parsed = parseDateRange_(row.requested_date_text);
  const startValue = normalizeDateForSheet_(row.requested_date_start);
  const endValue = normalizeDateForSheet_(row.requested_date_end);
  const manualOverride = knownManualOverride !== undefined
    ? Boolean(knownManualOverride)
    : Boolean(sh && rowNumber && isManualRequestedDateOverride_(sh, rowNumber));
  const parsedHasDate = Boolean(parsed.start);
  const preferText = parsedHasDate && !manualOverride;
  let start = preferText ? (parsed.start || startValue) : (startValue || parsed.start);
  let end = preferText ? (parsed.end || endValue || start) : (endValue || parsed.end || start);
  if (start && end && end < start) {
    const temp = start;
    start = end;
    end = temp;
  }
  return {
    start: start,
    end: end || start
  };
}

function nextActionForInquiry_(row, dateRange) {
  const status = clean_(row.status) || "new";
  const today = todayIso_();
  const baseDate = normalizeDateForSheet_(row.last_contacted_at) ||
    normalizeDateForSheet_(row.stage_changed_at) ||
    normalizeDateForSheet_(row.updated_at) ||
    today;

  if (status === "duplicate" || clean_(row.is_archived).toLowerCase() === "yes") return blankAction_("No action - archived duplicate");
  if (status === "did_not_book" || status === "lost") return blankAction_("No action - did not book");
  if (status === "cancelled") {
    if (clean_(row.payment_status) === "refunded") return blankAction_("No action - cancelled and refunded");
    return {
      action: "Review cancellation and payment disposition",
      followupDate: today,
      followupType: "cancellation_review",
      emailTemplate: "",
      channel: "manual"
    };
  }
  if (status === "completed") {
    const completedDate = normalizeDateForSheet_(row.completed_date) ||
      normalizeDateForSheet_(dateRange && dateRange.end) ||
      normalizeDateForSheet_(row.stage_changed_at);
    if (!completedDate) return blankAction_("No review follow-up date");
    const ageDays = daysBetweenIso_(completedDate, today);
    if (ageDays < 0 || ageDays > 14) return blankAction_("Review window closed");
    return {
      action: "Send thank-you/review request",
      followupDate: addDaysIso_(completedDate, 1),
      followupType: "review_request",
      emailTemplate: "review",
      channel: "email"
    };
  }
  if (status === "booked") {
    const pretourDate = dateRange.start ? addDaysIso_(dateRange.start, -7) : today;
    return { action: "Send pre-tour details", followupDate: maxIsoDate_(today, pretourDate), followupType: "pretour_details", emailTemplate: "pretour", channel: "email" };
  }
  if (status === "deposit_paid") return { action: "Confirm logistics and calendar event", followupDate: today, followupType: "booking_ops", emailTemplate: "", channel: "telegram" };
  if (status === "deposit_pending") return { action: "Send deposit/payment reminder", followupDate: addDaysIso_(baseDate, 1), followupType: "payment_followup", emailTemplate: "deposit_reminder", channel: "email" };
  if (status === "quoted" && clean_(row.quote_status) === "accepted" && clean_(row.payment_status) === "unpaid") {
    return { action: "Send deposit/payment instructions", followupDate: today, followupType: "payment_request", emailTemplate: "payment_request", channel: "email" };
  }
  if (status === "quoted") return { action: "Follow up on quote if no reply", followupDate: addDaysIso_(baseDate, 3), followupType: "quote_followup", emailTemplate: "quote_followup", channel: "email" };
  if (status === "qualified") return { action: "Send quote", followupDate: today, followupType: "send_quote", emailTemplate: "quote", channel: "manual" };
  if (status === "planning") return { action: "Prepare and send itinerary options", followupDate: addDaysIso_(baseDate, 3), followupType: "itinerary_planning", emailTemplate: "", channel: "manual" };
  if (status === "contacted") return { action: "Follow up if no reply", followupDate: addDaysIso_(baseDate, 2), followupType: "guest_followup", emailTemplate: "contacted_followup", channel: "email" };
  if (status === "follow_up") return { action: "Send follow-up", followupDate: today, followupType: "guest_followup", emailTemplate: "general_followup", channel: "email" };
  return { action: "Review inquiry and reply", followupDate: today, followupType: "internal_review", emailTemplate: "", channel: "telegram" };
}

function alignInquiryStatusFromSubstatuses_(row, dateRange) {
  const status = clean_(row.status) || "new";
  const quoteStatus = clean_(row.quote_status);
  const paymentStatus = clean_(row.payment_status);
  const tourDate = normalizeDateForSheet_(dateRange && dateRange.start);
  const today = todayIso_();

  if (status === "duplicate" || clean_(row.is_archived).toLowerCase() === "yes") return Object.assign({}, row, { status: "duplicate" });
  if (status === "did_not_book" || status === "lost") return Object.assign({}, row, { status: "did_not_book" });
  if (status === "cancelled") return row;
  if (status === "completed" && tourDate && tourDate > today) {
    return Object.assign({}, row, { status: "booked" });
  }
  if (status === "completed") return row;

  if (paymentStatus === "paid") {
    return Object.assign({}, row, {
      status: tourDate && tourDate < today ? "completed" : "booked"
    });
  }

  if (paymentStatus === "deposit_paid" || paymentStatus === "partial") {
    return Object.assign({}, row, { status: "deposit_paid" });
  }

  if (paymentStatus === "deposit_pending") {
    return Object.assign({}, row, { status: "deposit_pending" });
  }

  if (status === "quoted" && quoteStatus === "accepted" && paymentStatus === "unpaid") {
    return row;
  }

  return row;
}

function blankAction_(action) {
  return { action: action, followupDate: "", followupType: "", emailTemplate: "", channel: "manual" };
}

function daysBetweenIso_(startIso, endIso) {
  const start = normalizeDateForSheet_(startIso);
  const end = normalizeDateForSheet_(endIso);
  if (!start || !end) return 0;
  return Math.floor((parseIsoDate_(end).getTime() - parseIsoDate_(start).getTime()) / 86400000);
}

function isManualFollowupOverride_(sh, rowNumber) {
  const followupCol = getColumnIndexByHeader_(sh, "followup_date");
  if (!followupCol) return false;
  return clean_(sh.getRange(rowNumber, followupCol).getNote()).indexOf(MANUAL_FOLLOWUP_OVERRIDE_NOTE) >= 0;
}

function isManualStatusOverride_(sh, rowNumber) {
  const statusCol = getColumnIndexByHeader_(sh, "status");
  if (!statusCol) return false;
  return clean_(sh.getRange(rowNumber, statusCol).getNote()).indexOf(MANUAL_STATUS_OVERRIDE_NOTE) >= 0;
}

function isManualRequestedDateOverride_(sh, rowNumber) {
  const startCol = getColumnIndexByHeader_(sh, "requested_date_start");
  const endCol = getColumnIndexByHeader_(sh, "requested_date_end");
  const startNote = startCol ? clean_(sh.getRange(rowNumber, startCol).getNote()) : "";
  const endNote = endCol ? clean_(sh.getRange(rowNumber, endCol).getNote()) : "";
  return startNote.indexOf(MANUAL_REQUESTED_DATE_OVERRIDE_NOTE) >= 0 ||
    endNote.indexOf(MANUAL_REQUESTED_DATE_OVERRIDE_NOTE) >= 0;
}

function upsertFollowupForInquiry_(ss, inquiry, action) {
  return reconcileCrmFollowupQueue_(ss);
}

function cancelStaleOpenFollowupsForInquiry_(sh, rows, inquiry, action) {
  const inquiryId = clean_(inquiry && inquiry.inquiry_id);
  if (!inquiryId) return;

  const currentType = clean_(action && action.followupType);
  const terminalStatus = {
    did_not_book: true,
    lost: true,
    completed: true
  };
  const status = clean_(inquiry.status);
  const shouldCancelAll = terminalStatus[status] || !currentType;

  rows.forEach(function(item) {
    if (clean_(item.row.inquiry_id) !== inquiryId) return;
    if (clean_(item.row.status) !== "open") return;
    if (clean_(item.row.followup_type) === "schedule_conflict") return;
    if (!shouldCancelAll && clean_(item.row.followup_type) === currentType) return;

    const reason = shouldCancelAll
      ? "Cancelled because inquiry status is now " + (status || "no-action") + "."
      : "Cancelled because next action changed to " + currentType + ".";
    const updated = Object.assign({}, item.row, {
      status: "cancelled",
      completed_at: nowIso_(),
      send_status: "skipped",
      notes: mergeNotes_(item.row.notes, reason)
    });
    writeObjectToRow_(sh, item.rowNumber, updated);
  });
}

function detectScheduleConflictsToFollowups() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const inquiries = ss.getSheetByName(CRM_TABS.inquiries);
  const followups = ss.getSheetByName(CRM_TABS.followups);
  if (!inquiries || !followups) return;

  cancelOpenScheduleConflictFollowups_(followups);

  const activeStatuses = {
    qualified: true,
    quoted: true,
    deposit_pending: true,
    deposit_paid: true,
    booked: true
  };
  const byDate = {};

  getObjectsWithRowNumbers_(inquiries).forEach(function(item) {
    const row = item.row;
    if (!activeStatuses[clean_(row.status)]) return;
    const range = bestInquiryDateRange_(row, inquiries, item.rowNumber);
    if (!range.start) return;
    expandDateRange_(range.start, range.end || range.start).forEach(function(dateIso) {
      if (!byDate[dateIso]) byDate[dateIso] = [];
      byDate[dateIso].push(row);
    });
  });

  Object.keys(byDate).sort().forEach(function(dateIso) {
    const items = byDate[dateIso];
    if (items.length < 2) return;
    const names = items.map(function(row) {
      return (row.full_name || row.email || row.inquiry_id) + " [" + row.status + "]";
    }).join("; ");

    appendObject_(followups, {
      followup_id: makeId_("FU"),
      inquiry_id: "",
      guest_id: "",
      created_at: nowIso_(),
      due_at: todayIso_(),
      completed_at: "",
      status: "open",
      followup_type: "schedule_conflict",
      assigned_to: "",
      email_template: "",
      calendar_event_id: "",
      subject: "Schedule conflict check: " + dateIso,
      notes: items.length + " active inquiries/bookings overlap on " + dateIso + ": " + names,
      last_error: "",
      channel: "telegram",
      send_status: "pending",
      send_after: todayIso_(),
      template_key: "schedule_conflict"
    });
  });
}

function cancelOpenScheduleConflictFollowups_(followupsSheet) {
  getObjectsWithRowNumbers_(followupsSheet)
    .filter(function(item) {
      return clean_(item.row.followup_type) === "schedule_conflict";
    })
    .map(function(item) { return item.rowNumber; })
    .sort(function(a, b) { return b - a; })
    .forEach(function(rowNumber) {
      followupsSheet.deleteRow(rowNumber);
  });
}

function createCrmViewTabs() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const views = [
    {
      name: "crm_view_active_pipeline",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",crm_inquiries!J2:J<>\"completed\",crm_inquiries!J2:J<>\"cancelled\",crm_inquiries!J2:J<>\"did_not_book\",crm_inquiries!A2:A<>\"\"),3,FALSE),\"\")"
    },
    {
      name: "crm_view_new_inquiries",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",crm_inquiries!J2:J=\"new\"),3,FALSE),\"\")"
    },
    {
      name: "crm_view_planning",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",crm_inquiries!J2:J=\"planning\"),13,TRUE),\"\")"
    },
    {
      name: "crm_view_group_opportunities",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",crm_inquiries!AS2:AS=\"open_to_group\",crm_inquiries!Z2:Z=1,crm_inquiries!W2:W>=TODAY(),crm_inquiries!J2:J<>\"completed\",crm_inquiries!J2:J<>\"cancelled\",crm_inquiries!J2:J<>\"did_not_book\",crm_inquiries!AU2:AU=\"\"),23,TRUE),\"\")"
    },
    {
      name: "crm_view_follow_up_today",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",crm_inquiries!M2:M<>\"\",crm_inquiries!M2:M<=TODAY(),crm_inquiries!J2:J<>\"completed\",crm_inquiries!J2:J<>\"cancelled\",crm_inquiries!J2:J<>\"did_not_book\"),13,TRUE),\"\")"
    },
    {
      name: "crm_view_quote_sent_awaiting_reply",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",crm_inquiries!J2:J=\"quoted\",crm_inquiries!AK2:AK=\"sent\",crm_inquiries!AL2:AL=\"unpaid\"),13,TRUE),\"\")"
    },
    {
      name: "crm_view_accepted_needs_payment",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",crm_inquiries!J2:J=\"quoted\",crm_inquiries!AK2:AK=\"accepted\",crm_inquiries!AL2:AL=\"unpaid\"),13,TRUE),\"\")"
    },
    {
      name: "crm_view_deposit_pending",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",(crm_inquiries!J2:J=\"deposit_pending\")+(crm_inquiries!AL2:AL=\"deposit_pending\")),13,TRUE),\"\")"
    },
    {
      name: "crm_view_paid_needs_status_cleanup",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",crm_inquiries!J2:J=\"quoted\",(crm_inquiries!AL2:AL=\"deposit_paid\")+(crm_inquiries!AL2:AL=\"partial\")+(crm_inquiries!AL2:AL=\"paid\")),23,TRUE),\"\")"
    },
    {
      name: "crm_view_confirm_logistics",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",(crm_inquiries!J2:J=\"deposit_paid\")+(crm_inquiries!AL2:AL=\"deposit_paid\")+(crm_inquiries!AL2:AL=\"partial\"),crm_inquiries!J2:J<>\"booked\",crm_inquiries!J2:J<>\"completed\",crm_inquiries!J2:J<>\"cancelled\",crm_inquiries!J2:J<>\"did_not_book\"),23,TRUE),\"\")"
    },
    {
      name: "crm_view_upcoming_tours",
      sourceHeaders: CRM_HEADERS.crm_inquiries,
      formula: "=IFERROR(SORT(FILTER(crm_inquiries!A2:BU,crm_inquiries!BD2:BD<>\"Yes\",crm_inquiries!J2:J<>\"duplicate\",(crm_inquiries!J2:J=\"deposit_paid\")+(crm_inquiries!J2:J=\"booked\"),crm_inquiries!W2:W>=TODAY()),23,TRUE),\"\")"
    },
    {
      name: "crm_view_schedule_conflicts",
      sourceHeaders: CRM_HEADERS.crm_followups,
      formula: "=IFERROR(SORT(FILTER(crm_followups!A2:R,crm_followups!H2:H=\"schedule_conflict\",crm_followups!G2:G=\"open\"),5,TRUE),\"\")"
    }
  ];

  views.forEach(function(view) {
    const sh = ensureViewSheet_(ss, view.name);
    sh.clear();
    sh.getRange(1, 1, 1, view.sourceHeaders.length).setValues([view.sourceHeaders]);
    sh.getRange(1, 1, 1, view.sourceHeaders.length).setFontWeight("bold");
    sh.getRange(2, 1).setFormula(view.formula);
    sh.setFrozenRows(1);
    applyDateFormatsForHeaders_(sh, view.sourceHeaders);
  });
}

function createPipelineReviewView() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);
  const sh = ensureSheetWithHeaders_(ss, CRM_PIPELINE_REVIEW_TAB, CRM_PIPELINE_REVIEW_HEADERS);
  sh.getRange(1, 1, 1, CRM_PIPELINE_REVIEW_HEADERS.length).setValues([CRM_PIPELINE_REVIEW_HEADERS]);
  refreshPipelineReview();
}

function refreshPipelineReview() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const inquiries = ss.getSheetByName(CRM_TABS.inquiries);
  if (!inquiries) return;

  const review = ensureSheetWithHeaders_(ss, CRM_PIPELINE_REVIEW_TAB, CRM_PIPELINE_REVIEW_HEADERS);
  review.getRange(1, 1, 1, CRM_PIPELINE_REVIEW_HEADERS.length).setValues([CRM_PIPELINE_REVIEW_HEADERS]);
  const lastRow = review.getLastRow();
  if (lastRow > 1) {
    review.getRange(2, 1, lastRow - 1, Math.max(review.getLastColumn(), CRM_PIPELINE_REVIEW_HEADERS.length)).clearContent().clearNote();
  }

  const active = {};
  CRM_PIPELINE_REVIEW_ACTIVE_STATUSES.forEach(function(status) {
    active[status] = true;
  });

  const rows = getObjectsWithRowNumbers_(inquiries)
    .filter(function(item) {
      return clean_(item.row.inquiry_id) && active[clean_(item.row.status)];
    })
    .sort(comparePipelineReviewRows_);

  if (rows.length) {
    const values = rows.map(function(item) {
      return CRM_PIPELINE_REVIEW_HEADERS.map(function(header) {
        if (header === "last_contacted_at") return normalizeDateForSheet_(item.row[header]);
        if (header === "requested_date_start" || header === "requested_date_end" || header === "followup_date") {
          return normalizeDateForSheet_(item.row[header]);
        }
        return item.row[header] || "";
      });
    });
    review.getRange(2, 1, values.length, CRM_PIPELINE_REVIEW_HEADERS.length).setValues(values);
  }

  formatPipelineReviewSheet_(review);
}

function comparePipelineReviewRows_(a, b) {
  const createdA = clean_(a.row.created_at);
  const createdB = clean_(b.row.created_at);
  if (createdA !== createdB) return createdA > createdB ? -1 : 1;

  const requestedA = clean_(a.row.requested_date_start) || "9999-12-31";
  const requestedB = clean_(b.row.requested_date_start) || "9999-12-31";
  if (requestedA !== requestedB) return requestedA < requestedB ? -1 : 1;

  const followupA = clean_(a.row.followup_date) || "9999-12-31";
  const followupB = clean_(b.row.followup_date) || "9999-12-31";
  if (followupA !== followupB) return followupA < followupB ? -1 : 1;
  return 0;
}

function formatPipelineReviewSheet_(sh) {
  const lastCol = CRM_PIPELINE_REVIEW_HEADERS.length;
  const maxRows = Math.max(sh.getMaxRows(), 2);

  sh.setFrozenRows(1);
  sh.setFrozenColumns(12);
  sh.hideColumns(1);
  sh.getRange(1, 1, 1, lastCol)
    .setFontWeight("bold")
    .setBackground("#d9ead3")
    .setWrap(true);

  ["status", "last_contacted_at", "followup_date", "next_action", "priority", "requested_date_start", "requested_date_end", "grouping_preference", "grouping_status"].forEach(function(header) {
    const col = getColumnIndexByHeader_(sh, header);
    if (col) sh.getRange(1, col).setBackground("#fff2cc").setFontWeight("bold");
  });

  applyPipelineReviewValidations_(sh);
  applyPipelineReviewConditionalFormatting_(sh);
  applyPipelineReviewColumnWidths_(sh);
  applyPipelineReviewDateFormats_(sh);

  const existingFilter = sh.getFilter();
  if (existingFilter) existingFilter.remove();
  sh.getRange(1, 1, Math.max(sh.getLastRow(), 2), lastCol).createFilter();
}

function applyPipelineReviewValidations_(sh) {
  const maxRows = Math.max(sh.getMaxRows() - 1, 1);
  const specs = [
    { column: "status", values: CRM_FIELD_VALUES.crm_inquiries.status.values },
    { column: "priority", values: ["normal", "high", "urgent"] },
    { column: "transportation_needed", values: CRM_FIELD_VALUES.crm_inquiries.transportation_needed.values },
    { column: "grouping_preference", values: CRM_FIELD_VALUES.crm_inquiries.grouping_preference.values },
    { column: "grouping_status", values: CRM_FIELD_VALUES.crm_inquiries.grouping_status.values }
  ];

  specs.forEach(function(spec) {
    const col = getColumnIndexByHeader_(sh, spec.column);
    if (!col) return;
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(spec.values, true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, col, maxRows, 1).setDataValidation(rule);
  });
}

function applyPipelineReviewConditionalFormatting_(sh) {
  const maxRows = Math.max(sh.getMaxRows() - 1, 1);
  const lastCol = CRM_PIPELINE_REVIEW_HEADERS.length;
  const statusCol = getColumnIndexByHeader_(sh, "status");
  const followupCol = getColumnIndexByHeader_(sh, "followup_date");
  const requestedStartCol = getColumnIndexByHeader_(sh, "requested_date_start");
  const priorityCol = getColumnIndexByHeader_(sh, "priority");
  const groupingStatusCol = getColumnIndexByHeader_(sh, "grouping_status");
  const statusRanges = buildPipelineReviewStatusFormatRanges_(sh, maxRows, lastCol, [
    followupCol,
    requestedStartCol,
    priorityCol,
    groupingStatusCol
  ]);
  const rules = [];

  function statusRule(status, bg, fontColor) {
    if (!statusCol) return;
    let builder = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied("=$" + columnLetter_(statusCol) + "2=\"" + status + "\"")
      .setBackground(bg)
      .setRanges(statusRanges);
    if (fontColor) builder = builder.setFontColor(fontColor);
    rules.push(builder.build());
  }

  statusRule("new", "#fce5cd");
  statusRule("contacted", "#fff2cc");
  statusRule("planning", "#d9d2e9");
  statusRule("qualified", "#d9ead3");
  statusRule("quoted", "#cfe2f3");
  statusRule("follow_up", "#eadcf8");
  statusRule("deposit_pending", "#f9cb9c");
  statusRule("deposit_paid", "#b6d7a8");
  statusRule("booked", "#b7e1cd");

  if (followupCol && statusCol) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied("=AND($" + columnLetter_(followupCol) + "2<>\"\",$" + columnLetter_(followupCol) + "2<=TODAY())")
      .setBackground("#f4cccc")
      .setRanges([sh.getRange(2, followupCol, maxRows, 1)])
      .build());
  }

  if (requestedStartCol) {
    const requestedStartLetter = columnLetter_(requestedStartCol);
    const requestedStartRange = sh.getRange(2, requestedStartCol, maxRows, 1);
    [
      {
        formula: "=AND($" + requestedStartLetter + "2<>\"\",$" + requestedStartLetter + "2<TODAY()+7)",
        background: "#f4cccc"
      },
      {
        formula: "=AND($" + requestedStartLetter + "2>=TODAY()+7,$" + requestedStartLetter + "2<=TODAY()+21)",
        background: "#fce5cd"
      },
      {
        formula: "=AND($" + requestedStartLetter + "2>TODAY()+21,$" + requestedStartLetter + "2<=TODAY()+31)",
        background: "#fff2cc"
      },
      {
        formula: "=AND($" + requestedStartLetter + "2>TODAY()+31,$" + requestedStartLetter + "2<=EDATE(TODAY(),3))",
        background: "#d9ead3"
      },
      {
        formula: "=AND($" + requestedStartLetter + "2>EDATE(TODAY(),3))",
        background: "#d9eaf7"
      }
    ].forEach(function(spec) {
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied(spec.formula)
        .setBackground(spec.background)
        .setRanges([requestedStartRange])
        .build());
    });
  }

  if (priorityCol) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("urgent")
      .setBackground("#ea9999")
      .setRanges([sh.getRange(2, priorityCol, maxRows, 1)])
      .build());
  }

  if (groupingStatusCol) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("candidate")
      .setBackground("#d9ead3")
      .setRanges([sh.getRange(2, groupingStatusCol, maxRows, 1)])
      .build());
  }

  sh.setConditionalFormatRules(rules);
}

function buildPipelineReviewStatusFormatRanges_(sh, maxRows, lastCol, excludedCols) {
  const excluded = {};
  (excludedCols || []).forEach(function(col) {
    if (col) excluded[col] = true;
  });

  const ranges = [];
  let startCol = 1;
  for (let col = 1; col <= lastCol + 1; col++) {
    if (col <= lastCol && !excluded[col]) continue;
    if (startCol < col) ranges.push(sh.getRange(2, startCol, maxRows, col - startCol));
    startCol = col + 1;
  }
  return ranges.length ? ranges : [sh.getRange(2, 1, maxRows, lastCol)];
}

function applyPipelineReviewColumnWidths_(sh) {
  [
    ["A", 120], ["B", 145], ["C", 145], ["D", 110], ["E", 85], ["F", 130],
    ["G", 120], ["H", 120], ["I", 220], ["J", 90], ["K", 130], ["L", 130],
    ["M", 190], ["N", 220], ["O", 145], ["P", 120], ["Q", 120], ["R", 180],
    ["S", 90], ["T", 160], ["U", 160], ["V", 150], ["W", 135], ["X", 180],
    ["Y", 145], ["Z", 180], ["AA", 220], ["AB", 320]
  ].forEach(function(item) {
    sh.setColumnWidth(columnNumber_(item[0]), item[1]);
  });
}

function applyPipelineReviewDateFormats_(sh) {
  ["created_at", "updated_at"].forEach(function(header) {
    const col = getColumnIndexByHeader_(sh, header);
    if (col) sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  });
  ["last_contacted_at", "followup_date", "requested_date_start", "requested_date_end"].forEach(function(header) {
    const col = getColumnIndexByHeader_(sh, header);
    if (col) sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat("yyyy-mm-dd");
  });
}

function syncPipelineReviewEdit_(e) {
  if (!e || !e.range) return;
  const review = e.range.getSheet();
  if (!review || review.getName() !== CRM_PIPELINE_REVIEW_TAB) return;
  if (e.range.getRow() <= 1) return;
  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) {
    refreshPipelineReview();
    return;
  }

  const editedHeader = clean_(review.getRange(1, e.range.getColumn()).getDisplayValue());
  if (!CRM_PIPELINE_REVIEW_EDITABLE_HEADERS[editedHeader]) {
    refreshPipelineReview();
    return;
  }

  const inquiryIdCol = getColumnIndexByHeader_(review, "inquiry_id");
  const inquiryId = inquiryIdCol ? clean_(review.getRange(e.range.getRow(), inquiryIdCol).getDisplayValue()) : "";
  if (!inquiryId) {
    refreshPipelineReview();
    return;
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const inquiries = ss.getSheetByName(CRM_TABS.inquiries);
  if (!inquiries) return;

  const match = getObjectsWithRowNumbers_(inquiries).filter(function(item) {
    return clean_(item.row.inquiry_id) === inquiryId;
  })[0];
  if (!match) {
    refreshPipelineReview();
    return;
  }

  const targetCol = getColumnIndexByHeader_(inquiries, editedHeader);
  if (!targetCol) {
    refreshPipelineReview();
    return;
  }

  const rawValue = e.range.getValue();
  const normalizedValue = normalizePipelineReviewEditValue_(editedHeader, rawValue);
  inquiries.getRange(match.rowNumber, targetCol).setValue(normalizedValue);
  markPipelineReviewManualOverride_(inquiries, match.rowNumber, editedHeader, targetCol, normalizedValue);

  const updatedAtCol = getColumnIndexByHeader_(inquiries, "updated_at");
  if (updatedAtCol) inquiries.getRange(match.rowNumber, updatedAtCol).setValue(nowIso_());

  if (editedHeader === "status") {
    const stageChangedCol = getColumnIndexByHeader_(inquiries, "stage_changed_at");
    if (stageChangedCol) inquiries.getRange(match.rowNumber, stageChangedCol).setValue(nowIso_());
    syncBookingStatusFromInquiry_(inquiries, match.rowNumber);
  }

  if (shouldRecalculateAfterPipelineReviewEdit_(editedHeader)) {
    recalcCrmInquiryRowFromEdit_(inquiries, match.rowNumber, true);
  }

  formatCrmDateColumns_();
  refreshPipelineReview();
}

function normalizePipelineReviewEditValue_(header, value) {
  if (header === "last_contacted_at") {
    const dateOnly = normalizeDateForSheet_(value);
    return dateOnly ? dateOnly + " 00:00:00" : "";
  }
  if (header === "followup_date" || header === "requested_date_start" || header === "requested_date_end") {
    return normalizeDateForSheet_(value);
  }
  if (header === "status") return normalizeValidatedField_(CRM_TABS.inquiries, "status", value);
  if (header === "transportation_needed") return normalizeValidatedField_(CRM_TABS.inquiries, "transportation_needed", value);
  if (header === "grouping_preference") return normalizeValidatedField_(CRM_TABS.inquiries, "grouping_preference", value);
  if (header === "grouping_status") return normalizeValidatedField_(CRM_TABS.inquiries, "grouping_status", value);
  return value;
}

function markPipelineReviewManualOverride_(inquiries, rowNumber, header, targetCol, value) {
  const range = inquiries.getRange(rowNumber, targetCol);
  if (!clean_(value)) {
    range.clearNote();
    return;
  }
  if (header === "status") range.setNote(MANUAL_STATUS_OVERRIDE_NOTE);
  if (header === "last_contacted_at") range.setNote(MANUAL_LAST_CONTACTED_OVERRIDE_NOTE);
  if (header === "followup_date") range.setNote(MANUAL_FOLLOWUP_OVERRIDE_NOTE);
  if (header === "requested_date_start" || header === "requested_date_end") range.setNote(MANUAL_REQUESTED_DATE_OVERRIDE_NOTE);
}

function shouldRecalculateAfterPipelineReviewEdit_(header) {
  return {
    status: true,
    last_contacted_at: true,
    followup_date: true,
    requested_date_start: true,
    requested_date_end: true,
    requested_date_text: true,
    guest_count: true,
    transportation_needed: true,
    grouping_preference: true,
    grouping_status: true
  }[header] === true;
}

function ensureViewSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function formatCrmDateColumns_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    [
      CRM_TABS.inquiries,
      CRM_TABS.followups,
    CRM_TABS.bookings,
    CRM_TABS.payments,
    CRM_TABS.emailLog,
    "crm_view_active_pipeline",
    "crm_view_new_inquiries",
    "crm_view_planning",
    "crm_view_group_opportunities",
    "crm_view_follow_up_today",
    "crm_view_quote_sent_awaiting_reply",
    "crm_view_accepted_needs_payment",
    "crm_view_deposit_pending",
    "crm_view_paid_needs_status_cleanup",
    "crm_view_confirm_logistics",
    "crm_view_upcoming_tours",
    "crm_view_schedule_conflicts"
  ].forEach(function(sheetName) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    applyDateFormatsForHeaders_(sh, headers);
  });
}

function applyDateFormatsForHeaders_(sh, headers) {
  const maxRows = Math.max(sh.getMaxRows() - 1, 1);
  const dateTimeHeaders = {
    created_at: true,
    updated_at: true,
    stage_changed_at: true,
    last_contacted_at: true,
    first_contact_at: true,
    last_contact_at: true,
    message_date: true
  };
  const dateHeaders = {
    followup_date: true,
    requested_date_start: true,
    requested_date_end: true,
    confirmed_date: true,
    completed_date: true,
    due_at: true,
    completed_at: true,
    send_after: true,
    tour_date_start: true,
    tour_date_end: true,
    balance_due_date: true,
    payment_date: true
  };

  headers.forEach(function(header, idx) {
    const cleanHeader = clean_(header);
    const col = idx + 1;
    if (dateTimeHeaders[cleanHeader]) {
      sh.getRange(2, col, maxRows, 1).setNumberFormat("yyyy-mm-dd hh:mm:ss");
    } else if (dateHeaders[cleanHeader]) {
      sh.getRange(2, col, maxRows, 1).setNumberFormat("yyyy-mm-dd");
    }
  });
}

function mergeDuplicateManualPendingGuestInquiriesByEmail() {
  mergeDuplicateInquiriesByEmail();
}

function mergeDuplicateInquiriesByEmail() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) return;

  const rows = getObjectsWithRowNumbers_(sh);
  const groups = {};
  rows.forEach(function(item) {
    const email = clean_(item.row.email_normalized || item.row.email).toLowerCase();
    if (!email) return;
    if (!groups[email]) groups[email] = [];
    groups[email].push(item);
  });

  const rowsToDelete = [];
  Object.keys(groups).forEach(function(email) {
    const group = groups[email];
    if (group.length < 2) return;

    const keeper = chooseInquiryKeeper_(group);
    group.forEach(function(item) {
      if (item.rowNumber === keeper.rowNumber) return;

      const merged = mergeInquiryRows_(keeper.row, item.row, nowIso_());
      writeObjectToRow_(sh, keeper.rowNumber, merged);
      keeper.row = merged;

      updateRelatedInquiryId_(ss, item.row.inquiry_id, keeper.row.inquiry_id);
      cancelMergedInquiryFollowups_(ss, item.row.inquiry_id, keeper.row.inquiry_id);
      rowsToDelete.push(item.rowNumber);
    });
  });

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    sh.deleteRow(rowNumber);
  });

  sortCrmInquiriesByCreatedAtDesc();
}

function chooseInquiryKeeper_(group) {
  const candidates = group.slice();
  candidates.sort(function(a, b) {
    const scoreDiff = inquiryKeeperScore_(b.row) - inquiryKeeperScore_(a.row);
    if (scoreDiff) return scoreDiff;
    return clean_(a.row.created_at) < clean_(b.row.created_at) ? -1 : 1;
  });
  return candidates[0];
}

function inquiryKeeperScore_(row) {
  let score = 0;
  const sourceType = clean_(row.source_type);
  if (sourceType !== "manual_pending_guest") score += 20;
  if (clean_(row.source_page)) score += 10;
  if (clean_(row.requested_date_start)) score += 8;
  if (clean_(row.message_questions)) score += 6;
  if (clean_(row.status) !== "new") score += 4;
  if (clean_(row.payment_status) === "paid") score += 4;
  if (clean_(row.quote_status) === "accepted") score += 3;
  return score;
}

function updateRelatedInquiryId_(ss, oldInquiryId, newInquiryId) {
  if (!oldInquiryId || !newInquiryId || oldInquiryId === newInquiryId) return;
  [
    CRM_TABS.bookings,
    CRM_TABS.payments,
    CRM_TABS.activity,
    CRM_TABS.emailLog
  ].forEach(function(tabName) {
    const sh = ss.getSheetByName(tabName);
    if (!sh) return;
    getObjectsWithRowNumbers_(sh).forEach(function(item) {
      if (clean_(item.row.inquiry_id) !== clean_(oldInquiryId)) return;
      const updated = Object.assign({}, item.row, { inquiry_id: newInquiryId });
      writeObjectToRow_(sh, item.rowNumber, updated);
    });
  });
}

function cancelMergedInquiryFollowups_(ss, oldInquiryId, newInquiryId) {
  if (!oldInquiryId || !newInquiryId || clean_(oldInquiryId) === clean_(newInquiryId)) return;
  const sh = ss.getSheetByName(CRM_TABS.followups);
  if (!sh) return;
  getObjectsWithRowNumbers_(sh).forEach(function(item) {
    if (clean_(item.row.inquiry_id) !== clean_(oldInquiryId)) return;
    const updated = Object.assign({}, item.row, {
      inquiry_id: newInquiryId,
      status: "cancelled",
      notes: mergeNotes_(item.row.notes, "Cancelled because duplicate inquiry " + oldInquiryId + " was merged into " + newInquiryId + ".")
    });
    writeObjectToRow_(sh, item.rowNumber, updated);
  });
}

function updateInquiryStatus(inquiryId, newStatus, notes) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  const rows = getObjects_(sh);
  const idx = rows.findIndex(function(row) { return row.inquiry_id === inquiryId; });
  if (idx < 0) throw new Error("Inquiry not found: " + inquiryId);

  const row = rows[idx];
  const oldStatus = row.status;
  const now = nowIso_();
  const next = nextActionForStatus_(newStatus);
  const updated = Object.assign({}, row, {
    status: newStatus,
    updated_at: now,
    stage_changed_at: now,
    followup_date: next.followupDate,
    next_action: next.action,
    quote_status: newStatus === "quoted" ? "sent" : row.quote_status,
    payment_status: newStatus === "deposit_paid" ? "deposit_paid" : row.payment_status
  });

  writeObjectToRow_(sh, idx + 2, updated);
  const statusCol = getColumnIndexByHeader_(sh, "status");
  if (statusCol) sh.getRange(idx + 2, statusCol).setNote(MANUAL_STATUS_OVERRIDE_NOTE);
  syncBookingStatusFromInquiry_(sh, idx + 2);
  logActivity_(ss, row.guest_id, inquiryId, "", "manual", "status_changed", oldStatus, newStatus, notes || "");
  upsertFollowupForInquiry_(ss, updated, next);
}

function sendDailyFollowupDigest() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  reconcileCrmFollowupQueue_(ss);
  const followups = getObjects_(ss.getSheetByName(CRM_TABS.followups));
  const inquiries = {};
  getObjects_(ss.getSheetByName(CRM_TABS.inquiries)).forEach(function(row) {
    if (row.inquiry_id) inquiries[clean_(row.inquiry_id)] = row;
  });
  const today = todayIso_();
  const dueByInquiry = {};
  followups.forEach(function(row) {
    const inquiryId = clean_(row.inquiry_id);
    if (!inquiryId || !inquiries[inquiryId]) return;
    if (clean_(row.followup_type) === "schedule_conflict") return;
    if (clean_(row.status) !== "open") return;
    if (!row.due_at || normalizeDateForSheet_(row.due_at) > today) return;
    if (!dueByInquiry[inquiryId]) dueByInquiry[inquiryId] = row;
  });
  const due = Object.keys(dueByInquiry).map(function(inquiryId) {
    return Object.assign({}, dueByInquiry[inquiryId], {
      inquiry: inquiries[inquiryId]
    });
  }).sort(function(a, b) {
    return clean_(a.due_at).localeCompare(clean_(b.due_at));
  });

  if (!due.length) return;

  const groups = groupDigestFollowups_(due);
  const displayDate = formatDigestDate_(today, true);
  const plainText = buildFollowupDigestPlainText_(groups, due.length, displayDate, ss.getUrl(), today);
  const htmlBody = buildFollowupDigestHtml_(groups, due.length, displayDate, ss.getUrl(), today);

  MailApp.sendEmail({
    to: INTERNAL_NOTIFY_EMAIL,
    subject: "MBW CRM: " + due.length + " follow-ups due - " + formatDigestDate_(today, false),
    body: plainText,
    htmlBody: htmlBody
  });
}

function groupDigestFollowups_(dueRows) {
  const definitions = [
    { key: "cancellations", title: "Cancellation reviews", test: function(row) {
      return clean_(row.inquiry.status) === "cancelled";
    }},
    { key: "planning", title: "Itinerary planning", test: function(row) {
      return clean_(row.inquiry.status) === "planning";
    }},
    { key: "pre_tour", title: "Pre-tour details", test: function(row) {
      return clean_(row.inquiry.status) === "booked";
    }},
    { key: "payment_reminders", title: "Payment reminders", test: function(row) {
      return clean_(row.inquiry.status) === "deposit_pending";
    }},
    { key: "payment_instructions", title: "Accepted - payment instructions", test: function(row) {
      return clean_(row.inquiry.status) === "quoted" &&
        clean_(row.inquiry.quote_status) === "accepted";
    }},
    { key: "quote_followups", title: "Quote follow-ups", test: function(row) {
      return clean_(row.inquiry.status) === "quoted";
    }},
    { key: "general_followups", title: "General follow-ups", test: function(row) {
      return ["new", "contacted", "qualified", "follow_up"].indexOf(clean_(row.inquiry.status)) >= 0;
    }},
    { key: "other", title: "Other actions", test: function() { return true; }}
  ];

  const grouped = definitions.map(function(definition) {
    return {
      key: definition.key,
      title: definition.title,
      test: definition.test,
      rows: []
    };
  });

  dueRows.forEach(function(row) {
    const group = grouped.find(function(item) { return item.test(row); });
    group.rows.push(row);
  });

  grouped.forEach(function(group) {
    group.rows.sort(function(a, b) {
      const aDate = normalizeDateForSheet_(a.inquiry.requested_date_start) || "9999-12-31";
      const bDate = normalizeDateForSheet_(b.inquiry.requested_date_start) || "9999-12-31";
      if (aDate !== bDate) return aDate.localeCompare(bDate);
      return clean_(a.inquiry.full_name).localeCompare(clean_(b.inquiry.full_name));
    });
  });

  return grouped.filter(function(group) { return group.rows.length > 0; });
}

function buildFollowupDigestPlainText_(groups, total, displayDate, sheetUrl, today) {
  const lines = [
    "MBW CRM Daily Follow-ups",
    displayDate,
    "",
    total + (total === 1 ? " guest needs attention" : " guests need attention")
  ];

  groups.forEach(function(group) {
    lines.push("", group.title.toUpperCase() + " - " + group.rows.length, "");
    group.rows.forEach(function(row) {
      const inquiry = row.inquiry;
      lines.push(clean_(inquiry.full_name) || clean_(inquiry.email) || "Unknown guest");
      lines.push("Tour: " + digestTourSummary_(inquiry));
      lines.push("Action: " + digestActionText_(row));
      const overdue = digestOverdueText_(row.due_at, today);
      if (overdue) lines.push(overdue);
      lines.push("");
    });
  });

  lines.push("Open CRM:", sheetUrl);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

function buildFollowupDigestHtml_(groups, total, displayDate, sheetUrl, today) {
  const sectionHtml = groups.map(function(group) {
    const rowsHtml = group.rows.map(function(row) {
      const inquiry = row.inquiry;
      const overdue = digestOverdueText_(row.due_at, today);
      return [
        '<div style="padding:14px 0;border-bottom:1px solid #e5e7eb;">',
        '<div style="font-size:16px;font-weight:700;color:#173b2b;">',
        escapeHtml_(clean_(inquiry.full_name) || clean_(inquiry.email) || "Unknown guest"),
        '</div>',
        '<div style="margin-top:5px;color:#374151;"><strong>Tour:</strong> ',
        escapeHtml_(digestTourSummary_(inquiry)),
        '</div>',
        '<div style="margin-top:3px;color:#374151;"><strong>Action:</strong> ',
        escapeHtml_(digestActionText_(row)),
        '</div>',
        overdue
          ? '<div style="margin-top:6px;color:#b42318;font-weight:700;">' + escapeHtml_(overdue) + '</div>'
          : '',
        '</div>'
      ].join("");
    }).join("");

    return [
      '<div style="margin-top:24px;">',
      '<div style="padding:9px 12px;background:#e8f3ec;border-left:4px solid #377a50;',
      'font-size:14px;font-weight:700;color:#173b2b;text-transform:uppercase;">',
      escapeHtml_(group.title),
      ' <span style="font-weight:400;">(' + group.rows.length + ')</span>',
      '</div>',
      rowsHtml,
      '</div>'
    ].join("");
  }).join("");

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;',
    'padding:24px;color:#1f2937;line-height:1.45;">',
    '<div style="font-size:23px;font-weight:700;color:#173b2b;">MBW CRM Daily Follow-ups</div>',
    '<div style="margin-top:4px;color:#6b7280;">' + escapeHtml_(displayDate) + '</div>',
    '<div style="margin-top:18px;padding:14px 16px;background:#f6f8f7;border:1px solid #d9e4dd;">',
    '<strong style="font-size:18px;">' + total + '</strong> ',
    total === 1 ? 'guest needs attention' : 'guests need attention',
    '</div>',
    sectionHtml,
    '<div style="margin-top:28px;">',
    '<a href="' + escapeHtml_(sheetUrl) + '" style="display:inline-block;padding:11px 16px;',
    'background:#377a50;color:#ffffff;text-decoration:none;font-weight:700;">Open CRM Sheet</a>',
    '</div>',
    '</div>'
  ].join("");
}

function digestTourSummary_(inquiry) {
  const start = normalizeDateForSheet_(inquiry.requested_date_start);
  const end = normalizeDateForSheet_(inquiry.requested_date_end);
  const dateText = start && end && start !== end
    ? formatDigestDate_(start, false) + " to " + formatDigestDate_(end, false)
    : formatDigestDate_(start || end, false) || "No date";
  const tourType = clean_(inquiry.tour_type) || "Tour";
  return dateText + " | " + tourType;
}

function digestActionText_(followupRow) {
  const subject = clean_(followupRow.subject);
  const guestName = clean_(followupRow.inquiry && followupRow.inquiry.full_name);
  if (guestName && subject.slice(-guestName.length - 2) === ": " + guestName) {
    return subject.slice(0, -guestName.length - 2);
  }
  return subject || clean_(followupRow.notes) || "Review inquiry";
}

function digestOverdueText_(dueAt, today) {
  const due = normalizeDateForSheet_(dueAt);
  if (!due || due >= today) return "";
  const days = daysBetweenIso_(due, today);
  return "OVERDUE " + days + (days === 1 ? " day" : " days");
}

function formatDigestDate_(dateIso, includeWeekday) {
  const normalized = normalizeDateForSheet_(dateIso);
  if (!normalized) return "";
  const pattern = includeWeekday ? "EEEE, MMMM d, yyyy" : "MMMM d";
  return Utilities.formatDate(parseIsoDate_(normalized), CRM_TIMEZONE, pattern);
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function doPost(e) {
  try {
    const payload = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : "{}");
    const configuredSecret = PropertiesService.getScriptProperties().getProperty("CRM_WEBHOOK_SECRET");
    if (configuredSecret && payload.secret !== configuredSecret) {
      return jsonResponse_({ ok: false, error: "Unauthorized" }, 403);
    }

    if (payload.action === "render_crm_email_text") {
      return jsonResponse_({
        ok: true,
        result: renderCrmEmailTemplateForInquiry(payload.inquiry_id, payload.template_key || "")
      });
    }

    if (payload.action === "create_crm_email_draft") {
      const result = createGmailDraftForInquiry(payload.inquiry_id, payload.template_key || "");
      if (payload.telegram_bot_token && payload.chat_id) {
        sendTelegramMessage_(payload.telegram_bot_token, payload.chat_id, [
          "✅ Gmail draft created",
          "",
          "Guest: " + result.full_name,
          "Subject: " + result.subject,
          "Template: " + result.template_key
        ].join("\n"));
      }
      return jsonResponse_({ ok: true, result: result });
    }

    return jsonResponse_({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) }, 500);
  }
}

function renderCrmEmailTemplateForInquiry(inquiryId, templateKey) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const inquiry = findCrmInquiryById_(ss, inquiryId);
  if (!inquiry) throw new Error("Inquiry not found: " + inquiryId);

  const template = findCrmEmailTemplate_(ss, inquiry, templateKey);
  if (!template) throw new Error("No enabled email template found for inquiry: " + inquiryId);

  const subject = renderTemplateText_(template.email_subject, inquiry);
  const bodyAuto = renderTemplateText_(template.email_body_auto, inquiry);
  const bodyText = renderTemplateText_(template.email_body_text || template.email_body_auto, inquiry).replace(/\\n/g, "\n");

  return {
    inquiry_id: inquiry.inquiry_id,
    guest_id: inquiry.guest_id,
    full_name: inquiry.full_name,
    email: inquiry.email,
    template_key: template.template_key,
    email_type: template.email_type,
    subject: subject,
    body_auto: bodyAuto,
    body_text: bodyText
  };
}

function createGmailDraftForInquiry(inquiryId, templateKey) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const inquiry = findCrmInquiryById_(ss, inquiryId);
  if (!inquiry) throw new Error("Inquiry not found: " + inquiryId);
  if (!clean_(inquiry.email)) throw new Error("Inquiry has no email: " + inquiryId);

  const rendered = renderCrmEmailTemplateForInquiry(inquiryId, templateKey);
  const htmlBody = rendered.body_text.replace(/\n/g, "<br>");
  const draft = GmailApp.createDraft(rendered.email, rendered.subject, rendered.body_text, { htmlBody: htmlBody });
  const now = nowIso_();

  appendObject_(ss.getSheetByName(CRM_TABS.emailLog), {
    email_log_id: makeId_("EML"),
    created_at: now,
    message_date: now,
    direction: "outbound_draft",
    inquiry_id: rendered.inquiry_id,
    guest_id: rendered.guest_id,
    email: rendered.email,
    email_normalized: normalizeEmail_(rendered.email),
    gmail_thread_id: "",
    gmail_message_id: draft.getId ? draft.getId() : "",
    subject: rendered.subject,
    snippet: rendered.body_text.slice(0, 250),
    template_key: rendered.template_key,
    status: "draft_created",
    matched_by: "inquiry_id",
    notes: "Created by CRM email draft engine."
  });

  return Object.assign({}, rendered, {
    draft_id: draft.getId ? draft.getId() : "",
    created_at: now
  });
}

function findCrmInquiryById_(ss, inquiryId) {
  const id = clean_(inquiryId);
  if (!id) throw new Error("Missing inquiry_id");
  return getObjects_(ss.getSheetByName(CRM_TABS.inquiries)).find(function(row) {
    return clean_(row.inquiry_id) === id;
  });
}

function findCrmEmailTemplate_(ss, inquiry, templateKey) {
  const templates = getObjects_(ss.getSheetByName(CRM_TABS.emailTemplates))
    .filter(function(row) { return clean_(row.enabled).toLowerCase() !== "no"; });
  const key = clean_(templateKey);
  if (key) {
    return templates.find(function(row) { return clean_(row.template_key) === key; });
  }

  const chosenKey = chooseTemplateKeyForInquiry_(inquiry);
  return templates.find(function(row) { return clean_(row.template_key) === chosenKey; }) ||
    templates.find(function(row) {
      return clean_(row.trigger_status) === clean_(inquiry.status) &&
        clean_(row.trigger_quote_status) === clean_(inquiry.quote_status) &&
        clean_(row.trigger_payment_status) === clean_(inquiry.payment_status);
    });
}

function chooseTemplateKeyForInquiry_(inquiry) {
  const status = clean_(inquiry.status);
  const quoteStatus = clean_(inquiry.quote_status);
  const paymentStatus = clean_(inquiry.payment_status);
  const daysUntilTour = daysUntilDate_(inquiry.requested_date_start);

  if (status === "new") return "new_inquiry_reply";
  if (status === "planning") return "general_followup";
  if (status === "qualified") return "quote_manual";
  if (status === "contacted") return "availability_check";
  if (status === "follow_up") return "general_followup";
  if (status === "deposit_pending") return "deposit_reminder";
  if (status === "deposit_paid") return "deposit_paid_logistics";
  if (status === "booked") return "pre_tour_details";
  if (status === "completed") return "review_request";
  if (status === "cancelled") return "general_followup";
  if (status === "did_not_book" || status === "lost") return "did_not_book_close";

  if (status === "quoted" && quoteStatus === "accepted" && paymentStatus === "unpaid") {
    return daysUntilTour > 30 ? "accepted_waiting_payment" : "payment_request";
  }
  if (status === "quoted" && quoteStatus === "sent" && paymentStatus === "unpaid") {
    return daysUntilTour > 30 ? "quote_followup_far" : "quote_followup_near";
  }
  return "general_followup";
}

function renderTemplateText_(template, inquiry) {
  const data = Object.assign({}, inquiry, {
    first_name: inquiry.first_name || String(inquiry.full_name || "").split(/\s+/)[0] || "",
    quote_details: inquiry.quote_details || "[Add quote details here]",
    payment_details: inquiry.payment_details || "[Add payment/deposit details here]",
    review_link: inquiry.review_link || "[Add review link here]"
  });
  return String(template || "").replace(/\{\{([^}]+)\}\}/g, function(match, key) {
    const cleanKey = clean_(key);
    return data[cleanKey] !== undefined && data[cleanKey] !== "" ? data[cleanKey] : match;
  }).replace(/\\n/g, "\n");
}

function updateInquiryAfterDraftCreated_(ss, inquiryId, now) {
  const sh = ss.getSheetByName(CRM_TABS.inquiries);
  if (!sh) return;
  const rows = getObjectsWithRowNumbers_(sh);
  const item = rows.find(function(rowItem) {
    return clean_(rowItem.row.inquiry_id) === clean_(inquiryId);
  });
  if (!item) return;

  const action = nextActionForInquiry_(item.row, bestInquiryDateRange_(item.row, sh, item.rowNumber));
  const updated = Object.assign({}, item.row, {
    updated_at: now,
    last_contacted_at: now,
    followup_date: action.followupDate,
    next_action: action.action
  });
  writeObjectToRow_(sh, item.rowNumber, updated);
  upsertFollowupForInquiry_(ss, updated, action);
}

function daysUntilDate_(dateValue) {
  const iso = normalizeDateForSheet_(dateValue);
  if (!iso) return 9999;
  const today = parseIsoDate_(todayIso_());
  const target = parseIsoDate_(iso);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function sendTelegramMessage_(botToken, chatId, text) {
  const url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: String(chatId),
      text: text,
      disable_web_page_preview: true
    }),
    muteHttpExceptions: true
  });
}

function jsonResponse_(data, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function syncGmailToCrmEmailLog() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);

  const inquiriesSheet = ss.getSheetByName(CRM_TABS.inquiries);
  const emailLogSheet = ss.getSheetByName(CRM_TABS.emailLog);
  if (!inquiriesSheet || !emailLogSheet) return;

  const existingMessageIds = {};
  getObjects_(emailLogSheet).forEach(function(row) {
    if (row.gmail_message_id) existingMessageIds[clean_(row.gmail_message_id)] = true;
  });

  const inquiriesByEmail = {};
  getObjectsWithRowNumbers_(inquiriesSheet).forEach(function(item) {
    const email = clean_(item.row.email_normalized || item.row.email).toLowerCase();
    if (!email) return;
    if (!inquiriesByEmail[email]) inquiriesByEmail[email] = [];
    inquiriesByEmail[email].push(item);
  });

  let logged = 0;
  const maxMessagesPerRun = 250;
  Object.keys(inquiriesByEmail).some(function(email) {
    const inquiry = chooseInquiryKeeper_(inquiriesByEmail[email]).row;
    const queries = [
      "from:" + email + " newer_than:365d",
      "to:" + email + " newer_than:365d"
    ];

    queries.forEach(function(query) {
      if (logged >= maxMessagesPerRun) return;
      GmailApp.search(query, 0, 10).forEach(function(thread) {
        thread.getMessages().forEach(function(message) {
          if (logged >= maxMessagesPerRun) return;
          const messageId = clean_(message.getId());
          if (!messageId || existingMessageIds[messageId]) return;

          const fromEmail = extractEmailAddress_(message.getFrom()).toLowerCase();
          const direction = fromEmail === email ? "inbound" : "outbound";
          const body = clean_(message.getPlainBody()).replace(/\s+/g, " ").slice(0, 500);

          appendObject_(emailLogSheet, {
            email_log_id: makeId_("EMAIL"),
            created_at: nowIso_(),
            message_date: normalizeDateTimeForSheet_(message.getDate()),
            direction: direction,
            inquiry_id: inquiry.inquiry_id,
            guest_id: inquiry.guest_id,
            email: email,
            email_normalized: email,
            gmail_thread_id: thread.getId(),
            gmail_message_id: messageId,
            subject: message.getSubject(),
            snippet: body,
            template_key: "",
            status: "logged",
            matched_by: direction === "inbound" ? "from_email" : "to_email",
            notes: ""
          });
          existingMessageIds[messageId] = true;
          logged++;
        });
      });
    });

    return logged >= maxMessagesPerRun;
  });

  sortCrmEmailLogByMessageDateDesc();
  Logger.log("Gmail sync complete. Logged messages: " + logged);
}

function sortCrmEmailLogByMessageDateDesc() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.emailLog);
  if (!sh || sh.getLastRow() < 3) return;
  const dateCol = getColumnIndexByHeader_(sh, "message_date");
  if (!dateCol) return;
  sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn())
    .sort({ column: dateCol, ascending: false });
}

function extractEmailAddress_(value) {
  const text = clean_(value);
  const match = text.match(/<([^>]+)>/);
  return clean_(match ? match[1] : text);
}

function createBookingCalendarEvent(bookingId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.bookings);
  const rows = getObjects_(sh);
  const idx = rows.findIndex(function(row) { return row.booking_id === bookingId; });
  if (idx < 0) throw new Error("Booking not found: " + bookingId);

  const row = rows[idx];
  if (row.calendar_event_id) return row.calendar_event_id;
  if (!row.tour_date_start) throw new Error("Booking has no tour_date_start: " + bookingId);

  const cal = CalendarApp.getCalendarById(CALENDAR_ID);
  const start = parseIsoDate_(row.tour_date_start);
  const end = row.tour_date_end ? parseIsoDate_(row.tour_date_end) : start;
  const title = "MBW Tour - " + (row.product_selected || row.service_type || "Birdwatching") + " - " + bookingId;
  const description = [
    "Guest ID: " + row.guest_id,
    "Inquiry ID: " + row.inquiry_id,
    "Party size: " + row.party_size,
    "Guide: " + row.tour_guide,
    "Pickup: " + row.pickup_location,
    "Notes: " + row.operations_notes
  ].join("\n");

  const event = cal.createAllDayEvent(title, start, addDays_(end, 1), { description: description });
  row.calendar_event_id = event.getId();
  row.updated_at = nowIso_();
  writeObjectToRow_(sh, idx + 2, row);
  return event.getId();
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const existing = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn() || 1)).getValues()[0];
  const isEmpty = existing.every(function(v) { return String(v || "").trim() === ""; });
  if (isEmpty) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  } else {
    const existingHeaders = {};
    existing.forEach(function(header) {
      const cleanHeader = clean_(header);
      if (cleanHeader) existingHeaders[cleanHeader] = true;
    });

    const missingHeaders = headers.filter(function(header) {
      return !existingHeaders[header];
    });

    if (missingHeaders.length) {
      const startCol = sh.getLastColumn() + 1;
      sh.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
      sh.getRange(1, startCol, 1, missingHeaders.length).setFontWeight("bold");
    }
  }
  return sh;
}

function seedSettings_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(CRM_TABS.settings);
  if (sh.getLastRow() > 1) return;
  const rows = [
    ["default_assigned_to", "", "Optional owner for new inquiries."],
    ["quoted_followup_days", "2", "Follow-up delay after quote is sent."],
    ["deposit_pending_followup_days", "1", "Follow-up delay after guest says yes."],
    ["booked_pretour_days", "7", "Pre-tour reminder delay before tour date."],
    ["internal_notify_email", INTERNAL_NOTIFY_EMAIL, "Daily CRM digest recipient."]
  ];
  sh.getRange(2, 1, rows.length, 3).setValues(rows);
}

function normalizeSiteChoiceKey_(value) {
  return clean_(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildStructuredSiteRequest_(input, dateRange, guestCount) {
  let suppliedItems = [];
  if (clean_(input.tourItemsJson)) {
    try {
      const parsed = JSON.parse(input.tourItemsJson);
      if (Array.isArray(parsed)) suppliedItems = parsed;
    } catch (err) {}
  }

  const key = normalizeSiteChoiceKey_(input.tourType);
  const primaryMap = {
    "half-day tour": { interest: "Birdwatching", service: "Birdwatching", tour: "Half-Day Birdwatching", product: "", duration: "Half Day" },
    "tour de medio dia": { interest: "Birdwatching", service: "Birdwatching", tour: "Half-Day Birdwatching", product: "", duration: "Half Day" },
    "full-day tour": { interest: "Birdwatching", service: "Birdwatching", tour: "Full-Day Birdwatching", product: "", duration: "Full Day" },
    "tour de dia completo": { interest: "Birdwatching", service: "Birdwatching", tour: "Full-Day Birdwatching", product: "", duration: "Full Day" },
    "photography-focused tour": { interest: "Birdwatching", service: "Birdwatching", tour: "Photography-Focused Birdwatching Tour", product: "", duration: "Flexible" },
    "night walk": { interest: "Activity", service: "Activity", tour: "Night Walk", product: "MBW016", duration: "Evening activity" },
    "caminata nocturna": { interest: "Activity", service: "Activity", tour: "Night Walk", product: "MBW016", duration: "Evening activity" },
    "quito to mindo day trip": { interest: "Birdwatching", service: "Birdwatching", tour: "Quito to Mindo Day Trip", product: "", duration: "Full Day" },
    "viaje de un dia de quito a mindo": { interest: "Birdwatching", service: "Birdwatching", tour: "Quito to Mindo Day Trip", product: "", duration: "Full Day" },
    "custom / private tour": { interest: "Birdwatching", service: "Custom", tour: "Custom / Private Tour", product: "", duration: "Flexible" },
    "tour personalizado / privado": { interest: "Birdwatching", service: "Custom", tour: "Custom / Private Tour", product: "", duration: "Flexible" },
    "multi-day": { interest: "Multi Day", service: "Birdwatching", tour: "Multi-Day Birdwatching", product: "", duration: "Flexible" },
    "tour de varios dias": { interest: "Multi Day", service: "Birdwatching", tour: "Multi-Day Birdwatching", product: "", duration: "Flexible" },
    "activities": { interest: "Activity", service: "Activity", tour: "Activity — details in guest message", product: "", duration: "Flexible" },
    "actividades": { interest: "Activity", service: "Activity", tour: "Activity — details in guest message", product: "", duration: "Flexible" },
    "combination": { interest: "Tour + Activity", service: "Custom", tour: "Combination of Tour and Activity", product: "", duration: "Flexible" },
    "combinacion": { interest: "Tour + Activity", service: "Custom", tour: "Combination of Tour and Activity", product: "", duration: "Flexible" },
    "not sure yet": { interest: "Other", service: "Custom", tour: "Not Sure Yet", product: "", duration: "Flexible" },
    "aun no estoy seguro": { interest: "Other", service: "Custom", tour: "Not Sure Yet", product: "", duration: "Flexible" }
  };
  const primary = primaryMap[key] || {
    interest: clean_(input.interestCategory) || (clean_(input.tourType) ? "Other" : ""),
    service: clean_(input.serviceType) || (clean_(input.tourType) ? "Custom" : ""),
    tour: clean_(input.tourType),
    product: clean_(input.productSelected),
    duration: clean_(input.durationPreference)
  };

  let groupingPreference = clean_(input.groupingPreference) || "unknown";
  const additions = [];
  function catalogItemsFromOther_(detail) {
    const text = clean_(detail);
    const lower = normalizeSiteChoiceKey_(text);
    const matches = [];
    if (/\bchocolate(?:\s+tour)?\b/.test(lower)) matches.push({ tour: "Chocolate Tour", service_type: "Activity", product_selected: "MBW011", duration: "", notes: "Guest requested: " + text });
    if (/\borchid(?:\s+garden)?(?:\s+tour)?\b/.test(lower)) matches.push({ tour: "Orchid Garden Tour", service_type: "Activity", product_selected: "ACT009", duration: "", notes: "Guest requested: " + text });
    if (/\bcoffee(?:\s+tour)?\b/.test(lower)) matches.push({ tour: "Coffee Tour", service_type: "Activity", product_selected: "MBW012", duration: "", notes: "Guest requested: " + text });
    if (/\b(?:waterfall|waterfalls|cascada|cascadas)\b/.test(lower)) matches.push({ tour: "Waterfalls", service_type: "Activity", product_selected: "ACT002", duration: "", notes: "Guest requested: " + text });
    return matches.length ? matches : [{ tour: "Other Activity or Tour", service_type: "Custom", product_selected: "Other", duration: "", notes: text || "Other activity or tour requested" }];
  }
  clean_(input.tourAddOns).split(/\s*\|\s*/).filter(Boolean).forEach(function(value) {
    const lower = normalizeSiteChoiceKey_(value);
    if (lower.indexOf("tour format:") === 0) {
      if (lower.indexOf("private") >= 0 && lower.indexOf("either") < 0 && lower.indexOf("group") < 0) groupingPreference = "private_only";
      else if (lower.indexOf("group") >= 0 || lower.indexOf("either") >= 0) groupingPreference = "open_to_group";
      return;
    }
    if (lower === "night walk") additions.push({ tour: "Night Walk", service_type: "Activity", product_selected: "MBW016", duration: "Evening activity" });
    else if (lower === "additional birding day") additions.push({ tour: "Additional Birding Day", service_type: "Birdwatching", product_selected: "", duration: "Full Day" });
    else if (lower === "transportation") additions.push({ tour: "Transportation Requested", service_type: "Transportation", product_selected: "", duration: "" });
    else if (lower === "accommodation assistance") additions.push({ tour: "Accommodation Assistance", service_type: "Accommodation", product_selected: "ACCOM01", duration: "" });
    else {
      const detail = lower.indexOf("other:") === 0 ? clean_(value.slice(value.indexOf(":") + 1)) : value;
      catalogItemsFromOther_(detail).forEach(function(item) { additions.push(item); });
    }
  });

  let items = suppliedItems;
  if (!items.length && primary.tour) {
    items = [{
      id: "primary",
      tour: primary.tour,
      date: dateRange.start,
      tour_date: dateRange.start,
      guests: guestCount.count,
      product_selected: clean_(input.productSelected) || primary.product,
      service_type: clean_(input.serviceType) || primary.service,
      duration: clean_(input.durationPreference) || primary.duration,
      status: "new",
      pickup_location: clean_(input.pickupLocation),
      price: "",
      notes: "Primary request"
    }].concat(additions.map(function(item, index) {
      return {
        id: "addon-" + (index + 1),
        tour: item.tour,
        date: "",
        tour_date: "",
        guests: guestCount.count,
        product_selected: item.product_selected,
        service_type: item.service_type,
        duration: item.duration,
        status: "new",
        pickup_location: "",
        price: "",
        notes: item.notes || "Requested on website; date to be confirmed"
      };
    }));
  }

  const hasActivity = items.some(function(item) { return clean_(item.service_type) === "Activity" || normalizeSiteChoiceKey_(item.tour).indexOf("night walk") >= 0; });
  const hasBirding = items.some(function(item) { return clean_(item.service_type) === "Birdwatching" || normalizeSiteChoiceKey_(item.tour).indexOf("bird") >= 0; });
  const interestCategory = clean_(input.interestCategory) || (hasActivity && hasBirding ? "Tour + Activity" : primary.interest);
  const primaryItem = items[0] || {};
  return {
    interestCategory: interestCategory,
    serviceType: clean_(input.serviceType) || clean_(primaryItem.service_type) || primary.service,
    productSelected: clean_(input.productSelected) || clean_(primaryItem.product_selected) || primary.product,
    durationPreference: clean_(input.durationPreference) || clean_(primaryItem.duration) || primary.duration,
    groupingPreference: ["unknown", "open_to_group", "private_only"].indexOf(groupingPreference) >= 0 ? groupingPreference : "unknown",
    transportationNeeded: items.some(function(item) { return clean_(item.service_type) === "Transportation"; }) ? "Yes" : clean_(input.transportationNeeded),
    tourItems: items,
    tourItemsJson: items.length ? JSON.stringify(items) : ""
  };
}

function pickupLocationFromTourItems_(value) {
  if (!value) return "";
  let items = value;
  if (typeof items === "string") {
    const text = clean_(items);
    if (!text) return "";
    try {
      items = JSON.parse(text);
    } catch (error) {
      return "";
    }
  }
  if (!Array.isArray(items)) items = [items];
  for (let i = 0; i < items.length; i++) {
    const item = items[i] || {};
    const pickup = clean_(item.pickup_location || item.pickupLocation || item.pickup);
    if (pickup) return pickup;
  }
  return "";
}

function normalizeInput_(input) {
  const firstName = clean_(input.firstName);
  const lastName = clean_(input.lastName);
  const fullName = clean_(input.fullName) || [firstName, lastName].filter(Boolean).join(" ");
  const email = clean_(input.email);
  const phoneRaw = clean_(input.phoneRaw);
  const phoneNormalized = clean_(input.phoneNormalized) || normalizePhone_(phoneRaw);
  const sourceContactAt = normalizeDateTimeForSheet_(input.sourceContactAt);
  return {
    sourceType: clean_(input.sourceType),
    sourceTab: clean_(input.sourceTab),
    sourceRow: clean_(input.sourceRow),
    sourcePage: clean_(input.sourcePage),
    firstName: firstName || splitName_(fullName).firstName,
    lastName: lastName || splitName_(fullName).lastName,
    fullName: fullName,
    email: email,
    emailNormalized: email.toLowerCase(),
    phoneRaw: phoneRaw,
    phoneNormalized: phoneNormalized,
    country: clean_(input.country) || inferCountry_(phoneNormalized),
    sourceContactAt: sourceContactAt,
    requestedDateText: clean_(input.requestedDateText),
    guestCountText: clean_(input.guestCountText),
    tourType: clean_(input.tourType),
    tourAddOns: clean_(input.tourAddOns),
    tourItemsJson: clean_(input.tourItemsJson),
    interestCategory: clean_(input.interestCategory),
    serviceType: clean_(input.serviceType),
    productSelected: clean_(input.productSelected),
    groupingPreference: clean_(input.groupingPreference),
    durationPreference: clean_(input.durationPreference),
    accommodationNeeds: clean_(input.accommodationNeeds),
    transportationNeeded: clean_(input.transportationNeeded),
    pickupLocation: clean_(input.pickupLocation) || pickupLocationFromTourItems_(input.tourItemsJson),
    specialInterests: clean_(input.specialInterests),
    messageQuestions: clean_(input.messageQuestions),
    internalNotes: clean_(input.internalNotes),
    rawStatus: clean_(input.rawStatus),
    sourceGuestId: clean_(input.sourceGuestId),
    sourceRecordId: clean_(input.sourceRecordId),
    contactIntentId: clean_(input.contactIntentId),
    websiteVisitorId: clean_(input.websiteVisitorId),
    websiteSessionId: clean_(input.websiteSessionId),
    attributionStatus: clean_(input.attributionStatus),
    attributionQuality: clean_(input.attributionQuality),
    firstTouchSource: clean_(input.firstTouchSource),
    firstTouchMedium: clean_(input.firstTouchMedium),
    firstTouchCampaign: clean_(input.firstTouchCampaign),
    firstTouchContent: clean_(input.firstTouchContent),
    firstTouchTerm: clean_(input.firstTouchTerm),
    firstTouchLandingPage: clean_(input.firstTouchLandingPage),
    firstTouchReferrer: clean_(input.firstTouchReferrer),
    firstTouchDate: clean_(input.firstTouchDate),
    lastTouchSource: clean_(input.lastTouchSource),
    lastTouchMedium: clean_(input.lastTouchMedium),
    lastTouchCampaign: clean_(input.lastTouchCampaign),
    lastTouchContent: clean_(input.lastTouchContent),
    lastTouchTerm: clean_(input.lastTouchTerm),
    lastTouchLandingPage: clean_(input.lastTouchLandingPage),
    lastTouchReferrer: clean_(input.lastTouchReferrer),
    lastTouchDate: clean_(input.lastTouchDate),
    utmSource: clean_(input.utmSource),
    utmMedium: clean_(input.utmMedium),
    utmCampaign: clean_(input.utmCampaign),
    utmContent: clean_(input.utmContent),
    utmTerm: clean_(input.utmTerm),
    gclid: clean_(input.gclid),
    gbraid: clean_(input.gbraid),
    wbraid: clean_(input.wbraid),
    fbclid: clean_(input.fbclid),
    metaCampaignId: clean_(input.metaCampaignId),
    metaAdsetId: clean_(input.metaAdsetId),
    metaAdId: clean_(input.metaAdId)
  };
}

function buildDuplicateKey_(input) {
  if (input.emailNormalized) return "email:" + input.emailNormalized;
  if (input.phoneNormalized) return "phone:" + input.phoneNormalized;
  return "name:" + clean_(input.fullName).toLowerCase();
}

function normalizePhone_(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (/^\d{10}$/.test(digits)) return "1" + digits;
  if (/^09\d{8}$/.test(digits)) return "593" + digits.slice(1);
  return digits;
}

function inferCountry_(phoneNormalized) {
  const phone = String(phoneNormalized || "");
  if (phone.startsWith("593")) return "Ecuador";
  if (/^1\d{10}$/.test(phone)) return "United States / Canada";
  const map = [
    ["44", "United Kingdom"], ["49", "Germany"], ["33", "France"],
    ["34", "Spain"], ["39", "Italy"], ["31", "Netherlands"],
    ["41", "Switzerland"], ["61", "Australia"], ["64", "New Zealand"],
    ["52", "Mexico"], ["55", "Brazil"], ["57", "Colombia"],
    ["51", "Peru"], ["56", "Chile"], ["54", "Argentina"]
  ];
  const match = map.find(function(item) { return phone.startsWith(item[0]); });
  return match ? match[1] : "";
}

function parseDateRange_(text) {
  const raw = clean_(text);
  const matches = raw.match(/\d{4}-\d{2}-\d{2}/g);
  if (matches && matches.length) {
    return { start: matches[0], end: matches[1] || matches[0] };
  }
  const parts = raw.split(/\s+(?:to|a|al|-|through|until)\s+/i).map(function(part) {
    return normalizeDateForSheet_(part);
  }).filter(Boolean);
  if (parts.length) return { start: parts[0], end: parts[1] || parts[0] };

  const single = normalizeDateForSheet_(raw);
  return { start: single, end: single };
}

function normalizeInquiryDateForMatch_(row) {
  return normalizeDateForSheet_(row.requested_date_start) ||
    normalizeDateForSheet_(row.requested_date_end) ||
    normalizeDateForSheet_(row.requested_date_text);
}

function parseGuestCount_(text) {
  const raw = clean_(text);
  const match = raw.match(/\d+/);
  return { count: match ? match[0] : "", text: raw };
}

function normalizeTourCategory_(tourType) {
  const value = normalizeSiteChoiceKey_(tourType);
  if (!value) return "";
  if (value.indexOf("combination") >= 0 || value.indexOf("combinacion") >= 0 || value.indexOf("tour + activ") >= 0) return "Tour + Activity";
  if (value.indexOf("multi") >= 0 || value.indexOf("varios dias") >= 0) return "Multi Day";
  if (value.indexOf("transport") >= 0) return "Transportation";
  if (value.indexOf("accommod") >= 0 || value.indexOf("alojamiento") >= 0) return "Accommodation";
  if (value.indexOf("night") >= 0 || value.indexOf("nocturna") >= 0 || value.indexOf("activit") >= 0 || value.indexOf("actividades") >= 0) return "Activity";
  if (value.indexOf("not sure") >= 0 || value.indexOf("no estoy seguro") >= 0) return "Other";
  return "Birdwatching";
}

function inferPriority_(requestedDateStart) {
  if (!requestedDateStart) return "normal";
  const today = new Date(todayIso_() + "T00:00:00");
  const target = new Date(requestedDateStart + "T00:00:00");
  const days = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (days <= 7) return "urgent";
  if (days <= 30) return "high";
  return "normal";
}

function nextActionForStatus_(status) {
  const today = todayIso_();
  const map = {
    new: ["Review inquiry and reply", 0, "internal_review", ""],
    contacted: ["Follow up after first response", 2, "guest_followup", "contacted_followup"],
    planning: ["Prepare and send itinerary options", 3, "itinerary_planning", ""],
    qualified: ["Send quote", 0, "send_quote", "quote"],
    quoted: ["Follow up on quote", 2, "quote_followup", "quote_followup"],
    follow_up: ["Send follow-up", 0, "guest_followup", "general_followup"],
    deposit_pending: ["Send deposit/payment reminder", 1, "payment_followup", "deposit_reminder"],
    deposit_paid: ["Create/update booking and calendar event", 0, "booking_ops", ""],
    payment_pending: ["Send full-payment reminder", 1, "payment_followup", "payment_reminder"],
    booked: ["Send pre-tour details", 7, "pretour_details", "pretour"],
    completed: ["Send thank-you/review request", 1, "review_request", "review"],
    cancelled: ["Review cancellation and payment disposition", 0, "cancellation_review", ""],
    did_not_book: ["No action", "", "", ""],
    lost: ["No action", "", "", ""]
  };
  const item = map[status] || map.new;
  return {
    action: item[0],
    followupDate: item[1] === "" ? "" : addDaysIso_(today, item[1]),
    followupType: item[2],
    emailTemplate: item[3]
  };
}

function maxIsoDate_(a, b) {
  const aa = normalizeDateForSheet_(a);
  const bb = normalizeDateForSheet_(b);
  if (!aa) return bb;
  if (!bb) return aa;
  return aa >= bb ? aa : bb;
}

function expandDateRange_(startIso, endIso) {
  const start = normalizeDateForSheet_(startIso);
  const end = normalizeDateForSheet_(endIso) || start;
  if (!start) return [];
  const dates = [];
  let d = parseIsoDate_(start);
  const endDate = parseIsoDate_(end);
  let guard = 0;
  while (d.getTime() <= endDate.getTime() && guard < 90) {
    dates.push(Utilities.formatDate(d, CRM_TIMEZONE, "yyyy-MM-dd"));
    d = addDays_(d, 1);
    guard++;
  }
  return dates;
}

function getObjects_(sh) {
  const values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(function(row) {
    return row.some(function(v) { return String(v || "").trim() !== ""; });
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function getObjectsWithRowNumbers_(sh) {
  const values = sh.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(function(row, idx) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return { rowNumber: idx + 2, row: obj };
  }).filter(function(item) {
    return Object.keys(item.row).some(function(k) {
      return String(item.row[k] || "").trim() !== "";
    });
  });
}

function getObjectAtRow_(sh, rowNumber) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(String);
  const values = sh.getRange(rowNumber, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const obj = {};
  headers.forEach(function(header, idx) {
    obj[header] = values[idx];
  });
  return obj;
}

function appendObject_(sh, obj) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const sheetName = sh.getName();
  const row = headers.map(function(h) { return obj[h] !== undefined ? valueForSheet_(sheetName, h, obj[h]) : ""; });
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
}

function writeObjectToRow_(sh, rowNumber, obj) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const sheetName = sh.getName();
  sh.getRange(rowNumber, 1, 1, headers.length).setValues([
    headers.map(function(h) { return obj[h] !== undefined ? valueForSheet_(sheetName, h, obj[h]) : ""; })
  ]);
}

function writeObjectsToRowsBatch_(sh, updates) {
  if (!sh || !updates || !updates.length) return;
  const lastCol = sh.getLastColumn();
  const lastRow = sh.getLastRow();
  if (lastCol < 1 || lastRow < 2) return;
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const sheetName = sh.getName();
  const body = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  updates.forEach(function(update) {
    const index = Number(update.rowNumber) - 2;
    if (index < 0 || index >= body.length) return;
    const obj = update.row || {};
    body[index] = headers.map(function(header) {
      return obj[header] !== undefined ? valueForSheet_(sheetName, header, obj[header]) : "";
    });
  });
  sh.getRange(2, 1, body.length, lastCol).setValues(body);
}

function logActivity_(ss, guestId, inquiryId, bookingId, actor, activityType, oldValue, newValue, notes) {
  appendObject_(ss.getSheetByName(CRM_TABS.activity), {
    activity_id: makeId_("ACT"),
    created_at: nowIso_(),
    guest_id: guestId,
    inquiry_id: inquiryId,
    booking_id: bookingId,
    actor: actor,
    activity_type: activityType,
    old_value: oldValue,
    new_value: newValue,
    notes: notes
  });
}

function keepBest_(oldValue, newValue) {
  return clean_(oldValue) || clean_(newValue);
}

function mergeNotes_(oldValue, newValue) {
  const oldClean = clean_(oldValue);
  const newClean = clean_(newValue);
  if (!oldClean) return newClean;
  if (!newClean || oldClean.indexOf(newClean) >= 0) return oldClean;
  return oldClean + "\n" + newClean;
}

function mergeDistinctText_(oldValue, newValue) {
  const oldClean = clean_(oldValue);
  const newClean = clean_(newValue);
  if (!oldClean) return newClean;
  if (!newClean || oldClean.split(/\s*\|\s*/).indexOf(newClean) >= 0) return oldClean;
  return oldClean + " | " + newClean;
}

function keepNonDefault_(oldValue, newValue, defaultValue) {
  const oldClean = clean_(oldValue);
  const newClean = clean_(newValue);
  if (oldClean && oldClean !== defaultValue) return oldClean;
  if (newClean && newClean !== defaultValue) return newClean;
  return oldClean || newClean || defaultValue;
}

function chooseStrongerInquiryStatus_(oldStatus, newStatus) {
  const order = {
    new: 1,
    contacted: 2,
    planning: 3,
    qualified: 4,
    quoted: 5,
    follow_up: 6,
    deposit_pending: 7,
    deposit_paid: 8,
    booked: 9,
    completed: 10,
    cancelled: 10,
    did_not_book: 10,
    lost: 10
  };
  const oldClean = clean_(oldStatus) || "new";
  const newClean = clean_(newStatus) || "new";
  return (order[newClean] || 0) > (order[oldClean] || 0) ? newClean : oldClean;
}

function chooseStrongerPriority_(oldPriority, newPriority) {
  const order = { low: 1, normal: 2, high: 3, urgent: 4 };
  const oldClean = clean_(oldPriority) || "normal";
  const newClean = clean_(newPriority) || "normal";
  return (order[newClean] || 0) > (order[oldClean] || 0) ? newClean : oldClean;
}

function preferSourceType_(oldValue, newValue) {
  const oldClean = clean_(oldValue);
  const newClean = clean_(newValue);
  if (oldClean && oldClean !== "manual_pending_guest") return oldClean;
  return newClean || oldClean;
}

function preferSpecificTourType_(oldValue, newValue) {
  const oldClean = clean_(oldValue);
  const newClean = clean_(newValue);
  const generic = { "": true, "Other": true, "Birdwatching": true };
  if (oldClean && !generic[oldClean]) return oldClean;
  return newClean || oldClean;
}

function joinPhone_(countryCode, phone) {
  const cc = clean_(countryCode).replace(/\D/g, "");
  const p = clean_(phone);
  if (!cc) return p;
  return "+" + cc + " " + p;
}

function splitName_(fullName) {
  const parts = clean_(fullName).split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || "",
    lastName: parts.join(" ")
  };
}

function clean_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hasBadWorkflowArtifact_(value) {
  const text = clean_(value);
  return text.indexOf("$(") >= 0 ||
    text.indexOf("{{") >= 0 ||
    text.indexOf("}}") >= 0 ||
    text.indexOf("#ERROR!") >= 0 ||
    text.indexOf("What tour is the guest interested in") >= 0;
}

function makeId_(prefix) {
  const stamp = Utilities.formatDate(new Date(), CRM_TIMEZONE, "yyyyMMddHHmmss");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return prefix + "-" + stamp + "-" + rand;
}

function nowIso_() {
  return Utilities.formatDate(new Date(), CRM_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function todayIso_() {
  return Utilities.formatDate(new Date(), CRM_TIMEZONE, "yyyy-MM-dd");
}

function addDaysIso_(dateIso, days) {
  const d = parseIsoDate_(dateIso);
  d.setDate(d.getDate() + Number(days || 0));
  return Utilities.formatDate(d, CRM_TIMEZONE, "yyyy-MM-dd");
}

function parseIsoDate_(dateIso) {
  const parts = String(dateIso || "").split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDays_(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}


/**
 * Imports completed accounting history without duplicating existing rows.
 *
 * Safe to run more than once. Identity is matched by normalized email first,
 * then normalized phone. Each accounting row is keyed by tour_key (preferred)
 * or invoice/date/service. Multiple services on one invoice remain separate
 * crm_bookings under one completed crm_inquiries record.
 */
function importCompletedInvoiceHistory() {
  const ACCOUNTING_SPREADSHEET_ID = "1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU";
  const ACCOUNTING_TAB = "invoices";
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  setupCrmSchema_(ss);
  const invoiceSheet = SpreadsheetApp.openById(ACCOUNTING_SPREADSHEET_ID).getSheetByName(ACCOUNTING_TAB);
  if (!invoiceSheet) throw new Error("Missing accounting invoices tab.");

  const invoiceRows = getObjects_(invoiceSheet).filter(function(row) {
    return ["yes", "true", "1", "completed"].indexOf(clean_(row.tour_completed).toLowerCase()) >= 0;
  });
  const guestSheet = ss.getSheetByName(CRM_TABS.guests);
  const inquirySheet = ss.getSheetByName(CRM_TABS.inquiries);
  const bookingSheet = ss.getSheetByName(CRM_TABS.bookings);
  const paymentSheet = ss.getSheetByName(CRM_TABS.payments);
  const activitySheet = ss.getSheetByName(CRM_TABS.activity);
  let guests = getObjectsWithRowNumbers_(guestSheet);
  let inquiries = getObjectsWithRowNumbers_(inquirySheet);
  let bookings = getObjectsWithRowNumbers_(bookingSheet);
  let payments = getObjectsWithRowNumbers_(paymentSheet);
  const grouped = {};

  invoiceRows.forEach(function(row, index) {
    const invoiceNo = clean_(row.invoice_no_txt || row.invoice_no || row.invoice_id || ("row-" + (index + 2)));
    if (!grouped[invoiceNo]) grouped[invoiceNo] = [];
    grouped[invoiceNo].push(row);
  });

  let guestCount = 0;
  let inquiryCount = 0;
  let bookingCount = 0;
  let paymentCount = 0;
  Object.keys(grouped).forEach(function(invoiceNo) {
    const rows = grouped[invoiceNo];
    const primary = rows[0];
    const emailNormalized = clean_(primary.guest_email).toLowerCase();
    const phoneNormalized = normalizePhone_(primary.guest_phone);
    let guestItem = guests.find(function(item) {
      return (emailNormalized && clean_(item.row.email_normalized || item.row.email).toLowerCase() === emailNormalized) ||
        (phoneNormalized && clean_(item.row.phone_normalized) === phoneNormalized);
    });
    const now = nowIso_();
    if (!guestItem) {
      const guest = {
        guest_id: makeId_("G"), created_at: now, updated_at: now,
        first_contact_at: clean_(primary.date_paid || primary.tour_date) || now,
        last_contact_at: clean_(primary.date_paid || primary.tour_date) || now,
        first_name: clean_(primary.guest_first_name), last_name: clean_(primary.guest_last_name),
        full_name: [clean_(primary.guest_first_name), clean_(primary.guest_last_name)].filter(Boolean).join(" "),
        email: clean_(primary.guest_email), email_normalized: emailNormalized,
        phone_raw: clean_(primary.guest_phone), phone_normalized: phoneNormalized,
        country: clean_(primary.home_country), preferred_language: "", guest_type: "Past Guest",
        vip_status: "No", source_first: "accounting_history", source_latest: "accounting_history",
        total_inquiries: "0", total_confirmed_bookings: "0",
        duplicate_key: emailNormalized || phoneNormalized || makeId_("HIST"),
        status: "active", notes: "Imported from completed accounting history.",
        last_completed_tour_date: normalizeDateForSheet_(primary.tour_date),
        total_completed_tours: "0", lifetime_value: ""
      };
      appendObject_(guestSheet, guest);
      guestItem = { row: guest, rowNumber: guestSheet.getLastRow() };
      guests.push(guestItem);
      guestCount++;
    }

    const sourceRecordId = "accounting_invoice:" + invoiceNo;
    const completedTourDate = normalizeDateForSheet_(primary.tour_date);
    let inquiryItem = inquiries.find(function(item) {
      return splitMergedField_(item.row.source_record_id).indexOf(sourceRecordId) >= 0;
    });
    if (!inquiryItem) {
      inquiryItem = inquiries.find(function(item) {
        const row = item.row;
        const archived = ["yes", "true", "1"].indexOf(clean_(row.is_archived).toLowerCase()) >= 0;
        const rowDate = normalizeDateForSheet_(row.requested_date_start || row.requested_date || row.completed_date);
        return !archived && clean_(row.guest_id) === clean_(guestItem.row.guest_id) &&
          rowDate === completedTourDate;
      });
    }
    if (!inquiryItem) {
      const inquiry = {
        inquiry_id: makeId_("INQ"), guest_id: guestItem.row.guest_id,
        created_at: clean_(primary.date_paid || primary.tour_date) || now, updated_at: now,
        source_type: "accounting_history", source_tab: "invoices", source_row: "",
        source_page: "", assigned_to: "", status: "completed", stage_changed_at: now,
        last_contacted_at: "", followup_date: "", next_action: "Completed tour history",
        priority: "", first_name: clean_(primary.guest_first_name),
        last_name: clean_(primary.guest_last_name),
        full_name: [clean_(primary.guest_first_name), clean_(primary.guest_last_name)].filter(Boolean).join(" "),
        email: clean_(primary.guest_email), email_normalized: emailNormalized,
        phone_raw: clean_(primary.guest_phone), phone_normalized: phoneNormalized,
        requested_date_start: normalizeDateForSheet_(primary.tour_date),
        requested_date_end: normalizeDateForSheet_(primary.tour_date),
        requested_date_text: normalizeDateForSheet_(primary.tour_date),
        guest_count: clean_(primary.party_size), guest_count_text: clean_(primary.party_size),
        tour_type: rows.map(function(row) { return clean_(row.service_type || row.product_selected); }).filter(Boolean).join(" + "),
        tour_category: clean_(primary.service_type), accommodation_needs: "",
        transportation_needed: "Unknown", pickup_location: clean_(primary.pickup_location),
        special_interests: "", message_questions: "", internal_notes: "Imported from invoice " + invoiceNo,
        availability_status: "unavailable", quote_status: "accepted", payment_status: clean_(primary.date_paid) ? "paid" : "unpaid",
        quoted_amount: clean_(primary.final_invoice_total || primary.amount_received),
        quoted_currency: "USD", confirmed_date: normalizeDateForSheet_(primary.date_paid),
        completed_date: normalizeDateForSheet_(primary.tour_date), lost_reason: "",
        source_record_id: sourceRecordId, grouping_preference: "unknown",
        grouping_status: "unmatched", departure_id: "", is_archived: "No",
        archived_at: "", archive_reason: "", superseded_by_inquiry_id: "",
        return_sequence: String(inquiries.filter(function(item) { return clean_(item.row.guest_id) === guestItem.row.guest_id; }).length + 1)
      };
      appendObject_(inquirySheet, inquiry);
      inquiryItem = { row: inquiry, rowNumber: inquirySheet.getLastRow() };
      inquiries.push(inquiryItem);
      inquiryCount++;
    }

    rows.forEach(function(row, index) {
      const tourKey = clean_(row.tour_key) || [invoiceNo, normalizeDateForSheet_(row.tour_date), clean_(row.service_type), clean_(row.product_selected), index + 1].join("|");
      if (bookings.some(function(item) { return clean_(item.row.source_key || item.row.tour_key) === tourKey; })) return;
      const booking = {
        booking_id: makeId_("BKG"), inquiry_id: inquiryItem.row.inquiry_id,
        guest_id: guestItem.row.guest_id, created_at: clean_(row.date_paid) || now, updated_at: now,
        booking_status: "completed", tour_date_start: normalizeDateForSheet_(row.tour_date),
        tour_date_end: normalizeDateForSheet_(row.tour_date), tour_date_text: normalizeDateForSheet_(row.tour_date),
        party_size: clean_(row.party_size), service_type: clean_(row.service_type),
        product_selected: clean_(row.product_selected), tour_guide: clean_(row.tour_guide),
        pickup_location: clean_(row.pickup_location), total_booking_price: clean_(row.final_invoice_total || row.amount_received),
        quoted_currency: "USD", deposit_required: "", balance_due_date: "",
        calendar_event_id: "", operations_notes: clean_(row.notes),
        source_system: "accounting", source_key: tourKey, invoice_no: invoiceNo,
        tour_key: tourKey, completed_at: normalizeDateForSheet_(row.tour_date),
        is_archived: "No", archived_at: "", archive_reason: ""
      };
      appendObject_(bookingSheet, booking);
      bookings.push({ row: booking, rowNumber: bookingSheet.getLastRow() });
      bookingCount++;
    });

    const paymentKey = "accounting_invoice:" + invoiceNo;
    if (!payments.some(function(item) { return clean_(item.row.payment_reference_note) === paymentKey; })) {
      const payment = {
        payment_id: makeId_("PAY"), booking_id: "", inquiry_id: inquiryItem.row.inquiry_id,
        guest_id: guestItem.row.guest_id, created_at: clean_(primary.date_paid) || now,
        payment_status: clean_(primary.date_paid) ? "paid" : "unpaid",
        payment_date: normalizeDateForSheet_(primary.date_paid), payment_method: clean_(primary.payment_method),
        paid_to: "", invoice_id: invoiceNo, transaction_id: clean_(primary.transaction_id),
        payment_reference_note: paymentKey,
        total_booking_price: clean_(primary.final_invoice_total || primary.amount_received),
        deposit_amount_paid: "", additional_amount_paid: "",
        total_amount_paid: clean_(primary.amount_received || primary.final_invoice_total),
        balance_remaining: "0", is_fully_paid: clean_(primary.date_paid) ? "Yes" : "",
        notes: "Imported from completed accounting history."
      };
      appendObject_(paymentSheet, payment);
      payments.push({ row: payment, rowNumber: paymentSheet.getLastRow() });
      paymentCount++;
    }

    appendObject_(activitySheet, {
      activity_id: makeId_("ACT"), created_at: now, guest_id: guestItem.row.guest_id,
      inquiry_id: inquiryItem.row.inquiry_id, booking_id: "", actor: "migration",
      activity_type: "completed_history_import", old_value: "", new_value: invoiceNo,
      notes: "Idempotent accounting history import."
    });
  });

  consolidateCompletedTripInquiries();
  refreshGuestLifecycleStats();
  createCrmViewTabs();
  Logger.log(JSON.stringify({
    completedInvoiceGroups: Object.keys(grouped).length,
    guestsCreated: guestCount, inquiriesCreated: inquiryCount,
    bookingsCreated: bookingCount, paymentsCreated: paymentCount
  }));
}

/**
 * ONE-TIME CRM NOTES CLEANUP
 *
 * Creates a timestamped backup of crm_inquiries, then removes exact repeated
 * paragraphs from notes and message_questions. Unique information is retained.
 * Run cleanupCrmRepeatedNoteParagraphs() once after saving this script.
 */
function cleanupCrmRepeatedNoteParagraphs() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName("crm_inquiries");
  if (!sheet) throw new Error("Missing crm_inquiries tab.");

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    Logger.log("No CRM rows to clean.");
    return;
  }

  const headers = values[0].map(function(value) {
    return String(value || "").trim().toLowerCase();
  });
  const notesColumn = headers.indexOf("notes");
  const questionsColumn = headers.indexOf("message_questions");
  if (notesColumn < 0) {
    throw new Error("The crm_inquiries tab does not contain a notes column.");
  }

  const timezone = spreadsheet.getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  const backupName = "crm_inquiries_notes_backup_" +
    Utilities.formatDate(new Date(), timezone, "yyyyMMdd_HHmmss");
  sheet.copyTo(spreadsheet).setName(backupName);

  let notesChanged = 0;
  let questionsChanged = 0;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const originalNotes = String(values[rowIndex][notesColumn] || "").trim();
    const cleanedNotes = dedupeCrmNoteParagraphs_(originalNotes);
    if (cleanedNotes !== originalNotes) {
      values[rowIndex][notesColumn] = cleanedNotes;
      notesChanged += 1;
    }

    // Keep message_questions as an independent source field. This only removes
    // repetitions already inside it and never copies notes into the column.
    if (questionsColumn >= 0) {
      const originalQuestions = String(values[rowIndex][questionsColumn] || "").trim();
      const cleanedQuestions = dedupeCrmNoteParagraphs_(originalQuestions);
      if (cleanedQuestions !== originalQuestions) {
        values[rowIndex][questionsColumn] = cleanedQuestions;
        questionsChanged += 1;
      }
    }
  }

  // Write only the two text columns being cleaned. Rewriting the entire row can
  // fail when an unrelated legacy value violates a newer validation rule.
  const dataRowCount = values.length - 1;
  const cleanedNotesValues = values.slice(1).map(function(row) {
    return [row[notesColumn]];
  });
  sheet.getRange(2, notesColumn + 1, dataRowCount, 1).setValues(cleanedNotesValues);
  if (questionsColumn >= 0) {
    const cleanedQuestionValues = values.slice(1).map(function(row) {
      return [row[questionsColumn]];
    });
    sheet.getRange(2, questionsColumn + 1, dataRowCount, 1).setValues(cleanedQuestionValues);
  }
  SpreadsheetApp.flush();

  Logger.log(JSON.stringify({
    backupTab: backupName,
    notesRowsCleaned: notesChanged,
    messageQuestionRowsCleaned: questionsChanged
  }));
}

function dedupeCrmNoteParagraphs_(value) {
  const seen = {};
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n|\n/)
    .map(function(part) { return part.trim(); })
    .filter(function(part) {
      if (!part) return false;
      const key = part
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[.\s]+$/g, "");
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    })
    .join("\n\n");
}
