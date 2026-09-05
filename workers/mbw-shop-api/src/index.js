const ALLOWED_ORIGINS = new Set([
  "https://mindobirdwatching.com",
  "https://www.mindobirdwatching.com"
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/webhooks/stripe"
    ) {
      return handleStripeWebhook(request, env);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/checkout/session"
    ) {
      return handleCheckoutSession(request, env);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/shipping/quote"
    ) {
      return handleShippingQuote(request, env);
    }

    if (request.method !== "GET") {
      return jsonResponse(
        {
          ok: false,
          error: "Method not allowed"
        },
        405,
        request
      );
    }

    if (url.pathname === "/") {
      return jsonResponse(
        {
          ok: true,
          service: "mbw-shop-api",
          message: "Mindo Bird Watching shop API is running",
          checkout: true
        },
        200,
        request
      );
    }

    if (url.pathname === "/health") {
      return jsonResponse(
        {
          ok: true,
          status: "healthy",
          stripe_mode:
            normalizeStripeMode(env.STRIPE_MODE),
          stripe_configured:
            Boolean(getStripeSecretKey(env)),
          printify_configured:
            Boolean(
              env.PRINTIFY_API_TOKEN &&
              env.PRINTIFY_SHOP_ID
            ),
          database_configured:
            Boolean(env.DB),
          stripe_webhook_configured:
            Boolean(getStripeWebhookSecret(env)),
          resend_configured:
            Boolean(env.RESEND_API_KEY),
          admin_order_email_configured:
            Boolean(
              env.MBW_ORDER_FROM_EMAIL &&
              env.MBW_ADMIN_ORDER_EMAIL
            ),
          customer_order_email_configured:
            Boolean(
              env.RESEND_API_KEY &&
              env.MBW_ORDER_FROM_EMAIL
            )
        },
        200,
        request
      );
    }

    if (url.pathname === "/order/confirmation") {
      return handleOrderConfirmation(request, env, url);
    }

    if (url.pathname === "/catalog") {
      return handleCatalog(request, env);
    }

    if (url.pathname.startsWith("/catalog/")) {
      const productId = url.pathname
        .replace("/catalog/", "")
        .trim();

      return handleCatalogProduct(
        request,
        env,
        productId
      );
    }

    if (url.pathname === "/printify/products") {
      return handleDebugProducts(request, env);
    }

    if (url.pathname === "/printify/shops") {
      return handlePrintifyShops(request, env);
    }

    return jsonResponse(
      {
        ok: false,
        error: "Not found"
      },
      404,
      request
    );
  }
};


function normalizeStripeMode(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "test"
    ? "test"
    : "live";
}

function getStripeSecretKey(env) {
  const mode =
    normalizeStripeMode(env.STRIPE_MODE);

  if (mode === "test") {
    return env.STRIPE_TEST_SECRET_KEY || "";
  }

  return env.STRIPE_SECRET_KEY || "";
}


function getStripeWebhookSecret(env) {
  const mode =
    normalizeStripeMode(env.STRIPE_MODE);

  if (mode === "test") {
    return env.STRIPE_TEST_WEBHOOK_SECRET || "";
  }

  return env.STRIPE_WEBHOOK_SECRET || "";
}

async function handleStripeWebhook(
  request,
  env
) {
  if (!env.DB) {
    return jsonResponse(
      {
        ok: false,
        error: "D1 binding DB is not configured"
      },
      500,
      request
    );
  }

  const webhookSecret =
    getStripeWebhookSecret(env);

  if (!webhookSecret) {
    return jsonResponse(
      {
        ok: false,
        error:
          normalizeStripeMode(env.STRIPE_MODE) === "test"
            ? "STRIPE_TEST_WEBHOOK_SECRET is not configured"
            : "STRIPE_WEBHOOK_SECRET is not configured"
      },
      500,
      request
    );
  }

  const signatureHeader =
    request.headers.get("Stripe-Signature") || "";

  const rawBody =
    await request.text();

  const verified =
    await verifyStripeWebhookSignature(
      rawBody,
      signatureHeader,
      webhookSecret
    );

  if (!verified.ok) {
    return jsonResponse(
      {
        ok: false,
        error: verified.error
      },
      400,
      request
    );
  }

  let event;

  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid Stripe webhook JSON"
      },
      400,
      request
    );
  }

  if (
    !event ||
    event.type !== "checkout.session.completed"
  ) {
    return jsonResponse(
      {
        ok: true,
        received: true,
        ignored: true,
        event_type: event && event.type
          ? event.type
          : null
      },
      200,
      request
    );
  }

  const sessionFromEvent =
    event.data &&
    event.data.object
      ? event.data.object
      : null;

  if (
    !sessionFromEvent ||
    !sessionFromEvent.id
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Stripe event is missing the Checkout Session"
      },
      400,
      request
    );
  }

  const stripeResult =
    await fetchStripeCheckoutForOrder(
      env,
      sessionFromEvent.id
    );

  if (!stripeResult.ok) {
    return jsonResponse(
      stripeResult.body,
      stripeResult.status,
      request
    );
  }

  const session =
    stripeResult.session;

  if (session.payment_status !== "paid") {
    return jsonResponse(
      {
        ok: true,
        received: true,
        ignored: true,
        reason:
          "Checkout Session is not paid",
        payment_status:
          session.payment_status || null
      },
      200,
      request
    );
  }

  const saveResult =
    await saveStripeOrderToD1(
      env,
      session,
      stripeResult.lineItems
    );

  if (!saveResult.ok) {
    return jsonResponse(
      saveResult.body,
      saveResult.status,
      request
    );
  }

  const adminEmailResult =
    await sendAdminOrderConfirmation(
      env,
      session.id
    );

  if (!adminEmailResult.ok) {
    return jsonResponse(
      {
        ok: false,
        received: true,
        order_saved: true,
        duplicate: saveResult.duplicate,
        mbw_order_id:
          saveResult.mbw_order_id,
        stripe_session_id:
          session.id,
        admin_email_status:
          adminEmailResult.status || "failed",
        error:
          adminEmailResult.error ||
          "Admin order email could not be sent"
      },
      500,
      request
    );
  }

  const customerEmailResult =
    await sendCustomerOrderConfirmation(
      env,
      session.id
    );

  if (!customerEmailResult.ok) {
    return jsonResponse(
      {
        ok: false,
        received: true,
        order_saved: true,
        duplicate: saveResult.duplicate,
        mbw_order_id:
          saveResult.mbw_order_id,
        stripe_session_id:
          session.id,
        admin_email_status:
          adminEmailResult.status,
        customer_email_status:
          customerEmailResult.status || "failed",
        error:
          customerEmailResult.error ||
          "Customer order confirmation email could not be sent"
      },
      500,
      request
    );
  }

  return jsonResponse(
    {
      ok: true,
      received: true,
      order_saved: true,
      duplicate: saveResult.duplicate,
      mbw_order_id:
        saveResult.mbw_order_id,
      stripe_session_id:
        session.id,
      fulfillment_status:
        saveResult.fulfillment_status,
      admin_email_status:
        adminEmailResult.status,
      admin_email_duplicate:
        Boolean(adminEmailResult.duplicate),
      customer_email_status:
        customerEmailResult.status,
      customer_email_duplicate:
        Boolean(customerEmailResult.duplicate)
    },
    200,
    request
  );
}

async function verifyStripeWebhookSignature(
  payload,
  signatureHeader,
  secret
) {
  if (!signatureHeader) {
    return {
      ok: false,
      error:
        "Missing Stripe-Signature header"
    };
  }

  const fields =
    signatureHeader.split(",");

  let timestamp = "";
  const signatures = [];

  fields.forEach((field) => {
    const parts = field.split("=");

    if (parts.length !== 2) {
      return;
    }

    const key = parts[0].trim();
    const value = parts[1].trim();

    if (key === "t") {
      timestamp = value;
    }

    if (key === "v1") {
      signatures.push(value);
    }
  });

  if (!timestamp || signatures.length === 0) {
    return {
      ok: false,
      error:
        "Invalid Stripe-Signature header"
    };
  }

  const timestampNumber =
    Number(timestamp);

  if (!Number.isFinite(timestampNumber)) {
    return {
      ok: false,
      error:
        "Invalid Stripe webhook timestamp"
    };
  }

  const toleranceSeconds = 300;
  const nowSeconds =
    Math.floor(Date.now() / 1000);

  if (
    Math.abs(nowSeconds - timestampNumber) >
    toleranceSeconds
  ) {
    return {
      ok: false,
      error:
        "Stripe webhook timestamp is outside the allowed tolerance"
    };
  }

  const encoder =
    new TextEncoder();

  const key =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["verify"]
    );

  const signedPayload =
    encoder.encode(
      `${timestamp}.${payload}`
    );

  for (const signature of signatures) {
    const signatureBytes =
      hexToBytes(signature);

    if (!signatureBytes) {
      continue;
    }

    const valid =
      await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBytes,
        signedPayload
      );

    if (valid) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    error:
      "Stripe webhook signature verification failed"
  };
}

function hexToBytes(value) {
  const hex =
    String(value || "").trim();

  if (
    !hex ||
    hex.length % 2 !== 0 ||
    !/^[0-9a-f]+$/i.test(hex)
  ) {
    return null;
  }

  const result =
    new Uint8Array(hex.length / 2);

  for (
    let index = 0;
    index < hex.length;
    index += 2
  ) {
    result[index / 2] =
      parseInt(
        hex.slice(index, index + 2),
        16
      );
  }

  return result;
}

async function fetchStripeCheckoutForOrder(
  env,
  sessionId
) {
  const stripeKey =
    getStripeSecretKey(env);

  if (!stripeKey) {
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error:
          "Stripe API key is not configured"
      }
    };
  }

  const sessionUrl =
    "https://api.stripe.com/v1/checkout/sessions/" +
    encodeURIComponent(sessionId) +
    "?expand[]=shipping_cost.shipping_rate" +
    "&expand[]=discounts.promotion_code";

  let sessionResponse;

  try {
    sessionResponse =
      await fetch(
        sessionUrl,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${stripeKey}`,
            Accept:
              "application/json"
          }
        }
      );
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          "Unable to retrieve Checkout Session from Stripe"
      }
    };
  }

  let session;

  try {
    session =
      await sessionResponse.json();
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          "Stripe returned an invalid Checkout Session"
      }
    };
  }

  if (!sessionResponse.ok) {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          session &&
          session.error &&
          session.error.message
            ? session.error.message
            : "Unable to retrieve Checkout Session"
      }
    };
  }

  const lineItemsUrl =
    "https://api.stripe.com/v1/checkout/sessions/" +
    encodeURIComponent(sessionId) +
    "/line_items?limit=100" +
    "&expand[]=data.price.product";

  let lineItemsResponse;

  try {
    lineItemsResponse =
      await fetch(
        lineItemsUrl,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${stripeKey}`,
            Accept:
              "application/json"
          }
        }
      );
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          "Unable to retrieve Stripe line items"
      }
    };
  }

  let lineItemsData;

  try {
    lineItemsData =
      await lineItemsResponse.json();
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          "Stripe returned invalid line items"
      }
    };
  }

  if (!lineItemsResponse.ok) {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          lineItemsData &&
          lineItemsData.error &&
          lineItemsData.error.message
            ? lineItemsData.error.message
            : "Unable to retrieve Stripe line items"
      }
    };
  }

  return {
    ok: true,
    status: 200,
    session,
    lineItems:
      Array.isArray(lineItemsData.data)
        ? lineItemsData.data
        : []
  };
}

async function saveStripeOrderToD1(
  env,
  session,
  stripeLineItems
) {
  const existing =
    await env.DB
      .prepare(
        `SELECT
           id,
           mbw_order_id,
           fulfillment_status
         FROM orders
         WHERE stripe_session_id = ?
         LIMIT 1`
      )
      .bind(session.id)
      .first();

  if (existing) {
    return {
      ok: true,
      duplicate: true,
      mbw_order_id:
        existing.mbw_order_id,
      fulfillment_status:
        existing.fulfillment_status ||
        "pending"
    };
  }

  const metadata =
    session.metadata || {};

  const mbwOrderId =
    cleanText(
      metadata.mbw_reference_id ||
      session.client_reference_id ||
      `mbw_${session.id}`,
      180
    );

  const customerDetails =
    session.customer_details || {};

  const totalDetails =
    session.total_details || {};

  const shippingCost =
    session.shipping_cost || {};

  const shippingRate =
    shippingCost.shipping_rate &&
    typeof shippingCost.shipping_rate === "object"
      ? shippingCost.shipping_rate
      : null;

  const promotionCode =
    getStripePromotionCode(session);

  const now =
    new Date().toISOString();

  let insertResult;

  try {
    insertResult =
      await env.DB
        .prepare(
          `INSERT OR IGNORE INTO orders (
             mbw_order_id,
             stripe_mode,
             stripe_session_id,
             stripe_payment_intent_id,
             stripe_customer_id,
             payment_status,
             currency,
             subtotal_cents,
             discount_cents,
             shipping_cents,
             tax_cents,
             total_cents,
             promotion_code,
             customer_email,
             customer_first_name,
             customer_last_name,
             customer_phone,
             shipping_address1,
             shipping_address2,
             shipping_city,
             shipping_region,
             shipping_postal_code,
             shipping_country,
             shipping_method_name,
             shipping_method_code,

             landing_page,
             referrer,

             first_utm_source,
             first_utm_medium,
             first_utm_campaign,
             first_utm_content,
             first_utm_term,

             current_utm_source,
             current_utm_medium,
             current_utm_campaign,
             current_utm_content,
             current_utm_term,

             gclid,
             fbclid,
             attribution_json,

             printify_status,
             fulfillment_status,
             confirmation_email_status,
             shipping_email_status,
             raw_stripe_session_json,
             created_at,
             updated_at
           ) VALUES (
             ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           )`
        )
        .bind(
          mbwOrderId,
          normalizeStripeMode(env.STRIPE_MODE),
          session.id,
          stripeObjectId(
            session.payment_intent
          ),
          stripeObjectId(
            session.customer
          ),
          session.payment_status ||
            "paid",
          String(
            session.currency || "usd"
          ).toLowerCase(),
          Number(
            session.amount_subtotal || 0
          ),
          Number(
            totalDetails.amount_discount || 0
          ),
          Number(
            shippingCost.amount_total || 0
          ),
          Number(
            totalDetails.amount_tax || 0
          ),
          Number(
            session.amount_total || 0
          ),
          promotionCode,
          cleanText(
            customerDetails.email ||
            session.customer_email ||
            metadata.ship_email,
            160
          ),
          cleanText(
            metadata.ship_first_name,
            80
          ),
          cleanText(
            metadata.ship_last_name,
            80
          ),
          cleanText(
            customerDetails.phone ||
            metadata.ship_phone,
            40
          ),
          cleanText(
            metadata.ship_address1,
            160
          ),
          cleanText(
            metadata.ship_address2,
            160
          ),
          cleanText(
            metadata.ship_city,
            100
          ),
          cleanText(
            metadata.ship_region,
            100
          ),
          cleanText(
            metadata.ship_zip,
            40
          ),
          cleanText(
            metadata.ship_country,
            2
          ),
          cleanText(
            shippingRate &&
            shippingRate.display_name
              ? shippingRate.display_name
              : "",
            120
          ),
          cleanText(
            shippingRate &&
            shippingRate.metadata &&
            shippingRate.metadata
              .printify_shipping_method
              ? shippingRate.metadata
                  .printify_shipping_method
              : "",
            40
          ),

          cleanText(
            metadata.landing_page,
            500
          ),
          cleanText(
            metadata.referrer,
            500
          ),

          cleanText(
            metadata.first_utm_source,
            120
          ),
          cleanText(
            metadata.first_utm_medium,
            120
          ),
          cleanText(
            metadata.first_utm_campaign,
            180
          ),
          cleanText(
            metadata.first_utm_content,
            180
          ),
          cleanText(
            metadata.first_utm_term,
            180
          ),

          cleanText(
            metadata.current_utm_source,
            120
          ),
          cleanText(
            metadata.current_utm_medium,
            120
          ),
          cleanText(
            metadata.current_utm_campaign,
            180
          ),
          cleanText(
            metadata.current_utm_content,
            180
          ),
          cleanText(
            metadata.current_utm_term,
            180
          ),

          cleanText(
            metadata.gclid,
            250
          ),
          cleanText(
            metadata.fbclid,
            250
          ),
          JSON.stringify({
            landing_page:
              cleanText(metadata.landing_page, 500),
            referrer:
              cleanText(metadata.referrer, 500),

            first_utm_source:
              cleanText(metadata.first_utm_source, 120),
            first_utm_medium:
              cleanText(metadata.first_utm_medium, 120),
            first_utm_campaign:
              cleanText(metadata.first_utm_campaign, 180),
            first_utm_content:
              cleanText(metadata.first_utm_content, 180),
            first_utm_term:
              cleanText(metadata.first_utm_term, 180),

            current_utm_source:
              cleanText(metadata.current_utm_source, 120),
            current_utm_medium:
              cleanText(metadata.current_utm_medium, 120),
            current_utm_campaign:
              cleanText(metadata.current_utm_campaign, 180),
            current_utm_content:
              cleanText(metadata.current_utm_content, 180),
            current_utm_term:
              cleanText(metadata.current_utm_term, 180),

            gclid:
              cleanText(metadata.gclid, 250),
            fbclid:
              cleanText(metadata.fbclid, 250)
          }),

          "pending",
          "pending",
          "pending",
          "pending",
          JSON.stringify(session),
          now,
          now
        )
        .run();
  } catch (error) {
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error:
          "Unable to save Stripe order to D1",
        detail:
          cleanText(
            error && error.message
              ? error.message
              : String(error),
            300
          )
      }
    };
  }

  if (
    !insertResult ||
    !insertResult.meta ||
    Number(insertResult.meta.changes || 0) === 0
  ) {
    const duplicate =
      await env.DB
        .prepare(
          `SELECT
             mbw_order_id,
             fulfillment_status
           FROM orders
           WHERE stripe_session_id = ?
           LIMIT 1`
        )
        .bind(session.id)
        .first();

    return {
      ok: true,
      duplicate: true,
      mbw_order_id:
        duplicate &&
        duplicate.mbw_order_id
          ? duplicate.mbw_order_id
          : mbwOrderId,
      fulfillment_status:
        duplicate &&
        duplicate.fulfillment_status
          ? duplicate.fulfillment_status
          : "pending"
    };
  }

  const order =
    await env.DB
      .prepare(
        `SELECT id
         FROM orders
         WHERE stripe_session_id = ?
         LIMIT 1`
      )
      .bind(session.id)
      .first();

  if (!order || !order.id) {
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error:
          "Order was saved but could not be reloaded"
      }
    };
  }

  const metadataItems =
    parseMbwMetadataItems(
      metadata.mbw_items
    );

  const itemStatements = [];

  stripeLineItems.forEach(
    (lineItem, index) => {
      const product =
        lineItem &&
        lineItem.price &&
        lineItem.price.product &&
        typeof lineItem.price.product === "object"
          ? lineItem.price.product
          : {};

      const productMetadata =
        product.metadata || {};

      const fallbackMeta =
        metadataItems[index] || {};

      const quantity =
        Number(lineItem.quantity || 1);

      const unitAmount =
        lineItem.price &&
        Number.isFinite(
          Number(lineItem.price.unit_amount)
        )
          ? Number(lineItem.price.unit_amount)
          : quantity > 0
            ? Math.round(
                Number(
                  lineItem.amount_subtotal || 0
                ) / quantity
              )
            : 0;

      const lineTotal =
        Number(
          lineItem.amount_subtotal || 0
        );

      itemStatements.push(
        env.DB
          .prepare(
            `INSERT INTO order_items (
               order_id,
               printify_product_id,
               printify_variant_id,
               product_title,
               variant_label,
               quantity,
               unit_amount_cents,
               line_total_cents,
               image_url,
               created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            order.id,
            cleanText(
              productMetadata
                .printify_product_id ||
              fallbackMeta.p,
              120
            ),
            Number(
              productMetadata
                .printify_variant_id ||
              fallbackMeta.v ||
              0
            ),
            cleanText(
              product.name ||
              lineItem.description ||
              "Mindo Bird Watching product",
              300
            ),
            cleanText(
              product.description || "",
              300
            ),
            quantity,
            unitAmount,
            lineTotal,
            Array.isArray(product.images) &&
            product.images.length > 0
              ? cleanText(
                  product.images[0],
                  1000
                )
              : "",
            now
          )
      );
    }
  );

  if (itemStatements.length > 0) {
    try {
      await env.DB.batch(
        itemStatements
      );
    } catch (error) {
      await env.DB
        .prepare(
          "DELETE FROM orders WHERE id = ?"
        )
        .bind(order.id)
        .run();

      return {
        ok: false,
        status: 500,
        body: {
          ok: false,
          error:
            "Unable to save order items to D1",
          detail:
            cleanText(
              error && error.message
                ? error.message
                : String(error),
              300
            )
        }
      };
    }
  }

  return {
    ok: true,
    duplicate: false,
    mbw_order_id: mbwOrderId,
    fulfillment_status: "pending"
  };
}



async function sendCustomerOrderConfirmation(
  env,
  stripeSessionId
) {
  if (
    !env.RESEND_API_KEY ||
    !env.MBW_ORDER_FROM_EMAIL
  ) {
    return {
      ok: false,
      status: "failed",
      error:
        "Resend customer email configuration is incomplete"
    };
  }

  const order =
    await env.DB
      .prepare(
        `SELECT
           id,
           mbw_order_id,
           stripe_mode,
           stripe_session_id,
           payment_status,
           currency,
           subtotal_cents,
           discount_cents,
           shipping_cents,
           tax_cents,
           total_cents,
           promotion_code,
           customer_email,
           customer_first_name,
           customer_last_name,
           customer_phone,
           shipping_address1,
           shipping_address2,
           shipping_city,
           shipping_region,
           shipping_postal_code,
           shipping_country,
           shipping_method_name,
           shipping_method_code,
           confirmation_email_status,
           updated_at
         FROM orders
         WHERE stripe_session_id = ?
         LIMIT 1`
      )
      .bind(stripeSessionId)
      .first();

  if (!order || !order.id) {
    return {
      ok: false,
      status: "failed",
      error:
        "Saved order could not be loaded for customer email"
    };
  }

  if (!order.customer_email) {
    await markCustomerEmailFailed(
      env,
      order.id,
      "Customer email is missing"
    );

    return {
      ok: false,
      status: "failed",
      error:
        "Customer email is missing"
    };
  }

  if (
    order.confirmation_email_status ===
    "sent"
  ) {
    return {
      ok: true,
      status: "sent",
      duplicate: true
    };
  }

  const now =
    new Date().toISOString();

  const staleBefore =
    new Date(
      Date.now() - 10 * 60 * 1000
    ).toISOString();

  const claim =
    await env.DB
      .prepare(
        `UPDATE orders
         SET
           confirmation_email_status = 'sending',
           updated_at = ?
         WHERE id = ?
           AND (
             confirmation_email_status IS NULL
             OR confirmation_email_status = ''
             OR confirmation_email_status = 'pending'
             OR confirmation_email_status = 'failed'
             OR (
               confirmation_email_status = 'sending'
               AND updated_at < ?
             )
           )`
      )
      .bind(
        now,
        order.id,
        staleBefore
      )
      .run();

  const claimed =
    claim &&
    claim.meta &&
    Number(claim.meta.changes || 0) > 0;

  if (!claimed) {
    const current =
      await env.DB
        .prepare(
          `SELECT confirmation_email_status
           FROM orders
           WHERE id = ?
           LIMIT 1`
        )
        .bind(order.id)
        .first();

    if (
      current &&
      current.confirmation_email_status ===
      "sent"
    ) {
      return {
        ok: true,
        status: "sent",
        duplicate: true
      };
    }

    return {
      ok: true,
      status:
        current &&
        current.confirmation_email_status
          ? current.confirmation_email_status
          : "sending",
      duplicate: true
    };
  }

  const items =
    await env.DB
      .prepare(
        `SELECT
           printify_product_id,
           printify_variant_id,
           product_title,
           variant_label,
           quantity,
           unit_amount_cents,
           line_total_cents,
           image_url
         FROM order_items
         WHERE order_id = ?
         ORDER BY id ASC`
      )
      .bind(order.id)
      .all();

  const orderItems =
    items &&
    Array.isArray(items.results)
      ? items.results
      : [];

  const subject =
    `Your Mindo Bird Watching order is confirmed - ${order.mbw_order_id}`;

  const html =
    buildCustomerOrderEmailHtml(
      order,
      orderItems
    );

  const text =
    buildCustomerOrderEmailText(
      order,
      orderItems
    );

  let response;
  let data;

  try {
    response =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            "Authorization":
              `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type":
              "application/json",
            "Idempotency-Key":
              `mbw-customer-${order.mbw_order_id}`
          },
          body: JSON.stringify({
            from:
              `Mindo Bird Watching <${env.MBW_ORDER_FROM_EMAIL}>`,
            to: [
              order.customer_email
            ],
            reply_to:
              env.MBW_ADMIN_ORDER_EMAIL ||
              env.MBW_ORDER_FROM_EMAIL,
            subject,
            html,
            text
          })
        }
      );

    data =
      await response
        .json()
        .catch(() => ({}));
  } catch (error) {
    const message =
      cleanText(
        error && error.message
          ? error.message
          : String(error),
        500
      );

    await markCustomerEmailFailed(
      env,
      order.id,
      message
    );

    return {
      ok: false,
      status: "failed",
      error: message
    };
  }

  if (!response.ok) {
    const message =
      cleanText(
        data &&
        (data.message || data.error)
          ? data.message || data.error
          : `Resend returned HTTP ${response.status}`,
        500
      );

    await markCustomerEmailFailed(
      env,
      order.id,
      message
    );

    return {
      ok: false,
      status: "failed",
      error: message
    };
  }

  const sentAt =
    new Date().toISOString();

  await env.DB
    .prepare(
      `UPDATE orders
       SET
         confirmation_email_status = 'sent',
         updated_at = ?
       WHERE id = ?`
    )
    .bind(
      sentAt,
      order.id
    )
    .run();

  return {
    ok: true,
    status: "sent",
    duplicate: false,
    resend_email_id:
      data && data.id
        ? data.id
        : null
  };
}

async function markCustomerEmailFailed(
  env,
  orderId,
  message
) {
  const now =
    new Date().toISOString();

  console.error(
    "Customer order confirmation email failed:",
    cleanText(message, 500)
  );

  await env.DB
    .prepare(
      `UPDATE orders
       SET
         confirmation_email_status = 'failed',
         updated_at = ?
       WHERE id = ?`
    )
    .bind(
      now,
      orderId
    )
    .run();
}

function buildCustomerOrderEmailHtml(
  order,
  items
) {
  const currency =
    String(order.currency || "usd")
      .toUpperCase();

  const firstName =
    cleanText(
      order.customer_first_name ||
      "there",
      80
    );

  const addressLines = [
    order.shipping_address1,
    order.shipping_address2,
    [
      order.shipping_city,
      order.shipping_region,
      order.shipping_postal_code
    ]
      .filter(Boolean)
      .join(", "),
    order.shipping_country
  ]
    .filter(Boolean)
    .map(escapeEmailHtml)
    .join("<br>");

  const itemRows =
    (items || [])
      .map((item) => {
        const variant =
          item.variant_label
            ? `<div style="font-size:12px;line-height:18px;color:#667085;margin-top:3px;">${escapeEmailHtml(item.variant_label)}</div>`
            : "";

        const image =
          item.image_url
            ? `<td width="58" valign="top" style="padding:14px 14px 14px 0;border-bottom:1px solid #E7ECE8;">
                 <img src="${escapeEmailHtml(item.image_url)}" width="54" height="54" alt="" style="display:block;width:54px;height:54px;object-fit:cover;border-radius:9px;border:1px solid #E7ECE8;">
               </td>`
            : "";

        return `
          <tr>
            ${image}
            <td style="padding:14px 0;border-bottom:1px solid #E7ECE8;vertical-align:top;">
              <div style="font-size:14px;line-height:20px;font-weight:800;color:#173A24;">
                ${escapeEmailHtml(item.product_title || "MBW Shop product")}
              </div>
              ${variant}
              <div style="font-size:12px;line-height:18px;color:#667085;margin-top:5px;">
                Qty ${Number(item.quantity || 0)} x ${formatEmailMoney(item.unit_amount_cents, currency)}
              </div>
            </td>
            <td align="right" style="padding:14px 0 14px 16px;border-bottom:1px solid #E7ECE8;vertical-align:top;font-size:14px;line-height:20px;font-weight:800;color:#173A24;white-space:nowrap;">
              ${formatEmailMoney(item.line_total_cents, currency)}
            </td>
          </tr>`;
      })
      .join("");

  const promoRow =
    Number(order.discount_cents || 0) > 0
      ? `
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#475467;">
            Discount${order.promotion_code ? ` (${escapeEmailHtml(order.promotion_code)})` : ""}
          </td>
          <td align="right" style="padding:5px 0;font-size:13px;color:#475467;">
            -${formatEmailMoney(order.discount_cents, currency)}
          </td>
        </tr>`
      : "";

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F3F7F1;font-family:Arial,Helvetica,sans-serif;color:#173A24;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F3F7F1;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#FFFFFF;border:1px solid #DDE7DE;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:24px 26px;background:#0D5925;color:#FFFFFF;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:12px;">
                    <img src="https://mindobirdwatching.com/assets/images/logo/mbw-logo-mark-1024.png" width="46" height="46" alt="Mindo Bird Watching" style="display:block;width:46px;height:46px;border-radius:50%;background:#FFFFFF;">
                  </td>
                  <td valign="middle">
                    <div style="font-size:12px;line-height:18px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Mindo Bird Watching Shop</div>
                    <div style="font-size:25px;line-height:31px;font-weight:800;margin-top:2px;">Order confirmed</div>
                  </td>
                </tr>
              </table>
              <div style="font-size:13px;line-height:20px;margin-top:12px;opacity:.92;">
                Hi ${escapeEmailHtml(firstName)}, your payment was received successfully.
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 26px;">
              <div style="font-size:13px;line-height:20px;color:#475467;">
                Thank you for shopping with Mindo Bird Watching. We have received your order and will prepare it for fulfillment.
              </div>

              <div style="margin-top:18px;padding:13px 15px;border-radius:12px;background:#F5F9F4;border:1px solid #DDE7DE;">
                <div style="font-size:11px;line-height:17px;color:#667085;text-transform:uppercase;letter-spacing:.06em;font-weight:800;">Order ID</div>
                <div style="font-size:13px;line-height:20px;font-weight:800;color:#0D5925;word-break:break-all;margin-top:3px;">${escapeEmailHtml(order.mbw_order_id)}</div>
              </div>

              <div style="height:22px;"></div>

              <div style="font-size:17px;line-height:24px;font-weight:800;color:#173A24;">Your order</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:6px;">
                ${itemRows || `<tr><td style="padding:14px 0;color:#667085;">No line items were found.</td></tr>`}
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#475467;">Subtotal</td>
                  <td align="right" style="padding:5px 0;font-size:13px;color:#475467;">${formatEmailMoney(order.subtotal_cents, currency)}</td>
                </tr>
                ${promoRow}
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#475467;">Shipping</td>
                  <td align="right" style="padding:5px 0;font-size:13px;color:#475467;">${formatEmailMoney(order.shipping_cents, currency)}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#475467;">Tax</td>
                  <td align="right" style="padding:5px 0;font-size:13px;color:#475467;">${formatEmailMoney(order.tax_cents, currency)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;border-top:1px solid #DDE7DE;font-size:15px;font-weight:800;color:#173A24;">Total paid</td>
                  <td align="right" style="padding:12px 0 0;border-top:1px solid #DDE7DE;font-size:17px;font-weight:800;color:#0D5925;">${formatEmailMoney(order.total_cents, currency)}</td>
                </tr>
              </table>

              <div style="height:24px;"></div>

              <div style="font-size:15px;line-height:22px;font-weight:800;color:#173A24;">Delivery details</div>
              <div style="font-size:13px;line-height:20px;color:#475467;margin-top:8px;">
                ${addressLines || "-"}<br>
                <strong style="color:#0D5925;">${escapeEmailHtml(order.shipping_method_name || "Shipping method")}</strong>
              </div>

              <div style="margin-top:24px;padding:14px 16px;border-radius:12px;background:#F5F9F4;border:1px solid #DDE7DE;font-size:13px;line-height:20px;color:#475467;">
                <strong style="color:#173A24;">What happens next?</strong><br>
                We will prepare your order for fulfillment. Once it ships, we will email you the carrier and tracking information.
              </div>

              <div style="margin-top:20px;font-size:12px;line-height:18px;color:#667085;">
                Questions about your order? Reply to this email and our team will help.
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 26px;background:#F8FAF8;border-top:1px solid #E7ECE8;font-size:12px;line-height:18px;color:#667085;">
              Mindo Bird Watching<br>
              <a href="https://mindobirdwatching.com/shop/" style="color:#0D5925;text-decoration:none;">mindobirdwatching.com/shop</a><br>
              <a href="mailto:${escapeEmailHtml(order.customer_email ? (String(order.customer_email).includes("@mindobirdwatching.com") ? order.customer_email : "notifications@mindobirdwatching.com") : "notifications@mindobirdwatching.com")}" style="color:#0D5925;text-decoration:none;">notifications@mindobirdwatching.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildCustomerOrderEmailText(
  order,
  items
) {
  const currency =
    String(order.currency || "usd")
      .toUpperCase();

  const firstName =
    order.customer_first_name ||
    "there";

  const lines = [
    "MINDO BIRD WATCHING SHOP",
    "ORDER CONFIRMED",
    "",
    `Hi ${firstName},`,
    "",
    "Your payment was received successfully.",
    `Order ID: ${order.mbw_order_id || "-"}`,
    "",
    "YOUR ORDER"
  ];

  (items || []).forEach((item) => {
    lines.push(
      `${Number(item.quantity || 0)} x ${item.product_title || "MBW Shop product"}${item.variant_label ? ` - ${item.variant_label}` : ""} = ${formatEmailMoney(item.line_total_cents, currency)}`
    );
  });

  lines.push(
    "",
    `Subtotal: ${formatEmailMoney(order.subtotal_cents, currency)}`,
    `Discount: ${formatEmailMoney(order.discount_cents, currency)}`,
    `Shipping: ${formatEmailMoney(order.shipping_cents, currency)}`,
    `Tax: ${formatEmailMoney(order.tax_cents, currency)}`,
    `TOTAL PAID: ${formatEmailMoney(order.total_cents, currency)}`,
    "",
    "DELIVERY",
    order.shipping_address1 || "",
    order.shipping_address2 || "",
    [order.shipping_city, order.shipping_region, order.shipping_postal_code].filter(Boolean).join(", "),
    order.shipping_country || "",
    `Shipping method: ${order.shipping_method_name || "-"}`,
    "",
    "WHAT HAPPENS NEXT?",
    "We will prepare your order for fulfillment. Once it ships, we will email you the carrier and tracking information.",
    "",
    "Questions? Reply to this email.",
    "Mindo Bird Watching"
  );

  return lines.join("\n");
}

async function sendAdminOrderConfirmation(
  env,
  stripeSessionId
) {
  if (
    !env.RESEND_API_KEY ||
    !env.MBW_ORDER_FROM_EMAIL ||
    !env.MBW_ADMIN_ORDER_EMAIL
  ) {
    return {
      ok: false,
      status: "failed",
      error:
        "Resend admin email configuration is incomplete"
    };
  }

  const order =
    await env.DB
      .prepare(
        `SELECT
           id,
           mbw_order_id,
           stripe_mode,
           stripe_session_id,
           payment_status,
           currency,
           subtotal_cents,
           discount_cents,
           shipping_cents,
           tax_cents,
           total_cents,
           promotion_code,
           customer_email,
           customer_first_name,
           customer_last_name,
           customer_phone,
           shipping_address1,
           shipping_address2,
           shipping_city,
           shipping_region,
           shipping_postal_code,
           shipping_country,
           shipping_method_name,
           shipping_method_code,
           admin_confirmation_email_status,
           admin_confirmation_email_sent_at,
           updated_at
         FROM orders
         WHERE stripe_session_id = ?
         LIMIT 1`
      )
      .bind(stripeSessionId)
      .first();

  if (!order || !order.id) {
    return {
      ok: false,
      status: "failed",
      error:
        "Saved order could not be loaded for admin email"
    };
  }

  if (
    order.admin_confirmation_email_status ===
    "sent"
  ) {
    return {
      ok: true,
      status: "sent",
      duplicate: true
    };
  }

  const now =
    new Date().toISOString();

  const staleBefore =
    new Date(
      Date.now() - 10 * 60 * 1000
    ).toISOString();

  const claim =
    await env.DB
      .prepare(
        `UPDATE orders
         SET
           admin_confirmation_email_status = 'sending',
           admin_confirmation_email_error = NULL,
           updated_at = ?
         WHERE id = ?
           AND (
             admin_confirmation_email_status IS NULL
             OR admin_confirmation_email_status = ''
             OR admin_confirmation_email_status = 'pending'
             OR admin_confirmation_email_status = 'failed'
             OR (
               admin_confirmation_email_status = 'sending'
               AND updated_at < ?
             )
           )`
      )
      .bind(
        now,
        order.id,
        staleBefore
      )
      .run();

  const claimed =
    claim &&
    claim.meta &&
    Number(claim.meta.changes || 0) > 0;

  if (!claimed) {
    const current =
      await env.DB
        .prepare(
          `SELECT
             admin_confirmation_email_status
           FROM orders
           WHERE id = ?
           LIMIT 1`
        )
        .bind(order.id)
        .first();

    if (
      current &&
      current.admin_confirmation_email_status ===
      "sent"
    ) {
      return {
        ok: true,
        status: "sent",
        duplicate: true
      };
    }

    return {
      ok: true,
      status:
        current &&
        current.admin_confirmation_email_status
          ? current.admin_confirmation_email_status
          : "sending",
      duplicate: true
    };
  }

  const items =
    await env.DB
      .prepare(
        `SELECT
           printify_product_id,
           printify_variant_id,
           product_title,
           variant_label,
           quantity,
           unit_amount_cents,
           line_total_cents,
           image_url
         FROM order_items
         WHERE order_id = ?
         ORDER BY id ASC`
      )
      .bind(order.id)
      .all();

  const orderItems =
    items &&
    Array.isArray(items.results)
      ? items.results
      : [];

  const subject =
    `[MBW Shop] New paid order ${order.mbw_order_id}`;

  const html =
    buildAdminOrderEmailHtml(
      order,
      orderItems
    );

  const text =
    buildAdminOrderEmailText(
      order,
      orderItems
    );

  let response;
  let data;

  try {
    response =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            "Authorization":
              `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type":
              "application/json",
            "Idempotency-Key":
              `mbw-admin-${order.mbw_order_id}`
          },
          body: JSON.stringify({
            from:
              `Mindo Bird Watching <${env.MBW_ORDER_FROM_EMAIL}>`,
            to: [
              env.MBW_ADMIN_ORDER_EMAIL
            ],
            reply_to:
              order.customer_email ||
              env.MBW_ORDER_FROM_EMAIL,
            subject,
            html,
            text
          })
        }
      );

    data =
      await response
        .json()
        .catch(() => ({}));
  } catch (error) {
    const message =
      cleanText(
        error && error.message
          ? error.message
          : String(error),
        500
      );

    await markAdminEmailFailed(
      env,
      order.id,
      message
    );

    return {
      ok: false,
      status: "failed",
      error: message
    };
  }

  if (!response.ok) {
    const message =
      cleanText(
        data &&
        (data.message || data.error)
          ? data.message || data.error
          : `Resend returned HTTP ${response.status}`,
        500
      );

    await markAdminEmailFailed(
      env,
      order.id,
      message
    );

    return {
      ok: false,
      status: "failed",
      error: message
    };
  }

  const sentAt =
    new Date().toISOString();

  await env.DB
    .prepare(
      `UPDATE orders
       SET
         admin_confirmation_email_status = 'sent',
         admin_confirmation_email_sent_at = ?,
         admin_confirmation_email_error = NULL,
         updated_at = ?
       WHERE id = ?`
    )
    .bind(
      sentAt,
      sentAt,
      order.id
    )
    .run();

  return {
    ok: true,
    status: "sent",
    duplicate: false,
    resend_email_id:
      data && data.id
        ? data.id
        : null
  };
}

async function markAdminEmailFailed(
  env,
  orderId,
  message
) {
  const now =
    new Date().toISOString();

  await env.DB
    .prepare(
      `UPDATE orders
       SET
         admin_confirmation_email_status = 'failed',
         admin_confirmation_email_error = ?,
         updated_at = ?
       WHERE id = ?`
    )
    .bind(
      cleanText(message, 500),
      now,
      orderId
    )
    .run();
}

function buildAdminOrderEmailHtml(
  order,
  items
) {
  const currency =
    String(order.currency || "usd")
      .toUpperCase();

  const customerName =
    [
      order.customer_first_name,
      order.customer_last_name
    ]
      .filter(Boolean)
      .join(" ") ||
    "Customer";

  const addressLines = [
    order.shipping_address1,
    order.shipping_address2,
    [
      order.shipping_city,
      order.shipping_region,
      order.shipping_postal_code
    ]
      .filter(Boolean)
      .join(", "),
    order.shipping_country
  ]
    .filter(Boolean)
    .map(escapeEmailHtml)
    .join("<br>");

  const itemRows =
    (items || [])
      .map((item) => {
        const variant =
          item.variant_label
            ? `<div style="font-size:12px;line-height:18px;color:#667085;margin-top:3px;">${escapeEmailHtml(item.variant_label)}</div>`
            : "";

        const ids =
          `<div style="font-size:11px;line-height:17px;color:#98A2B3;margin-top:4px;">Printify product: ${escapeEmailHtml(item.printify_product_id || "-")} &nbsp; Variant: ${escapeEmailHtml(String(item.printify_variant_id || "-"))}</div>`;

        return `
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid #E7ECE8;vertical-align:top;">
              <div style="font-size:14px;line-height:20px;font-weight:800;color:#173A24;">
                ${escapeEmailHtml(item.product_title || "MBW Shop product")}
              </div>
              ${variant}
              ${ids}
              <div style="font-size:12px;line-height:18px;color:#667085;margin-top:5px;">
                Qty ${Number(item.quantity || 0)} x ${formatEmailMoney(item.unit_amount_cents, currency)}
              </div>
            </td>
            <td align="right" style="padding:14px 0 14px 16px;border-bottom:1px solid #E7ECE8;vertical-align:top;font-size:14px;line-height:20px;font-weight:800;color:#173A24;white-space:nowrap;">
              ${formatEmailMoney(item.line_total_cents, currency)}
            </td>
          </tr>`;
      })
      .join("");

  const promoRow =
    Number(order.discount_cents || 0) > 0
      ? `
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#475467;">
            Discount${order.promotion_code ? ` (${escapeEmailHtml(order.promotion_code)})` : ""}
          </td>
          <td align="right" style="padding:5px 0;font-size:13px;color:#475467;">
            -${formatEmailMoney(order.discount_cents, currency)}
          </td>
        </tr>`
      : "";

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F3F7F1;font-family:Arial,Helvetica,sans-serif;color:#173A24;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F3F7F1;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#FFFFFF;border:1px solid #DDE7DE;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:24px 26px;background:#0D5925;color:#FFFFFF;">
              <div style="font-size:12px;line-height:18px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Mindo Bird Watching Shop</div>
              <div style="font-size:26px;line-height:32px;font-weight:800;margin-top:4px;">New paid order</div>
              <div style="font-size:13px;line-height:20px;margin-top:6px;opacity:.9;">Payment has been verified by Stripe and the order is saved in D1.</div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 26px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size:12px;line-height:18px;color:#667085;">MBW order ID</td>
                  <td align="right" style="font-size:12px;line-height:18px;color:#667085;">Stripe mode</td>
                </tr>
                <tr>
                  <td style="padding-top:3px;font-size:14px;line-height:20px;font-weight:800;color:#0D5925;word-break:break-all;">${escapeEmailHtml(order.mbw_order_id)}</td>
                  <td align="right" style="padding-top:3px;font-size:14px;line-height:20px;font-weight:800;color:#173A24;text-transform:uppercase;">${escapeEmailHtml(order.stripe_mode || "")}</td>
                </tr>
              </table>

              <div style="height:22px;"></div>

              <div style="font-size:17px;line-height:24px;font-weight:800;color:#173A24;">Order items</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:6px;">
                ${itemRows || `<tr><td style="padding:14px 0;color:#667085;">No line items were found.</td></tr>`}
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#475467;">Subtotal</td>
                  <td align="right" style="padding:5px 0;font-size:13px;color:#475467;">${formatEmailMoney(order.subtotal_cents, currency)}</td>
                </tr>
                ${promoRow}
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#475467;">Shipping</td>
                  <td align="right" style="padding:5px 0;font-size:13px;color:#475467;">${formatEmailMoney(order.shipping_cents, currency)}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;font-size:13px;color:#475467;">Tax</td>
                  <td align="right" style="padding:5px 0;font-size:13px;color:#475467;">${formatEmailMoney(order.tax_cents, currency)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 0 0;border-top:1px solid #DDE7DE;font-size:15px;font-weight:800;color:#173A24;">Total paid</td>
                  <td align="right" style="padding:12px 0 0;border-top:1px solid #DDE7DE;font-size:17px;font-weight:800;color:#0D5925;">${formatEmailMoney(order.total_cents, currency)}</td>
                </tr>
              </table>

              <div style="height:24px;"></div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="50%" valign="top" style="padding-right:12px;">
                    <div style="font-size:13px;font-weight:800;color:#173A24;">Customer</div>
                    <div style="font-size:13px;line-height:20px;color:#475467;margin-top:7px;">
                      ${escapeEmailHtml(customerName)}<br>
                      ${escapeEmailHtml(order.customer_email || "-")}<br>
                      ${escapeEmailHtml(order.customer_phone || "-")}
                    </div>
                  </td>
                  <td width="50%" valign="top" style="padding-left:12px;">
                    <div style="font-size:13px;font-weight:800;color:#173A24;">Delivery</div>
                    <div style="font-size:13px;line-height:20px;color:#475467;margin-top:7px;">
                      ${addressLines || "-"}<br>
                      <strong>${escapeEmailHtml(order.shipping_method_name || "Shipping method not recorded")}</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <div style="margin-top:24px;padding:14px 16px;border-radius:12px;background:#FFF8DF;border:1px solid #F2D675;font-size:13px;line-height:20px;color:#594A00;">
                <strong>Action required:</strong> This notification confirms payment only. No Printify fulfillment order is created by this Worker version yet.
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 26px;background:#F8FAF8;border-top:1px solid #E7ECE8;font-size:12px;line-height:18px;color:#667085;">
              Mindo Bird Watching<br>
              notifications@mindobirdwatching.com<br>
              mindobirdwatching.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildAdminOrderEmailText(
  order,
  items
) {
  const currency =
    String(order.currency || "usd")
      .toUpperCase();

  const lines = [
    "MINDO BIRD WATCHING SHOP",
    "NEW PAID ORDER",
    "",
    `MBW order ID: ${order.mbw_order_id || "-"}`,
    `Stripe mode: ${order.stripe_mode || "-"}`,
    `Payment status: ${order.payment_status || "-"}`,
    "",
    "ITEMS"
  ];

  (items || []).forEach((item) => {
    lines.push(
      `${Number(item.quantity || 0)} x ${item.product_title || "MBW Shop product"}${item.variant_label ? ` - ${item.variant_label}` : ""} = ${formatEmailMoney(item.line_total_cents, currency)}`
    );
    lines.push(
      `Printify product: ${item.printify_product_id || "-"} | Variant: ${item.printify_variant_id || "-"}`
    );
  });

  lines.push(
    "",
    `Subtotal: ${formatEmailMoney(order.subtotal_cents, currency)}`,
    `Discount: ${formatEmailMoney(order.discount_cents, currency)}`,
    `Shipping: ${formatEmailMoney(order.shipping_cents, currency)}`,
    `Tax: ${formatEmailMoney(order.tax_cents, currency)}`,
    `TOTAL PAID: ${formatEmailMoney(order.total_cents, currency)}`,
    "",
    `Customer: ${[order.customer_first_name, order.customer_last_name].filter(Boolean).join(" ") || "-"}`,
    `Email: ${order.customer_email || "-"}`,
    `Phone: ${order.customer_phone || "-"}`,
    "",
    "Delivery:",
    order.shipping_address1 || "",
    order.shipping_address2 || "",
    [order.shipping_city, order.shipping_region, order.shipping_postal_code].filter(Boolean).join(", "),
    order.shipping_country || "",
    `Shipping method: ${order.shipping_method_name || "-"}`,
    "",
    "ACTION REQUIRED:",
    "Payment is confirmed, but this Worker version does not create the Printify fulfillment order yet."
  );

  return lines
    .filter((line, index, array) => {
      if (line !== "") {
        return true;
      }
      return index === 0 ||
        array[index - 1] !== "";
    })
    .join("\n");
}

function formatEmailMoney(
  cents,
  currency
) {
  const value =
    Number(cents || 0) / 100;

  const code =
    String(currency || "USD")
      .toUpperCase();

  try {
    return new Intl.NumberFormat(
      "en-US",
      {
        style: "currency",
        currency: code
      }
    ).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function escapeEmailHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripeObjectId(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    value.id
  ) {
    return value.id;
  }

  return null;
}

function parseMbwMetadataItems(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function getStripePromotionCode(session) {
  if (
    !Array.isArray(session.discounts) ||
    session.discounts.length === 0
  ) {
    return null;
  }

  for (const discount of session.discounts) {
    if (!discount) {
      continue;
    }

    const promotion =
      discount.promotion_code;

    if (
      promotion &&
      typeof promotion === "object" &&
      promotion.code
    ) {
      return cleanText(
        promotion.code,
        120
      );
    }
  }

  return null;
}


async function handleOrderConfirmation(
  request,
  env,
  url
) {
  if (!env.DB) {
    return jsonResponse(
      {
        ok: false,
        error:
          "D1 binding DB is not configured"
      },
      500,
      request
    );
  }

  const sessionId =
    cleanText(
      url.searchParams.get("session_id"),
      255
    );

  if (
    !sessionId ||
    !/^cs_(test|live)_[A-Za-z0-9]+$/.test(
      sessionId
    )
  ) {
    return jsonResponse(
      {
        ok: false,
        error:
          "A valid Stripe Checkout Session ID is required"
      },
      400,
      request
    );
  }

  const order =
    await env.DB
      .prepare(
        `SELECT
           id,
           mbw_order_id,
           stripe_mode,
           stripe_session_id,
           payment_status,
           currency,

           subtotal_cents,
           discount_cents,
           shipping_cents,
           tax_cents,
           total_cents,
           promotion_code,

           customer_email,
           customer_first_name,
           customer_last_name,
           customer_phone,

           shipping_address1,
           shipping_address2,
           shipping_city,
           shipping_region,
           shipping_postal_code,
           shipping_country,

           shipping_method_name,
           shipping_method_code,

           fulfillment_status,
           printify_status,
           tracking_number,
           tracking_url,
           carrier,

           created_at,
           updated_at
         FROM orders
         WHERE stripe_session_id = ?
         LIMIT 1`
      )
      .bind(sessionId)
      .first();

  if (!order) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Order confirmation is not available yet",
        retryable: true
      },
      404,
      request
    );
  }

  if (order.payment_status !== "paid") {
    return jsonResponse(
      {
        ok: false,
        error:
          "This order is not marked as paid"
      },
      409,
      request
    );
  }

  const itemResult =
    await env.DB
      .prepare(
        `SELECT
           printify_product_id,
           printify_variant_id,
           product_title,
           variant_label,
           quantity,
           unit_amount_cents,
           line_total_cents,
           image_url
         FROM order_items
         WHERE order_id = ?
         ORDER BY id ASC`
      )
      .bind(order.id)
      .all();

  const items =
    itemResult &&
    Array.isArray(itemResult.results)
      ? itemResult.results
      : [];

  return jsonResponse(
    {
      ok: true,
      order: {
        mbw_order_id:
          order.mbw_order_id,
        stripe_mode:
          order.stripe_mode,
        payment_status:
          order.payment_status,
        currency:
          order.currency,

        subtotal_cents:
          Number(order.subtotal_cents || 0),
        discount_cents:
          Number(order.discount_cents || 0),
        shipping_cents:
          Number(order.shipping_cents || 0),
        tax_cents:
          Number(order.tax_cents || 0),
        total_cents:
          Number(order.total_cents || 0),
        promotion_code:
          order.promotion_code || "",

        customer: {
          email:
            order.customer_email || "",
          first_name:
            order.customer_first_name || "",
          last_name:
            order.customer_last_name || "",
          phone:
            order.customer_phone || ""
        },

        shipping_address: {
          address1:
            order.shipping_address1 || "",
          address2:
            order.shipping_address2 || "",
          city:
            order.shipping_city || "",
          region:
            order.shipping_region || "",
          postal_code:
            order.shipping_postal_code || "",
          country:
            order.shipping_country || ""
        },

        shipping_method: {
          name:
            order.shipping_method_name || "",
          code:
            order.shipping_method_code || ""
        },

        fulfillment_status:
          order.fulfillment_status || "pending",
        printify_status:
          order.printify_status || "",
        tracking: {
          carrier:
            order.carrier || "",
          number:
            order.tracking_number || "",
          url:
            order.tracking_url || ""
        },

        created_at:
          order.created_at,
        updated_at:
          order.updated_at,

        items: items.map((item) => ({
          printify_product_id:
            item.printify_product_id,
          printify_variant_id:
            Number(item.printify_variant_id || 0),
          product_title:
            item.product_title,
          variant_label:
            item.variant_label || "",
          quantity:
            Number(item.quantity || 0),
          unit_amount_cents:
            Number(item.unit_amount_cents || 0),
          line_total_cents:
            Number(item.line_total_cents || 0),
          image_url:
            item.image_url || ""
        }))
      }
    },
    200,
    request
  );
}


async function handleCheckoutSession(
  request,
  env
) {
  const originError =
    validateWriteOrigin(request);

  if (originError) {
    return jsonResponse(
      originError,
      403,
      request
    );
  }

  const stripeSecretKey =
    getStripeSecretKey(env);

  if (!stripeSecretKey) {
    const stripeMode =
      normalizeStripeMode(env.STRIPE_MODE);

    return jsonResponse(
      {
        ok: false,
        error:
          stripeMode === "test"
            ? "STRIPE_TEST_SECRET_KEY is not configured"
            : "STRIPE_SECRET_KEY is not configured"
      },
      500,
      request
    );
  }

  const parsed = await parseCheckoutRequest(
    request,
    env
  );

  if (!parsed.ok) {
    return jsonResponse(
      parsed.body,
      parsed.status,
      request
    );
  }

  const shippingResult =
    await fetchPrintifyShippingQuote(
      env,
      parsed.printifyLineItems,
      parsed.address
    );

  if (!shippingResult.ok) {
    return jsonResponse(
      shippingResult.body,
      shippingResult.status,
      request
    );
  }

  const shippingOptions =
    normalizeShippingOptions(
      shippingResult.shipping
    );

  if (shippingOptions.length === 0) {
    return jsonResponse(
      {
        ok: false,
        error:
          "No shipping method is available for this address"
      },
      400,
      request
    );
  }

  const referenceId =
    `mbw_${crypto.randomUUID()}`;

  const stripeResult =
    await createStripeCheckoutSession(
      env,
      {
        referenceId,
        items: parsed.items,
        address: parsed.address,
        attribution: parsed.attribution,
        shippingOptions
      }
    );

  if (!stripeResult.ok) {
    return jsonResponse(
      stripeResult.body,
      stripeResult.status,
      request
    );
  }

  return jsonResponse(
    {
      ok: true,
      session_id: stripeResult.session.id,
      checkout_url: stripeResult.session.url,
      reference_id: referenceId,
      stripe_mode:
        normalizeStripeMode(env.STRIPE_MODE)
    },
    200,
    request
  );
}

async function handleShippingQuote(
  request,
  env
) {
  const originError =
    validateWriteOrigin(request);

  if (originError) {
    return jsonResponse(
      originError,
      403,
      request
    );
  }

  const parsed = await parseCheckoutRequest(
    request,
    env
  );

  if (!parsed.ok) {
    return jsonResponse(
      parsed.body,
      parsed.status,
      request
    );
  }

  const shippingResult =
    await fetchPrintifyShippingQuote(
      env,
      parsed.printifyLineItems,
      parsed.address
    );

  if (!shippingResult.ok) {
    return jsonResponse(
      shippingResult.body,
      shippingResult.status,
      request
    );
  }

  const shippingOptions =
    normalizeShippingOptions(
      shippingResult.shipping
    );

  return jsonResponse(
    {
      ok: true,
      currency: "usd",
      subtotal: parsed.subtotal,
      shipping_options: shippingOptions
    },
    200,
    request
  );
}

async function parseCheckoutRequest(
  request,
  env
) {
  const configError =
    validatePrintifyConfig(env, true);

  if (configError) {
    return {
      ok: false,
      status: 500,
      body: configError
    };
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: "Invalid JSON request body"
      }
    };
  }

  const rawItems = Array.isArray(body.items)
    ? body.items
    : [];

  if (
    rawItems.length === 0 ||
    rawItems.length > 25
  ) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error:
          "Cart must contain between 1 and 25 items"
      }
    };
  }

  const addressResult =
    normalizeCheckoutAddress(body.address);

  const attribution =
    normalizeAttribution(body.attribution);

  if (!addressResult.ok) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error: addressResult.error
      }
    };
  }

  const catalogResult =
    await fetchPrintifyProducts(env);

  if (!catalogResult.ok) {
    return catalogResult;
  }

  const productMap = new Map(
    catalogResult.products.map((product) => [
      String(product.id),
      product
    ])
  );

  const trustedItems = [];
  const printifyLineItems = [];
  let subtotal = 0;

  for (const rawItem of rawItems) {
    const productId =
      String(rawItem.product_id || "").trim();

    const variantId =
      Number(rawItem.variant_id);

    const quantity =
      Number(rawItem.quantity);

    if (
      !productId ||
      !Number.isInteger(variantId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      return {
        ok: false,
        status: 400,
        body: {
          ok: false,
          error:
            "Each cart item requires a valid product_id, variant_id, and quantity from 1 to 20"
        }
      };
    }

    const product =
      productMap.get(productId);

    if (
      !product ||
      product.visible === false
    ) {
      return {
        ok: false,
        status: 400,
        body: {
          ok: false,
          error:
            "A product in the cart is no longer available"
        }
      };
    }

    const variant =
      getEnabledVariants(product).find(
        (item) =>
          Number(item.id) === variantId
      );

    if (!variant) {
      return {
        ok: false,
        status: 400,
        body: {
          ok: false,
          error:
            "A selected product option is no longer available"
        }
      };
    }

    const unitAmount =
      Number(variant.price);

    if (
      !Number.isInteger(unitAmount) ||
      unitAmount < 0
    ) {
      return {
        ok: false,
        status: 500,
        body: {
          ok: false,
          error:
            "Unable to verify the current product price"
        }
      };
    }

    const optionLabels =
      describeVariantOptions(
        product,
        variant
      );

    const image =
      getVariantImage(
        product,
        variant.id
      );

    trustedItems.push({
      product_id: product.id,
      variant_id: variant.id,
      quantity,
      unit_amount: unitAmount,
      title:
        product.title ||
        "Mindo Bird Watching product",
      variant_label:
        optionLabels || variant.title || "",
      image
    });

    printifyLineItems.push({
      product_id: product.id,
      variant_id: variant.id,
      quantity
    });

    subtotal +=
      unitAmount * quantity;
  }

  return {
    ok: true,
    items: trustedItems,
    printifyLineItems,
    address: addressResult.address,
    attribution,
    subtotal
  };
}

function normalizeAttribution(raw) {
  const data =
    raw && typeof raw === "object"
      ? raw
      : {};

  return {
    landing_page:
      cleanText(data.landing_page, 500),
    referrer:
      cleanText(data.referrer, 500),

    first_utm_source:
      cleanText(data.first_utm_source, 120),
    first_utm_medium:
      cleanText(data.first_utm_medium, 120),
    first_utm_campaign:
      cleanText(data.first_utm_campaign, 180),
    first_utm_content:
      cleanText(data.first_utm_content, 180),
    first_utm_term:
      cleanText(data.first_utm_term, 180),

    current_utm_source:
      cleanText(data.current_utm_source, 120),
    current_utm_medium:
      cleanText(data.current_utm_medium, 120),
    current_utm_campaign:
      cleanText(data.current_utm_campaign, 180),
    current_utm_content:
      cleanText(data.current_utm_content, 180),
    current_utm_term:
      cleanText(data.current_utm_term, 180),

    gclid:
      cleanText(data.gclid, 250),
    fbclid:
      cleanText(data.fbclid, 250)
  };
}

function normalizeCheckoutAddress(raw) {
  const address =
    raw && typeof raw === "object"
      ? raw
      : {};

  const normalized = {
    first_name:
      cleanText(address.first_name, 80),
    last_name:
      cleanText(address.last_name, 80),
    email:
      cleanText(address.email, 160),
    phone:
      cleanText(address.phone, 40),
    country:
      cleanText(address.country, 2)
        .toUpperCase(),
    region:
      cleanText(address.region, 100),
    address1:
      cleanText(address.address1, 160),
    address2:
      cleanText(address.address2, 160),
    city:
      cleanText(address.city, 100),
    zip:
      cleanText(address.zip, 40)
  };

  const required = [
    "first_name",
    "last_name",
    "email",
    "country",
    "address1",
    "city",
    "zip"
  ];

  for (const key of required) {
    if (!normalized[key]) {
      return {
        ok: false,
        error:
          `Shipping address is missing ${key}`
      };
    }
  }

  if (
    normalized.country === "US" &&
    normalized.region
  ) {
    normalized.region =
      normalized.region.toUpperCase();
  }

  if (
    !/^[A-Z]{2}$/.test(normalized.country)
  ) {
    return {
      ok: false,
      error:
        "Shipping country must be a two-letter country code"
    };
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalized.email
    )
  ) {
    return {
      ok: false,
      error:
        "A valid email address is required"
    };
  }

  return {
    ok: true,
    address: normalized
  };
}

async function fetchPrintifyShippingQuote(
  env,
  lineItems,
  address
) {
  const shopId =
    String(env.PRINTIFY_SHOP_ID).trim();

  let response;

  try {
    response = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/orders/shipping.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${env.PRINTIFY_API_TOKEN}`,
          Accept: "application/json",
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          line_items: lineItems.map(
            (item, index) => ({
              product_id: item.product_id,
              variant_id: item.variant_id,
              quantity: item.quantity,
              external_id:
                `mbw-line-${index + 1}`
            })
          ),
          address_to:
            buildPrintifyShippingAddress(
              address
            )
        })
      }
    );
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          "Unable to contact Printify for shipping"
      }
    };
  }

  let data;

  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          "Printify returned an invalid shipping response"
      }
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        error:
          extractPrintifyError(
            data,
            "Unable to calculate shipping for this address"
          )
      }
    };
  }

  return {
    ok: true,
    status: 200,
    shipping: data
  };
}

function buildPrintifyShippingAddress(
  address
) {
  const result = {
    first_name: address.first_name,
    last_name: address.last_name,
    email: address.email,
    country: address.country,
    region: address.region,
    address1: address.address1,
    city: address.city,
    zip: address.zip
  };

  /*
    Do not send empty optional values to Printify.
    Some validation layers treat an empty phone or
    address2 as an invalid supplied value rather than
    an omitted optional value.
  */
  if (address.phone) {
    result.phone = address.phone;
  }

  if (address.address2) {
    result.address2 = address.address2;
  }

  return result;
}

function normalizeShippingOptions(raw) {
  const definitions = [
    {
      key: "economy",
      label: "Economy shipping",
      method: 4
    },
    {
      key: "standard",
      label: "Standard shipping",
      method: 1
    },
    {
      key: "priority",
      label: "Priority shipping",
      method: 2
    },
    {
      key: "express",
      label: "Express shipping",
      method: 2
    },
    {
      key: "printify_express",
      label: "Printify Express",
      method: 3
    }
  ];

  const seen = new Set();
  const result = [];

  definitions.forEach((definition) => {
    const amount =
      Number(raw && raw[definition.key]);

    if (
      !Number.isInteger(amount) ||
      amount < 0
    ) {
      return;
    }

    /*
      Printify's transitional shipping API can
      expose overlapping names. Avoid showing two
      identical method/price choices.
    */
    const signature =
      `${definition.method}:${amount}`;

    if (seen.has(signature)) {
      return;
    }

    seen.add(signature);

    result.push({
      code: definition.key,
      display_name: definition.label,
      amount,
      shipping_method:
        definition.method
    });
  });

  return result.slice(0, 5);
}

async function createStripeCheckoutSession(
  env,
  data
) {
  const params = new URLSearchParams();

  params.set("mode", "payment");
  params.set(
    "success_url",
    "https://mindobirdwatching.com/shop/order-confirmation/?session_id={CHECKOUT_SESSION_ID}"
  );
  params.set(
    "cancel_url",
    "https://mindobirdwatching.com/shop/?checkout=cancelled"
  );
  params.set(
    "client_reference_id",
    data.referenceId
  );
  params.set(
    "customer_email",
    data.address.email
  );
  params.set(
    "submit_type",
    "pay"
  );

  /*
    MBW storefront prices, shipping, and customer-facing
    totals are intentionally USD-only.
  */
  params.set(
    "adaptive_pricing[enabled]",
    "false"
  );

  /*
    Allow MBW customers to enter Stripe promotion codes
    directly on hosted Checkout. Stripe validates and
    records the discount server-side.
  */
  params.set(
    "allow_promotion_codes",
    "true"
  );

  data.items.forEach((item, index) => {
    const prefix =
      `line_items[${index}]`;

    params.set(
      `${prefix}[quantity]`,
      String(item.quantity)
    );
    params.set(
      `${prefix}[price_data][currency]`,
      "usd"
    );
    params.set(
      `${prefix}[price_data][unit_amount]`,
      String(item.unit_amount)
    );
    params.set(
      `${prefix}[price_data][product_data][name]`,
      item.title
    );

    if (item.variant_label) {
      params.set(
        `${prefix}[price_data][product_data][description]`,
        item.variant_label
      );
    }

    if (item.image) {
      params.set(
        `${prefix}[price_data][product_data][images][0]`,
        item.image
      );
    }

    params.set(
      `${prefix}[price_data][product_data][metadata][printify_product_id]`,
      String(item.product_id)
    );
    params.set(
      `${prefix}[price_data][product_data][metadata][printify_variant_id]`,
      String(item.variant_id)
    );
  });

  data.shippingOptions.forEach(
    (option, index) => {
      const prefix =
        `shipping_options[${index}][shipping_rate_data]`;

      params.set(
        `${prefix}[type]`,
        "fixed_amount"
      );
      params.set(
        `${prefix}[display_name]`,
        option.display_name
      );
      params.set(
        `${prefix}[fixed_amount][amount]`,
        String(option.amount)
      );
      params.set(
        `${prefix}[fixed_amount][currency]`,
        "usd"
      );
      params.set(
        `${prefix}[metadata][printify_shipping_code]`,
        option.code
      );
      params.set(
        `${prefix}[metadata][printify_shipping_method]`,
        String(option.shipping_method)
      );
    }
  );

  /*
    These metadata fields give the future Stripe
    webhook enough verified information to create
    the Printify order without trusting the browser
    after payment.
  */
  params.set(
    "metadata[mbw_reference_id]",
    data.referenceId
  );
  params.set(
    "metadata[mbw_items]",
    JSON.stringify(
      data.items.map((item) => ({
        p: String(item.product_id),
        v: Number(item.variant_id),
        q: Number(item.quantity)
      }))
    )
  );
  params.set(
    "metadata[ship_first_name]",
    data.address.first_name
  );
  params.set(
    "metadata[ship_last_name]",
    data.address.last_name
  );
  params.set(
    "metadata[ship_email]",
    data.address.email
  );
  params.set(
    "metadata[ship_phone]",
    data.address.phone
  );
  params.set(
    "metadata[ship_country]",
    data.address.country
  );
  params.set(
    "metadata[ship_region]",
    data.address.region
  );
  params.set(
    "metadata[ship_address1]",
    data.address.address1
  );
  params.set(
    "metadata[ship_address2]",
    data.address.address2
  );
  params.set(
    "metadata[ship_city]",
    data.address.city
  );
  params.set(
    "metadata[ship_zip]",
    data.address.zip
  );

  const attribution =
    data.attribution || {};

  const attributionFields = {
    landing_page:
      attribution.landing_page,
    referrer:
      attribution.referrer,

    first_utm_source:
      attribution.first_utm_source,
    first_utm_medium:
      attribution.first_utm_medium,
    first_utm_campaign:
      attribution.first_utm_campaign,
    first_utm_content:
      attribution.first_utm_content,
    first_utm_term:
      attribution.first_utm_term,

    current_utm_source:
      attribution.current_utm_source,
    current_utm_medium:
      attribution.current_utm_medium,
    current_utm_campaign:
      attribution.current_utm_campaign,
    current_utm_content:
      attribution.current_utm_content,
    current_utm_term:
      attribution.current_utm_term,

    gclid:
      attribution.gclid,
    fbclid:
      attribution.fbclid
  };

  Object.entries(attributionFields)
    .forEach(([key, value]) => {
      if (value) {
        params.set(
          `metadata[${key}]`,
          String(value)
        );
      }
    });

  let response;

  try {
    response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${getStripeSecretKey(env)}`,
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          "Unable to contact Stripe"
      }
    };
  }

  let stripeData;

  try {
    stripeData = await response.json();
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          "Stripe returned an invalid response"
      }
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      body: {
        ok: false,
        error:
          stripeData &&
          stripeData.error &&
          stripeData.error.message
            ? stripeData.error.message
            : "Unable to create Stripe Checkout"
      }
    };
  }

  return {
    ok: true,
    session: stripeData
  };
}

function describeVariantOptions(
  product,
  variant
) {
  if (
    !Array.isArray(product.options) ||
    !Array.isArray(variant.options)
  ) {
    return variant.title || "";
  }

  const labels = [];

  product.options.forEach((option) => {
    const value = Array.isArray(option.values)
      ? option.values.find((candidate) =>
          variant.options.some(
            (selectedId) =>
              String(selectedId) ===
              String(candidate.id)
          )
        )
      : null;

    if (value && value.title) {
      labels.push(value.title);
    }
  });

  return labels.join(" / ");
}

function getVariantImage(
  product,
  variantId
) {
  const rawImages =
    Array.isArray(product.images)
      ? product.images
      : [];

  let match = rawImages.find(
    (image) =>
      image &&
      image.src &&
      Array.isArray(image.variant_ids) &&
      image.variant_ids.some(
        (id) =>
          String(id) ===
          String(variantId)
      )
  );

  if (!match) {
    match = rawImages.find(
      (image) =>
        image &&
        image.src &&
        String(image.src).includes(
          `/${variantId}/`
        )
    );
  }

  return match && match.src
    ? match.src
    : getPrimaryImage(rawImages);
}

function cleanText(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, maxLength);
}

function extractPrintifyError(
  data,
  fallback
) {
  const details = [];

  collectPrintifyErrorStrings(
    data,
    details,
    0
  );

  const cleaned = Array.from(
    new Set(
      details
        .map((value) =>
          String(value || "").trim()
        )
        .filter(Boolean)
    )
  );

  if (cleaned.length > 0) {
    return cleaned.slice(0, 4).join(" | ");
  }

  return fallback;
}

function collectPrintifyErrorStrings(
  value,
  output,
  depth
) {
  if (
    value == null ||
    depth > 5 ||
    output.length >= 8
  ) {
    return;
  }

  if (typeof value === "string") {
    if (value.trim()) {
      output.push(value.trim());
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) =>
      collectPrintifyErrorStrings(
        item,
        output,
        depth + 1
      )
    );
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const priorityKeys = [
    "message",
    "reason",
    "error",
    "errors",
    "detail",
    "details"
  ];

  priorityKeys.forEach((key) => {
    if (
      Object.prototype.hasOwnProperty.call(
        value,
        key
      )
    ) {
      collectPrintifyErrorStrings(
        value[key],
        output,
        depth + 1
      );
    }
  });

  Object.keys(value).forEach((key) => {
    if (priorityKeys.includes(key)) {
      return;
    }

    const child = value[key];

    if (
      typeof child === "string" &&
      child.trim()
    ) {
      output.push(
        `${key}: ${child.trim()}`
      );
    } else if (
      child &&
      typeof child === "object"
    ) {
      collectPrintifyErrorStrings(
        child,
        output,
        depth + 1
      );
    }
  });
}

function validateWriteOrigin(request) {
  const origin =
    request.headers.get("Origin");

  if (
    origin &&
    !ALLOWED_ORIGINS.has(origin)
  ) {
    return {
      ok: false,
      error: "Origin not allowed"
    };
  }

  return null;
}

async function handleCatalog(request, env) {
  const result = await fetchPrintifyProducts(env);

  if (!result.ok) {
    return jsonResponse(
      result.body,
      result.status,
      request
    );
  }

  const products = result.products
    .filter(
      (product) =>
        product &&
        product.visible !== false
    )
    .map(normalizeCatalogProduct)
    .filter(
      (product) =>
        product.variant_count > 0
    );

  return jsonResponse(
    {
      ok: true,
      count: products.length,
      products
    },
    200,
    request,
    {
      "Cache-Control": "public, max-age=300"
    }
  );
}

async function handleCatalogProduct(
  request,
  env,
  productId
) {
  if (!productId) {
    return jsonResponse(
      {
        ok: false,
        error: "Product ID is required"
      },
      400,
      request
    );
  }

  const result = await fetchPrintifyProducts(env);

  if (!result.ok) {
    return jsonResponse(
      result.body,
      result.status,
      request
    );
  }

  const product = result.products.find(
    (item) =>
      String(item.id) === String(productId)
  );

  if (!product || product.visible === false) {
    return jsonResponse(
      {
        ok: false,
        error: "Product not found"
      },
      404,
      request
    );
  }

  const normalized = normalizeDetailedProduct(product);

  if (normalized.variants.length === 0) {
    return jsonResponse(
      {
        ok: false,
        error: "Product has no available variants"
      },
      404,
      request
    );
  }

  return jsonResponse(
    {
      ok: true,
      product: normalized
    },
    200,
    request,
    {
      "Cache-Control": "public, max-age=300"
    }
  );
}

async function handleDebugProducts(
  request,
  env
) {
  const result = await fetchPrintifyProducts(env);

  if (!result.ok) {
    return jsonResponse(
      result.body,
      result.status,
      request
    );
  }

  return jsonResponse(
    {
      ok: true,
      count: result.products.length,
      products: result.products
    },
    200,
    request
  );
}

async function fetchPrintifyProducts(env) {
  const configError = validatePrintifyConfig(env, true);

  if (configError) {
    return {
      ok: false,
      status: 500,
      body: configError
    };
  }

  const shopId = String(env.PRINTIFY_SHOP_ID).trim();
  const allProducts = [];
  const seenIds = new Set();

  /*
    Printify paginates the product list.
    Fetch every page so newly published products appear
    automatically without editing the storefront.
  */
  let page = 1;
  const perPage = 50;
  const maxPages = 100;

  while (page <= maxPages) {
    let response;

    try {
      response = await fetch(
        `https://api.printify.com/v1/shops/${shopId}/products.json?page=${page}&limit=${perPage}`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${env.PRINTIFY_API_TOKEN}`,
            Accept: "application/json"
          }
        }
      );
    } catch {
      return {
        ok: false,
        status: 502,
        body: {
          ok: false,
          error: "Unable to contact Printify"
        }
      };
    }

    let data;

    try {
      data = await response.json();
    } catch {
      return {
        ok: false,
        status: 502,
        body: {
          ok: false,
          error:
            "Printify returned an invalid response"
        }
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        body: {
          ok: false,
          error:
            "Unable to load shop catalog"
        }
      };
    }

    const pageProducts =
      Array.isArray(data.data)
        ? data.data
        : [];

    pageProducts.forEach((product) => {
      if (
        product &&
        product.id &&
        !seenIds.has(String(product.id))
      ) {
        seenIds.add(String(product.id));
        allProducts.push(product);
      }
    });

    /*
      Printify responses normally expose last_page/current_page.
      The length fallback also safely stops when the final page
      contains fewer than the requested page size.
    */
    const currentPage =
      Number(data.current_page || page);

    const lastPage =
      Number(data.last_page || 0);

    if (
      (lastPage > 0 && currentPage >= lastPage) ||
      pageProducts.length === 0 ||
      pageProducts.length < perPage
    ) {
      break;
    }

    page += 1;
  }

  return {
    ok: true,
    status: 200,
    products: allProducts
  };
}

function normalizeCatalogProduct(product) {
  const enabledVariants = getEnabledVariants(product);
  const availableOptions = getAvailableOptions(
    product,
    enabledVariants
  );

  const prices = enabledVariants
    .map((variant) => Number(variant.price))
    .filter(
      (price) =>
        Number.isFinite(price) &&
        price >= 0
    );

  const minPrice = prices.length
    ? Math.min(...prices)
    : null;

  const maxPrice = prices.length
    ? Math.max(...prices)
    : null;

  return {
    id: product.id,
    slug: createSlug(product.title),
    title:
      product.title ||
      "Mindo Bird Watching product",
    image: getPrimaryImage(product.images),
    min_price: minPrice,
    max_price: maxPrice,
    variant_count: enabledVariants.length,

    /*
      Storefront-friendly option metadata.

      Example apparel:
      option_summary: "S-3XL | 8 colors"

      Example tote:
      option_summary: "One size | 3 colors"

      We still keep variant_count internally, but the shop should display
      option_summary because shoppers think in sizes and colors, not the
      total number of size/color combinations.
    */
    option_summary: summarizeOptions(
      availableOptions,
      enabledVariants.length
    ),
    option_summary_parts: buildOptionSummaryParts(
      availableOptions
    )
  };
}

function normalizeDetailedProduct(product) {
  const enabledVariants = getEnabledVariants(product);
  const options = getAvailableOptions(
    product,
    enabledVariants
  );

  const images = normalizeImages(product.images);
  const colorGalleries = buildColorGalleries(
    product.images,
    options,
    enabledVariants
  );

  const prices = enabledVariants
    .map((variant) => Number(variant.price))
    .filter(
      (price) =>
        Number.isFinite(price) &&
        price >= 0
    );

  return {
    id: product.id,
    slug: createSlug(product.title),
    title:
      product.title ||
      "Mindo Bird Watching product",

    image:
      images.length > 0
        ? images[0].src
        : null,

    images,

    min_price:
      prices.length > 0
        ? Math.min(...prices)
        : null,

    max_price:
      prices.length > 0
        ? Math.max(...prices)
        : null,

    option_summary: summarizeOptions(
      options,
      enabledVariants.length
    ),

    option_summary_parts:
      buildOptionSummaryParts(options),

    /*
      Every color gets its own mockup gallery.
      This lets the storefront change color immediately
      while still preserving front/back/context views.
    */
    color_galleries: colorGalleries,

    /*
      Kept for compatibility with any cached V7/V8 page.
      The first image is the preferred front image.
    */
    color_images: colorGalleries.map((gallery) => ({
      option_id: gallery.option_id,
      title: gallery.title,
      image:
        gallery.images.length > 0
          ? gallery.images[0].src
          : null,
      variant_ids: gallery.variant_ids
    })),

    options,
    variants: enabledVariants
  };
}

function getEnabledVariants(product) {
  if (!Array.isArray(product.variants)) {
    return [];
  }

  return product.variants
    .filter(
      (variant) =>
        variant &&
        variant.is_enabled === true &&
        variant.is_available === true
    )
    .map((variant) => ({
      id: variant.id,
      title: variant.title || "",
      price: Number.isFinite(
        Number(variant.price)
      )
        ? Number(variant.price)
        : 0,
      available: true,
      options: Array.isArray(variant.options)
        ? variant.options
        : []
    }));
}

function getAvailableOptions(
  product,
  enabledVariants
) {
  const usedOptionIds = new Set();

  enabledVariants.forEach((variant) => {
    variant.options.forEach((optionId) => {
      usedOptionIds.add(String(optionId));
    });
  });

  if (!Array.isArray(product.options)) {
    return [];
  }

  return product.options
    .map((option) => {
      const values = Array.isArray(option.values)
        ? option.values
            .filter((value) =>
              usedOptionIds.has(String(value.id))
            )
            .map((value) => ({
              id: value.id,
              title: value.title,
              colors: Array.isArray(value.colors)
                ? value.colors
                : [],
              color:
                typeof value.color === "string"
                  ? value.color
                  : null
            }))
        : [];

      return {
        name: option.name || "",
        type: option.type || "",
        values
      };
    })
    .filter(
      (option) =>
        option.values.length > 0
    );
}

function buildOptionSummaryParts(options) {
  const sizeOption = options.find(isSizeOption);
  const colorOption = options.find(isColorOption);

  const sizeTitles = sizeOption
    ? uniqueTitles(sizeOption.values)
    : [];

  const colorTitles = colorOption
    ? uniqueTitles(colorOption.values)
    : [];

  return {
    size_label: summarizeSizes(sizeTitles),
    size_count: sizeTitles.length,
    color_count: colorTitles.length
  };
}

function summarizeOptions(
  options,
  variantCount
) {
  const parts = buildOptionSummaryParts(options);
  const labels = [];

  if (parts.size_label) {
    labels.push(parts.size_label);
  }

  if (parts.color_count > 0) {
    labels.push(
      parts.color_count === 1
        ? "1 color"
        : `${parts.color_count} colors`
    );
  }

  if (labels.length > 0) {
    return labels.join(" | ");
  }

  if (variantCount === 1) {
    return "1 option";
  }

  if (variantCount > 1) {
    return `${variantCount} options`;
  }

  return "";
}

function summarizeSizes(titles) {
  if (!titles.length) {
    return "";
  }

  if (titles.length === 1) {
    return titles[0];
  }

  const standard = titles
    .map((title) => ({
      title,
      rank: standardSizeRank(title)
    }))
    .filter((item) => item.rank !== null)
    .sort((a, b) => a.rank - b.rank);

  /*
    Only compress to a range when every available value is a recognized
    apparel size. This avoids misleading labels for products with
    non-standard size names.
  */
  if (standard.length === titles.length) {
    return `${standard[0].title}-${standard[standard.length - 1].title}`;
  }

  /*
    Short non-apparel lists such as 11oz / 15oz are more useful when
    shown explicitly.
  */
  if (titles.length <= 3) {
    return titles.join(" / ");
  }

  return `${titles.length} sizes`;
}

function standardSizeRank(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  const ranks = {
    "XXS": 10,
    "2XS": 10,
    "XS": 20,
    "S": 30,
    "M": 40,
    "L": 50,
    "XL": 60,
    "XXL": 70,
    "2XL": 70,
    "XXXL": 80,
    "3XL": 80,
    "4XL": 90,
    "5XL": 100,
    "6XL": 110
  };

  return Object.prototype.hasOwnProperty.call(
    ranks,
    normalized
  )
    ? ranks[normalized]
    : null;
}

function isSizeOption(option) {
  const type = String(option.type || "").toLowerCase();
  const name = String(option.name || "").toLowerCase();

  return (
    type === "size" ||
    name === "size" ||
    name === "sizes" ||
    name.includes("size")
  );
}

function isColorOption(option) {
  const type = String(option.type || "").toLowerCase();
  const name = String(option.name || "").toLowerCase();

  return (
    type === "color" ||
    name === "color" ||
    name === "colors" ||
    name.includes("color")
  );
}

function uniqueTitles(values) {
  const seen = new Set();
  const titles = [];

  values.forEach((value) => {
    const title = String(value.title || "").trim();

    if (!title || seen.has(title)) {
      return;
    }

    seen.add(title);
    titles.push(title);
  });

  return titles;
}


function buildColorGalleries(
  rawImages,
  options,
  enabledVariants
) {
  const colorOption = options.find(isColorOption);

  if (
    !colorOption ||
    !Array.isArray(rawImages)
  ) {
    return [];
  }

  const sourceImages = rawImages.filter(
    (image) =>
      image &&
      image.src
  );

  return colorOption.values
    .map((value) => {
      const variantIds =
        enabledVariants
          .filter((variant) =>
            variant.options.some(
              (optionId) =>
                String(optionId) ===
                String(value.id)
            )
          )
          .map((variant) =>
            Number(variant.id)
          );

      if (!variantIds.length) {
        return null;
      }

      const idSet = new Set(
        variantIds.map(String)
      );

      const matching = sourceImages.filter(
        (image) => {
          if (
            Array.isArray(image.variant_ids) &&
            image.variant_ids.some(
              (variantId) =>
                idSet.has(String(variantId))
            )
          ) {
            return true;
          }

          return variantIds.some(
            (variantId) =>
              String(image.src).includes(
                `/${variantId}/`
              )
          );
        }
      );

      const seen = new Set();

      const gallery = matching
        .slice()
        .sort((a, b) => {
          const rankA =
            mockupPositionRank(a.position);

          const rankB =
            mockupPositionRank(b.position);

          if (rankA !== rankB) {
            return rankA - rankB;
          }

          const defaultA =
            a.is_default === true ? 1 : 0;

          const defaultB =
            b.is_default === true ? 1 : 0;

          return defaultB - defaultA;
        })
        .filter((image) => {
          if (seen.has(image.src)) {
            return false;
          }

          seen.add(image.src);
          return true;
        })
        .slice(0, 10)
        .map((image) => ({
          src: image.src,
          position:
            image.position || "other",
          is_default:
            image.is_default === true
        }));

      if (!gallery.length) {
        return null;
      }

      return {
        option_id: value.id,
        title: value.title,
        variant_ids: variantIds,
        images: gallery
      };
    })
    .filter(Boolean);
}

function mockupPositionRank(position) {
  const value =
    String(position || "")
      .trim()
      .toLowerCase();

  if (
    value === "front" ||
    value.startsWith("front-")
  ) {
    return 0;
  }

  if (
    value === "back" ||
    value.startsWith("back-")
  ) {
    return 1;
  }

  return 2;
}

function getPrimaryImage(rawImages) {
  const images = normalizeImages(rawImages);

  return images.length > 0
    ? images[0].src
    : null;
}

function normalizeImages(rawImages) {
  if (!Array.isArray(rawImages)) {
    return [];
  }

  const seen = new Set();

  return rawImages
    .filter(
      (image) =>
        image &&
        image.src
    )
    .sort((a, b) => {
      const aDefault =
        a.is_default === true ? 1 : 0;

      const bDefault =
        b.is_default === true ? 1 : 0;

      return bDefault - aDefault;
    })
    .filter((image) => {
      if (seen.has(image.src)) {
        return false;
      }

      seen.add(image.src);
      return true;
    })
    .slice(0, 12)
    .map((image) => ({
      src: image.src,
      position:
        image.position || "other"
    }));
}

async function handlePrintifyShops(
  request,
  env
) {
  const configError =
    validatePrintifyConfig(env, false);

  if (configError) {
    return jsonResponse(
      configError,
      500,
      request
    );
  }

  let response;

  try {
    response = await fetch(
      "https://api.printify.com/v1/shops.json",
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${env.PRINTIFY_API_TOKEN}`,
          Accept: "application/json"
        }
      }
    );
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "Unable to contact Printify"
      },
      502,
      request
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "Printify returned an invalid response"
      },
      502,
      request
    );
  }

  if (!response.ok) {
    return jsonResponse(
      {
        ok: false,
        error: "Unable to load Printify shops"
      },
      502,
      request
    );
  }

  return jsonResponse(
    {
      ok: true,
      shops: Array.isArray(data)
        ? data.map((shop) => ({
            id: shop.id,
            title: shop.title,
            sales_channel:
              shop.sales_channel
          }))
        : []
    },
    200,
    request
  );
}

function validatePrintifyConfig(
  env,
  requireShopId
) {
  if (!env.PRINTIFY_API_TOKEN) {
    return {
      ok: false,
      error:
        "PRINTIFY_API_TOKEN is not configured"
    };
  }

  if (
    requireShopId &&
    !env.PRINTIFY_SHOP_ID
  ) {
    return {
      ok: false,
      error:
        "PRINTIFY_SHOP_ID is not configured"
    };
  }

  return null;
}

function createSlug(value) {
  return String(value || "product")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function handleOptions(request) {
  const origin =
    request.headers.get("Origin");

  if (
    !origin ||
    !ALLOWED_ORIGINS.has(origin)
  ) {
    return new Response(null, {
      status: 204
    });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":
        origin,
      "Access-Control-Allow-Methods":
        "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type",
      "Access-Control-Max-Age":
        "86400",
      Vary: "Origin"
    }
  });
}

function jsonResponse(
  data,
  status = 200,
  request = null,
  additionalHeaders = {}
) {
  const headers = {
    "Content-Type":
      "application/json; charset=UTF-8",
    "Cache-Control": "no-store",
    ...additionalHeaders
  };

  if (request) {
    const origin =
      request.headers.get("Origin");

    if (
      origin &&
      ALLOWED_ORIGINS.has(origin)
    ) {
      headers[
        "Access-Control-Allow-Origin"
      ] = origin;

      headers.Vary = "Origin";
    }
  }

  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers
    }
  );
}
