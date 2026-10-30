import test from "node:test";
import assert from "node:assert/strict";
import { summarizeGuestDay, summarizeGuestItinerary } from "../admin/guide/pricing.mjs";

const lines = (...items) => items.map(([category, amount]) => ({ category, amount }));

test("admin itemized values are the daily and itinerary source of truth", () => {
  const days = [
    { guideQuote: 315, guestLines: lines(["guide", 120], ["reserve", 15], ["transportation", 125], ["lodging", 125]) },
    { guideQuote: 280, guestLines: lines(["guide", 120], ["entrance", 35], ["transportation", 60], ["lodging", 125]) },
    { guideQuote: 305, guestLines: lines(["guide", 140], ["entrance", 70], ["transportation", 110], ["lodging", 125]) },
    { guideQuote: 370, guestLines: lines(["guide", 110], ["reserve", 0], ["transportation", 180], ["lodging", 150]) },
    { guideQuote: 385, guestLines: lines(["guide", 110], ["entrance", 20], ["transportation", 180], ["lodging", 150]) },
    { guideQuote: 250, guestLines: lines(["guide", 110], ["entrance", 25], ["transportation", 200]) },
  ];
  assert.deepEqual(days.map(day => summarizeGuestDay(day.guideQuote, day.guestLines).finalPrice), [385, 340, 445, 440, 460, 335]);
  const total = summarizeGuestItinerary(days);
  assert.equal(total.guideQuote, 1905);
  assert.equal(total.finalPrice, 2405);
  assert.equal(total.profit, 500);
  assert.equal(total.lodging, 675);
  assert.equal(total.markupPercent.toFixed(1), "26.2");
  assert.equal(total.valid, true);
});

test("a guest total below the guide quote is rejected", () => {
  assert.equal(summarizeGuestDay(315, lines(["guide", 120], ["transportation", 125])).valid, false);
});
