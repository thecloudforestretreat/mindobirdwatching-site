import { country } from "./maps.mjs";

export const MOBILE_DOMAIN_VERSION = "2026-10-24-invoice-status-v5";

const CLOSED = new Set(["completed", "cancelled", "did_not_book", "spam", "duplicate", "archived"]);
const INACTIVE = new Set(["cancelled", "did_not_book", "spam", "duplicate", "archived"]);
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

function isAuditDuplicate(record) {
  return /(?:^|\n)\s*marked duplicate(?:\s+on\b|[.:])/im.test(record.internalNotes || "");
}

export function brandSource(record) {
  const explicit = text(record.brand_source || record.lead_brand_code || record.source_brand || record.lead_brand || record.site_context || record.source_site).toLowerCase();
  const sourcePage = text(record.source_page || record.first_touch_landing_page || record.last_touch_landing_page).toLowerCase();
  const product = text(record.product_selected).toUpperCase();
  const tour = [record.tour_type, record.tour_category, record.interest_category, record.service_type].map(value => text(value).toLowerCase()).join(" ");
  const signal = [explicit, sourcePage, tour].join(" ");
  if (/\bcat\b|chocoandinotours|choc[oó]\s*andino/.test(signal) || product.startsWith("CAT-")) return "CAT";
  if (/\bmt\b|mindo\s*tours/.test(signal) || product.startsWith("MT-")) return "MT";
  if (/\bmbw\b|mindobirdwatching|mindo bird watching/.test(signal) || product.startsWith("MBW")) return "MBW";
  return "";
}

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
    serviceType: text(item.service_type || record.service_type, 120),
    date: dateOnly(item.date || item.tour_date || record.requested_date || record.requested_date_start),
    guests: text(item.guests || record.guest_count, 20),
    status: key(item.status || record.status),
    pickup: text(item.pickup_location || record.pickup_location, 500),
    dropoff: text(item.dropoff_location, 500),
    startTime: text(item.start_time || item.startTime, 30),
    endTime: text(item.end_time || item.endTime, 30),
  }));
}

export function normalizeInquiry(record) {
  const recordedCountry = text(record.country || record.home_country || record.country_of_residence, 120);
  let location = country(recordedCountry);
  if (!location.code && recordedCountry) {
    const mappedPart = recordedCountry.split(/[\/;,|]/).map(value => country(value.trim())).find(value => value.code);
    if (mappedPart) location = mappedPart;
  }
  return {
    inquiryId: text(record.inquiry_id, 128),
    guestId: text(record.guest_id, 128),
    bookingId: text(record.booking_id, 128),
    firstName: text(record.first_name, 80),
    lastName: text(record.last_name, 80),
    name: text(record.full_name || [record.first_name, record.last_name].filter(Boolean).join(" "), 180),
    country: location.code ? recordedCountry || location.country : "",
    countryCode: location.code,
    brand: brandSource(record),
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
    archived: yes(record.is_archived),
    archivedAt: text(record.archived_at, 80),
    archiveReason: key(record.archive_reason),
    supersededByInquiryId: text(record.superseded_by_inquiry_id, 128),
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
  const confirmationNote = text(row.confirmation_note, 2000);
  const guideResponseMarker = confirmationNote.match(/\[GUIDE_RESPONSE\s+(interested|pass)(?:\|([^|\]]*))?/i);
  const guideAccepted = /\[GUIDE_ACCEPTED(?:\s|\])/i.test(confirmationNote);
  return {
    assignmentId: text(row.assignment_id, 128),
    assignmentGroupId: text(row.assignment_group_id, 128),
    serviceItemId: text(row.service_item_id, 128),
    assignmentKind: key(row.assignment_kind || "assignment"),
    inquiryId: text(row.inquiry_id, 128),
    guestId: text(row.guest_id, 128),
    serviceDate: dateOnly(row.service_date),
    startTime: text(row.start_time, 30),
    endTime: text(row.end_time, 30),
    serviceType: text(row.service_type, 120),
    product: text(row.product_selected, 240),
    providerId: text(row.provider_id, 128),
    providerRole: key(row.provider_role || "other"),
    providerName: text(row.provider_name === "Other" ? row.provider_name_other : row.provider_name, 160),
    pickup: text(row.pickup_location, 500),
    dropoff: text(row.dropoff_location, 500),
    status: key(row.assignment_status || "pending"),
    providerInformed: yes(row.provider_informed),
    guideResponse: key(row.guide_response || (guideAccepted ? "accepted" : guideResponseMarker?.[1])),
    guideBidAmount: text(row.guide_bid_amount || guideResponseMarker?.[2], 40),
    calendarStatus: key(row.calendar_sync_status),
    calendarUrl: text(row.calendar_event_url, 1000),
    note: text(row.internal_note, 2000),
    updatedAt: text(row.updated_at, 80),
  };
}

export function normalizeProvider(row) {
  return {
    providerId: text(row.provider_id, 128),
    name: text(row.provider_name === "Other" ? row.provider_name_other : row.provider_name, 160),
    role: key(row.provider_role || "other"),
    serviceType: text(row.service_type, 120),
    isDefault: yes(row.is_default),
    active: !["no", "false", "0", "inactive"].includes(key(row.active ?? row.is_active ?? "yes")),
  };
}

export function normalizePayment(row) {
  const nonPayable = ["void", "voided", "cancelled", "canceled", "uncollectible"].includes(key(row.payment_status));
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
    balance: nonPayable ? 0 : amount(row.balance_remaining),
    historicalBalance: amount(row.balance_remaining),
    nonPayable,
    fullyPaid: !nonPayable && yes(row.is_fully_paid),
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
  if (payment.nonPayable || ["void", "voided", "cancelled", "canceled", "uncollectible"].includes(payment.status)) return false;
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
  if (record.archived || record.supersededByInquiryId) {
    const archivedStatus = record.archiveReason === "duplicate" || record.supersededByInquiryId ? "duplicate" : "archived";
    return { status: archivedStatus, source: "archive", needsReconciliation: false, bookings: [], payments: [] };
  }
  if (CLOSED.has(record.status)) return { status: record.status, source: "inquiry", needsReconciliation: false, bookings: [], payments: [] };
  if (isAuditDuplicate(record)) return { status: "duplicate", source: "internal_notes", needsReconciliation: false, bookings: [], payments: [] };
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

function serviceNeedsPickup(tour) {
  const description = key(`${tour.serviceType} ${tour.tour} ${tour.product}`);
  return !/(accommodation|lodging|hotel)/.test(description);
}

function serviceNeedsTime(tour) {
  const description = key(`${tour.serviceType} ${tour.tour} ${tour.product}`);
  return !/(accommodation|lodging|hotel|flexible)/.test(description);
}

function readinessCheck(id, label, state, evidence, section = "") {
  return { id, label, state, evidence, section };
}

export function serviceReadiness(record, assignments, payments, bookings = [], interactions = [], now = new Date()) {
  const evidence = inquiryEvidence(record, bookings, payments, now);
  const relatedPayments = payments.filter(item => paymentMatches(record, item, evidence.bookings));
  const fullyPaid = record.paymentStatus === "paid" || record.paymentStatus === "no_payment_required" || relatedPayments.some(item => item.fullyPaid || item.status === "paid");
  const partialPayment = !fullyPaid && (record.paymentStatus === "deposit_paid" || relatedPayments.some(item => item.totalPaid > 0));
  const confirmationReady = confirmationSent(record, interactions);
  return (record.tours || []).map(tour => {
    const status = tour.status || record.status || "planning", closed = ["completed", "cancelled"].includes(status), booked = status === "booked";
    const relatedAssignments = serviceAssignments(record, tour, assignments);
    const confirmedAssignments = relatedAssignments.filter(item => ["confirmed", "completed"].includes(item.status));
    const providerReady = confirmedAssignments.length > 0 && confirmedAssignments.every(item => item.providerInformed);
    const startTime = tour.startTime || confirmedAssignments.find(item => item.startTime)?.startTime || "";
    const pickup = tour.pickup || confirmedAssignments.find(item => item.pickup)?.pickup || record.pickup || "";
    const checks = [];
    checks.push(readinessCheck("date", "Date", tour.date ? "complete" : "attention", tour.date ? "Set" : "Missing", "service"));
    if (status === "completed") {
      checks.push(readinessCheck("payment", "Payment", "complete", "Complete", "payments"));
      checks.push(readinessCheck("provider", "Provider", "complete", "Complete", "operations"));
      checks.push(readinessCheck("time", "Time", "complete", startTime || "Complete", "operations"));
      checks.push(readinessCheck("pickup", "Pickup", "complete", pickup || "Complete", "operations"));
      checks.push(readinessCheck("confirmation", "Confirmation", "complete", "Complete", "confirmation"));
    } else if (status === "cancelled") {
      checks.push(readinessCheck("closed", "Service", "muted", "Cancelled", "service"));
    } else {
      const paymentState = fullyPaid ? "complete" : partialPayment || status === "deposit_paid" ? "pending" : ["deposit_pending", "payment_pending", "booked"].includes(status) ? "attention" : "muted";
      const paymentEvidence = fullyPaid ? (record.paymentStatus === "no_payment_required" ? "Not required" : "Paid") : partialPayment || status === "deposit_paid" ? "Deposit paid" : ["deposit_pending", "payment_pending", "booked"].includes(status) ? "$ needed" : "After quote";
      checks.push(readinessCheck("payment", "Payment", paymentState, paymentEvidence, "payments"));
      checks.push(readinessCheck("provider", "Provider", booked ? (providerReady ? "complete" : "attention") : "muted", booked ? (providerReady ? confirmedAssignments.map(item => item.providerName).filter(Boolean).join(", ") || "Confirmed" : relatedAssignments.length ? "Confirm + inform" : "Assign") : "After booking", "operations"));
      if (serviceNeedsTime(tour)) checks.push(readinessCheck("time", "Time", booked ? (startTime ? "complete" : "attention") : "muted", booked ? (startTime || "Set time") : "After booking", "operations"));
      if (serviceNeedsPickup(tour)) checks.push(readinessCheck("pickup", "Pickup", booked ? (pickup ? "complete" : "attention") : "muted", booked ? (pickup || "Set pickup") : "After booking", "operations"));
      checks.push(readinessCheck("confirmation", "Confirmation", booked ? (confirmationReady ? "complete" : "attention") : "muted", booked ? (confirmationReady ? "Sent" : "Send") : "After booking", "confirmation"));
    }
    const applicable = checks.filter(item => item.state !== "muted"), readyCount = applicable.filter(item => item.state === "complete").length;
    const next = checks.find(item => item.state === "attention") || checks.find(item => item.state === "pending") || null;
    return {
      serviceId: tour.id, status, ready: closed || (applicable.length > 0 && readyCount === applicable.length),
      readyCount, totalCount: applicable.length, nextAction: next ? next.evidence : "Ready", nextSection: next?.section || "",
      checks,
    };
  });
}

export function guestJourney(record, interactions, assignments, payments, bookings = [], now = new Date()) {
  const evidence = inquiryEvidence(record, bookings, payments, now);
  const effectiveStatus = evidence.status;
  if (INACTIVE.has(effectiveStatus)) {
    const closedEvidence = effectiveStatus === "duplicate" ? "Audit-only duplicate" : effectiveStatus === "did_not_book" ? "Closed without booking" : effectiveStatus === "cancelled" ? "Booking cancelled" : "Inquiry archived";
    return ["Contact", "Planning", "Booking", "Payment", "Confirmation", "Tour"].map(label => ({
      id: label.toLowerCase(), label, state: "muted", evidence: closedEvidence,
    }));
  }
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
    const operationalTours = record.tours.filter(item => item.date >= today && !INACTIVE.has(item.status) && item.status !== "completed");
    if (INACTIVE.has(effectiveStatus) || (effectiveStatus === "completed" && !operationalTours.length)) continue;
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
    const imminent = operationalTours.filter(item => item.date === today || item.date === tomorrow);
    if (imminent.length) {
      const missing = imminent.find(item => !serviceAssignments(record, item, assignments).length);
      const incomplete = imminent.find(item => serviceAssignments(record, item, assignments).some(assignment => !assignment.providerInformed || assignment.status === "pending"));
      if (missing) candidates.push(action(record, "operations", `${missing.tour || "Upcoming service"} has no assignment`, missing.date, 0, `/app/?guest=${encodeURIComponent(record.inquiryId)}&task=operations`));
      else if (incomplete) candidates.push(action(record, "operations", `${incomplete.tour || "Upcoming service"} provider confirmation is incomplete`, incomplete.date, 0, `/app/?guest=${encodeURIComponent(record.inquiryId)}&task=operations`));
    }
    const typeRank = { operations: 0, "first-response": 1, "interaction-follow-up": 2, "follow-up": 3, confirmation: 4, payment: 5 };
    candidates.sort((a, b) => a.priority - b.priority || (typeRank[a.type] ?? 99) - (typeRank[b.type] ?? 99) || String(a.due).localeCompare(String(b.due)));
    if (candidates[0]) actions.push(candidates[0]);
  }
  return actions.sort((a, b) => a.priority - b.priority || String(a.due).localeCompare(String(b.due)) || a.guest.localeCompare(b.guest));
}

export function todaySchedule(inquiries, assignments, bookings = [], payments = [], now = new Date()) {
  return operationsSchedule(inquiries, assignments, bookings, payments, now, 0);
}

function productCode(value) {
  return text(value, 240).toUpperCase().match(/\b(?:MBW|MT|CAT|ACT|TRANS)\s*-?\s*\d+\b/)?.[0]?.replace(/\s+/g, "") || "";
}

function serviceAssignments(inquiry, tour, assignments) {
  const dated = assignments.filter(item => item.inquiryId === inquiry.inquiryId && item.serviceDate === tour.date && item.status !== "cancelled");
  const code = productCode(tour.product || tour.tour);
  const serviceKeys = new Set([key(tour.serviceType), key(tour.tour)].filter(Boolean));
  const exact = code ? dated.filter(item => productCode(item.product) === code) : [];
  const exactService = serviceKeys.size ? exact.filter(item => serviceKeys.has(key(item.serviceType))) : [];
  if (exactService.length) return exactService;
  const service = serviceKeys.size ? dated.filter(item => serviceKeys.has(key(item.serviceType))) : [];
  if (service.length) return service;
  if (exact.length) return exact;
  const assignmentCodes = dated.map(item => productCode(item.product)).filter(Boolean);
  if (code && assignmentCodes.length) return [];
  return dated.length === 1 ? dated : [];
}

function assignmentItineraryMatch(inquiry, assignment) {
  const assignmentCode = productCode(assignment.product);
  const assignmentService = key(assignment.serviceType);
  const tours = inquiry.tours || [];
  const serviceMatch = tours.find(tour => [key(tour.serviceType), key(tour.tour)].filter(Boolean).includes(assignmentService));
  if (serviceMatch) return serviceMatch;
  // Do not let an incorrectly copied bird-tour product code make a Night Walk
  // or transportation assignment inherit the bird-tour date.
  if (assignmentService && !["activity", "tour", "other", "service"].includes(assignmentService)) return null;
  return assignmentCode ? tours.find(tour => productCode(tour.product || tour.tour) === assignmentCode) : null;
}

export function operationsSchedule(inquiries, assignments, bookings = [], payments = [], now = new Date(), days = 7) {
  const today = todayInEcuador(now), end = addDays(today, Math.max(0, Math.min(Number(days) || 0, 31)));
  const records = [], inquiryById = new Map(inquiries.map(inquiry => [inquiry.inquiryId, inquiry]));
  for (const inquiry of inquiries) {
    const effective = inquiryEvidence(inquiry, bookings, payments, now).status;
    if (INACTIVE.has(effective)) continue;
    for (const tour of inquiry.tours.filter(item => item.date >= today && item.date <= end && !INACTIVE.has(item.status) && (item.date === today || item.status !== "completed"))) {
      const related = serviceAssignments(inquiry, tour, assignments);
      const completed = tour.status === "completed";
      records.push({
        id: tour.id, inquiryId: inquiry.inquiryId, guest: inquiry.name, partySize: tour.guests || inquiry.partySize,
        phone: inquiry.phone, tour: tour.tour, product: tour.product, date: tour.date, status: tour.status || effective,
        startTime: tour.startTime || related[0]?.startTime || "",
        pickup: tour.pickup || inquiry.pickup, assignments: related,
        source: "itinerary",
        risk: completed ? "" : !related.length ? "No assignment" : related.some(item => !item.providerInformed || item.status === "pending") ? "Provider confirmation incomplete" : "",
      });
    }
  }
  const representedAssignments = new Set(records.flatMap(record => record.assignments.map(item => item.assignmentId)));
  const assignmentServices = new Map();
  for (const assignment of assignments) {
    if (representedAssignments.has(assignment.assignmentId) || assignment.status === "cancelled" || assignment.serviceDate < today || assignment.serviceDate > end) continue;
    const inquiry = inquiryById.get(assignment.inquiryId);
    if (!inquiry || INACTIVE.has(inquiryEvidence(inquiry, bookings, payments, now).status)) continue;
    if (assignment.status === "completed" && assignment.serviceDate !== today) continue;
    const serviceKey = [productCode(assignment.product), key(assignment.serviceType)].filter(Boolean).join("|") || assignment.assignmentId;
    const groupKey = `${assignment.inquiryId}|${assignment.serviceDate}|${serviceKey}`;
    const group = assignmentServices.get(groupKey) || { inquiry, assignments: [] };
    group.assignments.push(assignment);
    assignmentServices.set(groupKey, group);
  }
  for (const group of assignmentServices.values()) {
    const first = group.assignments[0], completed = group.assignments.every(item => item.status === "completed");
    const pending = group.assignments.some(item => item.status === "pending" || !item.providerInformed);
    const itinerary = assignmentItineraryMatch(group.inquiry, first);
    const dateConflict = itinerary?.date && itinerary.date !== first.serviceDate
      ? `Assignment date conflicts with itinerary (${itinerary.date})`
      : "";
    records.push({
      id: `assignment-${first.assignmentId}`, inquiryId: group.inquiry.inquiryId, guest: group.inquiry.name,
      partySize: group.inquiry.partySize, phone: group.inquiry.phone, tour: first.serviceType || first.product || first.providerRole || "Assigned service",
      product: first.product, date: first.serviceDate, status: completed ? "completed" : pending ? "pending" : "confirmed",
      startTime: first.startTime, pickup: first.pickup || group.inquiry.pickup, assignments: group.assignments,
      source: "assignment",
      risk: completed ? "" : dateConflict || (pending ? "Provider confirmation incomplete" : ""),
    });
  }
  return records.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "99:99").localeCompare(b.startTime || "99:99") || a.guest.localeCompare(b.guest));
}
