const CLOSED = new Set(["completed", "cancelled", "canceled", "did_not_book", "spam", "duplicate", "archived"]);
const DAY = 86400000;

export const STATUS_FILTERS = ["all", "new", "booked"];
export const STATUS_MORE_FILTERS = ["contacted", "planning", "qualified", "follow_up", "quoted", "deposit_pending", "deposit_paid", "payment_pending"];

export function normalizeRep(value) {
  const rep = String(value || "").trim().toUpperCase();
  if (["J", "JUAN", "JPG"].includes(rep)) return "JPG";
  if (["S", "SUSANA", "SS"].includes(rep)) return "SS";
  return "";
}

export function filterByRep(records, rep = "all") {
  const selected = String(rep || "all").trim().toLowerCase();
  if (selected === "all") return records.slice();
  if (selected === "unassigned") return records.filter(record => !normalizeRep(record.assignedTo || record.assigned_to));
  const canonical = normalizeRep(selected);
  return records.filter(record => normalizeRep(record.assignedTo || record.assigned_to) === canonical);
}

export function isoDate(value) {
  const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

export function addIsoDays(value, amount) {
  const date = new Date(`${isoDate(value)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function daysFrom(today, value) {
  const left = Date.parse(`${isoDate(today)}T12:00:00Z`);
  const right = Date.parse(`${isoDate(value)}T12:00:00Z`);
  return Number.isFinite(left) && Number.isFinite(right) ? Math.round((right - left) / DAY) : null;
}

function expandRange(start, end, limit = 31) {
  const first = isoDate(start), last = isoDate(end || start);
  if (!first) return [];
  const span = daysFrom(first, last);
  if (span === null || span < 0 || span > limit) return [first, ...(last && last !== first ? [last] : [])];
  return Array.from({ length: span + 1 }, (_, index) => addIsoDays(first, index));
}

export function recordDates(record, bookings = []) {
  const dates = new Set();
  for (const value of expandRange(record.requestedDate, record.requestedDateEnd)) dates.add(value);
  for (const tour of record.tours || []) if (isoDate(tour.date)) dates.add(isoDate(tour.date));
  // The itinerary is the operational source of truth. Booking rows can be
  // created by an invoice and occasionally retain an older quoted date. Only
  // use a booking date when the inquiry has no itinerary date of its own.
  if (dates.size) return [...dates].sort();
  for (const booking of bookings) {
    if (booking.inquiryId !== record.inquiryId || booking.archived) continue;
    for (const value of expandRange(booking.startDate, booking.endDate)) dates.add(value);
  }
  return [...dates].sort();
}

export function activeRecord(record) {
  return Boolean(record?.inquiryId) && !record.archived && !record.supersededByInquiryId && !CLOSED.has(record.effectiveStatus || record.status);
}

export function filterRecords(records, bookings, { status = "all", selectedDate = "" } = {}) {
  return records.filter(activeRecord).filter(record => {
    const effective = record.effectiveStatus || record.status;
    return (status === "all" || effective === status) && (!selectedDate || recordDates(record, bookings).includes(selectedDate));
  });
}

export function serviceIcon(service = {}) {
  const value = `${service.tour || ""} ${service.serviceType || ""} ${service.product || ""}`.toLowerCase();
  if (/transport|transfer|driver|airport|quito/.test(value)) return "🚐";
  if (/night|frog|herping/.test(value)) return "🌙";
  if (/bear|oso/.test(value)) return "🐻";
  if (/bird|toucan|cock-of-the-rock|hummingbird|reserve/.test(value)) return "🐦";
  return "🧭";
}

export function serviceSummary(record, bookings = []) {
  const services = (record.tours || []).map(item => ({ ...item, icon: serviceIcon(item) }));
  if (!services.length) {
    for (const booking of bookings.filter(item => item.inquiryId === record.inquiryId && !item.archived)) {
      services.push({ tour: booking.product || booking.serviceType || "Tour", serviceType: booking.serviceType, date: booking.startDate, icon: serviceIcon(booking) });
    }
  }
  const icons = services.slice(0, 3).map(item => item.icon).join(" ") || "🧭";
  const extra = services.length > 3 ? ` +${services.length - 3}` : "";
  const primary = services[0]?.tour || services[0]?.serviceType || "Tour not selected";
  return { services, icons: `${icons}${extra}`, primary, count: services.length };
}

export function followupUrgency(today, followupDate) {
  const days = daysFrom(today, followupDate);
  if (days === null) return { tone: "missing", label: "No follow-up" };
  if (days < 0) return { tone: "danger", label: `${Math.abs(days)}d overdue` };
  if (days === 0) return { tone: "danger", label: "Due today" };
  if (days === 1) return { tone: "danger", label: "Tomorrow" };
  if (days <= 3) return { tone: "warn", label: `In ${days} days` };
  if (days <= 7) return { tone: "soon", label: `In ${days} days` };
  return { tone: "neutral", label: isoDate(followupDate) };
}

function compactDate(value) {
  const date = isoDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).toUpperCase();
}

function followupCue(days, date) {
  if (days === null) return "SET F/U";
  if (days < 0) return `F/U ${Math.abs(days)}D LATE`;
  if (days === 0) return "F/U TODAY";
  if (days === 1) return "F/U TOMORROW";
  return `F/U ${compactDate(date)}`;
}

function priorityCue({ action, followDays, tourDays, future, followupDate, status }) {
  const reason = String(action?.reason || "").toLowerCase();
  if (action?.type === "reconciliation") return "CHECK DATA";
  if (action?.type === "operations") {
    const driver = /transport|transfer|driver|airport/.test(reason);
    if (/no assignment/.test(reason)) return driver ? "ASSIGN DRIVER" : "ASSIGN GUIDE";
    return driver ? "CONFIRM DRIVER" : "CONFIRM GUIDE";
  }
  if (action?.type === "first-response") return "1ST REPLY";
  if (["follow-up", "interaction-follow-up"].includes(action?.type)) return followupCue(followDays, followupDate);
  if (action?.type === "confirmation") return "CONFIRM";
  if (action?.type === "payment") return "$ NEEDED";
  if (tourDays === 0) return "TOUR TODAY";
  if (tourDays === 1) return "TOUR TOMORROW";
  if (followDays !== null && followDays <= 1) return followupCue(followDays, followupDate);
  if (["payment_pending", "deposit_pending"].includes(status)) return "$ NEEDED";
  if (tourDays !== null && tourDays <= 7) return `TOUR IN ${tourDays}D`;
  if (followDays !== null) return followupCue(followDays, followupDate);
  if (future) return `TOUR ${compactDate(future)}`;
  return "SET F/U";
}

export function priorityFor(record, bookings, today, action = null) {
  const dates = recordDates(record, bookings);
  const future = dates.find(value => value >= today) || dates.at(-1) || "";
  const tourDays = daysFrom(today, future);
  const followDays = daysFrom(today, record.followupDate);
  const status = record.effectiveStatus || record.status;
  const actionable = action?.type === "operations" && status !== "booked" ? null : action;
  let score = 5;
  if (tourDays !== null) {
    if (tourDays <= 0) score += 90;
    else if (tourDays === 1) score += 80;
    else if (tourDays <= 3) score += 65;
    else if (tourDays <= 7) score += 48;
    else if (tourDays <= 30) score += 25;
    else if (tourDays <= 60) score += 12;
  }
  if (followDays !== null && followDays <= 1) {
    const weight = tourDays !== null && tourDays > 60 ? 9 : Math.min(28, 12 + Math.abs(Math.min(followDays, 0)));
    score += weight;
  }
  if (actionable?.type === "operations") score += 35;
  if (actionable?.type === "first-response") score += 22;
  if (status === "payment_pending" && (tourDays === null || tourDays <= 30)) score += 18;
  if (status === "booked" && tourDays !== null && tourDays <= 7) score += 12;
  if (status === "quoted") score += 5;
  const band = score >= 80 ? "now" : score >= 60 ? "today" : score >= 40 ? "soon" : "nurture";
  const label = priorityCue({ action: actionable, followDays, tourDays, future, followupDate: record.followupDate, status });
  return { score, band, label, tourDate: future };
}

export function weekDates(start) {
  return Array.from({ length: 7 }, (_, index) => addIsoDays(start, index));
}
