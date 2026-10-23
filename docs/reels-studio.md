# Reels Studio integration

The repository UI lives at `/admin/media/reels/` and is served as `/media/reels/` on
the Access-protected admin hostname. The admin project is static, so the UI calls the
Pages Function deployed with the main site at
`https://mindobirdwatching.com/api/admin/reels`. That Function allows only the
protected admin origin and keeps the n8n webhook URL out of browser code.

The production Reels writer and its publishing guard are backed up in
`n8n/reels-v9/`. Deterministic fallback copy is review-only, approved copy requires a
score of at least 92, and the final publishing gate independently rejects copied
intake wording, ellipses, repeated locations, generic titles, unnatural activity
grammar, and known filler templates.

## Cloudflare configuration

Set this Pages environment variable in Preview and Production:

- `N8N_ADMIN_REELS_WEBHOOK_URL`: production webhook URL for the Reels admin gateway.

The gateway must return JSON. The Pages Function validates all write requests before
forwarding them.

## Gateway actions

All upstream requests use `POST application/json`.

### `list_reels`

Request fields: `status`, `query`, `from`, `to`, and `limit`.

Return either a JSON array or `{ "reels": [...] }`. Rows use the existing `ai_reels`
column names. `youtube_url` is preferred; the UI creates a standard YouTube watch URL
from `youtube_post_id` when the URL is empty.

### `create_batch`

Receives one to twenty validated reels plus `mode` (`review` or `auto`). Every reel has
a unique `reel_id`, `submitted_at`, `source=admin_reels_studio`, four platform flags,
an explicit IANA time zone, and the existing sheet input fields.

The gateway should:

1. reject a video URL already present in `ai_reels`;
2. allocate `post_id` values in one serialized step;
3. append the rows;
4. invoke the local generation path immediately;
5. leave review-mode rows in a non-publishing state;
6. set auto-mode rows to `Scheduled` only when validation passes;
7. return `{ "count": number, "created": [...] }`.

### `update_reel`

Receives `reel_id`/`post_id` and an allowlisted `edits` object. Update only the named
row and preserve platform publication IDs and dates.

### `approve_reel`

Re-run deterministic validation against saved edits. Set `status=Scheduled` only when
`approval_status=APPROVED`, `quality_score>=92`, and at least one automated destination
(Instagram, Facebook, or YouTube) is enabled. TikTok is copy-only.

### `regenerate_reel`

Run the local LLM and deterministic recovery immediately. Preserve the schedule,
destination flags, and all platform publication IDs. The action remains available for
scheduled reels, so copy can be regenerated without first removing the schedule.

### `retry_reel`

Retry only selected platforms whose publication ID is blank. Never resend a platform
that already has a saved post ID.

Retries are also blocked when a platform has a durable publication claim but no saved
post ID. That state is intentionally ambiguous: the platform request may have succeeded
while the following Sheet update failed. Reconcile the platform first; do not clear a
claim merely to make the workflow run again.

### `publish_overdue`

Receives an approved overdue `reel_id`/`post_id`. The gateway must verify that the
scheduled time has passed, the copy remains approved with `quality_score>=92`, and no
destination has an unresolved publication claim. It preserves the original scheduled
date and time, queues only destinations without a durable platform ID, and invokes the
single publishing workflow immediately. The response means recovery was accepted; it
does not claim that a platform post is live.

### `health`

Confirms the complete local path from the Pages Function through n8n and Google Sheets,
then checks Ollama from the Mac mini. Return a `services` object with separate `ok`
values for `n8n`, `sheets`, and `ollama`. A partial failure must remain visible rather
than being collapsed into a generic success response.

## Publication safety model

Instagram, Facebook, and YouTube are claimed in `ai_reels` before any external API call.
The row remains `Scheduled` while routing is evaluated.

- A successful platform write saves its external ID and sets its state to `PUBLISHED`.
- A complete run becomes `Published` only after every automated destination has proof.
- A timeout after a claim becomes `RECONCILE`; automatic retry is disabled.
- TikTok captions and hashtags are generated for copying, but TikTok is not published.
- Stale generation locks become reviewable after 15 minutes instead of remaining stuck.

## Mac mini dependency

The Mac mini is the production runtime for n8n and Ollama. If Ollama does not complete a
local writing pass, approval is removed and publishing fails closed. If the admin API
cannot reach n8n, it returns HTTP 503 and explains that the Mac mini service is offline;
queued rows remain untouched.

The production Reels and Carousel queues are checked once per hour, at minute `:00`.
Rows stay eligible after their scheduled time, so an outage does not discard them. A
row scheduled between hourly checks can publish at the next check; the normal 7:00 AM
schedule aligns exactly with the 7:00 AM check.

The Studio health strip is an operator check, not an outage monitor. An independent
cloud monitor is still needed for proactive notifications because a computer that is
powered off cannot run its own alerting workflow.

## Time zones

New submissions use `America/New_York` and the UI labels the schedule as Eastern time
(EST/EDT). The gateway should convert the supplied local date and time to one instant
before comparisons and retain the submitted zone for display.

## Local visual QA

Serve the repository root, then open:

`http://127.0.0.1:8000/admin/media/reels/?demo=1`

Demo records are enabled only on `localhost` and `127.0.0.1`; production can never enter
demo mode.
