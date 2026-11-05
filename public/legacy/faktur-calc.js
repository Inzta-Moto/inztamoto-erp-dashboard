// Pure invoice math and formatting shared by the Faktur page (spec .kiro/specs/faktur, design §4.2).
// No DOM and no Firestore here, so scripts/faktur-calc.test.cjs can run it under node --test.
var FakturCalc = (function () {
   var DISCOUNT_TYPES = ["none", "percent", "amount"];

   // Money is whole Rupiah; text such as "120.000" or "Rp 120.000" is read as digits only.
   function toInt(value) {
      if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : 0;
      if (value === null || value === undefined) return 0;
      var negative = /^\s*-/.test(String(value));
      var digits = String(value).replace(/[^0-9]/g, "");
      if (!digits) return 0;
      var n = parseInt(digits, 10);
      return negative ? -n : n;
   }

   function toMoney(value) {
      return Math.max(0, toInt(value));
   }

   function toPercent(value) {
      var n = typeof value === "number" ? value : parseFloat(String(value || "").replace(",", "."));
      if (!Number.isFinite(n)) return 0;
      return Math.min(100, Math.max(0, n));
   }

   function normalizeDiscount(d) {
      var type = d && DISCOUNT_TYPES.indexOf(d.type) !== -1 ? d.type : "none";
      if (type === "percent") return { type: type, value: toPercent(d.value) };
      if (type === "amount") return { type: type, value: toMoney(d.value) };
      return { type: "none", value: 0 };
   }

   // Percent results are rounded at the step where they appear, so every printed line adds up by hand.
   function pct(base, percent) {
      return Math.round((base * percent) / 100);
   }

   function amountOff(base, discount) {
      var d = normalizeDiscount(discount);
      var off = d.type === "percent" ? pct(base, d.value) : d.type === "amount" ? d.value : 0;
      return Math.min(base, Math.max(0, off));
   }

   function unitDiscount(unitPrice, discount) {
      return amountOff(toMoney(unitPrice), discount);
   }

   function computeLine(item) {
      var unitPrice = toMoney(item.unitPrice);
      var qty = Math.max(1, toInt(item.qty));
      var discount = normalizeDiscount(item.discount);
      var off = unitDiscount(unitPrice, discount);
      var net = unitPrice - off;
      return Object.assign({}, item, {
         unitPrice: unitPrice,
         qty: qty,
         discount: discount,
         unitDiscount: off,
         netUnitPrice: net,
         lineTotal: net * qty,
      });
   }

   function computeInvoice(inv) {
      var items = (inv.items || []).map(computeLine);
      var subtotal = items.reduce(function (sum, it) { return sum + it.lineTotal; }, 0);
      var invoiceDiscount = normalizeDiscount(inv.invoiceDiscount);
      var invoiceDiscountAmount = amountOff(subtotal, invoiceDiscount);
      var taxBase = subtotal - invoiceDiscountAmount;
      var tax = normalizeDiscount(inv.tax);
      var taxAmount = tax.type === "percent" ? pct(taxBase, tax.value) : tax.type === "amount" ? tax.value : 0;
      var shippingFee = toMoney(inv.shippingFee);
      var otherFeeAmount = toMoney(inv.otherFee && inv.otherFee.amount);
      var total = taxBase + taxAmount + shippingFee + otherFeeAmount;
      var paidAmount = toMoney(inv.paidAmount);
      var balanceDue = total - paidAmount;
      var paymentStatus = paidAmount <= 0 && total > 0 ? "unpaid" : balanceDue > 0 ? "partial" : "paid";
      return {
         items: items,
         subtotal: subtotal,
         invoiceDiscount: invoiceDiscount,
         invoiceDiscountAmount: invoiceDiscountAmount,
         taxBase: taxBase,
         tax: tax,
         taxAmount: taxAmount,
         shippingFee: shippingFee,
         otherFeeAmount: otherFeeAmount,
         total: total,
         paidAmount: paidAmount,
         balanceDue: balanceDue,
         overpaid: balanceDue < 0,
         paymentStatus: paymentStatus,
         isOpen: inv.status === "issued" && balanceDue > 0,
      };
   }

   function formatInvoiceNumber(prefix, seq, pad) {
      return String(prefix || "") + String(seq).padStart(pad || 4, "0");
   }

   function parseIsoDate(iso) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
      return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
   }

   // Calendar days in UTC, so daylight-saving shifts on the device cannot cause an off-by-one.
   function daysOverdue(dueDate, today) {
      var due = parseIsoDate(dueDate);
      var now = parseIsoDate(today);
      if (due === null || now === null) return 0;
      return Math.max(0, Math.round((now - due) / 86400000));
   }

   function addDays(iso, days) {
      var t = parseIsoDate(iso);
      if (t === null) return "";
      return new Date(t + days * 86400000).toISOString().slice(0, 10);
   }

   function displayStatus(inv, today) {
      if (inv.status === "draft") return "draft";
      if (inv.status === "cancelled") return "cancelled";
      var balance = typeof inv.balanceDue === "number" ? inv.balanceDue : toMoney(inv.total) - toMoney(inv.paidAmount);
      if (balance <= 0) return "paid";
      if (daysOverdue(inv.dueDate, today) > 0) return "overdue";
      return toMoney(inv.paidAmount) > 0 ? "partial" : "unpaid";
   }

   // wa.me needs the international form without "+": 0812... and +62 812... both become 62812...
   function normalizeWaPhone(phone) {
      var d = String(phone || "").replace(/[^0-9]/g, "");
      if (d.indexOf("0") === 0) d = "62" + d.slice(1);
      else if (d.indexOf("8") === 0) d = "62" + d;
      return d.length >= 10 ? d : "";
   }

   // Product photos are stored at w_800; invoices only need a thumbnail, which keeps the shared image small.
   function smallImageUrl(url) {
      if (!url) return "";
      var marker = "/image/upload/";
      var i = url.indexOf(marker);
      if (i === -1 || url.indexOf("res.cloudinary.com") === -1) return url;
      var head = url.slice(0, i + marker.length);
      var rest = url.slice(i + marker.length);
      var slash = rest.indexOf("/");
      var first = slash === -1 ? rest : rest.slice(0, slash);
      if (/(^|,)w_\d+/.test(first)) return head + first.replace(/(^|,)w_\d+/, "$1w_200") + rest.slice(first.length);
      return head + "w_200,q_auto,f_auto/" + rest;
   }

   return {
      toInt: toInt,
      toMoney: toMoney,
      toPercent: toPercent,
      normalizeDiscount: normalizeDiscount,
      pct: pct,
      unitDiscount: unitDiscount,
      computeLine: computeLine,
      computeInvoice: computeInvoice,
      formatInvoiceNumber: formatInvoiceNumber,
      daysOverdue: daysOverdue,
      addDays: addDays,
      displayStatus: displayStatus,
      normalizeWaPhone: normalizeWaPhone,
      smallImageUrl: smallImageUrl,
   };
})();

if (typeof module !== "undefined" && module.exports) module.exports = FakturCalc;
