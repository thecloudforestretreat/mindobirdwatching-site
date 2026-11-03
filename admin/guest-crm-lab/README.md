# Guest CRM Lab Beta

Independent authenticated Beta workspace with a dedicated notes/follow-up editor; `/guest-crm/` and `/app/` remain the working tools.

`python3 scripts/build-guest-crm-lab.py` derives `index.html`, `workflow-base.css`, and `workflow-engine.js` from the current CRM. `source-manifest.json` records its source hash. Regenerate these outputs when the source CRM changes, then run the Lab tests and browser QA. Do not hand-edit the generated engine.

The Lab uses a protected read-only action allowlist at `/api/crm-lab/read`; the browser also gates legacy direct-fetch mutation paths. Only `/api/crm-lab/followup` permits a narrow PATCH of notes, follow-up date and explicit next-action/waiting metadata; no booking, service, assignment or financial mutations are permitted. Every save requires a loaded revision, same-origin staff authentication, the existing write flag/staff code, and readback verification. It cannot send invitations. Local caches and preferences use Lab-specific keys. The original profile explorer remains at `/guest-crm-lab/explorer/`.

Intentional Beta-only calendar changes: quick filters scope calendar entries, tour and follow-up events both appear on the same date, group preference is distinguished from confirmed capacity, and aggregate guest totals do not imply an availability warning. Week/day agenda modes are implemented by the Lab UI over the original month and agenda engine.

Broader record, duplicate, multi-service, assignment, invoice and accounting mutations remain disabled until their workflows are explicitly tested. The presence of the current CRM's full controls is not a claim that every write action is enabled in this Beta.

Today prioritizes operational follow-ups, unique upcoming departures and missing arrangements. Balances load on demand. Saved views store filters only in browser-local storage. The guest workspace uses six tabs over the existing controls. Provider conflict checks flag only overlaps with usable time intervals; missing intervals and unverified capacity are explicit.
