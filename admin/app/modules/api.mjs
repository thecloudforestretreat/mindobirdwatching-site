async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  let body;
  try { body = await response.json(); } catch { body = { ok: false, error: `Server returned ${response.status}.` }; }
  if (!response.ok || body.ok === false) throw Object.assign(new Error(body.error || "Request failed."), { status: response.status, body });
  return body;
}

export const api = {
  session: () => request("/api/mobile/session"),
  bootstrap: () => request("/api/mobile/bootstrap"),
  search: query => request(`/api/mobile/guests?q=${encodeURIComponent(query)}`),
  guest: id => request(`/api/mobile/guests/${encodeURIComponent(id)}`),
  patchGuest: (id, payload) => request(`/api/mobile/guests/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  addInteraction: (id, payload) => request(`/api/mobile/guests/${encodeURIComponent(id)}/interactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  patchAssignment: (id, payload) => request(`/api/mobile/assignments/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
};
