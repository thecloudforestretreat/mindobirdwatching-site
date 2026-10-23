import { guideIdentity } from "../../lib/mobile-auth.mjs";
import { loadGuideData } from "../../lib/guide-data.mjs";
import { errorResponse, json, methodNotAllowed } from "../../lib/mobile-http.mjs";

const links = {
  google: "https://g.page/r/CdMlIYMGgBIvEAE/review",
  tripadvisor: "https://www.tripadvisor.com/Attraction_Review-g609138-d34192556-Reviews-Mindo_Bird_Watching-Mindo_Pichincha_Province.html",
  instagram: "https://instagram.com/mindobirdwatching/",
  facebook: "https://facebook.com/mindobirdwatching/",
  youtube: "https://youtube.com/@MindoBirdWatching",
  shop: "https://mindobirdwatching.com/shop/",
  tip: "https://mindobirdwatching.com/tip-your-guide/",
};

function guideAttribution(value) {
  return String(value || "guide").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "guide";
}

function linksFor(identity, providerName) {
  const content = guideAttribution(identity.role === "guide" ? identity.name || identity.providerName : providerName || "admin-preview");
  const shop = new URL(links.shop);
  shop.searchParams.set("utm_source", "mbw_guide");
  shop.searchParams.set("utm_medium", "referral");
  shop.searchParams.set("utm_campaign", "post_tour");
  shop.searchParams.set("utm_content", content);
  const tip = new URL(links.tip);
  tip.searchParams.set("utm_source", "mbw_guide");
  tip.searchParams.set("utm_medium", "referral");
  tip.searchParams.set("utm_campaign", "guide_tip");
  tip.searchParams.set("utm_content", content);
  return { ...links, shop: shop.toString(), tip: tip.toString() };
}

export async function onRequestGet({ request, env }) {
  try {
    const identity = await guideIdentity(request, env);
    const requested = String(new URL(request.url).searchParams.get("provider") || "").trim().slice(0, 160);
    const data = await loadGuideData(env, identity, requested);
    return json(200, {
      ok: true,
      checkedAt: new Date().toISOString(),
      identity: { name: identity.name, role: identity.role, contributorNumber: identity.contributorNumber },
      preview: identity.role !== "guide",
      ...data,
      links: linksFor(identity, data.providerName),
    });
  } catch (error) { return errorResponse(error, "Guide schedule is unavailable."); }
}

export function onRequestPost() { return methodNotAllowed(["GET"]); }
