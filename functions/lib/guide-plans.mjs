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
    title: "Robert · Custom Ecuador Tour",
    startDate: "2027-02-09",
    endDate: "2027-02-14",
    status: "guide_drafting",
    updatedAt: "",
    brief: {
      guestCount: "1",
      traveler: "Age 78 · reasonably healthy · no long hikes",
      lodging: "2–3 star lodging",
      pickup: "Airport hotel · February 9, 2027",
      dropoff: "Quito airport · February 14, late afternoon",
      request: "Expand the original four-day plan to six days with one additional night in Mindo and one night in Intag.",
      interests: "Catequilla, Pululahua, Templo del Sol, Alambi, waterfalls, chocolate, Cock-of-the-Rock, toucans, hummingbirds, orchids/butterflies, night walk, Las Cotingas, Otavalo, Parque Cóndor, Intag coffee, Campo Colibrí/canopy and Tren Tayta Imbabura.",
    },
    days: [
      { id: "day-1", date: "2027-02-09", title: "Quito · Alambi · Mindo", details: "Airport hotel pickup; Catequilla/Pululahua/Templo del Sol; Alambi; continue to Mindo.", originalCost: 250 },
      { id: "day-2", date: "2027-02-10", title: "Mindo birding & nature", details: "Birding, cable car/waterfalls, chocolate and optional night walk.", originalCost: 225 },
      { id: "day-3", date: "2027-02-11", title: "Las Cotingas · Otavalo", details: "Las Cotingas, Otavalo market and regional stops.", originalCost: 325 },
      { id: "day-4", date: "2027-02-12", title: "Imbabura train · Quito", details: "Original return-day estimate; route now needs revision for the six-day plan.", originalCost: 350 },
      { id: "day-5", date: "2027-02-13", title: "Intag · new day", details: "Intag coffee, Campo Colibrí/canopy and lodging to be confirmed.", originalCost: 0 },
      { id: "day-6", date: "2027-02-14", title: "Return to Quito airport", details: "Return to Quito airport by late afternoon; activities and transport to be confirmed.", originalCost: 0 },
    ],
    adjustments: [],
    comments: [],
    originalTotal: 1150,
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
    originalTotal: 1150,
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
    product_selected: plan.title,
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
