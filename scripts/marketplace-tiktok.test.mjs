// Tests for src/lib/marketplace/*. Run: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sign, signString } from "../src/lib/marketplace/tiktok-sign.mjs";
import { seal, open } from "../src/lib/marketplace/token-box.mjs";
import { toMarketplaceOrder, wibDate, channelOf, docIdFor, orderSignature } from "../src/lib/marketplace/tiktok-orders.mjs";
import { planSalesFromOrder, matchProduct, normalizeSku } from "../src/lib/marketplace/order-to-sales.mjs";
import { createTikTokClient, authorizeUrl } from "../src/lib/marketplace/tiktok-api.mjs";
import * as svc from "../src/lib/marketplace/tiktok-service.mjs";

// ---------- fakes ----------

function fakeDb() {
  const data = new Map(); // "col/id" -> object
  const stats = { reads: 0, writes: 0, deletes: 0 };
  const snap = (col, id) => {
    const v = data.get(col + "/" + id);
    return { id, exists: v !== undefined, data: () => (v === undefined ? undefined : structuredClone(v)) };
  };
  const ref = (col, id) => ({
    id,
    _key: col + "/" + id,
    async get() {
      stats.reads++;
      return snap(col, id);
    },
    async set(obj, opts) {
      stats.writes++;
      const prev = data.get(col + "/" + id);
      data.set(col + "/" + id, opts && opts.merge && prev ? { ...prev, ...structuredClone(obj) } : structuredClone(obj));
    },
    async delete() {
      stats.deletes++;
      data.delete(col + "/" + id);
    },
  });
  const query = (col, field, dir, n) => ({
    orderBy: (f, d) => query(col, f, d, n),
    limit: (k) => query(col, field, dir, k),
    async get() {
      let rows = [...data.entries()].filter(([k]) => k.startsWith(col + "/")).map(([k, v]) => ({ id: k.slice(col.length + 1), v }));
      if (field) rows.sort((a, b) => (dir === "desc" ? -1 : 1) * ((a.v[field] || 0) - (b.v[field] || 0)));
      if (n) rows = rows.slice(0, n);
      stats.reads += Math.max(1, rows.length);
      return { docs: rows.map((r) => ({ id: r.id, exists: true, data: () => structuredClone(r.v) })) };
    },
  });
  const db = {
    stats,
    data,
    collection: (col) => ({ doc: (id) => ref(col, id), orderBy: (f, d) => query(col, f, d, 0), limit: (n) => query(col, null, null, n) }),
    async getAll(...refs) {
      stats.reads += refs.length;
      return refs.map((r) => {
        const [col, id] = r._key.split("/");
        return snap(col, id);
      });
    },
    batch() {
      const ops = [];
      return { set: (r, obj) => ops.push([r, obj]), commit: async () => { for (const [r, obj] of ops) await r.set(obj); } };
    },
  };
  return db;
}

function tiktokOrder(id, over = {}) {
  return {
    id,
    status: "COMPLETED",
    create_time: 1762880400, // 2025-11-11 17:00 UTC = 2025-11-12 00:00 WIB
    update_time: 1762966800,
    paid_time: 1762880500,
    commerce_platform: "TIKTOK_SHOP",
    buyer_email: "pembeli@example.com",
    buyer_message: "tolong cepat",
    user_id: "777",
    recipient_address: { name: "Budi", phone_number: "08123", full_address: "Jl. Rahasia 1" },
    payment: { currency: "IDR", sub_total: "300000", shipping_fee: "10000", seller_discount: "5000", platform_discount: "2000", total_amount: "303000", original_total_product_price: "310000" },
    line_items: [
      { id: "l1", sku_id: "S1", seller_sku: "inz-side-z10", product_id: "P1", product_name: "Side Bag Z10", sku_name: "Hitam", sale_price: "150000", original_price: "155000", seller_discount: "2500", platform_discount: "1000", currency: "IDR", display_status: "COMPLETED" },
      { id: "l2", sku_id: "S1", seller_sku: "inz-side-z10", product_id: "P1", product_name: "Side Bag Z10", sku_name: "Hitam", sale_price: "150000", original_price: "155000", seller_discount: "2500", platform_discount: "1000", currency: "IDR", display_status: "COMPLETED" },
      { id: "l3", sku_id: "S2", seller_sku: "INZ-TAIL-1", product_id: "P2", product_name: "Tail Bag", sku_name: "", sale_price: "90000", original_price: "90000", seller_discount: "0", platform_discount: "0", currency: "IDR", display_status: "CANCELLED" },
    ],
    ...over,
  };
}

function fakeFetch(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ url: u, init });
    const handler = routes[u.pathname];
    if (!handler) return new Response(JSON.stringify({ code: 404, message: "no route" }), { status: 404 });
    const out = await handler(u, init);
    return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  f.calls = calls;
  return f;
}

// ---------- signing ----------

test("sign string: sorted params without sign/access_token, path first, body last, secret on both sides", () => {
  const s = signString({ path: "/order/202309/orders/search", query: { timestamp: "1700000000", app_key: "k", sign: "x", access_token: "t", page_size: "50" }, body: '{"a":1}', appSecret: "SEC" });
  assert.equal(s, 'SEC/order/202309/orders/searchapp_keykpage_size50timestamp1700000000{"a":1}SEC');
  const h = sign({ path: "/order/202309/orders/search", query: { timestamp: "1700000000", app_key: "k", page_size: "50" }, body: '{"a":1}', appSecret: "SEC" });
  assert.equal(h, createHmac("sha256", "SEC").update(s).digest("hex"));
  assert.match(h, /^[0-9a-f]{64}$/);
});

test("sign: multipart bodies are not part of the signature; secret is required", () => {
  const a = signString({ path: "/p", query: { b: "2", a: "1" }, body: "BODY", multipart: true, appSecret: "S" });
  assert.equal(a, "S/pa1b2S");
  assert.throws(() => sign({ path: "/p", appSecret: "" }));
});

// ---------- token box ----------

test("tokens are sealed, readable only with the same secret, and tamper-evident", () => {
  const sealed = seal("ROW_access_token_value", "app-secret-1");
  assert.match(sealed, /^v1\./);
  assert.ok(!sealed.includes("ROW_access_token_value"));
  assert.equal(open(sealed, "app-secret-1"), "ROW_access_token_value");
  assert.throws(() => open(sealed, "other-secret"));
  const parts = sealed.split(".");
  parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
  assert.throws(() => open(parts.join("."), "app-secret-1"));
  assert.notEqual(seal("same", "k"), seal("same", "k"), "random IV per seal");
});

// ---------- order mapping ----------

test("order record keeps no buyer personal data and groups units per SKU", () => {
  const rec = toMarketplaceOrder(tiktokOrder("5770000000000001"));
  const json = JSON.stringify(rec);
  for (const pii of ["pembeli@example.com", "Budi", "08123", "Rahasia", "tolong cepat", "user_id", "recipient", "buyer"]) assert.ok(!json.includes(pii), "leaked " + pii);
  assert.equal(rec.date, "2025-11-12");
  assert.equal(rec.channel, "TikTok Shop");
  assert.equal(rec.statusLabel, "Selesai");
  assert.equal(rec.items.length, 2);
  const z10 = rec.items.find((i) => i.skuId === "S1");
  assert.deepEqual([z10.quantity, z10.cancelledQuantity, z10.unitSalePrice, z10.sellerDiscount, z10.platformDiscount], [2, 0, 150000, 5000, 2000]);
  const tail = rec.items.find((i) => i.skuId === "S2");
  assert.deepEqual([tail.quantity, tail.cancelledQuantity], [0, 1]);
  assert.equal(rec.itemCount, 2);
  assert.equal(rec.payment.totalAmount, 303000);
  assert.equal(rec.signature, orderSignature(rec));
  assert.equal(docIdFor("57/70"), "tiktok_5770");
});

test("Tokopedia orders get the Tokopedia channel; WIB date crosses midnight correctly", () => {
  assert.equal(channelOf({ commerce_platform: "TOKOPEDIA" }), "Tokopedia");
  assert.equal(channelOf({}), "TikTok Shop");
  assert.equal(wibDate(Date.UTC(2026, 10, 12, 16, 59, 59) / 1000), "2026-11-12");
  assert.equal(wibDate(Date.UTC(2026, 10, 12, 17, 0, 0) / 1000), "2026-11-13");
  assert.equal(wibDate(0), "");
});

// ---------- sales plan ----------

test("sales plan: only recorded statuses, SKU match, prices from the chosen basis", () => {
  const products = [
    { id: "p-z10", sku: "INZ-SIDE-Z10", name: "Side Bag Z10", sellingPrice: 160000, costPrice: 80000 },
    { id: "p-tail", sku: "INZ-TAIL-1", name: "Tail Bag", sellingPrice: 95000, costPrice: 40000 },
  ];
  const rec = toMarketplaceOrder(tiktokOrder("1"));
  assert.equal(normalizeSku(" inz-side z10 "), "INZ-SIDEZ10");
  assert.equal(matchProduct({ sellerSku: "inz-side-z10" }, products).id, "p-z10");

  const plan = planSalesFromOrder(rec, products);
  assert.equal(plan.record, true);
  assert.equal(plan.sales.length, 1, "cancelled line is skipped");
  const s = plan.sales[0];
  assert.deepEqual([s.productId, s.quantity, s.realUnitPrice, s.realRevenue, s.standardRevenue, s.modal, s.realProfit, s.marketplaceDifference, s.channel], ["p-z10", 2, 150000, 300000, 320000, 160000, 140000, -20000, "TikTok Shop"]);
  assert.equal(s.customer, "-");

  assert.equal(planSalesFromOrder(rec, products, { priceBasis: "original" }).sales[0].realUnitPrice, 155000);
  assert.equal(planSalesFromOrder(rec, products, { priceBasis: "sale_plus_platform" }).sales[0].realUnitPrice, 151000);
  assert.equal(planSalesFromOrder(toMarketplaceOrder(tiktokOrder("2", { status: "IN_TRANSIT" })), products).reason, "status-not-recorded");
  assert.equal(planSalesFromOrder(toMarketplaceOrder(tiktokOrder("3", { is_sample_order: true })), products).reason, "sample-order");
  const unmatched = planSalesFromOrder(rec, [products[1]]);
  assert.equal(unmatched.record, false);
  assert.equal(unmatched.reason, "unmatched-sku");
  assert.equal(unmatched.unmatched[0].sellerSku, "inz-side-z10");
});

// ---------- API client ----------

test("client signs calls, sends the access token as a header and maps tokens", async () => {
  const f = fakeFetch({
    "/api/v2/token/get": (u) => ({ code: 0, data: { access_token: "AT", access_token_expire_in: 2000000000, refresh_token: "RT", refresh_token_expire_in: 2100000000, seller_name: "Inzta", granted_scopes: ["seller.order.info"], echo: u.searchParams.get("grant_type") } }),
    "/authorization/202309/shops": () => ({ code: 0, data: { shops: [{ id: "1", name: "Inzta moto Ride", region: "ID", cipher: "CIPHER", code: "IDX" }] } }),
    "/order/202309/orders/search": () => ({ code: 0, data: { orders: [tiktokOrder("9")], next_page_token: "", total_count: 1 } }),
  });
  const c = createTikTokClient({ appKey: "KEY", appSecret: "SECRET", fetchImpl: f, now: () => 1700000000000 });
  const t = await c.exchangeCode("CODE");
  assert.deepEqual([t.accessToken, t.refreshToken, t.sellerName], ["AT", "RT", "Inzta"]);
  assert.equal(f.calls[0].url.searchParams.get("grant_type"), "authorized_code");

  const shops = await c.authorizedShops("AT");
  assert.equal(shops[0].cipher, "CIPHER");
  const call = f.calls[1];
  assert.equal(call.init.headers["x-tts-access-token"], "AT");
  assert.ok(!call.url.searchParams.has("access_token"));
  const q = Object.fromEntries(call.url.searchParams);
  const expected = sign({ path: "/authorization/202309/shops", query: q, appSecret: "SECRET" });
  assert.equal(q.sign, expected);

  const page = await c.searchOrders({ accessToken: "AT", shopCipher: "CIPHER", updateTimeGe: 1, updateTimeLt: 2 });
  const sc = f.calls[2];
  assert.equal(sc.init.method, "POST");
  assert.deepEqual(JSON.parse(sc.init.body), { update_time_ge: 1, update_time_lt: 2 });
  const sq = Object.fromEntries(sc.url.searchParams);
  assert.equal(sq.sign, sign({ path: "/order/202309/orders/search", query: sq, body: sc.init.body, appSecret: "SECRET" }));
  assert.equal(page.orders.length, 1);
});

test("client turns TikTok errors into TikTokApiError without leaking the secret", async () => {
  const f = fakeFetch({ "/api/v2/token/get": () => ({ code: 36004004, message: "invalid auth code", request_id: "r1" }) });
  const c = createTikTokClient({ appKey: "KEY", appSecret: "SUPERSECRET", fetchImpl: f });
  await assert.rejects(c.exchangeCode("BAD"), (e) => e.name === "TikTokApiError" && e.code === "36004004" && !e.message.includes("SUPERSECRET"));
  assert.throws(() => createTikTokClient({ appKey: "", appSecret: "" }), /TIKTOK_APP_KEY/);
  assert.match(authorizeUrl("7706703201979336469", "abc"), /^https:\/\/services\.tiktokshop\.com\/open\/authorize\?service_id=7706703201979336469&state=abc$/);
});

// ---------- service ----------

test("OAuth state is single use and expires", async () => {
  const db = fakeDb();
  const n = await svc.createOAuthState(db, { by: "owner@x", now: 1000 });
  assert.ok(await svc.consumeOAuthState(db, n, { now: 2000 }));
  assert.equal(await svc.consumeOAuthState(db, n, { now: 2000 }), null, "second use fails");
  const old = await svc.createOAuthState(db, { by: "owner@x", now: 1000 });
  assert.equal(await svc.consumeOAuthState(db, old, { now: 1000 + 11 * 60 * 1000 }), null, "expired");
  assert.equal(await svc.consumeOAuthState(db, "../bad", {}), null);
});

function fakeClient({ pages, refreshed = [] }) {
  let i = 0;
  return {
    refresh: async (rt) => {
      refreshed.push(rt);
      return { accessToken: "AT2", refreshToken: "RT2", accessTokenExpireIn: 1900000000, refreshTokenExpireIn: 2100000000 };
    },
    searchOrders: async (args) => {
      const p = pages[i++] || { orders: [], nextPageToken: "" };
      p.args = args;
      return p;
    },
  };
}

async function connected(db, { accessExpiresAt = 1900000000, refreshExpiresAt = 2100000000 } = {}) {
  await svc.saveConnection(db, {
    token: { accessToken: "AT", refreshToken: "RT", accessTokenExpireIn: accessExpiresAt, refreshTokenExpireIn: refreshExpiresAt, sellerName: "Inzta", grantedScopes: [] },
    shops: [{ id: "1", name: "Inzta moto Ride", region: "ID", cipher: "CIPHER", code: "IDX" }],
    by: "owner@x",
    secret: "S",
    now: 1762900000000,
  });
}

test("connection stores sealed tokens only and the public view hides them", async () => {
  const db = fakeDb();
  await connected(db);
  const raw = db.data.get("marketplace_connections/tiktok");
  assert.ok(raw.access.startsWith("v1.") && raw.refresh.startsWith("v1."));
  assert.ok(!JSON.stringify(raw).includes('"AT"') && !JSON.stringify(raw).includes('"RT"'));
  const pub = svc.publicConnection(raw);
  assert.equal(pub.status, "connected");
  assert.ok(!("access" in pub) && !("refresh" in pub) && !("shopCipher" in pub));
});

test("sync writes new orders, skips unchanged ones, and moves the cursor", async () => {
  const db = fakeDb();
  await connected(db);
  const now = 1762966800000 + 3600 * 1000;
  const c1 = fakeClient({ pages: [{ orders: [tiktokOrder("1"), tiktokOrder("2")], nextPageToken: "p2" }, { orders: [tiktokOrder("3")], nextPageToken: "" }] });
  const r1 = await svc.syncOrders({ db, client: c1, secret: "S", now, trigger: "cron" });
  assert.equal(r1.ok, true, r1.error);
  assert.deepEqual([r1.fetched, r1.written, r1.unchanged, r1.pages, r1.complete], [3, 3, 0, 2, true]);
  assert.equal(r1.windowFrom, Math.floor(now / 1000) - 30 * 86400, "first run backfills 30 days");
  assert.ok(db.data.has("marketplace_orders/tiktok_1"));
  const stored = JSON.stringify(db.data.get("marketplace_orders/tiktok_1"));
  assert.ok(!stored.includes("Budi") && !stored.includes("pembeli@example.com"));
  const conn = db.data.get("marketplace_connections/tiktok");
  assert.equal(conn.cursor, r1.windowTo);
  assert.equal(conn.lastSync.written, 3);

  const c2 = fakeClient({ pages: [{ orders: [tiktokOrder("1"), tiktokOrder("2", { status: "CANCELLED", update_time: 1762970000 })], nextPageToken: "" }] });
  const writesBefore = db.stats.writes;
  const r2 = await svc.syncOrders({ db, client: c2, secret: "S", now: now + 86400000 });
  assert.deepEqual([r2.fetched, r2.written, r2.unchanged], [2, 1, 1]);
  assert.equal(db.stats.writes - writesBefore, 2, "one changed order + the connection document");
  assert.equal(r2.windowFrom, conn.cursor - 86400, "one day overlap");
  assert.equal(db.data.get("marketplace_orders/tiktok_2").status, "CANCELLED");

  const latest = await svc.latestOrders(db, 10);
  assert.equal(latest[0].orderId, "2");
});

test("sync stops at maxPages and resumes from the newest update seen", async () => {
  const db = fakeDb();
  await connected(db);
  const pages = [
    { orders: [tiktokOrder("1", { update_time: 1762900100 })], nextPageToken: "a" },
    { orders: [tiktokOrder("2", { update_time: 1762900200 })], nextPageToken: "b" },
  ];
  const r = await svc.syncOrders({ db, client: fakeClient({ pages }), secret: "S", now: 1762966800000, maxPages: 2 });
  assert.equal(r.complete, false);
  assert.equal(db.data.get("marketplace_connections/tiktok").cursor, 1762900200);
});

test("token is refreshed a day before expiry; an expired refresh token marks the shop expired", async () => {
  const db = fakeDb();
  const now = 1800000000000;
  await connected(db, { accessExpiresAt: 1800000000 + 3600 });
  const refreshed = [];
  const r = await svc.syncOrders({ db, client: fakeClient({ pages: [], refreshed }), secret: "S", now });
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(refreshed, ["RT"]);
  const conn = db.data.get("marketplace_connections/tiktok");
  assert.equal(open(conn.access, "S"), "AT2");
  assert.equal(conn.accessExpiresAt, 1900000000);

  const db2 = fakeDb();
  await connected(db2, { accessExpiresAt: 1, refreshExpiresAt: 2 });
  const r2 = await svc.syncOrders({ db: db2, client: fakeClient({ pages: [] }), secret: "S", now });
  assert.equal(r2.ok, false);
  assert.equal(r2.code, "EXPIRED");
  assert.equal(db2.data.get("marketplace_connections/tiktok").status, "expired");
});

test("sync without a connection reports NOT_CONNECTED and records the failure", async () => {
  const db = fakeDb();
  const r = await svc.syncOrders({ db, client: fakeClient({ pages: [] }), secret: "S" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "NOT_CONNECTED");
});
