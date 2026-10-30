import { authorize } from "../whatsapp/index.js";

const SHEET_ID = "1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU";
const TABS = ["daily_recon", "guide_payment_queue", "guide_settlements", "guide_ledger", "expenses", "growth_dashboard", "invoices", "report_income_summary"];
const reply = (status, body) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
const text = value => String(value ?? "").trim();
const number = value => { const n = Number(text(value).replace(/[$,%\s,]/g, "")); return Number.isFinite(n) ? n : 0; };
const validMonth = value => /^\d{4}-\d{2}$/.test(text(value));
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(text(value));

function parseCsv(source) {
  const rows = []; let row = [], field = "", quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = (rows.shift() || []).map(text);
  return rows.filter(values => values.some(text)).map(values => Object.fromEntries(headers.map((header, index) => [header || `_${index}`, values[index] ?? ""])));
}

async function tab(name) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
  const response = await fetch(url, { headers: { "user-agent": "MBW-Accounting-Dashboard/2.0" } });
  if (!response.ok) throw new Error(`${name}_unavailable`);
  return parseCsv(await response.text());
}

function guayaquilToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function serviceDate(row) {
  if (validDate(row.tour_date)) return text(row.tour_date);
  return text(row.tour_key).match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
}

function guideSummary(rows, today) {
  const grouped = new Map();
  for (const row of rows) {
    const guide = text(row.guide) || "Unassigned", remaining = Math.max(0, number(row.remaining_due));
    if (!remaining) continue;
    const date = serviceDate(row), completed = date && date <= today;
    const item = grouped.get(guide) || { guide, due: 0, dueCount: 0, future: 0, futureCount: 0, oldestDue: "" };
    if (completed) { item.due += remaining; item.dueCount += 1; if (!item.oldestDue || date < item.oldestDue) item.oldestDue = date; }
    else { item.future += remaining; item.futureCount += 1; }
    grouped.set(guide, item);
  }
  return [...grouped.values()].sort((a, b) => b.due - a.due || a.guide.localeCompare(b.guide));
}

function activitySummary(invoices, year, month) {
  const grouped = new Map();
  for (const row of invoices) {
    if (text(row.revenue_status) !== "Earned" || !text(row.earned_month).startsWith(year + "-")) continue;
    const code = text(row.product_selected) || "OTHER", title = text(row.tour_title) || code, serviceType = text(row.service_type) || "Other";
    const key = `${code}|${title}|${serviceType}`;
    const item = grouped.get(key) || { code, title, serviceType, revenue: 0, profit: 0, guests: 0, services: 0, monthRevenue: 0, monthProfit: 0, monthGuests: 0, monthServices: 0 };
    item.revenue += number(row.mbw_gross_actual); item.profit += number(row.mbw_profit_accrual); item.guests += number(row.party_size); item.services += 1;
    if (text(row.earned_month) === month) { item.monthRevenue += number(row.mbw_gross_actual); item.monthProfit += number(row.mbw_profit_accrual); item.monthGuests += number(row.party_size); item.monthServices += 1; }
    grouped.set(key, item);
  }
  return [...grouped.values()].map(item => ({ ...item, margin: item.revenue ? item.profit / item.revenue : 0, averageProfit: item.services ? item.profit / item.services : 0 })).sort((a, b) => b.profit - a.profit);
}

function weekdaySummary(invoices, year, month) {
  const grouped = new Map();
  for (const row of invoices) {
    if (text(row.revenue_status) !== "Earned" || !text(row.earned_month).startsWith(year + "-") || !validDate(row.tour_date)) continue;
    const serviceType = text(row.service_type) || "Other", weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(text(row.tour_date) + "T12:00:00Z")), key = `${serviceType}|${weekday}`;
    const item = grouped.get(key) || { serviceType, weekday, services: 0, revenue: 0, profit: 0, monthServices: 0, monthRevenue: 0, monthProfit: 0 };
    item.services += 1; item.revenue += number(row.mbw_gross_actual); item.profit += number(row.mbw_profit_accrual); grouped.set(key, item);
    if (text(row.earned_month) === month) { item.monthServices += 1; item.monthRevenue += number(row.mbw_gross_actual); item.monthProfit += number(row.mbw_profit_accrual); }
  }
  return [...grouped.values()].sort((a, b) => b.services - a.services || b.profit - a.profit);
}

function expenseMix(rows, year, currentMonth) {
  const grouped = new Map();
  for (const row of rows) {
    const month = text(row.accrual_month || row.expense_month); if (!month.startsWith(year + "-") || text(row.expense_status).toLowerCase() === "void") continue;
    const category = text(row.expense_category) || text(row.expense_type) || "Other";
    const item = grouped.get(category) || { amount: 0, monthAmount: 0 }; item.amount += Math.abs(number(row.amount)); if (month === currentMonth) item.monthAmount += Math.abs(number(row.amount)); grouped.set(category, item);
  }
  return [...grouped.entries()].map(([category, values]) => ({ category, ...values })).sort((a, b) => b.amount - a.amount);
}

function monthProjection(invoices, month, today) {
  let earnedProfit = 0, futureProfit = 0, earnedRevenue = 0, futureRevenue = 0, completedServices = 0, futureServices = 0;
  for (const row of invoices) {
    const date = text(row.tour_date), status = text(row.revenue_status), cancelled = /cancel/i.test(text(row.booking_status));
    if (!date.startsWith(month) || cancelled) continue;
    if (status === "Earned" || text(row.tour_completed) === "Yes") { earnedProfit += number(row.mbw_profit_accrual); earnedRevenue += number(row.mbw_gross_actual); completedServices += 1; }
    else if (status === "Deferred" && date >= today) { futureProfit += number(row.mbw_profit_accrual); futureRevenue += number(row.mbw_gross_actual || row.mbw_gross_expected); futureServices += 1; }
  }
  return { month, earnedProfit, futureProfit, projectedProfit: earnedProfit + futureProfit, earnedRevenue, futureRevenue, projectedRevenue: earnedRevenue + futureRevenue, completedServices, futureServices };
}

export async function onRequestGet({ request }) {
  const denied = await authorize(request); if (denied) return denied;
  try {
    const [daily, queue, settlements, ledger, expenses, growth, invoices, income] = await Promise.all(TABS.map(tab));
    const today = guayaquilToday(), month = today.slice(0, 7), year = today.slice(0, 4);
    const latestRecon = [...daily].filter(row => validDate(row.date)).sort((a, b) => text(a.date).localeCompare(text(b.date))).at(-1) || {};
    const ledgerSummary = ledger.find(row => text(row.ledger_id) === "ADLEDGER-SUMMARY") || [...ledger].reverse().find(row => text(row.transaction_type) === "Summary") || {};
    const guides = guideSummary(queue, today), monthExpenses = expenses.filter(row => text(row.accrual_month || row.expense_month) === month);
    const unreconciled = expenses.filter(row => text(row.reconciled).toLowerCase() !== "yes" && text(row.expense_status).toLowerCase() !== "void").length;
    const missingReceipts = expenses.filter(row => Math.abs(number(row.amount)) > 0 && !text(row.receipt_link) && text(row.payment_method) && !/stripe|paypal/i.test(text(row.payment_method))).length;
    const openSettlements = settlements.filter(row => text(row.settlement_id) && !/reconciled|settled|closed/i.test(text(row.status))).length;
    const ytd = growth.find(row => text(row["MBW Growth Dashboard period"]) === `${year} YTD`) || {};
    const current = growth.find(row => text(row["MBW Growth Dashboard period"]) === "Current Month") || {};
    const monthly = income.filter(row => validMonth(row.month_ky)).map(row => ({ month: text(row.month_ky), collected: number(row.cash_collected), revenue: number(row.earned_revenue), profit: number(row.earned_profit), expenses: number(row.expense_total), net: number(row.net_income), margin: number(row.earned_margin) / 100 })).sort((a, b) => a.month.localeCompare(b.month));
    return reply(200, {
      ok: true, updated_at: new Date().toISOString(), control_date: today,
      cash: { date: text(latestRecon.date), ledger_balance: number(latestRecon.running_expected_balance), restricted_ad_fund: number(latestRecon.restricted_ad_fund), available_operating_cash: number(latestRecon.available_operating_cash) },
      summary: { year, revenue: number(ytd.earned_revenue), profit: number(ytd.earned_profit), margin: number(ytd.earned_margin) / 100, guests: number(ytd.guests_served), services: number(ytd.completed_services), expenses: number(ytd.operating_expenses), net: number(ytd.net_income), currentMonthRevenue: number(current.earned_revenue), currentMonthProfit: number(current.earned_profit), currentMonthNet: number(current.net_income) },
      projection: monthProjection(invoices, month, today), monthly,
      activities: activitySummary(invoices, year, month), weekdays: weekdaySummary(invoices, year, month), expense_mix: expenseMix(expenses, year, month),
      guides, guide_totals: { due_completed: guides.reduce((sum, row) => sum + row.due, 0), completed_items: guides.reduce((sum, row) => sum + row.dueCount, 0), future_obligations: guides.reduce((sum, row) => sum + row.future, 0) },
      advertising_fund: { contribution_due: number(ledgerSummary.contribution_due), contribution_collected: number(ledgerSummary.contribution_collected), ad_spend_used: number(ledgerSummary.ad_spend_used), outstanding_from_guides: number(ledgerSummary.contribution_due_balance), available: number(ledgerSummary.advertising_fund_balance), status: text(ledgerSummary.notes) },
      expenses: { month, month_total: monthExpenses.reduce((sum, row) => sum + Math.abs(number(row.amount)), 0), unreconciled, missing_receipts: missingReceipts },
      controls: { open_settlements: openSettlements },
    });
  } catch (error) {
    console.error("Accounting dashboard feed failed", error);
    return reply(503, { ok: false, error: "accounting_dashboard_feed_unavailable" });
  }
}
