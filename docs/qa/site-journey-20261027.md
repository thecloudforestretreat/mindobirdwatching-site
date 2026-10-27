# Site journey improvements — 2026-10-27

Implemented sequentially, with a separate checkpoint for each improvement:
1. EN/ES named-tour comparison: schedules, duration, pickup expectations, detail links. Owner explicitly confirmed MBW004 is 6–9 AM / 3 hours; both detail pages corrected. MBW005 and MBW006 retain published schedules.
2. Activities filters: All, Nature & Wildlife, Adventure, Chocolate & Coffee, Evening. Native buttons and live counts; all 22 activity/status cards remain accessible without JS. QA caught and fixed Spanish pairing and an initially unclassified unavailable rafting card. Rafting remains an unavailable status page, never a bookable option.
3. Direct activity inquiries: 18 canonical activity choices, conditional required select, translated labels, contextual body/header booking links, safe language navigation, no free-text names or contact details in links. Birding format questions are disabled/hidden for activity requests. API validates choice names and records Activity interest/service, selected plain-text name, party size, pickup and mixed birding additions without guessed product IDs, prices or availability. Existing Turnstile and upstream receipt handling retained.
4. Tours page consolidation: replace repeated large category cards with compact format links; remove a duplicate experience selector. Preserve specific route cards, bird comparison guide, Quito/night-walk planning, related guides and FAQs. Remove unsupported scarcity copy.
5. Bilingual practical footer: Explore, Plan Your Visit, Useful Information. Keep social links, questions JSON and WhatsApp controls. Static footer snapshots synchronized; language paths verified.
6. Mobile and analytics: fix 320px Spanish intro and English inquiry hero overflow; wrap narrow form controls and retain space after footer content. Existing consent, GTM ownership, WhatsApp events, form-start and acknowledged-success tracking preserved. Add known-value tour/activity selection events only; ignore names, email, phone and free-text fields.

## QA
- 38 automated navigation, booking flow/handoff, CRM preservation, metadata/schema and journey tests pass.
- Initial 40-case browser audit: 10 EN/ES core pages at 320/390/768/1280. Only one remaining booking hero overflow was found; fixed and retested at 320px. Spanish homepage overflow also fixed and retested.
- English and Spanish Chocolate/Coffee and Evening filters verified; accurate 2-of-22 results.
- Chocolate activity handoff verified through the mobile header into a selected Activity inquiry, with optional birding-format fieldset hidden. English-to-Spanish link preserves canonical activity and paired source URL. Manual change to birding disables activity validation.
- Spanish footer shows all 13 links with Spanish destinations and fits mobile width.
- XML URL lists/canonicals/hreflang unchanged; 46 main-content/CTA paths get updated lastmod dates in the primary sitemap (42 present in the existing static subset).
- Local/preview Turnstile hostname restrictions were not bypassed. No real inquiry, email, WhatsApp message, payment or CRM record was submitted during browser QA. Upstream payload and receipt paths tested with mocks. Real inbox/CRM delivery remains unverified for this new Activity path.
- Analytics checks verify event wiring and private-field exclusion; preview/local host guard prevents measurement pollution. Receipt in GA4/Meta and GTM event mapping for new selection events remain unverified. No analytics-account changes made.
- Independent human Spanish editorial review remains pending.

## Sitemap records
Prepare exact 293-column TSV rows from live sitemap_seo_enriched source rows; retain blanks and historical crawl/GSC values. Append scoped QA notes to the affected 50 records. Booking target metadata updated only in target fields, never crawl-observed fields. Publication state must remain explicit until deployment.

## Backup
Baseline e001ac8a plus parent-workspace archive outputs/mbw-journey-20261027/before-e001ac8a.tar.gz. CRM, accounting, WhatsApp sending, approved price data and availability remain unchanged.

## Review correction: Activities carousel
The Add Mindo Activities module now fills its media column rather than retaining a fixed 280px image inside a taller carousel. Empty label padding is hidden; dots stay over the image. Mobile uses a 3:2 frame. Scoped to this module, preserving the separate bird comparison carousel. All five image bounds meet the media bottom with zero gap in EN/ES at 320, 390, 768 and 1280px; no horizontal overflow. Next control advances the track. Existing 38 automated checks pass. Review branch only; production publication still pending approval.
