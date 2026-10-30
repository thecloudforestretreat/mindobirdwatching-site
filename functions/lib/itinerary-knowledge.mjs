const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const list = (value, maxItems = 40, maxLength = 240) => Array.isArray(value) ? value.slice(0, maxItems).map(item => clean(item, maxLength)).filter(Boolean) : [];
const STATUS = new Set(["new", "extracted", "needs_review", "approved"]);
const SOURCE_TYPES = new Set(["url", "pdf", "text", "guest_plan"]);
const RIGHTS = new Set(["private", "permission", "public_facts_only", "unverified"]);
const CONFIDENCE = new Set(["low", "medium", "high"]);

const block = (id, dayStart, dayEnd, title, route, evidence, details = "") => ({ id, dayStart, dayEnd, title, route, details, alternatives: [], seasonality: [], requirements: [], confidence: "medium", evidence, approved: false });

export const ITINERARY_KNOWLEDGE_MARKER = "[ITINERARY_KNOWLEDGE";

export const seedKnowledge = () => [
  {
    sourceId: "robert-guide-plan", title: "Robert - guide planning source", sourceType: "guest_plan", sourceName: "Robert custom Ecuador itinerary", sourceUrl: "", linkedInquiryId: "INQ-20261023224230-9029", linkedGuest: "Robert Kirberger", rights: "private", status: "needs_review", country: "Ecuador", regions: ["Quito", "Mindo", "Intag", "Otavalo"], durationDays: 6, travelStyle: "Private custom tour", lodgingStyle: "2-3 star lodging", inclusions: [], exclusions: [], gaps: ["Driver-only alternatives", "Final lodging rates", "Entrance fee breakdown", "Walking and difficulty details"], sourceNotes: "Private working itinerary. Facts require MBW review before reuse.", blocks: [
      block("robert-1", "1", "1", "Quito - Alambi - Mindo", "Airport hotel > Alambi Reserve > Mindo", "Guide plan, day 1"),
      block("robert-2", "2", "2", "Mindo birding and local activities", "Mindo", "Guide plan, day 2"),
      block("robert-3", "3", "4", "Mindo and Intag", "Mindo > Intag > Mindo", "Guide plan, days 3-4"),
      block("robert-5", "5", "5", "Las Cotingas and Otavalo", "Mindo > Las Cotingas > Otavalo", "Guide plan, day 5"),
      block("robert-6", "6", "6", "Tayta Imbabura and airport return", "Otavalo > Cochasqui > Quito airport", "Guide plan, day 6"),
    ], createdAt: "2026-10-30T00:00:00.000Z", updatedAt: "", approvedAt: "", approvedBy: "", synthetic: true,
  },
  {
    sourceId: "ecuador-inmersion-voyages-de-reve", title: "Ecuador en Inmersion", sourceType: "pdf", sourceName: "Ecuador en Inmersion + GPS NT vuelo inclus ENVIADO.pdf", sourceUrl: "", linkedInquiryId: "", linkedGuest: "", rights: "public_facts_only", status: "needs_review", country: "Ecuador", regions: ["Quito", "Otavalo", "Mindo", "Cotopaxi", "Banos", "Amazonia", "Riobamba", "Ingapirca", "Cuenca", "Cajas", "Guayaquil", "Puerto Lopez", "Galapagos"], durationDays: 23, travelStyle: "Private immersion itinerary", lodgingStyle: "3-4 star hotels, haciendas and community tourism", inclusions: ["Full board", "International and domestic flights and transfers", "Private transportation with certified national guide", "Local guides in national parks and the Amazon", "Listed entrance fees", "Water bottle and electrical adapters"], exclusions: ["Cancellation and repatriation insurance", "Personal expenses", "Alcoholic beverages", "Activities not listed", "Galapagos tax"], gaps: ["No prices", "Optional activities need selection", "Walking and altitude details need verification", "Flight details are not specified", "Supplier and lodging names are not specified"], sourceNotes: "Use facts and route relationships only. Do not copy the source operator's promotional prose.", blocks: [
      block("inmersion-1", "1", "1", "Arrival and Quito welcome", "Quito airport > Quito", "PDF p.1"),
      block("inmersion-2", "2", "2", "Quito city", "Quito", "PDF p.1"),
      block("inmersion-3", "3", "3", "Mitad del Mundo and Otavalo", "Quito > Mitad del Mundo > Otavalo > Cuicocha > Cotacachi", "PDF p.1"),
      block("inmersion-4", "4", "4", "Otavalo to Mindo", "Otavalo > Mindo", "PDF p.1"),
      block("inmersion-5", "5", "5", "Mindo nature and cacao", "Mindo", "PDF p.1"),
      block("inmersion-6", "6", "6", "Mindo to Cotopaxi", "Mindo > Cotopaxi", "PDF p.2"),
      block("inmersion-7", "7", "7", "Cotopaxi to Banos", "Cotopaxi > Quilotoa > Banos", "PDF p.2"),
      block("inmersion-8", "8", "8", "Banos waterfalls", "Banos > Patate > Banos", "PDF p.2"),
      block("inmersion-9", "9", "9", "Banos to the Amazon", "Banos > Amazonia", "PDF p.2"),
      block("inmersion-10", "10", "10", "Amazon community experience", "Amazonia", "PDF p.2"),
      block("inmersion-11", "11", "11", "Amazon to Riobamba", "Amazonia > Riobamba", "PDF p.2"),
      block("inmersion-12", "12", "12", "Nariz del Diablo route and Ingapirca", "Riobamba > Alausi > Ingapirca", "PDF p.3"),
      block("inmersion-13", "13", "13", "Ingapirca to Cuenca", "Ingapirca > Cuenca", "PDF p.3"),
      block("inmersion-14", "14", "14", "Cuenca and artisan towns", "Cuenca > Gualaceo > Chordeleg > Cuenca", "PDF p.3"),
      block("inmersion-15", "15", "15", "Cajas to Guayaquil", "Cuenca > Cajas > Guayaquil", "PDF p.3"),
      block("inmersion-16-18", "16", "18", "Pacific coast", "Guayaquil > Ayangue or Puerto Lopez > Guayaquil", "PDF p.3"),
      block("inmersion-19-23", "19", "23", "Galapagos", "Guayaquil > Galapagos > Guayaquil", "PDF p.3"),
    ], createdAt: "2026-10-30T00:00:00.000Z", updatedAt: "", approvedAt: "", approvedBy: "", synthetic: true,
  },
];

export function isKnowledgeRow(row) {
  return String(row?.assignment_kind || "").toLowerCase() === "itinerary_knowledge" || String(row?.assignment_group_id || "").startsWith("KNOW-") || String(row?.confirmation_note || "").includes(ITINERARY_KNOWLEDGE_MARKER);
}

export function sanitizeKnowledge(input = {}, fallback = {}) {
  const sourceId = clean(input.sourceId || fallback.sourceId, 100);
  const blocks = (Array.isArray(input.blocks) ? input.blocks : fallback.blocks || []).slice(0, 40).map((item, index) => ({
    id: clean(item?.id || `block-${index + 1}`, 100), dayStart: clean(item?.dayStart, 10), dayEnd: clean(item?.dayEnd || item?.dayStart, 10), title: clean(item?.title, 240), route: clean(item?.route, 500), details: clean(item?.details, 2400), alternatives: list(item?.alternatives), seasonality: list(item?.seasonality), requirements: list(item?.requirements), confidence: CONFIDENCE.has(item?.confidence) ? item.confidence : "low", evidence: clean(item?.evidence, 500), approved: Boolean(item?.approved),
  })).filter(item => item.title || item.route || item.details);
  return {
    sourceId, assignmentId: clean(input.assignmentId || fallback.assignmentId, 128), title: clean(input.title || fallback.title, 240),
    sourceType: SOURCE_TYPES.has(input.sourceType) ? input.sourceType : SOURCE_TYPES.has(fallback.sourceType) ? fallback.sourceType : "text",
    sourceName: clean(input.sourceName ?? fallback.sourceName, 500), sourceUrl: /^https:\/\//.test(String(input.sourceUrl || fallback.sourceUrl || "")) ? clean(input.sourceUrl || fallback.sourceUrl, 1000) : "",
    linkedInquiryId: clean(input.linkedInquiryId ?? fallback.linkedInquiryId, 128), linkedGuest: clean(input.linkedGuest ?? fallback.linkedGuest, 160),
    rights: RIGHTS.has(input.rights) ? input.rights : RIGHTS.has(fallback.rights) ? fallback.rights : "unverified",
    status: STATUS.has(input.status) ? input.status : STATUS.has(fallback.status) ? fallback.status : "new",
    country: clean(input.country ?? fallback.country, 120), regions: list(input.regions ?? fallback.regions, 60, 120), durationDays: Math.max(0, Math.min(90, Number(input.durationDays ?? fallback.durationDays) || 0)),
    travelStyle: clean(input.travelStyle ?? fallback.travelStyle, 300), lodgingStyle: clean(input.lodgingStyle ?? fallback.lodgingStyle, 300),
    inclusions: list(input.inclusions ?? fallback.inclusions), exclusions: list(input.exclusions ?? fallback.exclusions), gaps: list(input.gaps ?? fallback.gaps), sourceNotes: clean(input.sourceNotes ?? fallback.sourceNotes, 3000), rawText: clean(input.rawText ?? fallback.rawText, 12000), blocks,
    createdAt: clean(input.createdAt || fallback.createdAt, 80), updatedAt: clean(input.updatedAt || fallback.updatedAt, 80), approvedAt: clean(input.approvedAt || fallback.approvedAt, 80), approvedBy: clean(input.approvedBy || fallback.approvedBy, 160), synthetic: Boolean(input.synthetic ?? fallback.synthetic),
  };
}

export function parseKnowledgeRow(row) {
  if (!isKnowledgeRow(row)) return null;
  try {
    const parsed = JSON.parse(String(row.internal_note || "{}"));
    return sanitizeKnowledge({ ...parsed, assignmentId: row.assignment_id, updatedAt: row.updated_at, synthetic: false });
  } catch { return null; }
}

export function knowledgeAssignment(record) {
  const saved = sanitizeKnowledge(record, record);
  return {
    assignment_id: saved.assignmentId || "", assignment_kind: "itinerary_knowledge", assignment_group_id: `KNOW-${saved.sourceId}`, inquiry_id: saved.linkedInquiryId || `KNOW-${saved.sourceId}`, guest_id: "", guest_name: saved.linkedGuest || saved.title,
    service_type: "Knowledge Intake", product_selected: saved.title, provider_role: "admin", provider_name: "MBW Admin", assignment_status: saved.status, service_date: saved.createdAt.slice(0, 10) || new Date().toISOString().slice(0, 10), confirmation_note: `${ITINERARY_KNOWLEDGE_MARKER} ${saved.sourceId}]`, internal_note: JSON.stringify({ ...saved, assignmentId: undefined, synthetic: false }), updated_at: saved.updatedAt || new Date().toISOString(),
  };
}

export function knowledgeValidation(record) {
  const errors = [];
  if (!record.title) errors.push("Add a source title.");
  if (record.rights === "unverified") errors.push("Confirm how MBW may use this source.");
  if (!record.blocks.length) errors.push("Add at least one itinerary block.");
  record.blocks.forEach((item, index) => {
    if (!item.title) errors.push(`Block ${index + 1} needs a title.`);
    if (!item.evidence) errors.push(`Block ${index + 1} needs a source reference.`);
  });
  return errors;
}
