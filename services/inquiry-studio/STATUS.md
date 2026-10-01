# Pilot handoff — 2026-09-28

First local inquiry-to-HTML prototype built independently of production.

Location: this folder. URL: http://127.0.0.1:8098/ while server.py runs.
Source: read-only connector snapshot of 20 rows, crm_pipeline_review!A1:AB21. Snapshot capture timestamp retained in private/inquiries.json and visible in app. No Sheets writes, n8n changes, production repo edits, AI-OS changes, messages or external deployments performed.

Verified:
- Seven backend validation tests and editor regression harness pass.
- Local API rejects missing session token and foreign Host; private files and source are not served.
- Actual qwen3.5:27b generation succeeded on one inquiry, then succeeded again after prompt corrections to remove duplicate greeting/signature/internal identifiers and separate follow-up text.
- Browser verified selection, relevant full-day birding block selection, editable generated reply, custom activity with sample price, local save and restore, export lock, sample review unlock and re-lock after an edit.
- Real sample draft and clearly marked synthetic custom-item draft saved locally. No owner pricing approval granted for a real customer.
- Existing generator body is reused in copied form. Pilot adds custom items and review gate; saved review authorization is never reused.

Not yet accepted as production: broad output-quality evaluation (especially Spanish, transport, specialty tours, price conflicts), authoritative quote precedence, automatic read refresh, correspondence lookup, multi-user ownership/audit, and Gmail draft/send integration.

Question pending for owner: should inquiry-specific quotes take precedence over generator defaults? Until resolved this pilot displays generator defaults for explicit review and warns that they are not approved quotes. CRM quoted_amount/options are not yet mapped into editor overrides.


## CRM connection — 2026-09-28
Read-only sync enabled via com.mbw.inquiry-crm-sync every 300 seconds and at login. First import: 119 inquiries. Source tab ID 302848462, crm_pipeline_review. Uses existing AI-OS Google Keychain authorization. ID/schema validation, atomic replacement, original snapshot retention, and failure fallback are tested. No writes to Sheets and no sending. UI Reload inquiries fetches the latest local copy and warns before discarding unsaved editor changes. 43 Python tests and editor pricing-review tests passed.

## Pricing decision — 2026-09-28
Owner approved keeping current defaults with manual per-email pricing edits. Master price-source selection is no longer a launch blocker. Existing override save/restore remains in place; pricing-review/export guard tests passed again. Catalog reconciliation remains optional future work.
