# Requirements Document: Faktur (Invoice) di ERP

Status: **draf, menunggu persetujuan Sehan** (2026-11-04). Belum ada kode. Keputusan default di dokumen ini mengikuti `riset-video-faktur.md` §9b, yang disetujui Sehan pada 2026-11-04 sebagai keputusan sementara. Butir bertanda ⚑ perlu dicek ke owner saat demo pertama.

Sumber:
- Riset 3 video demo dan PDF contoh: `C:\Users\PLN\Downloads\inzta-erp-faktur-riset\riset-video-faktur.md` (di luar repo, berisi data yang sudah disamarkan).
- Faktur contoh `INV0009` dari aplikasi invoice yang sekarang dipakai owner.
- Survei kode `main` (commit `1b0dcac`). Rujukan baris di bawah memakai commit itu.

Semua angka dan nama dalam contoh di dokumen ini **fiktif**. Data pembeli dan rekening dari PDF tidak disalin.

## 1. Overview & Problem Statement

### 1.1 Kondisi sekarang
- Owner membuat faktur di aplikasi invoice pihak ketiga dari Play Store, di HP Android. Produk diketik ulang di katalog aplikasi itu, padahal katalog yang sama sudah ada di ERP (riset §2.1 butir 2).
- Pesanan reseller masuk lewat WhatsApp. Faktur dikirim ke pembeli sebagai file. Owner ingin bisa membagikan faktur sebagai **gambar** (riset §2, V1 31 dtk).
- Penjualan dicatat terpisah di menu Penjualan ERP, satu dokumen `sales` per produk (`public/legacy/app-runtime.js:4547-4660`). Faktur dan penjualan tidak saling terhubung.
- Di aplikasi lama, nomor `#INV0007` muncul pada dua faktur yang berbeda (riset §3.1). Artinya nomor faktur bisa ganda.
- Format uang dan tanggal di aplikasi lama memakai gaya AS (`Rp1,320,000.00`, `10/26/2026`). Di PDF contoh, kolom Total terlalu sempit sehingga angkanya terpotong ke baris kedua (riset §6).

### 1.2 Tujuan
Menyediakan menu **Faktur** di ERP. Konsepnya sama dengan aplikasi lama (daftar, editor, pratinjau, bagikan), tetapi:
1. item diambil dari katalog produk ERP, lengkap dengan foto;
2. nomor faktur otomatis, berurutan, dan tidak bisa ganda;
3. nyaman dipakai di HP (mobile-first), karena owner jarang memakai laptop (riset §0b R3);
4. diskon reseller dalam persen tercetak di faktur (riset §2.1 butir 5);
5. hemat kuota baca Firestore di paket Spark.

### 1.3 Batasan
- **Tetap di paket Spark.** Tidak memakai Blaze, Cloud Functions, atau scheduled functions. Semua logika jalan di browser.
- Tidak mengubah angka Dashboard, Penjualan, Laporan, dan stok selama Fase 1 (lihat FR-9).
- ID dan class DOM yang sudah ada tidak diubah, dan `scripts/patch-runtime.cjs` tetap berfungsi.
- Pola kuota dari spec `firestore-read-quota` dipatuhi: listener hanya dibuka di halaman pemakainya, tanpa listener lebar saat login.
- Database `database-inzta` dipakai bersama portal investor. Kuota yang dipakai faktur ikut mengurangi jatah portal.

### 1.4 Di luar cakupan
- E-faktur pajak (DJP), PPN resmi, dan nomor seri faktur pajak.
- Pengiriman e-mail dari server.
- Sinkronisasi atau impor data dari aplikasi invoice lama.
- Pengaturan template, warna, dan ukuran font seperti fitur "Sesuaikan" di aplikasi lama.

## 2. User Personas

1. **Owner**: membuat dan membagikan faktur dari HP Android (Chrome), terutama untuk reseller yang memesan lewat WhatsApp. Ingin langkahnya sesingkat aplikasi lama.
2. **Admin**: membantu membuat faktur dan mencatat pembayaran, biasanya dari laptop.
3. **Pembeli / reseller** (tidak login): hanya menerima gambar atau PDF faktur. Perlu melihat harga asli, persentase diskon, total, saldo terutang, rekening, dan jatuh tempo.

## 3. User Stories

- **US-1**: Sebagai owner, saya ingin membuat faktur dari HP dengan memilih produk dari katalog ERP, supaya tidak mengetik ulang nama, harga, dan foto.
- **US-2**: Sebagai owner, saya ingin memberi diskon persen ke reseller per item atau per faktur, supaya reseller tahu berapa diskon yang diberikan.
- **US-3**: Sebagai owner, saya ingin membagikan faktur sebagai gambar langsung ke WhatsApp.
- **US-4**: Sebagai admin, saya ingin nomor faktur dibuat otomatis tanpa bentrok, walaupun dua orang menyimpan pada saat yang sama.
- **US-5**: Sebagai owner/admin, saya ingin mencatat uang yang sudah dibayar dan melihat saldo terutang serta status lunas.
- **US-6**: Sebagai owner, saya ingin melihat faktur yang belum dibayar dan yang lewat jatuh tempo, beserta total piutang.
- **US-7**: Sebagai owner, saya ingin mengatur logo, alamat, rekening, dan syarat pembayaran sekali saja, lalu dipakai di setiap faktur.
- **US-8**: Sebagai owner, saya ingin tahu siapa yang membuat, mengubah, atau membatalkan sebuah faktur.
- **US-9** (Fase 2): Sebagai admin, saya ingin faktur yang sudah final dicatat sebagai penjualan tanpa input dua kali.
- **US-10** (Fase 2): Sebagai admin, saya ingin mencatat beberapa kali pembayaran (DP lalu pelunasan) beserta tanggalnya.
- **US-11** (Fase 3): Sebagai owner, saya ingin laporan piutang per pelanggan dan umur piutang, serta ekspor Excel.

## 4. Functional Requirements

### FR-1: Pengaturan faktur
- **FR-1.1**: Owner/admin bisa mengatur: nama bisnis, alamat singkat, logo (unggah lewat Cloudinary seperti foto produk), satu atau lebih rekening (bank, nomor, atas nama), teks Syarat & Ketentuan default, jatuh tempo default dalam hari (awal 7), prefix nomor (awal `INV`), dan pajak default (awal "Tidak ada").
- **FR-1.2**: Setiap faktur menyimpan salinan (snapshot) profil bisnis, rekening, dan syarat saat faktur diterbitkan. Mengubah pengaturan tidak mengubah faktur lama.
- **FR-1.3**: Nomor awal bisa diatur sekali sebelum faktur pertama, supaya urutan melanjutkan nomor terakhir aplikasi lama dan tidak bentrok (contoh fiktif: melanjutkan dari `INV0042`). ⚑

### FR-2: Nomor faktur
- **FR-2.1**: Nomor dibuat otomatis saat faktur **diterbitkan**, dengan format `{prefix}{urut 4 digit}`, contoh fiktif `INV0043`. Bila urutan melewati 9999, digit bertambah (`INV10000`).
- **FR-2.2**: Nomor diambil dan dinaikkan di dalam satu transaksi Firestore bersama penulisan faktur, sehingga dua penerbitan bersamaan tidak pernah mendapat nomor yang sama.
- **FR-2.3**: Nomor tidak bisa diedit manual dan tidak dipakai ulang. Faktur terbit tidak dihapus, hanya dibatalkan (FR-7).
- **FR-2.4**: Draf belum punya nomor. Draf menampilkan label "DRAF".
- **FR-2.5**: Penerbitan butuh koneksi internet. Bila offline, tombol Terbitkan memberi pesan yang jelas dan isian tidak hilang.

### FR-3: Pelanggan (Tagih kepada)
- **FR-3.1**: Isian pelanggan: nama (wajib), kota (opsional), nomor HP (opsional).
- **FR-3.2**: Saklar **Reseller**. Bila aktif, pelanggan dipilih dari koleksi `resellers` yang sudah ada (hanya yang `status` aktif). Faktur menyimpan `resellerId` dan nama reseller, dan diberi label "Reseller".
- **FR-3.3**: Pelanggan retail tidak disimpan sebagai master data di Fase 1. Saat mengetik nama, ERP menyarankan nama, kota, dan HP dari faktur sebelumnya yang sudah dimuat di halaman, tanpa baca tambahan ke database.

### FR-4: Item faktur
- **FR-4.1**: Tombol **Tambah item** membuka pemilih produk dari katalog ERP (`state.products`, yang sudah dimuat saat login), dengan pencarian nama atau SKU, foto kecil, dan harga jual.
- **FR-4.2**: Item dari katalog menyimpan `productId`, SKU, nama, foto (`images[0].imageUrl`), dan harga katalog (`sellingPrice`) saat ditambahkan.
- **FR-4.3**: Per item bisa diubah: nama tampilan, catatan kecil di bawah nama (contoh "sepasang", "2pcs"), qty (bilangan bulat ≥ 1), dan harga satuan (bisa diedit manual; harga katalog tetap tersimpan).
- **FR-4.4**: Diskon per item: tidak ada, persen (0 sampai 100), atau nominal per unit. ⚑
- **FR-4.5**: Item manual tanpa katalog boleh dibuat (contoh: jasa press logo), tanpa foto.
- **FR-4.6**: Urutan item bisa diubah dan item bisa dihapus.
- **FR-4.7**: Kolom "Satuan" terpisah tidak dibuat. Satuan ditulis di catatan item (riset §9b Q16).
- **FR-4.8**: Faktur memuat paling sedikit 1 item dan paling banyak 50 item.

### FR-5: Ringkasan dan kalkulasi
- **FR-5.1**: Semua nilai uang adalah Rupiah bulat (integer), tanpa sen.
- **FR-5.2**: Urutan hitung:
  1. Total baris = qty × harga setelah diskon item.
  2. Subtotal = jumlah total baris.
  3. Diskon faktur: tidak ada, persen dari subtotal, atau nominal.
  4. Pajak: tidak ada, persen dari (subtotal − diskon faktur), atau nominal. Opsi "Dipotong" dan "Per Barang" dari aplikasi lama tidak dibuat. ⚑
  5. Ongkos kirim dan biaya lain (dengan label bebas) berupa nominal.
  6. Total = subtotal − diskon faktur + pajak + ongkir + biaya lain.
  7. Saldo terutang = total − dibayar.
- **FR-5.3**: Pembulatan: setiap hasil persen dibulatkan ke Rupiah terdekat pada langkahnya (diskon item per unit, diskon faktur, pajak), supaya angka yang tercetak selalu cocok bila dijumlah manual.
- **FR-5.4**: Diskon tidak boleh membuat harga atau subtotal negatif. Total tidak boleh negatif.
- **FR-5.5**: Baris ringkasan yang nilainya 0 tidak tercetak di dokumen.

### FR-6: Pembayaran dan status
- **FR-6.1** (Fase 1): Field **Dibayar** (nominal, 0 sampai total) dan tombol **Tandai lunas** yang mengisi Dibayar = Total serta mencatat waktu dan pencatatnya.
- **FR-6.2**: Status siklus faktur: `draft` (Draf), `issued` (Terbit), `cancelled` (Batal).
- **FR-6.3**: Status pembayaran dihitung dari angka, bukan dipilih manual: `unpaid` (Belum dibayar, dibayar = 0), `partial` (Sebagian, 0 < dibayar < total), `paid` (Lunas, dibayar = total). Toggle lama yang membuat saldo 0 padahal dibayar 0 tidak ditiru.
- **FR-6.4**: **Lewat jatuh tempo N hari** dihitung saat tampil (hari ini > jatuh tempo, faktur terbit, belum lunas). Tidak disimpan.
- **FR-6.5**: Jatuh tempo default = tanggal faktur + jatuh tempo default dari pengaturan (7 hari), bisa diubah per faktur, dan tidak boleh sebelum tanggal faktur.
- **FR-6.6** (Fase 2): Riwayat pembayaran: setiap pembayaran punya tanggal, nominal, metode (transfer/tunai/lainnya), catatan, dan pencatat. Dibayar = jumlah riwayat. Pembayaran yang salah bisa dihapus oleh owner/admin, tercatat siapa yang menghapus.
- **FR-6.7**: Status "Terkirim" tidak dibuat sebagai status. Sebagai gantinya, faktur mencatat `lastSharedAt` setiap kali dibagikan.

### FR-7: Edit dan batal
- **FR-7.1**: Draf bisa diedit dan dihapus permanen.
- **FR-7.2**: Faktur terbit tetap bisa diedit oleh owner/admin, termasuk yang sudah lunas. Bila total turun di bawah dibayar, simpan ditolak dengan pesan.
- **FR-7.3**: Faktur terbit tidak bisa dihapus. **Batalkan** meminta alasan, mengubah status ke `cancelled`, dan menyimpan nomornya. Faktur batal tetap tampil dengan filter "Batal" dan dicetak dengan tanda BATAL.
- **FR-7.4** (Fase 2): Faktur yang sudah dicatat sebagai penjualan (FR-9) tidak bisa diubah itemnya atau dibatalkan sebelum penjualannya dihapus dulu dari menu Penjualan. ⚑

### FR-8: Pratinjau, gambar, PDF, dan bagikan
- **FR-8.1**: Tab **Pratinjau** menampilkan dokumen faktur seperti yang akan dibagikan.
- **FR-8.2**: Isi dokumen, dari atas: logo, nama dan alamat bisnis; judul FAKTUR, nomor, tanggal, jatuh tempo; Tagih kepada (nama, kota, label Reseller bila ada); tabel item (No, Foto, Item + catatan, Qty, Harga, Diskon bila ada, Total); ringkasan; Info Pembayaran; Syarat & Ketentuan; catatan untuk pelanggan bila diisi. Faktur lunas diberi cap **LUNAS**; faktur batal diberi tanda **BATAL**.
- **FR-8.3**: Untuk item berdiskon, faktur mencetak harga asli, persentase atau nominal diskon, dan harga setelah diskon (riset §9b Q17). ⚑
- **FR-8.4**: Format Indonesia: tanggal `26 Okt 2026` di dokumen, uang `Rp 1.320.000` memakai `fmtRp` yang sudah ada (`app-runtime.js:255`). Angka tidak boleh terpotong ke baris kedua.
- **FR-8.5**: **Bagikan gambar**: membuat satu gambar PNG panjang, lebar sekitar 1080 px, lalu membuka lembar bagikan bawaan HP (Web Share API) sehingga bisa langsung dikirim ke WhatsApp. Bila browser tidak mendukung berbagi file, gambar diunduh.
- **FR-8.6**: **Unduh PDF** lewat dialog Cetak browser ("Simpan sebagai PDF") dengan tampilan cetak khusus faktur. Nama file yang disarankan: `{nomor}_{YYYY-MM-DD}`.
- **FR-8.7**: Tombol **Kirim teks WhatsApp** membuka `wa.me` dengan nomor HP pelanggan bila ada, berisi ringkasan teks (nomor, total, saldo terutang, jatuh tempo, rekening). Gambar tetap dikirim lewat FR-8.5.
- **FR-8.8**: Foto produk yang gagal dimuat diganti kotak kosong, dan gambar tetap terbentuk.
- **FR-8.9** (Fase 3, opsional): Link publik baca-saja per faktur. Lihat design §6.4 dan pertanyaan terbuka Q-9.

### FR-9: Hubungan dengan penjualan dan stok
- **FR-9.1** (Fase 1): Faktur **tidak** mengubah `sales`, `products.stock`, `stock_movements`, Dashboard, atau Laporan. ⚑
- **FR-9.2** (Fase 2): Tombol **Catat sebagai penjualan** pada faktur terbit membuat satu dokumen `sales` per item katalog, mengurangi stok, dan menulis `stock_movements`, dalam satu batch. Channel `Reseller` (dengan `resellerId`) bila pelanggan reseller; selain itu channel dipilih saat mencatat. Harga yang dipakai adalah harga satuan setelah diskon item, dan diskon tingkat faktur dibagi ke item secara proporsional.
- **FR-9.3**: Penjualan yang dibuat dari faktur menyimpan `invoiceId` dan `invoiceNumber`. Faktur menyimpan daftar `saleIds` dan waktu pencatatan. Tombol tidak bisa dipakai dua kali.
- **FR-9.4**: Item manual (tanpa `productId`) tidak dicatat sebagai penjualan.
- **FR-9.5**: Bila stok tidak cukup, ERP menampilkan peringatan per item, tetapi tetap mengikuti aturan `saveSale` yang sekarang, yaitu menolak (`app-runtime.js:4555-4558`).

### FR-10: Daftar, filter, dan cari
- **FR-10.1**: Halaman Faktur menampilkan kartu ringkas di atas: total piutang (jumlah saldo terutang faktur terbit yang belum lunas), jumlah faktur lewat jatuh tempo, dan total yang ditagih bulan ini.
- **FR-10.2**: Filter chip: Semua, Belum dibayar, Sebagian, Lewat jatuh tempo, Lunas, Draf, Batal.
- **FR-10.3**: Cari berdasarkan nomor faktur, nama pelanggan, kota, atau nama item.
- **FR-10.4**: Filter periode bulan dan tahun pada tanggal faktur.
- **FR-10.5**: Di HP, daftar berupa kartu: nomor, tanggal, pelanggan, total, status, dan keterangan "Lunas 26 Okt" atau "Lewat 5 hari". Di desktop, daftar berupa tabel. Sisi kartu tidak diberi garis warna.

### FR-11: Laporan piutang (Fase 3)
- **FR-11.1**: Piutang per pelanggan atau reseller: jumlah faktur terbuka, total saldo, dan faktur tertua.
- **FR-11.2**: Umur piutang: belum jatuh tempo, 1–7 hari, 8–30 hari, lebih dari 30 hari.
- **FR-11.3**: Ekspor Excel memakai ExcelJS yang sudah dimuat (`src/components/LegacyScripts.jsx:55`).

### FR-12: Akses dan audit
- **FR-12.1**: Menu Faktur hanya untuk peran owner dan admin, seperti menu Reseller (`app-runtime.js:722-743`, `:1121-1130`). ⚑
- **FR-12.2**: Setiap faktur menyimpan `createdAt/createdBy`, `updatedAt/updatedBy`, `issuedAt/issuedBy`, `paidAt/paidBy`, serta `cancelledAt/cancelledBy/cancelReason`. Pelaku disimpan sebagai `{ uid, name }`.
- **FR-12.3**: Detail faktur menampilkan jejak ini dalam bentuk ringkas ("Dibuat oleh A, 26 Okt 2026 14.10").
- **FR-12.4**: Riwayat lengkap setiap perubahan field tidak dibuat. Yang dicatat hanya perubahan terakhir dan peristiwa penting (terbit, lunas, batal, pembayaran).

## 5. Non-Functional Requirements
- **NFR-1 Kuota**: Membuka ERP tanpa membuka halaman Faktur tidak menambah baca apa pun. Membuka halaman Faktur membaca paling banyak 50 faktur terbaru, ditambah faktur terbuka, ditambah 2 dokumen (pengaturan dan counter). Faktur lama dimuat dengan tombol "Muat lebih banyak".
- **NFR-2 Kuota tulis**: Tidak ada autosave ke Firestore. Draf yang sedang diketik disimpan di `localStorage` perangkat, lalu ditulis ke Firestore hanya saat Simpan atau Terbitkan.
- **NFR-3 Mobile-first**: Semua alur (buat, edit, pratinjau, bagikan, tandai lunas) bisa dikerjakan satu tangan di Chrome Android lebar 360–412 px. Tidak ada scroll horizontal halaman. Target sentuh minimal 44 px.
- **NFR-4 Responsif**: Dicek di lebar 320, 360, 412, 768, 1024, dan 1440 px. ERP saat ini hanya punya tema terang (`src/app/globals.css` tidak punya dark mode), jadi cek tema gelap tidak berlaku.
- **NFR-5 Ukuran gambar**: Gambar faktur 10 item di bawah 1,5 MB supaya cepat terkirim lewat WhatsApp.
- **NFR-6 Dependensi**: Tidak menambah paket npm. Library pembuat gambar, bila dipakai, dimuat dari CDN hanya saat dibutuhkan, seperti ExcelJS sekarang. Pilihannya diputuskan Sehan (design §6.2, Q-1).
- **NFR-7 Keamanan**: Hanya owner/admin yang login yang bisa membaca dan menulis koleksi faktur (setelah rules diterapkan; design §5). Data pembeli tidak pernah masuk URL selain nomor HP di link `wa.me` yang dibuka pengguna sendiri.
- **NFR-8 Ketepatan angka**: Kalkulasi faktur ada di fungsi murni yang punya tes otomatis (design §4.2).

## 6. Acceptance Criteria
- **AC-1**: Membuat faktur 10 item dari katalog di HP 360 px, lalu membagikannya sebagai gambar ke WhatsApp, selesai tanpa mengetik nama atau harga produk.
- **AC-2**: Dua perangkat menerbitkan faktur pada detik yang sama dan mendapat dua nomor berbeda yang berurutan. Tidak ada nomor yang terlewat kecuali karena transaksi gagal total.
- **AC-3**: Untuk set contoh fiktif di design §4.3, subtotal, diskon, pajak, total, dan saldo terutang sama dengan hitungan manual. Semua tes kalkulasi lulus.
- **AC-4**: Status pembayaran berubah sendiri dari Belum dibayar ke Sebagian ke Lunas sesuai angka Dibayar. Faktur lewat jatuh tempo menampilkan jumlah hari yang benar.
- **AC-5**: Membatalkan faktur menyimpan nomornya; faktur berikutnya mendapat nomor baru, bukan nomor yang dibatalkan.
- **AC-6**: Mengubah rekening di pengaturan tidak mengubah faktur yang sudah terbit.
- **AC-7**: Login tanpa membuka halaman Faktur tidak membaca koleksi `invoices`, `invoice_settings`, atau `counters` (dicek lewat network/console, seperti AC-2 spec `firestore-read-quota`).
- **AC-8**: Pengguna dengan peran selain owner/admin tidak melihat menu Faktur dan tidak bisa membukanya lewat `navigateTo`.
- **AC-9**: Fase 1 tidak mengubah angka Dashboard, Penjualan, Laporan, atau stok produk (dibandingkan sebelum dan sesudah membuat faktur uji).
- **AC-10** (Fase 2): "Catat sebagai penjualan" membuat penjualan dan mengurangi stok tepat sekali, dan totalnya sama dengan total faktur dikurangi pajak, ongkir, biaya lain, dan item manual.
- **AC-11**: `npm run build` lulus.
