import { listRecords } from "./mobile-crm.mjs";
import {
  normalizeInquiry, normalizeInteraction, normalizeAssignment, normalizePayment,
  actionDesk, todaySchedule,
} from "./mobile-domain.mjs";

export async function loadMobileData(env) {
  const [inquiryRows, interactionRows, assignmentRows, providerRows, bookingRows, paymentRows] = await Promise.all([
    listRecords(env, "list_inquiries", { filters: {} }),
    listRecords(env, "list_interactions"),
    listRecords(env, "list_assignments"),
    listRecords(env, "list_providers"),
    listRecords(env, "list_bookings"),
    listRecords(env, "list_payments"),
  ]);
  const inquiries = inquiryRows.map(normalizeInquiry).filter(item => item.inquiryId);
  const interactions = interactionRows.map(normalizeInteraction).filter(item => item.interactionId);
  const assignments = assignmentRows.map(normalizeAssignment).filter(item => item.assignmentId);
  const payments = paymentRows.map(normalizePayment).filter(item => item.paymentId || item.invoiceNo);
  return {
    inquiries, interactions, assignments, payments,
    providers: providerRows,
    bookings: bookingRows,
    actions: actionDesk(inquiries, interactions, assignments, payments),
    today: todaySchedule(inquiries, assignments),
  };
}
