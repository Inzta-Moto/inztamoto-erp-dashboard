// Tests for public/legacy/channel-summary.js. Run: node --test scripts/
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../public/legacy/channel-summary.js");

// Made-up sales covering every fallback: realRevenue, old revenue only, nothing, and zero values.
const sales = [
   { channel: "Shopee", quantity: 2, realRevenue: 580000, realProfit: 390000, revenue: 600000, profit: 400000 },
   { channel: "Shopee", quantity: 1, revenue: 130000, profit: 90000 },
   { channel: "Shopee", quantity: 1 },
   { channel: "Shopee", quantity: 3, realRevenue: 0, realProfit: 0, revenue: 999999, profit: 999999 },
   { channel: "Tokopedia", quantity: 5, realRevenue: 700000, realProfit: 300000 },
   { channel: "TikTok Shop", quantity: 1, realRevenue: 150000, realProfit: 60000 },
   { channel: "shopee", quantity: 1, realRevenue: 50000, realProfit: 10000 },
   { channel: "WhatsApp", quantity: 1, realRevenue: 200000, realProfit: 80000 },
   { channel: "Reseller", quantity: 2, realRevenue: 400000, realProfit: 160000 },
   { quantity: 1, realRevenue: 10000, realProfit: 5000 },
];

test("summarize counts only the exact channel value, like the table filter", () => {
   assert.deepEqual(C.summarize(sales, "Shopee"), { orders: 4, qty: 7, revenue: 710000, profit: 480000 });
});

test("realRevenue 0 wins over an old revenue value", () => {
   const s = C.summarize([sales[3]], "Shopee");
   assert.equal(s.revenue, 0);
   assert.equal(s.profit, 0);
});

test("Reseller includes legacy WhatsApp sales", () => {
   assert.deepEqual(C.summarize(sales, "Reseller"), { orders: 2, qty: 3, revenue: 600000, profit: 240000 });
});

test("channel totals add up to the all-channel totals the daily cards show", () => {
   const all = sales.reduce(
      (a, s) => ({ revenue: a.revenue + C.saleRevenue(s), profit: a.profit + C.saleProfit(s) }),
      { revenue: 0, profit: 0 },
   );
   const channels = ["Shopee", "Tokopedia", "TikTok Shop", "shopee", "Reseller", ""];
   const sum = channels.map((c) => C.summarize(sales, c)).reduce(
      (a, s) => ({ revenue: a.revenue + s.revenue, profit: a.profit + s.profit }),
      { revenue: 0, profit: 0 },
   );
   assert.deepEqual(sum, all);
});

test("empty or missing input gives zeros", () => {
   const zero = { orders: 0, qty: 0, revenue: 0, profit: 0 };
   assert.deepEqual(C.summarize([], "Shopee"), zero);
   assert.deepEqual(C.summarize(undefined, "Shopee"), zero);
   assert.deepEqual(C.summarize([null], "Shopee"), zero);
});

test("sharePercent rounds, clamps and returns null without a total", () => {
   assert.equal(C.sharePercent(2150000, 3080000), 70);
   assert.equal(C.sharePercent(0, 3080000), 0);
   assert.equal(C.sharePercent(100, 100), 100);
   assert.equal(C.sharePercent(5, 0), null);
   assert.equal(C.sharePercent(5, -10), null);
});
