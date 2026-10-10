# Reels workflow v9

These files are the source backups for the three Code nodes in the live Reels workflow:

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
