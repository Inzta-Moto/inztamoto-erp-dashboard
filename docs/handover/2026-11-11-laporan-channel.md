# Serah terima: filter channel Laporan + integrasi API marketplace (ERP InztaMoto)

Dari Sehan untuk Angkasa, 11 Nov 2026. Sehan pindah fokus ke fitur garansi; tugas ini dilanjutkan Angkasa.

## 1. Filter channel di Laporan Penjualan (sudah di-merge ke `main`, 11 Nov 2026)

Permintaan Bang Raja (rapat 11 Nov): "tambah dropdown aja disitu channel nya", tanpa section baru.

- Branch `feat/laporan-channel-filter`, commit `176431f`, di-merge ke `main` lewat PR #10 (merge commit `1f1bb80`). Merge ke `main` ter-deploy otomatis ke dashboard.inzta.id. GitHub tidak menerima status atau deployment apa pun untuk `1f1bb80` (dicek 11 Nov), jadi status deploy perlu dicek langsung di dashboard Vercel.
- File: `public/legacy/app-runtime.js`, `src/components/InztamotoApp.jsx`.
- Yang berubah: satu dropdown "Channel" (`#reportChannelFilter`) di baris filter Laporan, di antara Tahun dan Export Excel.
  - Berlaku untuk Laporan Penjualan dan Produk Terlaris: 4 kartu, Grafik Laporan, Detail, dan Export Excel (nama file, judul, baris info "Channel").
  - Saat satu channel dipilih, kartu "Channel Terbanyak" menjadi "Channel: <nama>".
  - "Semua Channel" memberi angka yang sama persis dengan sebelumnya.
  - Filter jalan di memori atas data `sales` yang sudah dimuat. Tidak ada listener atau query Firestore baru (kuota Spark aman).
  - Laporan Keuntungan, Produksi, Inventaris menyembunyikan dan mengabaikan filter (laba bersih mengurangi biaya produksi dan gaji yang tidak punya channel).
- Sudah diuji: `npm run build` lolos, `scripts/patch-runtime.cjs` lolos. Di harness lokal dengan Firebase tiruan dan data dummy, semua 56 skenario cocok (480 cek): "Semua Channel" identik dengan kode lama, angka per channel cocok dengan hitungan terpisah. Tidak ada overflow di 320 sampai 1440 px.
- **Belum diuji:** login asli dengan data produksi.

Yang perlu Angkasa lakukan:
1. Pastikan deploy Vercel untuk `1f1bb80` sukses.
2. Cek di dashboard.inzta.id dengan login asli: dropdown muncul di Laporan, angka berubah per channel, dan "Semua Channel" sama dengan angka sebelum rilis (bandingkan misalnya Laporan Penjualan Oktober 2026 dengan export Excel lama). Bila ada yang salah, revert PR #10 atau perbaiki lewat PR baru.
3. Keputusan:
   - **Terbuka, diputuskan Angkasa:** Tokopedia vs TikTok Shop. Di kode tidak ada nilai channel "TikTok". Nilai yang ada: Website, Shopee, Tokopedia, Reseller (dulu WhatsApp), Offline Store. Usulan: "Tokopedia" dipakai untuk Tokopedia/TikTok dulu. Kalau mau "TikTok Shop" terpisah, tambahkan ke form Penjualan sebagai tugas sendiri.
   - **Sudah diputuskan Sehan (11 Nov):** Laporan Keuntungan tidak difilter channel ("Biarkan"). Filter hanya untuk Penjualan dan Produk Terlaris.
4. Temuan sampingan (belum diubah): label "Periode" di export harian/mingguan bisa mundur satu hari kalau zona waktu browser di belakang UTC (`getReportPeriodText()` mem-parse `YYYY-MM-DD` sebagai UTC). Di WIB tidak terjadi.

## 2. Integrasi API Shopee, TikTok Shop, Tokopedia (belum dikerjakan, baru riset)

Catatan: halaman resmi tidak bisa dibuka saat riset, jadi semua poin di bawah dari sumber pihak ketiga dan **perlu dicek ulang saat login ke portalnya**.

Apakah bayar? API-nya sendiri gratis, tapi integrasinya tetap ada biaya:
- Shopee Open Platform: gratis daftar dan pakai. Ada kategori app "Seller In House System" untuk toko sendiri. App di-review Shopee dulu; beberapa region mensyaratkan volume order atau tier seller.
- TikTok Shop Partner API: gratis, tanpa biaya setup atau bulanan. Ada "Custom app" untuk toko sendiri. Syarat khusus Indonesia belum ditemukan.
- Tokopedia: API lama sudah dihentikan (akhir 2024). Toko Tokopedia diakses lewat TikTok Shop API (belum pasti, perlu dicek).
- Biaya yang tetap ada: waktu pengerjaan; waktu tunggu review app (belum diketahui, bisa berminggu-minggu); pemeliharaan (token diperbarui otomatis, versi API berubah); server untuk menyimpan kunci rahasia dan token (route Vercel + Vercel Cron, tetap di Firebase Spark tanpa Cloud Functions). Cek plan Vercel: plan Hobby setahu kami hanya untuk non-komersial dan cron-nya terbatas sekali sehari, jadi mungkin perlu Pro (belum dicek).
- Kuota tulis Firestore Spark 20 ribu per hari; tarik pesanan beberapa kali sehari masih aman.

Opsi:
1. **Integrasi API langsung** (niat awal). Shopee dulu (Bang Raja sudah konfirmasi ada API-nya), lalu TikTok Shop yang sekalian mencakup Tokopedia. Kira-kira 4 sampai 6 hari kerja per platform, 8 sampai 12 hari untuk keduanya, belum termasuk review.
2. **Import file export pesanan dari Seller Center.** Tombol "Import" di halaman Penjualan (bukan section baru). Kira-kira 2 sampai 4 hari kerja, tanpa approval, tapi admin upload manual dan format file bisa berubah.
3. **Aplikasi pihak ketiga** (BigSeller, Jubelio, Ginee). Ada paket gratis, tapi INZTA jadi pakai dua sistem; apakah datanya bisa ditarik ke ERP lewat API dan berapa harganya belum terverifikasi.

Usulan: opsi 1, dan **daftarkan app-nya secepatnya** karena review yang paling lama. Kalau review molor, opsi 2 jadi jalan sementara (logika simpan pesanannya bisa dipakai ulang). Integrasi ini sebaiknya dihitung sebagai change request terpisah.

Langkah pertama: login ke open.shopee.com dan partner.tiktokshop.com dengan akun pemilik toko INZTA, cek apakah kategori "Seller In House System" (Shopee) dan "Custom app" (TikTok Shop) tersedia untuk Indonesia dan dokumen apa yang diminta.

Sumber (pihak ketiga, belum dicek terhadap dokumen resmi):
- https://publicapis.io/shopee-api
- https://anythingmcp.com/guides/shopee-to-mcp
- https://www.odoo.com/documentation/19.0/applications/sales/sales/shopee_connector/setup.html
- https://www.echotik.live/blog/is-tiktok-shop-api-free-and-pricing-plans-explained/
- https://unified.to/blog/how_to_setup_a_tiktok_shop_application
- https://support.anchanto.com/hc/en-us/articles/34509808702609-Tokopedia-2025-Shop-Integration-with-Anchanto-OMS
- https://www.bigseller.com/blog/articleDetails/4399/erp-omnichannel-gratis-terbaik.htm
