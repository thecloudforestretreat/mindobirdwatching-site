const CATALOG_API =
  "https://mbw-shop-api.thecloudforestretreat.workers.dev/catalog/";

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const productId = cleanId(requestUrl.searchParams.get("id"));
  const variantId = cleanId(requestUrl.searchParams.get("variant"));

  if (!productId) {
    return context.env.ASSETS.fetch(context.request);
  }

  const [assetResponse, catalogResponse] = await Promise.all([
    context.env.ASSETS.fetch(context.request),
    fetch(CATALOG_API + encodeURIComponent(productId), {
      headers: { Accept: "application/json" },
      cf: { cacheEverything: true, cacheTtl: 900 }
    })
  ]);

  if (!assetResponse.ok || !catalogResponse.ok) {
    return assetResponse;
  }

  const payload = await catalogResponse.json().catch(() => null);
  const product = payload && payload.ok ? payload.product : null;

  if (!product || !product.title || !product.image) {
    return assetResponse;
  }

  const selectedVariant = findVariant(product, variantId);
  const optionDetails = getVariantOptionDetails(product, selectedVariant);
  const canonicalUrl = buildCanonicalUrl(productId, selectedVariant);
  const priceCents = selectedVariant
    ? Number(selectedVariant.price)
    : Number(product.min_price);
  const maxPriceCents = Number(product.max_price);
  const titleSuffix = [optionDetails.color, optionDetails.size]
    .filter(Boolean)
    .join(" / ");
  const pageTitle = `${product.title}${titleSuffix ? ` - ${titleSuffix}` : ""} | Mindo Bird Watching`;
  const description = buildDescription(product, titleSuffix);
  const visiblePrice = money(priceCents);
  const priceRange =
    !selectedVariant &&
    Number.isFinite(maxPriceCents) &&
    maxPriceCents > priceCents
      ? `${money(priceCents)} - ${money(maxPriceCents)}`
      : visiblePrice;

  let html = await assetResponse.text();

  html = replaceTag(html, "title", escapeHtml(pageTitle));
  html = replaceMeta(html, "name", "description", description);
  html = replaceMeta(
    html,
    "name",
    "robots",
    "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
  );
  html = replaceLink(html, "canonical", canonicalUrl);
  html = replaceLink(html, "alternate", canonicalUrl, "en");
  html = replaceLink(html, "alternate", canonicalUrl, "x-default");
  html = replaceMeta(html, "property", "og:type", "product");
  html = replaceMeta(html, "property", "og:title", pageTitle);
  html = replaceMeta(html, "property", "og:description", description);
  html = replaceMeta(html, "property", "og:url", canonicalUrl);
  html = replaceMeta(html, "property", "og:image", product.image);
  html = replaceMeta(
    html,
    "property",
    "og:image:alt",
    `${product.title} product image`
  );
  html = replaceMeta(html, "name", "twitter:title", pageTitle);
  html = replaceMeta(html, "name", "twitter:description", description);
  html = replaceMeta(html, "name", "twitter:image", product.image);

  html = html
    .replace(
      /<h1 id="productTitle">[\s\S]*?<\/h1>/i,
      `<h1 id="productTitle">${escapeHtml(product.title)}</h1>`
    )
    .replace(
      /<p id="productLead">[\s\S]*?<\/p>/i,
      `<p id="productLead">${escapeHtml(description)}</p>`
    )
    .replace(
      /<p class="mbwPurchasePrice" id="mbwPurchasePrice">[\s\S]*?<\/p>/i,
      `<p class="mbwPurchasePrice" id="mbwPurchasePrice">${escapeHtml(visiblePrice)}</p>`
    )
    .replace(
      /<strong id="productPrice">[\s\S]*?<\/strong>/i,
      `<strong id="productPrice">${escapeHtml(priceRange)}</strong>`
    )
    .replace(
      /<img alt="Mindo Bird Watching shop product preview"([^>]*?)id="productImage"([^>]*?)src="[^"]*"/i,
      `<img alt="${escapeAttribute(product.title)} product image"$1id="productImage"$2src="${escapeAttribute(product.image)}"`
    )
    .replace(
      /<p id="productDescription">[\s\S]*?<\/p>/i,
      `<p id="productDescription">${escapeHtml(description)}</p>`
    );

  const schema = buildProductSchema({
    product,
    selectedVariant,
    optionDetails,
    canonicalUrl,
    description,
    priceCents,
    maxPriceCents
  });

  html = html.replace(
    "</head>",
    `<script type="application/ld+json" id="mbw-product-schema">${escapeJsonForHtml(
      JSON.stringify(schema)
    )}</script>\n</head>`
  );

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=900",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function cleanId(value) {
  const id = String(value || "").trim();
  return /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : "";
}

function findVariant(product, variantId) {
  if (!variantId || !Array.isArray(product.variants)) return null;
  return (
    product.variants.find(
      (variant) => String(variant && variant.id) === String(variantId)
    ) || null
  );
}

function getVariantOptionDetails(product, variant) {
  const details = { color: "", size: "" };
  if (!variant || !Array.isArray(variant.options)) return details;

  for (const option of product.options || []) {
    const type = `${option.type || ""} ${option.name || ""}`.toLowerCase();
    const value = (option.values || []).find((candidate) =>
      variant.options.some((id) => String(id) === String(candidate.id))
    );
    if (!value) continue;
    if (type.includes("color")) details.color = String(value.title || "");
    if (type.includes("size")) details.size = String(value.title || "");
  }

  return details;
}

function buildCanonicalUrl(productId, variant) {
  const url = new URL("https://mindobirdwatching.com/shop/product/");
  url.searchParams.set("id", productId);
  if (variant && variant.id) url.searchParams.set("variant", String(variant.id));
  return url.toString();
}

function buildDescription(product, optionText) {
  const options = optionText ? ` in ${optionText}` : "";
  const summary = product.option_summary ? ` Available options: ${product.option_summary}.` : "";
  return `${product.title}${options}, a made-to-order Mindo Bird Watching design inspired by the birds and cloud forest of Mindo, Ecuador.${summary}`;
}

function buildProductSchema({
  product,
  selectedVariant,
  optionDetails,
  canonicalUrl,
  description,
  priceCents,
  maxPriceCents
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: product.title,
    description,
    image: (product.images || []).map((image) => image.src).filter(Boolean).slice(0, 10),
    sku: selectedVariant
      ? `${product.id}-${selectedVariant.id}`
      : String(product.id),
    brand: { "@type": "Brand", name: "Mindo Bird Watching" },
    url: canonicalUrl
  };

  if (optionDetails.color) schema.color = optionDetails.color;
  if (optionDetails.size) schema.size = optionDetails.size;

  if (selectedVariant) {
    schema.offers = {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: "USD",
      price: centsToDecimal(priceCents),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition"
    };
  } else {
    schema.offers = {
      "@type": "AggregateOffer",
      url: canonicalUrl,
      priceCurrency: "USD",
      lowPrice: centsToDecimal(priceCents),
      highPrice: centsToDecimal(maxPriceCents || priceCents),
      offerCount: Array.isArray(product.variants) ? product.variants.length : 1,
      availability: "https://schema.org/InStock"
    };
  }

  return schema;
}

function replaceTag(html, tag, value) {
  return html.replace(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "i"), `<${tag}>${value}</${tag}>`);
}

function replaceMeta(html, attribute, key, value) {
  const pattern = new RegExp(
    `<meta(?=[^>]*${attribute}="${escapeRegExp(key)}")(?=[^>]*content=")[^>]*>`,
    "i"
  );
  return html.replace(
    pattern,
    `<meta ${attribute}="${escapeAttribute(key)}" content="${escapeAttribute(value)}">`
  );
}

function replaceLink(html, rel, href, hreflang) {
  const languagePart = hreflang
    ? `(?=[^>]*hreflang="${escapeRegExp(hreflang)}")`
    : "(?![^>]*hreflang=)";
  const pattern = new RegExp(
    `<link(?=[^>]*rel="${escapeRegExp(rel)}")${languagePart}[^>]*>`,
    "i"
  );
  const languageAttribute = hreflang
    ? ` hreflang="${escapeAttribute(hreflang)}"`
    : "";
  return html.replace(
    pattern,
    `<link rel="${escapeAttribute(rel)}"${languageAttribute} href="${escapeAttribute(href)}">`
  );
}

function money(cents) {
  const value = Number(cents);
  return Number.isFinite(value) ? `$${(value / 100).toFixed(2)}` : "$0.00";
}

function centsToDecimal(cents) {
  const value = Number(cents);
  return Number.isFinite(value) ? (value / 100).toFixed(2) : "0.00";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function escapeJsonForHtml(value) {
  return String(value).replace(/</g, "\\u003c");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
