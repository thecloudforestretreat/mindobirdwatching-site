const moneyNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function summarizeGuestDay(guideQuote, guestLines = []) {
  const finalPrice = guestLines.reduce((sum, line) => sum + moneyNumber(line?.amount), 0);
  const lodging = guestLines.filter(line => line?.category === "lodging").reduce((sum, line) => sum + moneyNumber(line?.amount), 0);
  const cost = moneyNumber(guideQuote);
  const profit = finalPrice - cost;
  return {
    guideQuote: cost,
    finalPrice,
    lodging,
    profit,
    markupPercent: cost > 0 ? (profit / cost) * 100 : 0,
    valid: finalPrice >= cost,
  };
}

export function summarizeGuestItinerary(days = []) {
  const total = days.reduce((result, day) => {
    const summary = summarizeGuestDay(day?.guideQuote, day?.guestLines);
    result.guideQuote += summary.guideQuote;
    result.finalPrice += summary.finalPrice;
    result.lodging += summary.lodging;
    result.profit += summary.profit;
    result.valid &&= summary.valid;
    return result;
  }, { guideQuote: 0, finalPrice: 0, lodging: 0, profit: 0, markupPercent: 0, valid: true });
  total.markupPercent = total.guideQuote > 0 ? (total.profit / total.guideQuote) * 100 : 0;
  return total;
}
