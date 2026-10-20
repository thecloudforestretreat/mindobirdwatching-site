import { mobileIdentity } from "../../lib/mobile-auth.mjs";
import { json, errorResponse, methodNotAllowed, mobileWriteReady, writesEnabled } from "../../lib/mobile-http.mjs";

export async function onRequestGet({ request, env }) {
  try {
    const identity = await mobileIdentity(request, env);
    return json(200, {
      ok: true,
      identity: { email: identity.email, name: identity.name, role: identity.role },
      capabilities: {
        read: true,
        write: mobileWriteReady(env, identity),
        editPayments: false,
        createAssignments: false,
        inviteProviders: false,
      },
      configuration: {
        roleMapConfigured: Boolean(env.MBW_MOBILE_ROLE_MAP),
        n8nTokenConfigured: Boolean(env.N8N_CRM_ADMIN_TOKEN),
        writeFlagEnabled: writesEnabled(env),
      },
      serverTime: new Date().toISOString(),
    });
  } catch (error) { return errorResponse(error); }
}

export function onRequestPost() { return methodNotAllowed(["GET"]); }
