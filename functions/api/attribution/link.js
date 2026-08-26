const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function cleanString(value, maxLength = 255) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function cleanId(value) {
  const id = cleanString(value, 128);
  return id && /^[A-Za-z0-9_.-]{1,128}$/.test(id) ? id : null;
}

function secureEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (!a || !b || a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

function requestSecret(request) {
  const authorization = request.headers.get("authorization") || "";
  if (/^Bearer\s+/i.test(authorization)) {
    return authorization.replace(/^Bearer\s+/i, "").trim();
  }
  return (request.headers.get("x-mbw-shared-secret") || "").trim();
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.MBW_ATTRIBUTION_DB) {
      return reply(503, { ok: false, error: "attribution_database_unavailable" });
    }

    if (!env.CF_SHARED_SECRET) {
      return reply(503, { ok: false, error: "shared_secret_unavailable" });
    }

    if (!secureEqual(requestSecret(request), env.CF_SHARED_SECRET)) {
      return reply(401, { ok: false, error: "unauthorized" });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return reply(415, { ok: false, error: "application_json_required" });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16384) {
      return reply(413, { ok: false, error: "payload_too_large" });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return reply(400, { ok: false, error: "invalid_json" });
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return reply(400, { ok: false, error: "invalid_payload" });
    }

    const inquiryId = cleanId(payload.inquiry_id);
    const guestId = cleanId(payload.guest_id);
    const bookingId = cleanId(payload.booking_id);
    const quoteId = cleanId(payload.quote_id);
    const invoiceId = cleanId(payload.invoice_id);

    if (!inquiryId) {
      return reply(400, { ok: false, error: "valid_inquiry_id_required" });
    }

    if (!bookingId && !quoteId && !invoiceId) {
      return reply(400, {
        ok: false,
        error: "booking_quote_or_invoice_id_required",
      });
    }

    const paymentMethods = new Set([
      "stripe",
      "zelle",
      "cash",
      "bank_transfer",
      "other",
    ]);
    const requestedPaymentMethod = cleanString(payload.payment_method, 32);
    const paymentMethod = requestedPaymentMethod === null
      ? null
      : (paymentMethods.has(requestedPaymentMethod)
        ? requestedPaymentMethod
        : null);

    if (requestedPaymentMethod && !paymentMethod) {
      return reply(400, { ok: false, error: "invalid_payment_method" });
    }

    const crmContact = await env.MBW_ATTRIBUTION_DB.prepare(`
      SELECT crm_contact_id, inquiry_id, guest_id, visitor_id, session_id,
             contact_intent_id, attribution_quality
      FROM crm_contacts
      WHERE inquiry_id = ?
      LIMIT 1
    `).bind(inquiryId).first();

    if (!crmContact) {
      return reply(409, { ok: false, error: "crm_contact_not_found" });
    }

    if (guestId && crmContact.guest_id && guestId !== crmContact.guest_id) {
      return reply(409, { ok: false, error: "guest_inquiry_mismatch" });
    }

    const resolvedGuestId = guestId || crmContact.guest_id || null;
    const attributionLinkId = `alink_${inquiryId}`.slice(0, 128);
    const now = new Date().toISOString();

    const linkStatement = env.MBW_ATTRIBUTION_DB.prepare(`
      INSERT INTO attribution_links (
        attribution_link_id,
        crm_contact_id,
        inquiry_id,
        guest_id,
        booking_id,
        quote_id,
        invoice_id,
        payment_method,
        link_status,
        linked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      ON CONFLICT(attribution_link_id) DO UPDATE SET
        crm_contact_id = excluded.crm_contact_id,
        guest_id = COALESCE(excluded.guest_id, attribution_links.guest_id),
        booking_id = COALESCE(excluded.booking_id, attribution_links.booking_id),
        quote_id = COALESCE(excluded.quote_id, attribution_links.quote_id),
        invoice_id = COALESCE(excluded.invoice_id, attribution_links.invoice_id),
        payment_method = COALESCE(excluded.payment_method, attribution_links.payment_method),
        link_status = 'active',
        linked_at = excluded.linked_at,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).bind(
      attributionLinkId,
      crmContact.crm_contact_id,
      inquiryId,
      resolvedGuestId,
      bookingId,
      quoteId,
      invoiceId,
      paymentMethod,
      now,
    );

    const eventId = `evt_${attributionLinkId}_${Date.now()}`.slice(0, 128);
    const eventStatement = env.MBW_ATTRIBUTION_DB.prepare(`
      INSERT INTO attribution_events (
        event_id,
        visitor_id,
        session_id,
        contact_intent_id,
        crm_contact_id,
        attribution_link_id,
        event_name,
        event_source,
        event_data,
        occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'revenue_identifier_linked', 'crm_invoice_system', ?, ?)
    `).bind(
      eventId,
      crmContact.visitor_id,
      crmContact.session_id,
      crmContact.contact_intent_id,
      crmContact.crm_contact_id,
      attributionLinkId,
      JSON.stringify({
        inquiry_id: inquiryId,
        guest_id: resolvedGuestId,
        booking_id: bookingId,
        quote_id: quoteId,
        invoice_id: invoiceId,
        payment_method: paymentMethod,
      }),
      now,
    );

    await env.MBW_ATTRIBUTION_DB.batch([
      linkStatement,
      eventStatement,
    ]);

    return reply(200, {
      ok: true,
      attribution_link_id: attributionLinkId,
      crm_contact_id: crmContact.crm_contact_id,
      inquiry_id: inquiryId,
      guest_id: resolvedGuestId,
      booking_id: bookingId,
      quote_id: quoteId,
      invoice_id: invoiceId,
      payment_method: paymentMethod,
    });
  } catch (error) {
    console.error("Revenue attribution link write failed", error);
    return reply(500, { ok: false, error: "attribution_link_write_failed" });
  }
}

export async function onRequestGet() {
  return reply(405, { ok: false, error: "method_not_allowed" });
}
