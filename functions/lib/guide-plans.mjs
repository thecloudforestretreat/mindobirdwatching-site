const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : 0;
};
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
const PLAN_MARKER = "[GUIDE_PLAN robert-2027]";
const ALLOWED_CATEGORIES = new Set(["transportation", "guide", "food", "lodging", "reserve", "activity", "other"]);
const ALLOWED_VERIFICATION = new Set(["needs_verification", "estimated", "confirmed"]);
const ALLOWED_STATUS = new Set(["guide_drafting", "admin_review", "changes_requested", "approved"]);

export const ROBERT_PLAN_ID = "robert-2027";

export function isNeicer(value) {
  return /\b(?:neicer|neycer)\b/i.test(String(value || ""));
}

export function robertPlan(provider = {}) {
  return {
    planId: ROBERT_PLAN_ID,
    assignmentId: "",
    inquiryId: "ROBERT-CUSTOM-2027",
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
        sourceCosts: [
          { category: "transportation", label: { es: "Transporte", en: "Transportation" }, amount: 85 },
          { category: "guide", label: { es: "Guía", en: "Guide" }, amount: 80 },
          { category: "reserve", label: { es: "Ingresos", en: "Entrance fees" }, amount: 20 },
        ],
        originalCost: 185,
      },
      {
        id: "day-2", date: "2027-02-10",
        title: { es: "Gallo de la Peña, tucanes y actividades en Mindo", en: "Cock-of-the-Rock, toucans, and Mindo activities" },
        details: { es: "Tour de aves del Gallo de la Peña y tucanes de medio día, privado o compartido. Por la tarde, visita al jardín de orquídeas o mariposario y caminata nocturna.", en: "Half-day private or shared birding tour for Cock-of-the-Rock and toucans. In the afternoon, visit the orchid garden or butterfly garden and take a night walk." },
        sourceCosts: [],
        costNote: { es: "Neicer proporcionó el costo total; el desglose de guía, transporte e ingresos está pendiente.", en: "Neicer provided the total cost; the guide, transportation, and entrance-fee breakdown is pending." },
        originalCost: 150,
      },
      {
        id: "day-3", date: "2027-02-11",
        title: { es: "Las Cotingas · Otavalo", en: "Las Cotingas · Otavalo" },
        details: { es: "Desayuno para llevar y visita a la Reserva Las Cotingas. Continuación hacia Otavalo para visitar el parque o el Mercado de los Ponchos.", en: "Take breakfast to go and visit Las Cotingas Reserve. Continue to Otavalo to visit the park or the Poncho Market." },
        sourceCosts: [
          { category: "transportation", label: { es: "Transporte", en: "Transportation" }, amount: 130 },
          { category: "guide", label: { es: "Guía", en: "Guide" }, amount: 80 },
          { category: "reserve", label: { es: "Ingresos", en: "Entrance fees" }, amount: 15 },
        ],
        originalCost: 225,
      },
      {
        id: "day-4", date: "2027-02-12",
        title: { es: "Tren Tayta Imbabura · Quito", en: "Tren Tayta Imbabura · Quito" },
        details: { es: "Desayuno y salida para el paseo en tren de las 11:00 a. m. Regreso para el almuerzo y continuación hacia Quito.", en: "Breakfast followed by the 11:00 a.m. train ride. Return for lunch and continue to Quito." },
        sourceCosts: [
          { category: "transportation", label: { es: "Transporte", en: "Transportation" }, amount: 140 },
          { category: "guide", label: { es: "Guía", en: "Guide" }, amount: 80 },
          { category: "reserve", label: { es: "Ingreso", en: "Entrance fee" }, amount: 15 },
        ],
        originalCost: 235,
      },
      { id: "day-5", date: "2027-02-13", title: { es: "Día adicional por planificar", en: "Additional day to plan" }, details: { es: "Actividades, transporte, alojamiento y costos pendientes de definir en conjunto.", en: "Activities, transportation, lodging, and costs remain to be planned together." }, sourceCosts: [], originalCost: 0 },
      { id: "day-6", date: "2027-02-14", title: { es: "Regreso al aeropuerto de Quito", en: "Return to Quito airport" }, details: { es: "Regreso al aeropuerto de Quito al final de la tarde. Actividades y transporte pendientes de confirmar.", en: "Return to Quito airport by late afternoon. Activities and transportation remain to be confirmed." }, sourceCosts: [], originalCost: 0 },
    ],
    adjustments: [],
    comments: [],
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
    const base = robertPlan({ providerId: row.provider_id, providerName: row.provider_name === "Other" ? row.provider_name_other : row.provider_name });
    return sanitizePlan({ ...base, ...parsed, assignmentId: row.assignment_id, updatedAt: row.updated_at, synthetic: false });
  } catch { return null; }
}

export function sanitizePlan(input, current = robertPlan()) {
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
  return {
    ...current,
    assignmentId: text(input.assignmentId || current.assignmentId, 128),
    providerId: text(input.providerId || current.providerId, 128),
    providerName: text(input.providerName || current.providerName, 160),
    status: ALLOWED_STATUS.has(input.status) ? input.status : current.status,
    adjustments,
    comments,
    // The source estimate is server-owned and can never be rewritten by the client.
    days: current.days,
    originalTotal: 795,
  };
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
    confirmation_note: `${PLAN_MARKER}|${plan.status}`,
    internal_note: JSON.stringify(stored),
    created_by: "JPG",
  };
}
