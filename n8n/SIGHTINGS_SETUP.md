# MBW sightings deployment notes

The public recap form sends data to `/api/guide-tour-recap`. Cloudflare verifies Turnstile, then forwards the normalized report to the active `MBW - Guide Sightings Submission` n8n workflow.

## Private contributor identities

Contributor codes and guide names must never be placed in public HTML, JavaScript, or repository files. Set `MBW_CONTRIBUTOR_MAP_JSON` privately on the n8n instance as a JSON object whose keys are three-digit codes and whose values are internal guide names.

The workflow validates the three-digit code against that private map and stores the internal contributor ID plus the resolved guide name. Add or deactivate contributors by updating the private map, not the public form.

## Google Sheet destinations

The workflow writes each submission to three tabs in the Sightings workbook:

- `guide_tour_recap`: one row per tour/report. `tour_id` receives the optional booking reference.
- `guide_tour_recap_species`: one row per bird selected in the report.
- `sightings_events`: the normalized guide sighting used by the admin Recent Sightings page.

The admin sightings workflow also appends every explicit **Check live eBird stats** request to `bird_demand`. Its headers must be:

```text
demand_id	speciesCode	requested_at	source_filter	period_days	request_type	created_at
```

This keeps browsing separate from demand: loading the page does not count as demand; clicking the live eBird button does.

## Guest follow-up path

Staff can give a guide a prefilled URL such as `/guide-tour-recap/?booking=MBW-BOOKING-REFERENCE`. The report stores that reference without exposing a guest email. A later automation can join `tour_id` to the CRM, create a bilingual bird checklist, and send the thank-you/review email only after staff approval.

Import both JSON workflows, set the Google Sheets credential, confirm the tab names, set the private contributor map, and activate the workflows.
