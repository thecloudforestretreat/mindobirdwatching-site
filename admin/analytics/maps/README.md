# Markets & Guest Origins

Admin route: `/analytics/maps/`. Primary category: Analytics / Reports. Shared navigation and the admin home card link to it; Marketing, Reports and Guest CRM are linked from the page.

The lightweight map uses bundled public-domain Natural Earth 1:110m country boundaries (176 country shapes excluding Antarctica). Small countries and territories that have no shape still appear in the table. Map source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson . No third-party map scripts, tile requests, API keys, paid mapping subscription or AI calls. New map/CSS/JS assets total approximately 150 KB uncompressed. Existing Cloudflare/n8n/Google infrastructure usage still applies.

## Read-only integrations

Same-origin `/api/maps` reuses the existing upstreams:
- GA4: `https://n8n.mindobirdwatching.com/webhook/mbw-ga4-acquisition`, GET `start` / `end` in YYYY-MM-DD; current and previous reports fetched in parallel. Country report has sessions, totalUsers and engagedSessions. Credentials remain in the existing n8n integration.
- Guests: `https://n8n.mindobirdwatching.com/webhook/mbw-crm-admin-api`, POST `list_inquiries` with empty filters. No create/update actions. Names, contact details, booking identifiers and free-text fields are discarded during server aggregation and never returned to this page. No raw records or reports saved in browser storage.

The endpoint only serves the admin hostname or localhost development. Production verifies the existing Cloudflare Access JWT; the existing birding-only guide identity is rejected. Public-site and pages.dev endpoints reject reporting requests. Existing Access policy and middleware are retained. Responses use private, no-store. Functions must be included in the existing admin Pages deployment, alongside the existing root middleware.

No new secrets or permissions are required when the existing GA4 and CRM feeds remain accessible from Pages Functions. There is no new direct Google service-account setup or financial integration.

## Reporting rules

Website presets use complete calendar days in America/Guayaquil. Custom ranges are limited to 366 days. Previous periods have exactly the same number of days. Browser memory caches each selection for 15 minutes; Refresh now bypasses it. Visible-tab refresh every 15 minutes. Failures hide previous data rather than displaying it as fresh. Google thresholding / sampling / grouped-data flags are disclosed, and truncated or mismatched reports fail closed. Users are country-level values, not summed worldwide unique users.

CRM country is the booking contact's recorded country, not verified residence, nationality, or each group member's country; the existing CRM sometimes derives it from phone information. Records represent inquiries/bookings, not unique people. Completed requires a completed status or explicit tour_completed; current/upcoming require booked, deposit_paid or confirmed plus scheduled dates. Past scheduled bookings without completion are overdue/unverified; confirmed dates missing are separated. Prospective inquiries have a separate view. Duplicate, cancelled, lost, archived and superseded records are excluded. Repeated record IDs are deduplicated, while repeat bookings for the same guest remain distinct. Unreliable guest counts are missing, not assumed to be one. Unknown/unmapped countries remain in totals/table. Date filters use confirmed/scheduled tour start date; undated matching records are disclosed as excluded from date-filtered reports. All-time guest view defaults to all recorded dates.

Heat shading switches between balanced logarithmic colors and absolute linear volume. Exact values, period changes, country selection, region/search filters, market signals and aggregate CSV export accompany the map. Date/country/source metadata accompany exports. Geography alone is not booking attribution. Campaign/source/landing-page country drilldowns and paid revenue require additional properly joined reports; separate totals are not presented as those relationships.

## Validation

- `node --test tests/maps.test.mjs`: data rules, date validity, missing/truncated data, deduplication, privacy projection, host restrictions and signed-identity requirement.
- `node tests/maps-preview.mjs`, then `node tests/maps-browser.cjs`: synthetic fixtures at 320 / 768 / 1440 px; no overflow or JavaScript errors; map, measures, search, stages, empty/error/recovery and export behavior. Set PLAYWRIGHT_PATH to an installed Playwright package if necessary.
- `wrangler pages functions build functions --outdir <temporary path>`: Pages Functions compilation.

Live upstream read-only checks on October 2, 2026 confirmed GA4 country-report fields and complete 385-record CRM response. No personal records committed. Deployment must additionally verify both tabs in the signed-in admin browser. Website and public sitemap routes are not changed by this feature.
