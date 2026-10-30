// Authenticate at the origin too: Access headers alone are not proof of identity.
const ADMIN = "https://admin.mindobirdwatching.com";
const ISSUER = "https://tcfr-mbw.cloudflareaccess.com";
const AUDIENCES = new Set([
  // MBW Admin (staff only).
  "62ad79ee3af18f90b4827d5a84be038d4df901a56cbc21abda1ac5991ea89060",
  // MBW Guide Nest (path-scoped Cloudflare Access application).
  "b4d788474b91e0b737ff8d49489f7b127fc63dd3ed9ece6464b999ca84aaa7e0",
]);
const NEST_GUIDE_PAGES = new Set([
  "/guide", "/guide/", "/guide/index.html", "/api/guide/bootstrap", "/api/guide/reports",
]);
const NEST_GUIDE_ASSETS = new Set([
  "/guide/guide.css", "/guide/guide.mjs", "/guide/pricing.mjs", "/assets/images/app/mbw-header-logo-160.png", "/assets/images/app/mbw-app-gold-transparent-180.png",
  "/favicon.ico", "/favicon.svg", "/apple-touch-icon.png", "/site.webmanifest",
]);
let cachedKeys;
let keysExpireAt = 0;

export function hasTrustedAudience(aud) {
  return Array.isArray(aud) && aud.some(value => AUDIENCES.has(value));
}

function decode(value) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

export async function verifyIdentity(token) {
  if (!token || token.length > 16384) throw new Error("Missing identity");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || typeof header.kid !== "string" ||
      claims.iss !== ISSUER || !hasTrustedAudience(claims.aud) ||
      !Number.isFinite(claims.exp) || claims.exp <= now ||
      (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) ||
      typeof claims.email !== "string" || !claims.email.trim()) throw new Error("Invalid claims");
  if (!cachedKeys || keysExpireAt <= Date.now()) {
    const response = await fetch(ISSUER + "/cdn-cgi/access/certs", { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Identity service unavailable");
    const body = await response.json();
    if (!Array.isArray(body.keys)) throw new Error("Invalid signing keys");
    cachedKeys = body.keys;
    keysExpireAt = Date.now() + 300000;
  }
  const jwk = cachedKeys.find(key => key.kid === header.kid && key.kty === "RSA");
  if (!jwk) throw new Error("Unknown signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, {name:"RSASSA-PKCS1-v1_5", hash:"SHA-256"}, false, ["verify"]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]))) throw new Error("Invalid signature");
  return claims.email.trim().toLowerCase();
}

export function guideMayRequest(request) {
  const path = new URL(request.url).pathname;
  if (["GET", "HEAD"].includes(request.method)) return NEST_GUIDE_PAGES.has(path) || NEST_GUIDE_ASSETS.has(path);
  if (request.method === "POST" && (/^\/api\/guide\/assignments\/[A-Za-z0-9_.-]+\/accept$/.test(path) || path === "/api/guide/availability" || /^\/api\/guide\/offers\/[A-Za-z0-9_.-]+\/respond$/.test(path) || /^\/api\/guide\/plans\/[A-Za-z0-9_.-]+$/.test(path))) return true;
  if (request.method === "DELETE" && /^\/api\/guide\/availability\/[A-Za-z0-9_.-]+$/.test(path)) return true;
  return false;
}

export function guideMayNavigate(href) {
  try {
    const url = new URL(href, ADMIN);
    return url.origin === ADMIN && NEST_GUIDE_PAGES.has(url.pathname);
  } catch { return false; }
}

function reject(status, message) {
  return new Response(message, {status, headers: {"Content-Type":"text/plain; charset=utf-8", "Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff"}});
}

export function configuredRole(env, email) {
  try {
    const roles = {};
    for (const raw of [env?.MBW_MOBILE_ROLE_MAP, env?.MBW_GUIDE_ROLE_MAP]) {
      if (!raw) continue;
      Object.assign(roles, typeof raw === "string" ? JSON.parse(raw) : raw);
    }
    const entry = roles?.[email];
    return String(typeof entry === "string" ? entry : entry?.role || "").trim().toLowerCase();
  } catch { return ""; }
}

export async function onRequest(context) {
  const {request} = context;
  const url = new URL(request.url);
  const adminPreview = url.hostname === "mindobirdwatching-admin.pages.dev" || url.hostname.endsWith(".mindobirdwatching-admin.pages.dev");
  // The public site's existing Functions are intentionally unchanged.
  if (url.origin !== ADMIN && !adminPreview) return context.next();
  if (adminPreview) return new Response(null, {status:302, headers:{Location:ADMIN + url.pathname + url.search, "Cache-Control":"no-store"}});
  let email;
  try { email = await verifyIdentity(request.headers.get("Cf-Access-Jwt-Assertion")); }
  catch { return reject(401, "Sign in through MBW Admin to continue."); }
  const role = configuredRole(context.env, email);
  if (!["owner", "agent", "guide"].includes(role)) return reject(403, "This account is not enabled for MBW Admin.");
  if (role !== "owner" && (url.pathname === "/itinerary-lab" || url.pathname.startsWith("/itinerary-lab/") || url.pathname.startsWith("/api/itinerary-lab"))) return reject(403, "Itinerary Lab is limited to the MBW owner.");
  const guide = role === "guide";
  if (guide && !guideMayRequest(request)) return reject(403, "Your guide account is limited to Guide Nest. Return to https://admin.mindobirdwatching.com/guide/");
  let response = await context.next();
  if (guide && response.headers.get("Content-Type")?.includes("text/html")) {
    response = new HTMLRewriter()
      .on("body", {element(el) {el.setAttribute("data-admin-role", "birding-guide");}})
      .on("a[href]", {element(el) {
        if (!guideMayNavigate(el.getAttribute("href"))) {
          el.removeAttribute("href"); el.removeAttribute("target");
          el.setAttribute("aria-disabled", "true");
          el.setAttribute("title", "Your account is limited to Guide Nest.");
        }
      }})
      .on('link[href="/assets/css/site.css"]', {element(el) {el.remove();}})
      .transform(response);
  }
  // Never cache identity-specific HTML or permit shared-cache role leakage.
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Cookie, Cf-Access-Jwt-Assertion");
  return new Response(response.body, {status:response.status, statusText:response.statusText, headers});
}
