import fs from 'node:fs';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';

const workflow = JSON.parse(fs.readFileSync(new URL('./generated/MBW - Post-Tour Sightings Email - APPROVAL.json', import.meta.url), 'utf8'));
const buildNode = workflow.nodes.find((node) => node.name === 'Code • Build Approval Queue');
assert.ok(buildNode, 'build node exists');

const fixtures = {
  'Google Sheets • Read Recaps': [
    { recap_id: 'recap-a', tour_date: '2026-10-20', tour_type: 'Full day', route_name: 'Ruta San Lorenzo', guide_name: 'Chicho', submitted_at: '2026-10-20T18:00:00Z' },
    { recap_id: 'recap-b', tour_date: '2026-10-20', tour_type: 'Half day', route_name: 'Milpe', guide_name: 'Neicer', submitted_at: '2026-10-20T18:05:00Z' },
  ],
  'Google Sheets • Read Recap Species': [
    { recap_id: 'recap-a', speciesCode: 'bkmtou1' },
    { recap_id: 'recap-a', speciesCode: 'goltan1' },
    { recap_id: 'recap-b', speciesCode: 'bkmtou1' },
    { recap_id: 'recap-b', speciesCode: 'rehbar1' },
  ],
  'Google Sheets • Read CRM Inquiries': [
    {
      inquiry_id: 'INQ-QA', guest_id: 'G-QA', first_name: 'Alex', email: 'alex@example.com',
      status: 'completed', payment_status: 'paid', requested_date_start: '2026-10-20', is_archived: 'No',
      tour_items_json: JSON.stringify([
        { tour: 'Quest for Five Toucans', date: '2026-10-20', status: 'completed', service_type: 'Birdwatching' },
        { tour: 'Night Walk', date: '2026-10-20', status: 'completed', service_type: 'Activity' },
      ]),
      updated_at: '2026-10-21T12:00:00Z',
    },
    {
      inquiry_id: 'INQ-QA-2', guest_id: 'G-QA-2', first_name: 'Taylor', email: 'taylor@example.com',
      status: 'completed', payment_status: 'paid', requested_date_start: '2026-10-20', is_archived: 'No',
      tour_items_json: JSON.stringify([{ tour: 'Half-Day Birdwatching', date: '2026-10-20', status: 'completed', service_type: 'Birdwatching' }]),
      updated_at: '2026-10-21T12:05:00Z',
    },
    {
      inquiry_id: 'INQ-QA-3', guest_id: 'G-QA-3', first_name: 'Sam', email: 'sam@example.com',
      status: 'booked', is_archived: 'No',
      tour_items_json: JSON.stringify([{ tour: 'Half-Day Birdwatching', date: '2026-10-20', status: 'booked', service_type: 'Birdwatching' }]),
    },
    {
      inquiry_id: 'INQ-QA-4', guest_id: 'G-QA-4', first_name: 'Jordan', email: 'jordan@example.com',
      status: 'completed', payment_status: 'paid', requested_date_start: '2026-10-20', is_archived: 'No',
      tour_items_json: JSON.stringify([{ tour: 'Half-Day Birdwatching', date: '2026-10-20', status: 'completed', service_type: 'Birdwatching' }]),
    },
    {
      inquiry_id: 'INQ-QA-5', guest_id: 'G-QA-5', first_name: 'No Assignment', email: 'no-assignment@example.com',
      status: 'completed', payment_status: 'paid', requested_date_start: '2026-10-20', is_archived: 'No',
      tour_items_json: JSON.stringify([{ tour: 'Full-Day Birdwatching', date: '2026-10-20', status: 'completed', service_type: 'Birdwatching' }]),
    },
  ],
  'HTTP • Read Guide Assignments': [
    { records: [
      { assignment_id: 'ASN-A', inquiry_id: 'INQ-QA', guest_id: 'G-QA', service_date: '2026-10-20', service_type: 'Birdwatching', provider_role: 'guide', provider_name: 'Chicho', assignment_status: 'confirmed', is_deleted: 'No' },
      { assignment_id: 'ASN-B', inquiry_id: 'INQ-QA-2', guest_id: 'G-QA-2', service_date: '2026-10-20', service_type: 'Birdwatching', provider_role: 'guide', provider_name: 'Chicho', assignment_status: 'confirmed', is_deleted: 'No' },
      { assignment_id: 'ASN-C', inquiry_id: 'INQ-QA-4', guest_id: 'G-QA-4', service_date: '2026-10-20', service_type: 'Birdwatching', provider_role: 'guide', provider_name: 'Neícer', assignment_status: 'confirmed', is_deleted: 'No' },
      { assignment_id: 'ASN-DELETED', inquiry_id: 'INQ-QA', guest_id: 'G-QA', service_date: '2026-10-20', service_type: 'Birdwatching', provider_role: 'guide', provider_name: 'Neicer', assignment_status: 'cancelled', is_deleted: 'Yes' },
    ] },
  ],
  'Google Sheets • Read Approval Queue': [],
};

const $items = (name) => (fixtures[name] || []).map((json) => ({ json }));
const speciesCsv = fs.readFileSync(new URL('../data/custom-tour-builder/species_core.csv', import.meta.url), 'utf8');
const execute = new Function('$items', '$json', 'DateTime', buildNode.parameters.jsCode);
const result = execute($items, { body: speciesCsv }, DateTime);

assert.equal(result.length, 3, 'completed tours match independently by tour date and assigned guide');
const row = result[0].json;
const secondGuest = result[1].json;
const otherGuideGuest = result[2].json;
assert.equal(row.species_count, 2, 'same-day reports from another guide are not merged');
assert.equal(secondGuest.first_name, 'Taylor', 'a second guest party on the same guide and date is queued automatically');
assert.equal(secondGuest.recap_ids, 'recap-a', 'the same guide report is reused for all matching guests');
assert.equal(otherGuideGuest.first_name, 'Jordan', 'a second guide can run a different tour on the same date');
assert.equal(otherGuideGuest.recap_ids, 'recap-b', 'the second guide receives only their own same-date recap');
assert.match(otherGuideGuest.email_html, /Red-headed Barbet/);
assert.doesNotMatch(otherGuideGuest.email_html, /Golden Tanager/);
assert.equal(row.approval_status, 'PENDING_REVIEW');
assert.equal(row.delivery_status, 'QUEUED');
assert.match(row.email_subject, /October 20, 2026/);
assert.match(row.email_html, /Yellow-throated Toucan/);
assert.match(row.email_html, /Golden Tanager/);
assert.doesNotMatch(row.email_html, /Red-headed Barbet/);
assert.match(row.email_html, /Hi Alex,<br>Here is your Mindo bird list\./);
assert.match(row.email_html, /Your guide recorded these birds during your tour on October 20, 2026\./);
assert.match(row.email_html, /Birds recorded:/);
assert.doesNotMatch(row.email_html, /Your guides recorded|Birds recorded that day|combined every guide report/i);
assert.match(row.email_html, /mbw_logos_google_reviews_001\.jpeg/);
assert.match(row.email_html, /mbw_logos_trip_advisor_001\.jpeg/);
assert.match(row.email_html, /utm_source=sightings_email/);
assert.doesNotMatch(row.email_html, /This email was sent automatically with n8n/);
assert.equal(row.workflow_version, 'post_tour_sightings_v4');
assert.equal(row.queue_id, 'sightings_2026-10-20_G-QA_chicho');

const selectApprovedNode = workflow.nodes.find((node) => node.name === 'Code • Select Approved Emails');
assert.ok(selectApprovedNode, 'approval selector exists');
assert.match(selectApprovedNode.parameters.jsCode, /post_tour_sightings_v4/, 'sender rejects legacy workflow versions');
const selectApproved = new Function('$input', selectApprovedNode.parameters.jsCode);
const selectable = selectApproved({ all: () => [
  { json: { ...row, queue_id: 'legacy', workflow_version: 'post_tour_sightings_v1', approval_status: 'APPROVED' } },
  { json: { ...row, queue_id: 'previous', workflow_version: 'post_tour_sightings_v2', approval_status: 'APPROVED' } },
  { json: { ...row, queue_id: 'previous-v3', workflow_version: 'post_tour_sightings_v3', approval_status: 'APPROVED' } },
  { json: { ...row, queue_id: 'current', workflow_version: 'post_tour_sightings_v4', approval_status: 'APPROVED' } },
] });
assert.deepEqual(selectable.map((item) => item.json.queue_id), ['current'], 'only v4 approvals can reach Gmail');

const gmailNode = workflow.nodes.find((node) => node.name === 'Gmail • Send Approved Sightings Email');
assert.ok(gmailNode, 'Gmail sender exists');
assert.equal(gmailNode.parameters.options.ccList, 'mindobirdwatching@gmail.com', 'every sightings recap email CCs the MBW inbox');

fixtures['Google Sheets • Read Approval Queue'] = [{ ...row, workflow_version: 'post_tour_sightings_v2', approval_status: 'REJECTED', delivery_status: 'SKIPPED' }];
const migrated = execute($items, { body: speciesCsv }, DateTime);
assert.equal(migrated.length, 3, 'unsent legacy rows can be rebuilt as v4 review drafts');
assert.equal(migrated[0].json.workflow_version, 'post_tour_sightings_v4');
assert.equal(migrated[0].json.approval_status, 'PENDING_REVIEW');

fixtures['Google Sheets • Read Approval Queue'] = [];
fixtures['HTTP • Read Guide Assignments'][0].records.push({ assignment_id: 'ASN-CONFLICT', inquiry_id: 'INQ-QA', guest_id: 'G-QA', service_date: '2026-10-20', service_type: 'Birdwatching', provider_role: 'guide', provider_name: 'Neicer', assignment_status: 'confirmed', is_deleted: 'No' });
const ambiguous = execute($items, { body: speciesCsv }, DateTime);
assert.equal(ambiguous.length, 2, 'a conflicting guide assignment suppresses only that guest, not every tour on the date');
assert.deepEqual(ambiguous.map(item=>item.json.first_name), ['Taylor','Jordan']);
fixtures['HTTP • Read Guide Assignments'][0].records.pop();

fixtures['Google Sheets • Read Approval Queue'] = result.map((item) => ({ ...item.json, approval_status: 'APPROVED' }));
const rerun = execute($items, { body: speciesCsv }, DateTime);
assert.equal(rerun.length, 0, 'approved queue rows are immutable and not regenerated');

console.log(JSON.stringify({
  queue_id: row.queue_id,
  species_count: row.species_count,
  subject: row.email_subject,
  html_bytes: Buffer.byteLength(row.email_html),
  idempotency_check: 'passed',
}, null, 2));
