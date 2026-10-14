# Reels workflow v10

These files are source backups for the safety-critical Code nodes in the live Reels workflow:

- `intake-defaults.js` → `[V2] Intake + Defaults`
- `build-local-creative-request.js` → `[V2] Build Local Creative Request`
- `parse-validate-local-draft.js` → `[V2] Parse + Validate Local Draft`
- `validate-copy-before-publishing.js` → `[CORE] Validate Copy Before Publishing`
- `publish-claim.js` → the per-item claim node immediately before any social API call
- `finalize-publish.js` → the per-item finalizer after destination result updates

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

The v11 voice guard preserves explicitly supplied weather, natural setting, and emotion.
It blocks stock AI sales phrases such as "Experience the thrill of" without banning the
word "thrill" when that feeling is part of the user's story. Generated settings such as a
trail must be present in the intake before they can appear in platform copy.

The publication path is idempotent. Instagram, Facebook, and YouTube receive a durable
claim before their external API call. A claim without a saved platform ID is ambiguous
and requires reconciliation; it is never retried automatically. TikTok remains copy-only
and cannot block publication finalization.

The Mac mini is a required runtime dependency for n8n and Ollama. Transport errors are
recorded as `mac_mini_writer_unavailable`, remove approval, and fail closed before any
social publishing call. The admin API returns HTTP 503 with an explicit Mac mini outage
message when it cannot reach the workflow. An independent external uptime monitor is
still required to notify operators while the Mac mini itself is powered off.
