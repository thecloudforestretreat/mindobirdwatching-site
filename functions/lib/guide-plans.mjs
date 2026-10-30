const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100000 ? Math.round(parsed * 100) / 100 : 0;
};
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
const PLAN_MARKER = "[GUIDE_PLAN";
const ALLOWED_CATEGORIES = new Set(["transportation", "guide", "food", "lodging", "entrance", "reserve", "activity", "other"]);
const ALLOWED_VERIFICATION = new Set(["needs_verification", "estimated", "confirmed"]);
const ALLOWED_STATUS = new Set(["guide_drafting", "admin_review", "changes_requested", "approved"]);
const COST_CATEGORY_ORDER = new Map([
  ["guide", 10], ["entrance", 20], ["reserve", 30], ["activity", 40], ["food", 50], ["other", 60],
  ["transportation", 90], ["lodging", 100],
]);
const ROBERT_ROUTE_REVIEW_ID = "mbw-robert-route-2026-10-30";
const robertRouteReview = () => ({
  id: ROBERT_ROUTE_REVIEW_ID,
  message: "Actualización del huésped (30 oct 2026): Robert solicita el desglose del alojamiento por noche o día. Prefiere pasar los primeros 3 días en Mindo, los 2 días siguientes más al norte y terminar en Quito. Antes de volver a enviar el plan, separa el alojamiento en cada día, confirma la propiedad y tarifa, y reorganiza la ruta para reflejar esta preferencia.",
  author: "Juan",
  role: "admin",
  createdAt: "2026-10-30T13:15:00.000Z",
});
const bilingual = (value, fallback = {}, max = 1200) => {
  const source = value && typeof value === "object" ? value : {};
  const prior = fallback && typeof fallback === "object" ? fallback : { es: fallback, en: fallback };
  return {
    es: text(source.es ?? prior.es ?? prior.en ?? "", max),
    en: text(source.en ?? prior.en ?? prior.es ?? "", max),
  };
};

export const ROBERT_PLAN_ID = "robert-2027";
export const ROBERT_INQUIRY_ID = "INQ-20261023224230-9029";

export function sortPlanCosts(costs = []) {
  return [...costs].sort((left, right) =>
    (COST_CATEGORY_ORDER.get(left.category) ?? 70) - (COST_CATEGORY_ORDER.get(right.category) ?? 70));
}

export function blankPlan(input = {}) {
  const planId = text(input.planId, 80);
  const startDate = date(input.startDate);
  const endDate = date(input.endDate) || startDate;
  const guestName = text(input.guestName || "Guest", 160);
  const title = bilingual(input.title, { es: `${guestName} · Itinerario personalizado`, en: `${guestName} · Custom itinerary` }, 240);
  const days = [];
  if (startDate) {
    const cursor = new Date(`${startDate}T12:00:00Z`), last = new Date(`${endDate}T12:00:00Z`);
    while (days.length < 24 && cursor <= last) {
      const dayNumber = days.length + 1;
      days.push({
        id: `day-${dayNumber}`,
        date: cursor.toISOString().slice(0, 10),
        title: { es: `Día ${dayNumber} por planificar`, en: `Day ${dayNumber} to plan` },
        details: { es: "", en: "" },
        pickupLocation: { es: "", en: "" },
        dropoffLocation: { es: "", en: "" },
        overnightCity: { es: "", en: "" },
        sourceCosts: [],
        costNote: { es: "", en: "" },
        originalCost: 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return {
    planId,
    assignmentId: "",
    inquiryId: text(input.inquiryId || `PLAN-${planId}`, 128),
    providerId: text(input.providerId, 128),
    providerName: text(input.providerName || "Guide", 160),
    guestName,
    title,
    startDate,
    endDate,
    status: "guide_drafting",
    updatedAt: "",
    brief: {
      guestCount: text(input.brief?.guestCount || "1", 12),
      traveler: bilingual(input.brief?.traveler, {}, 1200),
      lodging: bilingual(input.brief?.lodging, {}, 1200),
      lodgingLink: text(input.brief?.lodgingLink, 500),
      pickup: bilingual(input.brief?.pickup, {}, 1200),
      dropoff: bilingual(input.brief?.dropoff, {}, 1200),
      request: bilingual(input.brief?.request, {}, 1800),
      interests: bilingual(input.brief?.interests, {}, 1800),
    },
    days,
    adjustments: [],
    comments: [],
    history: [],
    localeUpdatedAt: { es: "", en: "" },
    originalTotal: 0,
    synthetic: true,
  };
}

export function isNeicer(value) {
  return /\b(?:neicer|neycer)\b/i.test(String(value || ""));
}

export function robertPlan(provider = {}) {
  return {
    planId: ROBERT_PLAN_ID,
    assignmentId: "",
    inquiryId: ROBERT_INQUIRY_ID,
    providerId: text(provider.providerId, 128),
    providerName: text(provider.name || provider.providerName || "Neicer", 160),
    guestName: "Robert",
    title: { es: "Robert · Itinerario personalizado en Ecuador", en: "Robert · Custom Ecuador itinerary" },
    startDate: "2027-02-09",
    endDate: "2027-02-14",
    status: "guide_drafting",
    updatedAt: "",
    brief: {
      guestCount: "1",
      traveler: { es: "78 años · estado de salud razonable · sin caminatas largas", en: "Age 78 · reasonably healthy · no long hikes" },
      lodging: { es: "Alojamiento de 2–3 estrellas", en: "2–3 star lodging" },
      lodgingLink: "https://mindobirdwatching.com/recommendations/",
      pickup: { es: "Hotel cerca del aeropuerto · 9 de febrero de 2027", en: "Airport hotel · February 9, 2027" },
      dropoff: { es: "Aeropuerto de Quito · 14 de febrero, al final de la tarde", en: "Quito airport · February 14, late afternoon" },
      request: { es: "Ampliar el itinerario original de cuatro días a seis días, con una noche adicional en Mindo y una noche en Intag.", en: "Expand the original four-day itinerary to six days, with one additional night in Mindo and one night in Intag." },
      interests: { es: "Catequilla, Pululahua, Templo del Sol, Alambi, cascadas, chocolate, Gallo de la Peña, tucanes, colibríes, orquídeas o mariposario, caminata nocturna, Las Cotingas, Otavalo, Parque Cóndor, café de Intag, Campo Colibrí o canopy y Tren Tayta Imbabura.", en: "Catequilla, Pululahua, Temple of the Sun, Alambi, waterfalls, chocolate, Cock-of-the-Rock, toucans, hummingbirds, orchids or butterfly garden, night walk, Las Cotingas, Otavalo, Parque Cóndor, Intag coffee, Campo Colibrí or canopy, and the Tren Tayta Imbabura." },
    },
    days: [
      {
        id: "day-1", date: "2027-02-09",
        title: { es: "Quito · Reserva Alambi · Mindo", en: "Quito · Alambi Reserve · Mindo" },
        details: { es: "Salida del hotel hacia Mindo. Parada de dos horas en la Reserva Alambi, llegada al hotel y tour del chocolate por la tarde.", en: "Depart from the hotel toward Mindo. Spend two hours at Alambi Reserve, arrive at the hotel, and take a chocolate tour in the afternoon." },
        pickupLocation: { es: "Hotel cerca del aeropuerto de Quito", en: "Hotel near Quito airport" },
        dropoffLocation: { es: "Hotel en Mindo", en: "Mindo hotel" },
        overnightCity: { es: "Mindo", en: "Mindo" },
        sourceCosts: [
          { category: "transportation", label: { es: "Transporte", en: "Transportation" }, amount: 85 },
          { category: "guide", label: { es: "Guía", en: "Guide" }, amount: 80 },
          { category: "entrance", label: { es: "Ingresos", en: "Entrance fees" }, amount: 20 },
        ],
        originalCost: 185,
      },
      {
        id: "day-2", date: "2027-02-10",
        title: { es: "Gallo de la Peña, tucanes y actividades en Mindo", en: "Cock-of-the-Rock, toucans, and Mindo activities" },
        details: { es: "Tour de aves del Gallo de la Peña y tucanes de medio día, privado o compartido. Por la tarde, visita al jardín de orquídeas o mariposario y caminata nocturna.", en: "Half-day private or shared birding tour for Cock-of-the-Rock and toucans. In the afternoon, visit the orchid garden or butterfly garden and take a night walk." },
        pickupLocation: { es: "Hotel en Mindo", en: "Mindo hotel" },
        dropoffLocation: { es: "Hotel en Mindo", en: "Mindo hotel" },
        overnightCity: { es: "Mindo", en: "Mindo" },
        sourceCosts: [],
        costNote: { es: "Neicer proporcionó el costo total; el desglose de guía, transporte e ingresos está pendiente.", en: "Neicer provided the total cost; the guide, transportation, and entrance-fee breakdown is pending." },
        originalCost: 150,
      },
      {
        id: "day-3", date: "2027-02-11",
        title: { es: "Las Cotingas · Otavalo", en: "Las Cotingas · Otavalo" },
        details: { es: "Desayuno para llevar y visita a la Reserva Las Cotingas. Continuación hacia Otavalo para visitar el parque o el Mercado de los Ponchos.", en: "Take breakfast to go and visit Las Cotingas Reserve. Continue to Otavalo to visit the park or the Poncho Market." },
        pickupLocation: { es: "Hotel en Mindo", en: "Mindo hotel" },
        dropoffLocation: { es: "Hotel en Otavalo", en: "Otavalo hotel" },
        overnightCity: { es: "Otavalo", en: "Otavalo" },
        sourceCosts: [
          { category: "transportation", label: { es: "Transporte", en: "Transportation" }, amount: 130 },
          { category: "guide", label: { es: "Guía", en: "Guide" }, amount: 80 },
          { category: "entrance", label: { es: "Ingresos", en: "Entrance fees" }, amount: 15 },
        ],
        originalCost: 225,
      },
      {
        id: "day-4", date: "2027-02-12",
        title: { es: "Tren Tayta Imbabura · Quito", en: "Tren Tayta Imbabura · Quito" },
        details: { es: "Desayuno y salida para el paseo en tren de las 11:00 a. m. Regreso para el almuerzo y continuación hacia Quito.", en: "Breakfast followed by the 11:00 a.m. train ride. Return for lunch and continue to Quito." },
        pickupLocation: { es: "Hotel en Otavalo", en: "Otavalo hotel" },
        dropoffLocation: { es: "Quito", en: "Quito" },
        overnightCity: { es: "Quito", en: "Quito" },
        sourceCosts: [
          { category: "transportation", label: { es: "Transporte", en: "Transportation" }, amount: 140 },
          { category: "guide", label: { es: "Guía", en: "Guide" }, amount: 80 },
          { category: "entrance", label: { es: "Ingreso", en: "Entrance fee" }, amount: 15 },
        ],
        originalCost: 235,
      },
      { id: "day-5", date: "2027-02-13", title: { es: "Día adicional por planificar", en: "Additional day to plan" }, details: { es: "Actividades, transporte, alojamiento y costos pendientes de definir en conjunto.", en: "Activities, transportation, lodging, and costs remain to be planned together." }, pickupLocation: { es: "Por confirmar", en: "To be confirmed" }, dropoffLocation: { es: "Por confirmar", en: "To be confirmed" }, overnightCity: { es: "Por confirmar", en: "To be confirmed" }, sourceCosts: [], originalCost: 0 },
      { id: "day-6", date: "2027-02-14", title: { es: "Regreso al aeropuerto de Quito", en: "Return to Quito airport" }, details: { es: "Regreso al aeropuerto de Quito al final de la tarde. Actividades y transporte pendientes de confirmar.", en: "Return to Quito airport by late afternoon. Activities and transportation remain to be confirmed." }, pickupLocation: { es: "Por confirmar", en: "To be confirmed" }, dropoffLocation: { es: "Aeropuerto de Quito", en: "Quito airport" }, overnightCity: { es: "Sin alojamiento; fin del itinerario", en: "No overnight stay; itinerary ends" }, sourceCosts: [], originalCost: 0 },
    ],
    adjustments: [],
    comments: [robertRouteReview()],
    history: [],
    localeUpdatedAt: { es: "", en: "" },
    originalTotal: 795,
    synthetic: true,
  };
}

export function isPlanRow(row) {
  return String(row.assignment_kind || "").trim().toLowerCase() === "tour_plan" || String(row.assignment_group_id || "").startsWith("PLAN-") || String(row.confirmation_note || "").includes("[GUIDE_PLAN ");
}

export function parsePlanRow(row) {
  if (!isPlanRow(row)) return null;
  try {
    const parsed = JSON.parse(String(row.internal_note || "{}"));
    const planId = text(parsed.planId || String(row.assignment_group_id || "").replace(/^PLAN-/, ""), 80);
    const provider = { providerId: row.provider_id, providerName: row.provider_name === "Other" ? row.provider_name_other : row.provider_name };
    const base = planId === ROBERT_PLAN_ID ? robertPlan(provider) : blankPlan({ ...parsed, ...provider, planId });
    const plan = sanitizePlan({ ...base, ...parsed, inquiryId: planId === ROBERT_PLAN_ID ? ROBERT_INQUIRY_ID : parsed.inquiryId, assignmentId: row.assignment_id, updatedAt: row.updated_at, synthetic: false }, base);
    if (planId === ROBERT_PLAN_ID && !plan.comments.some(item => item.id === ROBERT_ROUTE_REVIEW_ID)) {
      plan.comments.push(base.comments.find(item => item.id === ROBERT_ROUTE_REVIEW_ID));
    }
    return plan;
  } catch { return null; }
}

export function sanitizePlan(input, current = robertPlan()) {
  const briefInput = input.brief && typeof input.brief === "object" ? input.brief : {};
  const currentBrief = current.brief && typeof current.brief === "object" ? current.brief : {};
  const brief = {
    guestCount: text(briefInput.guestCount ?? currentBrief.guestCount ?? "1", 12),
    traveler: bilingual(briefInput.traveler, currentBrief.traveler, 1200),
    lodging: bilingual(briefInput.lodging, currentBrief.lodging, 1200),
    lodgingLink: text(briefInput.lodgingLink ?? currentBrief.lodgingLink, 500),
    pickup: bilingual(briefInput.pickup, currentBrief.pickup, 1200),
    dropoff: bilingual(briefInput.dropoff, currentBrief.dropoff, 1200),
    request: bilingual(briefInput.request, currentBrief.request, 1800),
    interests: bilingual(briefInput.interests, currentBrief.interests, 1800),
  };
  const adjustments = Array.isArray(input.adjustments) ? input.adjustments.slice(0, 80).map((item, index) => ({
    id: text(item.id || `cost-${index + 1}`, 80),
    dayId: text(item.dayId, 40),
    category: ALLOWED_CATEGORIES.has(item.category) ? item.category : "other",
    description: text(item.description, 300),
    amount: number(item.amount),
    verification: ALLOWED_VERIFICATION.has(item.verification) ? item.verification : "needs_verification",
    addedBy: text(item.addedBy, 120),
    addedAt: text(item.addedAt, 80),
  })).filter(item => item.description && item.amount > 0) : [];
  const comments = Array.isArray(input.comments) ? input.comments.slice(-50).map((item, index) => ({
    id: text(item.id || `comment-${index + 1}`, 80),
    message: text(item.message, 1000),
    author: text(item.author, 120),
    role: item.role === "guide" ? "guide" : "admin",
    createdAt: text(item.createdAt, 80),
  })).filter(item => item.message) : [];
  const history = Array.isArray(input.history || current.history) ? (input.history || current.history).slice(-100).map((item, index) => ({
    id: text(item.id || `history-${index + 1}`, 80),
    actor: text(item.actor, 120),
    role: item.role === "guide" ? "guide" : "admin",
    action: text(item.action, 80),
    fromStatus: ALLOWED_STATUS.has(item.fromStatus) ? item.fromStatus : "",
    toStatus: ALLOWED_STATUS.has(item.toStatus) ? item.toStatus : "",
    changedAt: text(item.changedAt, 80),
  })).filter(item => item.actor && item.action && item.changedAt) : [];
  const currentDays = new Map((current.days || []).map(day => [day.id, day]));
  const submittedDays = Array.isArray(input.days) && input.days.length ? input.days.slice(0, 24) : current.days;
  const days = submittedDays.map((item, index) => {
    const id = /^[A-Za-z0-9_.-]{1,80}$/.test(String(item?.id || "")) ? String(item.id) : `day-${index + 1}`;
    const prior = currentDays.get(id) || {};
    const sourceCosts = sortPlanCosts(Array.isArray(item?.sourceCosts) ? item.sourceCosts.slice(0, 20).map((cost, costIndex) => ({
      id: text(cost.id || `${id}-source-${costIndex + 1}`, 80),
      category: ALLOWED_CATEGORIES.has(cost.category) ? cost.category : "other",
      amount: number(cost.amount),
    })).filter(cost => cost.amount > 0) : (prior.sourceCosts || []).map((cost, costIndex) => ({
      id: text(cost.id || `${id}-source-${costIndex + 1}`, 80),
      category: ALLOWED_CATEGORIES.has(cost.category) ? cost.category : "other",
      amount: number(cost.amount),
    })).filter(cost => cost.amount > 0));
    return {
      ...prior,
      id,
      date: date(item?.date || prior.date),
      title: bilingual(item?.title, prior.title, 240),
      details: bilingual(item?.details, prior.details, 1800),
      pickupLocation: bilingual(item?.pickupLocation, prior.pickupLocation, 300),
      dropoffLocation: bilingual(item?.dropoffLocation, prior.dropoffLocation, 300),
      overnightCity: bilingual(item?.overnightCity, prior.overnightCity, 160),
      sourceCosts,
      costNote: bilingual(item?.costNote, prior.costNote, 500),
      originalCost: number(item?.originalCost),
    };
  }).filter(day => day.date && (day.title.es || day.title.en));
  const normalizedDays = days.length ? days.sort((a, b) => a.date.localeCompare(b.date)) : current.days;
  const originalTotal = normalizedDays.reduce((sum, day) => sum + number(day.originalCost), 0);
  const pricingInput = input.mbwPricing && typeof input.mbwPricing === "object" ? input.mbwPricing : current.mbwPricing || {};
  const pricingByDay = new Map(Array.isArray(pricingInput.days) ? pricingInput.days.map(item => [String(item?.dayId || ""), item]) : []);
  const mbwPricing = {
    currency: "USD",
    days: normalizedDays.map(day => ({
      dayId: day.id,
      sellPrice: number(pricingByDay.get(day.id)?.sellPrice),
      lodgingPrice: number(pricingByDay.get(day.id)?.lodgingPrice),
    })),
    notes: text(pricingInput.notes, 1000),
    approvedAt: text(pricingInput.approvedAt, 80),
    approvedBy: text(pricingInput.approvedBy, 120),
  };
  return {
    ...current,
    planId: text(input.planId || current.planId, 80),
    assignmentId: text(input.assignmentId || current.assignmentId, 128),
    inquiryId: text(input.inquiryId || current.inquiryId, 128),
    providerId: text(input.providerId || current.providerId, 128),
    providerName: text(input.providerName || current.providerName, 160),
    guestName: text(input.guestName || current.guestName, 160),
    title: bilingual(input.title, current.title, 240),
    brief,
    status: ALLOWED_STATUS.has(input.status) ? input.status : current.status,
    updatedAt: text(input.updatedAt || current.updatedAt, 80),
    synthetic: input.synthetic === false ? false : Boolean(input.synthetic ?? current.synthetic),
    adjustments,
    comments,
    history,
    localeUpdatedAt: {
      es: text(input.localeUpdatedAt?.es || current.localeUpdatedAt?.es, 80),
      en: text(input.localeUpdatedAt?.en || current.localeUpdatedAt?.en, 80),
    },
    days: normalizedDays,
    mbwPricing,
    startDate: normalizedDays[0]?.date || current.startDate,
    endDate: normalizedDays.at(-1)?.date || current.endDate,
    originalTotal,
  };
}

// Internal selling prices and markup are never returned to a guide session.
export function planForGuide(plan) {
  if (!plan || typeof plan !== "object") return plan;
  const { mbwPricing, ...guidePlan } = plan;
  return guidePlan;
}

export function validatePlanForReview(plan) {
  const errors = [];
  for (const [index, day] of (plan.days || []).entries()) {
    if (!day.date) errors.push({ dayId: day.id, field: "date", index });
    if (!day.title?.es && !day.title?.en) errors.push({ dayId: day.id, field: "title", index });
    if (!day.details?.es && !day.details?.en) errors.push({ dayId: day.id, field: "details", index });
    if (!day.pickupLocation?.es && !day.pickupLocation?.en) errors.push({ dayId: day.id, field: "pickupLocation", index });
    if (!day.dropoffLocation?.es && !day.dropoffLocation?.en) errors.push({ dayId: day.id, field: "dropoffLocation", index });
    if (!day.overnightCity?.es && !day.overnightCity?.en) errors.push({ dayId: day.id, field: "overnightCity", index });
    const costs = Array.isArray(day.sourceCosts) ? day.sourceCosts : [];
    const breakdown = costs.reduce((sum, item) => sum + number(item.amount), 0);
    if (costs.length && Math.abs(breakdown - number(day.originalCost)) > 0.009) errors.push({ dayId: day.id, field: "costs", index });
    if (!costs.length && number(day.originalCost) > 0 && !day.costNote?.es && !day.costNote?.en) errors.push({ dayId: day.id, field: "costNote", index });
  }
  return errors;
}

export function planAssignment(plan) {
  const stored = { ...plan };
  delete stored.synthetic;
  return {
    assignment_id: plan.assignmentId || "",
    assignment_group_id: `PLAN-${plan.planId}`,
    assignment_kind: "tour_plan",
    inquiry_id: plan.inquiryId,
    guest_id: "",
    booking_id: "",
    service_date: plan.startDate,
    start_time: "",
    end_time: "",
    service_type: "Custom Tour Planning",
    product_selected: typeof plan.title === "object" ? (plan.title.en || plan.title.es || "Custom Tour Planning") : plan.title,
    provider_id: plan.providerId,
    provider_role: "guide",
    provider_name: plan.providerName,
    provider_name_other: "",
    assignment_status: plan.status === "approved" ? "confirmed" : "pending",
    provider_informed: "Yes",
    confirmation_note: `${PLAN_MARKER} ${plan.planId}]|${plan.status}`,
    internal_note: JSON.stringify(stored),
    created_by: "JPG",
  };
}
