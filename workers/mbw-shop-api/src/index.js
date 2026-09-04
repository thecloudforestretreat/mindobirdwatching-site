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

async function handleCatalog(request, env) {
  const result = await fetchPrintifyProducts(
    env
  );

  if (!result.ok) {
    return jsonResponse(
      result.body,
      result.status,
      request
    );
  }

  const rawProducts = result.products;

  const products = rawProducts
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
      "Cache-Control":
        "public, max-age=300"
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

  const result = await fetchPrintifyProducts(
    env
  );

  if (!result.ok) {
    return jsonResponse(
      result.body,
      result.status,
      request
    );
  }

  const product = result.products.find(
    (item) =>
      String(item.id) ===
      String(productId)
  );

  if (!product) {
    return jsonResponse(
      {
        ok: false,
        error: "Product not found"
      },
      404,
      request
    );
  }

  if (product.visible === false) {
    return jsonResponse(
      {
        ok: false,
        error: "Product not available"
      },
      404,
      request
    );
  }

  const normalized =
    normalizeDetailedProduct(product);

  if (
    normalized.variants.length === 0
  ) {
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
      "Cache-Control":
        "public, max-age=300"
    }
  );
}

async function handleDebugProducts(
  request,
  env
) {
  const result = await fetchPrintifyProducts(
    env
  );

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
  const configError =
    validatePrintifyConfig(env, true);

  if (configError) {
    return {
      ok: false,
      status: 500,
      body: configError
    };
  }

  const shopId = String(
    env.PRINTIFY_SHOP_ID
  ).trim();

  let response;

  try {
    response = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products.json`,
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
        error:
          "Unable to contact Printify"
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

  return {
    ok: true,
    status: 200,
    products: Array.isArray(data.data)
      ? data.data
      : []
  };
}

function normalizeCatalogProduct(
  product
) {
  const enabledVariants =
    getEnabledVariants(product);

  const prices = enabledVariants
    .map((variant) =>
      Number(variant.price)
    )
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

  const image =
    getPrimaryImage(product.images);

  return {
    id: product.id,
    slug: createSlug(product.title),
    title:
      product.title ||
      "Mindo Bird Watching product",
    image,
    min_price: minPrice,
    max_price: maxPrice,
    variant_count:
      enabledVariants.length
  };
}

function normalizeDetailedProduct(
  product
) {
  const enabledVariants =
    getEnabledVariants(product);

  const usedOptionIds = new Set();

  for (const variant of enabledVariants) {
    for (const optionId of variant.options) {
      usedOptionIds.add(
        String(optionId)
      );
    }
  }

  const options = Array.isArray(
    product.options
  )
    ? product.options
        .map((option) => {
          const values =
            Array.isArray(option.values)
              ? option.values
                  .filter((value) =>
                    usedOptionIds.has(
                      String(value.id)
                    )
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
        .filter(
          (option) =>
            option.values.length > 0
        )
    : [];

  const images =
    normalizeImages(product.images);

  const prices = enabledVariants
    .map((variant) =>
      Number(variant.price)
    )
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
      options: Array.isArray(
        variant.options
      )
        ? variant.options
        : []
    }));
}

function getPrimaryImage(rawImages) {
  const images =
    normalizeImages(rawImages);

  if (images.length === 0) {
    return null;
  }

  return images[0].src;
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
    .slice(0, 8)
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
        error:
          "Unable to contact Printify"
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
        error:
          "Printify returned an invalid response"
      },
      502,
      request
    );
  }

  if (!response.ok) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Unable to load Printify shops"
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
        "GET, OPTIONS",
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
