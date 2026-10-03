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
