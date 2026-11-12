// Read-saving window for the big, growing collections (sales, stock_movements, production_purchases).
// Listeners keep only the current and the previous month ("live window"); older months come from
// sales_monthly summaries (for the Dashboard charts) or from a one-time read when a page asks for them.
// Pure functions only: no DOM and no Firestore, so scripts/sales-window.test.cjs can run them under node --test.
var SalesWindow = (function () {
   var SUMMARY_VERSION = 1;

   function pad2(n) {
      return String(n).padStart(2, "0");
   }

   function monthOf(dateStr) {
      return typeof dateStr === "string" ? dateStr.substring(0, 7) : "";
   }

   // "2026-11" + (-1) -> "2026-10"; handles year boundaries.
   function addMonths(ym, delta) {
      var y = parseInt(ym.substring(0, 4), 10);
      var m = parseInt(ym.substring(5, 7), 10) - 1 + delta;
      y += Math.floor(m / 12);
      m = ((m % 12) + 12) % 12;
      return y + "-" + pad2(m + 1);
   }

   // The app takes "today" from toISOString() (UTC), so the window does the same to stay consistent.
   function windowStartMonth(todayStr) {
      return addMonths(monthOf(todayStr), -1);
   }

   function windowStartDate(todayStr) {
      return windowStartMonth(todayStr) + "-01";
   }

   // Months from `from` up to but not including `toExclusive`, both "YYYY-MM".
   function monthsBetween(from, toExclusive) {
      var out = [];
      if (!from || !toExclusive || from >= toExclusive) return out;
      for (var m = from; m < toExclusive; m = addMonths(m, 1)) out.push(m);
      return out;
   }

   function num(v) {
      var n = Number(v);
      return isFinite(n) ? n : 0;
   }

   // Same rules as getSaleRevenue / getSaleProfit / getTrendValue in app-runtime.js.
   function saleRevenue(s) {
      var rev = s.revenue !== undefined ? s.revenue : null;
      if (rev !== null && !isNaN(rev)) return rev;
      return (s.sellingPrice || 0) * (s.quantity || 0) || 0;
   }

   function saleProfit(s) {
      var pr = s.profit !== undefined ? s.profit : null;
      if (pr !== null && !isNaN(pr)) return pr;
      return Math.max(0, ((s.sellingPrice || 0) - (s.costPrice || 0)) * (s.quantity || 0));
   }

   function trendValue(s) {
      if (s.realRevenue !== undefined && !isNaN(s.realRevenue)) return Number(s.realRevenue);
      if (s.revenue !== undefined && !isNaN(s.revenue)) return Number(s.revenue);
      return (Number(s.sellingPrice) || 0) * (Number(s.quantity) || 0);
   }

   // One summary per month: rows grouped by date + product + stored channel, holding every sum the
   // Dashboard charts read. Channel stays raw (normalizeChannelValue runs later, as for real sales).
   function buildMonthSummary(month, sales) {
      var byKey = {};
      var rows = [];
      var count = 0;
      (sales || []).forEach(function (s) {
         if (monthOf(s.date) !== month) return;
         count++;
         var key = s.date + "|" + (s.productId || "") + "|" + (s.channel || "");
         var r = byKey[key];
         if (!r) {
            r = { d: s.date, p: s.productId || "", n: s.productName || "", c: s.channel || "", q: 0, rv: 0, rr: 0, tv: 0, pf: 0, co: 0, k: 0 };
            byKey[key] = r;
            rows.push(r);
         }
         r.k += 1;
         r.q += num(s.quantity);
         r.rv += num(saleRevenue(s));
         r.rr += num(s.revenue || 0);
         r.tv += num(trendValue(s));
         r.pf += num(saleProfit(s));
         r.co += num(s.costPrice) * num(s.quantity);
      });
      rows.sort(function (a, b) {
         return a.d < b.d ? -1 : a.d > b.d ? 1 : 0;
      });
      return { month: month, saleCount: count, rows: rows, version: SUMMARY_VERSION };
   }

   // Turns a summary back into sale-shaped rows for the Dashboard chart code. Each row reproduces the
   // group's sums under the fields that code reads: `revenue` (charts use s.revenue || 0), `realRevenue`
   // (getTrendValue) and costPrice * quantity (cost lines; quantity is 1 so the cost stays exact).
   function syntheticSales(summary) {
      return ((summary && summary.rows) || []).map(function (r, i) {
         return {
            id: "__summary_" + summary.month + "_" + i,
            date: r.d,
            productId: r.p,
            productName: r.n,
            channel: r.c,
            quantity: 1,
            revenue: r.rr,
            realRevenue: r.tv,
            profit: r.pf,
            costPrice: r.co,
            sellingPrice: r.rv,
            __synthetic: true,
            __qty: r.q,
            __count: r.k,
         };
      });
   }

   // Order-independent fingerprint of a summary, to compare a stored one with a freshly built one.
   function summarySignature(summary) {
      var rows = ((summary && summary.rows) || []).map(function (r) {
         return [r.d, r.p, r.n, r.c, r.q, r.rv, r.rr, r.tv, r.pf, r.co, r.k].join("|");
      });
      rows.sort();
      return (summary ? summary.saleCount : 0) + "#" + rows.join("\n");
   }

   function isValidSummary(doc) {
      return !!doc && doc.version === SUMMARY_VERSION && !doc.stale && Array.isArray(doc.rows) && typeof doc.saleCount === "number";
   }

   // Which months need a summary built: every month before the window, from the earliest month known.
   // With no summaries at all the earliest month is unknown, so the caller builds from a full read.
   function summaryPlan(existingMonths, startMonth) {
      var valid = (existingMonths || []).filter(function (m) {
         return m < startMonth;
      });
      if (!valid.length) return { full: true, missing: [] };
      var earliest = valid.slice().sort()[0];
      var have = {};
      valid.forEach(function (m) {
         have[m] = true;
      });
      return {
         full: false,
         missing: monthsBetween(earliest, startMonth).filter(function (m) {
            return !have[m];
         }),
      };
   }

   // Does a month/year/date filter reach dates before the live window? `month`/`year` use the app's
   // "all" convention; `date` is "YYYY-MM-DD", "all" or empty.
   function filterNeedsHistory(month, year, date, wsDate) {
      if (date && date !== "all") return date < wsDate;
      if (year === "all" || !year) return true;
      if (month === "all" || !month) return year + "-01-01" < wsDate;
      return year + "-" + month + "-01" < wsDate;
   }

   // Report periods (filterByReportPeriod): daily uses `date`, weekly the last 7 days, monthly
   // month/year, yearly the year.
   function reportNeedsHistory(period, month, year, date, todayStr, wsDate) {
      if (period === "daily") return (date || todayStr) < wsDate;
      if (period === "weekly") {
         var d = new Date(todayStr + "T00:00:00Z");
         d.setUTCDate(d.getUTCDate() - 6);
         return d.toISOString().substring(0, 10) < wsDate;
      }
      if (period === "yearly") return year === "all" || !year || year + "-01-01" < wsDate;
      return filterNeedsHistory(month, year, "all", wsDate);
   }

   return {
      SUMMARY_VERSION: SUMMARY_VERSION,
      monthOf: monthOf,
      addMonths: addMonths,
      windowStartMonth: windowStartMonth,
      windowStartDate: windowStartDate,
      monthsBetween: monthsBetween,
      buildMonthSummary: buildMonthSummary,
      syntheticSales: syntheticSales,
      isValidSummary: isValidSummary,
      summarySignature: summarySignature,
      summaryPlan: summaryPlan,
      filterNeedsHistory: filterNeedsHistory,
      reportNeedsHistory: reportNeedsHistory,
   };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SalesWindow;
