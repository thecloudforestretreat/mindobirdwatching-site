const ADMIN_ORIGIN = "https://admin.mindobirdwatching.com";
const MAX_POSTS = 20;
const REDDIT_HOSTS = new Set(["reddit.com", "www.reddit.com", "old.reddit.com"]);

function responseHeaders(request) {
  const origin = request.headers.get("origin") || "";
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, max-age=3600",
    "access-control-allow-origin": origin === ADMIN_ORIGIN ? origin : ADMIN_ORIGIN,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "Origin"
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request) });
}

function clean(value, limit = 1200) {
  return String(value == null ? "" : value).trim().slice(0, limit);
}

function embedUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !REDDIT_HOSTS.has(url.hostname.toLowerCase())) return "";
    const match = url.pathname.match(/^\/r\/[^/]+\/comments\/[a-z0-9]+\/[^/]+\/?/i);
    if (!match) return "";
    return "https://embed.reddit.com" + match[0];
  } catch {
    return "";
  }
}

function previewFromHtml(html) {
  const direct = html.match(/https:\/\/(?:external-preview|preview)\.redd\.it\/[^"'<>\\\s]+/i);
  if (!direct) return "";
  const value = direct[0].replace(/&amp;/g, "&").replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  try {
    const url = new URL(value);
    return ["external-preview.redd.it", "preview.redd.it"].includes(url.hostname) ? url.href : "";
  } catch {
    return "";
  }
}

async function resolvePreview(post) {
  const url = embedUrl(post.href);
  if (!url) return [post.id, ""];
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; MindoBirdWatchingAdmin/1.0; +https://mindobirdwatching.com)"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) return [post.id, ""];
    return [post.id, previewFromHtml(await response.text())];
  } catch {
    return [post.id, ""];
  }
}

export async function onRequestPost({ request }) {
  let input;
  try { input = await request.json(); } catch { return json(request, { ok: false, message: "Invalid JSON body." }, 400); }
  const raw = Array.isArray(input.posts) ? input.posts.slice(0, MAX_POSTS) : [];
  const posts = raw.map((post) => ({ id: clean(post && post.id, 160), href: clean(post && post.href) })).filter((post) => post.id && embedUrl(post.href));
  if (!posts.length) return json(request, { ok: true, previews: {}, resolved: 0 });
  const results = await Promise.all(posts.map(resolvePreview));
  const previews = Object.fromEntries(results.filter(([, preview]) => preview));
  return json(request, { ok: true, previews, resolved: Object.keys(previews).length });
}

export function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: responseHeaders(request) });
}
