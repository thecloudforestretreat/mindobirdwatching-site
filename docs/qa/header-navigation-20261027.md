# Public navigation update — 2026-10-27

Approved structure: Tours, Activities, Birds, Plan Your Trip, About Us, Contact, Book a Tour. The logo retains home navigation. Existing pages and URLs remain; the Activities hub is now a primary group with All Activities first.

## Implementation
- `assets/data/navigation.json` is the bilingual destination source. Regenerate the shared include with `python3 scripts/build-navigation.py`, then synchronize static snapshots with `python3 scripts/sync-homepage-headers.py`.
- Tours has two desktop columns. Mobile uses native disclosure groups, scrollable within the viewport, with booking outside the menu so it remains visible.
- Desktop starts at 1200px; both languages fit the existing 1100px page container at that width. Keyboard Enter/Space, ArrowDown into dropdowns, Escape with focus return, outside dismissal, mobile focus containment and resize dismissal are supported.
- Shared styling overrides old embedded variants. Public script entry points use the same version to avoid loading competing cached controllers. Snapshot styles remain synchronized.

## QA evidence
- 23 automated navigation/booking regression checks passed.
- Header fit, visible booking control and correct desktop/mobile state passed at 320, 390, 768, 1024, 1199, 1200, 1280 and 1440px in EN and ES.
- All five Spanish desktop dropdowns fit the 1280×900 viewport and ArrowDown placed focus inside. English Tours and Activities were also tested.
- Mobile Activities expansion, its All Activities link, active section and matching Spanish language target verified on the actual Activities page using the fetched include.
- Mobile Spanish Tours expansion and Escape-to-close verified at 320px. Mobile Activities visual review at 390×844; content remains internally scrollable.
- All 84 EN/ES navigation destinations exist as local pages and match sitemap language pairings. Automated HTTP HEAD checks were rejected with 403 by the live edge; these are not claimed as 84 live HTTP passes. Normal browser access to the live Activities hub succeeds.
- A one-time comparison against baseline a5f68a9d verified public page content, metadata and form markup unchanged outside header markup/styles and script version strings.
- Existing Spanish homepage body content overflows at 320px outside the header; header bounds pass. That separate page-content issue was not changed in this navigation update.
- Spanish labels were checked for layout and matching destinations; independent human Spanish editorial review is not claimed.

## Backup
Original committed source: a5f68a9d. Local archive of header assets plus homepage snapshots: `outputs/mbw-header-20261027/header-before-a5f68a9d.tar.gz` in the parent project workspace. No CRM, WhatsApp, payment, tracking, canonical, hreflang or sitemap changes were made.
