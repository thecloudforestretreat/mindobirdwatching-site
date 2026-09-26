# MBW sightings deployment notes

The public recap form sends data to `/api/guide-tour-recap`. Cloudflare verifies Turnstile, then forwards the normalized report to the active `MBW - Guide Sightings Submission` n8n workflow.

## Private contributor identities

Contributor codes and guide names must never be placed in public HTML or JavaScript. The private `contributors` tab in the Sightings workbook is the source of truth, with these headers:

```text
contributor_number\tguide_name\tactive
```

Keep `contributor_number` as a three-digit value such as `001`. Set `active` to `TRUE` for contributors who may submit and `FALSE` to revoke access without deleting their history. The workflow reads this tab on every submission, resolves the internal guide name, and rejects unknown or inactive numbers.

Add or deactivate contributors only in this private tab. Never expose the registry through the public recap form or species API.

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

Import both JSON workflows, set the Google Sheets credential, confirm the tab names (including `contributors`), and activate the workflows.
