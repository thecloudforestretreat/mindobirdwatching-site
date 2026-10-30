import { mobileIdentity } from "../../lib/mobile-auth.mjs";
import { loadMobileData } from "../../lib/mobile-data.mjs";
import { MOBILE_DOMAIN_VERSION } from "../../lib/mobile-domain.mjs";
import { json, errorResponse, methodNotAllowed, writesEnabled } from "../../lib/mobile-http.mjs";

export async function onRequestGet({ request, env }) {
  try {
    const identity = await mobileIdentity(request, env);
    const data = await loadMobileData(env);
    const guests = data.inquiries
      .slice()
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 100)
      .map(({ internalNotes, notes, email, phone, ...guest }) => guest);
    const inquiries = data.inquiries.map(({ internalNotes, notes, email, phone, ...guest }) => guest);
    return json(200, {
      ok: true,
      dataVersion: MOBILE_DOMAIN_VERSION,
      identity: { name: identity.name, role: identity.role },
      writeEnabled: writesEnabled(env),
      checkedAt: new Date().toISOString(),
      actions: data.actions,
      today: data.today,
      recentGuests: guests,
      inquiries,
      bookings: data.bookings,
      providers: data.providers,
      upcoming: data.upcoming,
      customPlans: data.customPlans,
    });
  } catch (error) { return errorResponse(error, "Mobile data is unavailable."); }
}

export function onRequestPost() { return methodNotAllowed(["GET"]); }
