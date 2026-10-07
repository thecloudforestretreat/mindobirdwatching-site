# CRM redesign QA — 2026-10-07

Backups: backups/mbw-crm-redesign-20261007 (source, commit, inquiries). Ledger endpoints unsupported by current API; no ledger migration performed.

Implemented Guest & Booking, separate Follow-up, Quote, Invoice & Payment; compact responsive inputs; remove manual task UI without deleting history; +30 day shortcut; Ecuador service time defaults and overrides; inherited additional service dates/guests/pickup; service-specific assignment population; confirmation readiness and WhatsApp preview only.

Validation: 26 focused node tests pass; git diff --check passes. Browser synthetic booking save preserved quote acceptance timestamp. Desktop visual inspection and 390px mobile inspection: no document horizontal overflow; four follow-up shortcuts align. Existing explicit additional tour dates retained. API mutations tested only with local mocked fixture. No messages sent.

Invoice status reports presence of invoice number; API does not expose verified delivery state or ledger balance. Existing quote/payment data retained separately.
