const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const list = value => Array.isArray(value) ? value : [];
const jsonValue = (value, fallback) => {
  if (value && typeof value === "object") return value;
  try { const parsed = JSON.parse(value || ""); return parsed ?? fallback; }
  catch { return fallback; }
};

export const COST_CATEGORIES = new Set(["guide", "transport", "entrance", "accommodation", "meal", "activity", "other"]);
export const COST_BASES = new Set(["total", "per_day", "per_vehicle", "per_person", "per_room_night", "per_person_day"]);
export const COST_STATUSES = new Set(["confirmed", "estimate", "verify", "unavailable"]);
export const SUITABILITY = new Set(["yes", "modified", "no", "unknown"]);
export const BRAND_IDS = new Set(["mbw", "mindo-tours", "choco-andino"]);

export function parseTripBuilderMarker(value) {
  const marker = String(value || "").match(/\[TRIP_BUILDER\s+([^\]]+)\]/i)?.[1] || "";
  const pairs = Object.fromEntries([...marker.matchAll(/([a-z_]+)=([^\s]+)/gi)].map(match => [match[1].toLowerCase(), match[2]]));
  return { studioId: text(pairs.studio, 128), brandId: BRAND_IDS.has(pairs.brand) ? pairs.brand : "mbw", responseDueAt: text(pairs.due, 30) };
}

export function isTripQuoteAssignment(row = {}) {
  const kind = text(row.assignment_kind, 40).toLowerCase();
  return kind === "quote_request"
    || String(row.assignment_group_id || "").startsWith("QUOTE-")
    || text(row.service_type, 120).toLowerCase() === "guide trip quote";
}

export function normalizeTripQuote(input = {}, context = {}) {
  const options = list(input.options).slice(0, 3).map((rawOption, optionIndex) => {
    const days = list(rawOption.days).slice(0, 21).map((rawDay, dayIndex) => {
      const costs = list(rawDay.costs).slice(0, 12).map((rawCost, costIndex) => {
        const category = COST_CATEGORIES.has(rawCost.category) ? rawCost.category : "other";
        const basis = COST_BASES.has(rawCost.basis) ? rawCost.basis : "total";
        const status = COST_STATUSES.has(rawCost.status) ? rawCost.status : "estimate";
        const amount = Math.min(number(rawCost.amount), 999999);
        const quantity = Math.min(Math.max(number(rawCost.quantity, 1), 0), 100);
        return {
          cost_id: text(rawCost.cost_id, 80) || `cost-${optionIndex + 1}-${dayIndex + 1}-${costIndex + 1}`,
          category,
          description: text(rawCost.description, 240),
          amount,
          quantity,
          basis,
          status,
          included: rawCost.included !== false,
          note: text(rawCost.note, 500),
        };
      });
      const netTotal = costs.filter(cost => cost.status !== "unavailable").reduce((sum, cost) => sum + cost.amount * cost.quantity, 0);
      return {
        day_id: text(rawDay.day_id, 80) || `day-${optionIndex + 1}-${dayIndex + 1}`,
        day_number: dayIndex + 1,
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(rawDay.date || "")) ? rawDay.date : "",
        title: text(rawDay.title, 180),
        start_location: text(rawDay.start_location, 240),
        end_location: text(rawDay.end_location, 240),
        start_time: text(rawDay.start_time, 20),
        end_time: text(rawDay.end_time, 20),
        agenda: text(rawDay.agenda, 3000),
        drive_time: text(rawDay.drive_time, 120),
        walking_minutes: Math.min(number(rawDay.walking_minutes), 900),
        longest_walk_minutes: Math.min(number(rawDay.longest_walk_minutes), 600),
        terrain: text(rawDay.terrain, 240),
        rest_stops: text(rawDay.rest_stops, 500),
        accessibility_notes: text(rawDay.accessibility_notes, 1200),
        suitability: SUITABILITY.has(rawDay.suitability) ? rawDay.suitability : "unknown",
        inclusions: text(rawDay.inclusions, 1200),
        exclusions: text(rawDay.exclusions, 1200),
        verification_notes: text(rawDay.verification_notes, 1200),
        costs,
        net_total: Number(netTotal.toFixed(2)),
      };
    });
    return {
      option_id: text(rawOption.option_id, 80) || `option-${optionIndex + 1}`,
      name: text(rawOption.name, 180) || `Option ${optionIndex + 1}`,
      service_style: ["private", "shared", "recommended"].includes(rawOption.service_style) ? rawOption.service_style : "private",
      summary: text(rawOption.summary, 1200),
      days,
      net_total: Number(days.reduce((sum, day) => sum + day.net_total, 0).toFixed(2)),
      pending_cost_count: days.flatMap(day => day.costs).filter(cost => ["estimate", "verify"].includes(cost.status)).length,
    };
  });
  return {
    quote_id: text(input.quote_id, 128),
    assignment_id: text(context.assignmentId || input.assignment_id, 128),
    inquiry_id: text(context.inquiryId || input.inquiry_id, 128),
    inquiry_studio_id: text(context.studioId || input.inquiry_studio_id, 128),
    provider_id: text(context.providerId || input.provider_id, 128),
    provider_name: text(context.providerName || input.provider_name, 160),
    brand_id: BRAND_IDS.has(context.brandId || input.brand_id) ? (context.brandId || input.brand_id) : "mbw",
    currency: "USD",
    status: input.status === "submitted" ? "submitted" : "draft",
    guide_summary: text(input.guide_summary, 2000),
    options,
  };
}

export function tripQuoteErrors(quote, submitting = false) {
  const errors = [];
  if (!quote.options.length) errors.push("Add at least one trip option.");
  quote.options.forEach((option, optionIndex) => {
    if (!option.days.length) errors.push(`Option ${optionIndex + 1} needs at least one day.`);
    option.days.forEach((day, dayIndex) => {
      const label = `Option ${optionIndex + 1}, day ${dayIndex + 1}`;
      if (!day.title) errors.push(`${label}: add a day title.`);
      if (submitting && !day.agenda) errors.push(`${label}: describe the agenda.`);
      if (submitting && day.suitability === "unknown") errors.push(`${label}: assess walking suitability.`);
      if (submitting && day.suitability === "modified" && !day.accessibility_notes) errors.push(`${label}: describe the required accessibility modification.`);
      day.costs.forEach(cost => {
        if (!cost.description) errors.push(`${label}: describe every cost row.`);
      });
    });
  });
  return [...new Set(errors)].slice(0, 20);
}

export function safeTripRequest(studio = {}, assignment = {}) {
  const profile = jsonValue(studio.guest_profile_json, {});
  const proposedDays = list(jsonValue(studio.proposed_days_json, [])).slice(0, 21).map((day, index) => ({
    day_number: number(day.day_number, index + 1),
    date: text(day.date, 20),
    location: text(day.location, 300),
    activity: text(day.activity, 1200),
    logistics: list(day.logistics).slice(0, 20).map(value => text(value, 300)),
    pricing_needed: list(day.pricing_needed).slice(0, 20).map(value => text(value, 120)),
  }));
  const marker = parseTripBuilderMarker(assignment.internal_note);
  return {
    assignmentId: text(assignment.assignment_id, 128),
    inquiryId: text(assignment.inquiry_id, 128),
    studioId: text(studio.inquiry_studio_id || marker.studioId, 128),
    studioRevision: number(studio.revision),
    brandId: marker.brandId,
    title: text(studio.source_subject || assignment.product_selected || "Custom trip request", 240),
    summary: text(studio.request_summary, 4000),
    guestProfile: {
      party_size: text(profile.party_size || profile.guest_count, 40),
      age_or_group: text(profile.age_or_group || profile.age || profile.traveler_description, 200),
      experience_level: text(profile.experience_level || profile.birding_level, 160),
      country: text(profile.country || profile.home_country, 120),
    },
    requestedDates: list(jsonValue(studio.requested_dates_json, [])).slice(0, 20).map(value => text(value, 160)),
    requirements: list(jsonValue(studio.requirements_json, [])).slice(0, 40).map(value => text(value, 500)),
    unknowns: list(jsonValue(studio.unknowns_json, [])).slice(0, 30).map(value => text(value, 500)),
    checks: list(jsonValue(studio.validation_flags_json, [])).slice(0, 30).map(value => text(value, 500)),
    proposedDays,
    responseDeadline: marker.responseDueAt,
  };
}

