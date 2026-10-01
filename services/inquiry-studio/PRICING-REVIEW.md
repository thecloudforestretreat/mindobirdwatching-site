# Pricing comparison — 2026-09-28

Read-only comparison. No prices or Google Sheets cells changed. All email exports in Inquiry Studio still require review of the exact output.

Sources: [live Custom Email Generator](https://admin.mindobirdwatching.com/custom-email-generator/) and [product_catalog](https://docs.google.com/spreadsheets/d/1ckRUChk3pp4QlO1BIDkOeF8CIwHBidYbBmjb39dbGIU/edit#gid=1425648040). Sheet comparison uses customer_price_usd, not current_reference_price_usd or internal costs.

| Item | Live generator | Product sheet | Decision needed |
|---|---|---|---|
| Jewels of the Morning Forest | $55/person | MBW004: $60/person | Choose default |
| Andean Cock-of-the-Rock half-day | $85/person; $105 private | MBW005: $85/person | Base matches; private supplement requires separate policy |
| Quest full-day | $115/person; $135 private | MBW006: $115/person | Base matches; private supplement requires separate policy |
| Spectacled Bear half-day | $125/person | OSO001: $150/person | Choose default |
| Spectacled Bear full-day | $175/person | OSO002: $200/person | Choose default |
| Waterfall Tour | $15 adult / $10 child | MBW013 Waterfall Hike: $20/person; ACT002/ACT003 waterfalls: $10 | Confirm product equivalence and adult/child pricing; names may describe different services |
| Chocolate | $15 adult / $10 child | MBW011: $15/person | Adult matches; child pricing absent from compared sheet columns |
| Butterfly | $15/person | MBW015: $15/person | Matches |
| Night Walk | $30/person | MBW016: $30/person | Matches |
| Quito/Mindo one-way | $99 | TRANS01/02: $99 | Matches |
| Quito/Mindo round-trip | $180 | TRANS03: $190; TRANS06: $180 | Both invoicing-enabled; TRANS03 checkout disabled, TRANS06 enabled. Clarify intended distinction |

The pilot’s copied transport block currently says only $99 each way, while the live generator also includes $180 round trip. Do not infer round-trip pricing by doubling the one-way rate.

Other catalog conflict: ACT017 appears twice as Mountain Biking, priced $10 and $20. The $10 row has Needs Review for accounting/invoicing but Yes for checkout; the $20 row is enabled for all three. Do not deduplicate or select a price automatically.

The sheet also includes test, reimbursement, deposit, inactive/legacy and internal products. A future catalog importer must explicitly map approved customer-facing blocks, not import all rows indiscriminately. Custom tours remain individually quoted in the generator even though the sheet has Custom Half Day/Full Day entries; do not assume those apply to every custom inquiry.

Recommended next decision: confirm which source supplies defaults, then approve the listed exceptions and mappings. Per-email edits remain local and always require final pricing review.

## Owner decision — 2026-09-28
Keep the current pilot defaults. Staff will manually adjust pricing per email. Do not automatically replace defaults with product-sheet prices or block pilot completion on the catalog differences. Continue requiring review of the exact final email before export; any price/content edit invalidates that approval. Saved draft overrides remain local and do not update the Google Sheet or main generator catalog.
