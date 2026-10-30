import { listRecords } from "./mobile-crm.mjs";
import {
  normalizeInquiry, normalizeInteraction, normalizeAssignment, normalizeProvider, normalizePayment, normalizeBooking, enrichInquiry,
  actionDesk, todaySchedule, operationsSchedule,
} from "./mobile-domain.mjs";
import { isPlanRow, parsePlanRow } from "./guide-plans.mjs";

async function customPlanSummary(row) {
  if (!isPlanRow(row)) return null;
  const plan = await parsePlanRow(row);
  if (!plan?.planId || !plan?.inquiryId) return null;
  return {
    planId: plan.planId,
    inquiryId: plan.inquiryId,
    providerId: plan.providerId,
    providerName: plan.providerName,
    guestName: plan.guestName,
    title: plan.title,
    startDate: plan.startDate,
    endDate: plan.endDate,
    status: plan.status,
    updatedAt: plan.updatedAt,
  };
}

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
  const customPlans = (await Promise.all(assignmentRows.map(customPlanSummary))).filter(Boolean);
  const providers = providerRows.map(normalizeProvider).filter(item => item.name && item.active);
  const payments = paymentRows.map(normalizePayment).filter(item => item.paymentId || item.invoiceNo);
  const bookings = bookingRows.map(normalizeBooking).filter(item => item.bookingId);
  const enrichedInquiries = inquiries.map(item => enrichInquiry(item, bookings, payments));
  return {
    inquiries: enrichedInquiries, interactions, assignments, payments, customPlans,
    providers, bookings,
    actions: actionDesk(inquiries, interactions, assignments, payments, bookings),
    today: todaySchedule(inquiries, assignments, bookings, payments),
    upcoming: operationsSchedule(inquiries, assignments, bookings, payments, new Date(), 7),
  };
}
