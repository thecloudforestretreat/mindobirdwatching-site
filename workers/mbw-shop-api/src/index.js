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
          message: "Mindo Bird Watching shop API is running"
        },
        200,
        request
      );
    }

    if (url.pathname === "/health") {
      return jsonResponse(
        {
          ok: true,
          status: "healthy"
        },
        200,
        request
      );
    }

    if (url.pathname === "/catalog") {
      return handleCatalog(request, env);
    }

    if (url.pathname === "/printify/products") {
      return handleCatalog(request, env);
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

async function handleCatalog(request, env) {
  const configError = validatePrintifyConfig(env, true, request);

  if (configError) {
    return configError;
  }

  const shopId = String(env.PRINTIFY_SHOP_ID).trim();

  let response;

  try {
    response = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products.json`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}`,
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
        error: "Unable to load shop catalog"
      },
      502,
      request
    );
  }

  const rawProducts = Array.isArray(data.data) ? data.data : [];

  const products = rawProducts
    .filter((product) => product && product.visible !== false)
    .map(normalizeProduct)
    .filter((product) => product.variants.length > 0);

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

function normalizeProduct(product) {
  const enabledVariants = Array.isArray(product.variants)
    ? product.variants
        .filter(
          (variant) =>
            variant &&
            variant.is_enabled === true &&
            variant.is_available === true
        )
        .map((variant) => ({
          id: variant.id,
          title: variant.title || "",
          price: Number.isFinite(Number(variant.price))
            ? Number(variant.price)
            : 0,
          available: true,
          options: Array.isArray(variant.options)
            ? variant.options
            : []
        }))
    : [];

  const usedOptionIds = new Set();

  for (const variant of enabledVariants) {
    for (const optionId of variant.options) {
      usedOptionIds.add(String(optionId));
    }
  }

  const options = Array.isArray(product.options)
    ? product.options
        .map((option) => {
          const values = Array.isArray(option.values)
            ? option.values
                .filter((value) =>
                  usedOptionIds.has(String(value.id))
                )
                .map((value) => ({
                  id: value.id,
                  title: value.title
                }))
            : [];

          return {
            name: option.name || "",
            type: option.type || "",
            values
          };
        })
        .filter((option) => option.values.length > 0)
    : [];

  const images = normalizeImages(product.images);

  const prices = enabledVariants
    .map((variant) => variant.price)
    .filter((price) => Number.isFinite(price) && price >= 0);

  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;

  return {
    id: product.id,
    slug: createSlug(product.title),
    title: product.title || "Mindo Bird Watching product",

    image: images.length ? images[0].src : null,
    images,

    min_price: minPrice,
    max_price: maxPrice,

    options,
    variants: enabledVariants
  };
}

function normalizeImages(rawImages) {
  if (!Array.isArray(rawImages)) {
    return [];
  }

  const seen = new Set();

  const images = rawImages
    .filter((image) => image && image.src)
    .sort((a, b) => {
      const aDefault = a.is_default === true ? 1 : 0;
      const bDefault = b.is_default === true ? 1 : 0;

      return bDefault - aDefault;
    })
    .filter((image) => {
      if (seen.has(image.src)) {
        return false;
      }

      seen.add(image.src);
      return true;
    })
    .slice(0, 8)
    .map((image) => ({
      src: image.src,
      position: image.position || "other"
    }));

  return images;
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

async function handlePrintifyShops(request, env) {
  const configError = validatePrintifyConfig(env, false, request);

  if (configError) {
    return configError;
  }

  let response;

  try {
    response = await fetch(
      "https://api.printify.com/v1/shops.json",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.PRINTIFY_API_TOKEN}`,
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
            sales_channel: shop.sales_channel
          }))
        : []
    },
    200,
    request
  );
}

function validatePrintifyConfig(env, requireShopId, request) {
  if (!env.PRINTIFY_API_TOKEN) {
    return jsonResponse(
      {
        ok: false,
        error: "PRINTIFY_API_TOKEN is not configured"
      },
      500,
      request
    );
  }

  if (requireShopId && !env.PRINTIFY_SHOP_ID) {
    return jsonResponse(
      {
        ok: false,
        error: "PRINTIFY_SHOP_ID is not configured"
      },
      500,
      request
    );
  }

  return null;
}

function handleOptions(request) {
  const origin = request.headers.get("Origin");

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, {
      status: 204
    });
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
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
    "Content-Type": "application/json; charset=UTF-8",
    "Cache-Control": "no-store",
    ...additionalHeaders
  };

  if (request) {
    const origin = request.headers.get("Origin");

    if (origin && ALLOWED_ORIGINS.has(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers.Vary = "Origin";
    }
  }

  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers
  });
}
