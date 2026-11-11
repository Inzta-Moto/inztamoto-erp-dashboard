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
| Staging | `inzta-erp-staging` | Preview (semua branch selain `main`, alamat tetap dari branch `staging`) | kosong, hanya data uji |

- Variabel `NEXT_PUBLIC_FIREBASE_*` di Vercel: target Production berisi nilai `database-inzta`, target Preview berisi nilai `inzta-erp-staging`. Deploy preview tidak boleh memakai nilai produksi.
- Untuk menjalankan lokal ke staging, isi `.env.local` dengan konfigurasi web app `inzta-erp-staging` (Firebase Console → Project Settings → Your apps).
- Rules dan index Firestore disimpan di `firestore.rules` dan `firestore.indexes.json`. Deploy ke staging: `npx firebase-tools deploy --only firestore --project staging`. Deploy ke produksi hanya setelah disetujui, dengan `--project production`.
- `firestore/schema.json` mencatat nama dan tipe field setiap koleksi (diambil dari produksi tanpa nilai). Firestore tidak punya skema, jadi file ini menjadi acuan.
- `scripts/seed-staging.mjs` mengisi staging dengan dokumen `_schema/<koleksi>` (daftar field), `invoice_settings/default` dan `counters/invoice_UJI` (faktur uji berawalan UJI), serta profil pengguna. Script menolak jalan untuk proyek selain `inzta-erp-staging`.

```bash
node scripts/seed-staging.mjs --dry
node scripts/seed-staging.mjs --user email@contoh.com:Owner
```

Akun login staging dibuat di Firebase Console proyek `inzta-erp-staging` (Authentication → Users), dengan password yang berbeda dari produksi. Polanya: email produksi dengan akhiran `-dev`, misalnya `owner-dev@inzta.id`.

**Deploy staging.** Alamat tetap: `inztamoto-erp-dashboard-git-staging-pnjias-projects.vercel.app` (dilindungi login Vercel). Push ke branch tidak otomatis membuat deploy, jadi:

1. Gabungkan perubahan yang mau diuji ke branch `staging`.
2. Vercel → proyek `inztamoto-erp-dashboard` → Deployments → **Create Deployment** → pilih branch `staging`. Jangan centang production.
3. Alamat preview lain (per deploy) tidak bisa dipakai login sampai domainnya ditambahkan di Firebase Console `inzta-erp-staging` → Authentication → Settings → Authorized domains.

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
