# CRM read-only review preview — October 9, 2026

Source base: da1ed018 (current origin/main at start). Isolated branch codex/crm-readonly-review; production unchanged.
Source backup: original workspace backups/mbw-crm-review-20261009/index.html and source-commit.txt. Fresh data backup attempt returned HTTP 403; no live data was modified. Published preview uses synthetic records only.

Features: saved-record summary, per-service confirmation checks plus confirmed/informed guide/driver checks, reminder preparation queue, advisory follow-up dates, confirmation drafts. Feature switch ?crmReview=1 enables; omitted or 0 disables. No data migration or automatic date changes. Existing WhatsApp sender remains disabled.

36 focused tests pass: existing visual/report/follow-up tests, read-only model preservation, verified vs unavailable operations data, strict service/date/provider matching, flexible services, closed/archive/past/sent exclusions, rescheduling and Ecuador date suggestions, default-off rendering, and preview API write rejection.
Browser QA synthetic scenarios: single paid bird tour Ready; multi-day bird/transport/bike lists all services and missing guide/driver; missing phone/pickup/rep checks; flexible activity Ready; completed, cancelled and past absent. Date suggestions do not mutate inputs. Desktop view and 390px mobile: no document horizontal overflow. Preview Save Record disabled. Feature off hides review tab and summary.

Release gate: live authenticated read-only data validation and Juan/Susana review remain before any production enablement. API backup must succeed before enabling data-writing features. Follow-up suggestions need workflow acceptance. WhatsApp integration needs its own delivery/retry/idempotency end-to-end checks; no sending feature added here.
Rollback: keep ?crmReview=0/default; remove additive UI/module if necessary. Source changes are isolated and do not modify existing storage schema, report fields, or messaging automation.
