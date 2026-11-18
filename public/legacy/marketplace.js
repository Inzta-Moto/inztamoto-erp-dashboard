// Marketplace page: TikTok Shop / Tokopedia connection and synced orders (Owner and Admin).
// Talks only to this ERP's own /api/marketplace/tiktok/* routes with the signed-in user's Firebase ID token.
// No Firestore listener and no direct Firestore read: one status call per page visit (about 20 document reads).
// Synced orders are NOT written to Penjualan yet; that waits for the owner decisions listed on the page.
// Loaded after app-runtime.js as a classic script, so it shares auth, state, $, toast, openModal, closeModal,
// navigateTo and getCurrentUserRole. Every value from the API reaches innerHTML only through mpEsc().

var mp = { loading: false, busy: "", error: "", data: null, loadedAt: null, seq: 0 };

var MP_RESULT = {
   connected: ["Toko TikTok Shop berhasil disambungkan. Tekan Sinkronkan sekarang untuk menarik pesanan.", "success"],
   state: ["Sambungan gagal: tautan izin sudah kedaluwarsa atau sudah dipakai. Ulangi dari tombol Sambungkan.", "error"],
   denied: ["Izin toko tidak diberikan di TikTok.", "warning"],
   exchange: ["TikTok menolak permintaan izin. Coba sambungkan lagi beberapa menit lagi.", "error"],
   config: ["Kunci app TikTok belum diisi di Vercel.", "error"],
};

function mpEsc(value) {
   return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

function mpRp(n) {
   var v = Number(n) || 0;
   return "Rp" + v.toLocaleString("id-ID");
}

function mpDateTime(value) {
   if (!value) return "-";
   var d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
   if (isNaN(d.getTime())) return "-";
   return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function mpRole() {
   return typeof getCurrentUserRole === "function" ? getCurrentUserRole() : "";
}

function mpCanUse() {
   var r = mpRole();
   return r === "owner" || r === "admin";
}

function mpNormalizeSku(v) {
   // Same rule as normalizeSku in src/lib/marketplace/order-to-sales.mjs.
   return String(v || "").trim().toUpperCase().replace(/\s+/g, "");
}

function mpMatch(sellerSku) {
   var want = mpNormalizeSku(sellerSku);
   if (!want) return null;
   return (state.products || []).find(function (p) {
      return mpNormalizeSku(p.sku) === want;
   }) || null;
}

async function mpApi(path, opts) {
   opts = opts || {};
   var user = auth.currentUser;
   if (!user) throw new Error("Sesi habis, silakan masuk lagi.");
   var token = await user.getIdToken(!!opts.forceRefresh);
   var res;
   try {
      res = await fetch("/api/marketplace/tiktok/" + path, {
         method: opts.method || "GET",
         headers: { Authorization: "Bearer " + token, Accept: "application/json" },
         cache: "no-store",
      });
   } catch (e) {
      throw new Error("Tidak bisa terhubung ke server ERP. Periksa koneksi internet.");
   }
   var data = null;
   try {
      data = await res.json();
   } catch (e) {
      data = null;
   }
   if (res.status === 401 && !opts.forceRefresh) return mpApi(path, Object.assign({}, opts, { forceRefresh: true }));
   if (!res.ok && !(data && data.sync)) {
      var msg = data && typeof data.error === "string" ? data.error.slice(0, 300) : "Server ERP menjawab " + res.status;
      var err = new Error(msg);
      err.status = res.status;
      throw err;
   }
   return data || {};
}

async function mpLoad() {
   var seq = ++mp.seq;
   mp.loading = true;
   mp.error = "";
   renderMarketplace();
   try {
      var data = await mpApi("status");
      if (seq !== mp.seq) return;
      mp.data = data;
      mp.loadedAt = new Date();
   } catch (e) {
      if (seq !== mp.seq) return;
      mp.error = e.message;
   } finally {
      if (seq === mp.seq) {
         mp.loading = false;
         renderMarketplace();
      }
   }
}

async function mpConnect() {
   if (mp.busy) return;
   mp.busy = "connect";
   renderMarketplace();
   try {
      var data = await mpApi("connect", { method: "POST" });
      if (data && typeof data.url === "string" && data.url.indexOf("https://") === 0) {
         window.location.href = data.url;
         return;
      }
      throw new Error("Tautan izin dari server tidak valid.");
   } catch (e) {
      toast(mpEsc(e.message), "error");
   }
   mp.busy = "";
   renderMarketplace();
}

async function mpSync() {
   if (mp.busy) return;
   mp.busy = "sync";
   renderMarketplace();
   try {
      var data = await mpApi("sync", { method: "POST" });
      var s = data.sync || {};
      if (s.ok) toast("Sinkron selesai: " + (s.fetched || 0) + " pesanan dicek, " + (s.written || 0) + " baru atau berubah.", "success");
      else toast(mpEsc("Sinkron gagal: " + (s.error || "tidak diketahui")), "error");
   } catch (e) {
      toast(mpEsc(e.message), "error");
   }
   mp.busy = "";
   mpLoad();
}

window.mpAskDisconnect = function () {
   openModal(
      "Putuskan TikTok Shop?",
      '<p style="font-size:14px">Token izin toko akan dihapus dari ERP dan sinkron harian berhenti. Pesanan yang sudah tersinkron tetap ada.</p>' +
         '<p style="font-size:13px;color:var(--text-muted);margin-top:8px">Untuk mencabut izin di sisi TikTok juga, hapus app "Inzta ERP" dari daftar layanan yang diotorisasi di Seller Center.</p>',
      '<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-danger btn-sm" onclick="mpDisconnect()"><i class="fas fa-link-slash"></i>Putuskan</button>',
   );
};

window.mpDisconnect = async function () {
   closeModal();
   try {
      await mpApi("disconnect", { method: "POST" });
      toast("TikTok Shop diputuskan dari ERP.", "success");
   } catch (e) {
      toast(mpEsc(e.message), "error");
   }
   mpLoad();
};

function mpStatusChip(conn) {
   var map = {
      connected: ["badge-active", "Tersambung"],
      expired: ["badge-out_of_stock", "Izin kedaluwarsa"],
      disconnected: ["badge-inactive", "Diputus"],
      not_connected: ["badge-pending", "Belum tersambung"],
   };
   var m = map[conn.status] || map.not_connected;
   return '<span class="badge ' + m[0] + '">' + m[1] + "</span>";
}

function mpSyncLine(ls) {
   if (!ls) return "Belum pernah sinkron.";
   var who = ls.trigger === "cron" ? "otomatis" : "manual" + (ls.by ? " oleh " + ls.by : "");
   if (ls.ok) {
      return mpDateTime(ls.at) + " (" + who + "): " + (ls.fetched || 0) + " pesanan dicek, " + (ls.written || 0) + " baru atau berubah" + (ls.complete === false ? ", belum semua (lanjut di sinkron berikutnya)" : "") + ".";
   }
   return mpDateTime(ls.at) + " (" + who + "): GAGAL, " + (ls.error || "tidak diketahui");
}

function mpOrdersTable(orders) {
   if (!orders || !orders.length) {
      return '<div class="empty-state"><i class="fas fa-inbox"></i><h4>Belum ada pesanan tersinkron</h4><p>Tekan Sinkronkan sekarang setelah toko tersambung.</p></div>';
   }
   var rows = orders
      .map(function (o) {
         var items = (o.items || [])
            .filter(function (it) {
               return it.quantity > 0;
            })
            .map(function (it) {
               var p = mpMatch(it.sellerSku);
               var chip = p
                  ? '<span class="badge badge-active" title="Cocok dengan produk ERP">' + mpEsc(p.name) + "</span>"
                  : '<span class="badge badge-low_stock" title="SKU belum ada di produk ERP">SKU ' + mpEsc(it.sellerSku || "kosong") + " belum cocok</span>";
               return "<div>" + mpEsc(it.productName) + (it.skuName ? " (" + mpEsc(it.skuName) + ")" : "") + " ×" + mpEsc(it.quantity) + " " + chip + "</div>";
            })
            .join("");
         var chClass = o.channel === "Tokopedia" ? "badge-tokopedia" : "badge-tiktok_shop";
         return (
            "<tr>" +
            "<td>" + mpEsc(o.orderId) + (o.isSample ? ' <span class="badge badge-pending">sampel</span>' : "") + "</td>" +
            "<td>" + mpEsc(o.date) + "</td>" +
            '<td><span class="badge ' + chClass + '">' + mpEsc(o.channel) + "</span></td>" +
            "<td>" + mpEsc(o.statusLabel || o.status) + "</td>" +
            "<td>" + (items || "-") + "</td>" +
            '<td style="text-align:right">' + mpEsc(mpRp(o.payment && o.payment.subTotal)) + "</td>" +
            "</tr>"
         );
      })
      .join("");
   return (
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>No. pesanan</th><th>Tanggal (WIB)</th><th>Channel</th><th>Status</th><th>Barang</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>' +
      rows +
      "</tbody></table></div>"
   );
}

function renderMarketplace() {
   var el = $("#pageMarketplace");
   if (!el) return;
   if (!mpCanUse()) {
      el.innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i><h4>Menu ini hanya untuk Owner atau Admin</h4></div>';
      return;
   }
   var d = mp.data;
   if (!d) {
      el.innerHTML = mp.error
         ? '<div class="card"><div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h4>Status marketplace belum bisa dimuat</h4><p>' + mpEsc(mp.error) + '</p><button type="button" class="btn btn-outline btn-sm" onclick="mpLoad()">Coba lagi</button></div></div>'
         : '<div class="card"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h4>Memuat status marketplace...</h4></div></div>';
      return;
   }
   var conn = d.connection || { status: "not_connected" };
   var cfg = d.configured || {};
   var isOwner = mpRole() === "owner";
   var connected = conn.status === "connected";
   var warn = [];
   if (!cfg.appKey || !cfg.appSecret) warn.push("TIKTOK_APP_KEY / TIKTOK_APP_SECRET belum diisi di Vercel.");
   if (!cfg.cron) warn.push("CRON_SECRET belum diisi di Vercel, jadi sinkron otomatis harian belum jalan. Sinkron manual tetap bisa.");

   var buttons = "";
   if (isOwner && !connected) {
      buttons += '<button type="button" class="btn btn-primary btn-sm" onclick="mpConnect()"' + (mp.busy ? " disabled" : "") + '><i class="fas fa-' + (mp.busy === "connect" ? "spinner fa-spin" : "link") + '"></i>' + (conn.status === "expired" ? "Sambungkan ulang" : "Sambungkan toko") + "</button>";
   }
   if (connected) {
      buttons += '<button type="button" class="btn btn-primary btn-sm" onclick="mpSync()"' + (mp.busy ? " disabled" : "") + '><i class="fas fa-' + (mp.busy === "sync" ? "spinner fa-spin" : "rotate") + '"></i>Sinkronkan sekarang</button>';
   }
   buttons += '<button type="button" class="btn btn-outline btn-sm" onclick="mpLoad()"' + (mp.loading ? " disabled" : "") + '><i class="fas fa-rotate-right' + (mp.loading ? " fa-spin" : "") + '"></i>Muat ulang</button>';
   if (isOwner && connected) {
      buttons += '<button type="button" class="btn btn-outline btn-sm" onclick="mpAskDisconnect()"><i class="fas fa-link-slash"></i>Putuskan</button>';
   }

   var shop = conn.shop ? mpEsc(conn.shop.name) + (conn.shop.region ? " (" + mpEsc(conn.shop.region) + ")" : "") : "-";
   var info =
      '<div class="card-body">' +
      '<p style="margin-bottom:6px"><b>Status:</b> ' + mpStatusChip(conn) + "</p>" +
      (conn.shop ? '<p style="margin-bottom:6px"><b>Toko:</b> ' + shop + (conn.shopCount > 1 ? " · " + mpEsc(conn.shopCount) + " toko memberi izin, yang dipakai toko Indonesia pertama" : "") + "</p>" : "") +
      (conn.connectedAt ? '<p style="margin-bottom:6px"><b>Disambungkan:</b> ' + mpEsc(mpDateTime(conn.connectedAt)) + (conn.connectedBy ? " oleh " + mpEsc(conn.connectedBy) : "") + "</p>" : "") +
      (conn.refreshExpiresAt ? '<p style="margin-bottom:6px"><b>Izin toko berlaku sampai:</b> ' + mpEsc(mpDateTime(conn.refreshExpiresAt)) + " (setelah itu perlu Sambungkan ulang)</p>" : "") +
      '<p style="margin-bottom:6px"><b>Sinkron terakhir:</b> ' + mpEsc(mpSyncLine(conn.lastSync)) + "</p>" +
      '<p style="margin-bottom:0;color:var(--text-muted);font-size:13px">Sinkron otomatis setiap hari pukul 00.00 WIB. Pesanan Tokopedia ikut masuk lewat TikTok Shop dan diberi channel Tokopedia.</p>' +
      (warn.length ? '<div style="margin-top:10px;padding:10px 12px;border-radius:8px;background:#FFF7ED;color:#C2410C;font-size:13px">' + warn.map(mpEsc).join("<br>") + "</div>" : "") +
      '<div style="margin-top:10px;padding:10px 12px;border-radius:8px;background:#E8F0FE;color:#1A73E8;font-size:13px">Pesanan di bawah <b>belum dicatat ke Penjualan</b>. Pencatatan otomatis menunggu keputusan owner: status pesanan yang dicatat, harga yang dipakai, dan apakah stok ikut berkurang. Label SKU menunjukkan produk ERP mana yang akan dipakai.</div>' +
      "</div>";

   var updated = mp.loadedAt ? "Diperbarui pukul " + String(mp.loadedAt.getHours()).padStart(2, "0") + "." + String(mp.loadedAt.getMinutes()).padStart(2, "0") : "";
   el.innerHTML =
      '<div class="card" style="margin-bottom:16px">' +
      '<div class="table-toolbar"><h3 style="font-size:15px;font-weight:700;margin-right:auto">TikTok Shop / Tokopedia</h3>' + buttons + "</div>" +
      info +
      "</div>" +
      '<div class="card">' +
      '<div class="table-toolbar"><h3 style="font-size:15px;font-weight:700;margin-right:auto">Pesanan tersinkron terbaru</h3><span style="font-size:12px;color:var(--text-muted)">' + mpEsc(updated) + "</span></div>" +
      mpOrdersTable(d.orders) +
      "</div>";
}

// Called by navigateTo() in app-runtime.js.
function marketplaceOnNavigate(page) {
   if (page !== "marketplace") return;
   if (!mpCanUse()) {
      renderMarketplace();
      return;
   }
   mpLoad();
}

// Coming back from TikTok (/api/marketplace/tiktok/callback redirects to /?marketplace=tiktok&result=...):
// wait for the login and profile, open the Marketplace page, show the result, and clean the address bar.
(function mpHandleReturn() {
   var params = new URLSearchParams(window.location.search);
   if (params.get("marketplace") !== "tiktok") return;
   var result = params.get("result") === "connected" ? "connected" : params.get("reason") || "exchange";
   var msg = MP_RESULT[result] || MP_RESULT.exchange;
   try {
      window.history.replaceState(null, "", window.location.pathname);
   } catch (e) {
      /* the page still works with the query left in place */
   }
   var tries = 0;
   var timer = setInterval(function () {
      tries++;
      if (state.user && state.user.role && mpRole()) {
         clearInterval(timer);
         if (mpCanUse()) navigateTo("marketplace");
         toast(msg[0], msg[1]);
      } else if (tries > 120) {
         clearInterval(timer);
      }
   }, 500);
})();

if (typeof updateNavigationAccess === "function") updateNavigationAccess();
