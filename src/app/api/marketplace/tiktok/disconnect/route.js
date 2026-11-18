// POST: an Owner removes the stored TikTok tokens. Synced orders stay; the store can be connected again later.
// To revoke the app on TikTok's side as well, remove it in Seller Center (Layanan / Aplikasi yang diotorisasi).
import { requireErpRole } from "@/lib/server/erp-auth.mjs";
import { disconnect } from "@/lib/marketplace/tiktok-service.mjs";
import { deps, json, fail } from "@/lib/marketplace/tiktok-route.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { db, auth } = deps();
    const who = await requireErpRole(request, { auth, db, roles: ["owner"] });
    await disconnect(db, { by: who.email });
    return json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
