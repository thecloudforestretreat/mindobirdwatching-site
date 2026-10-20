import { mobileIdentity } from "../../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../../lib/mobile-crm.mjs";
import { normalizeInquiry } from "../../../../lib/mobile-domain.mjs";
import { json, errorResponse, methodNotAllowed, assertSameOrigin, assertMobileWriteReady, readJson, validId } from "../../../../lib/mobile-http.mjs";

const STATUSES = new Set(["planning", "quoted", "deposit_pending", "deposit_paid", "payment_pending", "booked"]);

const value = (input, max) => String(input ?? "").trim().slice(0, max);

function existingItems(raw, record) {
  let items = [];
  try {
    const source = raw.tour_items_json || raw.tour_items;
    items = Array.isArray(source) ? source : JSON.parse(source || "[]");
  } catch {
    throw Object.assign(new Error("Existing itinerary services cannot be read. Open the desktop CRM and review this record before adding another service."), { status: 409 });
  }
  if (!Array.isArray(items)) items = [];
  if (!items.length) {
    items = (record.tours || []).map(item => ({
      id: item.id, tour: item.tour, product_selected: item.product, service_type: item.serviceType,
      date: item.date, guests: item.guests, status: item.status, pickup_location: item.pickup,
      dropoff_location: item.dropoff, start_time: item.startTime,
    }));
  }
  return items;
}

function normalizeService(input, inquiryId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("Service details are required."), { status: 400 });
  const tour = value(input.tour, 300), serviceType = value(input.service_type, 120), product = value(input.product_selected, 240);
  const date = value(input.date, 10), guests = value(input.guests, 3), status = value(input.status, 40).toLowerCase();
  const price = value(input.price_per_person, 30), pickup = value(input.pickup_location, 500), notes = value(input.notes, 1000);
  if (!tour) throw Object.assign(new Error("Enter the tour, activity, or transfer name."), { status: 400 });
  if (!serviceType) throw Object.assign(new Error("Choose a service type."), { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error("Choose a valid service date."), { status: 400 });
  if (!/^\d{1,2}$/.test(guests) || Number(guests) < 1 || Number(guests) > 99) throw Object.assign(new Error("Guests must be between 1 and 99."), { status: 400 });
  if (!STATUSES.has(status)) throw Object.assign(new Error("Choose a valid service status."), { status: 400 });
  if (price && (!/^\d+(?:\.\d{1,2})?$/.test(price) || Number(price) > 100000)) throw Object.assign(new Error("Enter a valid price per person."), { status: 400 });
  return {
    id: `MOBILE-${inquiryId}-${Date.now().toString(36).toUpperCase()}`,
    tour, product_selected: product, service_type: serviceType, date, guests, status,
    price_per_person: price, pickup_location: pickup, notes,
  };
}

async function findInquiry(env, inquiryId) {
  const rows = await listRecords(env, "list_inquiries", { filters: {} });
  const raw = rows.find(item => String(item.inquiry_id) === inquiryId);
  if (!raw) throw Object.assign(new Error("Guest inquiry not found."), { status: 404 });
  return raw;
}

export async function onRequestPost({ request, env, params }) {
  try {
    const identity = await mobileIdentity(request, env);
    assertMobileWriteReady(env, identity);
    assertSameOrigin(request, env);
    const inquiryId = validId(params.inquiryId), body = await readJson(request, 10000);
    const raw = await findInquiry(env, inquiryId), record = normalizeInquiry(raw);
    if (body.expectedUpdatedAt && String(body.expectedUpdatedAt) !== record.updatedAt) {
      return json(409, { ok: false, error: "This record changed since it was loaded. Refresh and review before adding the service." });
    }
    const service = normalizeService(body.service, inquiryId), items = existingItems(raw, record);
    const updatedAt = new Date().toISOString(), nextItems = [...items, service];
    const updated = {
      ...raw,
      tour_items: JSON.stringify(nextItems),
      tour_items_json: JSON.stringify(nextItems),
      tour_count: String(nextItems.length),
      tour_content: String(nextItems.length),
      updated_at: updatedAt,
      internal_notes: [raw.internal_notes || "", `Mobile service added by ${identity.staffCode || identity.email} · ${updatedAt} · ${service.tour} · ${service.date}`].filter(Boolean).join("\n"),
    };
    await crmCall(env, "update_inquiry", { record: updated, inquiry_row: updated, expected_updated_at: record.updatedAt });
    const verifiedRaw = await findInquiry(env, inquiryId), verified = normalizeInquiry(verifiedRaw);
    if (!verified.tours.some(item => item.id === service.id)) {
      return json(202, { ok: false, verified: false, error: "The service save was submitted but not verified. Refresh before retrying." });
    }
    return json(200, { ok: true, verified: true, record: verified, service: verified.tours.find(item => item.id === service.id) });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["POST"]); }
