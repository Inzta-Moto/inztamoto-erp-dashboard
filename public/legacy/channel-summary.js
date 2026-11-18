// Totals for the cards on the Penjualan page (Bang Raja, 18 Nov 2026): the three daily cards follow the
// table's Channel, Bulan, Tahun and date filters; the 4th card "Penjualan Shopee" follows the same period
// with the channel fixed to Shopee. Sums the sales the admin already entered in the ERP; no marketplace
// API, no extra Firestore read.
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
   // "all" (Semua Channel) matches every sale.
   function matchesChannel(saleChannel, channel) {
      if (channel === "all") return true;
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

   // Same rule as matchesMonthYear() and the date filter of the Penjualan table: "all" or empty means no
   // limit; month is "01".."12", year "2026", date "YYYY-MM-DD".
   function matchesPeriod(dateStr, month, year, date) {
      var m = month || "all";
      var y = year || "all";
      var d = date || "all";
      if (typeof dateStr !== "string" || !dateStr) return m === "all" && y === "all" && d === "all";
      if (y !== "all" && dateStr.substring(0, 4) !== y) return false;
      if (m !== "all" && dateStr.substring(5, 7) !== m) return false;
      if (d !== "all" && dateStr !== d) return false;
      return true;
   }

   // The table's filters without the search box: f = { channel, resellerId, month, year, date }.
   // A reseller is only narrowed when the channel is "Reseller", as in renderSales().
   function filterSales(sales, f) {
      f = f || {};
      var channel = f.channel || "all";
      var resellerId = f.resellerId || "all";
      return (sales || []).filter(function (s) {
         if (!s) return false;
         if (!matchesChannel(s.channel || "", channel)) return false;
         if (channel === "Reseller" && resellerId !== "all" && s.resellerId !== resellerId) return false;
         return matchesPeriod(s.date, f.month, f.year, f.date);
      });
   }

   return {
      matchesPeriod: matchesPeriod,
      filterSales: filterSales,
      saleRevenue: saleRevenue,
      saleProfit: saleProfit,
      matchesChannel: matchesChannel,
      summarize: summarize,
   };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ChannelSummary;
