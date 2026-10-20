import { mobileIdentity } from "../../../lib/mobile-auth.mjs";
import { listRecords } from "../../../lib/mobile-crm.mjs";
import { enrichInquiry, normalizeBooking, normalizeInquiry, normalizePayment } from "../../../lib/mobile-domain.mjs";
import { json, errorResponse, methodNotAllowed } from "../../../lib/mobile-http.mjs";

export async function onRequestGet({ request, env }) {
  try {
    await mobileIdentity(request, env);
    const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() || "";
    if (query.length < 2 || query.length > 100) return json(400, { ok: false, error: "Enter 2 to 100 characters." });
    const digits = query.replace(/\D/g, "");
    const [inquiryRows, bookingRows, paymentRows] = await Promise.all([
      listRecords(env, "list_inquiries", { filters: {} }),
      listRecords(env, "list_bookings"),
      listRecords(env, "list_payments"),
    ]);
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

export function onRequestPost() { return methodNotAllowed(["GET"]); }
