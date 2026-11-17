# MBW Accounting Post-Trigger Health Audit

Audit date: **2026-11-17**

Business timezone: **America/Guayaquil**

Scope: **read-only production verification**

No archive tabs were created, no 2026 records were moved or edited, and no rollover action was started.

## Executive result

The production automation is stable after removal of the duplicate invoice trigger. The latest observed scheduled invoice and expense cycles completed successfully, and the ledgers contain no duplicate invoice tour keys, expense keys, deposit identifiers, deposit PaymentIntent identifiers, or guide-payment queue keys. There are no past-due guide payouts as of the audit date.

No P0 accounting-integrity issue was found. The remaining work is bounded metadata cleanup, one deposit booking-total review, and dashboard performance optimization.

## Scheduled automation QA

- Exactly one invoice trigger remains.
- Exactly one expense trigger remains.
- Both triggers are owned by `mindobirdwatching@gmail.com`.
- After the duplicate trigger was removed, invoice sync ran once per five-minute interval rather than in paired executions sixteen seconds apart.
- The observed 9:29:41 AM invoice execution completed in 48.36 seconds.
- The observed 9:20:01 AM expense execution completed in 26.194 seconds.
- No failure appeared in the post-removal execution sequence reviewed.

## Ledger identity and status checks

| Control | Result |
| --- | ---: |
| Populated invoice lines | 282 |
| Distinct invoice numbers | 184 |
| Duplicate invoice `tour_key` values | 0 |
| Deposit rows | 31 |
| Duplicate deposit IDs | 0 |
| Duplicate deposit PaymentIntent IDs | 0 |
| Expense rows | 431 |
| Duplicate expense keys | 0 |
| Guide-payment queue rows | 170 |
| Duplicate guide-payment queue keys | 0 |
| Reconciled guide settlements | 53 |
| Past-due pending guide payouts | 0 |

The guide-payment queue contains 19 future obligations totaling **$1,858.79**. Every pending queue item has a matching expense record. These are scheduled liabilities, not overdue exceptions.

## Bounded metadata exceptions

### Invoice metadata

- `invoices` row 268 — `MBW-0149 / MBW006` — blank `source_system`.
- `invoices` row 269 — `MBW-0150 / MBW006` — blank `source_system`.
- Three Marketing Collaboration lines at rows 230–232 display `Missing payment date`. They are non-revenue records and should be classified by an approved policy rather than treated as ordinary unpaid revenue.
- Older historical rows still have incomplete lifecycle timestamps. These should not be backfilled without an evidence-backed migration rule.

### Expense metadata

Six expense rows retain the same bounded metadata gaps identified in the prior audit:

- row 382 — `MBW-0136` Stripe Fee — missing `source_type`, `source_record_id`, and `expense_status`;
- row 420 — `MBW-0154` Stripe Fee — missing `source_type`, `source_record_id`, and `expense_status`;
- rows 421–424 — `MBW-0154` payout/transportation expenses — missing `source_type` and `source_record_id`.

The amounts and ledger identities for these rows are present; the exception is provenance/status metadata.

### Deposit metadata

- Deposit row 7, `DEP-20260706-NATALIAPOTTER`, lacks a Stripe PaymentIntent ID.
- Deposit row 11, `DEP-G-20260710125233-5578-TOURDEPOSITHISTORICALUNREVIEWED`, lacks a Stripe PaymentIntent ID.
- Deposit row 19, `DEP-20261010-JOANFINLEY`, has a 2027 tour date but lacks `total_booking_price` and `balance_remaining`.

The first two are historical records and should not be rewritten automatically. The Joan Finley booking total and balance must be confirmed from the booking source before the final 2027 carry-forward set is approved.

## Current 2027 carry-forward inventory

Eight deposit records already have 2027 tour dates. They contain **$1,200.00** in recorded payments and **$3,500.00** in recorded remaining balances. The balance total is incomplete because `DEP-20261010-JOANFINLEY` does not yet have a recorded booking total or balance.

Three deferred invoice service lines are currently scheduled in 2027:

- `MBW-0109 / MBW012` — 2027-02-12;
- `MBW-0109 / MBW011` — 2027-02-25; and
- `MBW-0113 / OSO002` — 2027-06-16.

Their three matching pending guide obligations total **$308.92**. The expense ledger also includes three already-paid 2027 lodging pass-through records for `ROBERT-2027`, totaling **$99.00**.

These records are candidates for the future carry-forward set. This audit did not move or copy them.

## Dashboard health and performance

No displayed formula error was found in the reviewed ranges of `growth_dashboard`, `expense_action_dashboard`, or `daily_recon`.

Performance pressure remains:

- `growth_dashboard!A1:Z150` contains 277 whole-column formulas and 118 volatile formulas;
- `daily_recon!A1:AA200` contains 771 whole-column formulas; and
- `expense_action_dashboard!A1:H150` contains seven volatile formulas and no whole-column formulas.

The formulas are currently producing values, but the whole-column scans remain a P2 performance concern. They should be replaced with bounded normalized helper ranges in a separately tested change.

## Priority classification

- **P0:** none found.
- **P1:** confirm the Joan Finley booking total/balance; repair or formally accept the six expense metadata gaps and two invoice `source_system` gaps; define the non-revenue collaboration payment-date policy.
- **P2:** replace dashboard whole-column and volatile formulas with bounded helper ranges; review the inactive oversized `Copy of invoices` tab separately.

## Next safe step

Perform the P1 metadata work in small, source-backed batches. For every batch: capture the before state, update only deterministic fields, re-run the bounded health checks, and stop if counts, totals, or stable keys change unexpectedly.
