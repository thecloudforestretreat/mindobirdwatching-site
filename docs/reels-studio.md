# Reels Studio integration

The repository UI lives at `/admin/media/reels/` and is served as `/media/reels/` on
the Access-protected admin hostname. It calls the same-origin Pages Function at
`/api/admin/reels`, so the existing Cloudflare Access middleware validates the user
before any read or write. Browser code never receives the n8n webhook URL.

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
`approval_status=APPROVED`, `quality_score>=85`, and at least one destination is enabled.

### `regenerate_reel`

Run the local LLM and deterministic recovery immediately. Preserve the schedule,
destination flags, and all platform publication IDs.

### `retry_reel`

Retry only selected platforms whose publication ID is blank. Never resend a platform
that already has a saved post ID.

## Time zones

New submissions send an explicit IANA zone. The default is `America/Guayaquil` (Mindo
time). `America/New_York` is also available. The gateway should convert the supplied
local date and time to one instant before comparisons and retain the submitted zone for
display.

## Local visual QA

Serve the repository root, then open:

`http://127.0.0.1:8000/admin/media/reels/?demo=1`

Demo records are enabled only on `localhost` and `127.0.0.1`; production can never enter
demo mode.
