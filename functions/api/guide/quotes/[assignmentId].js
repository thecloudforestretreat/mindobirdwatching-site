import { guideIdentity, identityMatchesProvider } from "../../../lib/mobile-auth.mjs";
import { crmCall, listRecords } from "../../../lib/mobile-crm.mjs";
import { errorResponse, json, methodNotAllowed, assertSameOrigin, readJson, validId, writesEnabled } from "../../../lib/mobile-http.mjs";
import { isTripQuoteAssignment, normalizeTripQuote, parseTripBuilderMarker, tripQuoteErrors } from "../../../lib/guide-trip-builder.mjs";

const parseArray = value => {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
};
const belongsToGuide = (row, identity) => identityMatchesProvider(identity, row.provider_id, row.provider_name === "Other" ? row.provider_name_other : row.provider_name);

export async function onRequestPost({ request, env, params }) {
  try {
    const identity = await guideIdentity(request, env);
    if (identity.role !== "guide") throw Object.assign(new Error("Admin preview is read-only."), { status: 403 });
    if (!writesEnabled(env) || !env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Trip quote saves are temporarily unavailable."), { status: 503 });
    assertSameOrigin(request, env);
    const assignmentId = validId(params.assignmentId);
    const body = await readJson(request, 90000);
    const mode = body.mode === "submit" ? "submit" : "draft";
    const assignment = (await listRecords(env, "list_assignments", {})).find(row => String(row.assignment_id) === assignmentId);
    if (!assignment || !belongsToGuide(assignment, identity) || !isTripQuoteAssignment(assignment)) {
      return json(404, { ok: false, error: "Trip quote request not found." });
    }
    const marker = parseTripBuilderMarker(assignment.internal_note);
    const studioResult = await crmCall(env, "get_inquiry_studio", { inquiry_id: assignment.inquiry_id, inquiry_studio_id: marker.studioId });
    const studio = studioResult.record || studioResult.data?.record || {};
    if (!studio.inquiry_studio_id) return json(409, { ok: false, error: "The linked Inquiry Studio record is unavailable." });
    if (body.studioRevision && Number(body.studioRevision) !== Number(studio.revision || 0)) {
      return json(409, { ok: false, error: "This request changed after you opened it. Refresh before saving." });
    }
    const quote = normalizeTripQuote({ ...(body.quote || {}), status: mode === "submit" ? "submitted" : "draft" }, {
      assignmentId,
      inquiryId: assignment.inquiry_id,
      studioId: studio.inquiry_studio_id,
      providerId: identity.providerId,
      providerName: identity.providerName,
      brandId: marker.brandId,
    });
    const errors = tripQuoteErrors(quote, mode === "submit");
    if (errors.length) return json(400, { ok: false, error: errors[0], errors });

    const quotes = parseArray(studio.guide_quotes_json);
    const matching = quoteItem => String(quoteItem.assignment_id || "") === assignmentId
      && (!quoteItem.provider_id || (identity.providerIds || [identity.providerId]).includes(String(quoteItem.provider_id)));
    const prior = quotes.filter(matching);
    const previousDraft = prior.find(item => item.status === "draft");
    const maxVersion = Math.max(0, ...prior.filter(item => item.status !== "draft").map(item => Number(item.version || 0)));
    const timestamp = new Date().toISOString();
    quote.quote_id = previousDraft?.quote_id || quote.quote_id || `GQ-${assignmentId}-${maxVersion + 1}`.slice(0, 128);
    quote.version = maxVersion + 1;
    quote.created_at = previousDraft?.created_at || timestamp;
    quote.updated_at = timestamp;
    if (mode === "submit") quote.submitted_at = timestamp;
    const retained = quotes.filter(item => !(matching(item) && item.status === "draft"));
    retained.push(quote);

    // Google Sheets cells cap text at 50,000 characters. Preserve the newest
    // operational versions and compact older submissions to auditable totals.
    let serializedQuotes = JSON.stringify(retained);
    for (let index = 0; serializedQuotes.length > 45000 && index < retained.length - 1; index += 1) {
      const item = retained[index];
      if (item.archived_summary || item.status === "draft") continue;
      retained[index] = {
        quote_id: item.quote_id,
        assignment_id: item.assignment_id,
        inquiry_id: item.inquiry_id,
        inquiry_studio_id: item.inquiry_studio_id,
        provider_id: item.provider_id,
        provider_name: item.provider_name,
        brand_id: item.brand_id,
        status: item.status,
        version: item.version,
        submitted_at: item.submitted_at,
        archived_summary: true,
        option_totals: (item.options || []).map(option => ({ name: option.name, net_total: option.net_total, pending_cost_count: option.pending_cost_count })),
      };
      serializedQuotes = JSON.stringify(retained);
    }
    if (serializedQuotes.length > 45000) return json(413, { ok: false, error: "This quote is too large to save. Reduce the number of options, days, or long notes." });

    const updatedStudio = {
      ...studio,
      guide_quotes_json: serializedQuotes,
      status: mode === "submit" ? "guide_quote_received" : "guide_quote_in_progress",
      updated_at: timestamp,
      revision: Number(studio.revision || 0) + 1,
    };
    await crmCall(env, "save_inquiry_studio", { record: updatedStudio });

    const response = mode === "submit" ? "quote_submitted" : "quote_draft";
    const previousConfirmation = String(assignment.confirmation_note || "").replace(/\n?\[GUIDE_TRIP_QUOTE[^\]]*\]/gi, "").trim();
    const updatedAssignment = {
      ...assignment,
      guide_response: response,
      guide_responded_at: timestamp,
      guide_responded_by: identity.providerId || identity.name,
      confirmation_note: [previousConfirmation, `[GUIDE_TRIP_QUOTE ${response}|v${quote.version}|${timestamp}]`].filter(Boolean).join("\n"),
      created_by: assignment.created_by || "JPG",
    };
    await crmCall(env, "update_assignment", { assignment: updatedAssignment, expected_updated_at: assignment.updated_at || "" });

    const verifyResult = await crmCall(env, "get_inquiry_studio", { inquiry_id: assignment.inquiry_id, inquiry_studio_id: studio.inquiry_studio_id });
    const verifiedStudio = verifyResult.record || verifyResult.data?.record || {};
    const verified = parseArray(verifiedStudio.guide_quotes_json).some(item => item.quote_id === quote.quote_id && item.status === quote.status);
    if (!verified) return json(202, { ok: true, verified: false, error: "The quote was sent but could not be verified. Refresh before retrying." });
    return json(200, { ok: true, verified: true, quote, studioRevision: updatedStudio.revision });
  } catch (error) { return errorResponse(error); }
}

export function onRequestGet() { return methodNotAllowed(["POST"]); }

