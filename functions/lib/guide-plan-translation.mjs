const clean = (value, max) => {
  if (typeof value !== "string") throw new Error("Invalid translation text.");
  const result = value.trim();
  if (!result || result.length > max) throw new Error("Invalid translation text.");
  return result;
};

export function planTranslationSource(plan) {
  return {
    title: String(plan.title?.es || "").slice(0, 240),
    brief: Object.fromEntries(["traveler", "lodging", "pickup", "dropoff", "request", "interests"]
      .map(key => [key, String(plan.brief?.[key]?.es || "").slice(0, key === "request" || key === "interests" ? 1800 : 1200)])),
    days: (plan.days || []).map(day => ({
      id: String(day.id || "").slice(0, 100),
      title: String(day.title?.es || "").slice(0, 240),
      details: String(day.details?.es || "").slice(0, 1800),
      pickupLocation: String(day.pickupLocation?.es || "").slice(0, 300),
      dropoffLocation: String(day.dropoffLocation?.es || "").slice(0, 300),
      overnightCity: String(day.overnightCity?.es || "").slice(0, 160),
      costNote: String(day.costNote?.es || "").slice(0, 500),
    })),
  };
}

export function validatePlanTranslation(value, dayIds) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid translation.");
  const allowedIds = new Set(dayIds);
  if (!Array.isArray(value.days) || value.days.length !== allowedIds.size) throw new Error("Invalid translated days.");
  const seen = new Set();
  const days = value.days.map(day => {
    const id = clean(day?.id, 100);
    if (!allowedIds.has(id) || seen.has(id)) throw new Error("Invalid translated day reference.");
    seen.add(id);
    return {
      id,
      title: clean(day.title, 240),
      details: clean(day.details, 1800),
      pickupLocation: clean(day.pickupLocation, 300),
      dropoffLocation: clean(day.dropoffLocation, 300),
      overnightCity: clean(day.overnightCity, 160),
      costNote: typeof day.costNote === "string" ? day.costNote.trim().slice(0, 500) : "",
    };
  });
  const brief = value.brief;
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) throw new Error("Invalid translated brief.");
  return {
    title: clean(value.title, 240),
    brief: {
      traveler: clean(brief.traveler, 1200),
      lodging: clean(brief.lodging, 1200),
      pickup: clean(brief.pickup, 1200),
      dropoff: clean(brief.dropoff, 1200),
      request: clean(brief.request, 1800),
      interests: clean(brief.interests, 1800),
    },
    days,
  };
}
