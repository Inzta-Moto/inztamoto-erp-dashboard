// Faktur (invoice) page, spec .kiro/specs/faktur. Loaded after app-runtime.js and faktur-calc.js as a classic script,
// so it shares the runtime's db, auth, state, fmtRp, toast and lazy-listener registry instead of a second Firebase SDK.

var FK_PAGE_SIZE = 50;
var FK_LIST_PER_PAGE = 20;
var FK_MAX_ITEMS = 50;
var FK_DOC_WIDTH = 720;
var FK_IMAGE_WIDTH = 1080;
var FK_LOCAL_PREFIX = "fk_local_";
var FK_HTML2CANVAS_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
var FK_QUOTA_MESSAGE =
   "Kuota baca harian database sudah habis. Data bisa dimuat lagi setelah kuota direset, sekitar pukul 14.00 sampai 15.00 WIB.";

var FK_FILTERS = [
   { value: "all", label: "Semua" },
   { value: "unpaid", label: "Belum dibayar" },
   { value: "partial", label: "Sebagian" },
   { value: "overdue", label: "Lewat jatuh tempo" },
   { value: "paid", label: "Lunas" },
   { value: "draft", label: "Draf" },
   { value: "cancelled", label: "Batal" },
];

var FK_STATUS_LABEL = {
   draft: "Draf",
   unpaid: "Belum dibayar",
   partial: "Sebagian",
   overdue: "Lewat jatuh tempo",
   paid: "Lunas",
   cancelled: "Batal",
};

var FK_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fkInitialState() {
   return {
      recent: [],
      recentLoaded: false,
      recentLastDoc: null,
      moreCursor: null,
      hasMore: false,
      loadingMore: false,
      open: [],
      openLoaded: false,
      extra: {},
      loadedPeriods: {},
      settings: null,
      settingsLoaded: false,
      counter: { prefix: null, data: null, loaded: false, loading: false },
      error: "",
      view: "list",
      filter: "all",
      search: "",
      month: "all",
      year: "all",
      page: 1,
      editor: null,
      busy: false,
      share: null,
      pickerQuery: "",
      sheetItemIdx: -1,
      settingsForm: null,
      returnToEditor: false,
      logoUploading: false,
   };
}

var fk = fkInitialState();

LAZY_LISTENERS.invoices_recent = function () {
   return db
      .collection("invoices")
      .orderBy("createdAt", "desc")
      .limit(FK_PAGE_SIZE)
      .onSnapshot(function (snap) {
         fk.recent = snap.docs.map(fkDocData);
         fk.recentLoaded = true;
         fk.recentLastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
         if (!fk.moreCursor) fk.hasMore = snap.size === FK_PAGE_SIZE;
         fk.error = "";
         fkRenderIfList();
      }, fkListenerError("invoices_recent"));
};

LAZY_LISTENERS.invoices_open = function () {
   return db
      .collection("invoices")
      .where("isOpen", "==", true)
      .onSnapshot(function (snap) {
         fk.open = snap.docs.map(fkDocData);
         fk.openLoaded = true;
         fkRenderIfList();
      }, fkListenerError("invoices_open"));
};

LAZY_LISTENERS.invoice_settings = function () {
   return db
      .collection("invoice_settings")
      .doc("default")
      .onSnapshot(function (snap) {
         fk.settings = snap.exists ? snap.data() : null;
         fk.settingsLoaded = true;
         if (fk.view === "settings" && !fk.busy) return;
         fkRenderIfList();
      }, fkListenerError("invoice_settings"));
};

LAZY_LISTENERS_BY_PAGE.faktur = ["invoices_recent", "invoices_open", "invoice_settings"];

function fkDocData(d) {
   return Object.assign({ id: d.id }, d.data());
}

function fkListenerError(name) {
   return function (err) {
      console.error("Faktur listener error (" + name + "):", err);
      state.lazyListening[name] = false;
      fk.error = fkErrorMessage(err, "Gagal memuat faktur");
      fkRenderIfList();
   };
}

function fkErrorMessage(err, prefix) {
   if (err && err.code === "resource-exhausted") return FK_QUOTA_MESSAGE;
   if (err && (err.code === "unavailable" || /offline/i.test(err.message || ""))) {
      return "Tidak ada koneksi internet. Coba lagi setelah tersambung.";
   }
   return prefix + ": " + (err && err.message ? err.message : err);
}

// Called by cleanupAppSession() on logout: local unsaved invoices must not outlive the session on a shared device.
function fakturCleanup() {
   fk = fkInitialState();
   fkCloseSheet();
   try {
      Object.keys(localStorage)
         .filter(function (k) { return k.indexOf(FK_LOCAL_PREFIX) === 0; })
         .forEach(function (k) { localStorage.removeItem(k); });
   } catch (e) {}
}

function fkEsc(value) {
   return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

// Local calendar date: the runtime's `today` is UTC and is still yesterday before 07.00 WIB.
function fkToday() {
   var d = new Date();
   return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function fkFmtDate(iso) {
   var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
   if (!m) return "-";
   return +m[3] + " " + FK_MONTHS[+m[2] - 1] + " " + m[1];
}

function fkFmtDateTime(iso) {
   if (!iso) return "";
   var d = new Date(iso);
   if (isNaN(d.getTime())) return "";
   return (
      d.getDate() + " " + FK_MONTHS[d.getMonth()] + " " + d.getFullYear() + " " +
      String(d.getHours()).padStart(2, "0") + "." + String(d.getMinutes()).padStart(2, "0")
   );
}

function fkActor() {
   var u = auth.currentUser;
   return {
      uid: u ? u.uid : "",
      name: (state.user && (state.user.name || state.user.email)) || (u && u.email) || "",
   };
}

function fkNow() {
   return new Date().toISOString();
}

function fkCanEdit() {
   var role = getCurrentUserRole();
   return role === "owner" || role === "admin";
}

// The runtime's toast() writes its message with innerHTML, and messages here can carry product names or errors.
function fkToast(msg, type) {
   toast(fkEsc(msg), type);
}

function fkRenderIfList() {
   if (state.currentPage !== "faktur") return;
   if (fk.view === "list") renderFaktur();
}

// The same invoice can sit in several caches (open listener, newest-50 listener, one-off period reads);
// the copy with the latest updatedAt wins, so a stale .get() copy never hides a newer write.
function fkAllInvoices() {
   var map = {};
   var add = function (inv) {
      var cur = map[inv.id];
      if (!cur || String(inv.updatedAt || "") >= String(cur.updatedAt || "")) map[inv.id] = inv;
   };
   Object.keys(fk.extra).forEach(function (id) { add(fk.extra[id]); });
   fk.open.forEach(add);
   fk.recent.forEach(add);
   return Object.keys(map).map(function (id) { return map[id]; });
}

// After this editor writes, the one-off copy (if any) is replaced so the list and the next version check agree.
function fkSyncCopy(ed) {
   if (ed && ed.id && fk.extra[ed.id] && ed.base) fk.extra[ed.id] = Object.assign({}, ed.base, { id: ed.id });
}

function fkFindInvoice(id) {
   return fkAllInvoices().find(function (inv) { return inv.id === id; }) || null;
}

function fkStatusOf(inv) {
   return FakturCalc.displayStatus(inv, fkToday());
}

function fkStatusBadge(status, extra) {
   return '<span class="badge fk-badge fk-badge-' + status + '">' + FK_STATUS_LABEL[status] + (extra ? " " + extra : "") + "</span>";
}

function fkStatusNote(inv) {
   var s = fkStatusOf(inv);
   if (s === "paid" && inv.paidAt) return "Lunas " + fkFmtDateTime(inv.paidAt);
   if (s === "overdue") return "Lewat " + FakturCalc.daysOverdue(inv.dueDate, fkToday()) + " hari";
   if (s === "partial" || s === "unpaid") return "Jatuh tempo " + fkFmtDate(inv.dueDate);
   if (s === "cancelled") return inv.cancelReason ? "Alasan: " + inv.cancelReason : "Dibatalkan";
   return "Belum diterbitkan";
}

// `full` is passed by this module when the view changes. The runtime calls renderFaktur() with no argument from
// every products/sales/production snapshot, and those calls must not rebuild a form the user is typing in.
window.renderFaktur = function (full) {
   var el = document.getElementById("pageFaktur");
   if (!el) return;
   if (!fkCanEdit()) {
      el.dataset.fkView = "denied";
      el.innerHTML =
         '<div class="card"><div class="empty-state"><i class="fas fa-lock"></i><h4>Akses ditolak</h4><p>Halaman Faktur hanya untuk Owner atau Admin</p></div></div>';
      return;
   }
   var view = fk.view === "editor" && fk.editor ? "editor" : fk.view === "settings" ? "settings" : "list";
   fk.view = view;
   if (!full && el.dataset.fkView === view) {
      if (view === "list") fkRefreshList();
      return;
   }
   if (view === "editor") return fkRenderEditor();
   if (view === "settings") return fkRenderSettings();
   fkRenderList();
};

function fkMatchesFilter(inv) {
   var s = fkStatusOf(inv);
   switch (fk.filter) {
      case "unpaid":
         return (s === "unpaid" || s === "overdue") && FakturCalc.toMoney(inv.paidAmount) === 0;
      case "partial":
         return (s === "partial" || s === "overdue") && FakturCalc.toMoney(inv.paidAmount) > 0;
      case "overdue":
         return s === "overdue";
      case "paid":
      case "draft":
      case "cancelled":
         return s === fk.filter;
      default:
         return true;
   }
}

function fkMatchesPeriod(inv) {
   var d = inv.issueDate || "";
   if (fk.year !== "all" && d.slice(0, 4) !== fk.year) return false;
   if (fk.month !== "all" && d.slice(5, 7) !== fk.month) return false;
   return true;
}

function fkSearchText(inv) {
   if (inv.searchText) return inv.searchText;
   var c = inv.customer || {};
   return [inv.number, c.name, c.city, (inv.items || []).map(function (i) { return i.name; }).join(" ")].join(" ").toLowerCase();
}

function fkFilteredList() {
   var q = fk.search.trim().toLowerCase();
   return fkAllInvoices()
      .filter(function (inv) { return !inv.hidden; })
      .filter(fkMatchesFilter)
      .filter(fkMatchesPeriod)
      .filter(function (inv) { return !q || fkSearchText(inv).indexOf(q) !== -1; })
      .sort(function (a, b) {
         return String(b.issueDate || "").localeCompare(String(a.issueDate || "")) ||
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
}

function fkStats() {
   var t = fkToday();
   var monthKey = t.slice(0, 7);
   var receivable = 0, overdueCount = 0, overdueSum = 0, openCount = 0;
   fk.open.forEach(function (inv) {
      if (inv.status !== "issued") return;
      var bal = FakturCalc.toMoney(inv.balanceDue);
      if (bal <= 0) return;
      receivable += bal;
      openCount++;
      if (FakturCalc.daysOverdue(inv.dueDate, t) > 0) {
         overdueCount++;
         overdueSum += bal;
      }
   });
   var billed = 0, billedCount = 0;
   fkAllInvoices().forEach(function (inv) {
      if (inv.status === "issued" && String(inv.issueDate || "").slice(0, 7) === monthKey) {
         billed += FakturCalc.toMoney(inv.total);
         billedCount++;
      }
   });
   return { receivable: receivable, openCount: openCount, overdueCount: overdueCount, overdueSum: overdueSum, billed: billed, billedCount: billedCount };
}

function fkYearOptions() {
   var now = new Date().getFullYear();
   var years = {};
   for (var y = now; y >= 2026; y--) years[y] = true;
   fkAllInvoices().forEach(function (inv) {
      var yy = parseInt(String(inv.issueDate || "").slice(0, 4), 10);
      if (yy) years[yy] = true;
   });
   return Object.keys(years).sort().reverse();
}

function fkTopHtml() {
   var st = fkStats();
   // With more than 50 invoices the newest-50 listener may not cover this month; say so instead of showing a low total.
   var monthKey = fkToday().slice(0, 7);
   var monthComplete = !fk.hasMore || fk.loadedPeriods[monthKey.slice(0, 4)] || fk.loadedPeriods[monthKey];
   var stats =
      '<div class="stat-grid fk-stats">' +
      '<div class="stat-card gold"><div class="sc-top"><div class="sc-icon"><i class="fas fa-hand-holding-dollar"></i></div><span class="sc-label">Total Piutang</span></div>' +
      '<div class="sc-value">' + fmtRp(st.receivable) + '</div><div class="sc-sub">' + st.openCount + " faktur belum lunas</div></div>" +
      '<div class="stat-card red"><div class="sc-top"><div class="sc-icon"><i class="fas fa-clock"></i></div><span class="sc-label">Lewat Jatuh Tempo</span></div>' +
      '<div class="sc-value">' + st.overdueCount + ' <small class="fk-stat-small">faktur</small></div><div class="sc-sub">' + fmtRp(st.overdueSum) + " belum dibayar</div></div>" +
      '<div class="stat-card green"><div class="sc-top"><div class="sc-icon"><i class="fas fa-file-invoice"></i></div><span class="sc-label">Ditagih Bulan Ini</span></div>' +
      '<div class="sc-value">' + fmtRp(st.billed) + '</div><div class="sc-sub">' + st.billedCount + " faktur terbit" +
      (monthComplete ? "" : ' · <button type="button" class="fk-link" onclick="fkLoadThisMonth()">hitung semua</button>') + "</div></div>" +
      "</div>";

   var setupBanner = !fk.settings
      ? '<div class="fk-banner"><i class="fas fa-circle-info"></i><div><strong>Pengaturan faktur belum diisi.</strong> Isi nama usaha, rekening, dan penomoran sebelum menerbitkan faktur pertama.</div>' +
        '<button class="btn btn-primary btn-sm" onclick="fkOpenSettings()">Atur sekarang</button></div>'
      : "";
   return stats + setupBanner;
}

window.fkLoadThisMonth = function () {
   var t = fkToday();
   fkLoadPeriod(t.slice(0, 4), t.slice(5, 7));
};

function fkRefreshList() {
   var top = document.getElementById("fkTop");
   if (!top || !document.getElementById("fkListBody")) return fkRenderList();
   top.innerHTML = fkTopHtml();
   fkRenderListBody();
}

function fkRenderList() {
   var el = document.getElementById("pageFaktur");
   if (fk.error && !fk.recentLoaded) {
      el.dataset.fkView = "list-error";
      el.innerHTML =
         '<div class="card"><div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h4>Faktur belum bisa dimuat</h4><p>' +
         fkEsc(fk.error) + '</p><button class="btn btn-outline btn-sm" style="margin-top:12px" onclick="fkRetry()">Coba lagi</button></div></div>';
      return;
   }
   if (!fk.recentLoaded || !fk.settingsLoaded) {
      el.dataset.fkView = "list-loading";
      el.innerHTML = '<div class="card"><div class="empty-state"><i class="fas fa-file-invoice"></i><h4>Memuat faktur...</h4></div></div>';
      return;
   }

   var chips = FK_FILTERS.map(function (f) {
      return '<button type="button" class="fk-chip' + (fk.filter === f.value ? " active" : "") + '" onclick="fkSetFilter(\'' + f.value + "')\">" + f.label + "</button>";
   }).join("");

   var monthOpts = '<option value="all">Semua bulan</option>' + FK_MONTHS.map(function (m, i) {
      var v = String(i + 1).padStart(2, "0");
      return '<option value="' + v + '"' + (fk.month === v ? " selected" : "") + ">" + m + "</option>";
   }).join("");
   var yearOpts = '<option value="all">Semua tahun</option>' + fkYearOptions().map(function (y) {
      return '<option value="' + y + '"' + (fk.year === y ? " selected" : "") + ">" + y + "</option>";
   }).join("");

   var toolbar =
      '<div class="table-toolbar fk-toolbar">' +
      '<div class="table-search"><i class="fas fa-search"></i><input type="search" id="fkSearch" class="form-input" placeholder="Cari nomor, pelanggan, kota, item..." value="' +
      fkEsc(fk.search) + '" oninput="fkOnSearch(this.value)" aria-label="Cari faktur"></div>' +
      '<div class="table-filter fk-period"><select onchange="fkSetPeriod(\'month\', this.value)" aria-label="Bulan">' + monthOpts + "</select>" +
      '<select onchange="fkSetPeriod(\'year\', this.value)" aria-label="Tahun">' + yearOpts + "</select></div>" +
      '<div class="fk-toolbar-actions">' +
      '<button class="btn btn-outline btn-sm" onclick="fkOpenSettings()"><i class="fas fa-gear"></i><span>Pengaturan</span></button>' +
      '<button class="btn btn-primary btn-sm fk-new-btn" onclick="fkNewInvoice()"><i class="fas fa-plus"></i>Faktur Baru</button>' +
      "</div></div>" +
      '<div class="fk-chips" role="tablist">' + chips + "</div>";

   el.dataset.fkView = "list";
   el.innerHTML =
      '<div id="fkTop">' + fkTopHtml() + "</div>" +
      '<div class="card fk-list-card">' + toolbar + '<div id="fkListBody"></div></div>' +
      '<button class="fk-fab" onclick="fkNewInvoice()" aria-label="Faktur baru"><i class="fas fa-plus"></i></button>';
   fkRenderListBody();
}

function fkRenderListBody() {
   var body = document.getElementById("fkListBody");
   if (!body) return;
   var list = fkFilteredList();
   var totalPages = Math.max(1, Math.ceil(list.length / FK_LIST_PER_PAGE));
   fk.page = Math.min(Math.max(fk.page, 1), totalPages);
   var start = (fk.page - 1) * FK_LIST_PER_PAGE;
   var items = list.slice(start, start + FK_LIST_PER_PAGE);

   if (!items.length) {
      var empty = fkAllInvoices().length === 0
         ? '<h4>Belum ada faktur</h4><p>Klik "Faktur Baru" untuk membuat faktur pertama.</p>'
         : "<h4>Tidak ada faktur yang cocok</h4><p>Coba ubah filter, periode, atau kata kunci.</p>";
      body.innerHTML = '<div class="empty-state"><i class="fas fa-file-invoice"></i>' + empty + "</div>" + fkLoadMoreHtml();
      return;
   }

   var rows = items.map(function (inv) {
      var s = fkStatusOf(inv);
      var c = inv.customer || {};
      return (
         '<tr class="fk-row' + (s === "cancelled" ? " fk-row-cancelled" : "") + '" onclick="fkOpenInvoice(\'' + inv.id + "')\">" +
         "<td><strong>" + (inv.number ? fkEsc(inv.number) : '<span class="fk-muted">DRAF</span>') + "</strong></td>" +
         "<td>" + fkFmtDate(inv.issueDate) + "</td>" +
         "<td>" + fkEsc(c.name || "-") + (c.type === "reseller" ? ' <span class="fk-tag">Reseller</span>' : "") +
         (c.city ? '<br><small class="fk-muted">' + fkEsc(c.city) + "</small>" : "") + "</td>" +
         '<td class="fk-num">' + fmtRp(inv.total) + "</td>" +
         '<td class="fk-num">' + (inv.status === "issued" ? fmtRp(Math.max(0, inv.balanceDue || 0)) : "-") + "</td>" +
         "<td>" + (inv.status === "issued" ? fkFmtDate(inv.dueDate) : "-") + "</td>" +
         "<td>" + fkStatusBadge(s) + '<br><small class="fk-muted">' + fkEsc(fkStatusNote(inv)) + "</small></td>" +
         '<td><button class="action-btn" title="Buka" aria-label="Buka faktur"><i class="fas fa-chevron-right"></i></button></td>' +
         "</tr>"
      );
   }).join("");

   var cards = items.map(function (inv) {
      var s = fkStatusOf(inv);
      var c = inv.customer || {};
      return (
         '<button type="button" class="fk-card" onclick="fkOpenInvoice(\'' + inv.id + "')\">" +
         '<div class="fk-card-row"><span class="fk-card-name">' + fkEsc(c.name || "-") +
         (c.type === "reseller" ? ' <span class="fk-tag">Reseller</span>' : "") + '</span><span class="fk-card-total">' + fmtRp(inv.total) + "</span></div>" +
         '<div class="fk-card-row fk-muted"><span>' + (inv.number ? fkEsc(inv.number) : "DRAF") + " · " + fkFmtDate(inv.issueDate) + "</span>" +
         (inv.status === "issued" && inv.balanceDue > 0 ? "<span>Sisa " + fmtRp(inv.balanceDue) + "</span>" : "") + "</div>" +
         '<div class="fk-card-row">' + fkStatusBadge(s) + '<span class="fk-muted fk-card-note">' + fkEsc(fkStatusNote(inv)) + "</span></div>" +
         "</button>"
      );
   }).join("");

   var pager = "";
   if (totalPages > 1) {
      pager = '<div class="table-footer"><span>' + (start + 1) + "–" + Math.min(start + FK_LIST_PER_PAGE, list.length) + " dari " + list.length + " faktur</span>" +
         '<div class="pagination"><button ' + (fk.page <= 1 ? "disabled" : "") + ' onclick="fkGoPage(' + (fk.page - 1) + ')" aria-label="Sebelumnya"><i class="fas fa-chevron-left"></i></button>' +
         '<button class="active">' + fk.page + "</button>" +
         "<button " + (fk.page >= totalPages ? "disabled" : "") + ' onclick="fkGoPage(' + (fk.page + 1) + ')" aria-label="Berikutnya"><i class="fas fa-chevron-right"></i></button></div></div>';
   }

   body.innerHTML =
      '<div class="table-scroll fk-table-wrap"><table class="data-table fk-table"><thead><tr><th>Nomor</th><th>Tanggal</th><th>Pelanggan</th><th class="fk-num">Total</th><th class="fk-num">Sisa</th><th>Jatuh tempo</th><th>Status</th><th></th></tr></thead><tbody>' +
      rows + "</tbody></table></div>" +
      '<div class="fk-cards">' + cards + "</div>" + pager + fkLoadMoreHtml();
}

function fkLoadMoreHtml() {
   if (!fk.hasMore) return "";
   return '<div class="fk-load-more"><button class="btn btn-outline btn-sm" ' + (fk.loadingMore ? "disabled" : "") + ' onclick="fkLoadMore()">' +
      (fk.loadingMore ? "Memuat..." : "Muat faktur lebih lama") + "</button></div>";
}

window.fkRetry = function () {
   fk.error = "";
   ensureListenersForPage("faktur");
   renderFaktur(true);
};

window.fkSetFilter = function (value) {
   fk.filter = value;
   fk.page = 1;
   fkRenderList();
};

window.fkOnSearch = function (value) {
   fk.search = value;
   fk.page = 1;
   fkRenderListBody();
};

window.fkGoPage = function (page) {
   fk.page = page;
   fkRenderListBody();
};

window.fkSetPeriod = function (kind, value) {
   fk[kind] = value;
   fk.page = 1;
   fkRenderList();
   if (fk.year !== "all") fkLoadPeriod(fk.year, fk.month);
};

// Invoices older than the 50 newest are read once per chosen period with .get(), not kept open as a listener.
function fkLoadPeriod(year, month) {
   var key = month === "all" ? year : year + "-" + month;
   if (fk.loadedPeriods[key] || fk.loadedPeriods[year]) return;
   fk.loadedPeriods[key] = true;
   var start = month === "all" ? year + "-01-01" : year + "-" + month + "-01";
   var end = month === "all"
      ? (+year + 1) + "-01-01"
      : month === "12" ? (+year + 1) + "-01-01" : year + "-" + String(+month + 1).padStart(2, "0") + "-01";
   db.collection("invoices").where("issueDate", ">=", start).where("issueDate", "<", end).get()
      .then(function (snap) {
         snap.docs.forEach(function (d) { fk.extra[d.id] = fkDocData(d); });
         fkRenderIfList();
      })
      .catch(function (err) {
         fk.loadedPeriods[key] = false;
         fkToast(fkErrorMessage(err, "Gagal memuat periode"), "error");
      });
}

window.fkLoadMore = function () {
   var cursor = fk.moreCursor || fk.recentLastDoc;
   if (!cursor || fk.loadingMore) return;
   fk.loadingMore = true;
   fkRenderListBody();
   db.collection("invoices").orderBy("createdAt", "desc").startAfter(cursor).limit(FK_PAGE_SIZE).get()
      .then(function (snap) {
         snap.docs.forEach(function (d) { fk.extra[d.id] = fkDocData(d); });
         fk.moreCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor;
         fk.hasMore = snap.size === FK_PAGE_SIZE;
      })
      .catch(function (err) { fkToast(fkErrorMessage(err, "Gagal memuat faktur lama"), "error"); })
      .then(function () {
         fk.loadingMore = false;
         fkRenderIfList();
      });
};

// The owner has not chosen between "Faktur" and "Invoice" yet (2026-11-05), so the heading is a setting.
function fkDocTitle(t) {
   return t === "INVOICE" ? "INVOICE" : "FAKTUR";
}

function fkBusinessFromSettings(s) {
   s = s || {};
   return {
      name: s.businessName || "",
      address: s.address || "",
      logoUrl: s.logoUrl || "",
      bankAccounts: Array.isArray(s.bankAccounts) ? s.bankAccounts.filter(function (b) { return b && (b.bank || b.number); }) : [],
      terms: s.terms || "",
      title: fkDocTitle(s.documentTitle),
   };
}

function fkNewDraft() {
   var s = fk.settings || {};
   var t = fkToday();
   var dueDays = Number.isInteger(s.defaultDueDays) && s.defaultDueDays >= 0 ? s.defaultDueDays : 7;
   return {
      customer: { type: "retail", resellerId: "", name: "", city: "", phone: "" },
      issueDate: t,
      dueDate: FakturCalc.addDays(t, dueDays),
      items: [],
      invoiceDiscount: { type: "none", value: 0 },
      tax: s.defaultTax && s.defaultTax.type ? { type: s.defaultTax.type, value: s.defaultTax.value || 0, label: s.defaultTax.label || "PPN" } : { type: "none", value: 0, label: "PPN" },
      shippingFee: 0,
      otherFee: { label: "", amount: 0 },
      paidAmount: 0,
      notes: "",
      bulkDiscount: { preset: "none", value: 0 },
   };
}

function fkDraftFromInvoice(inv) {
   return {
      customer: Object.assign({ type: "retail", resellerId: "", name: "", city: "", phone: "" }, inv.customer || {}),
      issueDate: inv.issueDate || fkToday(),
      dueDate: inv.dueDate || inv.issueDate || fkToday(),
      items: (inv.items || []).map(function (it) {
         return {
            lineId: it.lineId || fkLineId(),
            productId: it.productId || "",
            sku: it.sku || "",
            name: it.name || "",
            note: it.note || "",
            imageUrl: it.imageUrl || "",
            qty: it.qty || 1,
            catalogPrice: it.catalogPrice || 0,
            unitPrice: it.unitPrice || 0,
            discount: it.discount || { type: "none", value: 0 },
         };
      }),
      invoiceDiscount: inv.invoiceDiscount || { type: "none", value: 0 },
      tax: Object.assign({ type: "none", value: 0, label: "PPN" }, inv.tax || {}),
      shippingFee: inv.shippingFee || 0,
      otherFee: Object.assign({ label: "", amount: 0 }, inv.otherFee || {}),
      paidAmount: inv.paidAmount || 0,
      notes: inv.notes || "",
      bulkDiscount: fkNormalizeBulk(inv.bulkDiscount),
   };
}

function fkLineId() {
   return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fkLocalKey(id) {
   return FK_LOCAL_PREFIX + (id || "new");
}

function fkReadLocal(id) {
   try {
      var raw = localStorage.getItem(fkLocalKey(id));
      return raw ? JSON.parse(raw) : null;
   } catch (e) {
      return null;
   }
}

function fkWriteLocal() {
   var ed = fk.editor;
   if (!ed || !ed.dirty) return;
   try {
      localStorage.setItem(fkLocalKey(ed.id), JSON.stringify({ savedAt: fkNow(), baseUpdatedAt: ed.base ? ed.base.updatedAt || "" : "", draft: ed.draft }));
   } catch (e) {}
}

function fkClearLocal(id) {
   try {
      localStorage.removeItem(fkLocalKey(id));
   } catch (e) {}
}

var fkLocalTimer = null;
function fkMarkDirty() {
   if (!fk.editor) return;
   fk.editor.dirty = true;
   fk.share = null;
   clearTimeout(fkLocalTimer);
   fkLocalTimer = setTimeout(fkWriteLocal, 400);
}

function fkOpenEditor(inv) {
   var id = inv ? inv.id : null;
   var draft = inv ? fkDraftFromInvoice(inv) : fkNewDraft();
   var restored = false;
   var local = fkReadLocal(id);
   if (local && local.draft && (!inv || (local.baseUpdatedAt || "") === (inv.updatedAt || ""))) {
      draft = local.draft;
      restored = true;
   } else if (local) {
      fkClearLocal(id);
   }
   fk.editor = {
      id: id,
      base: inv || null,
      draft: draft,
      tab: inv && inv.status === "cancelled" ? "preview" : "edit",
      dirty: restored,
      restored: restored,
   };
   fk.share = null;
   fk.view = "editor";
   renderFaktur(true);
   window.scrollTo(0, 0);
}

window.fkNewInvoice = function () {
   fkOpenEditor(null);
};

window.fkOpenInvoice = function (id) {
   var inv = fkFindInvoice(id);
   if (!inv) return fkToast("Faktur tidak ditemukan", "error");
   fkOpenEditor(inv);
};

window.fkBackToList = function (force) {
   if (fk.busy) return fkToast("Tunggu, faktur sedang disimpan", "warning");
   if (!force && fk.editor && fk.editor.dirty) {
      fkOpenSheet(
         "Perubahan belum disimpan",
         '<p class="fk-sheet-text">Perubahan belum tersimpan ke database. Isian tetap disimpan di perangkat ini dan akan muncul lagi saat faktur ini dibuka.</p>',
         '<button class="btn btn-outline" onclick="fkDiscardChanges()">Buang perubahan</button><button class="btn btn-primary" onclick="fkCloseSheet();fkBackToList(true)">Keluar</button>',
      );
      return;
   }
   fkWriteLocal();
   fk.editor = null;
   fk.share = null;
   fk.view = "list";
   fkCloseSheet();
   renderFaktur(true);
};

window.fkDiscardChanges = function () {
   if (fk.editor) fkClearLocal(fk.editor.id);
   fk.editor = null;
   fk.view = "list";
   fkCloseSheet();
   renderFaktur(true);
};

function fkComputed() {
   var ed = fk.editor;
   return FakturCalc.computeInvoice(Object.assign({}, ed.draft, { status: ed.base ? ed.base.status : "draft" }));
}

function fkEditorStatus() {
   var ed = fk.editor;
   return ed.base ? ed.base.status : "draft";
}

function fkRenderEditor() {
   var el = document.getElementById("pageFaktur");
   var ed = fk.editor;
   var status = fkEditorStatus();
   var readOnly = status === "cancelled";
   if (readOnly) ed.tab = "preview";
   var title = ed.base && ed.base.number ? ed.base.number : ed.id ? "Draf faktur" : "Faktur baru";
   var statusBadge = ed.base ? fkStatusBadge(fkStatusOf(ed.base)) : fkStatusBadge("draft");

   var head =
      '<div class="fk-editor-head">' +
      '<button class="fk-back" onclick="fkBackToList()" aria-label="Kembali ke daftar"><i class="fas fa-arrow-left"></i></button>' +
      '<div class="fk-editor-title"><h2>' + fkEsc(title) + "</h2>" + statusBadge + "</div>" +
      '<div class="chart-tabs fk-tabs">' +
      '<button type="button" class="chart-tab' + (ed.tab === "edit" ? " active" : "") + '" ' + (readOnly ? "disabled" : "") + ' onclick="fkSetTab(\'edit\')">Sunting</button>' +
      '<button type="button" class="chart-tab' + (ed.tab === "preview" ? " active" : "") + '" onclick="fkSetTab(\'preview\')">Pratinjau</button>' +
      "</div></div>";

   var restoredNote = ed.restored
      ? '<div class="fk-banner fk-banner-soft"><i class="fas fa-rotate-left"></i><div>Isian yang belum disimpan dipulihkan dari perangkat ini.</div><button class="btn btn-outline btn-sm" onclick="fkDropRestored()">Buang</button></div>'
      : "";

   el.dataset.fkView = "editor";
   el.innerHTML =
      '<div class="fk-editor">' + head + restoredNote +
      '<div id="fkEditorBody"></div>' +
      '<div class="fk-bottom-bar" id="fkBottomBar"></div></div>';
   fkRenderEditorBody();
}

window.fkSetTab = function (tab) {
   if (!fk.editor) return;
   fk.editor.tab = tab;
   fkRenderEditor();
};

window.fkDropRestored = function () {
   var ed = fk.editor;
   fkClearLocal(ed.id);
   ed.draft = ed.base ? fkDraftFromInvoice(ed.base) : fkNewDraft();
   ed.dirty = false;
   ed.restored = false;
   fkRenderEditor();
};

function fkRenderEditorBody() {
   var ed = fk.editor;
   var body = document.getElementById("fkEditorBody");
   if (!body) return;
   if (ed.tab === "preview") {
      body.innerHTML = '<div class="fk-paper-wrap" id="fkPaperWrap">' + fkInvoiceDocHtml(fkPreviewInvoice()) + "</div>" + fkAuditHtml();
      fkFitPaper();
      fkRenderBottomBar();
      return;
   }
   var d = ed.draft;
   var c = d.customer;
   var resellers = (state.resellers || []).filter(function (r) { return r.status !== "inactive"; });
   var resellerOpts = '<option value="">Pilih reseller...</option>' + resellers.map(function (r) {
      return '<option value="' + fkEsc(r.id) + '"' + (c.resellerId === r.id ? " selected" : "") + ">" + fkEsc(r.name) + "</option>";
   }).join("");
   var suggestions = {};
   fkAllInvoices().forEach(function (inv) {
      var cc = inv.customer || {};
      if (cc.type !== "reseller" && cc.name) suggestions[cc.name] = true;
   });
   var datalist = '<datalist id="fkCustomerNames">' + Object.keys(suggestions).sort().map(function (n) { return '<option value="' + fkEsc(n) + '">'; }).join("") + "</datalist>";

   var customer =
      '<section class="card fk-section"><div class="fk-section-head"><h3>Tagih kepada</h3>' +
      '<label class="fk-switch"><input type="checkbox" ' + (c.type === "reseller" ? "checked" : "") + ' onchange="fkSetCustomerType(this.checked)"><span>Reseller</span></label></div>' +
      '<div class="fk-section-body">' +
      (c.type === "reseller"
         ? '<div class="form-group"><label for="fkReseller">Reseller</label><select id="fkReseller" class="form-input" onchange="fkSetReseller(this.value)">' + resellerOpts + "</select>" +
           (resellers.length ? "" : '<small class="fk-muted">Belum ada reseller aktif. Tambahkan di menu Reseller.</small>') + "</div>"
         : '<div class="form-group"><label for="fkCustName">Nama pelanggan</label><input id="fkCustName" class="form-input" list="fkCustomerNames" autocomplete="off" value="' +
           fkEsc(c.name) + '" oninput="fkSetCustomer(\'name\', this.value)" onchange="fkFillCustomerFromHistory(this.value)" placeholder="Nama pembeli">' + datalist + "</div>") +
      '<div class="form-row"><div class="form-group"><label for="fkCustCity">Kota</label><input id="fkCustCity" class="form-input" value="' + fkEsc(c.city) +
      '" oninput="fkSetCustomer(\'city\', this.value)" placeholder="Opsional"></div>' +
      '<div class="form-group"><label for="fkCustPhone">No. HP / WhatsApp</label><input id="fkCustPhone" class="form-input" type="tel" inputmode="tel" value="' + fkEsc(c.phone) +
      '" oninput="fkSetCustomer(\'phone\', this.value)" placeholder="Opsional, untuk kirim WhatsApp"></div></div>' +
      "</div></section>";

   var dates =
      '<section class="card fk-section"><div class="fk-section-head"><h3>Tanggal</h3></div><div class="fk-section-body"><div class="form-row">' +
      '<div class="form-group"><label for="fkIssueDate">Tanggal faktur</label><input id="fkIssueDate" type="date" class="form-input" value="' + fkEsc(d.issueDate) + '" onchange="fkSetIssueDate(this.value)"></div>' +
      '<div class="form-group"><label for="fkDueDate">Jatuh tempo</label><input id="fkDueDate" type="date" class="form-input" value="' + fkEsc(d.dueDate) + '" min="' + fkEsc(d.issueDate) + '" onchange="fkSetField(\'dueDate\', this.value)"></div>' +
      "</div></div></section>";

   var items =
      '<section class="card fk-section"><div class="fk-section-head"><h3>Item <span class="fk-muted" id="fkItemCount">(' + d.items.length + ")</span></h3>" +
      '<button class="btn btn-outline btn-sm" onclick="fkOpenManualItem()"><i class="fas fa-pen"></i>Item manual</button></div>' +
      '<div class="fk-section-body fk-bulk" id="fkBulk"></div>' +
      '<div id="fkItems"></div>' +
      '<div class="fk-section-body"><button class="btn btn-primary btn-full" onclick="fkOpenPicker()"><i class="fas fa-plus"></i>Tambah dari katalog</button></div></section>';

   var discountType = d.invoiceDiscount.type;
   var taxType = d.tax.type;
   var summary =
      '<section class="card fk-section"><div class="fk-section-head"><h3>Ringkasan</h3></div><div class="fk-section-body fk-summary">' +
      '<div class="fk-sum-row"><span>Subtotal</span><strong id="fkSubtotal"></strong></div>' +
      '<div class="fk-sum-edit"><label>Diskon faktur</label><div class="fk-inline">' + fkTypeSelect("fkDiscType", discountType, "fkSetInvoiceDiscount('type', this.value)") +
      '<input id="fkDiscValue" class="form-input" inputmode="decimal" value="' + fkValueText(d.invoiceDiscount) + '" oninput="fkSetInvoiceDiscount(\'value\', this.value)" ' + (discountType === "none" ? "disabled" : "") + ' aria-label="Nilai diskon"></div><span class="fk-sum-amount" id="fkDiscAmount"></span></div>' +
      '<div class="fk-sum-edit"><label>Pajak</label><div class="fk-inline">' + fkTypeSelect("fkTaxType", taxType, "fkSetTax('type', this.value)") +
      '<input id="fkTaxValue" class="form-input" inputmode="decimal" value="' + fkValueText(d.tax) + '" oninput="fkSetTax(\'value\', this.value)" ' + (taxType === "none" ? "disabled" : "") + ' aria-label="Nilai pajak">' +
      '<input id="fkTaxLabel" class="form-input fk-short" value="' + fkEsc(d.tax.label || "PPN") + '" oninput="fkSetTax(\'label\', this.value)" ' + (taxType === "none" ? "disabled" : "") + ' aria-label="Nama pajak"></div><span class="fk-sum-amount" id="fkTaxAmount"></span></div>' +
      '<div class="fk-sum-edit"><label for="fkShipping">Ongkos kirim</label><div class="fk-inline"><input id="fkShipping" class="form-input" inputmode="numeric" value="' + fkMoneyText(d.shippingFee) +
      '" oninput="formatRpInput(this);fkSetField(\'shippingFee\', this.value)" placeholder="0"></div><span class="fk-sum-amount"></span></div>' +
      '<div class="fk-sum-edit"><label>Biaya lain</label><div class="fk-inline"><input id="fkOtherLabel" class="form-input" value="' + fkEsc(d.otherFee.label) +
      '" oninput="fkSetOtherFee(\'label\', this.value)" placeholder="Nama biaya, mis. packing kayu"><input id="fkOtherAmount" class="form-input fk-short" inputmode="numeric" value="' + fkMoneyText(d.otherFee.amount) +
      '" oninput="formatRpInput(this);fkSetOtherFee(\'amount\', this.value)" placeholder="0" aria-label="Jumlah biaya lain"></div><span class="fk-sum-amount"></span></div>' +
      '<div class="fk-sum-row fk-sum-total"><span>Total</span><strong id="fkTotal"></strong></div>' +
      "</div></section>";

   var payment =
      '<section class="card fk-section"><div class="fk-section-head"><h3>Pembayaran</h3></div><div class="fk-section-body">' +
      '<div class="form-group"><label for="fkPaid">Sudah dibayar</label><div class="fk-inline"><input id="fkPaid" class="form-input" inputmode="numeric" value="' + fkMoneyText(d.paidAmount) +
      '" oninput="formatRpInput(this);fkSetField(\'paidAmount\', this.value)" placeholder="0">' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="fkFillPaid()">Lunas</button></div></div>' +
      '<div class="fk-sum-row fk-sum-total"><span>Saldo terutang</span><strong id="fkBalance"></strong></div>' +
      '<p class="fk-hint" id="fkPayHint"></p></div></section>';

   var notes =
      '<section class="card fk-section"><div class="fk-section-head"><h3>Catatan untuk pelanggan</h3></div><div class="fk-section-body">' +
      '<textarea id="fkNotes" class="form-input" rows="3" oninput="fkSetField(\'notes\', this.value)" placeholder="Opsional, tercetak di faktur">' + fkEsc(d.notes) + "</textarea></div></section>";

   body.innerHTML = '<div class="fk-form">' + customer + dates + items + summary + payment + notes + "</div>" + fkAuditHtml();
   fkRenderBulk();
   fkRenderItems();
   fkRefreshTotals();
   fkRenderBottomBar();
}

function fkTypeSelect(id, value, onchange) {
   var opts = [
      { v: "none", l: "Tidak ada" },
      { v: "percent", l: "Persen %" },
      { v: "amount", l: "Rupiah" },
   ];
   return '<select id="' + id + '" class="form-input fk-type" onchange="' + onchange + '" aria-label="Jenis">' +
      opts.map(function (o) { return '<option value="' + o.v + '"' + (value === o.v ? " selected" : "") + ">" + o.l + "</option>"; }).join("") + "</select>";
}

function fkValueText(d) {
   if (!d || d.type === "none") return "";
   if (d.type === "percent") return String(d.value || 0).replace(".", ",");
   return fkMoneyText(d.value);
}

function fkMoneyText(n) {
   var v = FakturCalc.toMoney(n);
   return v ? v.toLocaleString("id-ID") : "";
}

// Owner decision 2026-11-05: resellers get 15% or 20% on every catalog item; other customers get a typed percent.
var FK_BULK_PRESETS = [
   { value: "none", label: "Tanpa diskon" },
   { value: "15", label: "Reseller 15%" },
   { value: "20", label: "Reseller 20%" },
   { value: "custom", label: "Isi sendiri" },
];

function fkNormalizeBulk(b) {
   var preset = b && ["none", "15", "20", "custom"].indexOf(b.preset) !== -1 ? b.preset : "none";
   var value = preset === "15" ? 15 : preset === "20" ? 20 : preset === "custom" ? FakturCalc.toPercent(b.value) : 0;
   return { preset: preset, value: value };
}

function fkBulkPercent(d) {
   return fkNormalizeBulk(d.bulkDiscount).value;
}

function fkRenderBulk() {
   var el = document.getElementById("fkBulk");
   if (!el || !fk.editor) return;
   var b = fkNormalizeBulk(fk.editor.draft.bulkDiscount);
   var chips = FK_BULK_PRESETS.map(function (p) {
      return '<button type="button" class="fk-chip' + (b.preset === p.value ? " active" : "") + '" onclick="fkSetBulk(\'' + p.value + "')\">" + p.label + "</button>";
   }).join("");
   el.innerHTML =
      '<div class="fk-bulk-label">Diskon semua barang</div><div class="fk-bulk-chips">' + chips + "</div>" +
      (b.preset === "custom"
         ? '<div class="fk-inline fk-bulk-custom"><input id="fkBulkValue" class="form-input fk-short" inputmode="decimal" value="' + (b.value ? String(b.value).replace(".", ",") : "") +
           '" placeholder="0" oninput="fkSetBulkValue(this.value)" aria-label="Persen diskon"><span>% untuk setiap barang dari katalog</span></div>'
         : "") +
      '<p class="fk-hint">Berlaku untuk barang dari katalog, termasuk yang ditambah setelah ini. Diskon satu barang tetap bisa diubah lewat Ubah item.</p>';
}

function fkApplyBulk() {
   var d = fk.editor.draft;
   d.items = FakturCalc.applyBulkDiscount(d.items, fkBulkPercent(d));
   fkMarkDirty();
   fkRenderItems();
   fkRefreshTotals();
}

window.fkSetBulk = function (preset) {
   var d = fk.editor.draft;
   var cur = fkNormalizeBulk(d.bulkDiscount);
   d.bulkDiscount = { preset: preset, value: preset === "custom" ? cur.value : 0 };
   fkRenderBulk();
   fkApplyBulk();
   if (preset === "custom") {
      var input = document.getElementById("fkBulkValue");
      if (input) input.focus();
   }
};

// Typing only refreshes items and totals, so the percent box keeps focus.
window.fkSetBulkValue = function (value) {
   fk.editor.draft.bulkDiscount = { preset: "custom", value: FakturCalc.toPercent(value) };
   fkApplyBulk();
};

function fkRenderItems() {
   var wrap = document.getElementById("fkItems");
   if (!wrap) return;
   var calc = fkComputed();
   var countEl = document.getElementById("fkItemCount");
   if (countEl) countEl.textContent = "(" + calc.items.length + ")";
   if (!calc.items.length) {
      wrap.innerHTML = '<div class="fk-empty-items"><i class="fas fa-box-open"></i><span>Belum ada item. Tambah dari katalog produk.</span></div>';
      return;
   }
   wrap.innerHTML = calc.items.map(function (it, idx) {
      var disc = it.unitDiscount > 0
         ? '<span class="fk-disc">' + (it.discount.type === "percent" ? fkPercentText(it.discount.value) : "−" + fmtRp(it.unitDiscount)) + "</span> "
         : "";
      return (
         '<div class="fk-item">' +
         '<button type="button" class="fk-item-main" onclick="fkOpenItemSheet(' + idx + ')" aria-label="Ubah item ' + fkEsc(it.name) + '">' +
         fkThumb(it.imageUrl, 44) +
         '<span class="fk-item-text"><span class="fk-item-name">' + fkEsc(it.name || "(tanpa nama)") + "</span>" +
         (it.note ? '<span class="fk-item-note">' + fkEsc(it.note) + "</span>" : "") +
         '<span class="fk-item-price">' + disc + fmtRp(it.netUnitPrice) + " × " + it.qty + "</span></span>" +
         '<span class="fk-item-total">' + fmtRp(it.lineTotal) + "</span></button>" +
         '<div class="fk-stepper" role="group" aria-label="Jumlah">' +
         '<button type="button" onclick="fkStepQty(' + idx + ', -1)" aria-label="Kurangi"><i class="fas fa-minus"></i></button>' +
         "<span>" + it.qty + "</span>" +
         '<button type="button" onclick="fkStepQty(' + idx + ', 1)" aria-label="Tambah"><i class="fas fa-plus"></i></button></div>' +
         "</div>"
      );
   }).join("");
}

function fkPercentText(v) {
   return String(Math.round(v * 100) / 100).replace(".", ",") + "%";
}

function fkThumb(url, size) {
   if (url) {
      return '<img class="fk-thumb" src="' + fkEsc(url) + '" alt="" width="' + size + '" height="' + size + '" loading="lazy" onerror="this.replaceWith(fkThumbPlaceholder(' + size + '))">';
   }
   return '<span class="fk-thumb fk-thumb-empty" style="width:' + size + "px;height:" + size + 'px"><i class="fas fa-image"></i></span>';
}

window.fkThumbPlaceholder = function (size) {
   var span = document.createElement("span");
   span.className = "fk-thumb fk-thumb-empty";
   span.style.width = size + "px";
   span.style.height = size + "px";
   span.innerHTML = '<i class="fas fa-image"></i>';
   return span;
};

function fkRefreshTotals() {
   if (!fk.editor) return;
   var c = fkComputed();
   var set = function (id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
   };
   set("fkSubtotal", fmtRp(c.subtotal));
   set("fkDiscAmount", c.invoiceDiscountAmount ? "−" + fmtRp(c.invoiceDiscountAmount) : "");
   set("fkTaxAmount", c.taxAmount ? "+" + fmtRp(c.taxAmount) : "");
   set("fkTotal", fmtRp(c.total));
   set("fkBalance", fmtRp(Math.max(0, c.balanceDue)));
   var hint = document.getElementById("fkPayHint");
   if (hint) {
      hint.className = "fk-hint" + (c.overpaid ? " fk-hint-error" : "");
      hint.textContent = c.overpaid
         ? "Jumlah dibayar melebihi total. Kurangi sampai " + fmtRp(c.total) + "."
         : c.total > 0 && c.balanceDue <= 0 ? "Status: Lunas." : c.paidAmount > 0 ? "Status: Dibayar sebagian." : "Status: Belum dibayar.";
   }
}

window.fkSetCustomerType = function (isReseller) {
   var c = fk.editor.draft.customer;
   c.type = isReseller ? "reseller" : "retail";
   if (!isReseller) c.resellerId = "";
   else c.name = "";
   fkMarkDirty();
   fkRenderEditorBody();
};

window.fkSetReseller = function (id) {
   var c = fk.editor.draft.customer;
   var r = (state.resellers || []).find(function (x) { return x.id === id; });
   c.resellerId = id;
   c.name = r ? r.name : "";
   fkMarkDirty();
};

window.fkSetCustomer = function (field, value) {
   fk.editor.draft.customer[field] = value;
   fkMarkDirty();
};

// Retail customers are not a master list (Q3); the last invoice with the same name fills empty city and phone.
window.fkFillCustomerFromHistory = function (name) {
   var c = fk.editor.draft.customer;
   var key = String(name || "").trim().toLowerCase();
   if (!key) return;
   var match = fkAllInvoices()
      .filter(function (inv) { return inv.customer && String(inv.customer.name || "").toLowerCase() === key; })
      .sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); })[0];
   if (!match) return;
   if (!c.city && match.customer.city) {
      c.city = match.customer.city;
      var cityEl = document.getElementById("fkCustCity");
      if (cityEl) cityEl.value = c.city;
   }
   if (!c.phone && match.customer.phone) {
      c.phone = match.customer.phone;
      var phoneEl = document.getElementById("fkCustPhone");
      if (phoneEl) phoneEl.value = c.phone;
   }
   fkMarkDirty();
};

window.fkSetIssueDate = function (value) {
   var d = fk.editor.draft;
   if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
   var s = fk.settings || {};
   var dueDays = Number.isInteger(s.defaultDueDays) && s.defaultDueDays >= 0 ? s.defaultDueDays : 7;
   d.issueDate = value;
   if (!d.dueDate || d.dueDate < value) d.dueDate = FakturCalc.addDays(value, dueDays);
   var due = document.getElementById("fkDueDate");
   if (due) {
      due.min = value;
      due.value = d.dueDate;
   }
   fkMarkDirty();
};

window.fkSetField = function (field, value) {
   var d = fk.editor.draft;
   if (field === "shippingFee" || field === "paidAmount") d[field] = FakturCalc.toMoney(value);
   else d[field] = value;
   fkMarkDirty();
   fkRefreshTotals();
};

window.fkSetInvoiceDiscount = function (part, value) {
   fkSetAdjustment("invoiceDiscount", "fkDiscValue", null, part, value);
};

window.fkSetTax = function (part, value) {
   if (part === "label") {
      fk.editor.draft.tax.label = value;
      fkMarkDirty();
      return;
   }
   fkSetAdjustment("tax", "fkTaxValue", "fkTaxLabel", part, value);
};

function fkSetAdjustment(key, valueInputId, extraInputId, part, value) {
   var adj = fk.editor.draft[key];
   if (part === "type") {
      adj.type = value;
      adj.value = 0;
      var input = document.getElementById(valueInputId);
      if (input) {
         input.value = "";
         input.disabled = value === "none";
         input.placeholder = value === "percent" ? "0 %" : value === "amount" ? "Rp 0" : "";
         if (value !== "none") input.focus();
      }
      var extra = extraInputId && document.getElementById(extraInputId);
      if (extra) extra.disabled = value === "none";
   } else if (adj.type === "percent") {
      adj.value = FakturCalc.toPercent(value);
   } else if (adj.type === "amount") {
      var el = document.getElementById(valueInputId);
      if (el) formatRpInput(el);
      adj.value = FakturCalc.toMoney(value);
   }
   fkMarkDirty();
   fkRefreshTotals();
}

window.fkSetOtherFee = function (part, value) {
   var f = fk.editor.draft.otherFee;
   if (part === "amount") f.amount = FakturCalc.toMoney(value);
   else f.label = value;
   fkMarkDirty();
   fkRefreshTotals();
};

window.fkFillPaid = function () {
   var c = fkComputed();
   fk.editor.draft.paidAmount = c.total;
   var el = document.getElementById("fkPaid");
   if (el) el.value = fkMoneyText(c.total);
   fkMarkDirty();
   fkRefreshTotals();
};

window.fkStepQty = function (idx, delta) {
   var it = fk.editor.draft.items[idx];
   if (!it) return;
   var q = Math.max(1, FakturCalc.toInt(it.qty) + delta);
   if (q === it.qty) return;
   it.qty = q;
   fkMarkDirty();
   fkRenderItems();
   fkRefreshTotals();
};

function fkProductImage(p) {
   var url = p && p.images && p.images[0] && p.images[0].imageUrl;
   return FakturCalc.smallImageUrl(url || "");
}

window.fkOpenPicker = function () {
   fk.pickerQuery = "";
   fkOpenSheet(
      "Pilih produk",
      '<div class="table-search fk-picker-search"><i class="fas fa-search"></i><input type="search" id="fkPickerSearch" class="form-input" placeholder="Cari nama atau SKU..." oninput="fkPickerSearch(this.value)" aria-label="Cari produk"></div>' +
      '<div id="fkPickerList" class="fk-picker-list"></div>',
      '<span class="fk-muted" id="fkPickerCount"></span><button class="btn btn-primary" onclick="fkCloseSheet()">Selesai</button>',
      "fk-sheet-tall",
   );
   fkRenderPickerList();
   setTimeout(function () {
      var input = document.getElementById("fkPickerSearch");
      if (input && window.matchMedia("(min-width: 769px)").matches) input.focus();
   }, 50);
};

window.fkPickerSearch = function (q) {
   fk.pickerQuery = q;
   fkRenderPickerList();
};

function fkRenderPickerList() {
   var wrap = document.getElementById("fkPickerList");
   if (!wrap) return;
   var q = fk.pickerQuery.trim().toLowerCase();
   var counts = {};
   fk.editor.draft.items.forEach(function (it) {
      if (it.productId) counts[it.productId] = (counts[it.productId] || 0) + FakturCalc.toInt(it.qty);
   });
   var list = (state.products || [])
      .filter(function (p) { return p.status !== "inactive" && p.status !== "archived"; })
      .filter(function (p) { return !q || String(p.name || "").toLowerCase().indexOf(q) !== -1 || String(p.sku || "").toLowerCase().indexOf(q) !== -1; })
      .sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || ""), "id"); });
   var countEl = document.getElementById("fkPickerCount");
   if (countEl) countEl.textContent = fk.editor.draft.items.length + " item di faktur";
   if (!list.length) {
      wrap.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><h4>Produk tidak ditemukan</h4><p>Pakai "Item manual" untuk barang di luar katalog.</p></div>';
      return;
   }
   wrap.innerHTML = list.map(function (p) {
      var inCart = counts[p.id] || 0;
      return (
         '<button type="button" class="fk-pick" onclick="fkAddProduct(\'' + fkEsc(p.id) + "')\">" +
         fkThumb(fkProductImage(p), 44) +
         '<span class="fk-pick-text"><span class="fk-item-name">' + fkEsc(p.name) + '</span><span class="fk-muted">' + fkEsc(p.sku || "") + " · Stok " + (p.stock || 0) + "</span></span>" +
         '<span class="fk-pick-price">' + fmtRp(p.sellingPrice) + (inCart ? '<span class="fk-pick-count">' + inCart + " di faktur</span>" : "") + "</span>" +
         "</button>"
      );
   }).join("");
}

window.fkAddProduct = function (productId) {
   var d = fk.editor.draft;
   var p = (state.products || []).find(function (x) { return x.id === productId; });
   if (!p) return;
   var existing = d.items.find(function (it) { return it.productId === productId; });
   if (existing) {
      existing.qty = FakturCalc.toInt(existing.qty) + 1;
      fkToast(p.name + ": jumlah jadi " + existing.qty, "success");
   } else {
      if (d.items.length >= FK_MAX_ITEMS) return fkToast("Satu faktur maksimal " + FK_MAX_ITEMS + " item", "warning");
      d.items.push({
         lineId: fkLineId(),
         productId: p.id,
         sku: p.sku || "",
         name: p.name || "",
         note: "",
         imageUrl: fkProductImage(p),
         qty: 1,
         catalogPrice: FakturCalc.toMoney(p.sellingPrice),
         unitPrice: FakturCalc.toMoney(p.sellingPrice),
         discount: fkBulkPercent(d) > 0 ? { type: "percent", value: fkBulkPercent(d) } : { type: "none", value: 0 },
      });
   }
   fkMarkDirty();
   fkRenderPickerList();
   fkRenderItems();
   fkRefreshTotals();
};

window.fkOpenManualItem = function () {
   if (fk.editor.draft.items.length >= FK_MAX_ITEMS) return fkToast("Satu faktur maksimal " + FK_MAX_ITEMS + " item", "warning");
   fkOpenItemSheet(-1);
};

window.fkOpenItemSheet = function (idx) {
   var d = fk.editor.draft;
   var isNew = idx < 0;
   var it = isNew
      ? { name: "", note: "", qty: 1, unitPrice: 0, catalogPrice: 0, productId: "", discount: { type: "none", value: 0 } }
      : d.items[idx];
   if (!it) return;
   fk.sheetItemIdx = idx;
   var disc = it.discount || { type: "none", value: 0 };
   var catalog = it.productId && it.catalogPrice
      ? '<p class="fk-hint">Harga katalog ' + fmtRp(it.catalogPrice) +
        (FakturCalc.toMoney(it.unitPrice) !== it.catalogPrice ? ' · <button type="button" class="fk-link" onclick="fkUseCatalogPrice()">Pakai harga katalog</button>' : "") + "</p>"
      : "";
   var body =
      '<div class="form-group"><label for="fkItName">Nama item</label><input id="fkItName" class="form-input" value="' + fkEsc(it.name) + '" placeholder="Nama di faktur"></div>' +
      '<div class="form-group"><label for="fkItNote">Catatan kecil</label><input id="fkItNote" class="form-input" value="' + fkEsc(it.note) + '" placeholder="Opsional, mis. sepasang, 2pcs, warna hitam"></div>' +
      '<div class="form-row"><div class="form-group"><label for="fkItQty">Jumlah</label><input id="fkItQty" class="form-input" type="number" min="1" step="1" inputmode="numeric" value="' + (FakturCalc.toInt(it.qty) || 1) + '"></div>' +
      '<div class="form-group"><label for="fkItPrice">Harga satuan</label><input id="fkItPrice" class="form-input" inputmode="numeric" value="' + fkMoneyText(it.unitPrice) + '" oninput="formatRpInput(this)" placeholder="0">' + catalog + "</div></div>" +
      '<div class="form-group"><label>Diskon item (per unit)</label><div class="fk-inline">' +
      fkTypeSelect("fkItDiscType", disc.type, "fkItemDiscType(this.value)") +
      '<input id="fkItDiscValue" class="form-input" inputmode="decimal" value="' + fkValueText(disc) + '" ' + (disc.type === "none" ? "disabled" : "") + ' oninput="if(document.getElementById(\'fkItDiscType\').value===\'amount\')formatRpInput(this)" aria-label="Nilai diskon item"></div>' +
      '<p class="fk-hint">Untuk reseller: persen diskon tercetak di faktur bersama harga asli.</p></div>';
   var footer =
      (isNew ? "" :
         '<div class="fk-sheet-tools"><button class="btn btn-outline btn-sm" onclick="fkMoveItem(' + idx + ', -1)" ' + (idx === 0 ? "disabled" : "") + ' aria-label="Naikkan"><i class="fas fa-arrow-up"></i></button>' +
         '<button class="btn btn-outline btn-sm" onclick="fkMoveItem(' + idx + ', 1)" ' + (idx === d.items.length - 1 ? "disabled" : "") + ' aria-label="Turunkan"><i class="fas fa-arrow-down"></i></button>' +
         '<button class="btn btn-outline btn-sm fk-danger-text" onclick="fkRemoveItem(' + idx + ')"><i class="fas fa-trash"></i>Hapus</button></div>') +
      '<button class="btn btn-primary" onclick="fkSaveItem(' + idx + ')">' + (isNew ? "Tambah" : "Simpan") + "</button>";
   fkOpenSheet(isNew ? "Item manual" : "Ubah item", body, footer);
};

window.fkItemDiscType = function (type) {
   var input = document.getElementById("fkItDiscValue");
   if (!input) return;
   input.value = "";
   input.disabled = type === "none";
   input.placeholder = type === "percent" ? "0 %" : type === "amount" ? "Rp 0" : "";
   if (type !== "none") input.focus();
};

window.fkUseCatalogPrice = function () {
   var input = document.getElementById("fkItPrice");
   var sheetIdx = fk.sheetItemIdx;
   var it = fk.editor.draft.items[sheetIdx];
   if (input && it) input.value = fkMoneyText(it.catalogPrice);
};

window.fkSaveItem = function (idx) {
   var d = fk.editor.draft;
   var name = (document.getElementById("fkItName").value || "").trim();
   if (!name) return fkToast("Nama item wajib diisi", "warning");
   var qty = Math.max(1, FakturCalc.toInt(document.getElementById("fkItQty").value));
   var price = FakturCalc.toMoney(document.getElementById("fkItPrice").value);
   var type = document.getElementById("fkItDiscType").value;
   var raw = document.getElementById("fkItDiscValue").value;
   var discount = FakturCalc.normalizeDiscount({ type: type, value: type === "percent" ? FakturCalc.toPercent(raw) : FakturCalc.toMoney(raw) });
   if (discount.type === "amount" && discount.value > price) return fkToast("Diskon tidak boleh melebihi harga satuan", "warning");
   var fields = { name: name, note: (document.getElementById("fkItNote").value || "").trim(), qty: qty, unitPrice: price, discount: discount };
   if (idx < 0) {
      d.items.push(Object.assign({ lineId: fkLineId(), productId: "", sku: "", imageUrl: "", catalogPrice: 0 }, fields));
   } else {
      Object.assign(d.items[idx], fields);
   }
   fkMarkDirty();
   fkCloseSheet();
   fkRenderItems();
   fkRefreshTotals();
};

window.fkMoveItem = function (idx, dir) {
   var items = fk.editor.draft.items;
   var to = idx + dir;
   if (to < 0 || to >= items.length) return;
   var moved = items.splice(idx, 1)[0];
   items.splice(to, 0, moved);
   fkMarkDirty();
   fkCloseSheet();
   fkRenderItems();
};

window.fkRemoveItem = function (idx) {
   fk.editor.draft.items.splice(idx, 1);
   fkMarkDirty();
   fkCloseSheet();
   fkRenderItems();
   fkRefreshTotals();
};

function fkAuditHtml() {
   var b = fk.editor && fk.editor.base;
   if (!b) return "";
   var parts = [];
   var who = function (a) { return a && a.name ? a.name : "-"; };
   if (b.createdAt) parts.push("Dibuat oleh " + who(b.createdBy) + ", " + fkFmtDateTime(b.createdAt));
   if (b.issuedAt) parts.push("Diterbitkan oleh " + who(b.issuedBy) + ", " + fkFmtDateTime(b.issuedAt));
   if (b.updatedAt && b.updatedAt !== b.createdAt) parts.push("Terakhir diubah oleh " + who(b.updatedBy) + ", " + fkFmtDateTime(b.updatedAt));
   if (b.paidAt) parts.push("Lunas dicatat oleh " + who(b.paidBy) + ", " + fkFmtDateTime(b.paidAt));
   if (b.cancelledAt) parts.push("Dibatalkan oleh " + who(b.cancelledBy) + ", " + fkFmtDateTime(b.cancelledAt) + (b.cancelReason ? " (" + b.cancelReason + ")" : ""));
   if (b.lastSharedAt) parts.push("Terakhir dibagikan " + fkFmtDateTime(b.lastSharedAt));
   return '<div class="fk-audit">' + parts.map(fkEsc).join("<br>") + "</div>";
}

function fkRenderBottomBar() {
   var bar = document.getElementById("fkBottomBar");
   if (!bar || !fk.editor) return;
   var ed = fk.editor;
   var status = fkEditorStatus();
   var busy = fk.busy ? " disabled" : "";
   var html = "";
   if (ed.tab === "preview") {
      if (status === "issued") {
         var c = fkComputed();
         html =
            (fk.share && fk.share.invoiceId === ed.id
               ? '<button class="btn btn-primary" onclick="fkShareImage()"' + busy + '><i class="fas fa-share-nodes"></i>Bagikan gambar</button>'
               : '<button class="btn btn-primary" onclick="fkPrepareImage()"' + busy + '><i class="fas fa-image"></i>' + (fk.busy ? "Menyiapkan..." : "Siapkan gambar") + "</button>") +
            '<button class="btn btn-outline" onclick="fkPrint()"' + busy + '><i class="fas fa-file-pdf"></i>PDF</button>' +
            '<button class="btn btn-outline" onclick="fkSendWhatsApp()"' + busy + '><i class="fab fa-whatsapp"></i>WhatsApp</button>' +
            (c.balanceDue > 0 && !ed.dirty ? '<button class="btn btn-outline" onclick="fkMarkPaid()"' + busy + '><i class="fas fa-check"></i>Tandai lunas</button>' : "");
         if (ed.dirty) html = '<span class="fk-muted fk-bar-note">Simpan perubahan dulu sebelum membagikan.</span><button class="btn btn-primary" onclick="fkSaveIssued()"' + busy + ">Simpan</button>";
      } else if (status === "cancelled") {
         html =
            '<button class="btn btn-outline fk-icon-btn" onclick="fkConfirmHideCancelled()"' + busy + ' aria-label="Hapus dari daftar" title="Hapus dari daftar"><i class="fas fa-trash"></i></button>' +
            '<button class="btn btn-outline" onclick="fkPrint()"><i class="fas fa-file-pdf"></i>PDF</button>';
      } else {
         html = '<span class="fk-muted fk-bar-note">Terbitkan dulu untuk mendapat nomor dan membagikan.</span>' +
            '<button class="btn btn-primary" onclick="fkIssue()"' + busy + '><i class="fas fa-paper-plane"></i>' + (fk.busy ? "Menerbitkan..." : "Terbitkan") + "</button>";
      }
   } else if (status === "issued") {
      html =
         '<button class="btn btn-outline" onclick="fkOpenCancel()"' + busy + '><i class="fas fa-ban"></i>Batalkan</button>' +
         '<button class="btn btn-primary" onclick="fkSaveIssued()"' + busy + '><i class="fas fa-floppy-disk"></i>' + (fk.busy ? "Menyimpan..." : "Simpan") + "</button>";
   } else {
      html =
         (ed.id ? '<button class="btn btn-outline fk-icon-btn" onclick="fkConfirmDeleteDraft()"' + busy + ' aria-label="Hapus draf" title="Hapus draf"><i class="fas fa-trash"></i></button>' : "") +
         '<button class="btn btn-outline" onclick="fkSaveDraft()"' + busy + ">Simpan draf</button>" +
         '<button class="btn btn-primary" onclick="fkIssue()"' + busy + '><i class="fas fa-paper-plane"></i>' + (fk.busy ? "Menerbitkan..." : "Terbitkan") + "</button>";
   }
   bar.innerHTML = html;
}

function fkSetBusy(on) {
   fk.busy = on;
   fkRenderBottomBar();
}

function fkValidate(forIssue) {
   var d = fk.editor.draft;
   var c = fkComputed();
   if (!String(d.customer.name || "").trim()) return d.customer.type === "reseller" ? "Pilih reseller dulu" : "Nama pelanggan wajib diisi";
   if (!d.items.length) return "Tambahkan minimal 1 item";
   if (d.items.length > FK_MAX_ITEMS) return "Satu faktur maksimal " + FK_MAX_ITEMS + " item";
   if (d.items.some(function (it) { return !String(it.name || "").trim(); })) return "Ada item tanpa nama";
   if (!/^\d{4}-\d{2}-\d{2}$/.test(d.issueDate)) return "Tanggal faktur belum diisi";
   if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) return "Jatuh tempo belum diisi";
   if (d.dueDate < d.issueDate) return "Jatuh tempo tidak boleh sebelum tanggal faktur";
   if (c.overpaid) return "Jumlah dibayar melebihi total faktur";
   if (forIssue && !fk.settings) return "Isi Pengaturan Faktur dulu sebelum menerbitkan";
   return "";
}

// The fields every write stores; totals come from FakturCalc so the list and reports never recompute them.
function fkBuildDoc(status) {
   var d = fk.editor.draft;
   var c = FakturCalc.computeInvoice(Object.assign({}, d, { status: status }));
   var cust = d.customer;
   var items = c.items.map(function (it) {
      return {
         lineId: it.lineId || fkLineId(),
         productId: it.productId || "",
         sku: it.sku || "",
         name: String(it.name || "").trim(),
         note: String(it.note || "").trim(),
         imageUrl: it.imageUrl || "",
         qty: it.qty,
         catalogPrice: FakturCalc.toMoney(it.catalogPrice),
         unitPrice: it.unitPrice,
         discount: it.discount,
         unitDiscount: it.unitDiscount,
         netUnitPrice: it.netUnitPrice,
         lineTotal: it.lineTotal,
      };
   });
   var name = String(cust.name || "").trim();
   return {
      status: status,
      paymentStatus: c.paymentStatus,
      isOpen: c.isOpen,
      issueDate: d.issueDate,
      dueDate: d.dueDate,
      customer: {
         type: cust.type === "reseller" ? "reseller" : "retail",
         resellerId: cust.type === "reseller" ? cust.resellerId || "" : "",
         name: name,
         nameLower: name.toLowerCase(),
         city: String(cust.city || "").trim(),
         phone: String(cust.phone || "").trim(),
      },
      items: items,
      invoiceDiscount: c.invoiceDiscount,
      tax: { type: c.tax.type, value: c.tax.value, label: String(d.tax.label || "PPN").trim() || "PPN" },
      shippingFee: c.shippingFee,
      otherFee: { label: String(d.otherFee.label || "").trim(), amount: c.otherFeeAmount },
      subtotal: c.subtotal,
      invoiceDiscountAmount: c.invoiceDiscountAmount,
      taxAmount: c.taxAmount,
      total: c.total,
      paidAmount: c.paidAmount,
      balanceDue: c.balanceDue,
      notes: String(d.notes || "").trim(),
      bulkDiscount: fkNormalizeBulk(d.bulkDiscount),
      searchText: [name, cust.city, items.map(function (i) { return i.name; }).join(" ")].join(" ").toLowerCase(),
      schemaVersion: 1,
   };
}

function fkPaidFields(doc, base) {
   var wasPaid = base && base.paymentStatus === "paid" && base.paidAt;
   if (doc.paymentStatus === "paid" && doc.total > 0) {
      return wasPaid ? { paidAt: base.paidAt, paidBy: base.paidBy || null } : { paidAt: fkNow(), paidBy: fkActor() };
   }
   return { paidAt: null, paidBy: null };
}

// Edits typed while a write was in flight are not part of it, so they stay marked unsaved and kept on the device.
function fkAfterSave(ed, snapshot, wasNew, message) {
   fkSyncCopy(ed);
   if (wasNew) fkClearLocal(null);
   var changed = JSON.stringify(ed.draft) !== snapshot;
   ed.dirty = changed;
   ed.restored = false;
   if (changed) fkWriteLocal();
   else fkClearLocal(ed.id);
   if (message) fkToast(message, "success");
}

// Optimistic check against the version the editor opened, so two admins never overwrite each other silently.
function fkCheckVersion(snap, base) {
   if (!snap.exists) throw new Error("Faktur sudah dihapus oleh pengguna lain.");
   var data = snap.data();
   if ((data.updatedAt || "") !== (base.updatedAt || "")) {
      throw new Error("Faktur ini baru saja diubah oleh pengguna lain. Kembali ke daftar lalu buka lagi.");
   }
   return data;
}

window.fkSaveDraft = async function () {
   if (fk.busy) return;
   var ed = fk.editor;
   var d = ed.draft;
   if (!String(d.customer.name || "").trim() && !d.items.length) return fkToast("Isi pelanggan atau item dulu", "warning");
   if (d.dueDate && d.issueDate && d.dueDate < d.issueDate) return fkToast("Jatuh tempo tidak boleh sebelum tanggal faktur", "warning");
   if (fkComputed().overpaid) return fkToast("Jumlah dibayar melebihi total faktur", "warning");
   var doc = fkBuildDoc("draft");
   var now = fkNow();
   var actor = fkActor();
   doc.updatedAt = now;
   doc.updatedBy = actor;
   Object.assign(doc, fkPaidFields(doc, ed.base));
   var snapshot = JSON.stringify(d);
   var wasNew = !ed.id;
   fkSetBusy(true);
   try {
      if (ed.id) {
         var ref = db.collection("invoices").doc(ed.id);
         await db.runTransaction(async function (tx) {
            var current = fkCheckVersion(await tx.get(ref), ed.base);
            if (current.status !== "draft") throw new Error("Faktur ini sudah diterbitkan.");
            tx.update(ref, doc);
         });
         ed.base = Object.assign({}, ed.base, doc);
      } else {
         Object.assign(doc, { number: null, numberPrefix: null, numberSeq: null, createdAt: now, createdBy: actor });
         var newRef = await db.collection("invoices").add(doc);
         ed.id = newRef.id;
         ed.base = Object.assign({ id: newRef.id }, doc);
      }
      fkAfterSave(ed, snapshot, wasNew, "Draf tersimpan");
      fk.busy = false;
      if (fk.editor === ed) fkRenderEditor();
   } catch (err) {
      fkToast(fkErrorMessage(err, "Gagal menyimpan draf"), "error");
   } finally {
      fkSetBusy(false);
   }
};

window.fkIssue = async function () {
   if (fk.busy) return;
   var problem = fkValidate(true);
   if (problem) {
      fkToast(problem, "warning");
      if (problem.indexOf("Pengaturan") !== -1) fkOpenSettings();
      return;
   }
   if (!navigator.onLine) return fkToast("Butuh koneksi internet untuk menerbitkan. Isian tetap tersimpan di perangkat ini.", "error");
   var ed = fk.editor;
   var doc = fkBuildDoc("issued");
   var now = fkNow();
   var actor = fkActor();
   Object.assign(doc, fkPaidFields(doc, ed.base), { updatedAt: now, updatedBy: actor, issuedAt: now, issuedBy: actor });
   var invRef = ed.id ? db.collection("invoices").doc(ed.id) : db.collection("invoices").doc();
   var settingsRef = db.collection("invoice_settings").doc("default");
   var snapshot = JSON.stringify(ed.draft);
   var wasNew = !ed.id;
   fkSetBusy(true);
   try {
      var number = await db.runTransaction(async function (tx) {
         var settingsSnap = await tx.get(settingsRef);
         if (!settingsSnap.exists) throw new Error("Pengaturan faktur belum diisi.");
         var s = settingsSnap.data();
         var prefix = s.numberPrefix || "INV";
         // One counter per prefix, so UJI test invoices never consume INV numbers (design §3.4).
         var counterRef = db.collection("counters").doc("invoice_" + prefix);
         var counterSnap = await tx.get(counterRef);
         if (!counterSnap.exists) throw new Error("Penomoran " + prefix + " belum dimulai. Buka Pengaturan Faktur lalu klik Mulai penomoran.");
         if (ed.id) {
            var current = fkCheckVersion(await tx.get(invRef), ed.base);
            if (current.status !== "draft") throw new Error("Faktur ini sudah diterbitkan.");
         }
         var seq = counterSnap.data().next;
         if (!Number.isInteger(seq) || seq < 1) throw new Error("Nomor berikutnya di counter tidak valid.");
         var num = FakturCalc.formatInvoiceNumber(prefix, seq, s.numberPad || 4);
         var full = Object.assign({}, doc, {
            number: num,
            numberPrefix: prefix,
            numberSeq: seq,
            business: fkBusinessFromSettings(s),
            searchText: (num + " " + doc.searchText).toLowerCase(),
         });
         if (ed.id) {
            tx.update(invRef, full);
         } else {
            full.createdAt = now;
            full.createdBy = actor;
            tx.set(invRef, full);
         }
         tx.update(counterRef, { next: seq + 1, lastInvoiceId: invRef.id, updatedAt: now });
         return { num: num, full: full };
      });
      ed.id = invRef.id;
      ed.base = Object.assign({ id: invRef.id }, ed.base || {}, number.full);
      fkAfterSave(ed, snapshot, wasNew, "Faktur " + number.num + " diterbitkan");
      if (!ed.dirty) ed.tab = "preview";
      fk.busy = false;
      if (fk.editor === ed) fkRenderEditor();
   } catch (err) {
      fk.busy = false;
      fkToast(fkErrorMessage(err, "Gagal menerbitkan"), "error");
      fkRenderBottomBar();
   }
};

window.fkSaveIssued = async function () {
   if (fk.busy) return;
   var problem = fkValidate(false);
   if (problem) return fkToast(problem, "warning");
   var ed = fk.editor;
   var doc = fkBuildDoc("issued");
   doc.searchText = ((ed.base.number || "") + " " + doc.searchText).toLowerCase();
   Object.assign(doc, fkPaidFields(doc, ed.base), { updatedAt: fkNow(), updatedBy: fkActor() });
   var ref = db.collection("invoices").doc(ed.id);
   var snapshot = JSON.stringify(ed.draft);
   fkSetBusy(true);
   try {
      await db.runTransaction(async function (tx) {
         var current = fkCheckVersion(await tx.get(ref), ed.base);
         if (current.status !== "issued") throw new Error("Status faktur sudah berubah.");
         tx.update(ref, doc);
      });
      ed.base = Object.assign({}, ed.base, doc);
      fkAfterSave(ed, snapshot, false, "Faktur " + ed.base.number + " disimpan");
      fk.busy = false;
      if (fk.editor === ed) fkRenderEditor();
   } catch (err) {
      fk.busy = false;
      fkToast(fkErrorMessage(err, "Gagal menyimpan"), "error");
      fkRenderBottomBar();
   }
};

window.fkMarkPaid = async function () {
   var ed = fk.editor;
   if (!ed || !ed.id || fk.busy) return;
   var ref = db.collection("invoices").doc(ed.id);
   fkSetBusy(true);
   try {
      var patch = await db.runTransaction(async function (tx) {
         var current = fkCheckVersion(await tx.get(ref), ed.base);
         if (current.status !== "issued") throw new Error("Hanya faktur terbit yang bisa ditandai lunas.");
         var total = FakturCalc.toMoney(current.total);
         var p = {
            paidAmount: total,
            balanceDue: 0,
            paymentStatus: "paid",
            isOpen: false,
            paidAt: fkNow(),
            paidBy: fkActor(),
            updatedAt: fkNow(),
            updatedBy: fkActor(),
         };
         tx.update(ref, p);
         return p;
      });
      ed.base = Object.assign({}, ed.base, patch);
      ed.draft.paidAmount = patch.paidAmount;
      fkSyncCopy(ed);
      fk.share = null;
      fk.busy = false;
      fkToast("Faktur " + ed.base.number + " ditandai lunas", "success");
      fkRenderEditor();
   } catch (err) {
      fk.busy = false;
      fkToast(fkErrorMessage(err, "Gagal menandai lunas"), "error");
      fkRenderBottomBar();
   }
};

window.fkOpenCancel = function () {
   var ed = fk.editor;
   fkOpenSheet(
      "Batalkan " + (ed.base && ed.base.number ? ed.base.number : "faktur"),
      '<p class="fk-sheet-text">Faktur yang dibatalkan tidak bisa dipakai lagi, tetapi tetap tersimpan dan nomornya tidak dipakai ulang.</p>' +
      '<div class="form-group"><label for="fkCancelReason">Alasan pembatalan</label><input id="fkCancelReason" class="form-input" placeholder="Mis. pesanan batal, salah input"></div>',
      '<button class="btn btn-outline" onclick="fkCloseSheet()">Kembali</button><button class="btn btn-danger" onclick="fkCancelInvoice()">Batalkan faktur</button>',
   );
};

window.fkCancelInvoice = async function () {
   var ed = fk.editor;
   var reason = (document.getElementById("fkCancelReason").value || "").trim();
   if (!reason) return fkToast("Isi alasan pembatalan", "warning");
   var ref = db.collection("invoices").doc(ed.id);
   fkCloseSheet();
   fkSetBusy(true);
   try {
      var patch = {
         status: "cancelled",
         isOpen: false,
         cancelledAt: fkNow(),
         cancelledBy: fkActor(),
         cancelReason: reason,
         updatedAt: fkNow(),
         updatedBy: fkActor(),
      };
      await db.runTransaction(async function (tx) {
         var current = fkCheckVersion(await tx.get(ref), ed.base);
         if (current.status !== "issued") throw new Error("Hanya faktur terbit yang bisa dibatalkan.");
         tx.update(ref, patch);
      });
      fkClearLocal(ed.id);
      ed.base = Object.assign({}, ed.base, patch);
      ed.draft = fkDraftFromInvoice(ed.base);
      fkSyncCopy(ed);
      ed.dirty = false;
      ed.tab = "preview";
      fk.busy = false;
      fkToast("Faktur " + ed.base.number + " dibatalkan", "success");
      fkRenderEditor();
   } catch (err) {
      fk.busy = false;
      fkToast(fkErrorMessage(err, "Gagal membatalkan"), "error");
      fkRenderBottomBar();
   }
};

// Issued numbers are never reused, so a cancelled invoice is hidden rather than deleted: the document keeps the
// number consumed for the audit trail and the counter is never touched.
window.fkConfirmHideCancelled = function () {
   var ed = fk.editor;
   fkOpenSheet(
      "Hapus " + (ed.base && ed.base.number ? ed.base.number : "faktur") + " dari daftar?",
      '<p class="fk-sheet-text">Faktur batal ini tidak akan muncul lagi di daftar. Nomornya tetap hangus dan tidak dipakai ulang untuk faktur baru.</p>',
      '<button class="btn btn-outline" onclick="fkCloseSheet()">Kembali</button><button class="btn btn-danger" onclick="fkHideCancelled()">Hapus dari daftar</button>',
   );
};

window.fkHideCancelled = async function () {
   var ed = fk.editor;
   var ref = db.collection("invoices").doc(ed.id);
   fkCloseSheet();
   fkSetBusy(true);
   try {
      var patch = { hidden: true, hiddenAt: fkNow(), hiddenBy: fkActor(), updatedAt: fkNow(), updatedBy: fkActor() };
      await db.runTransaction(async function (tx) {
         var current = fkCheckVersion(await tx.get(ref), ed.base);
         if (current.status !== "cancelled") throw new Error("Hanya faktur batal yang bisa dihapus dari daftar.");
         tx.update(ref, patch);
      });
      fkClearLocal(ed.id);
      if (fk.extra[ed.id]) fk.extra[ed.id] = Object.assign({}, fk.extra[ed.id], patch);
      var number = ed.base && ed.base.number;
      fk.busy = false;
      fk.editor = null;
      fk.view = "list";
      fkToast("Faktur " + (number || "") + " dihapus dari daftar", "success");
      renderFaktur(true);
   } catch (err) {
      fk.busy = false;
      fkToast(fkErrorMessage(err, "Gagal menghapus dari daftar"), "error");
      fkRenderBottomBar();
   }
};

window.fkConfirmDeleteDraft = function () {
   fkOpenSheet(
      "Hapus draf?",
      '<p class="fk-sheet-text">Draf ini belum punya nomor, jadi bisa dihapus permanen.</p>',
      '<button class="btn btn-outline" onclick="fkCloseSheet()">Kembali</button><button class="btn btn-danger" onclick="fkDeleteDraft()">Hapus draf</button>',
   );
};

window.fkDeleteDraft = async function () {
   var ed = fk.editor;
   var ref = db.collection("invoices").doc(ed.id);
   fkCloseSheet();
   fkSetBusy(true);
   try {
      await db.runTransaction(async function (tx) {
         var current = fkCheckVersion(await tx.get(ref), ed.base);
         if (current.status !== "draft") throw new Error("Hanya draf yang bisa dihapus.");
         tx.delete(ref);
      });
      fkClearLocal(ed.id);
      delete fk.extra[ed.id];
      fk.busy = false;
      fk.editor = null;
      fk.view = "list";
      fkToast("Draf dihapus", "success");
      renderFaktur(true);
   } catch (err) {
      fk.busy = false;
      fkToast(fkErrorMessage(err, "Gagal menghapus draf"), "error");
      fkRenderBottomBar();
   }
};

function fkPreviewInvoice() {
   var ed = fk.editor;
   var status = fkEditorStatus();
   var doc = fkBuildDoc(status);
   var base = ed.base || {};
   return Object.assign({}, doc, {
      number: base.number || null,
      business: base.business || fkBusinessFromSettings(fk.settings),
      cancelReason: base.cancelReason || "",
   });
}

function fkMoneyDoc(n) {
   return fmtRp(n).replace(/\s/g, " ");
}

// One renderer for preview, print and the shared image (design §6.1); fixed 720px so all three look the same.
function fkInvoiceDocHtml(inv) {
   var b = inv.business || {};
   var c = inv.customer || {};
   var anyDiscount = (inv.items || []).some(function (it) { return it.unitDiscount > 0; });
   var stamp = inv.status === "cancelled" ? "BATAL" : inv.status === "draft" ? "DRAF" : inv.paymentStatus === "paid" && inv.total > 0 ? "LUNAS" : "";
   var rows = (inv.items || []).map(function (it, i) {
      var discText = it.unitDiscount > 0
         ? (it.discount.type === "percent" ? fkPercentText(it.discount.value) : "−" + fkMoneyDoc(it.unitDiscount))
         : "";
      return (
         "<tr>" +
         '<td class="inv-doc-c">' + (i + 1) + "</td>" +
         '<td class="inv-doc-img">' + (it.imageUrl ? '<img src="' + fkEsc(it.imageUrl) + '" alt="" crossorigin="anonymous" width="56" height="56">' : '<span class="inv-doc-noimg"></span>') + "</td>" +
         '<td><div class="inv-doc-item">' + fkEsc(it.name) + "</div>" + (it.note ? '<div class="inv-doc-note">' + fkEsc(it.note) + "</div>" : "") + "</td>" +
         '<td class="inv-doc-r">' + it.qty + "</td>" +
         '<td class="inv-doc-r">' + fkMoneyDoc(it.unitPrice) + (it.unitDiscount > 0 ? '<div class="inv-doc-note">jadi ' + fkMoneyDoc(it.netUnitPrice) + "</div>" : "") + "</td>" +
         (anyDiscount ? '<td class="inv-doc-r">' + (discText || "-") + "</td>" : "") +
         '<td class="inv-doc-r inv-doc-strong">' + fkMoneyDoc(it.lineTotal) + "</td>" +
         "</tr>"
      );
   }).join("");

   var sum = [["Subtotal", fkMoneyDoc(inv.subtotal)]];
   if (inv.invoiceDiscountAmount) {
      sum.push(["Diskon" + (inv.invoiceDiscount.type === "percent" ? " " + fkPercentText(inv.invoiceDiscount.value) : ""), "−" + fkMoneyDoc(inv.invoiceDiscountAmount)]);
   }
   if (inv.taxAmount) sum.push([fkEsc(inv.tax.label || "Pajak") + (inv.tax.type === "percent" ? " " + fkPercentText(inv.tax.value) : ""), fkMoneyDoc(inv.taxAmount)]);
   if (inv.shippingFee) sum.push(["Ongkos kirim", fkMoneyDoc(inv.shippingFee)]);
   if (inv.otherFee && inv.otherFee.amount) sum.push([fkEsc(inv.otherFee.label || "Biaya lain"), fkMoneyDoc(inv.otherFee.amount)]);
   var sumHtml = sum.map(function (r) { return '<div class="inv-doc-sum-row"><span>' + r[0] + "</span><span>" + r[1] + "</span></div>"; }).join("") +
      '<div class="inv-doc-sum-row inv-doc-sum-total"><span>Total</span><span>' + fkMoneyDoc(inv.total) + "</span></div>" +
      (inv.paidAmount ? '<div class="inv-doc-sum-row"><span>Sudah dibayar</span><span>' + fkMoneyDoc(inv.paidAmount) + "</span></div>" : "") +
      '<div class="inv-doc-sum-row inv-doc-sum-due"><span>Saldo terutang</span><span>' + fkMoneyDoc(Math.max(0, inv.balanceDue)) + "</span></div>";

   var banks = (b.bankAccounts || []).map(function (a) {
      return '<div class="inv-doc-bank"><strong>' + fkEsc(a.bank) + " " + fkEsc(a.number) + "</strong>" + (a.holder ? "<br>a/n " + fkEsc(a.holder) : "") + "</div>";
   }).join("");

   return (
      '<div class="inv-doc">' +
      (stamp ? '<div class="inv-doc-stamp inv-doc-stamp-' + stamp.toLowerCase() + '">' + stamp + "</div>" : "") +
      '<div class="inv-doc-head"><div class="inv-doc-brand">' +
      (b.logoUrl ? '<img class="inv-doc-logo" src="' + fkEsc(b.logoUrl) + '" alt="" crossorigin="anonymous" width="64" height="64">' : "") +
      '<div><div class="inv-doc-bname">' + fkEsc(b.name || "Nama usaha") + "</div>" + (b.address ? '<div class="inv-doc-addr">' + fkEsc(b.address) + "</div>" : "") + "</div></div>" +
      '<div class="inv-doc-title"><div class="inv-doc-h">' + fkDocTitle(b.title) + '</div><div class="inv-doc-no">' + (inv.number ? "#" + fkEsc(inv.number) : "DRAF") + "</div>" +
      "<div>Tanggal: " + fkFmtDate(inv.issueDate) + "</div><div>Jatuh tempo: " + fkFmtDate(inv.dueDate) + "</div></div></div>" +
      '<div class="inv-doc-bill"><div class="inv-doc-label">Tagih kepada</div><div class="inv-doc-cname">' + fkEsc(c.name || "-") +
      (c.type === "reseller" ? ' <span class="inv-doc-tag">Reseller</span>' : "") + "</div>" +
      (c.city ? "<div>" + fkEsc(c.city) + "</div>" : "") + (c.phone ? "<div>" + fkEsc(c.phone) + "</div>" : "") + "</div>" +
      '<table class="inv-doc-table"><thead><tr><th class="inv-doc-c">No</th><th>Foto</th><th>Item</th><th class="inv-doc-r">Qty</th><th class="inv-doc-r">Harga</th>' +
      (anyDiscount ? '<th class="inv-doc-r">Diskon</th>' : "") + '<th class="inv-doc-r">Total</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="inv-doc-c inv-doc-note">Belum ada item</td></tr>') + "</tbody></table>" +
      '<div class="inv-doc-bottom"><div class="inv-doc-pay">' +
      (banks ? '<div class="inv-doc-label">Info pembayaran</div>' + banks : "") +
      "</div>" + '<div class="inv-doc-sum">' + sumHtml + "</div></div>" +
      (inv.notes ? '<div class="inv-doc-block"><div class="inv-doc-label">Catatan</div><div>' + fkEsc(inv.notes).replace(/\n/g, "<br>") + "</div></div>" : "") +
      (b.terms ? '<div class="inv-doc-block"><div class="inv-doc-label">Syarat &amp; ketentuan</div><div>' + fkEsc(b.terms).replace(/\n/g, "<br>") + "</div></div>" : "") +
      (inv.status === "cancelled" && inv.cancelReason ? '<div class="inv-doc-block inv-doc-note">Dibatalkan: ' + fkEsc(inv.cancelReason) + "</div>" : "") +
      "</div>"
   );
}

function fkFitPaper() {
   var wrap = document.getElementById("fkPaperWrap");
   if (!wrap) return;
   var doc = wrap.querySelector(".inv-doc");
   if (!doc) return;
   var scale = Math.min(1, wrap.clientWidth / FK_DOC_WIDTH);
   doc.style.transform = "scale(" + scale + ")";
   doc.style.transformOrigin = "top left";
   wrap.style.height = Math.ceil(doc.offsetHeight * scale) + "px";
}

window.addEventListener("resize", function () {
   if (state.currentPage === "faktur" && fk.editor && fk.editor.tab === "preview") fkFitPaper();
});

function fkLoadExternalScript(src) {
   return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-fk-src="' + src + '"]')) return resolve();
      var s = document.createElement("script");
      s.src = src;
      s.dataset.fkSrc = src;
      s.onload = resolve;
      s.onerror = function () {
         s.remove();
         reject(new Error("Gagal memuat " + src));
      };
      document.body.appendChild(s);
   });
}

function fkWaitImages(root, timeoutMs) {
   var imgs = Array.prototype.slice.call(root.querySelectorAll("img"));
   return Promise.all(imgs.map(function (img) {
      return new Promise(function (resolve) {
         var done = function () {
            // A photo that failed (offline, blocked) becomes an empty box instead of breaking the whole image (FR-8.8).
            if (!img.complete || !img.naturalWidth) {
               var box = document.createElement("span");
               box.className = img.classList.contains("inv-doc-logo") ? "" : "inv-doc-noimg";
               img.replaceWith(box);
            }
            resolve();
         };
         if (img.complete) return done();
         img.addEventListener("load", done, { once: true });
         img.addEventListener("error", done, { once: true });
         setTimeout(done, timeoutMs);
      });
   }));
}

function fkCanvasToBlob(canvas, type, quality) {
   return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
}

function fkFileBase() {
   var ed = fk.editor;
   var base = ed.base || {};
   return (base.number || "faktur") + "_" + (base.issueDate || fkToday());
}

// Two steps (prepare, then share) because Chrome only allows navigator.share right after a tap, and rendering takes time.
window.fkPrepareImage = async function () {
   var ed = fk.editor;
   if (!ed || !ed.id || fk.busy) return;
   fkSetBusy(true);
   var holder = document.createElement("div");
   holder.className = "fk-offscreen";
   holder.innerHTML = fkInvoiceDocHtml(fkPreviewInvoice());
   document.body.appendChild(holder);
   try {
      await fkLoadExternalScript(FK_HTML2CANVAS_URL);
      var node = holder.querySelector(".inv-doc");
      await fkWaitImages(node, 6000);
      var canvas = await window.html2canvas(node, {
         scale: FK_IMAGE_WIDTH / FK_DOC_WIDTH,
         useCORS: true,
         backgroundColor: "#ffffff",
         logging: false,
      });
      var blob = await fkCanvasToBlob(canvas, "image/png");
      var type = "image/png";
      var ext = "png";
      if (!blob || blob.size > 1.5 * 1024 * 1024) {
         blob = await fkCanvasToBlob(canvas, "image/jpeg", 0.9);
         type = "image/jpeg";
         ext = "jpg";
      }
      if (!blob) throw new Error("Browser tidak bisa membuat gambar");
      fk.share = { invoiceId: ed.id, blob: blob, type: type, name: fkFileBase() + "." + ext };
      fkToast("Gambar siap (" + Math.round(blob.size / 1024) + " KB). Tekan Bagikan gambar.", "success");
   } catch (err) {
      console.error("Faktur image error:", err);
      fkToast("Gagal membuat gambar: " + (err && err.message ? err.message : err), "error");
   } finally {
      holder.remove();
      fk.busy = false;
      fkRenderBottomBar();
   }
};

window.fkShareImage = async function () {
   var sh = fk.share;
   if (!sh) return;
   var file = new File([sh.blob], sh.name, { type: sh.type });
   try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
         await navigator.share({ files: [file], title: sh.name });
      } else {
         fkDownloadBlob(sh.blob, sh.name);
         fkToast("Gambar diunduh. Kirim lewat WhatsApp dari folder unduhan.", "success");
      }
      fkTouchShared();
   } catch (err) {
      if (err && err.name === "AbortError") return;
      fkDownloadBlob(sh.blob, sh.name);
      fkToast("Lembar bagikan tidak tersedia, gambar diunduh.", "warning");
      fkTouchShared();
   }
};

function fkDownloadBlob(blob, name) {
   var url = URL.createObjectURL(blob);
   var a = document.createElement("a");
   a.href = url;
   a.download = name;
   document.body.appendChild(a);
   a.click();
   a.remove();
   setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}

// Records when an invoice was last sent; failures are ignored because sharing already succeeded.
function fkTouchShared() {
   var ed = fk.editor;
   if (!ed || !ed.id || !ed.base || ed.base.status !== "issued") return;
   var at = fkNow();
   db.collection("invoices").doc(ed.id).update({ lastSharedAt: at })
      .then(function () { if (fk.editor && fk.editor.base) fk.editor.base.lastSharedAt = at; })
      .catch(function (err) { console.warn("lastSharedAt not saved:", err && err.code); });
}

window.fkPrint = function () {
   var ed = fk.editor;
   if (!ed) return;
   var root = document.getElementById("fkPrintRoot");
   if (!root) {
      root = document.createElement("div");
      root.id = "fkPrintRoot";
      document.body.appendChild(root);
   }
   root.innerHTML = fkInvoiceDocHtml(fkPreviewInvoice());
   var oldTitle = document.title;
   // Chrome uses the page title as the suggested PDF file name.
   document.title = fkFileBase();
   document.body.classList.add("fk-printing");
   var cleaned = false;
   var cleanup = function () {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove("fk-printing");
      document.title = oldTitle;
      root.innerHTML = "";
      window.removeEventListener("afterprint", cleanup);
   };
   window.addEventListener("afterprint", cleanup);
   fkWaitImages(root, 4000).then(function () {
      window.print();
      // Android Chrome returns from print() before the page is captured, so cleanup waits for afterprint;
      // the long fallback only matters if that event never fires, and the print area is hidden on screen anyway.
      setTimeout(cleanup, 60000);
      fkTouchShared();
   });
};

window.fkSendWhatsApp = function () {
   var inv = fkPreviewInvoice();
   var b = inv.business || {};
   var lines = [
      "Halo " + (inv.customer.name || "") + ",",
      "",
      "Berikut " + fkDocTitle(b.title).toLowerCase() + " " + (inv.number || "") + (b.name ? " dari " + b.name : "") + ".",
      "Tanggal: " + fkFmtDate(inv.issueDate),
      "Total: " + fmtRp(inv.total),
   ];
   if (inv.paidAmount) lines.push("Sudah dibayar: " + fmtRp(inv.paidAmount));
   lines.push("Sisa tagihan: " + fmtRp(Math.max(0, inv.balanceDue)));
   if (inv.balanceDue > 0) lines.push("Jatuh tempo: " + fkFmtDate(inv.dueDate));
   if ((b.bankAccounts || []).length && inv.balanceDue > 0) {
      lines.push("", "Pembayaran ke:");
      b.bankAccounts.forEach(function (a) { lines.push(a.bank + " " + a.number + (a.holder ? " a/n " + a.holder : "")); });
   }
   lines.push("", "Terima kasih.");
   var phone = FakturCalc.normalizeWaPhone(inv.customer.phone);
   var url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(lines.join("\n"));
   window.open(url, "_blank", "noopener");
   fkTouchShared();
};

window.fkOpenSettings = function () {
   // Opened from "Terbitkan" without settings: keep the invoice being typed and come back to it afterwards.
   fk.returnToEditor = fk.view === "editor" && !!fk.editor;
   if (fk.returnToEditor) {
      clearTimeout(fkLocalTimer);
      fkWriteLocal();
   }
   fk.view = "settings";
   fk.settingsForm = fkSettingsFormFromDoc(fk.settings);
   fk.counter = { prefix: null, data: null, loaded: false, loading: false };
   renderFaktur(true);
   window.scrollTo(0, 0);
};

function fkSettingsFormFromDoc(s) {
   s = s || {};
   return {
      businessName: s.businessName || "INZTAMOTO",
      documentTitle: fkDocTitle(s.documentTitle),
      address: s.address || "",
      logoUrl: s.logoUrl || "",
      bankAccounts: Array.isArray(s.bankAccounts) && s.bankAccounts.length ? s.bankAccounts.map(function (b) { return Object.assign({}, b); }) : [{ bank: "", number: "", holder: "" }],
      terms: s.terms != null ? s.terms : "Pembayaran wajib dilakukan dalam 7 hari setelah tanggal faktur, kecuali disepakati lain.",
      defaultDueDays: Number.isInteger(s.defaultDueDays) ? s.defaultDueDays : 7,
      numberPrefix: s.numberPrefix || "INV",
      numberPad: s.numberPad || 4,
      defaultTax: s.defaultTax || { type: "none", value: 0, label: "PPN" },
   };
}

// The counter for the active prefix is read once when Settings opens (1 read), not kept as a listener.
function fkLoadCounter(prefix) {
   if (fk.counter.loading || (fk.counter.loaded && fk.counter.prefix === prefix)) return;
   fk.counter = { prefix: prefix, data: null, loaded: false, loading: true };
   db.collection("counters").doc("invoice_" + prefix).get()
      .then(function (snap) {
         if (fk.counter.prefix !== prefix) return;
         fk.counter = { prefix: prefix, data: snap.exists ? snap.data() : null, loaded: true, loading: false };
         fkRenderNumbering();
      })
      .catch(function (err) {
         fk.counter = { prefix: prefix, data: null, loaded: false, loading: false, error: fkErrorMessage(err, "Gagal membaca penomoran") };
         fkRenderNumbering();
      });
}

function fkRenderSettings() {
   var el = document.getElementById("pageFaktur");
   if (!fk.settingsForm) fk.settingsForm = fkSettingsFormFromDoc(fk.settings);
   var f = fk.settingsForm;
   var banks = f.bankAccounts.map(function (b, i) {
      return (
         '<div class="fk-bank-row">' +
         '<input class="form-input" value="' + fkEsc(b.bank) + '" oninput="fkSetBank(' + i + ', \'bank\', this.value)" placeholder="Bank, mis. BCA" aria-label="Bank">' +
         '<input class="form-input" value="' + fkEsc(b.number) + '" inputmode="numeric" oninput="fkSetBank(' + i + ', \'number\', this.value)" placeholder="No. rekening" aria-label="Nomor rekening">' +
         '<input class="form-input" value="' + fkEsc(b.holder) + '" oninput="fkSetBank(' + i + ', \'holder\', this.value)" placeholder="Atas nama" aria-label="Atas nama">' +
         '<button type="button" class="action-btn del" onclick="fkRemoveBank(' + i + ')" aria-label="Hapus rekening"><i class="fas fa-trash"></i></button>' +
         "</div>"
      );
   }).join("");
   var tax = f.defaultTax || { type: "none", value: 0, label: "PPN" };
   el.innerHTML =
      '<div class="fk-editor">' +
      '<div class="fk-editor-head"><button class="fk-back" onclick="fkCloseSettings()" aria-label="Kembali ke daftar"><i class="fas fa-arrow-left"></i></button>' +
      '<div class="fk-editor-title"><h2>Pengaturan Faktur</h2></div></div>' +
      '<div class="fk-form">' +
      '<section class="card fk-section"><div class="fk-section-head"><h3>Identitas usaha</h3></div><div class="fk-section-body">' +
      '<div class="fk-logo-row">' + (f.logoUrl ? '<img class="fk-logo-preview" src="' + fkEsc(f.logoUrl) + '" alt="Logo">' : '<span class="fk-logo-preview fk-thumb-empty"><i class="fas fa-image"></i></span>') +
      '<div><label class="btn btn-outline btn-sm" for="fkLogoFile">' + (fk.logoUploading ? "Mengunggah..." : f.logoUrl ? "Ganti logo" : "Unggah logo") + "</label>" +
      '<input id="fkLogoFile" type="file" accept="image/*" hidden onchange="fkUploadLogo(this)">' +
      (f.logoUrl ? ' <button type="button" class="btn btn-outline btn-sm" onclick="fkRemoveLogo()">Hapus</button>' : "") + "</div></div>" +
      '<div class="form-group"><label for="fkSetName">Nama usaha</label><input id="fkSetName" class="form-input" value="' + fkEsc(f.businessName) + '" oninput="fkSetSetting(\'businessName\', this.value)"></div>' +
      '<div class="form-group"><label for="fkSetAddr">Alamat singkat</label><input id="fkSetAddr" class="form-input" value="' + fkEsc(f.address) + '" oninput="fkSetSetting(\'address\', this.value)" placeholder="Mis. kota atau alamat toko"></div>' +
      '<div class="form-group"><label for="fkSetTitle">Judul dokumen</label><select id="fkSetTitle" class="form-input" onchange="fkSetSetting(\x27documentTitle\x27, this.value)">' +
      ["FAKTUR", "INVOICE"].map(function (t) { return '<option value="' + t + '"' + (f.documentTitle === t ? " selected" : "") + ">" + t + "</option>"; }).join("") +
      '</select><p class="fk-hint">Tulisan besar di pojok kanan atas dokumen. Faktur yang sudah terbit tidak ikut berubah.</p></div>' +
      "</div></section>" +
      '<section class="card fk-section"><div class="fk-section-head"><h3>Rekening pembayaran</h3><button class="btn btn-outline btn-sm" onclick="fkAddBank()"><i class="fas fa-plus"></i>Tambah</button></div>' +
      '<div class="fk-section-body">' + banks + "</div></section>" +
      '<section class="card fk-section"><div class="fk-section-head"><h3>Syarat dan default</h3></div><div class="fk-section-body">' +
      '<div class="form-group"><label for="fkSetTerms">Syarat &amp; ketentuan</label><textarea id="fkSetTerms" class="form-input" rows="3" oninput="fkSetSetting(\'terms\', this.value)">' + fkEsc(f.terms) + "</textarea></div>" +
      '<div class="form-row"><div class="form-group"><label for="fkSetDue">Jatuh tempo default (hari)</label><input id="fkSetDue" class="form-input" type="number" min="0" max="365" value="' + f.defaultDueDays + '" oninput="fkSetSetting(\'defaultDueDays\', this.value)"></div>' +
      '<div class="form-group"><label>Pajak default</label><div class="fk-inline">' + fkTypeSelect("fkSetTaxType", tax.type, "fkSetDefaultTax('type', this.value)") +
      '<input id="fkSetTaxValue" class="form-input fk-short" inputmode="decimal" value="' + fkValueText(tax) + '" ' + (tax.type === "none" ? "disabled" : "") + ' oninput="fkSetDefaultTax(\'value\', this.value)" aria-label="Nilai pajak default"></div></div></div>' +
      "</div></section>" +
      '<section class="card fk-section"><div class="fk-section-head"><h3>Penomoran</h3></div><div class="fk-section-body">' +
      '<div class="form-group"><label for="fkSetPrefix">Awalan nomor</label><input id="fkSetPrefix" class="form-input fk-short" value="' + fkEsc(f.numberPrefix) + '" maxlength="6" oninput="fkSetPrefix(this)">' +
      '<p class="fk-hint">Pakai <strong>UJI</strong> selama uji coba, lalu ganti ke <strong>INV</strong> saat mulai dipakai. Setiap awalan punya urutan nomor sendiri.</p></div>' +
      '<div id="fkNumbering"></div></div></section>' +
      "</div>" +
      '<div class="fk-bottom-bar"><button class="btn btn-outline" onclick="fkCloseSettings()">Batal</button><button class="btn btn-primary" id="fkSaveSettingsBtn" onclick="fkSaveSettings()"><i class="fas fa-floppy-disk"></i>Simpan pengaturan</button></div>' +
      "</div>";
   fkRenderNumbering();
}

function fkSavedPrefix() {
   return (fk.settings && fk.settings.numberPrefix) || "";
}

function fkRenderNumbering() {
   var box = document.getElementById("fkNumbering");
   if (!box || !fk.settingsForm) return;
   var f = fk.settingsForm;
   var prefix = f.numberPrefix;
   if (!fk.settings || fkSavedPrefix() !== prefix) {
      box.innerHTML = '<p class="fk-hint">Simpan pengaturan dulu, lalu mulai penomoran untuk awalan <strong>' + fkEsc(prefix || "-") + "</strong>.</p>";
      return;
   }
   fkLoadCounter(prefix);
   if (fk.counter.error) {
      box.innerHTML = '<p class="fk-hint fk-hint-error">' + fkEsc(fk.counter.error) + "</p>";
      return;
   }
   if (!fk.counter.loaded) {
      box.innerHTML = '<p class="fk-hint">Membaca penomoran...</p>';
      return;
   }
   if (fk.counter.data) {
      box.innerHTML = '<div class="fk-number-info"><span>Nomor faktur berikutnya</span><strong>' +
         fkEsc(FakturCalc.formatInvoiceNumber(prefix, fk.counter.data.next, f.numberPad)) + "</strong></div>" +
         '<p class="fk-hint">Nomor dibuat otomatis saat faktur diterbitkan dan tidak bisa diubah.</p>';
      return;
   }
   var suggested = prefix === "INV" ? 101 : 1;
   box.innerHTML =
      '<div class="fk-banner fk-banner-soft"><i class="fas fa-hashtag"></i><div>Penomoran <strong>' + fkEsc(prefix) + "</strong> belum dimulai. Tentukan nomor faktur pertama.</div></div>" +
      '<div class="fk-inline"><input id="fkStartNumber" class="form-input fk-short" type="number" min="1" step="1" value="' + suggested + '" aria-label="Nomor pertama">' +
      '<button class="btn btn-primary btn-sm" onclick="fkStartNumbering()">Mulai penomoran</button></div>' +
      '<p class="fk-hint" id="fkStartPreview">Faktur pertama: ' + fkEsc(FakturCalc.formatInvoiceNumber(prefix, suggested, f.numberPad)) + "</p>";
   var input = document.getElementById("fkStartNumber");
   if (input) input.oninput = function () {
      var n = Math.max(1, FakturCalc.toInt(input.value));
      document.getElementById("fkStartPreview").textContent = "Faktur pertama: " + FakturCalc.formatInvoiceNumber(prefix, n, f.numberPad);
   };
}

window.fkSetSetting = function (field, value) {
   fk.settingsForm[field] = field === "defaultDueDays" ? Math.min(365, Math.max(0, FakturCalc.toInt(value))) : value;
};

window.fkSetDefaultTax = function (part, value) {
   var t = fk.settingsForm.defaultTax = Object.assign({ type: "none", value: 0, label: "PPN" }, fk.settingsForm.defaultTax);
   if (part === "type") {
      t.type = value;
      t.value = 0;
      var input = document.getElementById("fkSetTaxValue");
      if (input) {
         input.value = "";
         input.disabled = value === "none";
      }
   } else {
      t.value = t.type === "percent" ? FakturCalc.toPercent(value) : FakturCalc.toMoney(value);
   }
};

window.fkSetPrefix = function (input) {
   var v = String(input.value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
   input.value = v;
   fk.settingsForm.numberPrefix = v;
   fkRenderNumbering();
};

window.fkSetBank = function (i, field, value) {
   fk.settingsForm.bankAccounts[i][field] = value;
};

window.fkAddBank = function () {
   fk.settingsForm.bankAccounts.push({ bank: "", number: "", holder: "" });
   fkRenderSettings();
};

window.fkRemoveBank = function (i) {
   fk.settingsForm.bankAccounts.splice(i, 1);
   if (!fk.settingsForm.bankAccounts.length) fk.settingsForm.bankAccounts.push({ bank: "", number: "", holder: "" });
   fkRenderSettings();
};

window.fkRemoveLogo = function () {
   fk.settingsForm.logoUrl = "";
   fkRenderSettings();
};

window.fkUploadLogo = async function (input) {
   var file = input.files && input.files[0];
   if (!file) return;
   if (!file.type || file.type.indexOf("image/") !== 0) return fkToast("File harus berupa gambar", "warning");
   if (file.size > 5 * 1024 * 1024) return fkToast("Ukuran logo maksimal 5MB", "warning");
   if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) return fkToast("Cloudinary belum dikonfigurasi", "error");
   var form = new FormData();
   form.append("file", file);
   form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
   form.append("folder", "inztamoto/invoice");
   fk.logoUploading = true;
   fkRenderSettings();
   try {
      var res = await fetch("https://api.cloudinary.com/v1_1/" + CLOUDINARY_CLOUD_NAME + "/image/upload", { method: "POST", body: form });
      var data = await res.json();
      if (data.error) throw new Error(data.error.message);
      fk.settingsForm.logoUrl = "https://res.cloudinary.com/" + CLOUDINARY_CLOUD_NAME + "/image/upload/q_auto,f_auto,w_300/" + data.public_id;
      fkToast("Logo terunggah. Klik Simpan pengaturan.", "success");
   } catch (err) {
      fkToast("Gagal unggah logo: " + (err && err.message ? err.message : err), "error");
   } finally {
      fk.logoUploading = false;
      fkRenderSettings();
   }
};

window.fkCloseSettings = function () {
   fk.view = fk.returnToEditor && fk.editor ? "editor" : "list";
   fk.returnToEditor = false;
   fk.settingsForm = null;
   renderFaktur(true);
};

window.fkSaveSettings = async function () {
   var f = fk.settingsForm;
   if (!String(f.businessName || "").trim()) return fkToast("Nama usaha wajib diisi", "warning");
   if (!/^[A-Z0-9]{1,6}$/.test(f.numberPrefix || "")) return fkToast("Awalan nomor 1–6 huruf atau angka", "warning");
   var banks = f.bankAccounts
      .map(function (b) { return { bank: String(b.bank || "").trim(), number: String(b.number || "").trim(), holder: String(b.holder || "").trim() }; })
      .filter(function (b) { return b.bank || b.number || b.holder; });
   if (banks.some(function (b) { return !b.bank || !b.number; })) return fkToast("Lengkapi nama bank dan nomor rekening", "warning");
   var tax = f.defaultTax || { type: "none", value: 0, label: "PPN" };
   var doc = {
      businessName: String(f.businessName).trim(),
      address: String(f.address || "").trim(),
      logoUrl: f.logoUrl || "",
      bankAccounts: banks,
      terms: String(f.terms || "").trim(),
      defaultDueDays: Math.min(365, Math.max(0, FakturCalc.toInt(f.defaultDueDays))),
      numberPrefix: f.numberPrefix,
      numberPad: 4,
      documentTitle: fkDocTitle(f.documentTitle),
      defaultTax: { type: tax.type || "none", value: tax.type === "none" ? 0 : tax.value || 0, label: tax.label || "PPN" },
      updatedAt: fkNow(),
      updatedBy: fkActor(),
   };
   var btn = document.getElementById("fkSaveSettingsBtn");
   if (btn) {
      btn.disabled = true;
      btn.textContent = "Menyimpan...";
   }
   fk.busy = true;
   try {
      await db.collection("invoice_settings").doc("default").set(doc, { merge: true });
      fk.settings = Object.assign({}, fk.settings || {}, doc);
      fk.settingsForm.bankAccounts = banks.length ? banks : [{ bank: "", number: "", holder: "" }];
      fkToast("Pengaturan faktur tersimpan", "success");
   } catch (err) {
      fkToast(fkErrorMessage(err, "Gagal menyimpan pengaturan"), "error");
   } finally {
      fk.busy = false;
      fkRenderSettings();
   }
};

// Creates the counter once; the transaction refuses to touch a counter that already exists.
window.fkStartNumbering = async function () {
   var prefix = fkSavedPrefix();
   var input = document.getElementById("fkStartNumber");
   var start = Math.max(1, FakturCalc.toInt(input && input.value));
   var ref = db.collection("counters").doc("invoice_" + prefix);
   try {
      await db.runTransaction(async function (tx) {
         var snap = await tx.get(ref);
         if (snap.exists) throw new Error("Penomoran " + prefix + " sudah dimulai sebelumnya.");
         tx.set(ref, { prefix: prefix, next: start, lastInvoiceId: "", createdAt: fkNow(), createdBy: fkActor(), updatedAt: fkNow() });
      });
      fkToast("Penomoran " + prefix + " dimulai dari " + FakturCalc.formatInvoiceNumber(prefix, start, 4), "success");
   } catch (err) {
      fkToast(fkErrorMessage(err, "Gagal memulai penomoran"), "error");
   }
   fk.counter = { prefix: null, data: null, loaded: false, loading: false };
   fkRenderNumbering();
};

function fkOpenSheet(title, body, footer, extraClass) {
   fkCloseSheet();
   var overlay = document.createElement("div");
   overlay.id = "fkSheet";
   overlay.className = "fk-sheet-overlay";
   overlay.innerHTML =
      '<div class="fk-sheet ' + (extraClass || "") + '" role="dialog" aria-modal="true" aria-labelledby="fkSheetTitle">' +
      '<div class="fk-sheet-head"><h3 id="fkSheetTitle">' + fkEsc(title) + '</h3><button class="modal-close" onclick="fkCloseSheet()" aria-label="Tutup"><i class="fas fa-xmark"></i></button></div>' +
      '<div class="fk-sheet-body">' + body + "</div>" +
      (footer ? '<div class="fk-sheet-foot">' + footer + "</div>" : "") +
      "</div>";
   overlay.addEventListener("click", function (e) {
      if (e.target === overlay) fkCloseSheet();
   });
   document.body.appendChild(overlay);
   document.body.classList.add("fk-sheet-open");
}

window.fkCloseSheet = function () {
   var el = document.getElementById("fkSheet");
   if (el) el.remove();
   document.body.classList.remove("fk-sheet-open");
};

document.addEventListener("keydown", function (e) {
   if (e.key === "Escape" && document.getElementById("fkSheet")) fkCloseSheet();
});
