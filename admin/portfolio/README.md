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
