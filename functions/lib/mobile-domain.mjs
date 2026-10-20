const CLOSED = new Set(["completed", "cancelled", "did_not_book", "duplicate", "archived"]);
const BOOKED = new Set(["deposit_pending", "deposit_paid", "payment_pending", "booked", "completed"]);
const BOOKING_PROGRESS = new Set(["deposit_pending", "deposit_paid", "booked", "completed", "cancelled"]);
const PREBOOKING = new Set(["new", "contacted", "planning", "qualified", "quoted", "follow_up"]);

const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const key = value => text(value).toLowerCase().replace(/[-\s]+/g, "_");
const yes = value => ["yes", "true", "1", "y"].includes(key(value));
const dateOnly = value => {
  const match = text(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
};
const amount = value => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function todayInEcuador(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function tourItems(record) {
  let items = [];
  try {
    const raw = record.tour_items_json || record.tour_items;
    items = Array.isArray(raw) ? raw : JSON.parse(raw || "[]");
  } catch {}
  if (!Array.isArray(items) || !items.length) {
    items = [{
      tour: record.tour_type || record.product_selected,
      product_selected: record.product_selected,
      date: record.requested_date || record.requested_date_start,
      guests: record.guest_count,
      status: record.status,
      pickup_location: record.pickup_location,
    }];
  }
  return items.slice(0, 40).map((item, index) => ({
    id: text(item.id || `${record.inquiry_id || "tour"}-${index}`, 128),
    tour: text(item.tour || item.product_selected || record.tour_type, 300),
    product: text(item.product_selected || record.product_selected, 120),
    date: dateOnly(item.date || item.tour_date || record.requested_date || record.requested_date_start),
    guests: text(item.guests || record.guest_count, 20),
    status: key(item.status || record.status),
    pickup: text(item.pickup_location || record.pickup_location, 500),
    startTime: text(item.start_time || item.startTime, 30),
  }));
}

export function normalizeInquiry(record) {
  return {
    inquiryId: text(record.inquiry_id, 128),
    guestId: text(record.guest_id, 128),
    bookingId: text(record.booking_id, 128),
    name: text(record.full_name || [record.first_name, record.last_name].filter(Boolean).join(" "), 180),
    phone: text(record.phone_number || record.phone_normalized || record.phone_raw, 40),
    email: text(record.email, 254),
    partySize: text(record.guest_count, 20),
    status: key(record.status || "new"),
    priority: key(record.priority || "normal"),
    assignedTo: text(record.assigned_to, 30),
    quoteStatus: key(record.quote_status),
    paymentStatus: key(record.payment_status || "unpaid"),
    paymentMethod: text(record.payment_method, 80),
    invoiceNo: text(record.invoice_no, 128),
    followupDate: dateOnly(record.followup_date),
    requestedDate: dateOnly(record.requested_date || record.requested_date_start),
    requestedDateEnd: dateOnly(record.requested_date_end),
    itineraryStatus: key(record.itinerary_status),
    confirmationStatus: key(record.confirmation_status || record.tour_confirmation_status),
    pickup: text(record.pickup_location, 500),
    transportation: text(record.transportation_needed, 100),
    updatedAt: text(record.updated_at, 80),
    notes: text(record.notes, 2000),
    internalNotes: text(record.internal_notes, 2000),
    tours: tourItems(record),
  };
}

export function normalizeInteraction(row) {
  return {
    interactionId: text(row.interaction_id, 128),
    inquiryId: text(row.inquiry_id, 128),
    guestId: text(row.guest_id, 128),
    occurredAt: text(row.occurred_at || row.created_at, 80),
    direction: key(row.direction || "internal"),
    channel: key(row.channel || "other"),
    type: key(row.interaction_type || "other"),
    note: text(row.note, 4000),
    createdBy: text(row.created_by, 30),
    followupRequired: yes(row.followup_required),
    followupAt: text(row.followup_at, 80),
    updatedAt: text(row.updated_at, 80),
  };
}

export function normalizeAssignment(row) {
  return {
    assignmentId: text(row.assignment_id, 128),
    inquiryId: text(row.inquiry_id, 128),
    guestId: text(row.guest_id, 128),
    serviceDate: dateOnly(row.service_date),
    startTime: text(row.start_time, 30),
    endTime: text(row.end_time, 30),
    serviceType: text(row.service_type, 120),
    product: text(row.product_selected, 240),
    providerRole: key(row.provider_role || "other"),
    providerName: text(row.provider_name === "Other" ? row.provider_name_other : row.provider_name, 160),
    pickup: text(row.pickup_location, 500),
    dropoff: text(row.dropoff_location, 500),
    status: key(row.assignment_status || "pending"),
    providerInformed: yes(row.provider_informed),
    calendarStatus: key(row.calendar_sync_status),
    calendarUrl: text(row.calendar_event_url, 1000),
    note: text(row.internal_note, 2000),
    updatedAt: text(row.updated_at, 80),
  };
}

export function normalizePayment(row) {
  return {
    paymentId: text(row.payment_id, 128),
    inquiryId: text(row.inquiry_id, 128),
    guestId: text(row.guest_id, 128),
    bookingId: text(row.booking_id, 128),
    invoiceNo: text(row.invoice_no, 128),
    paymentDate: dateOnly(row.payment_date || row.date_paid || row.created_at),
    method: text(row.payment_method, 80),
    status: key(row.payment_status || "unpaid"),
    totalPaid: amount(row.total_amount_paid),
    bookingPrice: amount(row.total_booking_price),
    balance: amount(row.balance_remaining),
    fullyPaid: yes(row.is_fully_paid),
    currency: text(row.currency || "USD", 10),
  };
}

export function normalizeBooking(row) {
  return {
    bookingId: text(row.booking_id, 128),
    inquiryId: text(row.inquiry_id, 128),
    guestId: text(row.guest_id, 128),
    status: key(row.booking_status || "tentative"),
    startDate: dateOnly(row.tour_date_start || row.tour_date_text),
    endDate: dateOnly(row.tour_date_end || row.tour_date_start || row.tour_date_text),
    product: text(row.product_selected, 240),
    serviceType: text(row.service_type, 120),
    invoiceNo: text(row.invoice_no, 128),
    sourceKey: text(row.source_key, 300),
    tourKey: text(row.tour_key, 300),
    completedAt: dateOnly(row.completed_at),
    archived: yes(row.is_archived),
  };
}

function inquiryDates(record) {
  return new Set([record.requestedDate, record.requestedDateEnd, ...(record.tours || []).map(item => item.date)].filter(Boolean));
}

function bookingMatch(record, booking) {
  if (booking.archived) return "none";
  if (booking.inquiryId && booking.inquiryId === record.inquiryId) return "exact";
  if (booking.bookingId && record.bookingId && booking.bookingId === record.bookingId) return "exact";
  if (booking.invoiceNo && record.invoiceNo && booking.invoiceNo === record.invoiceNo) return "exact";
  if (!record.guestId || booking.guestId !== record.guestId) return "none";
  if ([booking.startDate, booking.endDate].some(value => value && inquiryDates(record).has(value))) return "corroborated";
  return "guest";
}

function paymentMatches(record, payment, bookings) {
  if (payment.inquiryId && payment.inquiryId === record.inquiryId) return true;
  if (payment.bookingId && record.bookingId && payment.bookingId === record.bookingId) return true;
  if (payment.invoiceNo && record.invoiceNo && payment.invoiceNo === record.invoiceNo) return true;
  return bookings.some(booking =>
    (payment.bookingId && payment.bookingId === booking.bookingId) ||
    (payment.inquiryId && payment.inquiryId === booking.inquiryId) ||
    (payment.invoiceNo && payment.invoiceNo === booking.invoiceNo)
  );
}

function strongestBookingStatus(bookings) {
  const statuses = bookings.map(item => item.status);
  if (statuses.includes("completed")) return "completed";
  if (statuses.includes("booked")) return "booked";
  if (statuses.includes("deposit_paid")) return "deposit_paid";
  if (statuses.includes("deposit_pending")) return "deposit_pending";
  if (statuses.length && statuses.every(status => status === "cancelled")) return "cancelled";
  return "";
}

export function inquiryEvidence(record, bookings = [], payments = [], now = new Date()) {
  if (CLOSED.has(record.status)) return { status: record.status, source: "inquiry", needsReconciliation: false, bookings: [], payments: [] };
  const matched = bookings.map(booking => ({ booking, match: bookingMatch(record, booking) }));
  const strongBookings = matched.filter(item => ["exact", "corroborated"].includes(item.match)).map(item => item.booking);
  const relatedPayments = payments.filter(payment => paymentMatches(record, payment, strongBookings));
  const bookingStatus = strongestBookingStatus(strongBookings);
  if (bookingStatus) return { status: bookingStatus, source: "booking", needsReconciliation: false, bookings: strongBookings, payments: relatedPayments };
  if (relatedPayments.some(payment => payment.fullyPaid || payment.status === "paid")) {
    return { status: "booked", source: "payment", needsReconciliation: false, bookings: strongBookings, payments: relatedPayments };
  }
  const today = todayInEcuador(now);
  const requestedDates = [...inquiryDates(record)].sort();
  const stale = requestedDates.length ? requestedDates[0] < today : Boolean(record.updatedAt && dateOnly(record.updatedAt) < addDays(today, -30));
  const guestBookings = matched.filter(item => item.match === "guest" && BOOKING_PROGRESS.has(item.booking.status)).map(item => item.booking);
  const guestPayments = payments.filter(payment => record.guestId && payment.guestId === record.guestId && (payment.fullyPaid || payment.status === "paid"));
  if (PREBOOKING.has(record.status) && stale && (guestBookings.length || guestPayments.length)) {
    return { status: "needs_reconciliation", source: "legacy_guest", needsReconciliation: true, bookings: guestBookings, payments: guestPayments };
  }
  return { status: record.status, source: "inquiry", needsReconciliation: false, bookings: [], payments: [] };
}

export function enrichInquiry(record, bookings = [], payments = [], now = new Date()) {
  const evidence = inquiryEvidence(record, bookings, payments, now);
  return {
    ...record,
    effectiveStatus: evidence.status,
    statusEvidence: evidence.source,
    needsReconciliation: evidence.needsReconciliation,
  };
}

function confirmationSent(record, interactions) {
  if (["sent", "confirmed", "completed"].includes(record.confirmationStatus)) return true;
  return interactions.some(item => item.inquiryId === record.inquiryId && item.direction === "outgoing" && (
    item.type === "confirmation_sent" || /(?:tour|booking) confirmation (?:sent|enviad)/i.test(item.note)
  ));
}

export function guestJourney(record, interactions, assignments, payments, bookings = [], now = new Date()) {
  const evidence = inquiryEvidence(record, bookings, payments, now);
  const effectiveStatus = evidence.status;
  const relatedInteractions = interactions.filter(item => item.inquiryId === record.inquiryId || (!item.inquiryId && item.guestId === record.guestId));
  const relatedAssignments = assignments.filter(item => item.inquiryId === record.inquiryId);
  const relatedPayments = payments.filter(item => paymentMatches(record, item, evidence.bookings));
  const responded = relatedInteractions.some(item => item.direction === "outgoing");
  const planned = record.tours.some(item => item.date);
  const accepted = record.quoteStatus === "accepted" || BOOKED.has(effectiveStatus);
  const noPayment = record.paymentStatus === "no_payment_required";
  const paid = noPayment || record.paymentStatus === "paid" || relatedPayments.some(item => item.fullyPaid || item.status === "paid");
  const partial = !paid && (record.paymentStatus === "deposit_paid" || relatedPayments.some(item => item.totalPaid > 0));
  const providersReady = relatedAssignments.length > 0 && relatedAssignments.every(item => item.providerInformed && !["cancelled"].includes(item.status));
  const itineraryReady = ["ready", "generated", "sent", "complete", "completed"].includes(record.itineraryStatus);
  const sent = confirmationSent(record, relatedInteractions);
  return [
    { id: "contact", label: "Contact", state: responded || BOOKED.has(effectiveStatus) ? "complete" : "attention", evidence: responded ? "Response logged" : BOOKED.has(effectiveStatus) ? "Superseded by booking evidence" : "Response not logged" },
    { id: "planning", label: "Planning", state: planned ? "complete" : "attention", evidence: planned ? "Tour date recorded" : "Tour date needed" },
    { id: "booking", label: "Booking", state: accepted ? "complete" : record.quoteStatus === "sent" ? "pending" : "attention", evidence: accepted ? "Quote accepted" : record.quoteStatus === "sent" ? "Awaiting acceptance" : "Quote not accepted" },
    { id: "payment", label: "Payment", state: paid ? "complete" : partial ? "pending" : accepted ? "attention" : "muted", evidence: paid ? (noPayment ? "No payment required" : "Paid") : partial ? "Partial payment" : "Payment pending" },
    { id: "confirmation", label: "Confirmation", state: sent ? "complete" : accepted && providersReady && itineraryReady ? "attention" : accepted ? "pending" : "muted", evidence: sent ? "Confirmation sent" : !providersReady ? "Providers incomplete" : !itineraryReady ? "Itinerary incomplete" : "Ready to send" },
    { id: "tour", label: "Tour", state: effectiveStatus === "completed" ? "complete" : effectiveStatus === "booked" ? "pending" : "muted", evidence: effectiveStatus === "completed" ? "Tour completed" : effectiveStatus === "booked" ? "Tour booked" : evidence.needsReconciliation ? "Booking records need reconciliation" : "Not completed" },
  ];
}

function action(record, type, reason, due, priority, route) {
  return {
    id: `${type}:${record.inquiryId}:${due || "now"}`,
    type, guest: record.name || "Guest", inquiryId: record.inquiryId,
    reason, due, owner: record.assignedTo || "Unassigned", status: record.status,
    priority, route: route || `/app/?guest=${encodeURIComponent(record.inquiryId)}`,
  };
}

export function actionDesk(inquiries, interactions, assignments, payments, bookings = [], now = new Date()) {
  const today = todayInEcuador(now), tomorrow = addDays(today, 1), actions = [];
  for (const record of inquiries) {
    if (!record.inquiryId) continue;
    const evidence = inquiryEvidence(record, bookings, payments, now);
    const effectiveStatus = evidence.status;
    if (CLOSED.has(effectiveStatus)) continue;
    if (evidence.needsReconciliation) {
      actions.push(action(record, "reconciliation", "Booking or payment evidence conflicts with this inquiry", record.requestedDate || today, 0));
      continue;
    }
    const candidates = [];
    const relatedInteractions = interactions.filter(item => item.inquiryId === record.inquiryId || (!item.inquiryId && item.guestId === record.guestId));
    const outgoing = relatedInteractions.some(item => item.direction === "outgoing");
    if (effectiveStatus === "new" && !outgoing) candidates.push(action(record, "first-response", "First response not logged", record.updatedAt || "New", 0));
    if (!BOOKED.has(effectiveStatus) && record.followupDate && record.followupDate <= today) {
      candidates.push(action(record, "follow-up", record.followupDate < today ? "Follow-up overdue" : "Follow-up due today", record.followupDate, record.followupDate < today ? 0 : 1));
    }
    for (const item of relatedInteractions.filter(item => !BOOKED.has(effectiveStatus) && item.followupRequired && dateOnly(item.followupAt) && dateOnly(item.followupAt) <= today)) {
      candidates.push(action(record, "interaction-follow-up", "Communication follow-up required", item.followupAt, dateOnly(item.followupAt) < today ? 0 : 1, `/app/?guest=${encodeURIComponent(record.inquiryId)}&task=communication`));
    }
    const journey = guestJourney(record, interactions, assignments, payments, bookings, now);
    const confirmation = journey.find(item => item.id === "confirmation");
    if (confirmation?.state === "attention") candidates.push(action(record, "confirmation", confirmation.evidence, record.requestedDate, 1, `/app/?guest=${encodeURIComponent(record.inquiryId)}&task=confirmation`));
    const pay = journey.find(item => item.id === "payment");
    if (pay?.state === "attention") candidates.push(action(record, "payment", pay.evidence, record.requestedDate, 2, `/app/?guest=${encodeURIComponent(record.inquiryId)}&task=payments`));
    const dates = record.tours.map(item => item.date).filter(Boolean);
    if (dates.some(date => date === today || date === tomorrow)) {
      const relatedAssignments = assignments.filter(item => item.inquiryId === record.inquiryId);
      if (!relatedAssignments.length) candidates.push(action(record, "operations", "Upcoming tour has no assignments", dates.find(date => date === today || date === tomorrow), 0, `/app/?guest=${encodeURIComponent(record.inquiryId)}&task=operations`));
      else if (relatedAssignments.some(item => !item.providerInformed || item.status === "pending")) candidates.push(action(record, "operations", "Provider confirmation incomplete", dates.find(date => date === today || date === tomorrow), 0, `/app/?guest=${encodeURIComponent(record.inquiryId)}&task=operations`));
    }
    const typeRank = { operations: 0, "first-response": 1, "interaction-follow-up": 2, "follow-up": 3, confirmation: 4, payment: 5 };
    candidates.sort((a, b) => a.priority - b.priority || (typeRank[a.type] ?? 99) - (typeRank[b.type] ?? 99) || String(a.due).localeCompare(String(b.due)));
    if (candidates[0]) actions.push(candidates[0]);
  }
  return actions.sort((a, b) => a.priority - b.priority || String(a.due).localeCompare(String(b.due)) || a.guest.localeCompare(b.guest));
}

export function todaySchedule(inquiries, assignments, now = new Date()) {
  const today = todayInEcuador(now);
  const records = [];
  for (const inquiry of inquiries) {
    for (const tour of inquiry.tours.filter(item => item.date === today && !CLOSED.has(item.status))) {
      const related = assignments.filter(item => item.inquiryId === inquiry.inquiryId && item.serviceDate === today);
      records.push({
        id: tour.id, inquiryId: inquiry.inquiryId, guest: inquiry.name, partySize: tour.guests || inquiry.partySize,
        phone: inquiry.phone, tour: tour.tour, date: today, startTime: tour.startTime || related[0]?.startTime || "",
        pickup: tour.pickup || inquiry.pickup, assignments: related,
        risk: !related.length ? "No assignment" : related.some(item => !item.providerInformed || item.status === "pending") ? "Provider confirmation incomplete" : "",
      });
    }
  }
  return records.sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99") || a.guest.localeCompare(b.guest));
}
