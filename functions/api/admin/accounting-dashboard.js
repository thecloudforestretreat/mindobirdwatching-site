import { authorize } from "../whatsapp/index.js";

const SHEET_ID = "1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU";
const TABS = ["daily_recon", "guide_payment_queue", "guide_settlements", "guide_ledger", "expenses"];
const reply = (status, body) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
const text = value => String(value ?? "").trim();
const number = value => { const n = Number(text(value).replace(/[$,%\s,]/g, "")); return Number.isFinite(n) ? n : 0; };

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
  const response = await fetch(url, { headers: { "user-agent": "MBW-Accounting-Dashboard/1.0" } });
  if (!response.ok) throw new Error(`${name}_unavailable`);
  return parseCsv(await response.text());
}

function guayaquilToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function serviceDate(row) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text(row.tour_date))) return text(row.tour_date);
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

export async function onRequestGet({ request }) {
  const denied = await authorize(request); if (denied) return denied;
  try {
    const [daily, queue, settlements, ledger, expenses] = await Promise.all(TABS.map(tab));
    const today = guayaquilToday();
    const latestRecon = [...daily].filter(row => /^\d{4}-\d{2}-\d{2}$/.test(text(row.date))).sort((a, b) => text(a.date).localeCompare(text(b.date))).at(-1) || {};
    const ledgerSummary = ledger.find(row => text(row.ledger_id) === "ADLEDGER-SUMMARY") || [...ledger].reverse().find(row => text(row.transaction_type) === "Summary") || {};
    const guides = guideSummary(queue, today);
    const month = today.slice(0, 7), monthExpenses = expenses.filter(row => text(row.accrual_month || row.expense_month) === month);
    const unreconciled = expenses.filter(row => text(row.reconciled).toLowerCase() !== "yes" && text(row.expense_status).toLowerCase() !== "void").length;
    const missingReceipts = expenses.filter(row => Math.abs(number(row.amount)) > 0 && !text(row.receipt_link) && text(row.payment_method) && !/stripe|paypal/i.test(text(row.payment_method))).length;
    const openSettlements = settlements.filter(row => text(row.settlement_id) && !/reconciled|settled|closed/i.test(text(row.status))).length;
    return reply(200, {
      ok: true,
      updated_at: new Date().toISOString(),
      control_date: today,
      cash: {
        date: text(latestRecon.date),
        ledger_balance: number(latestRecon.running_expected_balance),
        restricted_ad_fund: number(latestRecon.restricted_ad_fund),
        available_operating_cash: number(latestRecon.available_operating_cash),
      },
      guides,
      guide_totals: {
        due_completed: guides.reduce((sum, row) => sum + row.due, 0),
        completed_items: guides.reduce((sum, row) => sum + row.dueCount, 0),
        future_obligations: guides.reduce((sum, row) => sum + row.future, 0),
      },
      advertising_fund: {
        contribution_due: number(ledgerSummary.contribution_due),
        contribution_collected: number(ledgerSummary.contribution_collected),
        ad_spend_used: number(ledgerSummary.ad_spend_used),
        outstanding_from_guides: number(ledgerSummary.contribution_due_balance),
        available: number(ledgerSummary.advertising_fund_balance),
        status: text(ledgerSummary.notes),
      },
      expenses: {
        month,
        month_total: monthExpenses.reduce((sum, row) => sum + Math.abs(number(row.amount)), 0),
        unreconciled,
        missing_receipts: missingReceipts,
      },
      controls: { open_settlements: openSettlements },
    });
  } catch (error) {
    console.error("Accounting dashboard feed failed", error);
    return reply(503, { ok: false, error: "accounting_dashboard_feed_unavailable" });
  }
}
