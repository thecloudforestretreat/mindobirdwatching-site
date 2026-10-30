const text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const number = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100000 ? Math.round(parsed * 100) / 100 : 0;
};
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
const PLAN_MARKER = "[GUIDE_PLAN";
const PLAN_STORAGE_PREFIX = "MBW_PLAN_B64URL_V1:";
const PLAN_STORAGE_GZIP_PREFIX = "MBW_PLAN_GZIP_B64URL_V2:";
const PLAN_STORAGE_KEYS = {
  planId: "a", assignmentId: "b", inquiryId: "c", providerId: "d", providerName: "e", guestName: "f", guestCount: "g",
  title: "h", startDate: "i", endDate: "j", status: "k", brief: "l", days: "m", adjustments: "n", comments: "o",
  history: "p", localeUpdatedAt: "q", originalTotal: "r", mbwPricing: "s", updatedAt: "t", traveler: "u", pickupDropoff: "v",
  lodging: "w", request: "x", interests: "y", lodgingLink: "z", id: "A", date: "B", details: "C", pickupLocation: "D",
  dropoffLocation: "E", overnightCity: "F", sourceCosts: "G", costNote: "H", originalCost: "I", category: "J", amount: "K",
  description: "L", verification: "M", dayId: "N", message: "O", author: "P", role: "Q", createdAt: "R", action: "S",
  fromStatus: "T", toStatus: "U", changedAt: "V", addedBy: "W", addedAt: "X", notes: "Y", approvedAt: "Z",
  approvedBy: "aa", sellPrice: "ab", lodgingPrice: "ac", guestLines: "ad", label: "ae", routeRevision: "af",
};
const PLAN_STORAGE_KEYS_REVERSE = Object.fromEntries(Object.entries(PLAN_STORAGE_KEYS).map(([key, value]) => [value, key]));
const ALLOWED_CATEGORIES = new Set(["transportation", "guide", "food", "lodging", "entrance", "reserve", "activity", "other"]);
const ALLOWED_VERIFICATION = new Set(["needs_verification", "estimated", "confirmed"]);
const ALLOWED_STATUS = new Set(["guide_drafting", "admin_review", "changes_requested", "approved"]);
const COST_CATEGORY_ORDER = new Map([
  ["guide", 10], ["entrance", 20], ["reserve", 30], ["activity", 40], ["food", 50], ["other", 60],
  ["transportation", 90], ["lodging", 100],
]);
const GUEST_LINE_CATEGORIES = new Set(["guide", "entrance", "reserve", "activity", "food", "other", "transportation", "lodging"]);
const ROBERT_ROUTE_REVIEW_ID = "mbw-robert-route-2026-10-30";
const ROBERT_ROUTE_REVISION = "neicer-2026-10-30-v2";
const ROBERT_NEICER_UPDATE_ID = "neicer-robert-route-2026-10-30-v2";

function base64Url(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesFromBase64Url(value) {
  const encoded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function encodeStoredPlan(plan) {
  const compact = value => Array.isArray(value)
    ? value.map(compact)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).map(([key, item]) => [PLAN_STORAGE_KEYS[key] || key, compact(item)]))
      : value;
  const source = new TextEncoder().encode(JSON.stringify(compact(plan)));
  const compressed = await new Response(
    new Blob([source]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  return PLAN_STORAGE_GZIP_PREFIX + base64Url(new Uint8Array(compressed));
}

async function decodeStoredPlan(value) {
  const stored = String(value || "{}");
  if (!stored.startsWith(PLAN_STORAGE_PREFIX) && !stored.startsWith(PLAN_STORAGE_GZIP_PREFIX)) return JSON.parse(stored);
  let bytes;
  if (stored.startsWith(PLAN_STORAGE_GZIP_PREFIX)) {
    const compressed = bytesFromBase64Url(stored.slice(PLAN_STORAGE_GZIP_PREFIX.length));
    bytes = new Uint8Array(await new Response(
      new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer());
  } else {
    bytes = bytesFromBase64Url(stored.slice(PLAN_STORAGE_PREFIX.length));
  }
  const expand = item => Array.isArray(item)
    ? item.map(expand)
    : item && typeof item === "object"
      ? Object.fromEntries(Object.entries(item).map(([key, value]) => [PLAN_STORAGE_KEYS_REVERSE[key] || key, expand(value)]))
      : item;
  return expand(JSON.parse(new TextDecoder().decode(bytes)));
}
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
    routeRevision: ROBERT_ROUTE_REVISION,
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
        title: { es: "Las Cotingas · Santa Rosa · actividades en Mindo", en: "Las Cotingas · Santa Rosa · Mindo activities" },
        details: { es: "Visita a la Reserva Las Cotingas y a la Reserva Santa Rosa para observar el tucán azul. Por la tarde, visita al jardín de orquídeas y caminata nocturna.", en: "Visit Las Cotingas Reserve and Santa Rosa Reserve to look for the blue toucan. In the afternoon, visit the orchid garden and take a night walk." },
        pickupLocation: { es: "Hotel en Mindo", en: "Mindo hotel" },
        dropoffLocation: { es: "Hotel en Mindo", en: "Mindo hotel" },
        overnightCity: { es: "Mindo", en: "Mindo" },
        sourceCosts: [
          { category: "transportation", label: { es: "Transporte", en: "Transportation" }, amount: 60 },
          { category: "guide", label: { es: "Guía", en: "Guide" }, amount: 80 },
          { category: "entrance", label: { es: "Ingresos", en: "Entrance fees" }, amount: 40 },
        ],
        originalCost: 180,
      },
      {
        id: "day-4", date: "2027-02-12",
        title: { es: "Mindo · día completo en Intag", en: "Mindo · full day in Intag" },
        details: { es: "Salida muy temprano desde Mindo para realizar un día completo en Intag. Hospedaje en Intag.", en: "Depart very early from Mindo for a full day in Intag. Overnight in Intag." },
        pickupLocation: { es: "Hotel en Mindo", en: "Mindo hotel" },
        dropoffLocation: { es: "Alojamiento en Intag", en: "Intag lodging" },
        overnightCity: { es: "Intag", en: "Intag" },
        sourceCosts: [],
        costNote: { es: "Neicer actualizó la ruta; el transporte, la guía, los ingresos y el alojamiento están pendientes de cotización.", en: "Neicer updated the route; transportation, guide, entrance, and lodging costs are pending." },
        originalCost: 0,
      },
      { id: "day-5", date: "2027-02-13", title: { es: "Intag · día completo en Otavalo", en: "Intag · full day in Otavalo" }, details: { es: "Salida de Intag hacia Otavalo para un día completo con visitas al Mercado de los Ponchos, la Laguna Cuicocha y Cotacachi, la ciudad del cuero. Hospedaje en Otavalo.", en: "Depart from Intag for a full day in Otavalo, visiting the Poncho Market, Cuicocha Lake, and Cotacachi, known for its leatherwork. Overnight in Otavalo." }, pickupLocation: { es: "Alojamiento en Intag", en: "Intag lodging" }, dropoffLocation: { es: "Hotel en Otavalo", en: "Otavalo hotel" }, overnightCity: { es: "Otavalo", en: "Otavalo" }, sourceCosts: [], costNote: { es: "Neicer actualizó la ruta; el transporte, la guía, los ingresos y el alojamiento están pendientes de cotización.", en: "Neicer updated the route; transportation, guide, entrance, and lodging costs are pending." }, originalCost: 0 },
      { id: "day-6", date: "2027-02-14", title: { es: "Regreso al aeropuerto de Quito", en: "Return to Quito airport" }, details: { es: "Regreso al aeropuerto de Quito al final de la tarde. Actividades y transporte pendientes de confirmar.", en: "Return to Quito airport by late afternoon. Activities and transportation remain to be confirmed." }, pickupLocation: { es: "Por confirmar", en: "To be confirmed" }, dropoffLocation: { es: "Aeropuerto de Quito", en: "Quito airport" }, overnightCity: { es: "Sin alojamiento; fin del itinerario", en: "No overnight stay; itinerary ends" }, sourceCosts: [], originalCost: 0 },
    ],
    adjustments: [],
    comments: [robertRouteReview()],
    history: [],
    localeUpdatedAt: { es: "", en: "" },
    originalTotal: 515,
    synthetic: true,
  };
}

function applyRobertRouteRevision(plan) {
  const revised = robertPlan({ providerId: plan.providerId, providerName: plan.providerName });
  const replacements = new Map(revised.days.slice(2, 5).map(day => [day.id, day]));
  const comments = (plan.comments || []).some(item => item.id === ROBERT_NEICER_UPDATE_ID) ? plan.comments : [...(plan.comments || []), {
    id: ROBERT_NEICER_UPDATE_ID,
    message: "Actualización de Neicer (30 oct 2026): Día 3, Las Cotingas y Santa Rosa para buscar el tucán azul; por la tarde, jardín de orquídeas y caminata nocturna. Costos confirmados: transporte $60, ingresos $40 y guía $80. Día 4, salida muy temprano para un día completo en Intag y alojamiento en Intag. Día 5, salida de Intag para un día completo en Otavalo, Mercado de los Ponchos, Laguna Cuicocha y Cotacachi, con alojamiento en Otavalo. Los costos de los días 4 y 5 siguen pendientes.",
    author: "Neicer",
    role: "guide",
    createdAt: "2026-10-30T17:30:00.000Z",
  }];
  return sanitizePlan({
    ...plan,
    routeRevision: ROBERT_ROUTE_REVISION,
    days: plan.days.map(day => replacements.get(day.id) || day),
    comments,
  }, plan);
}

export function isPlanRow(row) {
  return String(row.assignment_kind || "").trim().toLowerCase() === "tour_plan" || String(row.assignment_group_id || "").startsWith("PLAN-") || String(row.confirmation_note || "").includes("[GUIDE_PLAN ");
}

export async function parsePlanRow(row) {
  if (!isPlanRow(row)) return null;
  try {
    const parsed = await decodeStoredPlan(row.internal_note);
    const planId = text(parsed.planId || String(row.assignment_group_id || "").replace(/^PLAN-/, ""), 80);
    const provider = { providerId: row.provider_id, providerName: row.provider_name === "Other" ? row.provider_name_other : row.provider_name };
    const base = planId === ROBERT_PLAN_ID ? robertPlan(provider) : blankPlan({ ...parsed, ...provider, planId });
    let plan = sanitizePlan({ ...base, ...parsed, inquiryId: planId === ROBERT_PLAN_ID ? ROBERT_INQUIRY_ID : parsed.inquiryId, assignmentId: row.assignment_id, updatedAt: row.updated_at, synthetic: false }, base);
    if (planId === ROBERT_PLAN_ID && parsed.routeRevision !== ROBERT_ROUTE_REVISION) plan = applyRobertRouteRevision(plan);
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
      guestLines: sortPlanCosts((Array.isArray(pricingByDay.get(day.id)?.guestLines) ? pricingByDay.get(day.id).guestLines : []).slice(0, 20).map((line, lineIndex) => ({
        id: text(line.id || `${day.id}-guest-${lineIndex + 1}`, 80),
        category: GUEST_LINE_CATEGORIES.has(line.category) ? line.category : "other",
        label: bilingual(line.label, {}, 160),
        amount: number(line.amount),
      })).filter(line => (line.label.es || line.label.en) && line.amount > 0)),
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
    routeRevision: text(input.routeRevision || current.routeRevision, 80),
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

export function guestItineraryDraft(plan) {
  if (!plan || typeof plan !== "object") throw Object.assign(new Error("The itinerary plan is unavailable."), { status: 404 });
  if (plan.status !== "approved") throw Object.assign(new Error("Approve the itinerary before preparing the guest version."), { status: 409 });
  const pricing = new Map((plan.mbwPricing?.days || []).map(item => [item.dayId, item]));
  const items = [];
  for (const [dayIndex, day] of (plan.days || []).entries()) {
    const dayPricing = pricing.get(day.id) || {};
    const lines = sortPlanCosts(dayPricing.guestLines || []);
    const lineTotal = lines.reduce((sum, line) => sum + number(line.amount), 0);
    const sellPrice = number(dayPricing.sellPrice);
    if (!lines.length || Math.abs(lineTotal - sellPrice) > 0.009) {
      throw Object.assign(new Error(`Complete the guest price breakdown for day ${dayIndex + 1} before preparing the itinerary.`), { status: 409 });
    }
    lines.forEach((line, lineIndex) => items.push({
      id: line.id,
      sourceDayId: day.id,
      date: day.date,
      type: line.category === "transportation" ? "Transportation" : line.category === "lodging" ? "Lodging" : "Custom",
      productPreset: "Other",
      name: line.label.en || line.label.es,
      nameEs: line.label.es || line.label.en,
      note: lineIndex === 0 ? [day.details?.en || day.details?.es || "", `Pickup: ${day.pickupLocation?.en || day.pickupLocation?.es || "To be confirmed"}`, `Drop-off: ${day.dropoffLocation?.en || day.dropoffLocation?.es || "To be confirmed"}`, `Overnight: ${day.overnightCity?.en || day.overnightCity?.es || "To be confirmed"}`].filter(Boolean).join("\n") : "",
      noteEs: lineIndex === 0 ? [day.details?.es || day.details?.en || "", `Recogida: ${day.pickupLocation?.es || day.pickupLocation?.en || "Por confirmar"}`, `Llegada: ${day.dropoffLocation?.es || day.dropoffLocation?.en || "Por confirmar"}`, `Noche: ${day.overnightCity?.es || day.overnightCity?.en || "Por confirmar"}`].filter(Boolean).join("\n") : "",
      quantity: 1,
      unitPrice: number(line.amount),
      dayTitle: day.title?.en || day.title?.es || "",
      dayTitleEs: day.title?.es || day.title?.en || "",
      pickupLocation: day.pickupLocation?.en || day.pickupLocation?.es || "",
      pickupLocationEs: day.pickupLocation?.es || day.pickupLocation?.en || "",
      dropoffLocation: day.dropoffLocation?.en || day.dropoffLocation?.es || "",
      dropoffLocationEs: day.dropoffLocation?.es || day.dropoffLocation?.en || "",
      overnightCity: day.overnightCity?.en || day.overnightCity?.es || "",
      overnightCityEs: day.overnightCity?.es || day.overnightCity?.en || "",
    }));
  }
  return {
    source: "guide_plan",
    sourcePlanId: plan.planId,
    sourcePlanUpdatedAt: plan.updatedAt || "",
    inquiryId: plan.inquiryId || "",
    guestName: plan.guestName || "",
    guestCount: Number(plan.brief?.guestCount || 1),
    tripTitle: plan.title?.en || plan.title?.es || "Custom Ecuador itinerary",
    tripTitleEs: plan.title?.es || plan.title?.en || "Itinerario personalizado en Ecuador",
    startDate: plan.startDate || plan.days?.[0]?.date || "",
    endDate: plan.endDate || plan.days?.at(-1)?.date || "",
    language: "en",
    brandId: "mbw",
    itineraryStage: "preliminary",
    items,
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

export async function planAssignment(plan) {
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
    // A collaborative itinerary draft is not an operational assignment or a
    // provider dispatch. Marking it informed makes the CRM assignment workflow
    // require provider_informed_by and can also imply a calendar invitation.
    provider_informed: "No",
    confirmation_note: `${PLAN_MARKER} ${plan.planId}]|${plan.status}`,
    // The CRM gateway receives form-encoded JSON. A raw nested JSON document
    // percent-encodes every quote and brace and can exceed its guarded request
    // limit even when the original plan is modest. Base64url preserves the
    // complete plan while keeping the wire payload compact and URL-safe.
    internal_note: await encodeStoredPlan(stored),
    created_by: "JPG",
  };
}
