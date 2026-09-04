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
            )
        },
        200,
        request
      );
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
    subtotal
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
    "https://mindobirdwatching.com/shop/?checkout=success&session_id={CHECKOUT_SESSION_ID}"
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
