// TikTok Shop connection and order sync for the ERP, on top of an injected Firestore (Admin SDK shape) and an
// injected TikTok client, so scripts/marketplace-tiktok.test.mjs can run it against fakes.
//
// Firestore layout (all written by the server only):
//   marketplace_connections/tiktok   status, shop, sealed tokens, expiry, last sync summary, sync cursor
//   marketplace_oauth_states/{nonce} one-time OAuth state, 10 minutes
//   marketplace_orders/tiktok_<id>   one record per order (tiktok-orders.mjs), no buyer personal data
//
// Spark budget: one sync reads each fetched order once (to skip unchanged ones) and writes only changed orders,
// plus one write for the connection document.
import { randomBytes } from "node:crypto";
import { seal, open } from "./token-box.mjs";
import { toMarketplaceOrder, docIdFor } from "./tiktok-orders.mjs";

export const CONNECTION_PATH = ["marketplace_connections", "tiktok"];
export const STATES = "marketplace_oauth_states";
export const ORDERS = "marketplace_orders";

const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_EARLY_SECONDS = 24 * 3600;
const DAY = 86400;

function connRef(db) {
  return db.collection(CONNECTION_PATH[0]).doc(CONNECTION_PATH[1]);
}

function iso(ms) {
  return new Date(ms).toISOString();
}

export async function createOAuthState(db, { by, now = Date.now() }) {
  const nonce = randomBytes(24).toString("base64url");
  await db.collection(STATES).doc(nonce).set({ by: String(by || ""), createdAt: iso(now), expiresAtMs: now + STATE_TTL_MS });
  return nonce;
}

// True once for a valid, unexpired state; the document is deleted either way.
export async function consumeOAuthState(db, nonce, { now = Date.now() } = {}) {
  if (typeof nonce !== "string" || !/^[A-Za-z0-9_-]{20,64}$/.test(nonce)) return null;
  const ref = db.collection(STATES).doc(nonce);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.delete();
  const d = snap.data() || {};
  return Number(d.expiresAtMs) > now ? d : null;
}

export async function saveConnection(db, { token, shops, by, secret, now = Date.now() }) {
  const shop = (shops || []).find((s) => s.region === "ID") || (shops || [])[0];
  if (!shop || !shop.cipher) throw new Error("Tidak ada toko yang memberi izin ke app ini");
  if (!token.accessToken || !token.refreshToken) throw new Error("TikTok tidak mengirim token");
  await connRef(db).set({
    status: "connected",
    shop: { id: shop.id, name: shop.name, region: shop.region, code: shop.code },
    shopCount: (shops || []).length,
    shopCipher: shop.cipher,
    sellerName: token.sellerName,
    grantedScopes: token.grantedScopes,
    access: seal(token.accessToken, secret),
    refresh: seal(token.refreshToken, secret),
    accessExpiresAt: token.accessTokenExpireIn,
    refreshExpiresAt: token.refreshTokenExpireIn,
    connectedAt: iso(now),
    connectedBy: String(by || ""),
    updatedAt: iso(now),
  }, { merge: true });
  return shop;
}

export async function disconnect(db, { by, now = Date.now() }) {
  await connRef(db).set({ status: "disconnected", access: "", refresh: "", shopCipher: "", accessExpiresAt: 0, refreshExpiresAt: 0, disconnectedAt: iso(now), disconnectedBy: String(by || ""), updatedAt: iso(now) }, { merge: true });
}

// Everything the ERP page may show. No token, no cipher.
export function publicConnection(d) {
  if (!d) return { status: "not_connected" };
  return {
    status: d.status || "not_connected",
    shop: d.shop || null,
    shopCount: d.shopCount || 0,
    sellerName: d.sellerName || "",
    grantedScopes: d.grantedScopes || [],
    accessExpiresAt: d.accessExpiresAt || 0,
    refreshExpiresAt: d.refreshExpiresAt || 0,
    connectedAt: d.connectedAt || "",
    connectedBy: d.connectedBy || "",
    lastSync: d.lastSync || null,
    cursor: d.cursor || 0,
  };
}

export async function readConnection(db) {
  const snap = await connRef(db).get();
  return snap.exists ? snap.data() : null;
}

// Returns a usable access token, refreshing it a day before it expires.
export async function freshAccessToken(db, client, secret, { now = Date.now() } = {}) {
  const d = await readConnection(db);
  if (!d || d.status !== "connected" || !d.access) throw Object.assign(new Error("Toko TikTok Shop belum tersambung"), { code: "NOT_CONNECTED" });
  const nowS = Math.floor(now / 1000);
  if (d.accessExpiresAt && d.accessExpiresAt - nowS > REFRESH_EARLY_SECONDS) return { accessToken: open(d.access, secret), conn: d };
  if (d.refreshExpiresAt && d.refreshExpiresAt <= nowS) {
    await connRef(db).set({ status: "expired", updatedAt: iso(now) }, { merge: true });
    throw Object.assign(new Error("Izin toko kedaluwarsa. Sambungkan ulang toko dari menu Marketplace."), { code: "EXPIRED" });
  }
  const t = await client.refresh(open(d.refresh, secret));
  const update = {
    access: seal(t.accessToken, secret),
    refresh: seal(t.refreshToken || open(d.refresh, secret), secret),
    accessExpiresAt: t.accessTokenExpireIn,
    refreshExpiresAt: t.refreshTokenExpireIn || d.refreshExpiresAt,
    tokenRefreshedAt: iso(now),
    updatedAt: iso(now),
  };
  await connRef(db).set(update, { merge: true });
  return { accessToken: t.accessToken, conn: { ...d, ...update } };
}

async function existingSignatures(db, ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const refs = ids.slice(i, i + 100).map((id) => db.collection(ORDERS).doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => {
      if (s.exists) out.set(s.id, (s.data() || {}).signature || "");
    });
  }
  return out;
}

export async function syncOrders({ db, client, secret, now = Date.now(), backfillDays = 30, overlapSeconds = DAY, maxPages = 40, trigger = "manual", by = "" }) {
  const started = now;
  const nowS = Math.floor(now / 1000);
  const summary = { at: iso(started), trigger, by: String(by || ""), ok: false, fetched: 0, written: 0, unchanged: 0, pages: 0, complete: false, windowFrom: 0, windowTo: 0, error: "" };
  try {
    const { accessToken, conn } = await freshAccessToken(db, client, secret, { now });
    const from = conn.cursor ? Math.max(0, conn.cursor - overlapSeconds) : nowS - backfillDays * DAY;
    const to = nowS - 60;
    summary.windowFrom = from;
    summary.windowTo = to;

    const records = new Map();
    let pageToken = "";
    let lastUpdate = from;
    do {
      const page = await client.searchOrders({ accessToken, shopCipher: conn.shopCipher, updateTimeGe: from, updateTimeLt: to, pageToken });
      summary.pages += 1;
      for (const o of page.orders) {
        const rec = toMarketplaceOrder(o);
        records.set(docIdFor(rec.orderId), rec);
        if (rec.updateTime > lastUpdate) lastUpdate = rec.updateTime;
      }
      pageToken = page.nextPageToken;
    } while (pageToken && summary.pages < maxPages);
    summary.complete = !pageToken;
    summary.fetched = records.size;

    const ids = [...records.keys()];
    const have = await existingSignatures(db, ids);
    const changed = ids.filter((id) => have.get(id) !== records.get(id).signature);
    summary.unchanged = ids.length - changed.length;
    for (let i = 0; i < changed.length; i += 400) {
      const batch = db.batch();
      changed.slice(i, i + 400).forEach((id) => batch.set(db.collection(ORDERS).doc(id), { ...records.get(id), syncedAt: iso(now) }));
      await batch.commit();
    }
    summary.written = changed.length;
    summary.ok = true;
    // Not finished within maxPages: continue next run from the newest update seen (pages are oldest first).
    await connRef(db).set({ lastSync: summary, cursor: summary.complete ? to : lastUpdate, updatedAt: iso(Date.now()) }, { merge: true });
  } catch (err) {
    summary.error = String(err && err.message ? err.message : err).slice(0, 300);
    summary.code = err && err.code ? String(err.code) : "";
    try {
      await connRef(db).set({ lastSync: summary, updatedAt: iso(Date.now()) }, { merge: true });
    } catch {
      /* the original error is the one to report */
    }
  }
  return summary;
}

// Single-field order only: a platform filter plus orderBy would need a composite index in production.
export async function latestOrders(db, limit = 20) {
  const snap = await db.collection(ORDERS).orderBy("updateTime", "desc").limit(limit).get();
  return snap.docs.filter((d) => (d.data() || {}).platform === "tiktok").map((d) => {
    const x = d.data();
    return { id: d.id, orderId: x.orderId, channel: x.channel, status: x.status, statusLabel: x.statusLabel, date: x.date, updateTime: x.updateTime, isSample: !!x.isSample, items: x.items || [], payment: x.payment || {}, itemCount: x.itemCount || 0 };
  });
}
