// GET: connection status (no token, no shop cipher) and the latest synced orders, for Owner and Admin.
import { requireErpRole } from "@/lib/server/erp-auth.mjs";
import { readConnection, publicConnection, latestOrders } from "@/lib/marketplace/tiktok-service.mjs";
import { deps, json, fail } from "@/lib/marketplace/tiktok-route.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { db, auth } = deps();
    const who = await requireErpRole(request, { auth, db, roles: ["owner", "admin"] });
    const conn = publicConnection(await readConnection(db));
    const orders = conn.status === "not_connected" ? [] : await latestOrders(db, 20);
    return json({
      role: who.role,
      configured: { appKey: !!process.env.TIKTOK_APP_KEY, appSecret: !!process.env.TIKTOK_APP_SECRET, cron: !!process.env.CRON_SECRET },
      connection: conn,
      orders,
    });
  } catch (err) {
    return fail(err);
  }
}
