# MBW Multi-Invoice Ledger Deployment

This release lets one guest have multiple bookings and multiple Stripe invoices without overwriting the prior invoice/payment history.

## Backups

- Git restore point: `backup/pre-multi-invoice-ledger-2026-10-03`
- Google Sheets backup: `MBW CRM Operations - PRE MULTI INVOICE BACKUP 2026-10-03`
- Backup spreadsheet ID: `1-7FAGa0L1YfFhOFnievkh8XWSvaP8K4DFcblxcvyuWU`

## Live sheet preparation completed

The CRM Operations spreadsheet now contains:

- `crm_bookings`, keyed by `booking_id`
- `crm_payments`, keyed by `payment_id`

James Harrod / `MBW-0114` was inserted as the verified baseline record. Existing CRM rows and legacy invoice fields were not changed.

## Deployment order

1. Import `MBW-CRM-Admin-API-multi-invoice.json` into n8n and publish/activate the updated workflow.
2. Verify the webhook supports `list_bookings`, `upsert_booking`, `list_payments`, and `upsert_payment`.
3. Deploy `stripe-checkout-worker-v39.js` to the existing Stripe Checkout Worker.
4. Deploy `admin/guest-crm/index.html` with the site.
5. Open James Harrod in Guest CRM and confirm `MBW-0114` appears under **Invoice & payment history**.
6. Create a test second booking, create an invoice, and confirm a second payment ledger row appears while `MBW-0114` remains visible.
7. Run the existing invoices-to-expenses sync and confirm the new invoice has its own `tour_key` and expenses.

Keep `invoices-logger-v8.gs` and `stripe-invoices-sync-v1.4.4.gs`; both already identify separate invoices/services using their unique Stripe/tour keys.

## Rollback

Restore the website from the backup Git branch and import the previous n8n export. The new spreadsheet tabs are additive, so they can remain in place during rollback without affecting the legacy workflow.

## Archived intake preservation — 27 October 2026

Raw intake now uses mergeImportedInquiry_ to preserve an existing archive decision and clear follow-up work on repeated imports. Exact source-submission or same dated-trip matches still merge audit information. Archived records are excluded from broad email/phone fallback matching, so a different-date or undated request can create a separate inquiry. Staff restore and active-record merging retain their prior behavior.

The live Head source was backed up before applying only this targeted patch. The live router differs from this repository in unrelated schema/attribution sections; those live differences were preserved. The five-minute routeAllNewRawRows trigger executes Head. The older versioned web-app deployment was not changed.

QA: 33 regression tests pass; four behavior/integration tests also pass against the exact patched live source, including archived repeat versus a separate later trip. Live source readback exactly matches the prepared patch. No invoice, payment, quote, tour, WhatsApp or provider data is migrated.

## Saved follow-up dates in digest — 27 October 2026

Active-inquiry tasks use the saved follow-up date, including CRM edits without a Sheet note. Explicit manual override notes still support a cleared date. Reviews and cancellations keep their separate scheduling rules. Four bulk note-column reads preserve performance. No inquiry values are rewritten.

Spam inquiries produce no tasks and are excluded defensively from digest rendering.

44 regression tests passed; eight digest tests also passed against the exact patched live Head source. Live source was backed up and only the reconciliation change applied, preserving unrelated live/repository differences. No email sent by QA and no guest records auto-closed.
