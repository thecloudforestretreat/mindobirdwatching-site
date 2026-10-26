const request = $('Normalize Request').first().json;
const records = $input.all().map(item => item.json || item);
const action = String(request.action || '');

if (action === 'list_inquiries') {
  return [{ json: { ok: true, action, count: records.length, records, _route: 'respond' } }];
}

const incoming = { ...(request.inquiry_row || request.record || {}) };
const guest = { ...(request.guest_row || {}) };
const clean = value => String(value ?? '').trim();

// Reject contradictory quote metadata on new inquiries, including stale browser clients.
// Existing inquiry updates do not pass through this creation branch.
if (['create_guest_and_inquiry', 'create_returning_inquiry'].includes(action)
    && clean(incoming.quote_sent_at)
    && ['', 'not_sent'].includes(clean(incoming.quote_status).toLowerCase())) {
  return [{ json: {
    ok: false,
    error: 'Not saved: this new inquiry is marked Not Sent but has a quote-sent date. Clear the date, or record the quote as Sent only if it was actually sent.',
    _route: 'respond'
  } }];
}

const email = row => clean(row.email_normalized || row.email).toLowerCase();
const phone = row => clean(row.phone_normalized || row.phone_number || row.phone_raw).replace(/\D/g, '');
const date = row => clean(row.requested_date || row.requested_date_start).slice(0, 10);
const name = row => clean(row.full_name).toLowerCase();
const tour = row => clean(row.service_type || row.tour_type || row.tour_category).toLowerCase();
const yes = value => ['1','true','yes','y'].includes(clean(value).toLowerCase());
const status = row => clean(row.status).toLowerCase().replace(/[-\s]+/g, '_');
const archived = row => yes(row.is_archived) || status(row) === 'duplicate';
const closed = row => ['completed','cancelled','did_not_book','duplicate'].includes(status(row));
const visible = records.filter(row => !archived(row) && clean(row.inquiry_id) !== clean(incoming.inquiry_id));
const operational = visible.filter(row => !closed(row));
const incomingEmail = email(incoming);
const incomingPhone = phone(incoming);
const incomingDate = date(incoming);
const incomingName = name(incoming);
const incomingTour = tour(incoming);

// A duplicate is a repeated active trip, not merely a returning guest.
const duplicate = incomingDate && operational.find(row => {
  if (date(row) !== incomingDate) return false;
  const sameIdentity =
    (incomingEmail && email(row) === incomingEmail) ||
    (incomingPhone && phone(row) === incomingPhone) ||
    (incomingName && name(row) === incomingName);
  const sameService = !incomingTour || !tour(row) || tour(row) === incomingTour;
  return sameIdentity && sameService;
});

if (duplicate) {
  return [{ json: {
    ok: false,
    error: 'Duplicate trip blocked: this guest already has an active record for the same date and service.',
    duplicate_inquiry_id: duplicate.inquiry_id,
    duplicate_record: duplicate,
    _route: 'respond'
  } }];
}

// Identity matching intentionally includes completed and other closed history.
const existingGuest = visible.find(row =>
  (incomingEmail && email(row) === incomingEmail) ||
  (incomingPhone && phone(row) === incomingPhone)
);

if (existingGuest && existingGuest.guest_id) {
  incoming.guest_id = existingGuest.guest_id;
  incoming.return_sequence = String(
    visible.filter(row => clean(row.guest_id) === clean(existingGuest.guest_id)).length + 1
  );
  return [{ json: {
    ok: true,
    action: 'create_returning_inquiry',
    reused_guest: true,
    inquiry_row: incoming,
    record: incoming,
    _route: 'append_returning'
  } }];
}

if (action === 'create_returning_inquiry') {
  if (!incoming.guest_id) throw new Error('Missing inquiry_row.guest_id');
  return [{ json: { ok: true, action, inquiry_row: incoming, record: incoming, _route: 'append_returning' } }];
}

if (!guest.guest_id || !incoming.inquiry_id) throw new Error('Missing guest or inquiry ID');
return [{ json: { ok: true, action, guest_row: guest, inquiry_row: incoming, record: incoming, _route: 'append_new' } }];