# Portfolio reporting

Private route: https://admin.mindobirdwatching.com/portfolio/ . Home card and shared admin navigation link to Portfolio. Uses existing MBW Admin Access JWT verification; guide identity and public-site requests are rejected.

Same-origin GET /api/portfolio?days=7|28|90 calculates dates in America/Guayaquil, forwards the original signed identity to the owned n8n mbw-portfolio-report webhook, and validates the returned reporting dates. n8n verifies identity with the existing origin callback before Google reads. Google OAuth credentials remain in n8n. No new scopes, service accounts, grants or browser-stored credentials.

Active n8n workflow: kNCroau9fCq71j9G (MBW - Portfolio Reporting). Preliminary IQOBpdGvPZkv3F10 is unpublished. Execution-data retention is disabled. Checked-in workflow includes credential references only. Build source uses local existing workflow exports, not credential values.

GA4 property IDs were verified in the Analytics picker and existing Cloud Forest / Ecuador configuration. Public hostname filters exclude staging/admin hostnames. Search uses domain properties except Experience Ecuador's verified https://experienceecuador.com/ URL-prefix property. Both sources share the same completed period ending three days before today, with an equal-length previous period. Search requests finalized web-search data. Comparisons with zero/missing prior values remain neutral; no infinite percentage changes. Property metric failures remain unavailable, not zero. Portfolio totals require all eight sites for each metric.

Refreshes on open, period change, manual Refresh, and the next reporting day while visible. Sorting and expandable site details remain local. No historical snapshot fallback, invented trends, CRM revenue, scheduled notifications or third-party sharing.

Verification October 7, 2026: all eight GA4 and GSC sources returned live data. September 7–October 4: 1,247 sessions, 103,812 impressions, 1,072 clicks. Signed-in browser showed Connected. Unsigned webhook request returned HTTP 401. Functions compiled. Browser fixtures validated totals, unavailable clearing, recovery, period selection and mobile containment. Runtime host/identity/guide restrictions and date arithmetic were tested separately.
