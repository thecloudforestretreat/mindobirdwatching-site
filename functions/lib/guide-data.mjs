import { listRecords } from "./mobile-crm.mjs";
import { normalizeAssignment, normalizeBooking, normalizeInquiry, normalizeProvider } from "./mobile-domain.mjs";

const BOOKED = new Set(["booked", "deposit_pending", "deposit_paid", "payment_pending", "completed"]);
const CLOSED_ASSIGNMENTS = new Set(["cancelled", "canceled"]);
const lower = value => String(value || "").trim().toLowerCase();
const phoneDigits = value => String(value || "").replace(/[^0-9]/g, "");

function bookingIsBooked(booking) {
  return booking && !booking.archived && BOOKED.has(booking.status);
}

function assignmentMatchesProvider(assignment, providerName) {
  return !providerName || lower(assignment.providerName) === lower(providerName);
}

function messageFor(tour, guideName) {
  const firstName = tour.guestName.split(/\s+/)[0] || "there";
  const when = [tour.dateLabel, tour.startTime ? `at ${tour.startTime}` : ""].filter(Boolean).join(" ");
  const pickup = tour.pickup ? ` The pickup location is ${tour.pickup}.` : "";
  return `Hi ${firstName}, this is ${guideName || "your guide"} from Mindo Bird Watching. I’m your guide for ${tour.service}${when ? ` on ${when}` : ""}.${pickup} Please reply here if you have any questions before the tour.`;
}

function dateLabel(value) {
  if (!value) return "Date pending";
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export async function loadGuideData(env, identity, requestedProvider = "") {
  // Keep CRM reads sequential to protect the rate-limited Google Sheets credential.
  const assignmentRows = await listRecords(env, "list_assignments");
  const inquiryRows = await listRecords(env, "list_inquiries", { filters: {} });
  const bookingRows = await listRecords(env, "list_bookings");
  const providerRows = identity.role === "guide" ? [] : await listRecords(env, "list_providers");
  const inquiries = inquiryRows.map(normalizeInquiry).filter(item => item.inquiryId);
  const bookings = bookingRows.map(normalizeBooking).filter(item => item.bookingId);
  const inquiryById = new Map(inquiries.map(item => [item.inquiryId, item]));
  const bookingByInquiry = new Map();
  for (const booking of bookings) if (booking.inquiryId && bookingIsBooked(booking)) bookingByInquiry.set(booking.inquiryId, booking);
  const providers = providerRows.map(normalizeProvider).filter(item => item.active && item.role === "guide").map(item => item.name);
  const providerName = identity.role === "guide" ? identity.providerName : requestedProvider || providers[0] || "";
  const tours = assignmentRows.map(row => ({ row, assignment: normalizeAssignment(row) })).filter(({ assignment }) =>
    assignment.assignmentId && assignmentMatchesProvider(assignment, providerName) && !CLOSED_ASSIGNMENTS.has(assignment.status)
  ).map(({ row, assignment }) => {
    const inquiry = inquiryById.get(assignment.inquiryId);
    const booked = Boolean(inquiry && BOOKED.has(inquiry.status)) || bookingByInquiry.has(assignment.inquiryId);
    if (!booked) return null;
    const guestName = inquiry?.name || String(row.guest_name || "Guest").trim();
    const phone = inquiry?.phone || String(row.guest_phone || "").trim();
    const service = assignment.product || assignment.serviceType || "Tour";
    const tour = {
      assignmentId: assignment.assignmentId,
      bookingId: bookingByInquiry.get(assignment.inquiryId)?.bookingId || inquiry?.bookingId || String(row.booking_id || "").trim(),
      serviceDate: assignment.serviceDate,
      dateLabel: dateLabel(assignment.serviceDate),
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      service,
      guestName,
      guestCount: inquiry?.partySize || String(row.guest_count || "").trim(),
      pickup: assignment.pickup || inquiry?.pickup || "",
      dropoff: assignment.dropoff,
      status: assignment.status,
      providerName: assignment.providerName,
      phone,
      whatsappUrl: phoneDigits(phone) ? `https://wa.me/${phoneDigits(phone)}` : "",
      calendarUrl: assignment.calendarUrl,
    };
    tour.guestMessage = messageFor(tour, identity.role === "guide" ? identity.name : providerName);
    return tour;
  }).filter(Boolean).sort((a, b) => `${a.serviceDate} ${a.startTime}`.localeCompare(`${b.serviceDate} ${b.startTime}`));
  return { providerName, providers: [...new Set(providers)].sort(), tours };
}
