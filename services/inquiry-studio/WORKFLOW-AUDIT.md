# Custom tour workflow audit

## Operating model

One Inquiry Studio record is the source of truth. It contains a shared case-memory layer and two deliberately different projections:

```text
Guest request
    │
    ├── Shared case memory
    │     named owner, contact preference/time zone, budget, confirmed facts,
    │     unresolved decisions, promises, next action, room/deposit tracker
    │
    ├── Guide Nest projection
    │     route, dates, accessibility, inclusions, checks, net costs
    │     no guest contact, admin markup, sell price, margin, or profit
    │
    └── Admin proposal projection
          approved guide-quote version, editable working itinerary,
          guest sell prices, markup, lodging override, profit, approvals
```

The guide quote is versioned and remains immutable after submission. A requested change creates a new guide-quote version. Admin pricing is kept in `final_plan_json`; it is never returned by the Guide Nest projection.

The case-memory layer is kept in `handoff_json.case_context`. It is human-reviewed operational memory, not an AI profile and not a substitute for the original email thread. The next staff member should be able to see what was promised, what changed, and what remains unresolved before drafting a reply.

## Real-world lifecycle

| Step | Owner | System state | Required evidence |
| --- | --- | --- | --- |
| 1. Tourist inquiry | Admin | `draft` | Original request and contact link |
| 2. Soft follow-up | Admin | `guest_details` | Missing dates, party, lodging, mobility, budget |
| 3. Preliminary request | Admin → guide | `awaiting_guide_quote` | Sanitized day brief and response date |
| 4. Preliminary pricing | Guide → admin | `guide_quote_received` | Versioned route and net cost rows |
| 5. Admin proposal | Admin | `proposal_ready` | Approved guide version plus private sell prices |
| 6. Guest review | Admin → guest | `guest_review` | Preliminary proposal event; no automatic sending |
| 7. Changes or approval | Guest → admin | `guest_changes_received` or `guide_final_confirmation` | Note recording the decision |
| 8. Final guide check | Guide → admin | revised quote version or final confirmation | Dates, route, net costs, availability |
| 9. Final guest approval | Admin → guest | `guest_final_confirmation`, then `invoice_ready` | Reviewed final proposal |
| 10. Invoice | Admin | `invoice_sent` | Invoice reference recorded by the invoice workflow |
| 11. Deposit and supplier holds | Admin | future booking state | Payment reference, room/activity hold expiry, supplier deposit |
| 12. Operations handoff | Admin → guide/driver | future operations state | Final guest-safe assignment, pickup details, confirmations |
| 13. Completion | Admin | future completed state | Trip completion and supplier settlement |

## Evidence from the Robert case

The email thread exposed failures that price tables alone cannot solve:

- The guest needed a named human owner and explicitly reacted negatively to replies that felt anonymous or disconnected from the paper trail.
- The route changed more than once: the overnight sequence, the February 13/14 order, and the final Quito return all needed continuity.
- Accommodation was not merely a cost row. Each stay had dates, property choices, guest and guide lodging, breakfast/meals, availability, a 50% deposit, and a booking responsibility.
- The guest supplied a budget ceiling and a preferred room range; these must remain visible when optional activities or revised supplier costs change the total.
- Phone coordination required the guest's time zone and a mutually understandable contact window.
- A promise such as “we are confirming lodging” must stay open until it is resolved; it cannot disappear when another email is drafted.

These are now represented in the case-memory and lodging tracker rather than being buried in free-form notes.

## Pricing rules

- Guide/source costs are copied from the selected approved guide quote and cannot be edited in the admin proposal.
- Admin sell prices are stored by stable `cost_id` and can be edited independently.
- Applying a default markup recalculates non-accommodation rows.
- Accommodation defaults to net/no markup but remains an explicit admin override.
- Daily and trip net, sell, gross-profit, and gross-margin totals are recalculated from rows.
- Any guide row marked `estimate` or `verify` blocks preliminary sending and final guest approval.

## Revision rules

- Admin itinerary edits do not modify the guide’s submitted quote.
- A guide revision request requires written instructions and marks admin pricing as requiring guide reconfirmation.
- Guide Nest shows the revision instructions and starts a new quote version.
- Re-approval retains matching admin sell prices by stable cost ID; new or changed cost rows require review.
- Dates, route, pricing, and approval events remain auditable rather than being overwritten.

## Tool handoffs

- **Inquiry Studio → Guide Nest:** sanitized request, dates, accessibility, required checks, and revision instructions. No guest contact or admin pricing.
- **Guide Nest → Inquiry Studio:** versioned itinerary options and net cost rows with confirmation status.
- **Inquiry Studio → Itinerary Generator:** approved admin day text and guest sell prices. Daily non-lodging services are grouped as a daily rate; lodging is exported as separate accommodation items.
- **Itinerary Generator → CRM:** a versioned guest itinerary snapshot is saved to the linked inquiry.
- **Itinerary Generator → Invoice Generator:** only agreed line items and the saved itinerary version are transferred.
- **Invoice Generator → accounting/CRM:** invoice identifiers and item rows are recorded; an invoice should not silently change the approved itinerary.

Browser `localStorage` is currently used for the itinerary and invoice handoffs. It is a convenience bridge, not the durable record. The CRM/Studio records remain authoritative, and a future server-side handoff endpoint should replace browser-only transport.

## Required next phases

The workflow core is not the whole future system. These remain deliberate follow-on work:

1. Import and link Gmail, WhatsApp, attachments, and manual notes into a chronological interaction timeline with message IDs.
2. Save the exact guest-facing proposal/email artifact that was sent, with its itinerary and pricing version.
3. Add structured supplier records beyond one guide: drivers, hotels, reserves, activities, validity dates, availability checks, and price expiry.
4. Add booking states after invoice: deposit received, supplier holds, reservations confirmed, operations ready, completed, and cancelled.
5. Convert the approved plan into final Guide Nest/driver assignments only after approval/payment rules are satisfied.
6. Add deadlines and alerts for guide quote due dates, guest follow-ups, room-hold expiry, deposits, and reconfirmations.
7. Build the reusable inquiry bank with evidence source, confirmed date, expiration, and “reverify before reuse” rules. Past prices must never be presented as current automatically.
8. Add idempotent n8n/Sheets synchronization and conflict handling so Mac mini retries cannot duplicate records.
9. Add automated permission tests proving the guide API never returns sell price, markup, margin, profit, guest contact, or unrelated supplier costs.
10. Preserve a manual fallback when the Mac mini/local model is unavailable; AI analysis must never block saving or operating a tour.

## QA acceptance criteria

1. A guide account cannot receive guest email/phone or any admin pricing field.
2. Admin can change working dates and guest-facing agenda without changing the source guide quote.
3. Admin can set sell prices per source cost and see daily/trip profit immediately.
4. Lodging can remain unmarked while other rows receive a default markup.
5. A guest change can be recorded before it is sent to the guide.
6. Sending changes to the guide creates a new version and preserves the revision instructions.
7. Pending/estimated guide costs block guest send/final approval.
8. No workflow action sends email, WhatsApp, reservations, or invoices automatically.
9. Invoice status is reached only after final guest confirmation.
10. Stale Studio revisions and conflicting saves are rejected.
11. Case owner, budget, contact window, unresolved decisions, and promises survive reloads.
12. Lodging deposits are calculated from structured stay records and remain separate from tour markup.
13. Itinerary handoff preserves separate daily-tour and lodging line items.
14. A browser handoff never becomes the only copy of approved pricing or itinerary data.
