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

Open Guest CRM passes only the inquiry ID and opens the exact existing record after live refresh. Existing CRM actions handle itinerary/invoice carryover. WhatsApp drafts and internal notes are not transferred. Production creation/enrichment, normalized-phone matching, shared storage, individual staff identity and live messaging remain pending. CRM data is not included in AI prompts.

Composer shortcuts open saved replies, tour information and AI drafting; mobile pane navigation preserves drafts. Layout/interaction checks cover 360, 390, 768, 1024 and 1440 pixels. Browser integration tests mock external services and do not prove production authentication or connectivity.

## Incoming campaign context · October 5, 2026

`whatsapp-source.mjs` extracts explicit Page/Reference fields from inbound messages. It accepts only MBW website URLs without embedded credentials, displays campaign/source/medium/content/term and Meta IDs, and keeps click IDs out of the summary. A paid UTM or ad ID is tracking evidence, not verified ad delivery. A Facebook click ID alone is not treated as paid traffic. Duplicate query parameters and multiple references trigger review notes. The latest source-bearing inbound message remains visible across ordinary replies.

The protected read-only `/api/whatsapp/reference` endpoint reuses CRM `lookup_reference`. Its response projects website attribution only; guest identities, visitor/session IDs and click tokens are not returned. A matched website contact intent does not automatically match a guest, create an inquiry or confirm a booking. URL/saved-source conflicts are surfaced for review.

A sample intake form allows manual testing with a pasted incoming message. This is local sample data, not a Meta webhook. Existing drafts are preserved. Page/ref metadata is collapsed in conversation bubbles and removed from AI message text. Meta webhook receipt, message-ID deduplication, phone matching, live CRM creation/enrichment and campaign-to-booking reporting remain pending.
