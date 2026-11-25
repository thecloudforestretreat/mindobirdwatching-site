import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Apply to a current CRM workflow export; leave unrelated nodes and settings intact.
const path = 'deployment/multi-invoice-ledger/MBW-CRM-Admin-API-multi-invoice.json';
const args = process.argv.slice(2);
const file = args[0] && args[0] !== '--from-ref' ? args.shift() : new URL('../' + path, import.meta.url);
const source = args[0] === '--from-ref'
  ? execFileSync('git', ['show', args[1] + ':' + path], { encoding: 'utf8' })
  : readFileSync(file, 'utf8');
const workflow = JSON.parse(source);
const get = name => {
  const node = workflow.nodes.find(item => item.name === name);
  if (!node) throw new Error('Required workflow node is missing: ' + name);
  return node;
};
const scopes = [
  { before: 'Write CRM Assignment', builder: 'Prepare Assignment Calendar Sync', code: 'record', read: 'Read Calendar Meal Inquiry', route: 'Route Calendar Meal Lookup', ids: ['1ba56c81-08ef-4f86-8a24-d4bdc8e1648c', 'f19eee44-9f86-48bf-9f21-9ef6e2882a47'], position: [[2368, 3664], [2496, 3664]] },
  { before: 'Read Provider For Calendar Invite', builder: 'Prepare Guide Calendar Invite', code: 'assignment', read: 'Read Guide Invite Meal Inquiry', route: 'Route Guide Invite Meal Lookup', ids: ['6e4d325e-ea00-48c3-8d37-52885a3ffc10', 'a1347e1f-9060-4599-ae83-b2394f033172'], position: [[2192, 4400], [2384, 4400]] },
];
const eligibleProducts = ['MBW005', 'MBW006', 'MBW007', 'MBW008', 'MBW010'];
const hasLookup = String.raw`(() => {
  const a = $('Process CRM Assignments').first().json;
  const code = String(a.product_selected || '').trim().toUpperCase().match(/\bMBW\d{3}\b/)?.[0];
  return !!String(a.inquiry_id || '').trim() && ${JSON.stringify(eligibleProducts)}.includes(code)
    && !/transport/i.test(String(a.service_type || ''))
    && !['yes','true','1','y'].includes(String(a.is_deleted || '').trim().toLowerCase())
    && !['cancelled','canceled'].includes(String(a.assignment_status || '').trim().toLowerCase());
})()`;

const formatting = String.raw`
// The saved tour is authoritative; a CRM draft or legacy assignment note is not.
function calendarMealBlock(service, rows) {
  const code = value => clean(value).toUpperCase().match(/\bMBW\d{3}\b/)?.[0] || '';
  const date = value => {
    const text = clean(value);
    const iso = text.match(/^(\d{4}-\d{2}-\d{2})(?:$|T| )/);
    if (iso) return iso[1];
    const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return us ? us[3] + '-' + us[1].padStart(2, '0') + '-' + us[2].padStart(2, '0') : '';
  };
  const product = code(service.product_selected);
  const day = date(service.service_date);
  const inquiryId = clean(service.inquiry_id);
  if (!inquiryId || !day || !MEAL_PRODUCTS.includes(product) || /transport/i.test(clean(service.service_type))) return '';
  const matches = rows.filter(row => clean(row.inquiry_id) === inquiryId);
  if (matches.length !== 1) return '';
  const inquiry = matches[0];
  if (['yes','true','1','y'].includes(clean(inquiry.is_archived).toLowerCase())) return '';
  if (clean(service.guest_id) && clean(inquiry.guest_id) && clean(service.guest_id) !== clean(inquiry.guest_id)) return '';
  const raw = inquiry.tour_items_json || inquiry.tour_items;
  if (!raw) return '';
  let items;
  try { items = Array.isArray(raw) ? raw : JSON.parse(raw); }
  catch { throw new Error('Calendar meals: the saved itinerary could not be read. Calendar was not changed.'); }
  if (!Array.isArray(items)) throw new Error('Calendar meals: the saved itinerary is not a tour list. Calendar was not changed.');
  const link = clean(service.tour_item_id);
  const candidates = items.filter(item => item && product === code(item.product_selected || item.tour)
    && day === date(item.date || item.tour_date)
    && (!link || (clean(item.id) || 'primary') === link)
    && !['cancelled', 'canceled'].includes(clean(item.status || item.booking_status).toLowerCase()));
  if (candidates.length !== 1) return '';
  const options = candidates[0].meal_options;
  if (!options) return '';
  const labels = { chicken: 'Chicken', pork: 'Pork', trout: 'Trout', other: 'Other' };
  const pay = { reserve_onsite: 'Pay at reserve', mbw: 'Payment handled by MBW', complimentary: 'Complimentary' };
  const lines = [];
  const dietary = new Set();
  for (const type of ['breakfast','lunch']) {
    const meal = options[type];
    if (meal?.guest_decision !== 'yes' || meal?.finalization_status !== 'finalized' || !Array.isArray(meal.travelers)) continue;
    const guests = meal.travelers.filter(guest => guest && (guest.finalization_status || meal.finalization_status) === 'finalized'
      && guest.participation_status === 'included' && (type === 'breakfast' || Object.hasOwn(labels, guest.meal_selection)));
    if (!guests.length) continue;
    const choice = type === 'lunch'
      ? Object.entries(labels).map(([key,label]) => [guests.filter(guest => guest.meal_selection === key).length,label])
        .filter(([count]) => count).map(([count,label]) => label + ' × ' + count).join(', ')
      : guests.length + (guests.length === 1 ? ' guest' : ' guests');
    const payment = Object.hasOwn(pay, meal.payment_route) ? pay[meal.payment_route] : 'Payment not recorded';
    const label = type === 'breakfast' ? 'Breakfast' : 'Lunch';
    lines.push('<b>' + label + ':</b> ' + html(choice) + ' · ' + html(payment));
    guests.forEach(guest => {
      const note = html(clean(guest.allergy_dietary_notes).replace(/\s+/g, ' '));
      if (note) dietary.add('Guest ' + html(guest.traveler_index || guests.indexOf(guest) + 1) + ': ' + note);
    });
  }
  if (!lines.length) return '';
  if (dietary.size) lines.push('<b>Dietary notes:</b> ' + [...dietary].join('; '));
  return '<br><b>RESERVE MEALS</b><br>' + lines.join('<br>') + '<br>';
}

function nonMealConfirmationNote(value) {
  const note = clean(value);
  const lines = note.split(/\r?\n/);
  // Old CRM versions wrote the preview into this field. Keep real staff notes.
  if (/^(BREAKFAST|LUNCH): \d+ · /.test(lines[0])
    && lines.every(line => /^(BREAKFAST|LUNCH): \d+ · |^DIETARY NOTES: /.test(line))) return '';
  return note;
}
`;

const link = name => ({ node: name, type: 'main', index: 0 });
const sheet = get('Read CRM Inquiry For Safe Update');
const switchTemplate = get('Route Assignment Calendar Action');
const productDeclaration = 'const MEAL_PRODUCTS = ' + JSON.stringify(eligibleProducts) + ';\n';

if (scopes.some(({ read, route, builder }) => workflow.nodes.some(node => node.name === read || node.name === route) || get(builder).parameters.jsCode.includes('function calendarMealBlock'))) {
  if (!scopes.every(({ read, route, builder }) => workflow.nodes.some(node => node.name === read) && workflow.nodes.some(node => node.name === route) && get(builder).parameters.jsCode.includes('function calendarMealBlock'))) throw new Error('Partial meal-calendar patch detected.');
  console.log('Meal calendar patch already present; no changes.');
} else {
  for (const { before, builder, code, read, route, ids, position } of scopes) {
    const edge = workflow.connections[before].main;
    if (edge.length !== 1 || edge[0].length !== 1 || edge[0][0].node !== builder) throw new Error('Unexpected workflow connection: ' + before);
    const routes = structuredClone(switchTemplate.parameters);
    routes.rules.values = [routes.rules.values[0]];
    const predicate = routes.rules.values[0].conditions.conditions[0];
    predicate.leftValue = '={{ ' + hasLookup + ' ? "lookup" : "skip" }}';
    predicate.rightValue = 'lookup';
    workflow.nodes.push(
      // The invite path receives all provider rows; the decision must run once
      // for the assignment, not once per provider.
      { ...structuredClone(switchTemplate), name: route, id: ids[0], parameters: routes, position: position[0], executeOnce: true },
      { ...structuredClone(sheet), name: read, id: ids[1], position: position[1], alwaysOutputData: true, parameters: {
        ...sheet.parameters,
        filtersUI: { values: [{ lookupColumn: 'inquiry_id', lookupValue: '={{ String($("Process CRM Assignments").first().json.inquiry_id || "").trim() }}' }] },
        options: { returnFirstMatch: false }
      } }
    );
    workflow.connections[before] = { main: [[link(route)]] };
    workflow.connections[route] = { main: [[link(read)], [link(builder)]] };
    workflow.connections[read] = { main: [[link(builder)]] };
    const node = get(builder);
    const js = node.parameters.jsCode;
    const start = "const " + (code === 'record' ? 'descriptionLines' : 'inviteDescriptionLines') + " = [\n  '<b>Mindo Bird Watching - Operations</b>',";
    if (!js.includes(start)) throw new Error('Unexpected calendar template: ' + builder);
    // These paths each handle a single assignment. Use first()/all() to avoid
    // ambiguous item lineage when the optional sheet lookup branches or is empty.
    let next = js.replace(" $('Process CRM Assignments').item.json", " $('Process CRM Assignments').first().json");
    if (code === 'assignment') next = next.replace('const rows = $input.all()', "const rows = $('Read Provider For Calendar Invite').all()");
    next = next.replace(start, productDeclaration + formatting + '\n' +
      'const mealRead = $(' + JSON.stringify(read) + ');\n' +
      'const mealBlock = calendarMealBlock(' + code + ', mealRead.isExecuted ? mealRead.all().map(item => item.json) : []);\n' +
      start + '\n  mealBlock,');
    if (code === 'record') {
      next = next.replace('clean(record.confirmation_note) ? `Confirmation note: ${html(record.confirmation_note)}`', 'nonMealConfirmationNote(record.confirmation_note) ? `Confirmation note: ${html(nonMealConfirmationNote(record.confirmation_note))}`');
    } else {
      next = next.replace("  '',\n  'Booking contact:", "  nonMealConfirmationNote(assignment.confirmation_note) ? `Confirmation note: ${html(nonMealConfirmationNote(assignment.confirmation_note))}` : '',\n  '',\n  'Booking contact:");
    }
    node.parameters.jsCode = next;
  }
  writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n');
  console.log('Added saved meal lookup and formatting to both guide calendar paths.');
}
