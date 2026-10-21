# Form receipt handlers

Snapshots of the existing owner Apps Script handlers, with Spanish display-only selection localization (2026-10-21).

- `book-tour.gs`: Site-Book_Tour project `1mTRb3t8PGVBFM3c4IsQSxV32kzyqYfhtqTeU21RtnLTt64-s3Qreiokl`, existing web app updated from version 27 to 28.
- `contact.gs`: Site_Contact project `1b0GDT8TCewcyAYs_77Lty5R91C1tYWKhazvY2eeHITzu7xfUUHhgCvzj`, existing web app updated from version 14 to 15.

Only Spanish customer receipt rendering calls the label helpers. English/internal rendering, `doPost`, raw persistence, CRM mappings, endpoint IDs, credentials and access settings remain unchanged. Unknown values and guest-entered text are preserved and HTML-escaped by the existing renderer. Both saved editor files were read back exactly.

The website build does not deploy these files. Deploy through the existing Apps Script web app's Manage deployments > Edit > New version, retaining its identity and permissions. For rollback, select booking version 27 / contact version 14 in the same existing deployment. Back up current owner source and compare before future edits; the site repository is not a substitute for checking live Apps Script state.

Validation: `node --test tests/spanish-receipt-details.test.mjs`. Live Spanish booking and contact submissions returned success and delivered translated receipts to the owner's designated QA aliases. Canonical English choices were verified in raw rows and CRM separately; archived test inquiries must remain excluded from follow-up.
