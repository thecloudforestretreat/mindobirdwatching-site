const BASE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "Vary": "Cookie, Cf-Access-Jwt-Assertion",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...extraHeaders },
  });
}

export function methodNotAllowed(allowed) {
  return json(405, { ok: false, error: "Method not allowed." }, { Allow: allowed.join(", ") });
}

export function assertSameOrigin(request, env) {
  const requestUrl = new URL(request.url);
  const expected = String(env.MBW_ADMIN_ORIGIN || "https://admin.mindobirdwatching.com").replace(/\/$/, "");
  if (requestUrl.origin !== expected && !["localhost", "127.0.0.1"].includes(requestUrl.hostname)) {
    throw Object.assign(new Error("Open through MBW Admin."), { status: 403 });
  }
  const origin = request.headers.get("Origin");
  if (origin !== requestUrl.origin) {
    throw Object.assign(new Error("Same-origin request required."), { status: 403 });
  }
  const fetchSite = (request.headers.get("Sec-Fetch-Site") || "").toLowerCase();
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw Object.assign(new Error("Cross-site request rejected."), { status: 403 });
  }
}

export async function readJson(request, maxBytes = 16000) {
  const contentType = (request.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw Object.assign(new Error("application/json is required."), { status: 415 });
  }
  if (Number(request.headers.get("Content-Length") || 0) > maxBytes) {
    throw Object.assign(new Error("Request is too large."), { status: 413 });
  }
  const raw = await request.text();
  if (raw.length > maxBytes) throw Object.assign(new Error("Request is too large."), { status: 413 });
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error("Invalid JSON."), { status: 400 }); }
}

export function errorResponse(error, fallback = "Request failed.") {
  return json(Number(error?.status) || 500, { ok: false, error: error?.message || fallback });
}

export function validId(value) {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(id)) {
    throw Object.assign(new Error("Invalid record ID."), { status: 400 });
  }
  return id;
}

export function writesEnabled(env) {
  const value = env.MBW_MOBILE_WRITE_ENABLED ?? env.MBW_MOBILE_WRITE_ENABLE ?? "false";
  return String(value).trim().toLowerCase() === "true";
}

export function mobileWriteReady(env, identity) {
  return writesEnabled(env) && Boolean(env.N8N_CRM_ADMIN_TOKEN) && Boolean(identity?.staffCode);
}

export function assertMobileWriteReady(env, identity) {
  if (!writesEnabled(env)) throw Object.assign(new Error("Mobile writes are disabled."), { status: 503 });
  if (!env.N8N_CRM_ADMIN_TOKEN) throw Object.assign(new Error("Mobile write authentication is not configured."), { status: 503 });
  if (!identity?.staffCode) throw Object.assign(new Error("Your mobile role needs a staff code before changes can be saved."), { status: 403 });
}
