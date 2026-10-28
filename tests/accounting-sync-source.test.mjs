import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const file = new URL('../deployment/multi-invoice-ledger/stripe-invoices-sync-v1.4.4.gs', import.meta.url);
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

test('dropdown values are canonicalized without losing the approved label', () => {
  const allowed = ['Birdwatching', 'Wildlife', 'Nature Excursion'];
  assert.equal(context.canonicalizeSyncValueAgainstAllowed_('birdwatching', allowed), 'Birdwatching');
  assert.equal(context.canonicalizeSyncValueAgainstAllowed_('nature_excursion', allowed), 'Nature Excursion');
  assert.equal(context.canonicalizeSyncValueAgainstAllowed_('unknown', allowed), null);
});

test('only materially identical automatic expenses qualify as duplicates', () => {
  const base = {
    expense_id: 'MBW-0142', expense_date: '2026-11-22', expense_month: '2026-11',
    expense_type: 'Guide Payout', invoice_no: 'MBW-0142', tour_date: '2026-11-22',
    tour_completed: 'No', paid_to: 'Chicho', payment_method: 'Pending', amount: -105.93,
    notes: 'Product MBW005.', expense_category: 'COGS', accrual_month: '2026-11',
    reconciled: 'No', guide_paid_actual: 0, fees_paid_actual: 0,
    expense_reconciled_flag: 'No', expense_key: 'service|same', ledger_entry_id: 'EXP-000390',
    product_selected: 'MBW005', service_type: 'Birdwatching', tour_key: 'same',
    invoice_id: 'in_same', transaction_id: 'pi_same', source_type: 'Automatic',
    source_record_id: 'service|same', expense_status: 'Pending'
  };
  assert.equal(context.isExactAutomaticExpenseDuplicate_(base, { ...base }), true);
  assert.equal(context.isExactAutomaticExpenseDuplicate_(base, { ...base, amount: -100 }), false);
  assert.equal(context.isExactAutomaticExpenseDuplicate_(base, { ...base, ledger_entry_id: 'EXP-OTHER' }), false);
});
