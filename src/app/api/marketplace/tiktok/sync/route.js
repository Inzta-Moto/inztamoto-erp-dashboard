// Pull TikTok Shop/Tokopedia orders into marketplace_orders.
//   GET  by Vercel Cron (vercel.json, daily 00:00 WIB), authorized with CRON_SECRET
//   POST by an Owner or Admin from the ERP Marketplace page ("Sinkronkan sekarang")
import { requireErpRole } from "@/lib/server/erp-auth.mjs";
import { syncOrders } from "@/lib/marketplace/tiktok-service.mjs";
import { deps, json, fail, tiktokClient, tiktokSecret, cronAuthorized } from "@/lib/marketplace/tiktok-route.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(trigger, by) {
  const { db } = deps();
  const summary = await syncOrders({ db, client: tiktokClient(), secret: tiktokSecret(), trigger, by });
  return json({ sync: summary }, summary.ok ? 200 : summary.code === "NOT_CONNECTED" || summary.code === "EXPIRED" ? 409 : 502);
}

export async function GET(request) {
  if (!cronAuthorized(request)) return json({ error: "Tidak diizinkan", code: "UNAUTHENTICATED" }, 401);
  try {
    return await run("cron", "vercel-cron");
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request) {
  try {
    const { db, auth } = deps();
    const who = await requireErpRole(request, { auth, db, roles: ["owner", "admin"] });
    return await run("manual", who.email);
  } catch (err) {
    return fail(err);
  }
}
