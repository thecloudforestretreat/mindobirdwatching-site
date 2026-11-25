import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../admin/guest-crm/index.html", import.meta.url), "utf8");

test("meal workflow is limited to the approved birding products", () => {
  assert.match(source, /MEAL_ELIGIBLE_PRODUCTS=new Set\(\["MBW005","MBW006","MBW007","MBW008","MBW010"\]\)/);
});

test("primary and additional tour occurrences render their own meal controls", () => {
  assert.match(source, /id="primaryMealOptions"/);
  assert.match(source, /const meals=typeof mealOptionsHtml/);
  assert.match(source, /\$\{meals\}<\/article>/);
  assert.match(source, /Saved to this exact tour and date/);
});

test("meal selections persist inside each tour item", () => {
  assert.match(source, /draft\.meal_options=collectMealOptions/);
  assert.match(source, /const mealOptions=.*normalizeMealOptions/);
  assert.match(source, /primary\.meal_options=collectMealOptions/);
});

test("guide summary is operational and separated by breakfast and lunch", () => {
  assert.match(source, /BREAKFAST: \$\{breakfastCount\}/);
  assert.match(source, /LUNCH: \$\{selected\}/);
  assert.match(source, /DIETARY NOTES:/);
  assert.doesNotMatch(source.match(/function guideMealSummary[\s\S]*?function mealOptionsHtml/)?.[0] || "", /discussed_stage|invoice|supplier cost/i);
  assert.doesNotMatch(source, /confirmation_note:summary/);
});

test("CRM save verifies normalized booking-option persistence", () => {
  assert.match(source, /function bookingOptionExpectation\(record\)/);
  assert.match(source, /await syncAndVerifyBookingOptions\(saved\)/);
  assert.match(source, /api\("sync_booking_options"/);
  assert.match(source, /meal-option verification failed/);
});

test("manual inquiries without a Reference ID are reported as normal saves", () => {
  assert.match(source, /No Reference ID supplied\. This manual inquiry was saved normally\./);
  assert.doesNotMatch(source, /Saved without a Reference ID; attribution is unavailable/);
});
