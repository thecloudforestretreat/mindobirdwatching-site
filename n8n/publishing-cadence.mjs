export const PUBLISHING_CADENCE = Object.freeze({
  timezone: 'America/New_York',
  reelsPublisher: Object.freeze({ field: 'hours', hoursInterval: 1, triggerAtMinute: 0 }),
  carouselPublisher: Object.freeze({ field: 'hours', hoursInterval: 1, triggerAtMinute: 10 }),
  analytics: Object.freeze({ field: 'cronExpression', expression: '35 2 * * *' }),
  receiptGraceMinutes: 10,
});

export function minuteDistance(left, right) {
  const a = Number(left?.triggerAtMinute);
  const b = Number(right?.triggerAtMinute);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const direct = Math.abs(a - b);
  return Math.min(direct, 60 - direct);
}

export function validatePublishingCadence(cadence = PUBLISHING_CADENCE) {
  const errors = [];
  if (cadence.timezone !== 'America/New_York') errors.push('Publishing cadence must use America/New_York.');
  if (minuteDistance(cadence.reelsPublisher, cadence.carouselPublisher) < 10) errors.push('Reel and carousel publishers must start at least 10 minutes apart.');
  if (cadence.analytics.field !== 'cronExpression') errors.push('Analytics must use one daily cron schedule, not another hourly poll.');
  if (!/^\d{1,2}\s+\d{1,2}\s+\*\s+\*\s+\*$/.test(cadence.analytics.expression)) errors.push('Analytics must run once daily.');
  if (cadence.receiptGraceMinutes < 10) errors.push('Platform receipts need at least a 10-minute reconciliation window.');
  return errors;
}
