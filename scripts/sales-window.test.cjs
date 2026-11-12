// Tests for public/legacy/sales-window.js. Run: node --test scripts/
const test = require("node:test");
const assert = require("node:assert/strict");
const W = require("../public/legacy/sales-window.js");

// Deterministic made-up sales: several products, channels (incl. legacy WhatsApp), days, a few
// records without realRevenue or revenue, so every fallback path is exercised.
function dummySales(n) {
   let seed = 7;
   const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
   const channels = ["Shopee", "Tokopedia", "TikTok Shop", "Website", "Reseller", "WhatsApp", "Offline Store"];
   const out = [];
   for (let i = 0; i < n; i++) {
      const month = ["2026-07", "2026-08", "2026-09"][Math.floor(rnd() * 3)];
      const day = String(1 + Math.floor(rnd() * 28)).padStart(2, "0");
      const qty = 1 + Math.floor(rnd() * 3);
      const sell = 50000 + Math.floor(rnd() * 20) * 5000;
      const cost = Math.round(sell * 0.5);
      const s = {
         id: "s" + i,
         date: `${month}-${day}`,
         productId: "p" + Math.floor(rnd() * 6),
         productName: "Produk",
         channel: channels[Math.floor(rnd() * channels.length)],
         quantity: qty,
         sellingPrice: sell,
         costPrice: cost,
      };
      const kind = i % 10;
      if (kind !== 0) s.revenue = sell * qty - (kind === 3 ? 1500 : 0);
      if (kind > 4) s.realRevenue = s.revenue - 500;
      if (kind !== 1) s.profit = (s.revenue || sell * qty) - cost * qty;
      out.push(s);
   }
   return out;
}

// The sums the Dashboard chart code takes from state.sales (renderChannelChart, renderCategoryChart,
// renderTopSellingList, get*TrendData, get*RevCostData), written the same way as in app-runtime.js.
function dashboardSums(sales) {
   const add = (o, k, v) => (o[k] = (o[k] || 0) + v);
   const trend = (s) =>
      s.realRevenue !== undefined && !isNaN(s.realRevenue)
         ? Number(s.realRevenue)
         : s.revenue !== undefined && !isNaN(s.revenue)
           ? Number(s.revenue)
           : (Number(s.sellingPrice) || 0) * (Number(s.quantity) || 0);
   const r = { channel: {}, product: {}, dayTrend: {}, dayCost: {}, monthTrend: {} };
   sales.forEach((s) => {
      add(r.channel, s.channel === "WhatsApp" ? "Reseller" : s.channel || "-", s.revenue || 0);
      add(r.product, s.productId, s.revenue || 0);
      add(r.dayTrend, s.date, trend(s));
      add(r.dayCost, s.date, (Number(s.costPrice) || 0) * (Number(s.quantity) || 0));
      add(r.monthTrend, s.date.substring(0, 7), trend(s));
   });
   return r;
}

test("month helpers", () => {
   assert.equal(W.addMonths("2026-01", -1), "2025-12");
   assert.equal(W.addMonths("2026-12", 1), "2027-01");
   assert.equal(W.addMonths("2026-03", -14), "2025-01");
   assert.equal(W.windowStartMonth("2026-11-12"), "2026-10");
   assert.equal(W.windowStartDate("2026-01-05"), "2025-12-01");
   assert.deepEqual(W.monthsBetween("2026-07", "2026-10"), ["2026-07", "2026-08", "2026-09"]);
   assert.deepEqual(W.monthsBetween("2026-10", "2026-10"), []);
});

test("synthetic rows from summaries give the same Dashboard sums as the real sales", () => {
   const sales = dummySales(600);
   const months = [...new Set(sales.map((s) => s.date.substring(0, 7)))];
   const synthetic = months.flatMap((m) => W.syntheticSales(W.buildMonthSummary(m, sales)));
   assert.ok(synthetic.length < sales.length, "summaries should be smaller than the raw sales");
   assert.deepEqual(dashboardSums(synthetic), dashboardSums(sales));
});

test("summary keeps counts and totals per month", () => {
   const sales = dummySales(300);
   const sum = W.buildMonthSummary("2026-08", sales);
   const real = sales.filter((s) => s.date.startsWith("2026-08"));
   assert.equal(sum.saleCount, real.length);
   assert.equal(sum.rows.reduce((a, r) => a + r.k, 0), real.length);
   assert.equal(sum.rows.reduce((a, r) => a + r.q, 0), real.reduce((a, s) => a + s.quantity, 0));
   assert.ok(W.isValidSummary(sum));
   assert.ok(!W.isValidSummary(Object.assign({}, sum, { stale: true })));
   assert.ok(!W.isValidSummary(Object.assign({}, sum, { version: 0 })));
   assert.equal(W.buildMonthSummary("2026-01", sales).saleCount, 0);
});

test("summary plan", () => {
   assert.deepEqual(W.summaryPlan([], "2026-10"), { full: true, missing: [] });
   assert.deepEqual(W.summaryPlan(["2026-10", "2026-11"], "2026-10"), { full: true, missing: [] });
   assert.deepEqual(W.summaryPlan(["2026-05", "2026-07"], "2026-10"), { full: false, missing: ["2026-06", "2026-08", "2026-09"] });
   assert.deepEqual(W.summaryPlan(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"], "2026-10"), { full: false, missing: [] });
});

test("filters that reach before the live window", () => {
   const ws = "2026-10-01";
   assert.equal(W.filterNeedsHistory("all", "all", "all", ws), true);
   assert.equal(W.filterNeedsHistory("all", "all", "2026-11-12", ws), false);
   assert.equal(W.filterNeedsHistory("all", "all", "2026-09-30", ws), true);
   assert.equal(W.filterNeedsHistory("10", "2026", "all", ws), false);
   assert.equal(W.filterNeedsHistory("09", "2026", "all", ws), true);
   assert.equal(W.filterNeedsHistory("all", "2026", "all", ws), true);
   assert.equal(W.filterNeedsHistory("10", "all", "all", ws), true);
   assert.equal(W.filterNeedsHistory("all", "2027", "", "2027-01-01"), false);
});

test("report periods that reach before the live window", () => {
   const ws = "2026-10-01";
   assert.equal(W.reportNeedsHistory("daily", "all", "2026", "2026-11-12", "2026-11-12", ws), false);
   assert.equal(W.reportNeedsHistory("daily", "all", "2026", "2026-09-01", "2026-11-12", ws), true);
   assert.equal(W.reportNeedsHistory("weekly", "all", "2026", "", "2026-11-12", ws), false);
   assert.equal(W.reportNeedsHistory("weekly", "all", "2026", "", "2026-10-03", ws), true);
   assert.equal(W.reportNeedsHistory("monthly", "11", "2026", "", "2026-11-12", ws), false);
   assert.equal(W.reportNeedsHistory("monthly", "08", "2026", "", "2026-11-12", ws), true);
   assert.equal(W.reportNeedsHistory("yearly", "all", "2026", "", "2026-11-12", ws), true);
   assert.equal(W.reportNeedsHistory("yearly", "all", "2027", "", "2027-11-12", "2027-10-01"), true);
});
