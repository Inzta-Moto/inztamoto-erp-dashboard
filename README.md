# Inztamoto ERP

Sistem ERP untuk InztaMoto — brand tas motor dan riding gear.
Mengelola produksi, inventaris, penjualan, dan analitik keuntungan secara realtime via Firebase.

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database & Auth**: Firebase (Firestore + Auth)
- **Image Upload**: Cloudinary
- **Charts**: Chart.js
- **Icons**: Font Awesome 6
- **Font**: Plus Jakarta Sans

---

## Cara Menjalankan

### 1. Install dependencies

```bash
npm install
```

### 2. Setup environment variables

Salin file `.env.example` menjadi `.env.local` dan isi dengan nilai asli:

```bash
cp .env.example .env.local
```

Lalu edit `.env.local` dengan kredensial Firebase dan Cloudinary kamu.

### 3. Jalankan development server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## Environment Variables

| Variable | Keterangan |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | API Key dari Firebase Console |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain project Firebase |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID project Firebase |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket Firebase |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID Firebase |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID Firebase |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Nama cloud di Cloudinary |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Upload preset Cloudinary (unsigned) |

---

## Demo Login

Untuk keperluan testing tanpa Firebase:

- **Email**: `admin@inztamoto.com`
- **Password**: `admin123`

---

## Deploy ke Vercel

1. Push branch ke GitHub
2. Hubungkan repo ke akun Vercel
3. Tambahkan semua environment variables di Vercel dashboard (Settings → Environment Variables)
4. Deploy — Vercel akan auto-detect Next.js
5. Production branch: `main` (Settings → Git). Setiap merge ke `main` otomatis ter-deploy.

---

## Staging

Ada dua proyek Firebase. Kode yang sama, database berbeda.

| Lingkungan | Proyek Firebase | Vercel | Data |
|---|---|---|---|
| Produksi | `database-inzta` | Production (`main`, dashboard.inzta.id) | data asli |
| Staging | `inzta-erp-staging` | Preview (semua branch selain `main`), alamat `inzta-dashboard-staging.vercel.app` dari branch `staging` | kosong, hanya data uji |

- Variabel `NEXT_PUBLIC_FIREBASE_*` di Vercel: target Production berisi nilai `database-inzta`, target Preview berisi nilai `inzta-erp-staging`. Deploy preview tidak boleh memakai nilai produksi.
- Cloudinary: ERP mengunggah ke cloud `dvxnasm3s` lewat upload preset unsigned (`NEXT_PUBLIC_CLOUDINARY_*`) dan tidak memakai `CLOUDINARY_URL`. Cloud `rwmgljss` khusus foto klaim garansi dan hanya dipakai website. Jangan menambah kredensial API Cloudinary ke proyek Vercel ERP.
- Untuk menjalankan lokal ke staging, isi `.env.local` dengan konfigurasi web app `inzta-erp-staging` (Firebase Console → Project Settings → Your apps).
- Rules dan index Firestore disimpan di `firestore.rules` dan `firestore.indexes.json`. Deploy ke staging: `npx firebase-tools deploy --only firestore --project staging`. Deploy ke produksi hanya setelah disetujui, dengan `--project production`.
- `firestore/schema.json` mencatat nama dan tipe field setiap koleksi (diambil dari produksi tanpa nilai). Firestore tidak punya skema, jadi file ini menjadi acuan.
- `scripts/seed-staging.mjs` mengisi staging dengan dokumen `_schema/<koleksi>` (daftar field), `invoice_settings/default` dan `counters/invoice_UJI` (faktur uji berawalan UJI), serta profil pengguna. Script menolak jalan untuk proyek selain `inzta-erp-staging`.

```bash
node scripts/seed-staging.mjs --dry
node scripts/seed-staging.mjs --user email@contoh.com:Owner
```

**Data dummy staging.** `scripts/seed-staging-dummy.mjs` mengisi staging dengan data karangan selama 90 hari terakhir: 6 kategori, 16 produk (satu stok rendah, satu habis), 3 reseller, sekitar 175 penjualan di semua channel beserta pergerakan stoknya, order produksi, belanja produksi, salary produksi, gaji tim, sponsorship, dan data investor. Semua ID berawalan `dummy-`; menjalankan ulang akan menghapus lalu menulis ulang data dummy saja. Faktur tidak diisi, buat dari menu Faktur (nomor `UJI-0001` dan seterusnya).

```bash
node scripts/seed-staging-dummy.mjs --dry
node scripts/seed-staging-dummy.mjs
node scripts/seed-staging-dummy.mjs --clear
```

Catatan: saat database kosong, aplikasi otomatis membuat 3 kategori dan 3 produk contoh (`seedIfEmpty`). Jalankan seed dummy dulu sebelum membuka staging yang baru dikosongkan.

Akun login staging dibuat di Firebase Console proyek `inzta-erp-staging` (Authentication → Users), dengan password yang berbeda dari produksi. Polanya: email produksi dengan akhiran `-dev`, misalnya `owner-dev@inzta.id`.

**Deploy staging.** Alamat tetap: `inzta-dashboard-staging.vercel.app` (domain proyek yang ditautkan ke branch `staging`; alamat lama `inztamoto-erp-dashboard-git-staging-pnjias-projects.vercel.app` tetap jalan). Push ke branch tidak otomatis membuat deploy, jadi:

1. Gabungkan perubahan yang mau diuji ke branch `staging`.
2. Vercel → proyek `inztamoto-erp-dashboard` → Deployments → **Create Deployment** → pilih branch `staging`. Jangan centang production.
3. Alamat preview lain (per deploy) tidak bisa dipakai login sampai domainnya ditambahkan di Firebase Console `inzta-erp-staging` → Authentication → Settings → Authorized domains.

---

## Hemat baca Firestore (jendela data)

Firestore paket Spark memberi 50.000 baca per hari. Sebelumnya setiap kali ERP dibuka dari awal, seluruh isi `sales`, `production_purchases`, dan koleksi lain dibaca (sekitar 2.700 baca per buka pada 12 Nov 2026), dan kuota terlampaui di 4 dari 30 hari.

Cara kerjanya sekarang (`public/legacy/sales-window.js`, bagian "Read window" di `public/legacy/app-runtime.js`):

- Listener `sales`, `production_purchases`, dan `stock_movements` hanya memuat **bulan ini dan bulan lalu**.
- Data yang lebih lama dibaca **sekali per sesi**, hanya bila dibutuhkan: filter Penjualan ke bulan lama atau "Semua", Laporan untuk periode lama, Export, Riwayat Stok "Arsip"/"Semua", dan halaman Belanja Produksi.
- Grafik Dashboard (Distribusi Channel, Kategori, Produk Terlaris, Tren, Pendapatan vs Biaya) memakai ringkasan bulanan di koleksi `sales_monthly` (satu dokumen per bulan yang sudah lewat). Ringkasan dibangun otomatis saat login pertama dan setiap ada bulan baru yang keluar dari jendela.
- **Wajib:** kode apa pun yang menambah, mengubah, atau menghapus penjualan bertanggal sebelum bulan lalu harus memanggil `markSalesChanged([tanggal, ...])` supaya ringkasan bulan itu dibangun ulang. Form Catat Penjualan, edit, dan hapus sudah melakukannya; integrasi marketplace nanti juga harus. Sebagai pengaman, setiap kali data lama terbaca, ringkasan dicocokkan ulang dan diperbaiki bila berbeda.
- Ringkasan bisa dihapus kapan saja (koleksi `sales_monthly`); ERP akan membangunnya lagi pada login berikutnya.

Tes: `npm test` (termasuk `scripts/sales-window.test.cjs`, yang membuktikan grafik Dashboard dari ringkasan sama dengan dari transaksi asli).

---

## Integrasi TikTok Shop / Tokopedia (menu Marketplace)

Pesanan TikTok Shop dan Tokopedia (lewat API TikTok Shop sejak Dual Listing) ditarik ke koleksi `marketplace_orders` sekali sehari. Ini **belum** mencatat ke Penjualan: pencatatan menunggu tiga keputusan owner (status pesanan yang dicatat, harga yang dipakai, stok ikut berkurang atau tidak). Logika pencatatannya sudah ada dan dites di `src/lib/marketplace/order-to-sales.mjs`, tetapi belum dipanggil.

Alur:

1. Owner membuka menu **Marketplace** → **Sambungkan toko** → login dan setujui di TikTok → kembali ke ERP. Token disimpan terenkripsi (AES-256-GCM, kunci diturunkan dari `TIKTOK_APP_SECRET`) di `marketplace_connections/tiktok`, karena rules Firestore ERP membolehkan semua pengguna yang login membaca semua dokumen.
2. Vercel Cron memanggil `GET /api/marketplace/tiktok/sync` setiap hari 17.00 UTC = 00.00 WIB (`vercel.json`; paket Hobby maksimal sekali sehari). Owner/Admin bisa menekan **Sinkronkan sekarang**.
3. Sinkron mengambil pesanan yang berubah sejak sinkron terakhir (tumpang tindih 1 hari; sinkron pertama 30 hari ke belakang), lalu hanya menulis pesanan yang berubah. Nama, nomor HP, alamat, dan email pembeli **tidak pernah disimpan**.

| Route | Siapa | Isi |
|---|---|---|
| `POST /api/marketplace/tiktok/connect` | Owner | Tautan izin TikTok dengan state sekali pakai (10 menit) |
| `GET /api/marketplace/tiktok/callback` | TikTok | URL Pengalihan di Partner Center: `https://dashboard.inzta.id/api/marketplace/tiktok/callback` |
| `GET /api/marketplace/tiktok/sync` | Vercel Cron (`CRON_SECRET`) | Sinkron harian |
| `POST /api/marketplace/tiktok/sync` | Owner, Admin | Sinkron manual |
| `GET /api/marketplace/tiktok/status` | Owner, Admin | Status sambungan dan 20 pesanan terbaru, tanpa token |
| `POST /api/marketplace/tiktok/disconnect` | Owner | Hapus token dari ERP |

Env di Vercel (diisi sendiri oleh pemegang akun, jangan lewat chat atau repo):

| Variabel | Target | Isi |
|---|---|---|
| `TIKTOK_APP_KEY` | Production | Partner Center → app "Inzta ERP" → Kunci aplikasi |
| `TIKTOK_APP_SECRET` | Production, Sensitive | Partner Center → Kelola rahasia apl |
| `FIREBASE_SERVICE_ACCOUNT` | Production: key `database-inzta`; Preview: key `inzta-erp-staging`; Sensitive | Firebase Console → Project settings → Service accounts → Generate new private key, tempel isi JSON. Server menolak bila `project_id` beda dengan `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `CRON_SECRET` | Production, Sensitive | String acak minimal 32 karakter. Tanpa ini sinkron otomatis ditolak (sinkron manual tetap jalan) |
| `TIKTOK_SERVICE_ID` | opsional | ID app di tautan izin; bawaan `7706703201979336469` |

Tes: `npm test` (`scripts/marketplace-tiktok.test.mjs`: tanda tangan, enkripsi token, pemetaan pesanan tanpa data pembeli, rencana pencatatan, OAuth state, sinkron, refresh token). Uji lokal lengkap bisa memakai Firebase Emulator (`FIRESTORE_EMULATOR_HOST` + `FIREBASE_AUTH_EMULATOR_HOST`, tanpa kredensial) dan server tiruan lewat `TIKTOK_AUTH_BASE` / `TIKTOK_API_BASE` (diabaikan di Production).

Belum diverifikasi ke TikTok asli (menunggu app terbit): format tanda tangan, nama parameter `code` di callback, dan field `commerce_platform` untuk membedakan Tokopedia. Cek pertama setelah app terbit: sambungkan toko, Sinkronkan sekarang, cocokkan jumlah pesanan satu hari dengan Seller Center.

---

## Struktur Folder

```
src/
├─ app/
│  ├─ layout.jsx       # Root layout (font, metadata)
│  ├─ page.jsx         # Entry point — mount InztamotoApp
│  └─ globals.css      # Stylesheet utama (dari styles.css)
├─ components/
│  └─ InztamotoApp.jsx # Seluruh markup JSX app
└─ lib/
   ├─ firebase.js      # Inisialisasi Firebase
   ├─ cloudinary.js    # Konstanta Cloudinary
   ├─ constants.js     # SKU_MAP, CHANNELS, DEMO_USERS, dll
   └─ app-runtime.js   # Logic app.js yang diadaptasi ke Next.js
```

---

## Catatan Migrasi

- Semua style CSS dipertahankan tanpa perubahan visual.
- Element ID dan class CSS dijaga agar logic di `app-runtime.js` tetap bekerja.
- Firebase dan Chart.js dijalankan hanya di client-side (bukan SSR).
- Gunakan `'use client'` hanya di komponen yang membutuhkan browser API.
