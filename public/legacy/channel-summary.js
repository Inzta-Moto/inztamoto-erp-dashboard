// Per-channel totals for the Penjualan page (card "Penjualan Shopee", Bang Raja 18 Nov 2026).
// Sums the sales the admin already entered in the ERP; no marketplace API, no extra Firestore read.
// Pure functions only: no DOM and no Firestore, so scripts/channel-summary.test.cjs can run them under node --test.
var ChannelSummary = (function () {
   // Same fallbacks as the Penjualan table and the daily cards: realRevenue/realProfit for new sales,
   // revenue/profit for old ones.
   function saleRevenue(s) {
      return s.realRevenue !== undefined ? Number(s.realRevenue) || 0 : Number(s.revenue) || 0;
   }

   function saleProfit(s) {
      return s.realProfit !== undefined ? Number(s.realProfit) || 0 : Number(s.profit) || 0;
   }

   // "Reseller" also covers the legacy "WhatsApp" value, as isChannelMatch() does in app-runtime.js.
   function matchesChannel(saleChannel, channel) {
      if (channel === "Reseller") return saleChannel === "Reseller" || saleChannel === "WhatsApp";
      return saleChannel === channel;
   }

   function summarize(sales, channel) {
      var out = { orders: 0, qty: 0, revenue: 0, profit: 0 };
      (sales || []).forEach(function (s) {
         if (!s || !matchesChannel(s.channel || "", channel)) return;
         out.orders += 1;
         out.qty += Number(s.quantity) || 0;
         out.revenue += saleRevenue(s);
         out.profit += saleProfit(s);
      });
      return out;
   }

   // Whole percent of `part` in `total`; null when there is no total to compare with.
   function sharePercent(part, total) {
      if (!total || total <= 0) return null;
      var pct = Math.round((part / total) * 100);
      return Math.max(0, Math.min(100, pct));
   }

   return {
      saleRevenue: saleRevenue,
      saleProfit: saleProfit,
      matchesChannel: matchesChannel,
      summarize: summarize,
      sharePercent: sharePercent,
   };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ChannelSummary;
