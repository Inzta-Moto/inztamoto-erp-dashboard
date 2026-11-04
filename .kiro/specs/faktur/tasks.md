# Tasks: Faktur (Invoice) di ERP

Status: **belum dimulai** (2026-11-04). Menunggu persetujuan spec dan jawaban pertanyaan di bagian akhir. Tidak ada task yang memakai Blaze atau Cloud Functions, dan tidak ada paket npm baru.

Aturan verifikasi untuk setiap task kode:
- `npm run build` lulus, dan output-nya dicatat.
- Tes kalkulasi: `node --test scripts/faktur-calc.test.cjs` lulus (setelah Task 1.2 ada).
- Cek manual di Chrome pada lebar 320, 360, 412, 768, 1024, dan 1440 px (tema terang saja; ERP belum punya tema gelap).
- Tulisan ke Firestore saat uji mengikuti keputusan Q-4. Tanpa keputusan itu, tidak ada uji tulis ke produksi.

---

## Phase 0: Keputusan dan persiapan (tanpa kode fitur)

- [ ] **Task 0.1**: Sehan menyetujui requirements, design, dan tasks ini, serta menjawab Q-1 sampai Q-4.
  - Selesai bila: jawaban dicatat di bagian "Keputusan" dokumen ini.
- [ ] **Task 0.2**: Cek ke owner butir ⚑ di requirements (pajak, diskon item, akses admin, faktur tanpa efek stok di Fase 1).
  - Selesai bila: setiap ⚑ punya jawaban "tetap" atau "ubah", dan requirements diperbarui.
- [ ] **Task 0.3**: Siapkan rules faktur (design §5). Cek dulu bahwa semua owner/admin punya dokumen `users/{uid}` dengan baca terbatas `limit(5)`, atas izin Sehan. Penerapan rules ke produksi dilakukan Sehan.
  - Selesai bila: rules diuji di Emulator (atau Rules Playground) untuk kasus: admin baca, staf lain ditolak, counter hanya +1, nomor tidak bisa diubah, faktur terbit tidak bisa dihapus.
- [ ] **Task 0.4**: Tentukan nomor awal dan buat `counters/invoices` serta `invoice_settings/default` (skrip setup dengan mode `--dry`, dijalankan Sehan).
  - Selesai bila: dua dokumen ada; `next` lebih besar dari nomor terakhir aplikasi lama.
- [ ] **Task 0.5**: Mockup 3 layar (daftar, editor, pratinjau) di 360 px, disetujui owner.

---

## Phase 1: MVP faktur (FR-1 sampai FR-5, FR-6.1–6.5, FR-7.1–7.3, FR-8.1–8.8, FR-10, FR-12)

### Fondasi
- [ ] **Task 1.1**: Kabel di runtime dan markup: `#pageFaktur`, `nav-item` `#menuFaktur`, `TITLES.faktur`, `case "faktur"`, guard peran di `navigateTo`, tampil/sembunyi menu di `updateNavigationAccess`, hook `fakturCleanup` di `cleanupAppSession`. Muat `/legacy/faktur-calc.js` dan `/legacy/faktur.js` setelah `app-runtime.js` di `LegacyScripts.jsx`.
  - Selesai bila: owner/admin melihat menu Faktur dengan halaman kosong "Belum ada faktur"; peran lain tidak melihat menu dan `navigateTo("faktur")` kembali ke Dashboard (AC-8); `node scripts/patch-runtime.cjs` pada salinan file tetap berhasil; build lulus.
- [ ] **Task 1.2**: `public/legacy/faktur-calc.js` (design §4.2) dan `scripts/faktur-calc.test.cjs` memakai `node:test` dan `node:assert` bawaan.
  - Kasus tes minimal: 4 kasus di design §4.3; diskon persen 0 dan 100; diskon nominal melebihi harga; total tidak negatif; pembulatan .5; `paymentStatus` untuk dibayar 0, sebagian, sama dengan total; `isOpen` untuk draft, issued, cancelled; `formatInvoiceNumber` 9, 43, 9999, 10000; `daysOverdue` sebelum, pada, dan sesudah jatuh tempo, termasuk lintas bulan.
  - Selesai bila: semua tes lulus dan output dicatat.
- [ ] **Task 1.3**: Listener lazy di `faktur.js`: `invoices_recent` (50 terbaru), `invoices_open` (`isOpen == true`), `invoice_settings`. Daftarkan ke `LAZY_LISTENERS` dan `LAZY_LISTENERS_BY_PAGE.faktur`. Pesan khusus untuk `resource-exhausted` seperti halaman Belanja Investasi (`app-runtime.js:920-928`).
  - Selesai bila: login tanpa membuka Faktur tidak memanggil koleksi faktur (AC-7, dicek di tab Network/console); membuka Faktur memuat data.

### Pengaturan dan penomoran
- [ ] **Task 1.4**: Layar Pengaturan faktur (design §9.5): logo lewat Cloudinary, nama, alamat, rekening (tambah/hapus), syarat, jatuh tempo default, prefix, pajak default. Nomor berikutnya tampil baca saja.
  - Selesai bila: perubahan tersimpan di `invoice_settings/default` dan tampil di pratinjau draf.
- [ ] **Task 1.5**: `issueInvoice()` dengan `runTransaction` (design §4.1), snapshot `business`, dan audit `issuedAt/issuedBy`. Pesan jelas saat offline.
  - Selesai bila: uji dua tab/perangkat menerbitkan bersamaan menghasilkan dua nomor berbeda berurutan (AC-2); offline menampilkan pesan dan isian tidak hilang.

### Editor
- [ ] **Task 1.6**: Kerangka editor penuh halaman: header (kembali, nomor/DRAF, Sunting/Pratinjau), bagian Pelanggan, Tanggal & jatuh tempo (default +7 hari), Catatan, bar bawah menempel. Draf lokal di `localStorage` selama mengetik.
  - Selesai bila: tanpa scroll horizontal di 320 px; refresh di tengah mengetik memulihkan isian; jatuh tempo sebelum tanggal faktur ditolak.
- [ ] **Task 1.7**: Pelanggan: saklar Reseller dengan pilihan dari `state.resellers` aktif; retail dengan saran dari faktur yang sudah dimuat (FR-3).
  - Selesai bila: memilih reseller mengisi nama dan label; saran retail tidak menambah read.
- [ ] **Task 1.8**: Pemilih produk (lembar bawah/modal) dari `state.products` dengan cari nama/SKU; item manual; edit item (nama, catatan, harga, diskon item); stepper qty; ubah urutan dan hapus. Foto memakai transform `w_200`.
  - Selesai bila: menambah 10 item di HP 360 px tanpa mengetik nama atau harga (bagian dari AC-1); batas 50 item ditegakkan.
- [ ] **Task 1.9**: Ringkasan dan pembayaran: diskon faktur, pajak, ongkir, biaya lain, Dibayar, Tandai lunas, semua lewat `FakturCalc`. Simpan draf, Terbitkan, Simpan (faktur terbit), Hapus draf, Batalkan dengan alasan. Audit `createdBy/updatedBy/paidBy/cancelledBy`.
  - Selesai bila: angka layar sama dengan kasus design §4.3 (AC-3); status berpindah Belum dibayar → Sebagian → Lunas (AC-4); total di bawah Dibayar ditolak; faktur batal menyimpan nomor dan nomor berikutnya baru (AC-5).

### Dokumen dan bagikan
- [ ] **Task 1.10**: Spike 1–2 jam sebelum memilih opsi PNG: uji CORS foto Cloudinary di canvas dan uji opsi A (html2canvas dari CDN) di Chrome Android, termasuk faktur 50 item.
  - Selesai bila: hasil spike dan pilihan opsi (A atau B) dicatat di design §6.2.
- [ ] **Task 1.11**: `renderInvoiceDocument()` (design §6.1): header, Tagih kepada, tabel item dengan harga asli dan diskon, ringkasan tanpa baris 0, rekening, syarat, cap LUNAS/BATAL, format `fmtRp` dan tanggal Indonesia.
  - Selesai bila: tidak ada angka yang terpotong pada nominal sampai Rp 999.999.999; mengubah pengaturan tidak mengubah faktur terbit (AC-6).
- [ ] **Task 1.12**: Bagikan gambar dua langkah (Siapkan → Bagikan) dengan Web Share API dan fallback unduh; PDF lewat `window.print()` dengan CSS cetak; teks WhatsApp `wa.me`; catat `lastSharedAt`.
  - Selesai bila: di Chrome Android, gambar 10 item terkirim ke WhatsApp (AC-1) dan ukurannya < 1,5 MB (NFR-5); PDF A4 rapi tanpa baris terpotong; di desktop gambar terunduh.

### Daftar
- [ ] **Task 1.13**: Daftar faktur: kartu ringkas (piutang, lewat tempo, ditagih bulan ini), chip filter, cari, filter bulan/tahun dengan `.get()` untuk periode yang belum dimuat, kartu di HP dan tabel di desktop, Muat lebih banyak.
  - Selesai bila: angka kartu piutang sama dengan jumlah saldo faktur terbuka; filter Lewat jatuh tempo menampilkan jumlah hari yang benar.

### Gerbang mutu Fase 1
- [ ] **Task 1.14**: Verifikasi Fase 1:
  - `npm run build` dan `node --test` lulus;
  - semua AC-1 sampai AC-9 dicek dan dicatat hasilnya;
  - regresi: Dashboard, Penjualan, Laporan, dan stok tidak berubah sebelum dan sesudah membuat faktur uji (AC-9); halaman lain tetap jalan; logout menghapus draf lokal;
  - cek visual di 6 lebar layar;
  - catat pemakaian read di Firebase Console → Usage sebelum dan sesudah, seperti spec `firestore-read-quota` Task 5.2.
- [ ] **Task 1.15**: Demo ke owner di HP-nya, lalu catat masukan sebagai task baru.

---

## Phase 2: Pembayaran bertahap dan penjualan (FR-6.6, FR-7.4, FR-9.2–9.5)

- [ ] **Task 2.1**: `payments[]` dengan transaksi: tambah dan hapus pembayaran (tanggal, nominal, metode, catatan, pencatat). Data Fase 1 (`paidAmount` tanpa riwayat) diubah menjadi satu entri "Saldo awal" saat faktur pertama kali dibuka atau diedit.
  - Selesai bila: tes `FakturCalc` untuk jumlah pembayaran lulus; DP lalu pelunasan mengubah status Sebagian → Lunas dan `paidAt` = tanggal pelunasan.
- [ ] **Task 2.2**: `allocateInvoiceDiscount()` beserta tes (jumlah alokasi selalu sama dengan diskon faktur).
- [ ] **Task 2.3**: Dialog **Catat sebagai penjualan**: tanggal, channel (otomatis Reseller bila pelanggan reseller), peringatan stok, lalu satu `batch` untuk `sales` + `products` + `stock_movements` + `invoices` (design §8). Tambah `sales_monthly` bila spec `firestore-read-quota` Fase 4 sudah jalan.
  - Selesai bila: AC-10 lulus; tombol tidak bisa dipakai dua kali; item manual dilewati; faktur yang sudah dicatat tidak bisa diubah item atau dibatalkan (FR-7.4).
- [ ] **Task 2.4**: Tampilkan tautan faktur di baris Penjualan yang punya `invoiceNumber`.
- [ ] **Task 2.5** (opsional, ⚑): `defaultDiscountPercent` di `resellers` dan isian otomatis diskon saat reseller dipilih.
- [ ] **Task 2.6**: Verifikasi Fase 2: build, tes, regresi angka Dashboard/Laporan untuk penjualan dari faktur, cek 6 lebar layar.

---

## Phase 3: Laporan piutang dan pelengkap (FR-11, FR-8.9)

- [ ] **Task 3.1**: Laporan piutang per pelanggan/reseller dan umur piutang (belum jatuh tempo, 1–7, 8–30, > 30 hari) dari faktur terbuka yang sudah dimuat.
- [ ] **Task 3.2**: Ekspor Excel daftar faktur dan piutang dengan ExcelJS yang sudah dimuat.
- [ ] **Task 3.3** (opsional, Q-9): Link publik baca-saja (`invoice_public/{token}`, design §6.4), hanya bila owner memintanya dan rules disetujui.
- [ ] **Task 3.4**: Verifikasi Fase 3: build, angka laporan sama dengan jumlah manual dari daftar faktur, ekspor terbuka di Excel.

---

## Ringkasan jumlah tugas
- Phase 0: 5 task (keputusan dan persiapan)
- Phase 1: 15 task (MVP)
- Phase 2: 6 task
- Phase 3: 4 task

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
(diisi setelah Task 0.1)
