import test from "node:test";
import assert from "node:assert/strict";
import { filterByRep, filterRecords, followupUrgency, priorityFor, recordDates, serviceIcon } from "../admin/app/modules/action-desk.mjs";

const record = { inquiryId: "I-1", status: "quoted", effectiveStatus: "quoted", requestedDate: "2026-10-21", requestedDateEnd: "2026-10-23", followupDate: "2026-10-19", tours: [{ tour: "Birding", date: "2026-10-21" }] };

test("date filters include active quoted and booked records across service ranges", () => {
  const booked = { ...record, inquiryId: "I-2", status: "booked", effectiveStatus: "booked" };
  const closed = { ...record, inquiryId: "I-3", status: "completed", effectiveStatus: "completed" };
  assert.deepEqual(recordDates(record, []), ["2026-10-21", "2026-10-22", "2026-10-23"]);
  assert.deepEqual(filterRecords([record, booked, closed], [], { selectedDate: "2026-10-22" }).map(item => item.inquiryId), ["I-1", "I-2"]);
  assert.deepEqual(filterRecords([record, booked], [], { status: "booked" }).map(item => item.inquiryId), ["I-2"]);
});

test("verified itinerary dates override a conflicting invoice booking date", () => {
  const staleInvoiceBooking = [{ inquiryId: "I-1", startDate: "2026-09-21", endDate: "2026-09-21", archived: false }];
  assert.deepEqual(recordDates(record, staleInvoiceBooking), ["2026-10-21", "2026-10-22", "2026-10-23"]);
  const bookingOnly = { inquiryId: "I-4", status: "booked", effectiveStatus: "booked", tours: [] };
  assert.deepEqual(recordDates(bookingOnly, [{ inquiryId: "I-4", startDate: "2026-10-24", endDate: "2026-10-25", archived: false }]), ["2026-10-24", "2026-10-25"]);
});

test("priority moderates an overdue follow-up when the tour is distant", () => {
  const distant = { ...record, requestedDate: "2027-07-04", requestedDateEnd: "2027-07-04", tours: [{ tour: "Birding", date: "2027-07-04" }] };
  assert.equal(priorityFor(distant, [], "2026-10-20").band, "nurture");
  assert.equal(priorityFor(distant, [], "2026-10-20").label, "F/U 1D LATE");
  assert.equal(priorityFor(record, [], "2026-10-20").band, "now");
  assert.equal(priorityFor(record, [], "2026-10-20").label, "TOUR TOMORROW");
  assert.equal(priorityFor({ ...record, status: "payment_pending", effectiveStatus: "payment_pending", requestedDate: "2026-11-10", tours: [] }, [], "2026-10-20").label, "F/U 1D LATE");
  assert.equal(priorityFor({ ...record, status: "payment_pending", effectiveStatus: "payment_pending", requestedDate: "2026-11-10", followupDate: "2026-11-01", tours: [] }, [], "2026-10-20").label, "$ NEEDED");
  assert.equal(priorityFor(record, [], "2026-10-20", { type: "operations", reason: "Transportation has no assignment" }).label, "TOUR TOMORROW");
  assert.equal(priorityFor({ ...record, status: "booked", effectiveStatus: "booked" }, [], "2026-10-20", { type: "operations", reason: "Transportation has no assignment" }).label, "ASSIGN DRIVER");
});

test("follow-up urgency and service icons retain visible meaning", () => {
  assert.deepEqual(followupUrgency("2026-10-20", "2026-10-19"), { tone: "danger", label: "1d overdue" });
  assert.equal(followupUrgency("2026-10-20", "2026-10-22").tone, "warn");
  assert.equal(serviceIcon({ serviceType: "Transportation" }), "🚐");
  assert.equal(serviceIcon({ tour: "Night Walk" }), "🌙");
});

test("rep queues support all active, unassigned, JPG, and SS aliases", () => {
  const records = [
    { inquiryId: "I-1", assignedTo: "JPG" },
    { inquiryId: "I-2", assignedTo: "Juan" },
    { inquiryId: "I-3", assignedTo: "SS" },
    { inquiryId: "I-4", assignedTo: "Susana" },
    { inquiryId: "I-5", assignedTo: "" },
  ];
  assert.deepEqual(filterByRep(records, "all").map(item => item.inquiryId), ["I-1", "I-2", "I-3", "I-4", "I-5"]);
  assert.deepEqual(filterByRep(records, "unassigned").map(item => item.inquiryId), ["I-5"]);
  assert.deepEqual(filterByRep(records, "jpg").map(item => item.inquiryId), ["I-1", "I-2"]);
  assert.deepEqual(filterByRep(records, "ss").map(item => item.inquiryId), ["I-3", "I-4"]);
});
