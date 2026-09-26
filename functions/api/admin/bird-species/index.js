const ADMIN_ORIGIN = "https://admin.mindobirdwatching.com";

function cors(request) {
  const origin = request.headers.get("origin") || "";
  return {
    "access-control-allow-origin": origin === ADMIN_ORIGIN ? origin : ADMIN_ORIGIN,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors(request) },
  });
}

function parseBuilderData(html) {
  const marker = "window.MBW_TARGET_BUILDER_DATA=";
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("Species catalog marker was not found.");
  const valueStart = start + marker.length;
  const end = html.indexOf(";</script>", valueStart);
  if (end < 0) throw new Error("Species catalog closing marker was not found.");
  return JSON.parse(html.slice(valueStart, end));
}

function audioMap(data) {
  const map = new Map();
  for (const bird of Array.isArray(data?.birds) ? data.birds : []) {
    if (bird.code) map.set(bird.code, { audio: bird.audio || "", audioCredit: bird.audioCredit || "" });
  }
  return map;
}

export async function onRequestGet({ request, env }) {
  try {
    const publicOrigin = String(env.MBW_PUBLIC_SITE_ORIGIN || "https://mindobirdwatching.com").replace(/\/$/, "");
    const [catalogResponse, audioResponse] = await Promise.all([
      fetch(publicOrigin + "/tours/target-bird-tour-builder/", { cf: { cacheTtl: 900, cacheEverything: true } }),
      fetch(publicOrigin + "/assets/data/bird-quest.json", { cf: { cacheTtl: 900, cacheEverything: true } }),
    ]);
    if (!catalogResponse.ok) throw new Error("Species catalog returned " + catalogResponse.status + ".");
    const catalog = parseBuilderData(await catalogResponse.text());
    const audio = audioResponse.ok ? audioMap(await audioResponse.json().catch(() => ({}))) : new Map();
    const birds = (Array.isArray(catalog.birds) ? catalog.birds : []).map((bird) => ({
      ...bird,
      audio: audio.get(bird.speciesCode)?.audio || "",
      audioCredit: audio.get(bird.speciesCode)?.audioCredit || "",
    }));
    return json(request, { ok: true, count: birds.length, birds });
  } catch (error) {
    console.error("Admin species catalog failed", { message: error?.message });
    return json(request, { ok: false, message: "The species catalog is temporarily unavailable." }, 502);
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request) });
}
