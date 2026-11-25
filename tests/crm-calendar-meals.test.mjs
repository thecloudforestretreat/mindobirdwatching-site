import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = JSON.parse(readFileSync(process.env.MBW_CRM_WORKFLOW_EXPORT || new URL('../deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json', import.meta.url), 'utf8'));
const node = name => workflow.nodes.find(item => item.name === name);
const calendar = 'Prepare Assignment Calendar Sync';
const invite = 'Prepare Guide Calendar Invite';
const fixture = {
  assignment_id: 'QA-ASN', inquiry_id: 'QA-INQ', guest_id: 'QA-GUEST',
  guest_name: 'QA guest', guest_count: '1', product_selected: 'MBW006 - Quest for Five Toucans',
  service_type: 'Birdwatching', service_date: '2026-11-26', start_time: '5:00', end_time: '15:00',
  provider_name: 'QA Guide', assignment_status: 'confirmed', created_by: 'JPG',
  google_calendar_event_id: 'existing-event',
};
const breakfast = { guest_decision: 'yes', finalization_status: 'finalized', payment_route: 'reserve_onsite', travelers: [
  { participation_status: 'included', finalization_status: 'finalized', traveler_index: 1 },
] };
const lunch = { ...breakfast, travelers: [
  { ...breakfast.travelers[0], meal_selection: 'trout' },
] };
const service = { id: 'primary', date: '2026-11-26', product_selected: fixture.product_selected, meal_options: { breakfast, lunch } };
const inquiry = (items, extra = {}) => ({ inquiry_id: fixture.inquiry_id, guest_id: fixture.guest_id, tour_items_json: JSON.stringify(items), ...extra });
const lookupNames = ['Read Calendar Meal Inquiry', 'Read Guide Invite Meal Inquiry'];
const page = readFileSync(new URL('../admin/guest-crm/index.html', import.meta.url), 'utf8');

function run(name, assignment = fixture, data = [inquiry([service])], lookup = true) {
  const provider = { provider_name: fixture.provider_name, calendar_invites_enabled: 'yes', google_calendar_email: 'guide@example.invalid' };
  const $ = n => ({
    first: () => ({ json: n === 'Process CRM Assignments' ? assignment : { created_by: 'JPG' } }),
    all: () => (lookupNames.includes(n) ? data : [provider]).map(json => ({ json })),
    isExecuted: lookup && lookupNames.includes(n),
  });
  return new Function('$', node(name).parameters.jsCode)($)[0].json;
}

for (const name of [calendar, invite]) {
  test(name + ': Eugene-shaped unlinked assignment shows separate bold meal lines above logistics', () => {
    const out = run(name);
    assert.match(out.calendar_description, /<b>RESERVE MEALS<\/b><br><b>Breakfast:<\/b> 1 guest · Pay at reserve<br><b>Lunch:<\/b> Trout × 1 · Pay at reserve/);
    assert.ok(out.calendar_description.indexOf('RESERVE MEALS') < out.calendar_description.indexOf('Guest:'));
    assert.equal(out.calendar_event_id, 'existing-event');
    assert.doesNotMatch(out.calendar_description, /unit_price|supplier|invoice|\$/);
  });

  test(name + ': exact linked occurrence wins; ambiguous or unrelated tours do not get meals', () => {
    const other = { ...service, id: 'other', meal_options: { breakfast } };
    assert.doesNotMatch(run(name, fixture, [inquiry([service, other])]).calendar_description, /RESERVE MEALS/);
    assert.match(run(name, { ...fixture, tour_item_id: 'other' }, [inquiry([service, other])]).calendar_description, /Breakfast/);
    assert.doesNotMatch(run(name, { ...fixture, tour_item_id: 'other' }, [inquiry([service, other])]).calendar_description, /Lunch/);
    for (const patch of [{ tour_item_id: 'missing' }, { service_date: '2026-11-27' }, { product_selected: 'MBW005' }, { product_selected: 'TRANS06' }, { service_type: 'Transportation' }, { inquiry_id: 'NOT-MATCHED' }, { guest_id: 'WRONG-GUEST' }]) {
      assert.doesNotMatch(run(name, { ...fixture, ...patch }).calendar_description, /RESERVE MEALS/);
    }
    assert.doesNotMatch(run(name, fixture, [inquiry([service], { is_archived: 'Yes' })]).calendar_description, /RESERVE MEALS/);
    assert.doesNotMatch(run(name, fixture, [inquiry([service]), inquiry([service])]).calendar_description, /RESERVE MEALS/);
  });

  test(name + ': only finalized, opted-in guests counted and diet text escaped', () => {
    const selected = { ...lunch.travelers[0], traveler_index: 2, allergy_dietary_notes: 'No <nuts> & dairy' };
    const pending = { ...lunch.travelers[0], meal_selection: 'pork', finalization_status: 'not_finalized', allergy_dietary_notes: 'pending note' };
    const declined = { ...selected, meal_selection: 'chicken', participation_status: 'not_eating', allergy_dietary_notes: 'declined note' };
    const meals = { breakfast: { ...breakfast, finalization_status: 'changed' }, lunch: { ...lunch, payment_route: 'mbw', travelers: [selected, pending, declined] } };
    const out = run(name, fixture, [inquiry([{ ...service, date: '11/26/2026', meal_options: meals }])]);
    assert.match(out.calendar_description, /Trout × 1 · Payment handled by MBW/);
    assert.match(out.calendar_description, /Dietary notes:<\/b> Guest 2: No &lt;nuts&gt; &amp; dairy/);
    assert.doesNotMatch(out.calendar_description, /Breakfast|Pork|Chicken|pending note|declined note|paid to MBW/);
  });

  test(name + ': no stale meal block and unrelated confirmation notes survive', () => {
    const legacy = 'BREAKFAST: 1 · pay at reserve\nLUNCH: 1 · pay at reserve · 1 trout';
    assert.doesNotMatch(run(name, { ...fixture, confirmation_note: legacy }, []).calendar_description, /BREAKFAST|LUNCH|RESERVE MEALS/);
    const out = run(name, { ...fixture, confirmation_note: 'Meet at the blue gate' }, [], false);
    assert.doesNotMatch(out.calendar_description, /RESERVE MEALS/);
    assert.match(out.calendar_description, /Confirmation note: Meet at the blue gate/);
  });

  test(name + ': a corrupt saved itinerary stops the calendar write without logging its contents', () => {
    assert.throws(() => run(name, fixture, [inquiry([service], { tour_items_json: '{ private data' })]), /Calendar was not changed/);
  });
}

test('CRM preview mirrors the calendar details and never previews a pending selection', () => {
  const helpers = page.slice(page.indexOf('      function guestCountNumber'),page.indexOf('      function mealOptionsHtml'));
  const preview = new Function('clean','productCodeFromValue','toDateValue',helpers+'\nreturn guideMealSummary;')(
    value => String(value??'').trim(), value => String(value??'').match(/MBW\d{3}/)?.[0] || '', value => String(value??'')
  );
  assert.equal(preview({ breakfast,lunch }), 'BREAKFAST: 1 guest · Pay at reserve\nLUNCH: Trout × 1 · Pay at reserve');
  assert.equal(preview({ breakfast: { ...breakfast, finalization_status: 'changed' }, lunch: { ...lunch, guest_decision: 'pending' } }), '');
});

test('read-only lookup by persisted inquiry runs only for eligible active assignments', () => {
  const scopes = [['Write CRM Assignment', 'Route Calendar Meal Lookup', lookupNames[0], calendar], ['Read Provider For Calendar Invite', 'Route Guide Invite Meal Lookup', lookupNames[1], invite]];
  for (const [before, route, lookup, builder] of scopes) {
    const expression = node(route).parameters.rules.values[0].conditions.conditions[0].leftValue.slice(3, -2);
    const valueFor = assignment => new Function('$', 'return ' + expression)(() => ({ first: () => ({ json: assignment }) }));
    assert.equal(valueFor(fixture), 'lookup');
    for (const patch of [{ product_selected: 'TRANS06' }, { service_type: 'Transportation' }, { inquiry_id: '' }, { assignment_status: 'cancelled' }, { is_deleted: 'Yes' }]) assert.equal(valueFor({ ...fixture, ...patch }), 'skip');
    assert.equal(node(lookup).parameters.filtersUI.values[0].lookupColumn, 'inquiry_id');
    assert.equal(node(lookup).alwaysOutputData, true);
    assert.equal(node(route).executeOnce, true);
    assert.equal(workflow.connections[before].main[0][0].node, route);
    assert.equal(workflow.connections[route].main[0][0].node, lookup);
    assert.equal(workflow.connections[route].main[1][0].node, builder);
    assert.equal(workflow.connections[lookup].main[0][0].node, builder);
  }
  const edit = node('Google Calendar - Update Assignment Event').parameters.updateFields;
  assert.equal(edit.sendUpdates, 'none');
  assert.equal(Object.hasOwn(edit, 'attendeesUi'), false);
  assert.equal(run(calendar, fixture).calendar_action, 'update');
});
