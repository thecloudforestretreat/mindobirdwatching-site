import test from "node:test";
import assert from "node:assert/strict";
import { actionDesk, guestJourney, normalizeAssignment, normalizeInquiry, normalizeInteraction, normalizePayment, todaySchedule } from "../functions/lib/mobile-domain.mjs";

const now = new Date("2026-10-19T16:00:00Z");
const inquiry = normalizeInquiry({ inquiry_id: "INQ-1", guest_id: "G-1", full_name: "Test Guest", status: "booked", quote_status: "accepted", payment_status: "paid", requested_date: "2026-10-19", tour_type: "Birdwatching", guest_count: "2", itinerary_status: "ready", updated_at: "2026-10-18T12:00:00Z" });
const assignment = normalizeAssignment({ assignment_id: "ASN-1", inquiry_id: "INQ-1", service_date: "2026-10-19", provider_name: "Test Guide", assignment_status: "confirmed", provider_informed: "Yes", start_time: "06:00" });
const payment = normalizePayment({ payment_id: "PAY-1", inquiry_id: "INQ-1", payment_status: "paid", total_amount_paid: "100", balance_remaining: "0", is_fully_paid: "Yes" });

test("journey only marks confirmation complete from explicit confirmation evidence", () => {
  const before = guestJourney(inquiry, [], [assignment], [payment]);
  assert.equal(before.find(step => step.id === "confirmation").state, "attention");
  const interaction = normalizeInteraction({ interaction_id: "INT-1", inquiry_id: "INQ-1", direction: "outgoing", interaction_type: "confirmation_sent", note: "Sent", occurred_at: "2026-10-18T13:00:00Z" });
  const after = guestJourney(inquiry, [interaction], [assignment], [payment]);
  assert.equal(after.find(step => step.id === "confirmation").state, "complete");
});

test("action desk derives operational risks and never invents confirmation readiness", () => {
  const actions = actionDesk([inquiry], [], [], [payment], now);
  assert.ok(actions.some(item => item.type === "operations" && item.reason === "Upcoming tour has no assignments"));
  assert.equal(actions.some(item => item.type === "confirmation"), false);
});

test("today schedule reports confirmed assignments and exposes no risk", () => {
  const records = todaySchedule([inquiry], [assignment], now);
  assert.equal(records.length, 1);
  assert.equal(records[0].startTime, "06:00");
  assert.equal(records[0].risk, "");
});

test("overdue follow-ups sort ahead of lower-priority payment work", () => {
  const record = { ...inquiry, status: "contacted", paymentStatus: "unpaid", quoteStatus: "accepted", followupDate: "2026-10-18", requestedDate: "2026-10-25" };
  const actions = actionDesk([record], [], [], [], now);
  assert.equal(actions[0].type, "follow-up");
  assert.equal(actions[0].priority, 0);
});
