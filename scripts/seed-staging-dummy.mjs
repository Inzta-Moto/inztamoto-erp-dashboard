// Data dummy untuk database STAGING (inzta-erp-staging), supaya semua menu ERP berisi data uji.
// Semua angka, nama, dan transaksi di sini karangan; tidak ada yang disalin dari produksi.
// Semua ID dokumen berawalan "dummy-" sehingga bisa dihapus bersih. Hasilnya sama setiap kali dijalankan
// (generator acak memakai seed tetap), dengan tanggal relatif terhadap hari ini (WIB).
//
// Pakai:
//   node scripts/seed-staging-dummy.mjs --dry      (ringkasan, tidak menulis)
//   node scripts/seed-staging-dummy.mjs            (hapus dummy lama lalu tulis ulang)
//   node scripts/seed-staging-dummy.mjs --clear    (hanya hapus dokumen dummy-)
//
// Token: GOOGLE_OAUTH_ACCESS_TOKEN, atau login firebase-tools (npx firebase-tools login).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ALLOWED_PROJECTS = ["inzta-erp-staging"];
const args = process.argv.slice(2);
const project = valueOf("--project") || "inzta-erp-staging";
const dry = args.includes("--dry");
const clearOnly = args.includes("--clear");
const DAYS = 90;

if (!ALLOWED_PROJECTS.includes(project)) {
  console.error(`DITOLAK: project "${project}" bukan staging. Script ini hanya untuk: ${ALLOWED_PROJECTS.join(", ")}`);
  process.exit(1);
}

const COLLECTIONS = [
  "categories", "products", "resellers", "sales", "stock_movements", "production",
  "production_purchases", "production_salaries", "payrolls", "sponsorships",
  "investor_agreement", "investor_payments", "investor_purchases",
];

// ---------- helper acak deterministik dan tanggal ----------
let seed = 20261111;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[pairs.length - 1][0];
};
const round = (n, step) => Math.round(n / step) * step;

const nowWib = new Date(Date.now() + 7 * 3600 * 1000);
const todayStr = nowWib.toISOString().slice(0, 10);
const dayStr = (offset) => new Date(Date.parse(todayStr) - offset * 86400000).toISOString().slice(0, 10);
const iso = (date, hour = 10) => `${date}T${String(hour - 7 < 0 ? 0 : hour - 7).padStart(2, "0")}:${String(int(0, 59)).padStart(2, "0")}:00.000Z`;
const weekKey = (date) => {
  const [y, m, d] = date.split("-").map(Number);
  const w = d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : d <= 28 ? 4 : 5;
  return `${y}-${String(m).padStart(2, "0")}-W${w}`;
};
const monthOf = (date) => date.slice(0, 7);
const statusFor = (stock) => (stock <= 0 ? "out_of_stock" : stock <= 5 ? "low_stock" : "active");
const id = (prefix, n) => `dummy-${prefix}-${String(n).padStart(3, "0")}`;

const docs = []; // [path, data]
const put = (p, data) => docs.push([p, data]);

// ---------- kategori dan produk ----------
const CATS = [
  ["Tail Bag", "TL", "Tas bagasi belakang motor"],
  ["Side Bag", "SD", "Tas samping motor"],
  ["Tank Bag", "TK", "Tas di atas tangki"],
  ["Duffel Bag", "DF", "Tas duffel untuk touring"],
  ["Dry Bag", "DR", "Tas kedap air"],
  ["Accessories", "AC", "Aksesoris riding"],
];
const PRODUCTS = [
  ["Tail Bag", "Tail Bag Urban 25L", 92000, 189000],
  ["Tail Bag", "Tail Bag Commuter 18L", 78000, 159000],
  ["Tail Bag", "Tail Bag Expand 35L", 135000, 265000],
  ["Side Bag", "Side Bag Navigator 12L", 98000, 199000],
  ["Side Bag", "Side Bag Slim 8L", 72000, 149000],
  ["Side Bag", "Side Bag Rally Pair", 210000, 389000],
  ["Tank Bag", "Tank Bag Magnet 6L", 85000, 175000],
  ["Tank Bag", "Tank Bag Strap 10L", 99000, 205000],
  ["Duffel Bag", "Duffel Bag Expedition 40L", 155000, 299000],
  ["Duffel Bag", "Duffel Bag Weekend 30L", 128000, 249000],
  ["Dry Bag", "Dry Bag Roll 20L", 70000, 139000],
  ["Dry Bag", "Dry Bag Roll 40L", 96000, 189000],
  ["Accessories", "Rain Cover Universal", 22000, 49000],
  ["Accessories", "Bungee Net Hook", 15000, 35000],
  ["Accessories", "Phone Pouch Waterproof", 28000, 65000],
  ["Accessories", "Strap Buckle Set", 18000, 39000],
];

const cats = CATS.map(([name, code, description], i) => ({
  id: id("cat", i + 1), name, skuCode: code, slug: name.toLowerCase().replace(/\s+/g, "-"), description,
}));
const seqByCat = {};
const products = PRODUCTS.map(([catName, name, cost, sell], i) => {
  const cat = cats.find((c) => c.name === catName);
  seqByCat[cat.id] = (seqByCat[cat.id] || 0) + 1;
  return {
    id: id("prod", i + 1), name, cat, costPrice: cost, sellingPrice: sell,
    sku: `INZ-${cat.skuCode}-${String(seqByCat[cat.id]).padStart(2, "0")}`,
    stock: 0, initial: int(30, 70), weight: i < 10 ? 3 : 1,
  };
});

// ---------- reseller ----------
const resellers = ["Toko Uji Motor Bandung", "Reseller Uji Jakarta Timur", "Garage Uji Surabaya"].map((name, i) => ({ id: id("res", i + 1), name }));

// ---------- pergerakan stok, penjualan ----------
const moves = [];
const startDate = dayStr(DAYS);
products.forEach((p) => {
  p.stock = p.initial;
  moves.push({ date: startDate, p, type: "in", qty: p.initial, note: "Stok awal (data dummy)" });
});

const CITIES = [
  ["Bandung", "Coblong"], ["Jakarta Selatan", "Tebet"], ["Surabaya", "Gubeng"], ["Bekasi", "Bekasi Barat"],
  ["Yogyakarta", "Depok"], ["Semarang", "Tembalang"], ["Malang", "Lowokwaru"], ["Bogor", "Tanah Sareal"],
  ["Depok", "Beji"], ["Tangerang", "Ciledug"], ["Medan", "Medan Baru"], ["Denpasar", "Denpasar Selatan"],
];
const FIRST = ["Andi", "Budi", "Citra", "Dimas", "Eka", "Fajar", "Gilang", "Hana", "Irfan", "Joko", "Kevin", "Lina", "Rizal", "Sari", "Tono", "Wahyu"];
const CHANNEL_W = [["Shopee", 42], ["Tokopedia", 16], ["TikTok Shop", 15], ["Reseller", 12], ["Website", 10], ["Offline Store", 5]];
const EXP = {
  Shopee: [["Shopee Express", 6], ["J&T", 3], ["SiCepat", 1]],
  Tokopedia: [["J&T", 4], ["SiCepat", 3], ["JNE", 2], ["Anteraja", 1]],
  "TikTok Shop": [["J&T", 5], ["SiCepat", 3], ["Anteraja", 1]],
  Website: [["JNE", 2], ["J&T", 2], ["SiCepat", 1]],
  Reseller: [["Lainnya", 3], ["J&T", 1]],
  "Offline Store": [["", 1]],
};

const salesRaw = [];
for (let off = DAYS - 1; off >= 0; off--) {
  const date = dayStr(off);
  // Restock tiap 3 minggu dari produksi.
  if (off % 21 === 10) {
    products.slice(0, 12).forEach((p) => {
      const q = int(10, 25);
      p.stock += q;
      moves.push({ date, p, type: "in", qty: q, note: "Hasil produksi masuk gudang (data dummy)" });
    });
  }
  const n = weighted([[0, 1], [1, 3], [2, 4], [3, 3], [4, 1]]);
  for (let k = 0; k < n; k++) {
    const p = weighted(products.map((x) => [x, x.weight]));
    const qty = weighted([[1, 8], [2, 2], [3, 1]]);
    if (p.stock - qty < 2) continue;
    const channel = weighted(CHANNEL_W);
    const reseller = channel === "Reseller" ? pick(resellers) : null;
    const factor = channel === "Reseller" ? 0.82 : ["Shopee", "Tokopedia", "TikTok Shop"].includes(channel) ? 1 - int(0, 8) / 100 : 1;
    const realUnitPrice = round(p.sellingPrice * factor, 500);
    const expedition = weighted(EXP[channel]);
    const [city, district] = channel === "Offline Store" ? ["Bandung", "Coblong"] : pick(CITIES);
    p.stock -= qty;
    salesRaw.push({ date, p, qty, channel, reseller, realUnitPrice, expedition, city, district, hour: int(8, 21) });
    moves.push({ date, p, type: "out", qty, note: expedition ? `Penjualan ${channel} - ${expedition}` : `Penjualan ${channel}` });
  }
}

// Satu produk stok rendah dan satu habis, supaya peringatan stok bisa diuji.
[[products[13], 0], [products[14], 3]].forEach(([p, target]) => {
  if (p.stock > target) {
    moves.push({ date: todayStr, p, type: "out", qty: p.stock - target, note: "Penyesuaian stok (data dummy)" });
    p.stock = target;
  }
});

salesRaw.forEach((s, i) => {
  const standardRevenue = s.p.sellingPrice * s.qty;
  const realRevenue = s.realUnitPrice * s.qty;
  const modal = s.p.costPrice * s.qty;
  const createdAt = iso(s.date, s.hour);
  put(`sales/${id("sale", i + 1)}`, {
    txNumber: "TXN-" + String(1001 + i).padStart(5, "0"),
    date: s.date, productId: s.p.id, productName: s.p.name, sku: s.p.sku, quantity: s.qty,
    costPrice: s.p.costPrice, sellingPrice: s.p.sellingPrice, realUnitPrice: s.realUnitPrice,
    standardRevenue, realRevenue, revenue: realRevenue, modal, realProfit: realRevenue - modal,
    profit: realRevenue - modal, marketplaceDifference: realRevenue - standardRevenue,
    channel: s.channel, resellerId: s.reseller ? s.reseller.id : "", resellerName: s.reseller ? s.reseller.name : "",
    expedition: s.expedition, district: s.district, city: s.city,
    customer: s.channel === "Reseller" ? s.reseller.name : `${pick(FIRST)} (dummy)`,
    notes: "", createdAt, updatedAt: createdAt,
  });
});

moves.forEach((m, i) => {
  put(`stock_movements/${id("mv", i + 1)}`, {
    date: m.date, productId: m.p.id, productName: m.p.name, sku: m.p.sku, type: m.type, qty: m.qty,
    note: m.note, createdAt: iso(m.date, 9),
  });
});

const created = iso(startDate, 8);
cats.forEach((c) => {
  put(`categories/${c.id}`, {
    name: c.name, slug: c.slug, description: c.description, skuCode: c.skuCode,
    productCount: products.filter((p) => p.cat.id === c.id).length, createdAt: created, updatedAt: created,
  });
});
products.forEach((p, i) => {
  put(`products/${p.id}`, {
    name: p.name, sku: p.sku, slug: p.name.toLowerCase().replace(/\s+/g, "-"), categoryId: p.cat.id,
    description: `${p.name} - produk dummy untuk staging.`, costPrice: p.costPrice, sellingPrice: p.sellingPrice,
    profit: p.sellingPrice - p.costPrice, margin: Math.round(((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100),
    stock: p.stock, status: statusFor(p.stock), featured: i % 4 === 0, images: [],
    createdAt: created, updatedAt: iso(todayStr, 8),
  });
});
resellers.forEach((r) => put(`resellers/${r.id}`, { name: r.name, status: "active", createdAt: created, updatedAt: created }));

// ---------- produksi ----------
const PROD_STATUS = ["completed", "completed", "completed", "completed", "completed", "completed", "qc", "in_progress", "in_progress", "pending", "pending", "pending"];
PROD_STATUS.forEach((status, i) => {
  const p = products[i % 12];
  const targetQty = int(2, 5) * 10;
  const completedQty = status === "completed" ? targetQty : status === "pending" ? 0 : Math.round(targetQty * (status === "qc" ? 0.9 : 0.5));
  put(`production/${id("po", i + 1)}`, {
    productId: p.id, productName: p.name, sku: p.sku, targetQty, completedQty,
    date: dayStr(Math.max(0, 80 - i * 7)), status, notes: "Order produksi dummy",
  });
});

// ---------- belanja produksi ----------
const PURCHASE_ITEMS = [
  ["Kain cordura 600D", "Bahan", "meter", 38000], ["Kain tarpaulin", "Bahan", "meter", 32000],
  ["Busa ati 5mm", "Bahan", "lembar", 18000], ["Webbing 2.5cm", "Aksesoris", "roll", 85000],
  ["Buckle plastik 2.5cm", "Aksesoris", "lusin", 24000], ["Resleting YKK no.8", "Aksesoris", "meter", 9000],
  ["Benang jahit nilon", "Bahan", "pcs", 15000], ["Plastik packing", "Packing", "pack", 27000],
  ["Kardus ukuran M", "Packing", "pcs", 4500], ["Ongkos kirim bahan", "Operasional", "pcs", 45000],
  ["Jarum mesin jahit", "Inventaris", "pack", 22000], ["Lakban", "Packing", "pcs", 9500],
];
for (let i = 0; i < 48; i++) {
  const [itemName, category, unit, price] = pick(PURCHASE_ITEMS);
  const date = dayStr(int(0, DAYS - 1));
  const quantity = unit === "meter" ? int(10, 60) : int(1, 20);
  const old = Date.parse(todayStr) - Date.parse(date) > 30 * 86400000;
  const createdAt = iso(date, 11);
  put(`production_purchases/${id("pp", i + 1)}`, {
    date, weekKey: weekKey(date), itemName, category, quantity, unit, unitPrice: price,
    totalCost: Math.round(quantity * price), note: "", status: old ? "closed" : "open",
    closedAt: old ? iso(date, 17) : null, createdAt, updatedAt: createdAt,
  });
}

// ---------- salary produksi (tukang jahit, mingguan) ----------
const WORKERS = ["Tukang Uji A", "Tukang Uji B", "Tukang Uji C"];
for (let w = 0; w < 12; w++) {
  const periodDate = dayStr(w * 7 + 1);
  const items = [];
  for (let k = 0; k < int(2, 3); k++) {
    const p = pick(products.slice(0, 12));
    const qty = int(5, 20);
    const upah = round(p.costPrice * 0.18, 500);
    items.push({ type: "product", productId: p.id, productName: p.name, qty, upah, subtotal: qty * upah });
  }
  const workerName = WORKERS[w % 3];
  put(`production_salaries/${id("ps", w + 1)}`, {
    workerName, workers: [workerName], periodDate, items,
    grandTotal: items.reduce((s, it) => s + it.subtotal, 0), createdAt: iso(periodDate, 16), updatedAt: iso(periodDate, 16),
  });
}

// ---------- gaji tim (bulanan) ----------
const EMPLOYEES = [["Karyawan Uji Gudang", 2800000], ["Karyawan Uji Admin Toko", 3200000], ["Karyawan Uji Packing", 2600000]];
for (let m = 3; m >= 0; m--) {
  const d = new Date(Date.parse(todayStr));
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - m);
  const period = d.toISOString().slice(0, 7);
  EMPLOYEES.forEach(([employeeName, baseSalary], e) => {
    const bonus = int(0, 3) * 100000;
    const deduction = int(0, 1) * 50000;
    const paid = m > 0;
    put(`payrolls/${id("pay", (3 - m) * 3 + e + 1)}`, {
      employeeName, employeeRole: "employee", period, paymentDate: paid ? `${period}-28` : "",
      baseSalary, bonus, deduction, totalPaid: baseSalary + bonus - deduction, status: paid ? "paid" : "unpaid",
      note: "", createdAt: iso(`${period}-25`, 10), updatedAt: iso(`${period}-25`, 10),
    });
  });
}

// ---------- sponsorship ----------
[
  ["Touring Uji Bandung-Pangandaran", "Pangandaran", 60],
  ["Kopdar Komunitas Uji NMAX", "Jakarta", 38],
  ["Gathering Uji Rider Jogja", "Yogyakarta", 20],
  ["Giveaway Uji Instagram", "Online", 5],
].forEach(([eventName, location, off], i) => {
  const p = products[i * 3];
  const items = [
    { type: "product", productId: p.id, itemName: p.name, qty: "2", nominal: p.costPrice * 2 },
    { type: "manual", itemName: "Stiker dan banner", qty: "1", nominal: 150000 },
  ];
  put(`sponsorships/${id("sp", i + 1)}`, {
    eventName, eventDate: dayStr(off), location, supportDetails: "Dukungan produk dan materi promosi (data dummy)",
    supportItems: items, estimatedCost: items.reduce((s, it) => s + it.nominal, 0),
    createdAt: iso(dayStr(off + 7), 10), updatedAt: iso(dayStr(off + 7), 10),
  });
});

// ---------- investor ----------
const effectiveDate = dayStr(75);
put("investor_agreement/current", { effectiveDate, updatedAt: iso(effectiveDate, 10), updatedBy: "seed-dummy" });
[1, 2].forEach((periodMonth, i) => {
  const paidDate = dayStr(45 - i * 30);
  put(`investor_payments/${id("ipay", i + 1)}`, {
    kind: "commission", periodMonth, amount: 1500000, paidDate, note: "Data dummy",
    recordedAt: iso(paidDate, 14), recordedBy: "seed-dummy",
  });
});
for (let i = 0; i < 10; i++) {
  const [itemName, category, unit, price] = pick(PURCHASE_ITEMS);
  const date = dayStr(int(5, 70));
  const quantity = int(5, 40);
  put(`investor_purchases/${id("ip", i + 1)}`, {
    date, itemName, category, quantity, unit, unitPrice: price, totalCost: quantity * price, note: "Data dummy",
    investorAgreementId: "current", createdAt: iso(date, 13), createdBy: "seed-dummy", updatedAt: iso(date, 13), updatedBy: "seed-dummy",
  });
}

// ---------- jalankan ----------
const summary = {};
for (const [p] of docs) summary[p.split("/")[0]] = (summary[p.split("/")[0]] || 0) + 1;
console.log(`Project: ${project} | hari ini (WIB): ${todayStr} | rentang data: ${startDate} s.d. ${todayStr}`);
if (!clearOnly) console.log("Akan ditulis:", JSON.stringify(summary));
if (dry) process.exit(0);

const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN || firebaseToolsToken();
const root = `projects/${project}/databases/(default)/documents`;
const api = `https://firestore.googleapis.com/v1/${root}`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const toDelete = [];
for (const c of COLLECTIONS) {
  let pageToken = "";
  do {
    const r = await call(`${api}/${c}?pageSize=300&mask.fieldPaths=_id_only${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`);
    for (const d of r.documents || []) {
      const docId = d.name.split("/").pop();
      if (docId.startsWith("dummy-") || (c === "investor_agreement" && docId === "current")) toDelete.push(d.name);
    }
    pageToken = r.nextPageToken || "";
  } while (pageToken);
}
await commit(toDelete.map((name) => ({ delete: name })));
console.log(`Dihapus: ${toDelete.length} dokumen dummy lama.`);
if (clearOnly) process.exit(0);

await commit(docs.map(([p, data]) => ({ update: { name: `${root}/${p}`, fields: toFields(data) } })));
console.log(`Selesai: ${docs.length} dokumen dummy ditulis ke ${project}.`);

// ---------- util ----------
async function commit(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    await call(`${api}:commit`, { method: "POST", body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
  }
}

async function call(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers });
  if (!r.ok) {
    console.error("Gagal:", r.status, await r.text());
    process.exit(1);
  }
  return r.json();
}

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function firebaseToolsToken() {
  const file = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  try {
    const t = JSON.parse(fs.readFileSync(file, "utf8")).tokens;
    if (t.expires_at && t.expires_at < Date.now()) {
      console.error("Token firebase-tools kedaluwarsa. Jalankan: npx firebase-tools projects:list, lalu ulangi.");
      process.exit(1);
    }
    return t.access_token;
  } catch {
    console.error("Belum login. Jalankan: npx firebase-tools login");
    process.exit(1);
  }
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === "number") return { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}

function toFields(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));
}
