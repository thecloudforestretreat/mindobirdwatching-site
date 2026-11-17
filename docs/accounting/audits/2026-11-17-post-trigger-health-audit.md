# MBW Accounting Post-Trigger Health Audit

Audit date: **2026-11-17**

Business timezone: **America/Guayaquil**

Scope: **production verification and bounded metadata repair**

No archive tabs were created, no records were moved, and no rollover action was started. Only the deterministic metadata cells documented below were edited.

## Executive result

The production automation is stable after removal of the duplicate invoice trigger. The latest observed scheduled invoice and expense cycles completed successfully, and the ledgers contain no duplicate invoice tour keys, expense keys, deposit identifiers, deposit PaymentIntent identifiers, or guide-payment queue keys. There are no past-due guide payouts as of the audit date.

No P0 accounting-integrity issue was found. The deterministic metadata exceptions identified in this audit were repaired without changing row counts, amounts, or stable keys. Joan Finley's booking total and remaining balance were confirmed in the live deposit ledger. The remaining work is limited to accepted historical evidence gaps and dashboard performance optimization.

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

## Bounded metadata repairs

### Invoice metadata

- `invoices` rows 268–269 — `MBW-0149 / MBW006` and `MBW-0150 / MBW006` — now carry `source_system = stripe_invoice_sync`, `marketing_brand_id = mbw`, and `billing_brand_id = mbw`.
- Marketing Collaboration lines at rows 230–232 now reconcile as `N/A`, consistent with their non-revenue, no-payment-required status.
- Older historical rows still have incomplete lifecycle timestamps. These should not be backfilled without an evidence-backed migration rule.

### Expense metadata

The six previously bounded expense exceptions were repaired:

- row 382 — `MBW-0136` Stripe Fee — now has its tour key, invoice ID, transaction ID, automatic source record, and paid status;
- row 420 — `MBW-0154` Stripe Fee — now has its invoice ID, transaction ID, automatic source record, and paid status;
- rows 421–424 — `MBW-0154` payout/transportation expenses — now carry deterministic automatic source records.

The repair preserved the existing amounts and ledger identities.

### Deposit metadata

- Deposit row 7, `DEP-20260706-NATALIAPOTTER`, is a Zelle payment linked to invoice `1046`; a Stripe PaymentIntent is not applicable.
- Deposit row 11, `DEP-G-20260710125233-5578-TOURDEPOSITHISTORICALUNREVIEWED`, is a historical Zelle payment to Wells Fargo; Stripe contains no matching record, so a Stripe PaymentIntent is not applicable. Its recorded **$820.00** amount and final invoice linkage remain pending bank-source review.
- Deposit row 19, `DEP-20261010-JOANFINLEY`, is confirmed at **$353.00** total booking price, **$100.00** paid, and **$253.00** remaining.

The absence of Stripe identifiers on these two rows is correct because neither payment used Stripe. Dennis Murphy's payment method was normalized from `Other` to `Zelle`; no amount or invoice identifier was changed.

## Current 2027 carry-forward inventory

Eight deposit records already have 2027 tour dates. They contain **$1,200.00** in recorded payments and **$3,753.00** in recorded remaining balances, including Joan Finley's confirmed **$253.00** balance.

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
- **P1:** reconcile Dennis Murphy's historical **$820.00** deposit and final invoice linkage against the bank source; do not infer those values from Stripe because Stripe has no matching payment.
- **P2:** replace dashboard whole-column and volatile formulas with bounded helper ranges; review the inactive oversized `Copy of invoices` tab separately.

## Next safe step

Continue monitoring the two production triggers and preserve the same bounded QA discipline for future changes. Do not backfill historical evidence gaps or start the 2026 archive/2027 cutover without separate authorization.
