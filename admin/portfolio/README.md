# Portfolio reporting

Private route: https://admin.mindobirdwatching.com/portfolio/ . Home card and shared admin navigation link to Portfolio. Uses existing MBW Admin Access JWT verification; guide identity and public-site requests are rejected.

Same-origin GET /api/portfolio?days=7|28|90 calculates dates in America/Guayaquil, forwards the original signed identity to the owned n8n mbw-portfolio-report webhook, and validates the returned reporting dates. n8n verifies identity with the existing origin callback before Google reads. Google OAuth credentials remain in n8n. No new scopes, service accounts, grants or browser-stored credentials.

Active n8n workflow: kNCroau9fCq71j9G (MBW - Portfolio Reporting). Preliminary IQOBpdGvPZkv3F10 is unpublished. Execution-data retention is disabled. Checked-in workflow includes credential references only. Build source uses local existing workflow exports, not credential values.

GA4 property IDs were verified in the Analytics picker and existing Cloud Forest / Ecuador configuration. Public hostname filters exclude staging/admin hostnames. Search uses domain properties except Experience Ecuador's verified https://experienceecuador.com/ URL-prefix property. Both sources share the same completed period ending three days before today, with an equal-length previous period. Search requests finalized web-search data. Comparisons with zero/missing prior values remain neutral; no infinite percentage changes. Property metric failures remain unavailable, not zero. Portfolio totals require all eight sites for each metric.

Refreshes on open, period change, manual Refresh, and the next reporting day while visible. Sorting and expandable site details remain local. No historical snapshot fallback, invented trends, CRM revenue, scheduled notifications or third-party sharing.

Verification October 7, 2026: all eight GA4 and GSC sources returned live data. September 7–October 4: 1,247 sessions, 103,812 impressions, 1,072 clicks. Signed-in browser showed Connected. Unsigned webhook request returned HTTP 401. Functions compiled. Browser fixtures validated totals, unavailable clearing, recovery, period selection and mobile containment. Runtime host/identity/guide restrictions and date arithmetic were tested separately.

## Expanded analytics — October 7, 2026

Workflow v2 batches five GA4 reports per property: current/previous sessions and engaged sessions, 90 completed days of daily sessions, channel comparisons, top page views, and aggregate event counts. GSC adds 90-day daily impressions/clicks, top queries, top pages, and review candidates from up to 1,000 query rows. Eight GA batches plus forty Search requests. Batch failures remain unavailable. Google privacy thresholds/sampling are disclosed; query tables are top rows and exclude anonymized queries, so their sums are not site totals.

The overview adds CTR (movement in percentage points), successful submission events where source semantics were verified, and daily 90-day sparklines. Expansion shows engagement, WhatsApp intent separately, channels, page views, query/page search statistics, review candidates, and event/source health. Search opportunities use explicit modest heuristics, not guarantees. See integrations/portfolio/TRACKING-AUDIT.md for form semantics and launch QA caveats. Missing/unverified inquiries are not zero.

The existing protected mbw-recorded-outcomes feed is read in parallel by /api/portfolio for Mindo's aggregate recorded outcomes. It returns no personal records, and preserves the existing admin/guide access checks. Revenue is deliberately unavailable pending reconciliation. Expanded data clears on refresh and on failure; old trend charts and CRM values cannot remain as current. Local format/browser checks cover batching, date ranges, comparison mapping, source failure, untrusted query escaping, expanded panels, CRM totals, recovery, and mobile containment.

Live browser verification: 1,247 sessions, 103,812 impressions, 1,072 clicks; all eight CTR and traffic trends loaded. Mindo expansion returned channel comparisons, engagement, page views and search opportunities. Protected recorded outcomes returned 47 inquiries created, 17 bookings from that inquiry cohort, and 21 completed tours for September 7–October 4. Existing testing-page traffic is disclosed. API tests verified identity restrictions before upstream reads and that contact rows never reach the dashboard.

## Nine-site reporting update

Added Arguello Dentistry: verified GA4 property 358273543 and URL-prefix Search Console property https://arguellodentistry.com/. Summary requests now cover nine sites (54 requests). Expanding a site loads one five-report GA4 batch plus six Search Console reports, including landing pages, source/medium, campaigns, countries, devices and prior query/page rows. Movement compares rows present in both periods; an omitted query is never assumed to have zero traffic. Tables display ten rows from the fetched sample.

Known testing/admin/preview/staging/QA page paths are excluded from GA4 by default; an explicit checkbox includes them. This filter does not identify every internal visit or test inquiry, and GSC is unaffected. Event counts now include prior-period comparisons. Mindo business aggregates show current/prior counts and current recorded booking status as a fraction of the created inquiry cohort. Revenue remains unavailable pending reconciliation. No paid service was added.

## Operational dashboard additions

The Needs attention panel selects up to three transparent review suggestions, using connection failures, substantial absolute/percentage losses, low-CTR visibility and unobserved success-event delivery. Absolute period changes supplement percentages in site rows. These are review prompts, not causal conclusions.

Accepted-submission events are mapped for all nine sites after source inspection. Dedicated inquiry measurement separates starts, attempts, accepted submissions, errors and contact clicks. No patient/contact form contents are read or displayed. No real or test inquiries were submitted for this update.

On-demand indexing uses the existing Google OAuth credential and Google URL Inspection API for at most three validated public HTTPS pages on the selected domain: homepage plus two leading GSC pages. Results are Google's stored index state, not a live crawl or complete site coverage. Individual API errors stay unavailable. Credentials/access remain unchanged.

The protected /api/portfolio-log endpoint stores operational changes in a dedicated portfolio_changes table using the existing MBW_ATTRIBUTION_DB binding. It requires administrator identity; writes require same origin, validate dates/types/domain/description length, and expose only operational entries. A single factual October 7 dashboard update is seeded. Log entries filter by site and annotate 90-day charts when within their dates. An unavailable database shows a clear error; nothing is silently saved locally.
