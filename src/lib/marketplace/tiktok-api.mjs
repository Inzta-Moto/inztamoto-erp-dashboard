// Minimal TikTok Shop Open API client for the ERP: OAuth token exchange and refresh, authorized shops, order search.
// `fetch` is injected so tests (and a local mock server) can stand in for TikTok. Hosts can be overridden with
// TIKTOK_AUTH_BASE / TIKTOK_API_BASE for local testing only; production uses the defaults.
// Errors never include the app secret or tokens.
import { sign } from "./tiktok-sign.mjs";

export const DEFAULT_AUTH_BASE = "https://auth.tiktok-shops.com";
export const DEFAULT_API_BASE = "https://open-api.tiktokglobalshop.com";
export const AUTHORIZE_BASE = "https://services.tiktokshop.com/open/authorize";

export class TikTokApiError extends Error {
  constructor(message, { code = "", status = 0, requestId = "" } = {}) {
    super(message);
    this.name = "TikTokApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export function authorizeUrl(serviceId, state) {
  const u = new URL(AUTHORIZE_BASE);
  u.searchParams.set("service_id", serviceId);
  u.searchParams.set("state", state);
  return u.toString();
}

export function createTikTokClient({ appKey, appSecret, fetchImpl = globalThis.fetch, authBase, apiBase, now = () => Date.now() }) {
  if (!appKey || !appSecret) throw new TikTokApiError("TIKTOK_APP_KEY dan TIKTOK_APP_SECRET belum diisi", { code: "CONFIG" });
  const AUTH = (authBase || DEFAULT_AUTH_BASE).replace(/\/$/, "");
  const API = (apiBase || DEFAULT_API_BASE).replace(/\/$/, "");

  async function readJson(res) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      throw new TikTokApiError("Jawaban TikTok bukan JSON (HTTP " + res.status + ")", { status: res.status, code: "BAD_RESPONSE" });
    }
    if (!res.ok || !data || data.code !== 0) {
      const msg = data && data.message ? String(data.message).slice(0, 300) : "HTTP " + res.status;
      throw new TikTokApiError("TikTok menolak permintaan: " + msg, {
        status: res.status,
        code: data && data.code !== undefined ? String(data.code) : "HTTP_" + res.status,
        requestId: data && data.request_id ? String(data.request_id) : "",
      });
    }
    return data.data || {};
  }

  async function tokenCall(path, params) {
    const u = new URL(AUTH + path);
    u.searchParams.set("app_key", appKey);
    u.searchParams.set("app_secret", appSecret);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    const res = await fetchImpl(u.toString(), { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
    return normalizeToken(await readJson(res));
  }

  function normalizeToken(d) {
    return {
      accessToken: String(d.access_token || ""),
      accessTokenExpireIn: Number(d.access_token_expire_in || 0), // unix seconds (absolute)
      refreshToken: String(d.refresh_token || ""),
      refreshTokenExpireIn: Number(d.refresh_token_expire_in || 0), // unix seconds (absolute)
      openId: String(d.open_id || ""),
      sellerName: String(d.seller_name || "").slice(0, 200),
      sellerBaseRegion: String(d.seller_base_region || ""),
      grantedScopes: Array.isArray(d.granted_scopes) ? d.granted_scopes.map(String) : [],
    };
  }

  async function call(method, path, { accessToken, query = {}, body } = {}) {
    const q = { app_key: appKey, timestamp: String(Math.floor(now() / 1000)), ...query };
    const bodyText = body === undefined ? "" : JSON.stringify(body);
    q.sign = sign({ path, query: q, body: bodyText, appSecret });
    const u = new URL(API + path);
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    const headers = { Accept: "application/json", "x-tts-access-token": accessToken };
    if (bodyText) headers["Content-Type"] = "application/json";
    const res = await fetchImpl(u.toString(), { method, headers, body: bodyText || undefined, cache: "no-store" });
    return readJson(res);
  }

  return {
    exchangeCode: (authCode) => tokenCall("/api/v2/token/get", { auth_code: authCode, grant_type: "authorized_code" }),
    refresh: (refreshToken) => tokenCall("/api/v2/token/refresh", { refresh_token: refreshToken, grant_type: "refresh_token" }),

    async authorizedShops(accessToken) {
      const d = await call("GET", "/authorization/202309/shops", { accessToken });
      return (d.shops || []).map((s) => ({
        id: String(s.id || ""),
        name: String(s.name || "").slice(0, 200),
        region: String(s.region || ""),
        cipher: String(s.cipher || ""),
        code: String(s.code || ""),
        sellerType: String(s.seller_type || ""),
      }));
    },

    // One page of orders updated in [updateTimeGe, updateTimeLt) (unix seconds), oldest first.
    async searchOrders({ accessToken, shopCipher, updateTimeGe, updateTimeLt, pageToken = "", pageSize = 50 }) {
      const query = { shop_cipher: shopCipher, page_size: String(pageSize), sort_field: "update_time", sort_order: "ASC" };
      if (pageToken) query.page_token = pageToken;
      const d = await call("POST", "/order/202309/orders/search", {
        accessToken,
        query,
        body: { update_time_ge: updateTimeGe, update_time_lt: updateTimeLt },
      });
      return { orders: Array.isArray(d.orders) ? d.orders : [], nextPageToken: String(d.next_page_token || ""), totalCount: Number(d.total_count || 0) };
    },
  };
}
