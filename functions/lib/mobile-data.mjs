import { listRecords } from "./mobile-crm.mjs";
import {
  normalizeInquiry, normalizeInteraction, normalizeAssignment, normalizePayment, normalizeBooking, enrichInquiry,
  actionDesk, todaySchedule,
} from "./mobile-domain.mjs";

export async function loadMobileData(env) {
  // n8n's Google Sheets credential is rate-limited per user. Keep these reads
  // sequential so one app refresh cannot fan out into six simultaneous sheet
  // requests and leave noisy failed executions behind.
  const inquiryRows = await listRecords(env, "list_inquiries", { filters: {} });
  const interactionRows = await listRecords(env, "list_interactions");
  const assignmentRows = await listRecords(env, "list_assignments");
  const providerRows = await listRecords(env, "list_providers");
  const bookingRows = await listRecords(env, "list_bookings");
  const paymentRows = await listRecords(env, "list_payments");
  const inquiries = inquiryRows.map(normalizeInquiry).filter(item => item.inquiryId);
  const interactions = interactionRows.map(normalizeInteraction).filter(item => item.interactionId);
  const assignments = assignmentRows.map(normalizeAssignment).filter(item => item.assignmentId);
  const payments = paymentRows.map(normalizePayment).filter(item => item.paymentId || item.invoiceNo);
  const bookings = bookingRows.map(normalizeBooking).filter(item => item.bookingId);
  const enrichedInquiries = inquiries.map(item => enrichInquiry(item, bookings, payments));
  return {
    inquiries: enrichedInquiries, interactions, assignments, payments,
    providers: providerRows, bookings,
    actions: actionDesk(inquiries, interactions, assignments, payments, bookings),
    today: todaySchedule(inquiries, assignments, bookings, payments),
  };
}
