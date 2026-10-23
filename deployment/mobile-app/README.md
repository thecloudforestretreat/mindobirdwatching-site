# MBW Action Desk — Phase 1 release checklist

This release is intentionally fail-closed. Deploy the code with writes off, verify reads, add the protected n8n gateway, and only then enable writes.

## Cloudflare Pages

The existing Cloudflare Access application for `admin.mindobirdwatching.com/*` must continue to protect `/app/*` and `/api/mobile/*`. Do not add a public bypass for the PWA manifest, service worker, or API.

Configure these Production variables in the `mindobirdwatching-admin` Pages project:

| Name | Type | Production value |
| --- | --- | --- |
| `MBW_ADMIN_ORIGIN` | Text | `https://admin.mindobirdwatching.com` |
| `MBW_MOBILE_WRITE_ENABLED` | Text | `false` during validation, then `true` after the n8n gateway test |
| `MBW_MOBILE_ROLE_MAP` | Secret | JSON described below |
| `MBW_GUIDE_ROLE_MAP` | Secret | Guide-only email, provider aliases, and contributor mappings |
| `N8N_CRM_ADMIN_URL` | Text | Protected n8n gateway production URL |
| `N8N_CRM_ADMIN_TOKEN` | Secret | Same random secret stored by the protected n8n gateway |

The code accepts `MBW_MOBILE_WRITE_ENABLE` as a compatibility alias, but `MBW_MOBILE_WRITE_ENABLED` is the canonical project variable.

Keep `MBW_MOBILE_WRITE_ENABLED=false` in Preview. The Pages API also requires the token and a mapped staff code, so setting the flag alone cannot enable writes.

Use the exact Cloudflare Access email addresses, all lowercase:

```json
{
  "OWNER_ACCESS_EMAIL": {
    "role": "owner",
    "staffCode": "JPG",
    "name": "Juan"
  },
  "AGENT_ACCESS_EMAIL": {
    "role": "agent",
    "staffCode": "SS",
    "name": "Susana"
  }
}
```

Replace the two placeholder keys before saving the secret. Phase 1 recognizes only `owner` and `agent`. The staff code must be `JPG` or `SS` because the existing CRM workflow enforces those values.

Keep guide accounts in the separate `MBW_GUIDE_ROLE_MAP` secret so the owner and agent map can be maintained independently. A guide may have several CRM provider IDs for different service roles:

```json
{
  "guide@example.com": {
    "role": "guide",
    "name": "Guide name",
    "providerName": "Guide name",
    "providerIds": ["PROV-BIRDING", "PROV-ACTIVITY"],
    "contributorNumber": "001"
  }
}
```

Guide accounts are limited at the origin to `/guide/` and its required API and asset routes. Do not add the guide emails to the owner or agent role map.
Every Access-authenticated email must also appear in either `MBW_MOBILE_ROLE_MAP` or `MBW_GUIDE_ROLE_MAP`; unmapped identities are denied at the origin. Guide-specific attribution is added only to links on MBW-owned domains. Keep Google, Tripadvisor, and social profile destinations canonical and free of UTM parameters.

## n8n gateway

Do not add an authentication check directly to the existing `mbw-crm-admin-api` webhook yet. The current Guest CRM, itinerary generator, marketing tool, WhatsApp workspace, Stripe worker, and reporting functions still call that endpoint; changing it in place would break existing operations.

Create a separate production webhook at `/webhook/mbw-mobile-crm-api` with this sequence:

1. Webhook: POST only, response through a Respond to Webhook node.
2. Authentication gate: compare the incoming `X-MBW-CRM-Key` header with the same high-entropy value stored as `N8N_CRM_ADMIN_TOKEN`. Reject missing or unequal values with HTTP 401 before parsing or forwarding the payload. Store the value as an n8n secret/credential, never in workflow JSON.
3. Request guard: accept `application/x-www-form-urlencoded` with one `payload` JSON field, reject bodies over 16 KB, and allow only these Phase 1 actions: `list_inquiries`, `list_interactions`, `list_assignments`, `list_providers`, `list_bookings`, `list_payments`, `update_inquiry`, `create_interaction`, `update_assignment`.
4. HTTP Request: forward the original form `payload` server-to-server to the current `https://n8n.mindobirdwatching.com/webhook/mbw-crm-admin-api` workflow.
5. Respond: preserve the upstream JSON body and status. Do not log the authentication header or full guest payload in successful execution logs.

After activating the gateway, set `N8N_CRM_ADMIN_URL` to `https://n8n.mindobirdwatching.com/webhook/mbw-mobile-crm-api` in Cloudflare Pages. First verify the six read actions with `MBW_MOBILE_WRITE_ENABLED=false`. Then test one fictional inquiry update and readback. Only after that succeeds should Production change to `true`.

## Release verification

1. Unmapped Access user receives 403 from `/api/mobile/session`.
2. Mapped user receives a session but `capabilities.write` is false while the flag is false.
3. Action Desk, guest search, Guest Journey, payments, communications, and Today data match Guest CRM source records.
4. The service worker caches only the app shell; `/api/*` responses are never cached.
5. With writes enabled, stale `updated_at` values return 409 and verified saves perform a CRM readback.
6. Removing the n8n token, staff code, or write flag makes `capabilities.write` false and rejects every mutation.
7. Install from Safari/Chrome and confirm the app opens at `/app/` inside Cloudflare Access.

Rollback is one variable change: set `MBW_MOBILE_WRITE_ENABLED=false`. The existing Admin Hub and Guest CRM remain available and unchanged.
