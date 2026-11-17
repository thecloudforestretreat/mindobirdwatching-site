# MBW Accounting 2027 Rollover Readiness Checklist

Status: **preparation only**

Archive/cutover authorization: **not granted**

Business timezone: `America/Guayaquil`

This checklist prepares the accounting system for a controlled transition from 2026 to 2027. It must not create archive tabs, move records, clear live tabs, pause triggers, or import carry-forward entries before a separate, explicit cutover instruction.

## 1. Current readiness state

- [x] Native Google Sheets backup exists.
- [x] Repository baseline and accounting audit are committed.
- [x] Active `invoices` grid is bounded to 1,000 rows rather than 29,783 rows.
- [x] Invoice sync reads populated invoice rows rather than the full formatted grid.
- [x] Exactly one production invoice trigger remains.
- [x] Exactly one production expense trigger remains.
- [x] Both remaining triggers are owned by `mindobirdwatching@gmail.com`.
- [x] Business automation timezone remains `America/Guayaquil`.
- [x] Stable invoice, expense, deposit, queue, settlement, and ledger identities are preserved.
- [x] `MBW-0148 / ACT016 / Neicer` is reconciled across invoices, expenses, and guide queue.
- [x] The 2026-11-17 post-trigger health audit found zero duplicate invoice, expense, deposit, or guide-queue keys and zero past-due guide payouts.
- [x] A complete scheduled invoice cycle and expense cycle succeeded after the duplicate trigger was removed.
- [ ] Inactive `Copy of invoices` grid is reviewed separately; it currently remains a large, non-production cleanup candidate and must not be trimmed without specific approval.
- [x] Deposit `DEP-20261010-JOANFINLEY` is confirmed at $353.00 total, $100.00 paid, and $253.00 remaining.
- [x] The deterministic invoice and expense metadata exceptions documented in the 2026-11-17 health audit are resolved; Natalia Potter and Dennis Murphy are correctly classified as non-Stripe deposits.
- [x] Reconcile Dennis Murphy's final $1,570.00 Zelle booking to invoice `1065`: $500.00 initial deposit plus $1,070.00 in additional payments, including $750.00 paid by Shannon Skalos.

## 2. Prepare during the remainder of 2026

These are safe preparation tasks. They do not start the archive.

- [ ] Keep the production trigger inventory at exactly two: invoice sync and expense sync.
- [ ] Review trigger error rates weekly and investigate any new timeout or duplicate-write event.
- [ ] Keep the exception audit current; document every unresolved row with owner and disposition.
- [ ] Confirm every new product has a stable product code, service type, payout rule, and source metadata.
- [ ] Confirm every new invoice line produces the expected expense and guide-payment obligation.
- [ ] Confirm deposits carry tour date, balance due date, guest names, phone, party size, inquiry ID, guest ID, and PaymentIntent ID.
- [ ] Keep `created_at`, `updated_at`, `paid_at`, `tour_completed_at`, and `source_system` populated for new records.
- [ ] Avoid manual deletion of ledger rows; correct source records or use documented exclusions and supersession markers.
- [ ] Re-run the bounded accounting QA after any Apps Script or schema change.

## 3. Final pre-cutover evidence package

Prepare this package only when the final 2026 close approaches. Generating the reports is allowed; applying rollover changes is not.

- [ ] Fresh native Google Sheets backup ID and creation timestamp.
- [ ] Git commit hash for the deployed Apps Script source.
- [ ] Trigger inventory showing one invoice trigger and one expense trigger.
- [ ] Last successful execution time and runtime for both triggers.
- [ ] 2026 invoice line count, distinct invoice count, gross received, and outstanding amount.
- [ ] Stripe, Zelle, cash, and other payment totals reconciled to invoices.
- [ ] Stripe fee total reconciled to fee expenses.
- [ ] Service obligation total reconciled to payout/COGS expenses.
- [ ] Guide payment queue total reconciled to unpaid guide obligations.
- [ ] Guide settlements reconciled to guide-ledger movements.
- [ ] Deposit count and amount, separated into applied, unapplied, and 2027-tour deposits.
- [ ] Open expense, queue, settlement, advance, transfer, and reconciliation-exception lists.
- [ ] Duplicate-key report showing zero duplicate stable identities.
- [ ] Pending-sync report showing zero unexplained pending rows.
- [ ] Growth dashboard totals reconciled to bounded ledger totals.

## 4. Carry-forward rules to approve before cutover

Only operationally open records may carry into the 2027 working tabs:

- unpaid or partially paid invoices;
- deposits for tours occurring in 2027;
- unpaid guide or driver obligations;
- unreconciled fees or service expenses;
- unsettled guide ledger balances and advances;
- open bank transfers or withdrawals; and
- documented reconciliation exceptions.

Every carry-forward row must retain its original identifier and source timestamps. The rollover must add a marker; it must not create a replacement identity or recognize closed 2026 revenue again.

## 5. Approval gate — do not pass early

The cutover may begin only after all of the following are true:

- [ ] The owner explicitly instructs the system to begin the 2026 archive/2027 rollover.
- [ ] The final 2026 backup is verified and accessible.
- [ ] The evidence package in section 3 is complete.
- [ ] The carry-forward set has been reviewed and approved.
- [ ] The rollback owner and rollback backup are identified.
- [ ] A short accounting freeze window is announced.

Until every item above is checked, triggers remain active and the live 2026 workbook remains unchanged.

## 6. Cutover-day sequence — reference only

Do not execute this section during preparation.

1. Pause the two production triggers.
2. Run the final bounded invoice and expense reconciliation.
3. Export the final reconciliation and exception reports.
4. Create the read-only 2026 archive snapshot.
5. Create clean 2027 transaction tabs from approved templates.
6. Import only the approved open-item carry-forward set.
7. Validate counts, amounts, keys, formulas, formatting, and protections.
8. Resume exactly one invoice trigger and one expense trigger.
9. Monitor the first scheduled cycles and the first 24 hours of 2027 writes.

## 7. Rollback gate

If any validation fails, do not repair production by deleting or overwriting historical rows. Keep triggers paused, restore from the verified final backup, preserve the failed rollover copy for diagnosis, and document the failed gate before retrying.

## 8. Readiness definition

The system is **ready for a future cutover** when sections 1 and 2 are maintained, section 3 can be produced without manual reconstruction, and no unresolved P0 accounting exception remains. “Ready” does not mean the archive has started.
