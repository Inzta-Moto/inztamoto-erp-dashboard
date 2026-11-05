// Tests for public/legacy/faktur-calc.js (spec .kiro/specs/faktur, design §4.2–4.3). Run: node --test scripts/
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../public/legacy/faktur-calc.js");

const item = (unitPrice, qty, discount) => ({ unitPrice, qty, discount: discount || { type: "none", value: 0 } });

const designExample = (overrides) =>
   Object.assign(
      {
         status: "issued",
         items: [
            item(300000, 2, { type: "percent", value: 10 }),
            item(150000, 3),
            item(25000, 1),
         ],
         invoiceDiscount: { type: "percent", value: 5 },
         tax: { type: "none", value: 0 },
         shippingFee: 30000,
         otherFee: { label: "", amount: 0 },
         paidAmount: 500000,
      },
      overrides || {},
   );

test("design §4.3 case 1: no tax, partial payment", () => {
   const r = C.computeInvoice(designExample());
   assert.deepEqual(r.items.map((i) => i.lineTotal), [540000, 450000, 25000]);
   assert.equal(r.items[0].unitDiscount, 30000);
   assert.equal(r.items[0].netUnitPrice, 270000);
   assert.equal(r.subtotal, 1015000);
   assert.equal(r.invoiceDiscountAmount, 50750);
   assert.equal(r.taxBase, 964250);
   assert.equal(r.taxAmount, 0);
   assert.equal(r.total, 994250);
   assert.equal(r.balanceDue, 494250);
   assert.equal(r.paymentStatus, "partial");
   assert.equal(r.isOpen, true);
});

test("design §4.3 case 2: 11% tax rounds half up", () => {
   const r = C.computeInvoice(designExample({ tax: { type: "percent", value: 11 } }));
   assert.equal(r.taxAmount, 106068);
   assert.equal(r.total, 1100318);
});

test("design §4.3 case 3: item amount discount above price is clamped", () => {
   const r = C.computeInvoice(designExample({ items: [item(300000, 1, { type: "amount", value: 400000 })], invoiceDiscount: null, shippingFee: 0, paidAmount: 0 }));
   assert.equal(r.items[0].unitDiscount, 300000);
   assert.equal(r.items[0].netUnitPrice, 0);
   assert.equal(r.total, 0);
});

test("percent discount 0 and 100, and above 100 is clamped", () => {
   assert.equal(C.unitDiscount(190000, { type: "percent", value: 0 }), 0);
   assert.equal(C.unitDiscount(190000, { type: "percent", value: 100 }), 190000);
   assert.equal(C.unitDiscount(190000, { type: "percent", value: 150 }), 190000);
   assert.equal(C.unitDiscount(190000, { type: "percent", value: -5 }), 0);
   assert.equal(C.unitDiscount(190000, { type: "percent", value: 7.5 }), 14250);
});

test("invoice discount and tax as fixed amounts", () => {
   const r = C.computeInvoice({
      status: "issued",
      items: [item(100000, 2)],
      invoiceDiscount: { type: "amount", value: 250000 },
      tax: { type: "amount", value: 5000 },
      shippingFee: 0,
      paidAmount: 0,
   });
   assert.equal(r.invoiceDiscountAmount, 200000, "discount cannot exceed subtotal");
   assert.equal(r.taxBase, 0);
   assert.equal(r.total, 5000);
});

test("total never negative, fees add up, other fee counted", () => {
   const r = C.computeInvoice({
      status: "issued",
      items: [item(50000, 1)],
      invoiceDiscount: { type: "none", value: 0 },
      tax: { type: "none", value: 0 },
      shippingFee: -10000,
      otherFee: { label: "Packing kayu", amount: 15000 },
      paidAmount: 0,
   });
   assert.equal(r.shippingFee, 0);
   assert.equal(r.otherFeeAmount, 15000);
   assert.equal(r.total, 65000);
});

test("qty and money inputs are coerced to safe integers", () => {
   const r = C.computeInvoice({ status: "draft", items: [{ unitPrice: "120.000", qty: "2", discount: null }], paidAmount: "abc" });
   assert.equal(r.items[0].qty, 2);
   assert.equal(r.items[0].unitPrice, 120000);
   assert.equal(r.subtotal, 240000);
   assert.equal(r.paidAmount, 0);
   const zeroQty = C.computeInvoice({ status: "draft", items: [item(10000, 0)] });
   assert.equal(zeroQty.items[0].qty, 1, "qty is at least 1");
});

test("payment status: unpaid, partial, paid, overpaid flag", () => {
   const base = { status: "issued", items: [item(100000, 1)] };
   assert.equal(C.computeInvoice(Object.assign({ paidAmount: 0 }, base)).paymentStatus, "unpaid");
   assert.equal(C.computeInvoice(Object.assign({ paidAmount: 1 }, base)).paymentStatus, "partial");
   const paid = C.computeInvoice(Object.assign({ paidAmount: 100000 }, base));
   assert.equal(paid.paymentStatus, "paid");
   assert.equal(paid.balanceDue, 0);
   assert.equal(paid.isOpen, false);
   const over = C.computeInvoice(Object.assign({ paidAmount: 120000 }, base));
   assert.equal(over.overpaid, true);
   assert.equal(over.balanceDue, -20000);
});

test("isOpen only for issued invoices with balance", () => {
   const mk = (status) => C.computeInvoice({ status, items: [item(100000, 1)], paidAmount: 0 }).isOpen;
   assert.equal(mk("draft"), false);
   assert.equal(mk("issued"), true);
   assert.equal(mk("cancelled"), false);
});

test("formatInvoiceNumber pads and grows past the pad width", () => {
   assert.equal(C.formatInvoiceNumber("INV", 9, 4), "INV0009");
   assert.equal(C.formatInvoiceNumber("INV", 101, 4), "INV0101");
   assert.equal(C.formatInvoiceNumber("INV", 9999, 4), "INV9999");
   assert.equal(C.formatInvoiceNumber("INV", 10000, 4), "INV10000");
   assert.equal(C.formatInvoiceNumber("UJI", 1, 4), "UJI0001");
});

test("daysOverdue: before, on, after the due date, across months and years", () => {
   assert.equal(C.daysOverdue("2026-10-05", "2026-11-03"), 29);
   assert.equal(C.daysOverdue("2026-11-03", "2026-11-03"), 0);
   assert.equal(C.daysOverdue("2026-11-10", "2026-11-03"), 0);
   assert.equal(C.daysOverdue("2026-12-31", "2027-01-02"), 2);
   assert.equal(C.daysOverdue("2027-03-29", "2027-03-30"), 1, "no DST off-by-one");
   assert.equal(C.daysOverdue("", "2026-11-03"), 0);
});

test("addDays handles month and leap-year boundaries", () => {
   assert.equal(C.addDays("2026-10-26", 7), "2026-11-02");
   assert.equal(C.addDays("2028-02-25", 7), "2028-03-03");
   assert.equal(C.addDays("2026-12-28", 7), "2027-01-04");
});

test("displayStatus covers every list filter", () => {
   const t = "2026-11-05";
   const mk = (o) => C.displayStatus(Object.assign({ status: "issued", total: 100000, paidAmount: 0, balanceDue: 100000, dueDate: "2026-11-10" }, o), t);
   assert.equal(mk({ status: "draft" }), "draft");
   assert.equal(mk({ status: "cancelled" }), "cancelled");
   assert.equal(mk({}), "unpaid");
   assert.equal(mk({ paidAmount: 50000, balanceDue: 50000 }), "partial");
   assert.equal(mk({ paidAmount: 100000, balanceDue: 0 }), "paid");
   assert.equal(mk({ dueDate: "2026-11-01" }), "overdue");
   assert.equal(mk({ dueDate: "2026-11-01", paidAmount: 100000, balanceDue: 0 }), "paid");
});

test("normalizeWaPhone converts Indonesian formats", () => {
   assert.equal(C.normalizeWaPhone("0812-3456-7890"), "6281234567890");
   assert.equal(C.normalizeWaPhone("+62 812 3456 7890"), "6281234567890");
   assert.equal(C.normalizeWaPhone("6281234567890"), "6281234567890");
   assert.equal(C.normalizeWaPhone("812345678"), "62812345678");
   assert.equal(C.normalizeWaPhone("123"), "");
   assert.equal(C.normalizeWaPhone(""), "");
});

test("smallImageUrl swaps the Cloudinary width transform", () => {
   assert.equal(
      C.smallImageUrl("https://res.cloudinary.com/x/image/upload/q_auto,f_auto,w_800/inztamoto/products/a"),
      "https://res.cloudinary.com/x/image/upload/q_auto,f_auto,w_200/inztamoto/products/a",
   );
   assert.equal(
      C.smallImageUrl("https://res.cloudinary.com/x/image/upload/v123/inztamoto/products/a.jpg"),
      "https://res.cloudinary.com/x/image/upload/w_200,q_auto,f_auto/v123/inztamoto/products/a.jpg",
   );
   assert.equal(C.smallImageUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
   assert.equal(C.smallImageUrl(""), "");
});
