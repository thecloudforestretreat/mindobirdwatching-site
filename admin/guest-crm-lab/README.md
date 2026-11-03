# Current mode: Live data, read only

The Lab loads the production CRM through protected read endpoints. It refreshes every five minutes while visible and retains a manual Refresh CRM button. The freshness banner distinguishes cached records from a successful live sync. Incoming live records replace the Lab cache instead of merging local changes.

Customer-record editing is disabled in the UI and browser network gate. Server PATCH handlers additionally require the separate CRM_LAB_WRITE_ENABLED opt-in, which is absent in production; defaults reject writes before reaching the CRM. Account saved-view preferences remain available and never change guest records. Existing CRM and Nest interfaces retain their own editing capabilities.

The following describes the controlled-editing implementation retained for possible future evaluation; it is not enabled in the review Lab.

# Guest CRM Lab Beta

Independent authenticated workspace at `/guest-crm-lab/`. The working `/guest-crm/` and `/app/` interfaces are unchanged.

`python3 scripts/build-guest-crm-lab.py` derives index.html, workflow-base.css and workflow-engine.js from the current CRM; source-manifest.json records its hash. Regenerate when the CRM source changes. Do not hand-edit the generated engine.

## Controlled editing

Dedicated editors support guest contact/representative details, itinerary-service details and additional planned services, plus notes/follow-up metadata. Contact/service edits show exact changes and require explicit confirmation. Loaded revision checks, same-origin staff authentication, the existing write flag and canonical readback apply. Existing financial values, service IDs/statuses and unrelated fields are retained. New services start in planning. Assignment/calendar changes, messages, invoices, payments, duplicate merges and legacy broad saves remain in the working tools. Service edits do not reschedule providers or notify guests.

`CRM_LAB_STORE` is a private Workers KV binding. It stores per-login saved filters and append-only edit intents/outcomes. Audits record actor, time, before/after and verified/unknown outcome; earlier untracked edits cannot be reconstructed. A CRM write is not attempted if the audit intent cannot be stored. Unverified outcomes lock the editor until reload. KV propagation can briefly delay cross-device views/history; version checks prevent known stale preference overwrites but are not a transactional global lock.

## Workflow

Today prioritizes follow-ups, unique upcoming journeys and missing arrangements. Six guest tabs retain the full reference workflow. The departure checklist distinguishes guide acceptance, pickup/time, itinerary preparation, guest acknowledgment and balance evidence. Missing evidence stays pending. The timeline scopes messages/providers/payments to the selected inquiry and labels undated snapshots honestly. Document tools receive refreshed saved guest/service context; drafts cannot be handed off.

Saved filter views sync privately to the signed-in account, with explicit Sync for another device and optional import of previous browser views. Caches remain Lab-specific. Month/week/day calendar modes preserve separate same-day tour/follow-up events, filter scope and group preference versus confirmed capacity. Provider overlap checks require usable time intervals. The earlier profile explorer remains at `/guest-crm-lab/explorer/`.

## QA

Run the Lab, workspace, daily-workflow, calendar and service tests. Use fictional records for mutation browser tests. Production checks must not modify customer records solely for QA.
