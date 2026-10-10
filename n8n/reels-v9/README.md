# Reels workflow v10

These files are the source backups for the four Code nodes in the live Reels workflow:

- `intake-defaults.js` → `[V2] Intake + Defaults`
- `build-local-creative-request.js` → `[V2] Build Local Creative Request`
- `parse-validate-local-draft.js` → `[V2] Parse + Validate Local Draft`
- `validate-copy-before-publishing.js` → `[CORE] Validate Copy Before Publishing`

`[V2] Write Enriched Copy to Sheet` must also write these validator-owned fields as
expressions from `$json`:

- `draft_model`
- `draft_generated_at`
- `supervision_status`
- `supervision_notes`
- `final_copy_source`
- `quality_score`
- `approval_status`
- `approval_timestamp`

Leaving those Google Sheets mappings blank allows approval and score values from an older
draft to survive regeneration. The live v9.1 workflow maps all eight fields explicitly.

The v10 publishing guard also blocks any selected destination that already has a stored
post ID, published date, or YouTube URL. Only one Reels publishing workflow may remain
published in n8n; the legacy `Production Sheet Finalized v12.1` workflow must stay
unpublished. Existing copy must score at least 92 before it can skip regeneration. The
writer and both validators reject generic recap language such as
"can unfold in unexpected ways", "three distinct moments", and engagement-bait questions.
