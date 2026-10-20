import test from "node:test";
import assert from "node:assert/strict";
import { actionDesk, brandSource, guestJourney, inquiryEvidence, normalizeAssignment, normalizeBooking, normalizeInquiry, normalizeInteraction, normalizePayment, operationsSchedule, todaySchedule } from "../functions/lib/mobile-domain.mjs";

const now = new Date("2026-10-19T16:00:00Z");
const inquiry = normalizeInquiry({ inquiry_id: "INQ-1", guest_id: "G-1", full_name: "Test Guest", status: "booked", quote_status: "accepted", payment_status: "paid", requested_date: "2026-10-19", tour_type: "Birdwatching", guest_count: "2", itinerary_status: "ready", updated_at: "2026-10-18T12:00:00Z" });
const assignment = normalizeAssignment({ assignment_id: "ASN-1", inquiry_id: "INQ-1", service_date: "2026-10-19", provider_name: "Test Guide", assignment_status: "confirmed", provider_informed: "Yes", start_time: "06:00" });
const payment = normalizePayment({ payment_id: "PAY-1", inquiry_id: "INQ-1", payment_status: "paid", total_amount_paid: "100", balance_remaining: "0", is_fully_paid: "Yes" });

test("mobile records retain country and non-MBW brand attribution", () => {
  const mindoTours = normalizeInquiry({ inquiry_id: "I-MT", full_name: "Test Testerer", country: "United States", brand_source: "Mindo Tours", product_selected: "MT-TEST" });
  const choco = normalizeInquiry({ inquiry_id: "I-CAT", full_name: "Choco Guest", home_country: "Canada", source_page: "https://chocoandinotours.com/contact" });
  const mbw = normalizeInquiry({ inquiry_id: "I-MBW", full_name: "Bird Guest", country: "GB", product_selected: "MBW004" });
  assert.deepEqual({ country: mindoTours.country, code: mindoTours.countryCode, brand: mindoTours.brand }, { country: "United States", code: "US", brand: "MT" });
  assert.equal(choco.countryCode, "CA");
  assert.equal(choco.brand, "CAT");
  assert.equal(mbw.brand, "MBW");
  assert.equal(brandSource({ tour_type: "ordinary custom request" }), "");
  const combinedCountry = normalizeInquiry({ inquiry_id: "I-COMBINED", full_name: "Combined Country", country: "United States / Canada" });
  assert.equal(combinedCountry.country, "United States / Canada");
  assert.equal(combinedCountry.countryCode, "US");
});

test("journey only marks confirmation complete from explicit confirmation evidence", () => {
  const before = guestJourney(inquiry, [], [assignment], [payment]);
  assert.equal(before.find(step => step.id === "confirmation").state, "attention");
  const interaction = normalizeInteraction({ interaction_id: "INT-1", inquiry_id: "INQ-1", direction: "outgoing", interaction_type: "confirmation_sent", note: "Sent", occurred_at: "2026-10-18T13:00:00Z" });
  const after = guestJourney(inquiry, [interaction], [assignment], [payment]);
  assert.equal(after.find(step => step.id === "confirmation").state, "complete");
});

test("action desk derives operational risks and never invents confirmation readiness", () => {
  const actions = actionDesk([inquiry], [], [], [payment], [], now);
  assert.ok(actions.some(item => item.type === "operations" && item.reason === "Birdwatching has no assignment"));
  assert.equal(actions.some(item => item.type === "confirmation"), false);
});

test("today schedule reports confirmed assignments and exposes no risk", () => {
  const records = todaySchedule([inquiry], [assignment], [], [], now);
  assert.equal(records.length, 1);
  assert.equal(records[0].startTime, "06:00");
  assert.equal(records[0].risk, "");
});

test("today schedule excludes tours whose parent inquiry is closed", () => {
  const closed = normalizeInquiry({
    inquiry_id: "INQ-CLOSED-TODAY",
    guest_id: "G-CLOSED-TODAY",
    full_name: "Closed Guest",
    status: "did_not_book",
    requested_date: "2026-10-19",
    tour_items_json: JSON.stringify([{ id: "TOUR-PLANNING", tour: "Half-Day Birdwatching", date: "2026-10-19", status: "planning" }]),
  });
  assert.deepEqual(todaySchedule([closed], [], [], [], now), []);
});

test("mixed itineraries keep future services visible after earlier services complete", () => {
  const mixed = normalizeInquiry({
    inquiry_id: "INQ-MIXED", guest_id: "G-MIXED", full_name: "Tiffany Example", status: "completed", guest_count: "1",
    tour_items_json: JSON.stringify([
      { id: "past", tour: "Morning Birding", product_selected: "MBW004", date: "2026-10-19", status: "completed" },
      { id: "next", tour: "Night Walk", product_selected: "MBW016", date: "2026-10-20", status: "booked" },
      { id: "later", tour: "Second Birding Day", product_selected: "MBW006", date: "2026-10-21", status: "quoted" },
    ]),
  });
  const today = todaySchedule([mixed], [], [], [], new Date("2026-10-20T16:00:00Z"));
  const upcoming = operationsSchedule([mixed], [], [], [], new Date("2026-10-20T16:00:00Z"), 7);
  assert.deepEqual(today.map(item => item.id), ["next"]);
  assert.deepEqual(upcoming.map(item => item.id), ["next", "later"]);
  assert.equal(actionDesk([mixed], [], [], [], [], new Date("2026-10-20T16:00:00Z"))[0].type, "operations");
});

test("same-day assignments are matched to their exact service product", () => {
  const multi = normalizeInquiry({ inquiry_id: "INQ-MULTI", full_name: "Multi Guest", status: "booked", tour_items_json: JSON.stringify([{ id: "bird", tour: "Birding", product_selected: "MBW004", date: "2026-10-19", status: "booked" }, { id: "night", tour: "Night Walk", product_selected: "MBW016", date: "2026-10-19", status: "booked" }]) });
  const birdGuide = normalizeAssignment({ assignment_id: "A-BIRD", inquiry_id: "INQ-MULTI", service_date: "2026-10-19", product_selected: "MBW004", provider_name: "Bird Guide", assignment_status: "confirmed", provider_informed: "Yes" });
  const records = todaySchedule([multi], [birdGuide], [], [], now);
  assert.equal(records.find(item => item.id === "bird").risk, "");
  assert.equal(records.find(item => item.id === "night").risk, "No assignment");
});

test("assignment dates recover operational services when stored itinerary dates are stale", () => {
  const staleItinerary = normalizeInquiry({
    inquiry_id: "INQ-STALE-TOURS", full_name: "Tiffany Example", status: "booked", guest_count: "1",
    tour_items_json: JSON.stringify([
      { id: "bird", tour: "Birding", product_selected: "MBW006", date: "2026-10-19", status: "new" },
      { id: "night", tour: "Night Walk", product_selected: "MBW016", date: "2026-10-19", status: "new" },
    ]),
  });
  const recovered = [
    normalizeAssignment({ assignment_id: "A-NIGHT", inquiry_id: "INQ-STALE-TOURS", service_date: "2026-10-20", service_type: "Night Walk", product_selected: "MBW006", provider_name: "Night Guide", assignment_status: "confirmed", provider_informed: "Yes", start_time: "19:00" }),
    normalizeAssignment({ assignment_id: "A-BIRD", inquiry_id: "INQ-STALE-TOURS", service_date: "2026-10-20", service_type: "Birdwatching", product_selected: "MBW006", provider_name: "Bird Guide", assignment_status: "confirmed", provider_informed: "Yes", start_time: "05:00" }),
    normalizeAssignment({ assignment_id: "A-TRANSFER", inquiry_id: "INQ-STALE-TOURS", service_date: "2026-10-23", service_type: "Transportation", provider_name: "Driver", assignment_status: "pending", provider_informed: "No" }),
  ];
  const today = todaySchedule([staleItinerary], recovered, [], [], new Date("2026-10-20T16:00:00Z"));
  const upcoming = operationsSchedule([staleItinerary], recovered, [], [], new Date("2026-10-20T16:00:00Z"), 7);
  assert.deepEqual(today.map(item => item.assignments[0].serviceType), ["Birdwatching", "Night Walk"]);
  assert.equal(upcoming.find(item => item.tour === "Transportation").risk, "Provider confirmation incomplete");
  assert.equal(upcoming.length, 3);
});

test("same-day operational risk overrides lower-stage follow-up and payment work", () => {
  const record = { ...inquiry, status: "contacted", paymentStatus: "unpaid", quoteStatus: "accepted", followupDate: "2026-10-18", requestedDate: "2026-10-25" };
  const actions = actionDesk([record], [], [], [], [], now);
  assert.equal(actions[0].type, "operations");
  assert.equal(actions[0].priority, 0);
});

test("completed booking evidence overrides stale new inquiry status", () => {
  const stale = normalizeInquiry({ inquiry_id: "INQ-2", guest_id: "G-2", full_name: "Completed Guest", status: "new", requested_date: "2026-10-10", followup_date: "2026-10-11", updated_at: "2026-10-01" });
  const booking = normalizeBooking({ booking_id: "BKG-2", inquiry_id: "INQ-2", guest_id: "G-2", booking_status: "completed", tour_date_start: "2026-10-10" });
  const evidence = inquiryEvidence(stale, [booking], [], now);
  assert.equal(evidence.status, "completed");
  assert.deepEqual(actionDesk([stale], [], [], [], [booking], now), []);
});

test("audit-only duplicate imports never create operational actions", () => {
  const duplicate = normalizeInquiry({
    inquiry_id: "INQ-DUPLICATE",
    guest_id: "G-DUPLICATE",
    full_name: "Legacy Guest",
    status: "new",
    requested_date: "2026-08-16",
    updated_at: "2026-07-29 03:30:21",
    internal_notes: "Imported from raw whatsapp_inquiries row 83.\nMarked duplicate on 2026-07-28. Kept for audit trail.",
  });
  const evidence = inquiryEvidence(duplicate, [], [], now);
  assert.equal(evidence.status, "duplicate");
  assert.equal(evidence.source, "internal_notes");
  assert.deepEqual(actionDesk([duplicate], [], [], [], [], now), []);
  assert.equal(guestJourney(duplicate, [], [], [], [], now).some(step => step.state === "attention"), false);
});

test("archived inquiries stay closed even when an upstream import resets their status and notes", () => {
  const archived = normalizeInquiry({
    inquiry_id: "INQ-ARCHIVED",
    guest_id: "G-ARCHIVED",
    full_name: "Archived Guest",
    status: "new",
    is_archived: "Yes",
    archive_reason: "duplicate",
    requested_date: "2026-08-16",
    updated_at: "2026-10-20",
    internal_notes: "Imported from raw source.",
  });
  const evidence = inquiryEvidence(archived, [], [], now);
  assert.equal(evidence.status, "duplicate");
  assert.equal(evidence.source, "archive");
  assert.deepEqual(actionDesk([archived], [], [], [], [], now), []);
  assert.deepEqual(todaySchedule([archived], [], [], [], now), []);
  assert.equal(guestJourney(archived, [], [], [], [], now).some(step => step.state === "attention"), false);
});

test("superseded inquiries stay closed even without an archive flag", () => {
  const superseded = normalizeInquiry({
    inquiry_id: "INQ-SUPERSEDED",
    guest_id: "G-SUPERSEDED",
    full_name: "Superseded Guest",
    status: "follow_up",
    superseded_by_inquiry_id: "INQ-CANONICAL",
    requested_date: "2026-08-16",
  });
  assert.equal(inquiryEvidence(superseded, [], [], now).status, "duplicate");
  assert.deepEqual(actionDesk([superseded], [], [], [], [], now), []);
});

test("ordinary notes mentioning duplicate do not close a live inquiry", () => {
  const active = normalizeInquiry({
    inquiry_id: "INQ-ACTIVE",
    guest_id: "G-ACTIVE",
    full_name: "Active Guest",
    status: "new",
    requested_date: "2026-12-01",
    updated_at: "2026-10-19",
    internal_notes: "Checked the duplicate-room request; this inquiry is still active.",
  });
  assert.equal(inquiryEvidence(active, [], [], now).status, "new");
  assert.equal(actionDesk([active], [], [], [], [], now)[0].type, "first-response");
});

test("legacy guest-only evidence becomes one reconciliation task", () => {
  const legacy = normalizeInquiry({ inquiry_id: "INQ-3", guest_id: "G-3", full_name: "Legacy Guest", status: "new", requested_date: "2026-07-01", followup_date: "2026-07-02", updated_at: "2026-07-03" });
  const otherBooking = normalizeBooking({ booking_id: "BKG-3", inquiry_id: "INQ-OTHER", guest_id: "G-3", booking_status: "completed", tour_date_start: "2026-07-10" });
  const actions = actionDesk([legacy], [], [], [], [otherBooking], now);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "reconciliation");
});

test("a returning guest's past booking does not hide a genuinely new future inquiry", () => {
  const future = normalizeInquiry({ inquiry_id: "INQ-4", guest_id: "G-4", full_name: "Returning Guest", status: "new", requested_date: "2026-12-01", updated_at: "2026-10-19" });
  const pastBooking = normalizeBooking({ booking_id: "BKG-4", inquiry_id: "INQ-OLD", guest_id: "G-4", booking_status: "completed", tour_date_start: "2026-05-01" });
  const actions = actionDesk([future], [], [], [], [pastBooking], now);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "first-response");
});

test("action desk keeps only the highest-priority card per inquiry", () => {
  const record = normalizeInquiry({ inquiry_id: "INQ-5", guest_id: "G-5", full_name: "New Guest", status: "new", requested_date: "2026-11-01", followup_date: "2026-10-18", updated_at: "2026-10-18" });
  const actions = actionDesk([record], [], [], [], [], now);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "first-response");
});
