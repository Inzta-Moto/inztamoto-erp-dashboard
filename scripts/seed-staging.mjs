// Isi awal database STAGING (inzta-erp-staging): skema per koleksi dan dokumen minimum supaya aplikasi bisa dipakai.
// Tidak menyalin data produksi. Menolak jalan untuk project selain staging.
//
// Pakai:
//   npx firebase-tools login                      (sekali, akun yang punya akses ke inzta-erp-staging)
//   node scripts/seed-staging.mjs --dry            (lihat apa yang akan ditulis)
//   node scripts/seed-staging.mjs --user email@contoh.com:Owner [--user email2:Admin]
//
// Token diambil dari GOOGLE_OAUTH_ACCESS_TOKEN, atau dari login firebase-tools (~/.config/configstore/firebase-tools.json).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_PROJECTS = ["inzta-erp-staging"];
const args = process.argv.slice(2);
const project = valueOf("--project") || "inzta-erp-staging";
const dry = args.includes("--dry");
const users = args.flatMap((a, i) => (a === "--user" ? [args[i + 1]] : [])).filter(Boolean);

if (!ALLOWED_PROJECTS.includes(project)) {
  console.error(`DITOLAK: project "${project}" bukan staging. Script ini hanya untuk: ${ALLOWED_PROJECTS.join(", ")}`);
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.join(here, "..", "firestore", "schema.json"), "utf8"));
const now = new Date().toISOString();
const seedActor = { name: "seed-staging", uid: "" };

const writes = [];

for (const [collection, def] of Object.entries(schema.collections)) {
  writes.push([
    `_schema/${collection}`,
    {
      collection,
      docId: def.docId || "otomatis",
      source: def.source,
      fields: def.fields,
      note: "Daftar field dan tipe. Koleksi aslinya sengaja kosong di staging. Aplikasi tidak membaca _schema.",
      generatedAt: schema.generatedAt,
      seededAt: now,
    },
  ]);
}

// Faktur butuh pengaturan dan counter. Prefix UJI supaya jelas ini faktur uji.
writes.push([
  "invoice_settings/default",
  {
    businessName: "INZTA MOTO (STAGING)",
    address: "Alamat uji staging",
    bankAccounts: [{ bank: "BANK UJI", holder: "STAGING", number: "0000000000" }],
    defaultDueDays: 3,
    defaultTax: { label: "PPN", type: "none", value: 0 },
    logoUrl: "",
    numberPad: 4,
    numberPrefix: "UJI",
    terms: "Faktur ini dibuat di lingkungan staging dan tidak berlaku.",
    updatedAt: now,
    updatedBy: seedActor,
  },
]);
writes.push([
  "counters/invoice_UJI",
  { prefix: "UJI", next: 1, lastInvoiceId: "", createdAt: now, createdBy: seedActor, updatedAt: now },
]);

const ROLES = ["Owner", "Admin", "Staff"];
for (const entry of users) {
  const [email, role = "Owner"] = entry.split(":");
  if (!email.includes("@") || !ROLES.includes(role)) {
    console.error(`--user tidak valid: "${entry}". Format: email:${ROLES.join("|")}`);
    process.exit(1);
  }
  const id = email.trim().toLowerCase();
  writes.push([`users/${id}`, { email: id, name: id.split("@")[0], role, status: "Aktif", updatedAt: now }]);
}

console.log(`Project: ${project}${dry ? " (dry run, tidak menulis)" : ""}`);
for (const [p] of writes) console.log("  set", p);
if (dry) process.exit(0);

const token = process.env.GOOGLE_OAUTH_ACCESS_TOKEN || firebaseToolsToken();
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const res = await fetch(`${base}:commit`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    writes: writes.map(([p, data]) => ({
      update: { name: `projects/${project}/databases/(default)/documents/${p}`, fields: toFields(data) },
    })),
  }),
});
if (!res.ok) {
  console.error("Gagal:", res.status, await res.text());
  process.exit(1);
}
console.log(`Selesai: ${writes.length} dokumen ditulis ke ${project}.`);

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function firebaseToolsToken() {
  const file = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  try {
    const t = JSON.parse(fs.readFileSync(file, "utf8")).tokens;
    if (t.expires_at && t.expires_at < Date.now()) {
      console.error("Token firebase-tools kedaluwarsa. Jalankan perintah firebase-tools apa saja (mis. npx firebase-tools projects:list) lalu ulangi.");
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
