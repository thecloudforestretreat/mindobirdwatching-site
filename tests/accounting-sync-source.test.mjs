import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const file = new URL('../deployment/multi-invoice-ledger/stripe-invoices-sync-v1.5.5.gs', import.meta.url);
const depositFile = new URL('../deployment/multi-invoice-ledger/deposit-due-calendar-v1.0.0.gs', import.meta.url);
const source = fs.readFileSync(file, 'utf8') + '\n' + fs.readFileSync(depositFile, 'utf8');
const context = {
  console,
  Utilities: {
    formatDate(value, _timeZone, pattern) {
      const date = new Date(value);
      const yyyy = String(date.getFullYear());
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return pattern === 'yyyy-MM' ? `${yyyy}-${mm}` : `${yyyy}-${mm}-${dd}`;
    }
  },
  Session: { getScriptTimeZone: () => 'America/Guayaquil' }
};
vm.createContext(context);
vm.runInContext(source, context);

test('Stripe invoice mapping carries service_type into invoices', () => {
  assert.equal(context.getStripeToInvoiceMapping_().service_type, 'service_type');
});

test('Stripe invoice mapping carries provider cost into the guide-rate override', () => {
  assert.equal(context.getStripeToInvoiceMapping_().guide_base_rate, 'guide_base_rate_override');
});

test('service expense rejects zero and negative payables instead of converting them to payouts', () => {
  const base = {
    invoice_no: 'MBW-0155',
    product_selected: 'ACCOM01',
    tour_guide: 'Other',
    tour_key: 'in_1|5|ACCOM01|2026-11-22|1',
    total_amount_owed_to_guide: -1.04,
    service_type: 'Accommodation',
    tour_date: '2026-11-22'
  };
  assert.equal(context.buildServiceExpense_(base), null);
  assert.equal(context.buildServiceExpense_({ ...base, total_amount_owed_to_guide: 0 }), null);
  assert.equal(context.buildServiceExpense_({ ...base, total_amount_owed_to_guide: 8.96 }).amount, -8.96);
});

test('expense sync runs on every invoice pass without creating competing triggers', () => {
  assert.match(source, /reason:\s*"another_sync_is_running"[\s\S]*retry_scheduled:\s*false[\s\S]*retry_source:\s*"next_invoice_sync"/);
  assert.doesNotMatch(source, /ScriptApp\.newTrigger\(MBW_EXPENSE_RETRY_HANDLER\)/);
  assert.doesNotMatch(source, /newTrigger\(MBW_EXPENSE_SYNC_HANDLER\)/);
  const syncHandler = source.match(/function syncStripeInvoicesToInvoices\(e\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(syncHandler, /invoiceRowsChanged\s*=\s*imported > 0 \|\| recovered > 0 \|\| backfilled > 0/);
  assert.match(syncHandler, /expenseResult\s*=\s*syncInvoicesToExpensesUnlocked_\(ss\)/);
  assert.doesNotMatch(syncHandler, /if \(invoiceRowsChanged\) \{\s*expenseResult\s*=\s*syncInvoicesToExpensesUnlocked_\(ss\)/);
  assert.match(syncHandler, /expenses_deferred_to_separate_trigger:\s*false/);
});

test('guide queue refreshes existing obligations when completion changes', () => {
  const queueSync = source.match(/function syncGuidePaymentQueue_\(ss, invoiceObjects\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(queueSync, /Completed service; payment due\./);
  assert.match(queueSync, /Past service date; completion review required before payment\./);
  assert.match(queueSync, /headers\.index\.notes \+ 1\)\.setValue\(obligationNote\)/);
  assert.match(queueSync, /if \(tourDateKey < todayKey \|\| isCompleted\)/);
});

test('dropdown values are canonicalized without losing the approved label', () => {
  const allowed = ['Birdwatching', 'Wildlife', 'Nature Excursion'];
  assert.equal(context.canonicalizeSyncValueAgainstAllowed_('birdwatching', allowed), 'Birdwatching');
  assert.equal(context.canonicalizeSyncValueAgainstAllowed_('nature_excursion', allowed), 'Nature Excursion');
  assert.equal(context.canonicalizeSyncValueAgainstAllowed_('unknown', allowed), null);
});

test('invoice last-row lookup reads only the invoice identity column, not all 111 columns', () => {
  const calls = [];
  const values = Array.from({ length: 29782 }, () => ['']);
  values[281][0] = 'MBW-0156';
  const sheet = {
    getLastRow() { return 29783; },
    getRange(row, column, rows, columns) {
      calls.push(['range', row, column, rows, columns]);
      return { getDisplayValues() { calls.push(['displayValues']); return values; } };
    }
  };

  assert.equal(context.getLastNonBlankRowInColumn_(sheet, 1), 283);
  assert.deepEqual(calls, [
    ['range', 2, 1, 29782, 1],
    ['displayValues']
  ]);
});

test('invoice last-row lookup returns the header row when no invoices exist', () => {
  const sheet = {
    getLastRow() { return 1000; },
    getRange() { return { getDisplayValues() { return Array.from({ length: 999 }, () => ['']); } }; }
  };
  assert.equal(context.getLastNonBlankRowInColumn_(sheet, 1), 1);
});

test('deposit reminder eligibility excludes paid, cancelled, refunded, and zero-balance rows', () => {
  const base = {
    deposit_id: 'DEP-QA-1',
    booking_status: 'Deposit Paid',
    deposit_status: 'Deposit Paid',
    balance_due_date: '2026-11-25',
    tour_date: '2026-12-09',
    guest_first_name: 'QA',
    guest_last_name: 'Guest',
    balance_remaining: 125,
    total_booking_price: 225,
    total_amount_paid: 100,
    is_fully_paid: 'No'
  };
  assert.equal(context.depositDueCandidate_(base).balance, 125);
  assert.equal(context.depositDueCandidate_({ ...base, is_fully_paid: 'Yes' }), null);
  assert.equal(context.depositDueCandidate_({ ...base, booking_status: 'Cancelled' }), null);
  assert.equal(context.depositDueCandidate_({ ...base, deposit_status: 'Refunded' }), null);
  assert.equal(context.depositDueCandidate_({ ...base, balance_remaining: 0 }), null);
});

test('deposit Calendar title and description are internal, specific, and exclude guest contact details', () => {
  const candidate = context.depositDueCandidate_({
    deposit_id: 'DEP-QA-2',
    inquiry_id: 'INQ-QA-2',
    booking_status: 'Deposit Paid',
    deposit_status: 'Deposit Paid',
    balance_due_date: '2026-11-25',
    tour_date: '2026-12-09',
    guest_first_name: 'QA',
    guest_last_name: 'Guest',
    guest_email: 'private@example.invalid',
    guest_phone: '+10000000000',
    balance_remaining: 125,
    total_booking_price: 225,
    total_amount_paid: 100,
    is_fully_paid: 'No'
  });
  assert.equal(context.depositDueEventTitle_(candidate), 'Deposit balance due — QA Guest — US$125.00');
  const description = context.depositDueEventDescription_(candidate);
  assert.match(description, /DEP-QA-2/);
  assert.match(description, /INQ-QA-2/);
  assert.match(description, /Guests are not invited/);
  assert.doesNotMatch(description, /private@example/);
  assert.doesNotMatch(description, /10000000000/);
});

test('deposit Calendar lock is isolated from the accounting sync', () => {
  const depositSource = fs.readFileSync(depositFile, 'utf8');
  assert.match(depositSource, /LockService\.getUserLock\(\)/);
  assert.doesNotMatch(depositSource, /LockService\.getScriptLock\(\)/);
});
