# WhatsApp workspace — number connection last

## Delivered stage

`/whatsapp/` is a protected responsive admin workspace. It provides four fictional conversations, queue/search filters, Juan/Susana sample views, assignments with an internal handoff trail, next actions, private notes, sample inquiry linkage, reply drafts and simulated staff replies. English/Spanish source content comes from the existing Staff Info Library through `/api/whatsapp`; its allowlist excludes staff_notes and contact fields. Reference prices are never auto-approved. Source failure returns unavailable with no stale catalog fallback (the Studio and older static catalogs contain differing prices).

Sample work lives in sessionStorage in the current tab and is resettable. It is not a shared inbox, does not edit the CRM, and cannot send WhatsApp messages. The API explicitly rejects all POST requests with 409 while disconnected. Number onboarding is not exposed in the UI. Existing Cloudflare Access origin verification and guide restrictions apply. No tokens, phone registration, provider subscription, disk mounting or infrastructure installation is performed.

Staff replies and automated acknowledgments have separate timings; only accepted/delivered/read evidence (or explicitly labeled sample evidence) qualifies. Pending/failed sends and internal notes never count. Samples show elapsed time from the first inbound message, not later follow-up response time. The sample staff selector is not authentication or a production authorization control.

## Next implementation stages before the number is connected

1. Provision a dedicated shared message store on the Mac mini or managed database, with a stable conversation ID and separate inquiry links. Phone/chat IDs identify a conversation, not a booking. Multiple matching inquiries require staff review. Persist event IDs under a unique constraint, original provider timestamps, reception timestamps, direction, source and automation provenance. Encrypt backups and define retention.
2. Bind each staff action to the verified Access identity server-side. Add optimistic concurrency, server-side assignments, audit trails, drafts, unread cursors and handoff notifications. Browser sample data must never migrate automatically into production. Enforce same-origin writes and per-user access; never expose Meta secrets to the client.
3. Add a provider adapter and durable outbox. Require an idempotency key, enforce allowed reply window/template rules, authenticate incoming webhook signatures, replay-safe event ingestion and acknowledge only after durable persistence. Track provider acceptance/delivery/read/failure separately. Do not mark delivered on HTTP send success. Reconcile out-of-order ACKs, retries and echo events without duplicate messages.
4. Connect the existing Inquiry Studio as an optional draft assistant. Approved knowledge must have revision, language, effective date, approver and guest-safe text. Guest messages and attachments are untrusted data. Low-confidence or unsupported requests go to staff. AI cannot confirm availability, change bookings, approve custom prices or send unreviewed messages in the initial phase. AI failure must leave the human inbox usable.
5. Catalog approved media on the 8TB archive: asset ID, relative archive path, hash, permissions, captions, language and derivatives. Never serve arbitrary drive paths or expose the archive publicly. Maintain a second backup, generate bounded delivery copies, scan uploads and use the provider's media upload interface. A missing/offline drive must not block text messages.
6. Verify the specific Ecuador number's coexistence/onboarding eligibility, primary-phone access, linked-device requirements, app-message echo coverage, historical sync behavior, billing and template approval. Native app replies need reliable echo evidence to appear in API response-time reporting; unknown staff identity must remain unknown.
7. Test with a Meta test number and sample data before onboarding the business number. Validate mobile notifications, desktop/mobile concurrent edits, staff identity, opt-out/human handoff, failed sends, rate limits, disconnect recovery, media limits and backup restore. Only then connect the real number and gradually update website/Google Business Profile entry points.

## Suggested production records

- conversation: id, provider_chat_id, owner_identity, state, language, next_action, version
- message: id, provider_message_id, conversation_id, direction, source, actor_identity, automation_id, original_at, received_at, text/media_ref, delivery_state
- inquiry_link: conversation_id, inquiry_id, confirmed_by, confirmed_at
- internal_note: conversation_id, author_identity, created_at, text
- outbox: idempotency_key, conversation_id, requested_by, content_revision, status, provider_id, attempt_count
- knowledge: revision, source_id, language, category, guest_text, price_reference, approved_for_automation, approved_by, effective_at
- response_metrics: first_inbound_at, first_automation_at, first_staff_reply_at, evidence_source, coverage

No analytics report should treat a simulated reply, opening a chat, generating a draft or an automated acknowledgment as a human first response.

## Guest context and CRM lookup · October 5, 2026

The workspace has an authenticated, read-only CRM search at `/api/whatsapp/crm`. It uses the existing CRM `list_inquiries` action, returns at most ten projected records, and supports exact inquiry-ID lookup. It does not create, update or merge guests. Returned summaries omit email, phone, internal notes and historical message text.

Staff explicitly select an inquiry. A fictional conversation's association is labeled a local test association, never an automatic phone match. Only the inquiry ID persists with the sample; retrieved CRM details stay in memory and require refresh after reload. Dates and statuses of multiple recorded tour items remain separate. Booking status and payment status are displayed independently.

Open Guest CRM passes only the inquiry ID and opens the exact existing record after live refresh. Existing CRM actions handle itinerary/invoice carryover. WhatsApp drafts and internal notes are not transferred. Production creation/enrichment, normalized-phone matching, live messaging remain pending. Shared fictional storage and individual staff identity are implemented below. CRM data is not included in AI prompts.

Composer shortcuts open saved replies, tour information and AI drafting; mobile pane navigation preserves drafts. Layout/interaction checks cover 360, 390, 768, 1024 and 1440 pixels. Browser integration tests mock external services and do not prove production authentication or connectivity.

## Incoming campaign context · October 5, 2026

`whatsapp-source.mjs` extracts explicit Page/Reference fields from inbound messages. It accepts only MBW website URLs without embedded credentials, displays campaign/source/medium/content/term and Meta IDs, and keeps click IDs out of the summary. A paid UTM or ad ID is tracking evidence, not verified ad delivery. A Facebook click ID alone is not treated as paid traffic. Duplicate query parameters and multiple references trigger review notes. The latest source-bearing inbound message remains visible across ordinary replies.

The protected read-only `/api/whatsapp/reference` endpoint reuses CRM `lookup_reference`. Its response projects website attribution only; guest identities, visitor/session IDs and click tokens are not returned. A matched website contact intent does not automatically match a guest, create an inquiry or confirm a booking. URL/saved-source conflicts are surfaced for review.

A sample intake form allows manual testing with a pasted incoming message. This is local sample data, not a Meta webhook. Existing drafts are preserved. Page/ref metadata is collapsed in conversation bubbles and removed from AI message text. Meta webhook receipt, message-ID deduplication, phone matching, live CRM creation/enrichment and campaign-to-booking reporting remain pending.

## Reviewed automatic draft preparation · October 5, 2026

`whatsapp-routing.mjs` is a pure reusable preparation function for explicit initial full-day birding questions. It retrieves active language-matched Quest and Custom Full Day references from the live staff library. Both references are required. The approved answer-first copy names the combined Quest/Cock-of-the-Rock product correctly and asks only for conservatively detected missing date and party size; target birds are optional. Tracking URL numbers are excluded from detail detection. Half-day comparisons, bear tours, price/payment/cancellation and availability questions bypass this narrow pattern.

Automatic reference selection is the default for manual suggestions. Staff may select a specific source or a clarification-only mode. The opt-in browser-local automatic drafting checkbox runs the same suggestion flow when a sample inbound message is added. Approved full-day replies are composed immediately without a model call; other requests use local AI. Preparation never changes the staff draft or sends a message. The old fixed sample acknowledgment has been removed, including its exact legacy sample record. Real Meta receipt and automatic delivery remain unconnected and sending is disabled.


## Shared testing foundation · October 5, 2026

Open **Shared test inbox** explicitly to use the selected Juan/Susana profile as the working identity. Cloudflare Access authenticates the shared account; the profile is self-selected and remembered on each device. Both profiles are available in the directory. Guide-only access is denied. The existing `MBW_ATTRIBUTION_DB` binding is required. Missing binding produces a visible error and leaves local sample mode available. Tables are created idempotently in isolated `wa_test_*` namespaces; no attribution or CRM records are modified. Production binding and separate staff logins still need deployment verification.

Shared threads, notes, assignments, drafts, suggestions and saved replies persist in D1. Takeover/return-to-queue and author attribution support handoff. Thread revision checks reject stale saves; shared drafts/replies require ownership. Polling every 15 seconds shows recent viewing/editing presence. Rejected saves preserve local unsaved text for review. This is a test inbox, not a Meta message store or webhook.

Tour/date/party suggestions are derived conservatively from inbound text, excluding campaign URLs. A category such as full-day birding does not select a product. Staff confirm the details. Ambiguous dates/tours/counts need clarification. The read-only day lookup preserves multi-tour dates and statuses, distinguishes confirmed bookings from inquiries, excludes private bookings from joining candidates, and never infers capacity, guide availability or guest consent. Confirm compatibility before offering a group.

The simulated 24-hour countdown uses the last inbound timestamp, not the last staff reply. Expiry does not remove messages. It is neither a billing estimate nor proof of production messaging eligibility.

Reviewed improvements retain original suggestion, edited draft, reason, author and scope. Reusable approval is explicit; withdrawal creates another version. Only approved guidance is sent as editorial context to local AI. Prices, URLs and contact details cannot be put in general guidance. Current pricing and booking facts still require their verified sources. This is retrieved knowledge, not model-weight training.

**Download backup** exports current threads, notes, saved replies, staff, event audit and all guidance versions as private JSON. It is a manual backup; automated offsite backup and restore drills are not configured. Keep exports private. Samples cannot be reset from one staff device.

Tests use SQLite and isolated browser fixtures to exercise two staff identities, shared drafts, takeover, stale revisions, booking readiness, mobile/desktop rendering, learning versions and sending-disabled behavior. They do not prove the production D1 binding or Cloudflare staff policy. Meta connection, real incoming message deduplication, automatic CRM creation/enrichment, WhatsApp sending, templates and reminder delivery remain disabled/pending.

## Selected staff profiles · October 6, 2026

Juan and Susana may share Cloudflare Access. The remembered device profile, sent as an allowlisted X-MBW-Staff-Profile header, controls shared ownership and author attribution. This is a self-selected working identity, not authentication. Access verification still protects the workspace; thread audit retains the verified Access account separately. Green (#C6DBAD) and purple (#7C3AED) dots match CRM. Historical authors are not relabeled. Legacy email-owned test conversations require explicit takeover by a selected profile. Unfinished drafts must be saved or refreshed before switching.

## Inline CRM editor · October 6, 2026

Guest details beneath the WhatsApp composer load the exact linked inquiry and edit guest/contact fields, source, CRM rep, follow-up, planning and recorded financial information. The Guest details shortcut jumps to this section on mobile. Conversation ownership does not reassign CRM. Current CRM tour/date/guest count supply the readiness panel when no test override exists. Phone country is not assumed to be residence.

The protected same-origin /api/whatsapp/crm-edit endpoint allowlists editable fields and requires a selected staff profile plus explicit save. Quote/payment changes require financial confirmation. Only update_inquiry is used; no sample guest is created. IDs, unknown fields, attribution and internal notes are preserved. Planning edits update a selected existing tour; other tours remain intact. Actor/time/changed fields are appended to internal audit notes. Shared guest-table propagation follows the existing n8n workflow and still needs production verification.

A hash of the loaded record is compared with a new CRM read before saving. Changed records return conflict without a write. Readback must match edited fields before the interface claims Saved. Failure/unverified states retain edits. The payload includes expected_updated_at, but atomic compare-and-update support in n8n is unverified: a change between preflight and write remains possible. This is not an atomic lock against full CRM edits.

Tests use fictional records for mobile/desktop saves, preservation, separate rep/ownership, conflicts and failures. No production guest was edited by tests. Live number intake, automatic guest creation, phone matching and automated backups remain separate work.

## Conversation-first layout and automatic drafts · October 6, 2026

The central panel now prioritizes chat, a compact tour/date/guest strip, reply window and composer. Supporting source, booking and inline CRM sections live in expandable tools. Testing/connection controls are collapsed. Mobile uses pane navigation and direct Guest details/Edit booking shortcuts; desktop tools scroll separately. The desktop composer retains its action row while longer suggestions scroll internally.

Automatic preparation is enabled by default (staff may pause it in Draft settings). While the workspace is open, viewing an unanswered guest message or receiving a test inbound message prepares a suggestion without modifying the staff draft or sending. Approved full-day questions use the immediate pattern; other requests use local AI. A message/language/length/knowledge/learning fingerprint retains and reuses the suggestion. Regenerate is explicit; discarded/used suggestions do not immediately reappear in that session. New inbound messages invalidate older displayed suggestions and late model responses. Shared suggestions are persisted and viewable by both profiles; another owner's thread is not regenerated by the non-owner. Fully headless preparation from a future Meta webhook is not implemented yet.

Tests cover mobile/tablet/desktop visibility, automatic preparation, message cache reuse, new-message regeneration and preservation of manual text; CRM and shared handoff tests use mocked/isolated services. Model prompts prioritize missing dates and guest counts before pickup details.

Selected profile/owner/CRM rep dropdowns now carry CRM-matched color dots while retaining native keyboard/mobile selection. A narrow reviewed transportation rule respects explicitly undecided dates, asks for an approximate date without pickup pressure, and repeats only an unambiguous supplied party count. Pricing/reference or cancellation questions continue through the reviewed model flow. Draft-policy revision invalidates older cached suggestions.
