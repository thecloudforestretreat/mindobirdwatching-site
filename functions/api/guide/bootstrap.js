import { guideIdentity } from "../../lib/mobile-auth.mjs";
import { loadGuideData } from "../../lib/guide-data.mjs";
import { errorResponse, json, methodNotAllowed } from "../../lib/mobile-http.mjs";

const links = {
  google: "https://www.google.com/maps/place//data=!4m3!3m2!1s0x91d57d913d4b34db:0x2f128006832125d3!12e1?source=g.page.m._&laa=merchant-review-solicitation",
  tripadvisor: "https://www.tripadvisor.com/Attraction_Review-g609138-d34192556-Reviews-Mindo_Bird_Watching-Mindo_Pichincha_Province.html",
  instagram: "https://instagram.com/mindobirdwatching/",
  facebook: "https://facebook.com/mindobirdwatching/",
  youtube: "https://youtube.com/@MindoBirdWatching",
  shop: "https://mindobirdwatching.com/shop/",
};

export async function onRequestGet({ request, env }) {
  try {
    const identity = await guideIdentity(request, env);
    const requested = String(new URL(request.url).searchParams.get("provider") || "").trim().slice(0, 160);
    const data = await loadGuideData(env, identity, requested);
    return json(200, {
      ok: true,
      checkedAt: new Date().toISOString(),
      identity: { name: identity.name, role: identity.role },
      preview: identity.role !== "guide",
      ...data,
      links,
    });
  } catch (error) { return errorResponse(error, "Guide schedule is unavailable."); }
}

export function onRequestPost() { return methodNotAllowed(["GET"]); }
