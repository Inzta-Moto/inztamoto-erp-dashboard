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

// Penjualan cards follow the table filters (Bang Raja, 18 Nov 2026).
const period = [
   { date: "2026-10-31", channel: "Shopee", quantity: 2, realRevenue: 500000, realProfit: 300000 },
   { date: "2026-10-31", channel: "Tokopedia", quantity: 1, realRevenue: 100000, realProfit: 60000 },
   { date: "2026-11-01", channel: "Website", quantity: 1, realRevenue: 200000, realProfit: 120000 },
   { date: "2026-11-17", channel: "Tokopedia", quantity: 3, realRevenue: 300000, realProfit: 150000 },
   { date: "2026-11-17", channel: "WhatsApp", resellerId: "r1", quantity: 1, realRevenue: 90000, realProfit: 40000 },
   { date: "2026-11-17", channel: "Reseller", resellerId: "r2", quantity: 2, realRevenue: 180000, realProfit: 80000 },
   { date: "2025-11-05", channel: "Tokopedia", quantity: 1, realRevenue: 70000, realProfit: 30000 },
   { channel: "Shopee", quantity: 1, realRevenue: 10000, realProfit: 5000 },
];
const tot = (list) => C.summarize(list, "all");

test("matchesPeriod: all, month, year, date and a sale without date", () => {
   assert.equal(C.matchesPeriod("2026-11-17", "all", "all", "all"), true);
   assert.equal(C.matchesPeriod("2026-11-17", "11", "all", "all"), true);
   assert.equal(C.matchesPeriod("2026-11-17", "10", "all", "all"), false);
   assert.equal(C.matchesPeriod("2026-11-17", "all", "2025", "all"), false);
   assert.equal(C.matchesPeriod("2026-11-17", "11", "2026", "2026-11-17"), true);
   assert.equal(C.matchesPeriod("2026-11-17", "all", "all", "2026-11-16"), false);
   assert.equal(C.matchesPeriod(undefined, "all", "all", "all"), true);
   assert.equal(C.matchesPeriod(undefined, "11", "all", "all"), false);
   assert.equal(C.matchesPeriod("2026-11-17", undefined, undefined, undefined), true);
});

test("no filter keeps every sale; Semua Channel equals the old all-sales totals", () => {
   assert.equal(C.filterSales(period, {}).length, period.length);
   assert.deepEqual(tot(C.filterSales(period, { channel: "all", month: "all", year: "all", date: "all" })), tot(period));
});

test("channel filter: Tokopedia, Website, and Reseller with legacy WhatsApp", () => {
   assert.deepEqual(tot(C.filterSales(period, { channel: "Tokopedia" })), { orders: 3, qty: 5, revenue: 470000, profit: 240000 });
   assert.deepEqual(tot(C.filterSales(period, { channel: "Website" })), { orders: 1, qty: 1, revenue: 200000, profit: 120000 });
   assert.deepEqual(tot(C.filterSales(period, { channel: "Reseller" })), { orders: 2, qty: 3, revenue: 270000, profit: 120000 });
   assert.deepEqual(tot(C.filterSales(period, { channel: "Reseller", resellerId: "r1" })), { orders: 1, qty: 1, revenue: 90000, profit: 40000 });
   // resellerId only narrows the Reseller channel, as in renderSales()
   assert.equal(C.filterSales(period, { channel: "Tokopedia", resellerId: "r1" }).length, 3);
});

test("month and year filters, alone and with a channel", () => {
   assert.deepEqual(tot(C.filterSales(period, { month: "11" })).revenue, 840000);
   assert.deepEqual(tot(C.filterSales(period, { month: "11", year: "2026" })).revenue, 770000);
   assert.deepEqual(tot(C.filterSales(period, { month: "10", year: "2026" })).revenue, 600000);
   assert.deepEqual(tot(C.filterSales(period, { year: "2025" })).revenue, 70000);
   assert.deepEqual(tot(C.filterSales(period, { channel: "Tokopedia", month: "11", year: "2026" })), { orders: 1, qty: 3, revenue: 300000, profit: 150000 });
   assert.deepEqual(tot(C.filterSales(period, { channel: "Tokopedia", month: "11", date: "2026-11-17" })).revenue, 300000);
});

test("Shopee card: same period, channel fixed to Shopee", () => {
   const oct = C.filterSales(period, { month: "10", year: "2026" });
   assert.deepEqual(C.summarize(oct, "Shopee"), { orders: 1, qty: 2, revenue: 500000, profit: 300000 });
   const nov = C.filterSales(period, { month: "11", year: "2026" });
   assert.deepEqual(C.summarize(nov, "Shopee"), { orders: 0, qty: 0, revenue: 0, profit: 0 });
});
