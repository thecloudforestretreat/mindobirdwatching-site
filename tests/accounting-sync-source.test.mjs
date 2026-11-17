import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const file = new URL('../deployment/multi-invoice-ledger/stripe-invoices-sync-v1.5.5.gs', import.meta.url);
const source = fs.readFileSync(file, 'utf8');
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
