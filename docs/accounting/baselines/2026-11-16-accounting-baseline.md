# MBW Accounting Baseline — 2026-11-16

Captured at **2026-11-16 19:25:09 EST** before the next accounting-system cleanup phase.

## Recovery points

- Production workbook: `1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU`
- Native Google Sheets backup: `1QaPyGFo5GRXMHsJt-uXO8abZPgBeBkKLoX8FQUXCIlM`
- Backup title: `MBW_Accounting_System_BACKUP_2026-11-16_192509_EST`
- Production Drive revision at inspection: `3094978`
- Previous Drive revision: `3094769`
- Repository branch: `codex/meal-addons-accounting`
- Repository commit before baseline record: `9551332a9c8a76f9d108b95bd435d8d4c0f8b2c8`
- Cloudflare Worker version: `6f425cd2-8ca6-4563-9ab8-dd857881738f`
- Workbook timezone: `America/Guayaquil`

The independent `.xlsx` export was attempted but Google Drive returned HTTP 403. The native Google Sheets copy is the verified recovery source.

## Backup QA

- Production and backup file IDs are different.
- Both files are native Google Sheets files in the same Drive folder.
- The backup contains all 48 production tabs with matching sheet IDs and grid dimensions.
- Formula/value comparisons matched exactly for:
  - `invoices!A1:DG300`
  - `deposits!A1:AX60`
  - `expenses!A1:AF500`
  - `guide_payment_queue!A1:Z250`
  - `guide_ledger!A1:AB200`
  - `growth_dashboard!A1:Z80`
  - `daily_recon!A1:AA250`
  - `product_catalog!A1:CL150`
  - `accounting_audit_log!A1:T150`

## Read-only financial baseline

### Invoices

- Line-item rows: 282
- Distinct invoices: 184
- Amount received: $38,868.50
- Stripe/transaction fees recorded: $1,143.32
- Reconciliation statuses: 258 Matched; 3 Missing payment date
- Expense reconciliation flags: 236 Yes; 45 No; 1 N/A

### Deposits

- Deposit rows: 31
- Total booking price: $12,296.00
- Deposit amount paid: $4,318.00
- Total amount paid: $7,252.00
- Balance remaining: $5,144.00
- Missing tour date: 0
- Missing balance due date: 0
- Missing first name: 0
- Missing last name: 0
- Missing phone: 0
- Missing party size: 0

### Expenses

- Expense rows: 431
- Expense amount total: -$29,391.98
- Unreconciled rows: 19
- Pending-status rows: 21

### Guide payment queue

- Queue rows: 170
- Pending rows with remaining balance: 19
- Pending amount: $1,858.79
- Chicho: 8 rows, $1,195.43
- Neicer: 8 rows, $543.10
- Juan: 1 row, $102.34
- Other: 2 rows, $17.92

### Guide ledger

- Ledger rows: 104
- Contribution due: $1,000.00
- Contribution collected: $980.00
- Sum of row-level contribution due balances: $1,810.00
- Statuses: 65 Closed; 18 Settled; 6 Collected; 8 Open; 1 Current; 6 blank

### Growth dashboard

- 2026 YTD earned revenue: $33,678.07
- 2026 YTD earned profit: $10,927.66
- 2026 YTD earned margin: 32.45%
- Current-month earned revenue: $2,877.26
- Current-month earned profit: $1,016.47
- Current-month earned margin: 35.33%

## Scope boundary

No production workbook cells, formulas, formatting, triggers, Apps Script logic, Stripe records, or Worker configuration were changed during this baseline step.
