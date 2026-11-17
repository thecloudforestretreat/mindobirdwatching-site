# MBW Accounting 2026 Archive and 2027 Rollover Plan

Status: prepared only; no 2026 records have been archived or moved.

## Objective

Close 2026 as an immutable, auditable accounting period and begin 2027 with clean operational ledgers that retain open obligations, stable identifiers, source attribution, and reconciliation history.

## System of record

- Production workbook: `MBW_Accounting_System`
- Production spreadsheet ID: `1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU`
- Pre-migration native backup ID: `1QaPyGFo5GRXMHsJt-uXO8abZPgBeBkKLoX8FQUXCIlM`
- Business timezone: `America/Guayaquil`
- Apps Script project ID: `1slWOzhbjqQoYUrHwK99Ntf9pj3urZtRU89pd6PYrWy8Wq9Xo7NsBGFq6`

## Non-negotiable controls

1. Create a fresh native Google Sheets backup immediately before cutover.
2. Pause all accounting sync triggers during the final snapshot and rollover.
3. Never renumber invoice, deposit, expense, queue, settlement, or ledger IDs.
4. Preserve `created_at`, `updated_at`, `paid_at`, `tour_completed_at`, and `source_system`.
5. Preserve Stripe invoice IDs, PaymentIntent IDs, stable row identities, and audit keys.
6. Carry open obligations into 2027; do not carry closed 2026 revenue as new 2027 revenue.
7. Reconcile totals before and after cutover and resume triggers only after all gates pass.

## Tabs to archive as 2026 transaction history

- `invoices`
- `deposits`
- `expenses`
- `guide_payment_queue`
- `guide_settlements`
- `guide_ledger`
- `guide_advances`
- `withdrawals`
- `bank_transfers`
- `daily_recon`
- `accounting_audit_log`
- Other transaction/import tabs containing 2026 activity

Archive copies must be values-plus-formulas snapshots with formatting, validations, notes, and protected ranges retained where practical. Archive tabs are read-only after approval.

## Tabs that remain active as master configuration

- `product_catalog`
- `products`
- `product_service_options`
- `guides`
- `guide_product_rates`
- `driver_route_rates`
- `fee_rules`
- `tranx_accounts`
- Current reporting definitions and staff reference tables

These tabs continue into 2027 and are versioned rather than reset.

## Items carried into 2027

Carry only records that are operationally open at cutover, including:

- Unpaid or partially paid invoices
- Deposits for tours occurring in 2027
- Unpaid guide or driver obligations
- Unreconciled Stripe fees or expenses
- Unsettled guide ledger balances and advances
- Open bank transfers or withdrawals
- Any unresolved reconciliation exception

Each carried record must retain its original 2026 identifier and source timestamps. Add a rollover marker instead of creating a replacement identity.

## 2027 initialization

1. Create clean 2027 transaction tabs from the approved headers, formulas, validation rules, protections, and formatting only.
2. Set automation cursors to the final processed 2026 source rows.
3. Import the approved open-item carry-forward set.
4. Confirm formulas and conditional formatting on the first blank working row.
5. Run invoice sync and expense sync in read-only/status mode.
6. Run one idempotent live reconciliation after the status checks pass.
7. Confirm no 2026 closed transaction is recreated in 2027.

## Reconciliation gates

The rollover cannot be approved until all of the following agree:

- 2026 invoice gross receipts versus Stripe/Zelle/cash sources
- Stripe fees in invoices versus reconciled fee expenses
- Service obligations versus expense rows
- Guide payment queue versus unpaid guide obligations
- Guide settlements versus guide ledger movements
- Deposits applied exactly once to their related bookings
- Growth dashboard totals versus underlying ledgers
- Count and amount of open items before and after carry-forward
- Zero duplicate stable identities in the 2027 transaction tabs
- Zero pending sync rows unless each pending row has a documented reason

## Cutover sequence

1. Announce a short accounting freeze window.
2. Create and verify the final native backup.
3. Pause invoice and expense triggers.
4. Run final 2026 invoice and expense reconciliation.
5. Export the reconciliation report and exception list.
6. Create the immutable 2026 archive.
7. Create clean 2027 transaction tabs.
8. Carry forward approved open items.
9. Run the reconciliation gates.
10. Resume a single invoice trigger and a single expense trigger.
11. Monitor the first 24 hours of 2027 writes.

## Rollback

If any gate fails, keep triggers paused, restore the production workbook from the final native backup, and retain the failed rollover copy for diagnosis. Do not repair production by deleting or overwriting historical rows manually.

## Current preparation status

- Native backup exists.
- Invoice sync is bounded to populated rows.
- The active `invoices` grid has been reduced from 29,783 to 1,000 rows without removing populated ledger records.
- Live invoice status reports zero pending source rows.
- Live expense reconciliation completed idempotently with no duplicate fee or payout creation.
- A second invoice trigger owned by another Google account remains visible; it must be removed by that account before the 2027 cutover so only one invoice trigger remains.
