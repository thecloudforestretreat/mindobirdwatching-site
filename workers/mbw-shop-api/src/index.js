export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return jsonResponse(
        {
          ok: true,
          service: "mbw-shop-api",
          message: "Mindo Bird Watching shop API is running"
        },
        200
      );
    }

    if (url.pathname === "/health") {
      return jsonResponse(
        {
          ok: true,
          status: "healthy"
        },
        200
      );
    }

    if (url.pathname === "/printify/shops") {
      return handlePrintifyShops(env);
    }

    if (url.pathname === "/printify/products") {
      return handlePrintifyProducts(env);
    }

    return jsonResponse(
      {
        ok: false,
        error: "Not found"
      },
      404
    );
  }
};

async function handlePrintifyShops(env) {
  const configError = validatePrintifyConfig(env, false);

  if (configError) {
    return configError;
  }

  return callPrintify(
    "https://api.printify.com/v1/shops.json",
    env.PRINTIFY_API_TOKEN
  );
}

async function handlePrintifyProducts(env) {
  const configError = validatePrintifyConfig(env, true);

  if (configError) {
    return configError;
  }

  const shopId = String(env.PRINTIFY_SHOP_ID).trim();

  const response = await fetch(
    `https://api.printify.com/v1/shops/${shopId}/products.json`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}`,
        Accept: "application/json"
      }
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "Printify returned a non-JSON response",
        status: response.status
      },
      502
    );
  }

  if (!response.ok) {
    return jsonResponse(
      {
        ok: false,
        error: "Printify products request failed",
        status: response.status,
        details: data
      },
      response.status
    );
  }

  const rawProducts = Array.isArray(data.data) ? data.data : [];

  const products = rawProducts.map((product) => ({
    id: product.id,
    title: product.title,
    visible: product.visible,
    blueprint_id: product.blueprint_id,
    print_provider_id: product.print_provider_id,

    images: Array.isArray(product.images)
      ? product.images.map((image) => ({
          src: image.src,
          position: image.position,
          is_default: image.is_default
        }))
      : [],

    options: Array.isArray(product.options)
      ? product.options.map((option) => ({
          name: option.name,
          type: option.type,
          values: Array.isArray(option.values)
            ? option.values.map((value) => ({
                id: value.id,
                title: value.title
              }))
            : []
        }))
      : [],

    variants: Array.isArray(product.variants)
      ? product.variants.map((variant) => ({
          id: variant.id,
          title: variant.title,
          price: variant.price,
          is_enabled: variant.is_enabled,
          is_available: variant.is_available,
          options: variant.options
        }))
      : []
  }));

  return jsonResponse(
    {
      ok: true,
      shop_id: shopId,
      count: products.length,
      products
    },
    200
  );
}

function validatePrintifyConfig(env, requireShopId) {
  if (!env.PRINTIFY_API_TOKEN) {
    return jsonResponse(
      {
        ok: false,
        error: "PRINTIFY_API_TOKEN is not configured"
      },
      500
    );
  }

  if (requireShopId && !env.PRINTIFY_SHOP_ID) {
    return jsonResponse(
      {
        ok: false,
        error: "PRINTIFY_SHOP_ID is not configured"
      },
      500
    );
  }

  return null;
}

async function callPrintify(endpoint, token) {
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    let data;

    try {
      data = await response.json();
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: "Printify returned a non-JSON response",
          status: response.status
        },
        502
      );
    }

    if (!response.ok) {
      return jsonResponse(
        {
          ok: false,
          error: "Printify API request failed",
          status: response.status,
          details: data
        },
        response.status
      );
    }

    return jsonResponse(
      {
        ok: true,
        shops: data
      },
      200
    );
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Unable to contact Printify",
        message: error.message
      },
      500
    );
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}
