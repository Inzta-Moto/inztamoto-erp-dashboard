// GET: TikTok redirects here after the store owner approves the app (URL Pengalihan in Partner Center).
// Checks the one-time state, exchanges the code for tokens, finds the authorized shop and stores the connection,
// then sends the browser back to the ERP Marketplace page with a short result code (never a token).
import { NextResponse } from "next/server";
import { consumeOAuthState, saveConnection } from "@/lib/marketplace/tiktok-service.mjs";
import { deps, tiktokClient, tiktokSecret } from "@/lib/marketplace/tiktok-route.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function back(request, result, reason) {
  const u = new URL("/", request.url);
  u.searchParams.set("marketplace", "tiktok");
  u.searchParams.set("result", result);
  if (reason) u.searchParams.set("reason", reason);
  return NextResponse.redirect(u, { status: 302, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const code = q.get("code") || q.get("auth_code") || "";
  const state = q.get("state") || "";
  try {
    const { db } = deps();
    const started = await consumeOAuthState(db, state);
    if (!started) return back(request, "error", "state");
    if (!code) return back(request, "error", "denied");
    const client = tiktokClient();
    const token = await client.exchangeCode(code);
    const shops = await client.authorizedShops(token.accessToken);
    await saveConnection(db, { token, shops, by: started.by, secret: tiktokSecret() });
    return back(request, "connected");
  } catch (err) {
    console.error("[marketplace/tiktok/callback]", err && err.code, err && err.message);
    return back(request, "error", err && err.code === "CONFIG" ? "config" : "exchange");
  }
}
