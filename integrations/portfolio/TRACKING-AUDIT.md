# Inquiry tracking audit — October 7, 2026

This audit reads existing local website source and the reporting feed's aggregate event names. It does not submit test inquiries or change any site's tracking configuration. Event counts are not unique people, qualified inquiries, confirmed bookings, or revenue. Consent and delivery failures can reduce recorded event counts.

| Website | Submission event | Evidence / dashboard treatment |
| --- | --- | --- |
| Mindo Bird Watching | form_submit_success | assets/js/site.js records success separately from attempts and errors. Display submission events; WhatsApp clicks separately. |
| Cloud Forest Retreat | form_submit_success | Local tcfr-admin-build assets/js/booking-form.js and contact-form.js call tracking after accepted submissions. Display submission events. |
| Experience Ecuador | form_submit_success | Local experienceecuador assets/js/plan-your-trip.js, contact pages and partner/concept forms. Includes several form types; do not label all events customer leads. |
| MindoTours | generate_lead | Existing local repository assets/js/booking.js calls MT_ANALYTICS.formSuccess after successful submission; analytics.js maps success to generate_lead. Display submission events. |
| Eyes On Da Nang | generate_lead | Local eyesondanang-site/assets/js/contact.js emits after provider acceptance, once per submitted ID. Existing admin reporting documents one October 2 launch QA lead; counts can include that test. |
| Choco Andino Tours | Unverified | Local head.js has WhatsApp click tracking, but successful submission tracking was not verified. Show unavailable forms and observed contact events. |
| Experience The Amazon | Unverified | No verified successful-submission event in inspected local assets. Show unavailable forms and observed contact events. |
| Business Buying and Selling | Unverified | No current source verification available. Show unavailable forms and observed contact events. |

Mindo business outcomes reuse the existing protected reconciled CRM/accounting report: inquiries created in the selected period, current booking status of that inquiry cohort, and completed tours by tour/completion date. These include all recorded channels, not just website acquisitions. Only aggregate counts and definitions are returned to this dashboard; no contact records or invoice rows. Revenue remains unavailable until amount, currency, refunds and payment status are reconciled.

Public HTML requests for source verification returned HTTP 403; source findings above are explicitly based on the existing local code, not a claim of a new live submission test.

October 7 update: Arguello Dentistry added with verified GA4 property 358273543, public tag G-DCNTRG1DLV and URL-prefix GSC property. Successful inquiry event semantics remain unverified; no patient or form contents are collected by this dashboard. Choco booking.js emits booking_success only after the booking endpoint accepts the request; show a count only when that named event is observed, otherwise delivery remains unverified. Event delivery is not established by a source-code audit alone.

Public form-script verification on October 7: Amazon emits lead_submit after HTTP success, ok:true and status:queued. Business Buying and Selling calls BBAS.formSuccess after its endpoint returns data.success. Dentistry calls formSuccess only after HTTP success, ok:true and a receipt; contact_success and appointment_request_success are deduplicated by form/receipt in the page, with no receipt or form values sent to GA4. Choco booking_success follows accepted response. The dashboard now recognizes all nine sites' accepted-submission events. Source verification is distinct from live delivery: sites with no matching GA4 events say “No success events observed.” No test inquiry was submitted during this audit.
