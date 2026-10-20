import { mobileIdentity } from "../../../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../../../lib/mobile-crm.mjs";
import { normalizeInquiry } from "../../../../../lib/mobile-domain.mjs";
import { json, errorResponse, methodNotAllowed, assertSameOrigin, assertMobileWriteReady, readJson, validId } from "../../../../../lib/mobile-http.mjs";

const STATUSES = new Set(["planning", "quoted", "deposit_pending", "deposit_paid", "payment_pending", "booked", "completed", "cancelled"]);

async function findInquiry(env, inquiryId) {
  const rows = await listRecords(env, "list_inquiries", { filters: {} });
  const raw = rows.find(item => String(item.inquiry_id) === inquiryId);
  if (!raw) throw Object.assign(new Error("Guest inquiry not found."), { status: 404 });
  return raw;
}

function readItems(raw) {
  try {
    const source = raw.tour_items_json || raw.tour_items;
    const items = Array.isArray(source) ? source : JSON.parse(source || "[]");
    if (!Array.isArray(items) || !items.length) throw new Error("missing");
    return items;
  } catch {
    throw Object.assign(new Error("This record does not have an editable service list. Open the full Guest CRM to update it."), { status: 409 });
  }
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const identity = await mobileIdentity(request, env);
    assertMobileWriteReady(env, identity);
    assertSameOrigin(request, env);
    const inquiryId = validId(params.inquiryId), serviceId = validId(params.serviceId), body = await readJson(request, 4000);
    const status = String(body.status || "").trim().toLowerCase();
    if (!STATUSES.has(status)) return json(400, { ok: false, error: "Choose a valid service status." });
    const raw = await findInquiry(env, inquiryId), record = normalizeInquiry(raw);
    if (body.expectedUpdatedAt && String(body.expectedUpdatedAt) !== record.updatedAt) {
      return json(409, { ok: false, error: "This record changed since it was loaded. Refresh and review before saving." });
    }
    const items = readItems(raw), index = items.findIndex((item, itemIndex) => String(item.id || `${inquiryId}-${itemIndex}`) === serviceId);
    if (index < 0) return json(404, { ok: false, error: "Service not found." });
    const updatedAt = new Date().toISOString();
    items[index] = { ...items[index], status };
    const updated = {
      ...raw,
      tour_items: JSON.stringify(items),
      tour_items_json: JSON.stringify(items),
      updated_at: updatedAt,
      internal_notes: [raw.internal_notes || "", `Mobile service status by ${identity.staffCode || identity.email} · ${updatedAt} · ${serviceId} · ${status}`].filter(Boolean).join("\n"),
    };
    await crmCall(env, "update_inquiry", { record: updated, inquiry_row: updated, expected_updated_at: record.updatedAt });
    const verified = normalizeInquiry(await findInquiry(env, inquiryId)), saved = verified.tours.find(item => item.id === serviceId);
    if (!saved || saved.status !== status) return json(202, { ok: false, verified: false, error: "The service update was submitted but not verified. Refresh before retrying." });
    return json(200, { ok: true, verified: true, record: verified, service: saved });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["PATCH"]); }
