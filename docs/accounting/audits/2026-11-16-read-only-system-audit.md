# MBW Accounting System — Read-Only Audit

Audit date: **2026-11-16**  
Business timezone: **America/Guayaquil**  
Production workbook: `1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU`

## Post-audit implementation note

After this read-only audit was completed, the approved stabilization work was applied to production. Apps Script v1.5.5 now bounds invoice reads to the last populated `invoice_no`, preserves the stricter invoice-source protections, and passed local and live QA. The active `invoices` grid was then reduced from 29,783 rows to 1,000 rows after confirming the populated ledger ended at row 283 and that the native backup was available. This reduced the active grid from 3,305,913 cells to 111,000 cells without removing populated invoice rows. The original findings below remain the evidence that justified the implementation.

The post-change expense run reported one intentionally waiting service row: `invoices` row 265, invoice `MBW-0148`, product `ACT016`, guide `Neicer`. Its calculated provider payout is zero, so v1.5.5 correctly refuses to create a payout expense until the rate or payable amount is resolved.

## Scope and safety boundary

This was a read-only audit performed after the 2026-11-16 baseline and native Google Sheets backup. No production cells, formulas, formatting, triggers, Apps Script code, Stripe records, Cloudflare Worker settings, or external account settings were changed.

## Executive conclusion

The accounting joins are currently internally consistent, but the automation is inefficient and unnecessarily concurrent. The workbook contains only 282 populated invoice line items while the `invoices` grid and formulas extend to row 29,783. The live Apps Script project has two time-driven triggers for `syncStripeInvoicesToInvoices`, plus a separate expense trigger. The duplicate invoice triggers run roughly 16 seconds apart, while the heavier invoice run has recently taken 40–85 seconds. This creates overlapping execution pressure and is the most likely cause of prior timeouts, delayed expense creation, and repeated recovery behavior.

The next phase should fix trigger ownership and bounded reads before any data cleanup.

## Verified healthy controls

- No duplicate invoice `tour_key` values.
- No duplicate `expense_key` values.
- No duplicate deposit payment-intent IDs.
- No active duplicate staging `tour_key` values.
- No automatic expenses missing an expense key.
- No orphan automatic expenses.
- No managed invoice service rows missing a corresponding expense.
- No pending guide-payment queue rows without a matching pending expense.
- No guide-payment queue versus expense amount mismatches.
- No displayed `#ERROR!` values in the bounded live ranges audited for invoices, expenses, deposits, guide queue, guide ledger, and growth dashboard.
- Deposit arithmetic and required guest/date fields are currently complete.
- Repository QA passed: 5 accounting-source tests, protected-row sync QA, and 23 deposit/invoice safety tests.

## Findings

### P0 — Duplicate live triggers and overlapping execution

The live Apps Script project shows three triggers:

1. `syncStripeInvoicesToInvoices` — owned by another user — recent error rate 0.92%.
2. `syncStripeInvoicesToInvoices` — owned by the current account — recent error rate 0.4%.
3. `syncInvoicesToExpenses` — owned by the current account — recent error rate 0.17%.

Recent execution history shows the two invoice triggers firing about 16 seconds apart. One copy commonly exits in under two seconds, while the other has recently taken 40–85 seconds. Expense sync executions have ranged from about 6 to 63 seconds.

The repository currently works around the duplicate trigger by skipping executions during a seconds-of-minute window (`legacy_duplicate_trigger_window`). This reduces some duplicate work, but it is not a durable ownership model.

### P0 — Full-grid reads caused by prefilled formulas

The `invoices` sheet has 29,783 rows and 111 columns, but only 282 populated invoice line items. Formula/template rows make `getLastRow()` return the bottom of the grid.

The current Apps Script uses `invoices.getLastRow()` and reads every column through that row in:

- `syncInvoicesToExpensesUnlocked_`
- `buildExistingInvoiceKeys_`
- `findFirstBlankInvoiceRow_`

The primary expense sync therefore reads approximately 3.3 million invoice cells per run before filtering to real invoice rows. Expense duplicate checks also scan the entire expense last-row range twice per sync.

### P0 — Two malformed staging summary rows remain in the recent recovery window

Two staging rows do not have a matching itemized invoice identity:

- `stripe_invoices` row 192 — `MBW-0138` — `in_1UUukM0wAAlYwqaVpQVLpqQS|1|||`. It lacks tour date, service type, product, and guide, and is not currently marked excluded.
- `stripe_invoices` row 210 — `MBW-0151` — `in_1Uag8z0wAAlYwqaVFh34uewj|1|||`. It is correctly marked `exclude_from_invoice_sync = Yes` and `record_status = replaced_by_itemized_repair`.

`MBW-0138` remains capable of being reintroduced by a recovery run unless it is explicitly excluded or repaired.

### P1 — Expense metadata gaps

Six expense rows lack `source_type`:

- Row 382: `MBW-0136`, Stripe Fee.
- Row 420: `MBW-0154`, Stripe Fee.
- Rows 421–424: `MBW-0154`, three guide/meal payout rows and one transportation row.

The two Stripe-fee rows at 382 and 420 also lack `expense_status`. These are bounded metadata gaps; amounts and accounting links were not found to be inconsistent.

### P1 — Historical invoice metadata gaps

- Invoice rows 268 (`MBW-0149`) and 269 (`MBW-0150`) have a blank `source_system`.
- Most historical invoice lines predate the `created_at` / `updated_at` fields; 242 of 282 populated lines have at least one missing timestamp.
- Collaboration rows use a non-revenue payment method but currently display `Missing payment date`; they should likely be classified as `N/A` by policy rather than treated as payment failures.

### P1 — Two historical deposit invoice references need manual interpretation

Two deposit rows contain invoice references `1044` and `1053`, which do not match the current `MBW-####` invoice numbering convention:

- `DEP-20260615-VICTORIASAMATOVA`
- `DEP-20260723-JEANNEFRIEDMAN`

These may be valid historical references. They should not be rewritten automatically without source confirmation.

### P1 — Growth dashboard calculation pressure

Within `growth_dashboard!A1:Z150` there are 737 formulas:

- 277 use whole-column references.
- 118 use volatile date functions such as `TODAY()`.

Many formulas scan the entire 29,783-row invoice grid repeatedly. This is correct in principle but costly. The dashboard should consume bounded helper tables or a normalized summary layer rather than repeatedly scanning full invoice columns.

### P2 — Guide-ledger balance columns are running balances

`contribution_due_balance` and `advertising_fund_balance` are cumulative running balances. Summing those columns produces misleading totals. The authoritative outstanding contribution is the latest relevant balance or total due minus total collected, not the sum of every running-balance row.

At the audit point:

- Contribution due: $1,000.00.
- Contribution collected: $980.00.
- Net outstanding: $20.00.
- Sum of the running `contribution_due_balance` column: $1,810.00 — not a valid financial total.

## Recommended implementation sequence

### Step 3A — Trigger and runtime stabilization

1. Preserve the existing backup and Git baseline.
2. Identify the owner of the older duplicate invoice trigger.
3. Remove only the duplicate invoice trigger, leaving one invoice trigger and one expense trigger.
4. Replace the seconds-window workaround with an explicit single-trigger invariant.
5. Change invoice reads to stop at the last populated `invoice_no`, not `getLastRow()`.
6. Cache or incrementally update invoice identity keys instead of rebuilding them from the entire grid.
7. Add an execution budget/checkpoint so an import exits cleanly before Apps Script's time limit.
8. Run in the backup copy first, then compare counts, totals, and keys against the baseline.

### Step 3B — Controlled metadata repair

1. Mark the malformed `MBW-0138` staging summary as superseded/excluded after confirming the itemized record is authoritative.
2. Backfill the six expense `source_type` gaps and two `expense_status` gaps using deterministic rules.
3. Backfill the two blank invoice `source_system` values.
4. Classify collaboration/non-revenue reconciliation as `N/A` when no payment date is expected.
5. Leave historical timestamps and deposit references unchanged until a separate evidence-backed migration is approved.

### Step 3C — Dashboard and model cleanup

1. Create bounded normalized helper ranges for invoice, expense, queue, and deposit facts.
2. Point dashboards to helper tables rather than full-column invoice scans.
3. Add a health-check view with duplicate keys, missing metadata, orphan links, pending expenses, pending queue totals, and last successful sync times.
4. Treat running-balance columns as state snapshots and never aggregate them as transaction totals.

## QA gate for each implementation step

1. Make the code change in the repository only.
2. Run the repository test suite.
3. Deploy or paste the change into the backup Apps Script/project only.
4. Run one bounded sync against the backup workbook.
5. Compare line counts, distinct invoice counts, received totals, fee totals, expense totals, pending queue totals, deposit totals, and key uniqueness to the 2026-11-16 baseline.
6. Confirm no duplicate invoice or expense rows were created.
7. Confirm runtime and scanned-row counts are materially lower.
8. Only then apply the same change to production.
9. Run one production sync and verify the same controls.
10. Observe at least one scheduled cycle before moving to the next change.

## Timezone recommendation

Keep accounting and operational automation in `America/Guayaquil`. Mindo operates on Ecuador time year-round without daylight-saving changes. User-facing administration can display America/New_York separately if desired, but source timestamps and tour accounting should remain in the business timezone.

