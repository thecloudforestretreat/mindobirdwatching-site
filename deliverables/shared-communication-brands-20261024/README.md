# Shared brand communications — 2026-10-24

## Scope

Custom Email Generator and Itinerary Generator use a single versioned browser library at `admin/assets/js/communication-library.js`. Default brand is Mindo Bird Watching. Mindo Tours and Chocó Andino Tours change the document logo, name, website, tagline, signature and download filename. The existing published green palette is shared by all three sites; no new palette was invented. The admin navigation stays MBW.

The same product IDs, standard rates and 12 user-supplied image files are available across brands. Email birdwatching cards appear under Activities & experiences for the other brands. Existing customer-specific overrides and saved itinerary prices are preserved on switching and reload. A `brands` allowlist on each experience supports future restricted offerings. No new bookable product IDs, Stripe changes, live CRM writes, image upload interface or sending identity setup are included.

## Evidence and copy

- Live Staff Info Library feed read 2026-10-24, 136 records; source worksheet supplied by the user: https://docs.google.com/spreadsheets/d/1zR0Zn1dfy976c2WzwR8m7J5HD6BPglbD5v9yQDjrlUk/edit?gid=1536748774
- The Drive connector returned Transport closed. Used the application's existing read-only Staff Info Apps Script feed instead. Each catalog item records its source content ID.
- Uploaded image paths supplied directly by the user, confirmed present on origin/main.
- Published brand homepages, CSS and Chocó Andino site configuration establish names, logos, shared theme and existing MBW contact mailbox. Kept the shared operational mailbox; no new From address was invented. Changing the generator brand does not change Gmail sender identity.
- New concise English/Spanish descriptions are adapted from Staff Info, preserving wildlife uncertainty, activity restrictions and quote qualifications. Human bilingual language review remains pending.
- Canopy participation requirements are explicitly subject to confirmation. Horse availability remains a staff check; the transient current maximum is not permanently hardcoded.
- Tubing card is Level I Mindo River only: $10/person, minimum billed quantity 4 ($40). Staff Info's Level II title/cost and response text conflict; Level II/III were not introduced as bookable products.
- Macro is $110/person/private session; quote additional sessions separately. Flora starts at $50/person for a half day and duration determines the final quote. Quad is $30/quad, not per person. Hummingbird solo price $75 is a distinct stated exception to the $60/person usual minimum 2.
- Updated existing generator defaults from verified Staff Info: Jewels $60; Night Walk $35; Canopy $30; Butterfly $10; Flora $50; Custom Half Day $125; Custom Full Day $175; Solo Birdwatching $99; extension $50/person; Custom Transportation $50. Existing quoted rates remain unchanged. Older legacy product entries outside these source mappings were left alone.
- MBW social/review links retain explicit Mindo Bird Watching attribution in other-brand output. Activity/detail links continue to their actual MBW pages; the implementation does not invent equivalent URLs on the other sites.

## Maintenance

Edit the catalog and brand profiles in the shared library once, then bump its query version in both generators. `emailCatalog` adds new experience cards and overlays the legacy email catalog. `applyItineraryCatalog` applies reference defaults to existing itinerary products without rewriting draft lines. For a future new product, add its canonical product option/default to the itinerary and its shared experience entry with the desired `brands` allowlist. Unpriced/new activities need approved source facts before use.

Email drafts and their brand are saved in local browser storage, consistent with existing itinerary draft storage; this is not cross-device draft synchronization. CRM-saved itinerary JSON also includes `brandId`. CRM handoff falls back to MBW for historical drafts with no brand.

## QA

- 43 unit/regression checks pass: shared catalog/brand/image mapping plus existing itinerary service rate, transport quantity and Stripe adjustment tests.
- Isolated Chrome at 390px and 1440px for both generators: all new email images selected; English/Spanish output; all three brand switches; guest details and manually agreed macro rate retained; brand retained on reload; downloaded HTML brand/filename correct; no root horizontal overflow or JavaScript exceptions.
- All 12 public photo URLs and both brand logo URLs returned HTTP 200 with the expected image content types using normal GET requests. Automated HEAD probes were denied; no claim is made about mail-provider image-proxy behavior.
- Hummingbird solo selection uses $75 for one guest; Level I tubing defaults to four billed guests ($40). Other usual minimums are displayed without silently inflating guest quantities.
- External services mocked in browser QA; no emails sent, Stripe sessions created or CRM records written.
- Guest inbox rendering in Gmail/Outlook and human bilingual review remain manual follow-ups.
