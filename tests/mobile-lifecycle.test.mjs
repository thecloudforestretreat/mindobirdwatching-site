import test from "node:test";
import assert from "node:assert/strict";
import {
  actionDesk,
  guestJourney,
  normalizeAssignment,
  normalizeInquiry,
  normalizeInteraction,
  normalizePayment,
} from "../functions/lib/mobile-domain.mjs";

const now = new Date("2026-10-20T16:00:00Z");
const base = {
  inquiry_id: "INQ-LIFECYCLE",
  guest_id: "G-LIFECYCLE",
  full_name: "Lifecycle Guest",
  requested_date: "2026-10-24",
  guest_count: "2",
  product_selected: "MBW006 - Quest for Five Toucans",
  updated_at: "2026-10-20T12:00:00Z",
};
const stage = values => normalizeInquiry({ ...base, ...values });
const outgoing = normalizeInteraction({
  interaction_id: "INT-CONTACT",
  inquiry_id: base.inquiry_id,
  direction: "outgoing",
  interaction_type: "whatsapp",
  occurred_at: "2026-10-20T12:30:00Z",
  note: "Answered guest",
});
const assignment = normalizeAssignment({
  assignment_id: "ASN-READY",
  inquiry_id: base.inquiry_id,
  service_date: base.requested_date,
  service_type: "Birdwatching",
  product_selected: "MBW006",
  provider_name: "Test Guide",
  assignment_status: "confirmed",
  provider_informed: "Yes",
});
const deposit = normalizePayment({
  payment_id: "PAY-DEPOSIT",
  inquiry_id: base.inquiry_id,
  payment_status: "partial",
  total_amount_paid: "100",
  balance_remaining: "125",
});
const paid = normalizePayment({
  payment_id: "PAY-PAID",
  inquiry_id: base.inquiry_id,
  payment_status: "paid",
  total_amount_paid: "225",
  balance_remaining: "0",
  is_fully_paid: "Yes",
});
const confirmation = normalizeInteraction({
  interaction_id: "INT-CONFIRMATION",
  inquiry_id: base.inquiry_id,
  direction: "outgoing",
  interaction_type: "confirmation_sent",
  occurred_at: "2026-10-23T14:00:00Z",
  note: "Tour confirmation sent",
});

test("a lead can move from first response through a completed tour without stale actions", () => {
  const fresh = stage({ status: "new", quote_status: "not_sent", payment_status: "unpaid" });
  assert.equal(actionDesk([fresh], [], [], [], [], now)[0].type, "first-response");
  assert.equal(guestJourney(fresh, [], [], [], [], now).find(item => item.id === "contact").state, "attention");

  const contacted = stage({ status: "contacted", quote_status: "not_sent", payment_status: "unpaid" });
  assert.equal(guestJourney(contacted, [outgoing], [], [], [], now).find(item => item.id === "contact").state, "complete");

  const quoted = stage({ status: "quoted", quote_status: "sent", payment_status: "unpaid" });
  assert.equal(guestJourney(quoted, [outgoing], [], [], [], now).find(item => item.id === "booking").state, "pending");

  const accepted = stage({ status: "payment_pending", quote_status: "accepted", payment_status: "unpaid" });
  assert.equal(guestJourney(accepted, [outgoing], [], [], [], now).find(item => item.id === "payment").state, "attention");

  const deposited = stage({ status: "deposit_paid", quote_status: "accepted", payment_status: "deposit_paid" });
  assert.equal(guestJourney(deposited, [outgoing], [], [deposit], [], now).find(item => item.id === "payment").state, "pending");

  const booked = stage({ status: "booked", quote_status: "accepted", payment_status: "paid", itinerary_status: "ready" });
  const readyJourney = guestJourney(booked, [outgoing], [assignment], [paid], [], now);
  assert.equal(readyJourney.find(item => item.id === "payment").state, "complete");
  assert.equal(readyJourney.find(item => item.id === "confirmation").state, "attention");
  assert.equal(readyJourney.find(item => item.id === "tour").state, "pending");

  const confirmedJourney = guestJourney(booked, [outgoing, confirmation], [assignment], [paid], [], now);
  assert.equal(confirmedJourney.find(item => item.id === "confirmation").state, "complete");

  const completed = stage({ status: "completed", quote_status: "accepted", payment_status: "paid", itinerary_status: "ready" });
  assert.equal(guestJourney(completed, [outgoing, confirmation], [assignment], [paid], [], now).find(item => item.id === "tour").state, "complete");
  assert.deepEqual(actionDesk([completed], [outgoing, confirmation], [assignment], [paid], [], now), []);
});
