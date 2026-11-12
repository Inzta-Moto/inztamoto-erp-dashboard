// Plans ERP `sales` rows from one `marketplace_orders` record. Nothing here writes: the sync only stores marketplace
// orders, and turning them into sales waits for three owner decisions (Trello card "integrasi API TikTok Shop"):
//   recordStatuses  which order statuses become a sale (proposal: COMPLETED only)
//   priceBasis      "sale": what the buyer paid per unit after discounts (sale_price)
//                   "original": the listed price before discounts (original_price)
//                   "sale_plus_platform": sale_price plus the platform-funded discount (what the shop is credited)
//   reduceStock     whether the ERP product stock goes down (a stock_movements "out" row per sale)
// The field set follows window.saveSale in public/legacy/app-runtime.js so reports treat these rows like manual ones.
// Pure module: tested in scripts/marketplace-tiktok.test.mjs.

export const DEFAULT_OPTIONS = Object.freeze({
  recordStatuses: ["COMPLETED"],
  priceBasis: "sale",
  reduceStock: false,
});

export function normalizeSku(v) {
  return String(v || "").trim().toUpperCase().replace(/\s+/g, "");
}

// ERP products are matched on their `sku` field against the marketplace seller SKU.
export function matchProduct(item, products) {
  const want = normalizeSku(item && item.sellerSku);
  if (!want) return null;
  return (products || []).find((p) => normalizeSku(p.sku) === want) || null;
}

function unitPrice(item, basis) {
  const qty = item.quantity + item.cancelledQuantity || 1;
  if (basis === "original") return item.unitOriginalPrice || item.unitSalePrice;
  if (basis === "sale_plus_platform") return item.unitSalePrice + Math.round((item.platformDiscount || 0) / qty);
  return item.unitSalePrice;
}

export function planSalesFromOrder(order, products, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const result = { record: false, reason: "", sales: [], unmatched: [] };
  if (!order) return { ...result, reason: "no-order" };
  if (order.isSample) return { ...result, reason: "sample-order" };
  if (!opts.recordStatuses.includes(order.status)) return { ...result, reason: "status-not-recorded" };

  for (const item of order.items || []) {
    if (!item.quantity) continue; // fully cancelled line
    const p = matchProduct(item, products);
    if (!p) {
      result.unmatched.push({ sellerSku: item.sellerSku, productName: item.productName, skuName: item.skuName });
      continue;
    }
    const qty = item.quantity;
    const sellingPrice = Number(p.sellingPrice) || 0;
    const costPrice = Number(p.costPrice) || 0;
    const realUnitPrice = unitPrice(item, opts.priceBasis);
    const standardRevenue = sellingPrice * qty;
    const realRevenue = realUnitPrice * qty;
    const modal = costPrice * qty;
    result.sales.push({
      date: order.date,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      quantity: qty,
      costPrice,
      sellingPrice,
      realUnitPrice,
      standardRevenue,
      realRevenue,
      revenue: realRevenue,
      modal,
      realProfit: realRevenue - modal,
      profit: realRevenue - modal,
      marketplaceDifference: realRevenue - standardRevenue,
      channel: order.channel,
      resellerId: "",
      resellerName: "",
      expedition: "",
      district: "",
      city: "",
      customer: "-",
      notes: order.channel + " #" + order.orderId,
      marketplace: order.platform,
      marketplaceOrderId: order.orderId,
      reduceStock: !!opts.reduceStock,
    });
  }
  result.record = result.sales.length > 0 && result.unmatched.length === 0;
  result.reason = result.unmatched.length ? "unmatched-sku" : result.sales.length ? "ok" : "no-items";
  return result;
}
