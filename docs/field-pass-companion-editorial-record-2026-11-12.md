# Field Pass Companion editorial record — 2026-11-12

## Published-path proposal

- English: `/field-pass-companion/`
- Spanish: `/es/guia-del-pase-de-campo/`

The Spanish slug uses natural guest-facing language rather than a literal translation of “companion.” Both pages are intentionally `noindex,follow` because their primary purpose is confirmed-guest support through personalized QR links, not search acquisition.

## Evidence used

- Existing MBW tour and species pages supplied the preparation language, wildlife qualifications and species field notes.
- Existing operational data supplied the guide and MBW WhatsApp numbers.
- Ecuador's Servicio Integrado de Seguridad ECU 911 confirms that 9-1-1 is the single emergency number, available from fixed or mobile phones at no cost, 24 hours a day.
- INAMHI is linked as Ecuador's official forecast service. The page does not claim a precise Mindo forecast when one is not available.

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

## Pending review

- Spanish copy has been adapted for natural meaning and operational parity, but human Spanish review is still pending.
- Meeting-point links use a Google Maps search generated from the confirmed meeting text. Staff should continue entering a specific venue or address whenever available.
- Equipment inclusions vary by booking; the companion page states this explicitly rather than promising binoculars, ponchos or other items universally.
