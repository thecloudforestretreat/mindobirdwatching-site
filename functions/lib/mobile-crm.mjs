export function extractRecords(value) {
  if (value?.body) return extractRecords(value.body);
  if (Array.isArray(value)) return value.map(item => item?.json || item).filter(Boolean);
  for (const key of ["records", "data", "rows", "items"]) {
    if (Array.isArray(value?.[key])) return value[key].map(item => item?.json || item).filter(Boolean);
  }
  return [];
}

export async function crmCall(env, action, data = {}, timeoutMs = 25000) {
  const url = String(env.N8N_CRM_ADMIN_URL || "").trim();
  const token = String(env.N8N_CRM_ADMIN_TOKEN || "").trim();
  if (!url.startsWith("https://")) throw Object.assign(new Error("Protected CRM endpoint is not configured."), { status: 503 });
  if (!token) throw Object.assign(new Error("CRM authentication is not configured."), { status: 503 });
  const headers = { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" };
  headers["X-MBW-CRM-Key"] = token;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: new URLSearchParams({ payload: JSON.stringify({ action, ...data }) }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw Object.assign(new Error("CRM is unavailable. No change was confirmed."), { status: 503 });
  }
  const text = await response.text();
  let result;
  try { result = text ? JSON.parse(text) : null; }
  catch { throw Object.assign(new Error("CRM returned an invalid response."), { status: 502 }); }
  if (!response.ok || !result || result.ok === false || result.success === false) {
    const message = result?.error || `CRM request failed (${response.status}).`;
    throw Object.assign(new Error(message), { status: response.status === 409 ? 409 : 502 });
  }
  return result;
}

export async function listRecords(env, action, filters = {}) {
  return extractRecords(await crmCall(env, action, filters));
}
