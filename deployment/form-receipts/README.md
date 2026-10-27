# Form receipt handlers

Snapshots of the existing owner Apps Script handlers, with Spanish display-only selection localization (2026-10-21).

- `book-tour.gs`: Site-Book_Tour project `1mTRb3t8PGVBFM3c4IsQSxV32kzyqYfhtqTeU21RtnLTt64-s3Qreiokl`, existing web app updated from version 27 to 28.
- `contact.gs`: Site_Contact project `1b0GDT8TCewcyAYs_77Lty5R91C1tYWKhazvY2eeHITzu7xfUUHhgCvzj`, existing web app updated from version 14 to 15.

Only Spanish customer receipt rendering calls the label helpers. English/internal rendering, `doPost`, raw persistence, CRM mappings, endpoint IDs, credentials and access settings remain unchanged. Unknown values and guest-entered text are preserved and HTML-escaped by the existing renderer. Both saved editor files were read back exactly.

The website build does not deploy these files. Deploy through the existing Apps Script web app's Manage deployments > Edit > New version, retaining its identity and permissions. For rollback, select booking version 27 / contact version 14 in the same existing deployment. Back up current owner source and compare before future edits; the site repository is not a substitute for checking live Apps Script state.

Validation: `node --test tests/spanish-receipt-details.test.mjs`. Live Spanish booking and contact submissions returned success and delivered translated receipts to the owner's designated QA aliases. Canonical English choices were verified in raw rows and CRM separately; archived test inquiries must remain excluded from follow-up.

## Activity labels — 27 October 2026

Both receipt renderers include the public activity catalog's Spanish display labels. Canonical English input values, internal notifications, raw Sheet values and CRM handling are unchanged. Live source was backed up and compared before editing. Existing booking deployment advanced from version 28 to 29; contact advanced from 15 to 16, preserving URLs and permissions.

Six receipt tests passed, including all 18 activity labels, HTML escaping, data preservation and unchanged critical handler hashes. One controlled Spanish booking retest delivered “Tour de café” to the designated QA inbox. With analytics consent explicitly accepted, GA4 Realtime received activity_selection and exactly one form_submit_success key event. No tracking code/configuration changes were needed. Contact translation was verified by source readback and renderer tests; no extra contact enquiry was submitted.

Evidence is retained locally in outputs/mbw-journey-20261027. Production test enquiries must remain archived and excluded from follow-ups. WhatsApp automation remains disabled.
