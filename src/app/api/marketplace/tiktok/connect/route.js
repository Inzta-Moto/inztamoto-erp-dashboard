// POST: an Owner starts connecting the TikTok Shop/Tokopedia store. Returns the TikTok authorization link with a
// one-time state; TikTok sends the owner back to /api/marketplace/tiktok/callback.
import { requireErpRole } from "@/lib/server/erp-auth.mjs";
import { createOAuthState } from "@/lib/marketplace/tiktok-service.mjs";
import { authorizeUrl } from "@/lib/marketplace/tiktok-api.mjs";
import { deps, json, fail, serviceId, tiktokClient } from "@/lib/marketplace/tiktok-route.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { db, auth } = deps();
    const who = await requireErpRole(request, { auth, db, roles: ["owner"] });
    tiktokClient(); // fail early when the app key/secret are missing
    const state = await createOAuthState(db, { by: who.email });
    return json({ url: authorizeUrl(serviceId(), state) });
  } catch (err) {
    return fail(err);
  }
}
