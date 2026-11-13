# Field Pass Companion editorial record — 2026-11-12

## Published-path proposal

- English: `/field-pass-companion/`
- Spanish: `/es/guia-del-pase-de-campo/`

The Spanish slug uses natural guest-facing language rather than a literal translation of “companion.” Both pages are intentionally `noindex,follow` because their primary purpose is confirmed-guest support through personalized QR links, not search acquisition.

## Evidence used

- Existing MBW tour and species pages supplied the preparation language, wildlife qualifications and species field notes.
- Existing operational data supplied the guide and MBW WhatsApp numbers.
- Ecuador's Servicio Integrado de Seguridad ECU 911 confirms that 9-1-1 is the single emergency number, available from fixed or mobile phones at no cost, 24 hours a day.
- Official source: `https://www.ecu911.gob.ec/servicio-integrado-de-seguridad-ecu-911/` confirms that ECU 911 coordinates police, fire, health, traffic, rescue and other emergency-response institutions through 9-1-1 nationwide.
- INAMHI is linked as Ecuador's official forecast service. The page does not claim a precise Mindo forecast when one is not available.
- Google Business Profile and Tripadvisor both allow businesses to request genuine reviews but prohibit incentives, pressure and selective positive-review solicitation. The companion offers both platforms equally and uses neutral language.

## Material edits

- Removed the repeated tour title from the lower pass panel and replaced it with a wildlife-specific field note.
- Changed “Pass holder” to “Prepared for.”
- Changed “Field ID” to “Expedition ID.”
- Replaced the second operational phone block with a QR-linked Field Pass Companion. The guide and MBW contacts remain available on the companion page.
- Added English and Spanish companion pages with meeting directions, WhatsApp contacts, packing guidance, weather guidance, a flexible itinerary and emergency instructions.
- QR parameters contain tour logistics only. Guest name and booking reference are excluded.
- Removed the repeated wildlife-edition pill and gave the field note the full width of the lower panel.
- Made the QR companion action the primary lime footer element and moved the Expedition ID into a secondary dark panel.
- Shortened the QR payload by storing the tour date in ISO format; each language formats that date locally on the companion page.
- Both companion pages load the shared MBW site and header styles plus a page-specific stylesheet scoped to the Field Pass Companion. Existing tour-card styles and selectors were not changed.
- Replaced the original companion color system, page background, cards and custom buttons with the approved global `site.css` tokens and reusable `page card`, `card`, `heroCopy`, `eyebrow` and `btn` classes. The companion stylesheet now controls layout only and is fully scoped to `data-css-cluster="field_pass_companion"`.
- Expanded the emergency instructions to identify police, medical, fire and rescue emergencies, request an exact location or landmark, and preserve the guide/MBW escalation order after immediate safety needs.
- Added calendar export in the `America/Guayaquil` timezone, print/PDF support, optional exact map links, booking-specific inclusions and access notes, standard cloud-forest trail guidance and a link to the applicable booking terms.
- Added a bilingual post-tour review panel with equal Google and Tripadvisor choices. It stays hidden until the day after the ISO tour date; `review=1` is reserved for QA.
- Suppressed the global footer's standalone Google-review icon on companion pages so review solicitation is not visible before the post-tour panel is eligible.
- When binoculars are listed as included, the packing checklist asks only for an optional camera instead of telling the guest to bring binoculars again.
- Kept QR payload growth controlled by making calendar end time, exact map URL, inclusions and access notes optional generator fields.
- Connected the companion's MBW WhatsApp destination to `window.MBW_SITE_CONFIG.contact`. New passes default to the live centralized number, while the generator retains Miami and Ecuador as explicit booking-level overrides.
- Rebuilt the companion as four task-based blocks: meeting and contacts, preparation, tour flow, and changes or emergencies. The desktop itinerary now runs horizontally and the previous mismatched two-card row no longer creates an empty column.
- Consolidated repeated weather, trail, equipment and access guidance into one preparation block without removing safety qualifications or booking-specific caveats.
- Restored the approved global site footer after layout QA so the companion remains consistent with the rest of the bilingual site.

## Pending review

- Spanish copy has been adapted for natural meaning and operational parity, but human Spanish review is still pending.
- Meeting-point links use a Google Maps search generated from the confirmed meeting text. Staff should continue entering a specific venue or address whenever available.
- Equipment inclusions vary by booking; the companion page states this explicitly rather than promising binoculars, ponchos or other items universally.
- Calendar end time is optional. When it is absent, the `.ics` file records the confirmed start without inventing an end time.
- The review panel uses the verified Google review link and the claimed Tripadvisor listing URL. Tripadvisor may require the traveler to sign in or choose “Write a review” on its listing.
- A QR URL containing an explicit `c`/`contact` value intentionally keeps that booking-specific number. Omitting that parameter makes the companion follow `site-config.js`, including later day/night number changes.
- The Spanish layout and meaning match the English page, but human Spanish-language review remains pending.
