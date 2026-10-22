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
