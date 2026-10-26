import { mobileIdentity } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { enrichInquiry, normalizeBooking, normalizeInquiry, normalizePayment } from "../../../lib/mobile-domain.mjs";
import { json, errorResponse, methodNotAllowed, assertSameOrigin, assertMobileWriteReady, readJson } from "../../../lib/mobile-http.mjs";

const value = (input, max) => String(input ?? "").trim().slice(0, max);
const digits = input => value(input, 60).replace(/\D/g, "");
const isoDate = input => /^\d{4}-\d{2}-\d{2}$/.test(value(input, 10)) ? value(input, 10) : "";

function ecuadorDate(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const date = new Date(`${parts.find(item => item.type === "year").value}-${parts.find(item => item.type === "month").value}-${parts.find(item => item.type === "day").value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function identifier(prefix) {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `${prefix}-${stamp}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function onRequestGet({ request, env }) {
  try {
    await mobileIdentity(request, env);
    const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() || "";
    if (query.length < 2 || query.length > 100) return json(400, { ok: false, error: "Enter 2 to 100 characters." });
    const digits = query.replace(/\D/g, "");
    const inquiryRows = await listRecords(env, "list_inquiries", { filters: {} });
    const bookingRows = await listRecords(env, "list_bookings");
    const paymentRows = await listRecords(env, "list_payments");
    const bookings = bookingRows.map(normalizeBooking);
    const payments = paymentRows.map(normalizePayment);
    const records = inquiryRows
      .map(normalizeInquiry)
      .map(item => enrichInquiry(item, bookings, payments))
      .filter(item => [item.inquiryId, item.name, item.email, item.phone].some(value => String(value).toLowerCase().includes(query)) || (digits.length >= 6 && item.phone.replace(/\D/g, "").includes(digits)))
      .slice(0, 50)
      .map(({ notes, internalNotes, ...item }) => item);
    return json(200, { ok: true, records, more: records.length === 50, checkedAt: new Date().toISOString() });
  } catch (error) { return errorResponse(error); }
}

export async function onRequestPost({ request, env }) {
  try {
    const identity = await mobileIdentity(request, env);
    assertMobileWriteReady(env, identity);
    assertSameOrigin(request, env);
    const body = await readJson(request, 12000), guest = body?.guest;
    if (!guest || typeof guest !== "object" || Array.isArray(guest)) return json(400, { ok: false, error: "Guest details are required." });
    const name = value(guest.full_name, 160), phone = value(guest.phone_number, 60), phoneKey = digits(phone), email = value(guest.email, 254).toLowerCase();
    if (!name) return json(400, { ok: false, error: "Enter the guest's name." });
    if (!phoneKey && !email) return json(400, { ok: false, error: "Enter a phone number or email address." });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { ok: false, error: "Enter a valid email address." });
    const requestedDate = isoDate(guest.requested_date), followupDate = isoDate(guest.followup_date) || ecuadorDate(3), assignedTo = value(guest.assigned_to, 30).toUpperCase();
    if (guest.requested_date && !requestedDate) return json(400, { ok: false, error: "Choose a valid tour date." });
    if (guest.followup_date && !isoDate(guest.followup_date)) return json(400, { ok: false, error: "Choose a valid follow-up date." });
    if (assignedTo && !["SS", "JPG"].includes(assignedTo)) return json(400, { ok: false, error: "Choose SS, JPG, or Unassigned." });
    const partySize = value(guest.guest_count || "1", 3);
    if (!/^\d{1,2}$/.test(partySize) || Number(partySize) < 1 || Number(partySize) > 99) return json(400, { ok: false, error: "Guests must be between 1 and 99." });
    const rows = await listRecords(env, "list_inquiries", { filters: {} });
    const identityMatches = rows.filter(row => (email && value(row.email, 254).toLowerCase() === email) || (phoneKey.length >= 6 && digits(row.phone_normalized || row.phone_number) === phoneKey));
    const sameTrip = requestedDate && identityMatches.find(row => isoDate(row.requested_date || row.requested_date_start) === requestedDate && !["cancelled", "did_not_book", "spam", "duplicate", "archived"].includes(value(row.status, 40).toLowerCase()));
    if (sameTrip) return json(409, { ok: false, error: `A matching inquiry already exists for ${requestedDate}. Open it instead of creating a duplicate.`, inquiryId: sameTrip.inquiry_id });
    const existing = identityMatches[0], now = new Date().toISOString(), names = name.split(/\s+/), inquiryId = identifier("INQ"), guestId = value(existing?.guest_id, 128) || identifier("G");
    const tour = value(guest.tour, 300), product = value(guest.product_selected, 240), serviceType = value(guest.service_type || "Birdwatching", 120);
    const service = tour && requestedDate ? [{ id: identifier("MOBILE"), tour, product_selected: product, service_type: serviceType, date: requestedDate, guests: partySize, status: "planning", pickup_location: value(guest.pickup_location, 500), notes: value(guest.notes, 3000) }] : [];
    const record = {
      inquiry_id: inquiryId, guest_id: guestId, first_name: names[0] || name, last_name: names.slice(1).join(" "), full_name: name,
      phone_number: phone, phone_raw: phone, phone_normalized: phoneKey, email, email_normalized: email,
      country: value(guest.country, 120), home_country: value(guest.country, 120), source_type: "manual_app", source_tab: "manual_app",
      assigned_to: assignedTo, status: "new", quote_status: "not_sent", payment_status: "unpaid", priority: "auto",
      tour_type: tour, tour_category: tour, interest_category: tour, service_type: serviceType, product_selected: product,
      guest_count: partySize, guest_count_text: partySize, requested_date: requestedDate, requested_date_start: requestedDate, requested_date_end: requestedDate,
      followup_date: followupDate, pickup_location: value(guest.pickup_location, 500), transportation_needed: "Unknown",
      availability_status: "pending", grouping_preference: "unknown", grouping_status: "unmatched",
      notes: value(guest.notes, 3000), internal_notes: `Created in mobile app by ${identity.staffCode || identity.email} · ${now}`,
      tour_items: JSON.stringify(service), tour_items_json: JSON.stringify(service), tour_count: service.length ? "1" : "", tour_content: service.length ? "1" : "",
      created_at: now, updated_at: now,
    };
    const action = existing?.guest_id ? "create_returning_inquiry" : "create_guest_and_inquiry";
    await crmCall(env, action, { record, guest_row: record, inquiry_row: record });
    const verifiedRows = await listRecords(env, "list_inquiries", { filters: {} }), verifiedRaw = verifiedRows.find(row => String(row.inquiry_id) === inquiryId);
    if (!verifiedRaw) return json(202, { ok: false, verified: false, error: "The guest save was submitted but not verified. Refresh before retrying." });
    return json(201, { ok: true, verified: true, returningGuest: Boolean(existing?.guest_id), record: normalizeInquiry(verifiedRaw) });
  } catch (error) { return errorResponse(error); }
}
