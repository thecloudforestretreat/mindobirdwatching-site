import { listRecords } from "./mobile-crm.mjs";
import { normalizeAssignment, normalizeBooking, normalizeInquiry, normalizeProvider } from "./mobile-domain.mjs";
import { identityMatchesProvider } from "./mobile-auth.mjs";
import { ROBERT_PLAN_ID, isNeicer, isPlanRow, parsePlanRow, planForGuide, robertPlan } from "./guide-plans.mjs";

const BOOKED = new Set(["booked", "deposit_pending", "deposit_paid", "payment_pending", "completed"]);
const CLOSED_ASSIGNMENTS = new Set(["cancelled", "canceled"]);
const lower = value => String(value || "").trim().toLowerCase();
const phoneDigits = value => String(value || "").replace(/[^0-9]/g, "");

function todayInEcuador(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function assignmentKind(row, assignment) {
  const explicit = lower(row.assignment_kind || assignment.assignmentKind);
  if (explicit && explicit !== "assignment") return explicit;
  if (String(row.assignment_group_id || assignment.assignmentGroupId).startsWith("AVAIL-")) return "availability";
  if (String(row.assignment_group_id || assignment.assignmentGroupId).startsWith("OFFER-")) return "offer";
  if (isPlanRow(row)) return "tour_plan";
  if (lower(assignment.serviceType) === "guide unavailable") return "availability";
  if (lower(assignment.serviceType) === "guide offer") return "offer";
  return "assignment";
}

function minuteValue(value) {
  const match = String(value || "").trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3] === "am" && hour === 12) hour = 0;
  if (match[3] === "pm" && hour < 12) hour += 12;
  return hour * 60 + Number(match[2]);
}

function timeRange(assignment) {
  const start = minuteValue(assignment.startTime), end = minuteValue(assignment.endTime);
  if (start === null && end === null) return [0, 1440];
  if (start === null) return [0, end];
  if (end === null) return [start, Math.min(start + 60, 1440)];
  return [start, end];
}

function overlaps(left, right) {
  if (!left.serviceDate || left.serviceDate !== right.serviceDate) return false;
  const [leftStart, leftEnd] = timeRange(left), [rightStart, rightEnd] = timeRange(right);
  return leftStart < rightEnd && rightStart < leftEnd;
}

function recentCutoff(now = new Date()) {
  const ecuador = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const value = new Date(`${ecuador}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 7);
  return value.toISOString().slice(0, 10);
}

function bookingIsBooked(booking) {
  return booking && !booking.archived && BOOKED.has(booking.status);
}

function assignmentMatchesProvider(assignment, provider) {
  if (!provider?.name && !provider?.providerId) return false;
  return identityMatchesProvider({ providerId: provider.providerId, providerIds: provider.providerIds, providerName: provider.name }, assignment.providerId, assignment.providerName);
}

function guestServiceName(value) {
  return String(value || "tour").replace(/^\s*(?:MBW|ACT|TRANS|OSO|ACCOM)\d+\s*[-–—:]\s*/i, "").trim() || "tour";
}

function guestGuideName(value) {
  return String(value || "your guide").split(" · ")[0].trim() || "your guide";
}

function guestTimeLabel(value) {
  const match = String(value || "").trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!match) return String(value || "").trim();
  let hour = Number(match[1]);
  const minute = match[2];
  if (match[3]) return `${hour}:${minute} ${match[3].toUpperCase()}`;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour %= 12;
  return `${hour || 12}:${minute} ${suffix}`;
}

function guestDateLabel(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function messageFor(tour, guideName) {
  const firstName = tour.guestName.split(/\s+/)[0] || "there";
  const service = guestServiceName(tour.service);
  const time = guestTimeLabel(tour.startTime);
  const when = [guestDateLabel(tour.serviceDate), time ? `at ${time}` : ""].filter(Boolean).join(" ");
  const pickup = tour.pickup ? ` The pickup location is ${tour.pickup}.` : "";
  return `Hello ${firstName}, I’m ${guestGuideName(guideName)} from Mindo Bird Watching. I’ll be your guide for the ${service}${when ? ` on ${when}` : ""}.${pickup}\n\nPlease message me here if you have any questions before the tour.\n\nThank you.`;
}

function assignmentServiceReference(note) {
  return String(note || "").match(/(?:^|\n)Service reference:\s*([^\n]+)/i)?.[1]?.trim() || "";
}

function productMatchesService(product, serviceType) {
  const productValue = lower(product), serviceValue = lower(serviceType);
  const code = productValue.match(/\b(mbw|act|trans|oso|accom)\d+\b/)?.[0] || "";
  if (!productValue || !serviceValue) return true;
  if (serviceValue.includes("night")) return code === "mbw016" || productValue.includes("night");
  if (serviceValue.includes("transport") || serviceValue.includes("pickup") || serviceValue.includes("drop-off")) return code.startsWith("trans") || productValue.includes("transport");
  if (serviceValue.includes("activity")) return code.startsWith("act") || /^mbw01[1-5]$/.test(code) || /chocolate|coffee|orchid|butterfly|frog|waterfall|activity|canopy|rafting|tubing|biking|horseback/.test(productValue);
  if (serviceValue.includes("bird")) return /^mbw00[4-9]$/.test(code) || /^mbw0(?:10|17|19)$/.test(code) || /bird|toucan|cock-of-the-rock|tanager|choc[oó]|yanacocha|antpitta/.test(productValue);
  if (serviceValue.includes("wildlife") || serviceValue.includes("bear")) return code.startsWith("oso") || /bear|oso|wildlife/.test(productValue);
  return true;
}

export function resolveAssignmentService(assignment, inquiry) {
  const reference = assignment.serviceItemId || assignmentServiceReference(assignment.note);
  const linked = reference && inquiry?.tours?.find(item => item.id === reference);
  if (linked) return linked.product || linked.tour || linked.serviceType || assignment.serviceType || "Tour";
  if (assignment.product && productMatchesService(assignment.product, assignment.serviceType)) return assignment.product;
  return assignment.serviceType || assignment.product || "Tour";
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
  const providerRecords = providerRows.map(normalizeProvider).filter(item => item.active && item.role === "guide" && item.name);
  const selectedProvider = identity.role === "guide"
    ? { providerId: identity.providerId, providerIds: identity.providerIds, name: identity.providerName }
    : providerRecords.find(item => item.providerId && item.providerId === requestedProvider)
      || providerRecords.find(item => lower(item.name) === lower(requestedProvider))
      || providerRecords[0]
      || { providerId: "", name: "" };
  const providerName = selectedProvider.name || "";
  const providerId = selectedProvider.providerId || "";
  const pilotEnabled = isNeicer(providerName || identity.providerName || identity.name);
  const cutoff = recentCutoff();
  const providerAssignments = assignmentRows.map(row => ({ row, assignment: normalizeAssignment(row) })).filter(({ assignment }) =>
    assignment.assignmentId && assignmentMatchesProvider(assignment, selectedProvider) && !CLOSED_ASSIGNMENTS.has(assignment.status)
  );
  const plans = pilotEnabled ? providerAssignments.filter(({ row }) => isPlanRow(row)).map(({ row }) => parsePlanRow(row)).filter(Boolean).map(plan => identity.role === "guide" ? planForGuide(plan) : plan) : [];
  if (pilotEnabled && !plans.some(plan => plan.planId === ROBERT_PLAN_ID)) {
    const fallbackPlan = robertPlan(selectedProvider);
    plans.unshift(identity.role === "guide" ? planForGuide(fallbackPlan) : fallbackPlan);
  }
  plans.sort((left, right) => `${left.status === "approved" ? "1" : "0"}-${left.startDate || "9999-12-31"}`.localeCompare(`${right.status === "approved" ? "1" : "0"}-${right.startDate || "9999-12-31"}`));
  const availability = providerAssignments.filter(({ row, assignment }) => assignmentKind(row, assignment) === "availability")
    .filter(({ assignment }) => !assignment.serviceDate || assignment.serviceDate >= cutoff)
    .map(({ assignment }) => ({ assignmentId: assignment.assignmentId, serviceDate: assignment.serviceDate, startTime: assignment.startTime, endTime: assignment.endTime, note: assignment.note }));
  const offers = (pilotEnabled ? providerAssignments : []).filter(({ row, assignment }) => assignmentKind(row, assignment) === "offer")
    .filter(({ assignment }) => !assignment.serviceDate || assignment.serviceDate >= todayInEcuador())
    .map(({ assignment }) => ({ assignmentId: assignment.assignmentId, serviceDate: assignment.serviceDate, startTime: assignment.startTime, endTime: assignment.endTime, service: assignment.product || assignment.serviceType || "Tour opportunity", pickup: assignment.pickup, response: assignment.guideResponse, bidAmount: assignment.guideBidAmount }));
  const scheduled = providerAssignments.filter(({ row, assignment }) => assignmentKind(row, assignment) === "assignment");
  const tours = scheduled.map(({ row, assignment }) => {
    const inquiry = inquiryById.get(assignment.inquiryId);
    const booked = Boolean(inquiry && BOOKED.has(inquiry.status)) || bookingByInquiry.has(assignment.inquiryId);
    if (!booked) return null;
    const guestName = inquiry?.name || String(row.guest_name || "Guest").trim();
    const contactAvailable = assignment.status !== "completed" && inquiry?.status !== "completed";
    const phone = contactAvailable ? (inquiry?.phone || String(row.guest_phone || "").trim()) : "";
    const service = resolveAssignmentService(assignment, inquiry);
    const conflict = providerAssignments.find(candidate => candidate.assignment.assignmentId !== assignment.assignmentId && assignmentKind(candidate.row, candidate.assignment) !== "offer" && overlaps(assignment, candidate.assignment));
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
      country: inquiry?.country || String(row.guest_country || row.country || "").trim(),
      countryCode: inquiry?.countryCode || "",
      pickup: assignment.pickup || inquiry?.pickup || "",
      dropoff: assignment.dropoff,
      status: assignment.status,
      accepted: ["confirmed", "completed"].includes(assignment.status),
      acceptanceRequired: false,
      contactAvailable,
      hasConflict: Boolean(conflict),
      conflictReason: conflict ? (assignmentKind(conflict.row, conflict.assignment) === "availability" ? "availability" : "assignment") : "",
      providerName: assignment.providerName,
      phone,
      whatsappUrl: phoneDigits(phone) ? `https://wa.me/${phoneDigits(phone)}` : "",
      calendarUrl: assignment.calendarUrl,
    };
    tour.guestMessage = messageFor(tour, identity.role === "guide" ? identity.name : providerName);
    return tour;
  }).filter(Boolean).sort((a, b) => `${a.serviceDate} ${a.startTime}`.localeCompare(`${b.serviceDate} ${b.startTime}`));
  const providerOptions = providerRecords.map(item => ({ providerId: item.providerId, name: item.name })).sort((a, b) => a.name.localeCompare(b.name));
  return { providerId, providerName, providers: providerOptions.map(item => item.name), providerOptions, features: { plans: pilotEnabled, opportunities: pilotEnabled }, availability, offers, plans, tours };
}
