// Turns a TikTok Shop order (Order API 202309) into the small record the ERP keeps in `marketplace_orders`.
// Rules:
// - Allowlist only. Buyer name, phone, address, email, user id and buyer messages are never copied, even when the
//   API returns them (A-PII: the ERP must not hold buyer personal data).
// - Amounts come from TikTok as strings in the shop currency (IDR); they are stored as integers.
// - `date` is the order creation day in WIB (UTC+7), the same calendar the ERP sales use.
// - One TikTok line item is one unit; items are grouped per SKU with a quantity.
// Pure module: tested in scripts/marketplace-tiktok.test.mjs.
import { createHash } from "node:crypto";

export const PLATFORM = "tiktok";

export const STATUS_LABELS = {
  UNPAID: "Belum dibayar",
  ON_HOLD: "Ditahan",
  AWAITING_SHIPMENT: "Perlu dikirim",
  PARTIALLY_SHIPPING: "Dikirim sebagian",
  AWAITING_COLLECTION: "Menunggu pickup",
  IN_TRANSIT: "Dalam pengiriman",
  DELIVERED: "Terkirim",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

const WIB_OFFSET_SECONDS = 7 * 3600;

export function wibDate(unixSeconds) {
  const t = Number(unixSeconds);
  if (!isFinite(t) || t <= 0) return "";
  return new Date((t + WIB_OFFSET_SECONDS) * 1000).toISOString().slice(0, 10);
}

// Tokopedia orders arrive through the same API since Dual Listing (Indonesia); the order says where it was placed.
export function channelOf(order) {
  return String(order && order.commerce_platform ? order.commerce_platform : "").toUpperCase() === "TOKOPEDIA"
    ? "Tokopedia"
    : "TikTok Shop";
}

export function money(v) {
  const n = Number(v);
  return isFinite(n) ? Math.round(n) : 0;
}

function text(v, max = 300) {
  return typeof v === "string" ? v.slice(0, max) : v === undefined || v === null ? "" : String(v).slice(0, max);
}

function int(v) {
  const n = Number(v);
  return isFinite(n) ? Math.trunc(n) : 0;
}

export function groupItems(lineItems) {
  const bySku = new Map();
  for (const li of Array.isArray(lineItems) ? lineItems : []) {
    const key = text(li.sku_id) || text(li.seller_sku) || text(li.product_id) || text(li.id);
    const qty = li.quantity !== undefined ? Math.max(1, int(li.quantity)) : 1;
    let g = bySku.get(key);
    if (!g) {
      g = {
        skuId: text(li.sku_id, 64),
        sellerSku: text(li.seller_sku, 100),
        productId: text(li.product_id, 64),
        productName: text(li.product_name, 255),
        skuName: text(li.sku_name, 255),
        quantity: 0,
        cancelledQuantity: 0,
        unitSalePrice: money(li.sale_price),
        unitOriginalPrice: money(li.original_price),
        sellerDiscount: 0,
        platformDiscount: 0,
        isGift: !!li.is_gift,
      };
      bySku.set(key, g);
    }
    const cancelled = String(li.display_status || "").toUpperCase() === "CANCELLED";
    if (cancelled) g.cancelledQuantity += qty;
    else g.quantity += qty;
    g.sellerDiscount += money(li.seller_discount);
    g.platformDiscount += money(li.platform_discount);
  }
  return [...bySku.values()];
}

export function orderSignature(rec) {
  const { syncedAt, signature, ...rest } = rec || {};
  return createHash("sha1").update(JSON.stringify(rest)).digest("hex");
}

export function toMarketplaceOrder(order) {
  if (!order || !order.id) throw new Error("TikTok order without id");
  const p = order.payment || {};
  const items = groupItems(order.line_items);
  const status = text(order.status, 40).toUpperCase();
  const rec = {
    platform: PLATFORM,
    orderId: text(order.id, 64),
    channel: channelOf(order),
    commercePlatform: text(order.commerce_platform, 40),
    status,
    statusLabel: STATUS_LABELS[status] || status,
    createTime: int(order.create_time),
    updateTime: int(order.update_time),
    paidTime: int(order.paid_time),
    date: wibDate(order.create_time),
    isSample: !!order.is_sample_order,
    cancelReason: text(order.cancel_reason, 200),
    currency: text(p.currency || (Array.isArray(order.line_items) && order.line_items[0] && order.line_items[0].currency) || "IDR", 8),
    payment: {
      subTotal: money(p.sub_total),
      shippingFee: money(p.shipping_fee),
      sellerDiscount: money(p.seller_discount),
      platformDiscount: money(p.platform_discount),
      totalAmount: money(p.total_amount),
      originalProductPrice: money(p.original_total_product_price),
    },
    items,
    itemCount: items.reduce((a, i) => a + i.quantity, 0),
  };
  rec.signature = orderSignature(rec);
  return rec;
}

export function docIdFor(orderId) {
  return PLATFORM + "_" + String(orderId).replace(/[^A-Za-z0-9_-]/g, "");
}
