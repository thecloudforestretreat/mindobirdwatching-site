# CRM and accounting reliability rollout

This change does not modify pricing, accounting formulas, invoice rows, payments or scheduled triggers. It uses the existing staff-only accounting dashboard, D1 binding and 15-minute private snapshot push.

## Dashboard and exception queue

1. Release the Pages changes first. Existing snapshots continue to work. The exception queue labels unknown column coverage as partial and hides audit results when the snapshot is not current.
2. As `mindobirdwatching@gmail.com`, back up the live `AccountingDashboardSource.gs` in **MBW Invoice to Confirmation Sync**. Compare it with the repository source; apply only the version, field-list, column-manifest and heartbeat changes. Do not overwrite other live project files. The existing trigger uses the saved source; do not create another trigger or rerun an accounting import.
3. Let the existing push run, or run `pushAccountingDashboardSnapshot` once as the owner. That sends the existing private reporting snapshot; it does not post ledger rows. Verify its success timestamp, then open Accounting → Controls and refresh. Confirm required column coverage and compare a known invoice to its exact service key in expenses and the guide queue.
4. Treat flags as review candidates. The queue allows a posting grace period, avoids retroactively expecting historical guide queue entries, and has no action that can alter records or send money. A Stripe accounting-sync heartbeat is visible only when the live sync already records a successful completion. Latest activity is not proof that every webhook or job succeeded.

## Save backend

The guarded route is off by default. It is limited to the standard Guest CRM **Save Record** path on the admin host and leaves custom webhooks, assignments and other integrations unchanged. It uses the existing primary CRM webhook plus a single D1 claim per request; only non-guest request metadata is written to that guard table. The guard never retries a write, and it returns the canonical row only after verifying that a unique inquiry was read back. The browser additionally verifies the service list and form fields.

1. Verify the new route is reachable with staff Access and denied without Access. Confirm the admin Pages project has its existing D1 binding on the environment being used.
2. In a test environment, opt in with `MBW_CRM_VERIFIED_SAVE_ENABLED=true`. Use a test inquiry to exercise new, returning and update saves, an intentionally lost acknowledgement, and a repeated request ID. Confirm one write per ID and no invoices, notifications or assignments caused by the test.
3. Once tested, enable the setting in the admin production environment and redeploy. Verify the capability endpoint reports enabled, then validate the first approved live save and confirm the timestamp in Controls. Turn the flag off to roll back new saves to the previous verified-readback path. For a save already attempted through the guard, verify the source record before changing the draft or switching routes.
