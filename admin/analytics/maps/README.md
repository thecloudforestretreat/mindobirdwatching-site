# Markets & Guest Origins

Admin route: `/analytics/maps/`. Primary category: Analytics / Reports. Shared navigation and the admin home card link to it; Marketing, Reports and Guest CRM are linked from the page.

The lightweight map uses bundled public-domain Natural Earth 1:110m country boundaries (176 country shapes excluding Antarctica). Small countries and territories that have no shape still appear in the table. Map source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson . No third-party map scripts, tile requests, API keys, paid mapping subscription or AI calls. The browser loads a small static country map plus native JS/CSS; the city coordinate index stays inside the server worker and is not downloaded to browsers. Existing Cloudflare/n8n/Google infrastructure usage still applies.

## Read-only integrations

Same-origin `/api/maps` reuses the existing upstreams:
- GA4: `https://n8n.mindobirdwatching.com/webhook/mbw-ga4-acquisition`, GET `start` / `end` in YYYY-MM-DD with `view=markets`; current and previous reports fetched in parallel. Country report has sessions, totalUsers and engagedSessions. Credentials remain in the existing n8n integration.
- Guests: `https://n8n.mindobirdwatching.com/webhook/mbw-crm-admin-api`, POST `list_inquiries` with empty filters. No create/update actions. Names, contact details, booking identifiers and free-text fields are discarded during server aggregation and never returned to this page. No raw records or reports saved in browser storage.

The endpoint only serves the admin hostname or localhost development. Production verifies the existing Cloudflare Access JWT; the existing birding-only guide identity is rejected. Public-site and pages.dev endpoints reject reporting requests. Existing Access policy and middleware are retained. Responses use private, no-store. Functions must be included in the existing admin Pages deployment, alongside the existing root middleware.

No new secrets or permissions are required when the existing GA4 and CRM feeds remain accessible from Pages Functions. There is no new direct Google service-account setup or financial integration.

## Reporting rules

Website presets use complete calendar days in America/Guayaquil. Custom ranges are limited to 366 days. Previous periods have exactly the same number of days. Browser memory caches each selection for 15 minutes; Refresh now bypasses it. Visible-tab refresh every 15 minutes. Failures hide previous data rather than displaying it as fresh. Google thresholding / sampling / grouped-data flags are disclosed, and truncated or mismatched reports fail closed. Users are country-level values, not summed worldwide unique users.

CRM country is the booking contact's recorded country, not verified residence, nationality, or each group member's country; the existing CRM sometimes derives it from phone information. Records represent inquiries/bookings, not unique people. Completed requires a completed status or explicit tour_completed; current/upcoming require booked, deposit_paid or confirmed plus scheduled dates. Past scheduled bookings without completion are overdue/unverified; confirmed dates missing are separated. Prospective inquiries have a separate view. Duplicate, cancelled, lost, archived and superseded records are excluded. Repeated record IDs are deduplicated, while repeat bookings for the same guest remain distinct. Unreliable guest counts are missing, not assumed to be one. Unknown/unmapped countries remain in totals/table. Date filters use confirmed/scheduled tour start date; undated matching records are disclosed as excluded from date-filtered reports. All-time guest view defaults to all recorded dates.

Heat shading switches between balanced logarithmic colors and absolute linear volume. Exact values, period changes, country selection, region/search filters, market signals and aggregate CSV export accompany the map. Date/country/source metadata accompany exports. Geography alone is not booking attribution. City, daily, source/campaign and landing-page reports share country, region, city and cityId dimensions. Country and region filters apply to all modules; a selected city focuses its trend and traffic drilldowns. No revenue or booking attribution is inferred from GA4 activity.

## Validation

- `node --test tests/maps.test.mjs`: data rules, date validity, missing/truncated data, deduplication, privacy projection, host restrictions and signed-identity requirement.
- `node tests/maps-preview.mjs`, then `node tests/maps-browser.cjs`: synthetic fixtures at 320 / 768 / 1440 px; no overflow or JavaScript errors; map, measures, search, stages, empty/error/recovery and export behavior. Set PLAYWRIGHT_PATH to an installed Playwright package if necessary.
- `wrangler pages functions build functions --outdir <temporary path>`: Pages Functions compilation.

Live upstream read-only checks on October 2, 2026 confirmed GA4 country-report fields and complete 385-record CRM response. No personal records committed. Deployment must additionally verify both tabs in the signed-in admin browser. Website and public sitemap routes are not changed by this feature.

Cloudflare settings confirmed: repository root, output `admin`, no build command, main production branch, automatic deployments enabled, and watch path `admin/*`. Root `/functions` is compiled during deployment. A functions-only change will not trigger this admin build; include the appropriate admin release version update or explicitly retry the intended deployment. Runtime compatibility date is 2026-02-01; Functions compiled successfully against that date. New endpoint live-source checks returned 48 current / 65 prior-period GA4 country groups and 136 eligible confirmed CRM booking records across 28 country groups (including unknown), with no contact fields or guest identifiers returned.

## Demand reporting upgrade

Cloud Forest Teal is the default activity palette; Ocean Blue and Forest Green are available. Growth uses amber / neutral / teal and absolute changes, with prior-only countries and cities retained as zero current reported activity. City bubbles use area for volume or absolute change, and color for engagement or direction. Soft city glow is optional; it represents approximate centers, not continuous location density. Top 10 city rankings follow the date range, selected measure, country/region, ranking and minimum-session control. Engagement requires at least 20 current sessions; decline minimums consider current or prior sessions. Unknown cities are disclosed separately.

GeoNames cities15000 city-center data and admin1 region names were downloaded October 2, 2026 from https://download.geonames.org/export/dump/ . Attribution: GeoNames, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). The 33,764-name lookup is generated with `scripts/build-city-coordinates.py`. It matches normalized country/city and region where available, retains ambiguous same-name locations as unavailable and has a small explicit common-name alias table. Smaller/unmatched cities stay in rankings. No external geocoding requests or paid tiles. The map plots a maximum of 200 city centers and discloses session coverage.

Investor & partner briefing is a presentation mode plus a standalone downloadable HTML snapshot and browser print/save PDF. The snapshot includes current filters, source timestamps, map, summary, trends, source/page interest and coverage notes. It contains aggregate reporting, with no CRM identities or contacts. It does not call the private API or load external scripts. Leading named-market summaries require 20 sessions or five guest/inquiry records; smaller markets remain in the overall aggregate and map. Export is a manual action; there is no public dashboard or automatic sharing. Financial performance, attribution, capacity and actual partner requirements must be assessed separately.

### n8n update

Existing workflow: `MBW GA4 Website Acquisition` (`BdQw11V4mj2THl9y`). Replace only the JS in `Prepare GA4 Reports` and `Format GA4 Response` with the checked-in `integrations/n8n/prepare-markets.js` and `integrations/n8n/format-markets.js`, then save/publish through the normal editor. Existing credentials, HTTP node, webhook and connections are retained. Legacy requests preserve the original five dashboard reports; `view=markets` requests return five extended reports with schema_version 2 and a 100,000-row limit. Complete-row limits, invalid metrics, invalid dates and duplicate groups produce unavailable details rather than false zeros. Queries and fragments are removed from landing-page paths.

Activated through the signed-in n8n editor on October 2, 2026, published as Geographic demand reporting. Live checks confirmed legacy schema 1 and extended schema 2: 48 country groups, 340 city groups, 623 daily groups, 440 source groups and 696 landing-page groups for September 4–October 1. No additional credentials or permissions. Unavailable modules collapse into one integration-status panel.

Validation: `node --test tests/maps.test.mjs tests/markets.test.mjs` passes 22 tests; responsive synthetic browser checks at 320, 768 and 1440 px cover city selection, scoped drilldowns, palettes, guest stages, failure recovery, CSV and static briefing privacy. Synthetic fixtures are never deployed as reporting data.

## Outcomes and partner evidence

The website response also reads the existing CRM list once and returns a server-only aggregate projection. The inquiry cohort uses created_at in the selected period; confirmations describe current eligible recorded status within that cohort. Completed tours use completed_date, falling back to scheduled start. These measures have different date meanings and never form an attributed website conversion rate. Country/continent filters apply; city selection remains a GA4 drilldown because CRM city data is unavailable.

Repeat-contact bookings use a valid normalized email or guest ID across deduplicated eligible confirmed CRM history. No identity keys leave the worker. Missing identities are disclosed and counts do not represent verified unique travelers. Partner indicators count explicit yes lodging/transport requests, validated group sizes, and end dates later than start dates. Free-text needs, missing sizes and unknown durations are disclosed rather than guessed. Revenue is intentionally unavailable until a verified accounting feed exists; quoted_amount is not treated as earned revenue.

A 365-day preset supports investor trends. Reporting-context annotations are kept only in the open page and escaped into manual HTML exports; they are not automatically saved or shared. Data quality, freshness and geographic coverage are consolidated. Twenty sessions plus five confirmed cohort bookings qualify the combined market evidence signal. Validation now includes 26 data/security/privacy tests and responsive checks for the comparison, partner evidence, briefings and collapsed integration failures.
