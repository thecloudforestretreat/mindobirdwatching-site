/**
 * MBW Accounting Dashboard secure source v1.0.0
 *
 * Add this file to the private MBW Invoice to Confirmation Sync project and
 * run configureAccountingDashboardPush as mindobirdwatching@gmail.com. The
 * owner-only trigger sends a minimal accounting snapshot to MBW Admin every
 * 15 minutes. Cloudflare Access is crossed with a scoped service token; the
 * admin site and this endpoint remain private.
 */

var ACCOUNTING_DASHBOARD_SOURCE_VERSION = "v1.0.1-2026-11-17";
var ACCOUNTING_DASHBOARD_SHEET_ID = "1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU";
var ACCOUNTING_DASHBOARD_SYNC_URL_PROPERTY = "ACCOUNTING_DASHBOARD_SYNC_URL";
var ACCOUNTING_DASHBOARD_SYNC_TOKEN_PROPERTY = "ACCOUNTING_DASHBOARD_SYNC_TOKEN";
var ACCOUNTING_DASHBOARD_CF_ACCESS_CLIENT_ID_PROPERTY = "ACCOUNTING_DASHBOARD_CF_ACCESS_CLIENT_ID";
var ACCOUNTING_DASHBOARD_CF_ACCESS_CLIENT_SECRET_PROPERTY = "ACCOUNTING_DASHBOARD_CF_ACCESS_CLIENT_SECRET";
var ACCOUNTING_DASHBOARD_PUSH_FUNCTION = "pushAccountingDashboardSnapshot";
var ACCOUNTING_DASHBOARD_FIELDS = {
  daily_recon: ["date", "running_expected_balance", "restricted_ad_fund", "available_operating_cash"],
  guide_payment_queue: ["guide", "remaining_due", "tour_date", "tour_key"],
  guide_settlements: ["settlement_id", "status"],
  guide_ledger: ["ledger_id", "transaction_type", "contribution_due", "contribution_collected", "ad_spend_used", "contribution_due_balance", "advertising_fund_balance", "notes"],
  expenses: ["expense_date", "expense_month", "accrual_month", "expense_type", "expense_category", "expense_status", "amount", "reconciled", "receipt_link", "payment_method", "tour_key", "invoice_no", "created_at", "updated_at", "paid_at"],
  growth_dashboard: ["MBW Growth Dashboard period", "year", "earned_revenue", "earned_profit", "earned_margin", "guests_served", "completed_services", "operating_expenses", "net_income"],
  invoices: ["date_paid", "tour_date", "tour_completed", "party_size", "service_type", "product_selected", "tour_title", "tour_key", "booking_status", "revenue_status", "earned_month", "mbw_gross_actual", "mbw_profit_accrual", "mbw_gross_expected", "mbw_profit_expected", "expense_reconciled_flag", "created_at", "updated_at", "paid_at"],
  report_income_summary: ["month_ky", "cash_collected", "earned_revenue", "earned_profit", "expense_total", "net_income", "earned_margin"],
  deposits: ["deposit_date", "tour_date", "balance_due_date", "booking_status", "deposit_status", "party_size", "total_booking_price", "total_amount_paid", "balance_remaining", "created_at", "updated_at", "paid_at"],
  recon_meta_ads_import: ["Expense Month", "Net Spend", "expense_month", "net_spend"]
};

function configureAccountingDashboardPush() {
  var properties = PropertiesService.getScriptProperties();
  var url = String(properties.getProperty(ACCOUNTING_DASHBOARD_SYNC_URL_PROPERTY) || "").trim();
  var token = String(properties.getProperty(ACCOUNTING_DASHBOARD_SYNC_TOKEN_PROPERTY) || "").trim();
  var accessClientId = String(properties.getProperty(ACCOUNTING_DASHBOARD_CF_ACCESS_CLIENT_ID_PROPERTY) || "").trim();
  var accessClientSecret = String(properties.getProperty(ACCOUNTING_DASHBOARD_CF_ACCESS_CLIENT_SECRET_PROPERTY) || "").trim();
  if (!/^https:\/\/admin\.mindobirdwatching\.com\/api\/admin\/accounting-dashboard-sync$/.test(url)) throw new Error("Set the private ACCOUNTING_DASHBOARD_SYNC_URL script property first.");
  if (!token) throw new Error("Set the private ACCOUNTING_DASHBOARD_SYNC_TOKEN script property first.");
  if (!accessClientId || !accessClientSecret) throw new Error("Set the private Cloudflare Access service-token properties first.");
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === ACCOUNTING_DASHBOARD_PUSH_FUNCTION) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(ACCOUNTING_DASHBOARD_PUSH_FUNCTION).timeBased().everyMinutes(15).create();
  var result = pushAccountingDashboardSnapshot();
  var audit = auditAccountingDashboardPush();
  console.log(JSON.stringify({ ok: true, configured: true, push: result, audit: audit }));
  return { ok: true, configured: true, push: result, audit: audit };
}

function pushAccountingDashboardSnapshot() {
  var properties = PropertiesService.getScriptProperties();
  var url = String(properties.getProperty(ACCOUNTING_DASHBOARD_SYNC_URL_PROPERTY) || "").trim();
  var token = String(properties.getProperty(ACCOUNTING_DASHBOARD_SYNC_TOKEN_PROPERTY) || "").trim();
  var accessClientId = String(properties.getProperty(ACCOUNTING_DASHBOARD_CF_ACCESS_CLIENT_ID_PROPERTY) || "").trim();
  var accessClientSecret = String(properties.getProperty(ACCOUNTING_DASHBOARD_CF_ACCESS_CLIENT_SECRET_PROPERTY) || "").trim();
  if (!url || !token || !accessClientId || !accessClientSecret) throw new Error("Accounting dashboard push is not configured.");
  var payload = buildAccountingDashboardSource_();
  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token,
      "CF-Access-Client-Id": accessClientId,
      "CF-Access-Client-Secret": accessClientSecret
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var body = response.getContentText();
  if (status < 200 || status >= 300) throw new Error("Dashboard snapshot push failed (" + status + "): " + body.slice(0, 500));
  var contentType = String(response.getHeaders()["Content-Type"] || response.getHeaders()["content-type"] || "").toLowerCase();
  if (contentType.indexOf("application/json") === -1) throw new Error("Dashboard sync returned non-JSON content (" + contentType + "). Check the Cloudflare Access service token.");
  var result;
  try { result = JSON.parse(body || "{}"); }
  catch (error) { throw new Error("Dashboard sync returned invalid JSON: " + error.message); }
  if (!result.ok) throw new Error("Dashboard snapshot was not accepted.");
  properties.setProperty("ACCOUNTING_DASHBOARD_LAST_PUSH_AT", String(result.received_at || new Date().toISOString()));
  properties.setProperty("ACCOUNTING_DASHBOARD_LAST_SOURCE_AT", String(payload.generated_at));
  console.log(JSON.stringify({ ok: true, generated_at: payload.generated_at, received_at: result.received_at }));
  return { ok: true, generated_at: payload.generated_at, received_at: result.received_at };
}

function auditAccountingDashboardPush() {
  var properties = PropertiesService.getScriptProperties();
  var triggers = ScriptApp.getProjectTriggers().filter(function(trigger) { return trigger.getHandlerFunction() === ACCOUNTING_DASHBOARD_PUSH_FUNCTION; });
  var result = {
    ok: true,
    executor: Session.getEffectiveUser().getEmail(),
    url_configured: !!properties.getProperty(ACCOUNTING_DASHBOARD_SYNC_URL_PROPERTY),
    token_configured: !!properties.getProperty(ACCOUNTING_DASHBOARD_SYNC_TOKEN_PROPERTY),
    access_service_token_configured: !!properties.getProperty(ACCOUNTING_DASHBOARD_CF_ACCESS_CLIENT_ID_PROPERTY) && !!properties.getProperty(ACCOUNTING_DASHBOARD_CF_ACCESS_CLIENT_SECRET_PROPERTY),
    trigger_count: triggers.length,
    trigger_minutes: 15,
    last_push_at: properties.getProperty("ACCOUNTING_DASHBOARD_LAST_PUSH_AT") || "",
    last_source_at: properties.getProperty("ACCOUNTING_DASHBOARD_LAST_SOURCE_AT") || ""
  };
  console.log(JSON.stringify(result));
  return result;
}

function buildAccountingDashboardSource_() {
  var spreadsheet = SpreadsheetApp.openById(ACCOUNTING_DASHBOARD_SHEET_ID);
  var tabs = {};
  Object.keys(ACCOUNTING_DASHBOARD_FIELDS).forEach(function(sheetName) {
    tabs[sheetName] = readAccountingDashboardTab_(spreadsheet, sheetName, ACCOUNTING_DASHBOARD_FIELDS[sheetName]);
  });
  return { ok: true, version: ACCOUNTING_DASHBOARD_SOURCE_VERSION, generated_at: new Date().toISOString(), tabs: tabs };
}

function readAccountingDashboardTab_(spreadsheet, sheetName, wantedFields) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error("Missing sheet: " + sheetName);
  var headerRow = sheetName === "recon_meta_ads_import" ? 6 : 1;
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < headerRow || lastColumn < 1) return [];
  var headers = sheet.getRange(headerRow, 1, 1, lastColumn).getDisplayValues()[0].map(function(value) { return String(value || "").trim(); });
  var indices = wantedFields.map(function(field) { return headers.indexOf(field); });
  if (lastRow === headerRow) return [];
  var keyValues = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, 1).getDisplayValues();
  var meaningfulRows = 0;
  for (var keyIndex = keyValues.length - 1; keyIndex >= 0; keyIndex--) {
    if (String(keyValues[keyIndex][0] || "").trim() !== "") { meaningfulRows = keyIndex + 1; break; }
  }
  if (!meaningfulRows) return [];
  var values = sheet.getRange(headerRow + 1, 1, meaningfulRows, lastColumn).getDisplayValues();
  return values.map(function(sourceRow) {
    var row = {};
    wantedFields.forEach(function(field, index) {
      var columnIndex = indices[index];
      row[field] = columnIndex >= 0 ? sourceRow[columnIndex] : "";
    });
    return row;
  }).filter(function(row) {
    return wantedFields.some(function(field) { return row[field] !== ""; });
  });
}
