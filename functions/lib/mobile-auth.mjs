import { verifyIdentity } from "../_middleware.js";

const PHASE_ONE_ROLES = new Set(["owner", "agent"]);

function parseRoleMap(raw) {
  if (!raw) return {};
  let value;
  try { value = typeof raw === "string" ? JSON.parse(raw) : raw; }
  catch { throw Object.assign(new Error("MBW mobile role configuration is invalid."), { status: 503 }); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new Error("MBW mobile role configuration is invalid."), { status: 503 });
  }
  return value;
}

function roleEntry(roleMap, email) {
  const configured = roleMap[email];
  if (typeof configured === "string") return { role: configured, staffCode: "", providerName: "", providerId: "" };
  if (configured && typeof configured === "object") {
    return {
      role: String(configured.role || "").toLowerCase(),
      staffCode: String(configured.staffCode || configured.staff_code || "").toUpperCase(),
      name: String(configured.name || "").slice(0, 80),
      providerName: String(configured.providerName || configured.provider_name || "").trim().slice(0, 160),
      providerId: String(configured.providerId || configured.provider_id || "").trim().slice(0, 128),
    };
  }
  return null;
}

async function identityEmail(request, env) {
  const url = new URL(request.url);
  if (["localhost", "127.0.0.1"].includes(url.hostname) && env.LOCAL_TEST_IDENTITY) {
    return String(env.LOCAL_TEST_IDENTITY).trim().toLowerCase();
  }
  try { return await verifyIdentity(request.headers.get("Cf-Access-Jwt-Assertion")); }
  catch { throw Object.assign(new Error("Sign in through MBW Admin."), { status: 401 }); }
}

export async function mobileIdentity(request, env) {
  const email = await identityEmail(request, env);
  const entry = roleEntry(parseRoleMap(env.MBW_MOBILE_ROLE_MAP), email);
  if (!entry || !PHASE_ONE_ROLES.has(entry.role)) {
    throw Object.assign(new Error("This account is not enabled for the mobile pilot."), { status: 403 });
  }
  if (entry.staffCode && !/^[A-Z0-9_-]{1,20}$/.test(entry.staffCode)) {
    throw Object.assign(new Error("The configured staff code is invalid."), { status: 503 });
  }
  return { email, role: entry.role, staffCode: entry.staffCode, name: entry.name || email.split("@")[0] };
}


export async function guideIdentity(request, env) {
  const email = await identityEmail(request, env);
  const entry = roleEntry(parseRoleMap(env.MBW_MOBILE_ROLE_MAP), email);
  if (!entry || !["owner", "agent", "guide"].includes(entry.role)) {
    throw Object.assign(new Error("This account is not enabled for Guide Nest."), { status: 403 });
  }
  if (entry.role === "guide" && !entry.providerName) {
    throw Object.assign(new Error("This guide account is not linked to a provider record."), { status: 503 });
  }
  return {
    email,
    role: entry.role,
    staffCode: entry.staffCode,
    name: entry.name || entry.providerName || email.split("@")[0],
    providerName: entry.providerName,
    providerId: entry.providerId,
  };
}
