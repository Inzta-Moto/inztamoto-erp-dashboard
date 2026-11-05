# Tasks: Faktur (Invoice) di ERP

Status: **Fase 1 dibangun dan diuji dengan data tiruan** (2026-11-05, branch `feat/faktur`); Task 1.14 sebagian, Task 1.15 menunggu uji Sehan dengan login asli. Q-1 sampai Q-9 dijawab sesuai rekomendasi atas arahan Sehan (bagian "Keputusan"). Butir ⚑ tetap dicek ke owner saat demo. Tidak ada task yang memakai Blaze atau Cloud Functions, dan tidak ada paket npm baru.

Aturan verifikasi untuk setiap task kode:
- `npm run build` lulus, dan output-nya dicatat.
- Tes kalkulasi: `node --test scripts/faktur-calc.test.cjs` lulus (setelah Task 1.2 ada).
- Cek manual di Chrome pada lebar 320, 360, 412, 768, 1024, dan 1440 px (tema terang saja; ERP belum punya tema gelap).
- Uji dilakukan di database produksi (Q-4). Faktur uji selalu memakai prefix `UJI`, dan faktur `UJI` yang sudah terbit dibatalkan dengan alasan "Uji coba". Tidak ada uji yang menyentuh `sales`, `products`, atau `stock_movements` di Fase 1.

---

## Phase 0: Keputusan dan persiapan (tanpa kode fitur)

- [x] **Task 0.1**: Sehan menyetujui spec dan meminta Q-1 sampai Q-9 dijawab sesuai rekomendasi (2026-11-05). Jawaban ada di bagian "Keputusan".
- [ ] **Task 0.2**: Cek ke owner butir ⚑ di requirements (pajak, diskon item, akses admin, faktur tanpa efek stok di Fase 1).
  - Selesai bila: setiap ⚑ punya jawaban "tetap" atau "ubah", dan requirements diperbarui.
- [x] **Task 0.3**: Rules produksi dicek read-only lewat Firebase CLI (2026-11-05): satu aturan `match /{document=**} { allow read, write: if request.auth != null; }`. Faktur Fase 1 jalan dengan rules ini tanpa perubahan. Rules khusus faktur (design §5) ditunda ke Task 3.5 (Q-3).
- [x] **Task 0.4**: Nomor awal ditetapkan: faktur ERP pertama `INV0101` (Q-2). Dokumen counter dan pengaturan **tidak** dibuat lewat skrip admin, tetapi oleh form "Mulai penomoran" di Task 1.4, memakai login owner/admin di ERP. Nama koleksi `counters`, `invoices`, dan `invoice_settings` dicek tidak dipakai di runtime ERP maupun di `inzta-investor-portal/src`.
- [ ] **Task 0.5** (opsional): Mockup 3 layar (daftar, editor, pratinjau) di 360 px. Dilewati bila Sehan langsung membangun UI mengikuti design §9.

---

## Phase 1: MVP faktur (FR-1 sampai FR-5, FR-6.1–6.5, FR-7.1–7.3, FR-8.1–8.8, FR-10, FR-12)

### Fondasi
- [x] **Task 1.1**: Kabel di runtime dan markup: `#pageFaktur`, `nav-item` `#menuFaktur`, `TITLES.faktur`, `case "faktur"`, guard peran di `navigateTo`, tampil/sembunyi menu di `updateNavigationAccess`, hook `fakturCleanup` di `cleanupAppSession`. Muat `/legacy/faktur-calc.js` dan `/legacy/faktur.js` setelah `app-runtime.js` di `LegacyScripts.jsx`.
  - Selesai bila: owner/admin melihat menu Faktur dengan halaman kosong "Belum ada faktur"; peran lain tidak melihat menu dan `navigateTo("faktur")` kembali ke Dashboard (AC-8); `node scripts/patch-runtime.cjs` pada salinan file tetap berhasil; build lulus.
- [x] **Task 1.2**: `public/legacy/faktur-calc.js` (design §4.2) dan `scripts/faktur-calc.test.cjs` memakai `node:test` dan `node:assert` bawaan.
  - Kasus tes minimal: 4 kasus di design §4.3; diskon persen 0 dan 100; diskon nominal melebihi harga; total tidak negatif; pembulatan .5; `paymentStatus` untuk dibayar 0, sebagian, sama dengan total; `isOpen` untuk draft, issued, cancelled; `formatInvoiceNumber` 9, 43, 9999, 10000; `daysOverdue` sebelum, pada, dan sesudah jatuh tempo, termasuk lintas bulan.
  - Selesai bila: semua tes lulus dan output dicatat.
- [x] **Task 1.3**: Listener lazy di `faktur.js`: `invoices_recent` (50 terbaru), `invoices_open` (`isOpen == true`), `invoice_settings`. Daftarkan ke `LAZY_LISTENERS` dan `LAZY_LISTENERS_BY_PAGE.faktur`. Pesan khusus untuk `resource-exhausted` seperti halaman Belanja Investasi (`app-runtime.js:920-928`).
  - Selesai bila: login tanpa membuka Faktur tidak memanggil koleksi faktur (AC-7, dicek di tab Network/console); membuka Faktur memuat data.

### Pengaturan dan penomoran
- [x] **Task 1.4**: Layar Pengaturan faktur (design §9.5): logo lewat Cloudinary, nama, alamat, rekening (tambah/hapus), syarat, jatuh tempo default, prefix, pajak default. Nomor berikutnya tampil baca saja.
  - Form "Mulai penomoran" muncul bila counter untuk prefix aktif belum ada: isi prefix dan nomor pertama, lalu buat `counters/invoice_{PREFIX}` dengan transaksi yang gagal bila dokumen sudah ada (tidak pernah menimpa counter).
  - Selesai bila: perubahan tersimpan di `invoice_settings/default` dan tampil di pratinjau draf; counter `invoice_UJI` (mulai 1) dibuat untuk uji, dan `invoice_INV` (mulai 101) dibuat saat go-live.
- [x] **Task 1.5**: `issueInvoice()` dengan `runTransaction` (design §4.1), snapshot `business`, dan audit `issuedAt/issuedBy`. Pesan jelas saat offline.
  - Selesai bila: uji dua tab/perangkat menerbitkan bersamaan menghasilkan dua nomor berbeda berurutan (AC-2); offline menampilkan pesan dan isian tidak hilang.

### Editor
- [x] **Task 1.6**: Kerangka editor penuh halaman: header (kembali, nomor/DRAF, Sunting/Pratinjau), bagian Pelanggan, Tanggal & jatuh tempo (default +7 hari), Catatan, bar bawah menempel. Draf lokal di `localStorage` selama mengetik.
  - Selesai bila: tanpa scroll horizontal di 320 px; refresh di tengah mengetik memulihkan isian; jatuh tempo sebelum tanggal faktur ditolak.
- [x] **Task 1.7**: Pelanggan: saklar Reseller dengan pilihan dari `state.resellers` aktif; retail dengan saran dari faktur yang sudah dimuat (FR-3).
  - Selesai bila: memilih reseller mengisi nama dan label; saran retail tidak menambah read.
- [x] **Task 1.8**: Pemilih produk (lembar bawah/modal) dari `state.products` dengan cari nama/SKU; item manual; edit item (nama, catatan, harga, diskon item); stepper qty; ubah urutan dan hapus. Foto memakai transform `w_200`.
  - Selesai bila: menambah 10 item di HP 360 px tanpa mengetik nama atau harga (bagian dari AC-1); batas 50 item ditegakkan.
- [x] **Task 1.9**: Ringkasan dan pembayaran: diskon faktur, pajak, ongkir, biaya lain, Dibayar, Tandai lunas, semua lewat `FakturCalc`. Simpan draf, Terbitkan, Simpan (faktur terbit), Hapus draf, Batalkan dengan alasan. Audit `createdBy/updatedBy/paidBy/cancelledBy`.
  - Selesai bila: angka layar sama dengan kasus design §4.3 (AC-3); status berpindah Belum dibayar → Sebagian → Lunas (AC-4); total di bawah Dibayar ditolak; faktur batal menyimpan nomor dan nomor berikutnya baru (AC-5).

### Dokumen dan bagikan
- [x] **Task 1.10**: Spike opsi PNG: CORS Cloudinary dan html2canvas dari CDN diuji di Chrome desktop (lulus). Uji di Chrome Android dan faktur 50 item masuk Task 1.14.
  - Selesai bila: hasil spike dan pilihan opsi (A atau B) dicatat di design §6.2.
- [x] **Task 1.11**: `renderInvoiceDocument()` (design §6.1): header, Tagih kepada, tabel item dengan harga asli dan diskon, ringkasan tanpa baris 0, rekening, syarat, cap LUNAS/BATAL, format `fmtRp` dan tanggal Indonesia.
  - Selesai bila: tidak ada angka yang terpotong pada nominal sampai Rp 999.999.999; mengubah pengaturan tidak mengubah faktur terbit (AC-6).
- [x] **Task 1.12**: Bagikan gambar dua langkah (Siapkan → Bagikan) dengan Web Share API dan fallback unduh; PDF lewat `window.print()` dengan CSS cetak; teks WhatsApp `wa.me`; catat `lastSharedAt`.
  - Selesai bila: di Chrome Android, gambar 10 item terkirim ke WhatsApp (AC-1) dan ukurannya < 1,5 MB (NFR-5); PDF A4 rapi tanpa baris terpotong; di desktop gambar terunduh.

### Daftar
- [x] **Task 1.13**: Daftar faktur: kartu ringkas (piutang, lewat tempo, ditagih bulan ini), chip filter, cari, filter bulan/tahun dengan `.get()` untuk periode yang belum dimuat, kartu di HP dan tabel di desktop, Muat lebih banyak.
  - Selesai bila: angka kartu piutang sama dengan jumlah saldo faktur terbuka; filter Lewat jatuh tempo menampilkan jumlah hari yang benar.

### Gerbang mutu Fase 1
- [ ] **Task 1.14**: Verifikasi Fase 1:
  - `npm run build` dan `node --test` lulus;
  - semua AC-1 sampai AC-9 dicek dan dicatat hasilnya;
  - regresi: Dashboard, Penjualan, Laporan, dan stok tidak berubah sebelum dan sesudah membuat faktur uji (AC-9); halaman lain tetap jalan; logout menghapus draf lokal;
  - cek visual di 6 lebar layar;
  - catat pemakaian read di Firebase Console → Usage sebelum dan sesudah, seperti spec `firestore-read-quota` Task 5.2.
- [ ] **Task 1.15**: Go-live: batalkan semua faktur `UJI` terbit dengan alasan "Uji coba", ganti prefix ke `INV`, jalankan "Mulai penomoran" dengan nomor pertama 101. Demo ke owner di HP-nya, cek butir ⚑, lalu catat masukan sebagai task baru.

---

## Phase 2: Pembayaran bertahap dan penjualan (FR-6.6, FR-7.4, FR-9.2–9.5)

- [ ] **Task 2.1**: `payments[]` dengan transaksi: tambah dan hapus pembayaran (tanggal, nominal, metode, catatan, pencatat). Data Fase 1 (`paidAmount` tanpa riwayat) diubah menjadi satu entri "Saldo awal" saat faktur pertama kali dibuka atau diedit.
  - Selesai bila: tes `FakturCalc` untuk jumlah pembayaran lulus; DP lalu pelunasan mengubah status Sebagian → Lunas dan `paidAt` = tanggal pelunasan.
- [ ] **Task 2.2**: `allocateInvoiceDiscount()` beserta tes (jumlah alokasi selalu sama dengan diskon faktur).
- [ ] **Task 2.3**: Dialog **Catat sebagai penjualan**: tanggal, channel (otomatis Reseller bila pelanggan reseller), peringatan stok, lalu satu `batch` untuk `sales` + `products` + `stock_movements` + `invoices` (design §8). Tambah `sales_monthly` bila spec `firestore-read-quota` Fase 4 sudah jalan.
  - Selesai bila: AC-10 lulus; tombol tidak bisa dipakai dua kali; item manual dilewati; faktur yang sudah dicatat tidak bisa diubah item atau dibatalkan (FR-7.4).
- [ ] **Task 2.4**: Tampilkan tautan faktur di baris Penjualan yang punya `invoiceNumber`.
- [x] **Task 2.5** (diganti feedback owner 2026-11-05): pilihan "Diskon semua barang" di editor: Tanpa diskon, Reseller 15%, Reseller 20%, atau Isi sendiri (persen). Disimpan sebagai `bulkDiscount` di faktur, diterapkan ke barang katalog lewat `FakturCalc.applyBulkDiscount`. Persen tetap per reseller tidak dibuat.
- [ ] **Task 2.6**: Verifikasi Fase 2: build, tes, regresi angka Dashboard/Laporan untuk penjualan dari faktur, cek 6 lebar layar.

---

## Phase 3: Laporan piutang dan pelengkap (FR-11, FR-8.9)

- [ ] **Task 3.1**: Laporan piutang per pelanggan/reseller dan umur piutang (belum jatuh tempo, 1–7, 8–30, > 30 hari) dari faktur terbuka yang sudah dimuat.
- [ ] **Task 3.2**: Ekspor Excel daftar faktur dan piutang dengan ExcelJS yang sudah dimuat.
- [ ] **Task 3.3** (opsional, Q-9): Link publik baca-saja (`invoice_public/{token}`, design §6.4), hanya bila owner memintanya dan rules disetujui.
- [ ] **Task 3.4**: Verifikasi Fase 3: build, angka laporan sama dengan jumlah manual dari daftar faktur, ekspor terbuka di Excel.
- [ ] **Task 3.5**: Rules khusus faktur (design §5) ditambahkan ke rules produksi yang sekarang (aturan `request.auth != null` tetap untuk koleksi lain). Sebelumnya cek bahwa semua owner/admin punya dokumen `users/{uid}`. Deploy rules dilakukan Sehan dengan persetujuan terpisah.

---

## Ringkasan jumlah tugas
- Phase 0: 5 task (3 selesai, 1 menunggu demo owner, 1 opsional)
- Phase 1: 15 task (MVP)
- Phase 2: 6 task
- Phase 3: 5 task

## Pertanyaan untuk Sehan sebelum implementasi
- **Q-1**: Pembuatan gambar: opsi A (`html2canvas` dari CDN, dimuat saat dibutuhkan) atau opsi B (Canvas 2D tanpa library)? Usulan: A, dengan keputusan akhir setelah spike Task 1.10.
- **Q-2**: Nomor awal faktur di ERP, dan kapan owner berhenti memakai aplikasi lama? Prefix tetap `INV`?
- **Q-3**: Rules faktur (design §5) boleh disiapkan dan diterapkan? Siapa yang menjalankan deploy rules?
- **Q-4**: Uji manual menulis ke mana: Firestore Emulator lokal (`npx firebase-tools`, tanpa menambah paket ke repo), atau database produksi dengan faktur uji yang lalu dibatalkan?
- **Q-5**: Fase 2: apakah tim akan berhenti mencatat penjualan reseller secara manual begitu ada "Catat sebagai penjualan"? Tanggal penjualan = tanggal faktur atau tanggal kirim?
- **Q-6**: Apakah admin selain owner boleh membuat dan melunasi faktur, atau hanya owner?
- **Q-7**: `.kiro/` ada di `.gitignore`; spec ini di-commit dengan `git add -f`. Tetap di-commit, atau disimpan lokal seperti spec lain?
- **Q-8**: Perlu jalur kebalikan, yaitu membuat faktur dari penjualan yang sudah tercatat? Usulan: tidak di Fase 1–2.
- **Q-9**: Owner butuh link faktur yang bisa dibuka pembeli di browser, atau gambar sudah cukup?

## Keputusan
Dijawab 2026-11-05 sesuai rekomendasi, atas arahan Sehan. Butir ⚑ di requirements tetap dicek ke owner saat demo (Task 1.15).

| Q | Keputusan |
|---|---|
| Q-1 | Opsi A: `html2canvas@1.4.1` dari cdnjs, dimuat saat tombol Bagikan pertama kali ditekan. Bila spike Task 1.10 gagal (CORS foto atau batas canvas), pindah ke opsi B (Canvas 2D). |
| Q-2 | Prefix `INV`, faktur ERP pertama `INV0101`. Celah dari nomor terakhir yang terlihat di aplikasi lama (`INV0009`, 26 Okt 2026) mencegah bentrok bila owner masih membuat beberapa faktur di aplikasi lama. Owner berhenti memakai aplikasi lama setelah demo Task 1.15. Bila owner melaporkan nomor lama sudah ≥ 100, nomor pertama dinaikkan sebelum go-live. |
| Q-3 | Fase 1 memakai rules produksi yang sekarang (`request.auth != null`, dicek 2026-11-05). Akses owner/admin dijaga di UI (`navigateTo` dan menu). Rules khusus faktur menyusul di Task 3.5 dan di-deploy Sehan. |
| Q-4 | Tanpa database staging: uji di produksi dengan prefix `UJI` dan counter `invoice_UJI` yang terpisah, sehingga nomor `INV` tidak terpakai oleh uji. Faktur `UJI` terbit dibatalkan setelah uji; draf `UJI` dihapus. Fase 1 tidak menulis `sales`, `products`, atau `stock_movements`, jadi uji tidak mengubah angka bisnis. Uji Fase 2 (catat sebagai penjualan) butuh persetujuan terpisah karena mengubah stok. |
| Q-5 | Ya. Setelah Fase 2, penjualan reseller yang punya faktur dicatat lewat "Catat sebagai penjualan", bukan manual. Tanggal penjualan default = tanggal faktur, bisa diubah di dialog. |
| Q-6 | Owner dan admin sama-sama boleh membuat, menerbitkan, melunasi, dan membatalkan faktur, seperti menu Reseller. ⚑ |
| Q-7 | Spec tetap di-commit dengan `git add -f`, supaya bisa direview lewat PR. `.gitignore` tidak diubah. |
| Q-8 | Tidak ada jalur "faktur dari penjualan yang sudah tercatat" di Fase 1–2. |
| Q-9 | Tidak ada link publik. Gambar PNG dan PDF sudah cukup; Task 3.3 tidak dikerjakan kecuali owner memintanya. |

Konsekuensi untuk design: counter dibuat per prefix (`counters/invoice_{PREFIX}`), bukan satu `counters/invoices` (design §3.4).

## Catatan verifikasi Fase 1 (2026-11-05)
- `npm test`: 15 tes `faktur-calc` lulus. `npm run build`: lulus.
- Uji alur di localhost memakai halaman uji dengan Firestore tiruan di memori, karena tidak ada staging dan Firestore Emulator butuh Java yang tidak terpasang. Yang diuji: daftar, kartu ringkas, 7 filter, cari, periode, muat lebih banyak, editor (isian otomatis dari riwayat, pemilih produk, item manual, diskon item/faktur, pajak, ongkir, dibayar), contoh hitung design §4.3 kasus 1 dan 2, simpan draf, terbitkan (`UJI0005`, lalu `INV0101` dengan counter terpisah), tandai lunas, edit terbit (total di bawah dibayar ditolak), batal (nomor tidak dipakai ulang), hapus draf, deteksi bentrok versi, pulihkan isian setelah refresh, pengaturan dan Mulai penomoran (menolak counter yang sudah ada), offline, kuota habis, peran non-admin, logout.
- Gambar PNG 1080 px (sekitar 195 KB untuk 3 item) dibuat dengan html2canvas 1.4.1 dari cdnjs. Header CORS Cloudinary dicek: `Access-Control-Allow-Origin: *`. Opsi A dipakai (Q-1).
- Tampilan dicek di 320, 360, dan 1280 px tanpa scroll horizontal. ERP asli dijalankan di localhost dengan env checkout utama: urutan script benar, tidak ada error console, menu Faktur tersembunyi sebelum login.
- Review independen (agent code-reviewer) menemukan 3 masalah sedang dan 4 kecil; semuanya diperbaiki dan diuji ulang (salinan periode basi, XSS lewat toast, render ulang saat mengetik, edit selama menyimpan, kembali saat menyimpan, total bulan ini saat lebih dari 50 faktur, pembersihan cetak di Android).
- Belum diuji: login asli ke database produksi, tombol bagikan dan PDF di HP Android, faktur 50 item di canvas Android, dan dua perangkat menerbitkan bersamaan (keamanan nomor bergantung pada transaksi Firestore; halaman uji tidak mensimulasikan retry transaksi). Semua masuk Task 1.14 dan 1.15.

## Feedback owner dan tim (grup Inzta Dev, 2026-11-05)
Jawaban atas bagian C laporan PDF. Nama orang tidak ditulis di sini.

| Butir | Jawaban | Tindak lanjut |
|---|---|---|
| Nomor faktur terakhir di aplikasi lama | Belum melewati 100 | Tetap `INV0101`. Faktur `INV0101` sudah dibuat dari ERP pada 2026-11-05 (contoh PDF dikirim di grup) |
| Aplikasi lama | Sudah tidak digunakan lagi | Go-live dianggap jalan; uji `UJI` tidak wajib lagi |
| Pajak | Pilihan pajak tetap ada, tetapi harga produk sudah termasuk, tidak memakai PPN | Tidak ada perubahan: bawaan "Tidak ada" |
| Diskon | Reseller dibuat pilihan 15% dan 20%, pelanggan lain diisi sendiri | Dikerjakan: pilihan "Diskon semua barang" (Task 2.5) |
| Akses | Owner dan Admin, setuju | Tidak ada perubahan |
| Bagikan | Lewat gambar dan PDF | Tidak ada perubahan |
| Judul dokumen | "Faktur" atau "Invoice" belum diputuskan | Dikerjakan: pilihan "Judul dokumen" (FAKTUR/INVOICE) di Pengaturan, bawaan FAKTUR; faktur terbit memakai judul saat terbit |
