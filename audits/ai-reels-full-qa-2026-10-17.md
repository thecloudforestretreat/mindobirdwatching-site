# AI Reels Full QA Audit — 2026-10-17

## Scope

Reviewed the complete Reels path from Admin Studio intake through the Cloudflare API, n8n Admin Gateway, Google Sheets queue, hourly n8n publisher, Instagram, Facebook, YouTube, and Telegram confirmation. Carousel Studio was included as a regression check because it shares the same admin and Mac mini operating environment.

## Production findings and resolutions

| Area | Finding | Resolution | Status |
| --- | --- | --- | --- |
| Publication ownership | Admin saves, approvals, and retries could start the main publisher while the hourly schedule could start another execution. This created a race that could send duplicate posts. | The Admin Gateway now routes saves, approvals, and retries to `update_only`. The hourly workflow is the sole publication owner. Regeneration can still trigger immediate copy generation. | Fixed and published |
| Approval consistency | “Approve & schedule” saved edits and approved the row in two separate requests, so approval could validate stale Sheet values. | The browser sends the reviewed fields with the approval request. The API and gateway validate and save those exact values atomically. | Fixed and deployed |
| Copy quality parity | Admin approval did not enforce the same natural-language rules as the publisher; retry accepted quality 85 while publishing expected 92. | Admin approval now rejects stock AI/travel-brochure wording, inline hashtags, emojis, invalid lengths, missing fields, and invalid schedules. Retry now requires quality 92. | Fixed and published |
| Retry safety | A retry could run while an earlier platform attempt had an unresolved claim. | Retry is blocked for `CLAIMED`, `PUBLISHING`, `UNKNOWN`, or `RECONCILE` destinations until the live platform is checked. Existing platform IDs remain the destination idempotency keys. | Fixed and published |
| Schedule handling | Past times could be submitted, and schedule validation was split between browser and workflow. | Future Eastern time is enforced in the browser, Cloudflare API, and n8n gateway. Date/time remain editable before publishing. | Fixed and deployed |
| Video replacement | Replacing an edited video could unnecessarily disturb approved copy. | The existing dedicated `replace_media` path was preserved. It changes only the Cloudinary video URL and locks after publication begins or a claim becomes ambiguous. | Verified |
| Queue quality | The 10/18 scheduled reel contained formulaic copy despite a score of 100. | The row was rewritten in a natural guide voice, marked `HUMAN_QA_REVIEWED`, and revalidated against the publisher guard. | Corrected |
| Mac mini outage behavior | n8n and Ollama remain dependent on the Mac mini. | The system fails closed: unavailable local services leave the reel queued and do not send a social post. | Verified; operational dependency remains |

## Verification completed

- Main n8n workflow published as `MBW - AI Reels v2 - Local First v17 - Approval Parity`.
- Admin Gateway published as `v17 hardened gateway — verified` after an exact
  13,943-character source round-trip check confirmed that JavaScript escape
  sequences were preserved.
- The live Reels Studio then completed a read-only request through the new
  gateway and returned all 25 queue records (1 upcoming, 24 published).
- Reels Studio production asset updated to `reels-studio.js?v=10`.
- Production API rejected an intentionally invalid past Eastern schedule before queueing anything.
- Admin UI syntax, Cloudflare API syntax, atomic approval contract, replacement flow, Eastern scheduling, and cache version checks passed.
- Idempotency simulations passed for fresh claims, active claims, stale/ambiguous claims, partial success, retries, and completed destinations.
- Double-pass copy tests passed, including malformed local JSON, unsupported claims, awkward template prose, and unavailable Mac mini behavior.
- Carousel Studio regression QA passed; no social posts were sent by test suites.
- Repository deployment was made from a clean checkout of the current remote main branch. The stale local checkout and unrelated work were not merged or overwritten.

## Current queue

- One scheduled reel remains for October 18, 2026 at 7:00 AM Eastern.
- Approval status: `APPROVED`.
- Quality score: `100`.
- Copy source: `HUMAN_QA_REVIEWED`.
- No platform publication IDs or active publication claims were present during the queue audit.

## Expected dispatch timing

The publisher polls once per hour at minute `:07`, as requested. A reel scheduled
for 7:00 AM therefore becomes eligible at 7:00 AM and should be picked up by the
7:07 AM Eastern run. More generally, an eligible item can wait up to 59 minutes
for the next poll; the stored schedule remains the requested publish-after time.

## Remaining operational risk

The Mac mini is still a single point of availability. The workflow is protected against posting while it is unavailable, but it cannot generate copy or publish until the Mac is awake, online, and running n8n/Ollama. An independent uptime monitor or always-on host would remove that availability risk; it is separate from the duplicate-post and copy-quality defects fixed here.
