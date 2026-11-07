# Reel caption rule parity — 2026-11-06

These six code-node snapshots match the active local-first workflow `guq5d8gfb8kQVuvX` after the caption-length repair. They preserve the existing natural-voice, factual-authority, independent editor, targeted repair, review-mode, and publication safeguards.

The writer requested 20–80 words, the editor/repair accepted 20–85, while Studio, gateway and publisher required 35–100. All three prompts and validators now use 35–100 words excluding hashtags; prompts aim for 45–65. A rejected editorial draft still receives the existing targeted repair; unresolved failures remain drafts for human review. No model output is guaranteed to be factual or ready to publish solely because its length passes.

The UI now displays the specific saved YouTube title, shows a live caption word count, and refreshes validation feedback as edits change. Save edits does not schedule a reel.

Regression test: `node tests/reels-caption-parity.test.cjs`. It checks 16/34/35/100/101 words in all three validators, all prompt bounds, hashtag exclusion, and display-title preference. Existing upload, local delivery, timing, gateway and copy-quality checks also passed.

A standalone local writing call produced 45 words. This was a length smoke test only, with no queue or publishing calls. Original active-node sources and test evidence are in the master project's `outputs/reel-caption-repair-20261106`; n8n version history retains the previous workflow.
