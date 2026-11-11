// Garansi and Masukan pages (F-031 release 1, inzta-hq docs/specs/F-031-claim-garansi, data option B).
// Claims and feedback live in the inzta.id Firestore; this file only calls the website's /api/erp/* routes with the
// signed-in user's Firebase ID token. It never reads or writes database-inzta and adds no realtime listener.
// Loaded after app-runtime.js as a classic script, so it shares auth, state, $, toast, navigateTo and getCurrentUserRole.
// Security (requirement 5.6a): every value from the API is untrusted visitor or staff text. It reaches innerHTML only
// through grEsc(), URLs only after grSafeUrl()/grWaLink(), and toast() only ever receives the constant messages below.

var GR_BADGE_MIN_MS = 2 * 60 * 1000;
var GR_FETCH_TIMEOUT_MS = 20000;
// NOTE_LIMITS in the website lib/warranty/rules.ts.
var GR_PUBLIC_NOTE_MAX = 1000;
var GR_INTERNAL_NOTE_MAX = 2000;
var GR_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

var GR_MSG = {
   noBase: "Alamat API garansi belum diatur di ERP ini (NEXT_PUBLIC_WARRANTY_API_BASE).",
   unauthorized: "Sesi habis, silakan masuk lagi.",
   forbidden: "Akun ini tidak punya akses ke menu ini.",
   notFound: "Data tidak ditemukan. Mungkin sudah dihapus.",
   conflictClaim: "Tiket sudah diubah orang lain, muat ulang.",
   conflictFeedback: "Masukan sudah diubah orang lain, muat ulang.",
   invalid: "Data belum valid. Periksa isian lalu coba lagi.",
   tooMany: "Terlalu banyak permintaan. Coba lagi sebentar lagi.",
   server: "Server inzta.id sedang bermasalah. Coba lagi nanti.",
   network: "Tidak bisa terhubung ke inzta.id. Periksa koneksi internet lalu coba lagi.",
   saved: "Perubahan tersimpan",
   noChange: "Belum ada perubahan untuk disimpan.",
   transition: "Perubahan status ini tidak diizinkan. Muat ulang tiket.",
   tooLong: "Isian terlalu panjang.",
};

// Display copy of the website's transition matrix (requirement 6.2); the website route stays the authority and answers 409.
var GR_CLAIM_STATUS = {
   new: "New Ticket",
   under_review: "Under Review",
   in_progress: "In Progress",
   waiting_customer: "Waiting Customer",
   resolved: "Resolved",
   rejected: "Rejected",
};
var GR_CLAIM_NEXT = {
   new: ["under_review", "rejected"],
   under_review: ["in_progress", "waiting_customer", "resolved", "rejected"],
   in_progress: ["waiting_customer", "resolved"],
   waiting_customer: ["under_review", "in_progress", "rejected"],
   resolved: ["under_review"],
   rejected: ["under_review"],
};
var GR_FEEDBACK_STATUS = {
   new: "Baru",
   read: "Dibaca",
   followed_up: "Ditindaklanjuti",
   archived: "Diarsipkan",
};
// Requirement 10.6: any forward move, plus archived -> read.
var GR_FEEDBACK_NEXT = {
   new: ["read", "followed_up", "archived"],
   read: ["followed_up", "archived"],
   followed_up: ["archived"],
   archived: ["read"],
};

var GR_ASSIGNEE = { admin: "Admin", produksi: "Produksi" };
var GR_RESOLUTION = {
   diperbaiki: "Diperbaiki",
   diganti: "Diganti baru",
   "kirim-part": "Kirim part",
   refund: "Refund",
   saran: "Saran saja",
   lainnya: "Lainnya",
};
var GR_REJECT_REASON = {
   "lewat-masa": "Lewat masa garansi",
   pemakaian: "Kerusakan karena pemakaian atau kecelakaan",
   "bukan-produk-inzta": "Bukan produk INZTA",
   "data-tidak-cocok": "Data tidak bisa diverifikasi",
   lainnya: "Lainnya",
};
var GR_CHANNEL = {
   website: "Website",
   shopee: "Shopee",
   tokopedia: "Tokopedia / TikTok Shop",
   "toko-partner": "Toko partner",
   lainnya: "Lainnya",
};
var GR_USAGE = {
   lt1: "Kurang dari 1 bulan",
   "1-3": "1–3 bulan",
   "3-6": "3–6 bulan",
   "6-12": "6–12 bulan",
   gt12: "Lebih dari 12 bulan",
};
var GR_DAMAGE = {
   resleting: "Resleting",
   jahitan: "Jahitan",
   "tali-buckle": "Tali / buckle",
   "kunci-pengait": "Kunci / pengait",
   bocor: "Bocor / rembes",
   "bahan-robek": "Bahan robek",
   lainnya: "Lainnya",
};
var GR_FEEDBACK_KIND = { pengalaman: "Pengalaman", kritik: "Kritik", saran: "Saran" };

// Draft templates from design.md section 9; final wording goes through G2.
var GR_WA_TEMPLATES = {
   under_review:
      "Halo {nama}, klaim garansi {tiket} sudah kami terima dan sedang diperiksa. Kami kabari lagi setelah pengecekan.",
   waiting_customer: "Halo {nama}, untuk klaim {tiket} kami butuh: {catatan}. Bisa dibalas di chat ini. Terima kasih.",
   in_progress: "Halo {nama}, klaim {tiket} sedang ditangani tim produksi INZTA. {catatan}",
   resolved: "Halo {nama}, klaim {tiket} sudah selesai: {catatan}. Terima kasih sudah memakai INZTA.",
   rejected:
      "Halo {nama}, mohon maaf, klaim {tiket} belum bisa kami proses sebagai garansi: {catatan}. Bila ada pertanyaan, balas chat ini.",
};

var GR_KINDS = {
   garansi: {
      pageId: "pageGaransi",
      path: "/api/erp/garansi",
      idKey: "ticket",
      itemKey: "claim",
      listTitle: "Klaim Garansi",
      noun: "klaim",
      statusLabels: GR_CLAIM_STATUS,
      next: GR_CLAIM_NEXT,
      conflictMsg: GR_MSG.conflictClaim,
      defaultFilter: "open",
      filters: [
         { value: "open", label: "Semua yang masih terbuka" },
         { value: "all", label: "Semua status" },
         { value: "new", label: GR_CLAIM_STATUS.new },
         { value: "under_review", label: GR_CLAIM_STATUS.under_review },
         { value: "in_progress", label: GR_CLAIM_STATUS.in_progress },
         { value: "waiting_customer", label: GR_CLAIM_STATUS.waiting_customer },
         { value: "resolved", label: GR_CLAIM_STATUS.resolved },
         { value: "rejected", label: GR_CLAIM_STATUS.rejected },
      ],
   },
   masukan: {
      pageId: "pageMasukan",
      path: "/api/erp/masukan",
      idKey: "ref",
      itemKey: "feedback",
      listTitle: "Masukan Pelanggan",
      noun: "masukan",
      statusLabels: GR_FEEDBACK_STATUS,
      next: GR_FEEDBACK_NEXT,
      conflictMsg: GR_MSG.conflictFeedback,
      defaultFilter: "open",
      filters: [
         { value: "open", label: "Semua yang belum diarsipkan" },
         { value: "all", label: "Semua status" },
         { value: "new", label: GR_FEEDBACK_STATUS.new },
         { value: "read", label: GR_FEEDBACK_STATUS.read },
         { value: "followed_up", label: GR_FEEDBACK_STATUS.followed_up },
         { value: "archived", label: GR_FEEDBACK_STATUS.archived },
      ],
   },
};

function grKindState(kind) {
   return {
      filter: GR_KINDS[kind].defaultFilter,
      items: [],
      loaded: false,
      loading: false,
      error: "",
      loadedAt: null,
      listSeq: 0,
      view: "list",
      openId: null,
      detail: null,
      detailLoading: false,
      detailError: "",
      detailSeq: 0,
      saving: false,
      justSaved: false,
   };
}

function grInitialState() {
   return {
      garansi: grKindState("garansi"),
      masukan: grKindState("masukan"),
      badge: { lastAt: 0, inflight: false, newCount: null, newFeedbackCount: null },
      warnedNoBase: false,
      lastPage: null,
   };
}

var gr = grInitialState();

function grEsc(value) {
   return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

// Only https URLs reach src/href, so a javascript: or data: value from the API can never run.
function grSafeUrl(value) {
   if (typeof value !== "string" || !value) return "";
   try {
      var u = new URL(value);
      return u.protocol === "https:" ? u.href : "";
   } catch (e) {
      return "";
   }
}

function grLabel(map, key, fallback) {
   if (key != null && Object.prototype.hasOwnProperty.call(map, key)) return map[key];
   return fallback != null ? fallback : key == null || key === "" ? "-" : String(key);
}

function grOwn(map, key) {
   return key != null && Object.prototype.hasOwnProperty.call(map, key);
}

function warrantyApiBase() {
   var env = window.__INZTAMOTO_ENV__ && window.__INZTAMOTO_ENV__.warranty;
   var raw = String((env && env.apiBase) || "").trim();
   if (!raw) return "";
   try {
      var u = new URL(raw);
      var local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      if (u.protocol === "https:" || (u.protocol === "http:" && local)) return u.origin;
   } catch (e) {}
   return "";
}

function warrantyEnabled() {
   if (warrantyApiBase()) return true;
   if (!gr.warnedNoBase) {
      gr.warnedNoBase = true;
      console.warn(
         "[Garansi] NEXT_PUBLIC_WARRANTY_API_BASE kosong atau bukan https, jadi menu Garansi dan Masukan disembunyikan.",
      );
   }
   return false;
}

function grCanUse() {
   var role = getCurrentUserRole();
   return (role === "owner" || role === "admin") && warrantyEnabled() && !!auth.currentUser;
}

function grApiError(status, message, detail, code, fields) {
   var e = new Error(message);
   e.status = status;
   e.detail = detail || "";
   e.code = code || "";
   e.fields = fields || null;
   return e;
}

// Maps every failure to a fixed Indonesian message; the server's own text is kept in e.detail and only shown via grEsc.
async function warrantyApi(path, options) {
   var opts = options || {};
   var base = warrantyApiBase();
   if (!base) throw grApiError(0, GR_MSG.noBase);
   var user = auth.currentUser;
   if (!user) throw grApiError(401, GR_MSG.unauthorized);
   var token;
   try {
      token = await user.getIdToken(!!opts.forceRefresh);
   } catch (e) {
      throw grApiError(401, GR_MSG.unauthorized);
   }
   var headers = { Authorization: "Bearer " + token, Accept: "application/json" };
   var init = { method: opts.method || "GET", headers: headers, cache: "no-store", credentials: "omit", mode: "cors" };
   if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
   }
   var controller = typeof AbortController === "function" ? new AbortController() : null;
   var timer = null;
   if (controller) {
      init.signal = controller.signal;
      timer = setTimeout(function () {
         controller.abort();
      }, GR_FETCH_TIMEOUT_MS);
   }
   var res;
   var data = null;
   try {
      res = await fetch(base + path, init);
      try {
         data = await res.json();
      } catch (e) {
         if (controller && controller.signal.aborted) throw e;
         data = null;
      }
   } catch (e) {
      throw grApiError(0, GR_MSG.network);
   } finally {
      if (timer) clearTimeout(timer);
   }
   if (res.ok) return data || {};

   // An ID token can expire between getIdToken() and the server check; refresh once before giving up.
   if (res.status === 401 && !opts.forceRefresh) {
      return warrantyApi(path, Object.assign({}, opts, { forceRefresh: true }));
   }
   // Website error body: { error, code, fields? } (lib/warranty/handlers.ts). Server text is shown via textContent only.
   var detail = data && typeof data.error === "string" ? data.error.slice(0, 300) : "";
   var code = data && typeof data.code === "string" ? data.code : "";
   var fields = data && data.fields && typeof data.fields === "object" ? data.fields : null;
   if (res.status === 401) throw grApiError(401, GR_MSG.unauthorized, "", code);
   if (res.status === 403) throw grApiError(403, GR_MSG.forbidden, "", code);
   if (res.status === 404) throw grApiError(404, GR_MSG.notFound, "", code);
   if (res.status === 409) {
      var msg409 = code === "TRANSITION" ? GR_MSG.transition : opts.conflictMsg || GR_MSG.conflictClaim;
      throw grApiError(409, msg409, "", code);
   }
   if (res.status === 413) throw grApiError(413, GR_MSG.tooLong, "", code);
   if (res.status === 429) throw grApiError(429, GR_MSG.tooMany, "", code);
   if (res.status === 400 && code === "NO_CHANGE") throw grApiError(400, GR_MSG.noChange, "", code);
   if (res.status === 400 || res.status === 422) throw grApiError(res.status, GR_MSG.invalid, detail, code, fields);
   throw grApiError(res.status, GR_MSG.server, "", code);
}

function grParseDate(value) {
   if (!value) return null;
   var d = new Date(value);
   return isNaN(d.getTime()) ? null : d;
}

function grFmtDate(value) {
   var d = grParseDate(value);
   if (!d) return "-";
   return d.getDate() + " " + GR_MONTHS[d.getMonth()] + " " + d.getFullYear();
}

function grFmtDateTime(value) {
   var d = grParseDate(value);
   if (!d) return "-";
   return grFmtDate(value) + " " + String(d.getHours()).padStart(2, "0") + "." + String(d.getMinutes()).padStart(2, "0");
}

// purchaseDate is a plain YYYY-MM-DD; parsing it with new Date() would shift it by the time zone.
function grFmtPlainDate(value) {
   var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
   if (!m) return "-";
   return +m[3] + " " + GR_MONTHS[+m[2] - 1] + " " + m[1];
}

function grAgeDays(value, serverDays) {
   if (typeof serverDays === "number" && serverDays >= 0) return Math.floor(serverDays) + " hari";
   var d = grParseDate(value);
   if (!d) return "-";
   var days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
   return days + " hari";
}

function grWaDigits(value) {
   var digits = String(value || "").replace(/\D/g, "");
   return /^\d{8,15}$/.test(digits) ? digits : "";
}

function grWaLink(number, text) {
   var digits = grWaDigits(number);
   if (!digits) return "";
   return "https://wa.me/" + digits + (text ? "?text=" + encodeURIComponent(text) : "");
}

function grWaTemplate(claim) {
   var tpl = GR_WA_TEMPLATES[claim && claim.status];
   if (!tpl) return "";
   var name = (claim.customer && claim.customer.name) || "";
   var note = String(claim.publicNote || "").trim().replace(/[.\s]+$/, "");
   return tpl
      .replace("{nama}", name)
      .replace("{tiket}", claim.ticket || "")
      .replace("{catatan}", note)
      .replace(/\s+/g, " ")
      .replace(/\s+([.,])/g, "$1")
      .trim();
}

function grStatusChip(kind, status) {
   var labels = GR_KINDS[kind].statusLabels;
   var known = grOwn(labels, status);
   var cls = known ? " gr-st-" + kind + "-" + status : "";
   return '<span class="gr-chip' + cls + '">' + grEsc(grLabel(labels, status)) + "</span>";
}

function grMarks(item) {
   var out = "";
   if (item.outsidePeriod) out += '<span class="gr-mark gr-mark-warn" title="Tanggal beli lebih dari 6 bulan sebelum klaim">Lewat 6 bulan?</span>';
   if (item.videoViaWhatsApp) out += '<span class="gr-mark" title="Customer punya video, dikirim lewat WhatsApp">Video via WA</span>';
   return out;
}

function grPage(kind) {
   return document.getElementById(GR_KINDS[kind].pageId);
}

function warrantyOnNavigate(page) {
   refreshWarrantyBadge(false);
   var samePage = gr.lastPage === page;
   gr.lastPage = page;
   if (page !== "garansi" && page !== "masukan") return;
   var s = gr[page];
   if (samePage && s.view === "detail" && (s.saving || grHasDraft(page))) return;
   s.view = "list";
   s.openId = null;
   s.detail = null;
   s.justSaved = false;
   s.detailSeq++;
   grRender(page);
   grLoadList(page);
}

function grHasDraft(kind) {
   var d = grCaptureDraft(kind);
   if (!d) return false;
   var item = gr[kind].detail;
   var savedInternal = kind === "masukan" && item ? String(item.internalNote || "") : "";
   return d.publicNote.trim() !== "" || d.internalNote.trim() !== savedInternal.trim();
}

function renderGaransi() {
   grRender("garansi");
}

function renderMasukan() {
   grRender("masukan");
}

function grRender(kind) {
   var s = gr[kind];
   if (s.view === "detail") grRenderDetail(kind);
   else grRenderList(kind);
}

function grListQuery(kind) {
   return GR_KINDS[kind].path + "?status=" + encodeURIComponent(gr[kind].filter);
}

async function grLoadList(kind) {
   var s = gr[kind];
   var seq = ++s.listSeq;
   s.loading = true;
   s.error = "";
   if (s.view === "list") grRenderList(kind);
   try {
      var data = await warrantyApi(grListQuery(kind));
      if (seq !== s.listSeq) return;
      var items = Array.isArray(data.items) ? data.items : [];
      s.items = items.filter(function (it) {
         return it && typeof it[GR_KINDS[kind].idKey] === "string";
      });
      s.matched = typeof data.matched === "number" ? data.matched : s.items.length;
      s.truncated = data.truncated === true;
      s.loaded = true;
      s.loadedAt = new Date();
      grApplyBadges();
   } catch (e) {
      if (seq !== s.listSeq) return;
      s.error = e.message;
   } finally {
      if (seq === s.listSeq) {
         s.loading = false;
         if (s.view === "list") grRenderList(kind);
      }
   }
}

function grNewCountLabel(kind) {
   var s = gr[kind];
   var count = null;
   if (s.loaded && !s.truncated && (s.filter === "open" || s.filter === "all" || s.filter === "new")) {
      count = s.items.filter(function (it) {
         return it.status === "new";
      }).length;
   } else {
      count = kind === "garansi" ? gr.badge.newCount : gr.badge.newFeedbackCount;
   }
   if (typeof count !== "number") return "";
   return '<span class="gr-new-count' + (count > 0 ? " has-new" : "") + '">' + count + " baru</span>";
}

function grRenderList(kind) {
   var el = grPage(kind);
   if (!el) return;
   var cfg = GR_KINDS[kind];
   var s = gr[kind];
   var opts = cfg.filters
      .map(function (f) {
         return '<option value="' + grEsc(f.value) + '"' + (s.filter === f.value ? " selected" : "") + ">" + grEsc(f.label) + "</option>";
      })
      .join("");
   var updated = s.loadedAt
      ? "Diperbarui pukul " + String(s.loadedAt.getHours()).padStart(2, "0") + "." + String(s.loadedAt.getMinutes()).padStart(2, "0")
      : "";

   var body;
   if (s.error && !s.loading) {
      body =
         '<div class="empty-state gr-state"><i class="fas fa-triangle-exclamation"></i><h4>Daftar ' + cfg.noun +
         " belum bisa dimuat</h4><p>" + grEsc(s.error) +
         '</p><button type="button" class="btn btn-outline btn-sm" data-gr-action="reload">Coba lagi</button></div>';
   } else if (!s.loaded) {
      body = '<div class="empty-state gr-state"><i class="fas fa-spinner fa-spin"></i><h4>Memuat ' + cfg.noun + "...</h4></div>";
   } else if (!s.items.length) {
      body =
         '<div class="empty-state gr-state"><i class="fas fa-inbox"></i><h4>Belum ada ' + cfg.noun +
         " di filter ini</h4><p>Ganti filter status atau tekan Muat ulang.</p></div>";
   } else {
      body = kind === "garansi" ? grClaimTable(s.items) : grFeedbackTable(s.items);
      if (s.truncated) {
         body +=
            '<p class="gr-truncated">Menampilkan ' + s.items.length + " " + cfg.noun + " terbaru" +
            (s.matched > s.items.length ? " dari " + s.matched : "") +
            ". Data lama tidak ikut dimuat; pakai filter status untuk mempersempit.</p>";
      }
   }

   el.dataset.grView = s.loading ? "list-loading" : s.error ? "list-error" : "list";
   el.innerHTML =
      '<div class="card gr-list-card">' +
      '<div class="table-toolbar gr-toolbar">' +
      '<div class="gr-toolbar-title"><h3>' + cfg.listTitle + "</h3>" + grNewCountLabel(kind) + "</div>" +
      '<div class="table-filter"><select data-gr-filter aria-label="Filter status">' + opts + "</select></div>" +
      '<button type="button" class="btn btn-outline btn-sm" data-gr-action="reload"' + (s.loading ? " disabled" : "") + ">" +
      '<i class="fas fa-rotate' + (s.loading ? " fa-spin" : "") + '"></i>Muat ulang</button>' +
      '<span class="gr-muted gr-updated" aria-live="polite">' + grEsc(updated) + "</span>" +
      "</div>" +
      body +
      "</div>";
}

function grClaimTable(items) {
   var rows = items
      .map(function (c) {
         var id = grEsc(c.ticket);
         return (
            '<tr class="gr-row" data-gr-open="' + id + '">' +
            '<td><button type="button" class="gr-link" data-gr-open="' + id + '">' + id + "</button></td>" +
            "<td>" + grEsc(grFmtDate(c.createdAt)) + "</td>" +
            "<td>" + grEsc(c.customerName || "-") + "</td>" +
            "<td>" + grEsc(c.productName || "-") + "</td>" +
            "<td>" + grStatusChip("garansi", c.status) + "</td>" +
            '<td class="gr-nowrap">' + grEsc(grAgeDays(c.createdAt, c.ageDays)) + "</td>" +
            '<td class="gr-marks-cell">' + grMarks(c) + "</td>" +
            "</tr>"
         );
      })
      .join("");
   return (
      '<div class="table-scroll gr-table-scroll"><table class="data-table gr-table"><thead><tr>' +
      "<th>Tiket</th><th>Masuk</th><th>Pembeli</th><th>Produk</th><th>Status</th><th>Umur</th><th>Tanda</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>"
   );
}

function grExcerpt(text, max) {
   var t = String(text || "").replace(/\s+/g, " ").trim();
   return t.length > max ? t.slice(0, max).trim() + "…" : t;
}

function grFeedbackTable(items) {
   var rows = items
      .map(function (f) {
         var id = grEsc(f.ref);
         var name = f.name ? grEsc(f.name) : '<span class="gr-muted">Tanpa nama</span>';
         return (
            '<tr class="gr-row" data-gr-open="' + id + '">' +
            '<td class="gr-nowrap"><button type="button" class="gr-link" data-gr-open="' + id + '">' + grEsc(grFmtDate(f.createdAt)) + "</button></td>" +
            '<td><span class="gr-kind">' + grEsc(grLabel(GR_FEEDBACK_KIND, f.kind)) + "</span></td>" +
            "<td>" + grEsc(f.productName || "-") + "</td>" +
            '<td class="gr-excerpt">' + grEsc(grExcerpt(f.excerpt, 80)) + "</td>" +
            "<td>" + name + "</td>" +
            "<td>" + grStatusChip("masukan", f.status) + "</td>" +
            "</tr>"
         );
      })
      .join("");
   return (
      '<div class="table-scroll gr-table-scroll"><table class="data-table gr-table"><thead><tr>' +
      "<th>Tanggal</th><th>Jenis</th><th>Produk</th><th>Isi</th><th>Nama</th><th>Status</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>"
   );
}

function grOpenDetail(kind, id) {
   var s = gr[kind];
   s.view = "detail";
   s.openId = id;
   s.detail = null;
   s.detailError = "";
   s.justSaved = false;
   grLoadDetail(kind, null);
   window.scrollTo(0, 0);
}

function grBackToList(kind) {
   var s = gr[kind];
   s.view = "list";
   s.openId = null;
   s.detail = null;
   s.justSaved = false;
   s.detailSeq++;
   grRenderList(kind);
}

async function grLoadDetail(kind, keepDraft) {
   var cfg = GR_KINDS[kind];
   var s = gr[kind];
   var id = s.openId;
   var seq = ++s.detailSeq;
   s.detailLoading = true;
   s.detailError = "";
   grRenderDetail(kind);
   try {
      var data = await warrantyApi(cfg.path + "/" + encodeURIComponent(id));
      if (seq !== s.detailSeq || s.view !== "detail" || s.openId !== id) return;
      var item = data[cfg.itemKey];
      if (!item || item[cfg.idKey] !== id) throw grApiError(500, GR_MSG.server);
      s.detail = item;
      grSyncListItem(kind, item);
   } catch (e) {
      if (seq !== s.detailSeq || s.view !== "detail" || s.openId !== id) return;
      s.detailError = e.message;
   } finally {
      if (seq === s.detailSeq && s.view === "detail" && s.openId === id) {
         s.detailLoading = false;
         grRenderDetail(kind);
         if (keepDraft) grRestoreDraft(kind, keepDraft);
      }
   }
}

// Keeps the already loaded list in step with a ticket the staff member just opened or saved, without another list read.
function grSyncListItem(kind, item) {
   var idKey = GR_KINDS[kind].idKey;
   var s = gr[kind];
   s.items = s.items.map(function (it) {
      if (it[idKey] !== item[idKey]) return it;
      return Object.assign({}, it, { status: item.status, updatedAt: item.updatedAt, assignee: item.assignee });
   });
}

function grField(label, valueHtml) {
   return '<div class="gr-field"><dt>' + label + "</dt><dd>" + valueHtml + "</dd></div>";
}

function grText(value) {
   var v = value == null ? "" : String(value).trim();
   return v ? grEsc(v) : '<span class="gr-muted">-</span>';
}

function grRenderDetail(kind) {
   var el = grPage(kind);
   if (!el) return;
   var cfg = GR_KINDS[kind];
   var s = gr[kind];
   var back =
      '<button type="button" class="gr-back" data-gr-action="back" aria-label="Kembali ke daftar"><i class="fas fa-arrow-left"></i></button>';

   if (!s.detail) {
      el.dataset.grView = s.detailError ? "detail-error" : "detail-loading";
      var inner = s.detailError
         ? '<i class="fas fa-triangle-exclamation"></i><h4>Detail ' + cfg.noun + " belum bisa dimuat</h4><p>" + grEsc(s.detailError) +
           '</p><button type="button" class="btn btn-outline btn-sm" data-gr-action="reload-detail">Coba lagi</button>'
         : '<i class="fas fa-spinner fa-spin"></i><h4>Memuat ' + cfg.noun + "...</h4>";
      el.innerHTML =
         '<div class="gr-detail-head">' + back + '<h2 class="gr-title">' + grEsc(s.openId) + "</h2></div>" +
         '<div class="card"><div class="empty-state gr-state">' + inner + "</div></div>";
      return;
   }

   var item = s.detail;
   var main = kind === "garansi" ? grClaimMain(item) : grFeedbackMain(item);
   el.dataset.grView = "detail";
   el.innerHTML =
      '<div class="gr-detail-head">' + back +
      '<h2 class="gr-title">' + grEsc(item[cfg.idKey]) + "</h2>" + grStatusChip(kind, item.status) +
      (kind === "garansi" ? grMarks(item) : "") +
      '<button type="button" class="btn btn-outline btn-sm gr-head-reload" data-gr-action="reload-detail"' + (s.detailLoading || s.saving ? " disabled" : "") + ">" +
      '<i class="fas fa-rotate' + (s.detailLoading ? " fa-spin" : "") + '"></i>Muat ulang</button>' +
      "</div>" +
      '<div class="gr-detail-grid">' +
      '<div class="gr-detail-main">' + main + "</div>" +
      '<div class="gr-detail-side">' + grStatusCard(kind, item) + grHistoryCard(kind, item) + "</div>" +
      "</div>";
   grSyncStatusForm(kind);
}

function grCard(title, bodyHtml) {
   return '<section class="card gr-card"><div class="gr-card-head"><h3>' + title + '</h3></div><div class="gr-card-body">' + bodyHtml + "</div></section>";
}

function grProductLink(prod) {
   var url = grSafeUrl(prod && prod.url);
   if (!url) return "";
   return ' <a class="gr-link-ext" href="' + grEsc(url) + '" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i>Halaman produk</a>';
}

function grClaimMain(c) {
   var cust = c.customer || {};
   var prod = c.product || {};
   var waChat = grWaLink(cust.whatsapp, "");
   var waHtml = grText(cust.whatsapp) +
      (waChat ? ' <a class="gr-link-ext" href="' + grEsc(waChat) + '" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i>Chat di WhatsApp</a>' : "");

   var prodHtml = grText(prod.name) + grProductLink(prod);

   var damage = Array.isArray(c.damage) && c.damage.length
      ? c.damage.map(function (d) { return '<span class="gr-kind">' + grEsc(grLabel(GR_DAMAGE, d)) + "</span>"; }).join(" ")
      : '<span class="gr-muted">Tidak dipilih</span>';

   var customer = grCard("Pembeli",
      '<dl class="gr-dl">' +
      grField("Nama", grText(cust.name)) +
      grField("WhatsApp", waHtml) +
      grField("Lokasi", grText(cust.location)) +
      "</dl>");
   var product = grCard("Produk",
      '<dl class="gr-dl">' +
      grField("Produk", prodHtml) +
      grField("Beli di", grEsc(grLabel(GR_CHANNEL, prod.channel))) +
      grField("Tanggal beli", grEsc(grFmtPlainDate(prod.purchaseDate)) + (c.outsidePeriod ? ' <span class="gr-mark gr-mark-warn">Lewat 6 bulan?</span>' : "")) +
      grField("No. pesanan", grText(prod.orderRef)) +
      grField("Lama pemakaian", grEsc(grLabel(GR_USAGE, prod.usage))) +
      "</dl>");
   var complaint = grCard("Keluhan",
      '<dl class="gr-dl">' +
      grField("Masuk", grEsc(grFmtDateTime(c.createdAt))) +
      grField("Kerusakan", damage) +
      "</dl>" +
      '<p class="gr-prewrap">' + grText(c.description) + "</p>");
   return customer + product + complaint + grPhotosCard(c);
}

function grPhotoList(c) {
   var list = Array.isArray(c.photos) ? c.photos : [];
   return list
      .map(function (p) {
         var full = grSafeUrl(p && p.viewUrl);
         var thumb = grSafeUrl(p && p.thumbUrl) || full;
         // downloadUrl is a private link that expires after an hour, so a copied "Tab baru" link stops working.
         var open = grSafeUrl(p && p.downloadUrl) || full;
         return full ? { full: full, thumb: thumb, open: open } : null;
      })
      .filter(Boolean);
}

function grPhotosCard(c) {
   var photos = grPhotoList(c);
   var grid = photos.length
      ? '<div class="gr-photos">' +
        photos.map(function (p, i) {
           return '<button type="button" class="gr-photo" data-gr-photo="' + i + '" aria-label="Lihat foto ' + (i + 1) + ' ukuran penuh">' +
              '<img src="' + grEsc(p.thumb) + '" alt="Foto bukti ' + (i + 1) + '" loading="lazy" referrerpolicy="no-referrer"></button>';
        }).join("") +
        "</div>"
      : c.photosUnavailable
        ? '<p class="gr-muted">Foto belum bisa ditampilkan karena pengaturan Cloudinary di inzta.id belum lengkap. Hubungi pengelola website.</p>'
        : '<p class="gr-muted">Foto belum tersedia.</p>';
   var video = c.videoViaWhatsApp
      ? '<p class="gr-video"><i class="fab fa-whatsapp"></i>Customer punya video kerusakan; video dikirim lewat WhatsApp admin, tidak diunggah.</p>'
      : "";
   return grCard("Foto bukti", grid + video);
}

function grFeedbackMain(f) {
   var contact = f.contact || {};
   var waChat = grWaLink(contact.whatsapp, "");
   var waHtml = waChat
      ? grEsc(contact.whatsapp) + ' <a class="gr-link-ext" href="' + grEsc(waChat) + '" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i>Chat di WhatsApp</a>'
      : '<span class="gr-muted">Tidak diisi</span>';
   var msg = grCard("Isi masukan",
      '<dl class="gr-dl">' +
      grField("Masuk", grEsc(grFmtDateTime(f.createdAt))) +
      grField("Jenis", '<span class="gr-kind">' + grEsc(grLabel(GR_FEEDBACK_KIND, f.kind)) + "</span>") +
      grField("Produk", grText(f.product && f.product.name) + grProductLink(f.product)) +
      "</dl>" +
      '<p class="gr-prewrap">' + grText(f.message) + "</p>");
   var who = grCard("Kontak",
      '<dl class="gr-dl">' +
      grField("Nama", contact.name ? grEsc(contact.name) : '<span class="gr-muted">Tanpa nama</span>') +
      grField("WhatsApp", waHtml) +
      "</dl>");
   return msg + who;
}

function grOptions(map, selected, placeholder) {
   var out = placeholder ? '<option value="">' + grEsc(placeholder) + "</option>" : "";
   Object.keys(map).forEach(function (k) {
      out += '<option value="' + grEsc(k) + '"' + (k === selected ? " selected" : "") + ">" + grEsc(map[k]) + "</option>";
   });
   return out;
}

function grNextStatuses(kind, item) {
   var labels = GR_KINDS[kind].statusLabels;
   if (!Array.isArray(item.allowedNext)) return GR_KINDS[kind].next[item.status] || [];
   return item.allowedNext
      .map(function (n) {
         return typeof n === "string" ? n : n && n.status;
      })
      .filter(function (st) {
         return grOwn(labels, st);
      });
}

// Mirrors requiredFieldsFor() in the website lib/warranty/rules.ts: 'note' means a public or an internal note.
function grRequires(kind, item, target) {
   if (!target || kind !== "garansi") return [];
   if (Array.isArray(item.allowedNext)) {
      var hit = item.allowedNext.filter(function (n) {
         return n && n.status === target && Array.isArray(n.requires);
      })[0];
      if (hit) return hit.requires.slice();
   }
   if (target === "waiting_customer") return ["publicNote"];
   if (target === "rejected") return ["rejectReason", "publicNote"];
   if (target === "resolved") return ["resolution", "publicNote"];
   if (target === "under_review" && (item.status === "resolved" || item.status === "rejected")) return ["note"];
   return [];
}

function grStatusCard(kind, item) {
   var cfg = GR_KINDS[kind];
   var s = gr[kind];
   var next = grNextStatuses(kind, item);
   var radios =
      '<label class="gr-choice"><input type="radio" name="grTarget" value="" checked><span>Tetap ' + grEsc(grLabel(cfg.statusLabels, item.status)) + "</span></label>" +
      next.map(function (st) {
         return '<label class="gr-choice"><input type="radio" name="grTarget" value="' + grEsc(st) + '"><span>' + grEsc(cfg.statusLabels[st]) + "</span></label>";
      }).join("");

   var fields = "";
   if (kind === "garansi") {
      var current =
         '<dl class="gr-dl gr-dl-compact">' +
         grField("Ditangani", grEsc(grLabel(GR_ASSIGNEE, item.assignee))) +
         (item.resolution ? grField("Penyelesaian", grEsc(grLabel(GR_RESOLUTION, item.resolution))) : "") +
         (item.rejectReason ? grField("Alasan ditolak", grEsc(grLabel(GR_REJECT_REASON, item.rejectReason))) : "") +
         grField("Catatan untuk customer", grText(item.publicNote)) +
         "</dl>";
      fields =
         current +
         '<div class="form-group" data-gr-need="resolution"><label for="' + kind + 'Resolution">Jenis penyelesaian <span class="gr-req">wajib</span></label>' +
         '<select id="' + kind + 'Resolution" class="form-input">' + grOptions(GR_RESOLUTION, "", "Pilih penyelesaian") + "</select></div>" +
         '<div class="form-group" data-gr-need="rejectReason"><label for="' + kind + 'RejectReason">Alasan ditolak <span class="gr-req">wajib</span></label>' +
         '<select id="' + kind + 'RejectReason" class="form-input">' + grOptions(GR_REJECT_REASON, "", "Pilih alasan") + "</select></div>" +
         '<div class="form-group"><label for="' + kind + 'Assignee">Ditangani oleh</label>' +
         '<select id="' + kind + 'Assignee" class="form-input">' + grOptions(GR_ASSIGNEE, item.assignee || "admin") + "</select>" +
         '<p class="gr-hint" data-gr-when="in_progress">Saat pindah ke In Progress, tiket otomatis ditugaskan ke Produksi.</p></div>' +
         '<div class="form-group"><label for="' + kind + 'PublicNote">Catatan baru untuk customer <span class="gr-req" data-gr-req-public hidden>wajib</span></label>' +
         '<textarea id="' + kind + 'PublicNote" class="form-input" rows="3" maxlength="' + GR_PUBLIC_NOTE_MAX + '" placeholder="Terlihat oleh customer lewat pesan WhatsApp"></textarea>' +
         '<p class="gr-hint" data-gr-when="waiting_customer">Tulis apa yang dibutuhkan dari customer.</p></div>';
   }
   // Claims keep internal notes as history entries (append); feedback keeps one internalNote field that PATCH replaces.
   var internalLabel = kind === "garansi" ? "Catatan internal baru" : "Catatan internal";
   fields +=
      '<div class="form-group"><label for="' + kind + 'InternalNote">' + internalLabel + "</label>" +
      '<textarea id="' + kind + 'InternalNote" class="form-input" rows="' + (kind === "garansi" ? 2 : 4) + '" maxlength="' + GR_INTERNAL_NOTE_MAX +
      '" placeholder="Hanya terlihat oleh staf ERP">' + (kind === "masukan" ? grEsc(item.internalNote || "") : "") + "</textarea></div>";

   var saved = "";
   if (s.justSaved) {
      saved = '<div class="gr-saved" role="status"><i class="fas fa-circle-check"></i>' + GR_MSG.saved + "</div>";
   }
   var wa = "";
   if (kind === "garansi") {
      // No template for "new", so no button: an empty chat would invite a message nobody reviewed.
      var serverWa = grSafeUrl(item.customerWaLink);
      var waText = grWaTemplate(item);
      var waUrl = /^https:\/\/wa\.me\/\d{8,15}(\?|$)/.test(serverWa)
         ? serverWa
         : item.customerWaLink === undefined && waText
           ? grWaLink(item.customer && item.customer.whatsapp, waText)
           : "";
      if (waUrl) {
         wa = '<a class="btn ' + (s.justSaved ? "btn-primary" : "btn-outline") + ' btn-sm gr-wa" id="' + kind + 'WaNotify" href="' + grEsc(waUrl) +
            '" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i>Kabari customer di WhatsApp</a>' +
            '<p class="gr-hint">Pesan disiapkan dari status saat ini; dikirim sendiri oleh staf.</p>';
      }
   }

   return grCard("Status",
      saved +
      '<form class="gr-status-form" data-gr-form novalidate>' +
      '<fieldset class="gr-choices"><legend>Ubah status</legend>' + radios + "</fieldset>" +
      fields +
      '<p class="gr-form-error" role="alert" data-gr-error hidden></p>' +
      '<button type="submit" class="btn btn-primary btn-sm gr-save"' + (s.saving ? " disabled" : "") + ">" +
      (s.saving ? '<i class="fas fa-spinner fa-spin"></i>Menyimpan...' : '<i class="fas fa-floppy-disk"></i>Simpan') + "</button>" +
      "</form>" + wa);
}

function grHistoryCard(kind, item) {
   var cfg = GR_KINDS[kind];
   var list = Array.isArray(item.history) ? item.history.slice() : [];
   list.sort(function (a, b) {
      var ta = grParseDate(a && a.at);
      var tb = grParseDate(b && b.at);
      return (tb ? tb.getTime() : 0) - (ta ? ta.getTime() : 0);
   });
   if (!list.length) return grCard("Riwayat", '<p class="gr-muted">Belum ada riwayat.</p>');
   var rows = list
      .map(function (h) {
         h = h || {};
         var who = h.by === "customer" ? "Customer" : h.by || "-";
         var parts = [];
         if (h.to) {
            parts.push(
               '<div class="gr-tl-move">' +
                  (h.from ? grEsc(grLabel(cfg.statusLabels, h.from)) + ' <i class="fas fa-arrow-right"></i> ' : "") +
                  grEsc(grLabel(cfg.statusLabels, h.to)) +
                  "</div>",
            );
         }
         if (h.assignee) parts.push('<div class="gr-tl-line">Ditugaskan ke ' + grEsc(grLabel(GR_ASSIGNEE, h.assignee)) + "</div>");
         if (h.resolution) parts.push('<div class="gr-tl-line">Penyelesaian: ' + grEsc(grLabel(GR_RESOLUTION, h.resolution)) + "</div>");
         if (h.rejectReason) parts.push('<div class="gr-tl-line">Alasan: ' + grEsc(grLabel(GR_REJECT_REASON, h.rejectReason)) + "</div>");
         if (h.publicNote) parts.push('<div class="gr-tl-note"><span class="gr-tl-tag">Untuk customer</span><span class="gr-prewrap">' + grEsc(h.publicNote) + "</span></div>");
         if (h.internalNote) parts.push('<div class="gr-tl-note gr-tl-internal"><span class="gr-tl-tag">Internal</span><span class="gr-prewrap">' + grEsc(h.internalNote) + "</span></div>");
         return (
            '<li class="gr-tl-item"><div class="gr-tl-meta"><span>' + grEsc(grFmtDateTime(h.at)) + "</span><span>" + grEsc(who) + "</span></div>" +
            parts.join("") + "</li>"
         );
      })
      .join("");
   return grCard("Riwayat", '<ol class="gr-timeline">' + rows + "</ol>");
}

function grSelectedTarget(form) {
   var checked = form.querySelector('input[name="grTarget"]:checked');
   return checked ? checked.value : "";
}

// Shows only the inputs the chosen next status needs (requirement 6.3) without rebuilding the form.
function grSyncStatusForm(kind) {
   var page = grPage(kind);
   var form = page && page.querySelector("[data-gr-form]");
   var item = gr[kind].detail;
   if (!form || !item) return;
   var target = grSelectedTarget(form);
   form.querySelectorAll("[data-gr-when]").forEach(function (node) {
      node.hidden = node.getAttribute("data-gr-when") !== target;
   });
   var requires = grRequires(kind, item, target);
   form.querySelectorAll("[data-gr-need]").forEach(function (node) {
      node.hidden = requires.indexOf(node.getAttribute("data-gr-need")) === -1;
   });
   var publicReq = form.querySelector("[data-gr-req-public]");
   if (publicReq) publicReq.hidden = requires.indexOf("publicNote") === -1;
   var reopenHint = form.querySelector("[data-gr-reopen]");
   if (reopenHint) reopenHint.remove();
   if (requires.indexOf("note") !== -1) {
      var p = document.createElement("p");
      p.className = "gr-hint gr-hint-strong";
      p.setAttribute("data-gr-reopen", "");
      p.textContent = "Membuka kembali tiket wajib disertai catatan (untuk customer atau internal).";
      form.querySelector(".gr-choices").after(p);
   }
   var assignee = form.querySelector("#" + kind + "Assignee");
   if (assignee) {
      // The lock to Produksi is only a preview of what the server does on in_progress; leaving that target
      // must give back the staff member's own choice, or the save would silently reassign the ticket.
      if (target === "in_progress") {
         if (!assignee.disabled) assignee.dataset.grChoice = assignee.value;
         assignee.value = "produksi";
         assignee.disabled = true;
      } else if (assignee.disabled) {
         assignee.value = assignee.dataset.grChoice || item.assignee || "admin";
         assignee.disabled = false;
      }
   }
}

function grFormError(form, message) {
   var box = form.querySelector("[data-gr-error]");
   if (!box) return;
   box.textContent = message || "";
   box.hidden = !message;
}

function grBuildPatch(kind, form) {
   var item = gr[kind].detail;
   var target = grSelectedTarget(form);
   var internalNote = (form.querySelector("#" + kind + "InternalNote").value || "").trim();
   var body = { expectedUpdatedAt: item.updatedAt };
   if (target) body.status = target;

   if (kind === "masukan") {
      var noteChanged = internalNote !== String(item.internalNote || "").trim();
      if (noteChanged) body.internalNote = internalNote;
      if (!target && !noteChanged) return { error: GR_MSG.noChange };
      return { body: body };
   }

   if (internalNote) body.internalNote = internalNote;

   var publicNote = (form.querySelector("#" + kind + "PublicNote").value || "").trim();
   var assigneeEl = form.querySelector("#" + kind + "Assignee");
   var assignee = assigneeEl ? assigneeEl.value : "";
   if (publicNote) body.publicNote = publicNote;
   // The server assigns produksi itself on in_progress (requirement 6.6), so the locked select is not sent.
   if (target !== "in_progress" && assignee && grOwn(GR_ASSIGNEE, assignee) && assignee !== (item.assignee || "admin")) {
      body.assignee = assignee;
   }
   var requires = grRequires(kind, item, target);
   if (requires.indexOf("resolution") !== -1) {
      var resolution = form.querySelector("#" + kind + "Resolution").value;
      if (!resolution) return { error: "Pilih jenis penyelesaian.", focus: "#" + kind + "Resolution" };
      body.resolution = resolution;
   }
   if (requires.indexOf("rejectReason") !== -1) {
      var reason = form.querySelector("#" + kind + "RejectReason").value;
      if (!reason) return { error: "Pilih alasan klaim ditolak.", focus: "#" + kind + "RejectReason" };
      body.rejectReason = reason;
   }
   if (requires.indexOf("publicNote") !== -1 && !publicNote) {
      var need = target === "waiting_customer" ? "Tulis apa yang dibutuhkan dari customer." : "Catatan untuk customer wajib diisi.";
      return { error: need, focus: "#" + kind + "PublicNote" };
   }
   if (requires.indexOf("note") !== -1 && !publicNote && !internalNote) {
      return { error: "Tulis catatan alasan tiket dibuka kembali.", focus: "#" + kind + "InternalNote" };
   }
   if (!target && !publicNote && !internalNote && !body.assignee) return { error: GR_MSG.noChange };
   return { body: body };
}

function grCaptureDraft(kind) {
   var page = grPage(kind);
   if (!page) return null;
   var pub = page.querySelector("#" + kind + "PublicNote");
   var internal = page.querySelector("#" + kind + "InternalNote");
   return { publicNote: pub ? pub.value : "", internalNote: internal ? internal.value : "" };
}

function grRestoreDraft(kind, draft) {
   var page = grPage(kind);
   if (!page || !draft) return;
   var pub = page.querySelector("#" + kind + "PublicNote");
   var internal = page.querySelector("#" + kind + "InternalNote");
   if (pub && typeof draft.publicNote === "string") pub.value = draft.publicNote;
   if (internal && typeof draft.internalNote === "string") internal.value = draft.internalNote;
}

async function grSave(kind, form) {
   var cfg = GR_KINDS[kind];
   var s = gr[kind];
   if (s.saving || !s.detail) return;
   var built = grBuildPatch(kind, form);
   if (built.error) {
      grFormError(form, built.error);
      var f = built.focus && form.querySelector(built.focus);
      if (f) f.focus();
      return;
   }
   grFormError(form, "");
   var before = s.detail;
   var savedId = before[cfg.idKey];
   var draft = grCaptureDraft(kind);
   var stillHere = function () {
      return s.view === "detail" && s.openId === savedId;
   };
   s.saving = true;
   grSetSaving(form, true);
   try {
      var data = await warrantyApi(cfg.path + "/" + encodeURIComponent(before[cfg.idKey]), {
         method: "PATCH",
         body: built.body,
         conflictMsg: cfg.conflictMsg,
      });
      var updated = data[cfg.itemKey];
      s.saving = false;
      if (!stillHere()) {
         if (updated && updated[cfg.idKey] === savedId) {
            grAdjustNewCount(kind, before.status, updated.status);
            grSyncListItem(kind, updated);
            if (s.view === "list") grRenderList(kind);
         }
         toast(GR_MSG.saved, "success");
         return;
      }
      if (!updated || updated[cfg.idKey] !== savedId) {
         // The save went through but the reply has no ticket; reload it instead of guessing the new state.
         s.justSaved = true;
         toast(GR_MSG.saved, "success");
         grLoadDetail(kind, null);
         return;
      }
      grAdjustNewCount(kind, before.status, updated.status);
      s.detail = updated;
      s.justSaved = true;
      grSyncListItem(kind, updated);
      toast(GR_MSG.saved, "success");
      grRenderDetail(kind);
      var wa = document.getElementById(kind + "WaNotify");
      if (wa && built.body.status) wa.focus();
   } catch (e) {
      s.saving = false;
      // The user already left this ticket: never reload or restore its notes into another one.
      if (!stillHere()) {
         if (e.status === 409 || e.status === 401 || e.status === 403) toast(e.message, "error");
         return;
      }
      if (e.status === 409) {
         // STALE and TRANSITION both mean the loaded ticket is out of date; e.message is a fixed string either way.
         toast(e.message, "error");
         s.justSaved = false;
         await grLoadDetail(kind, draft);
         var again = grPage(kind) && grPage(kind).querySelector("[data-gr-form]");
         if (again) grFormError(again, e.message + " Data terbaru sudah dimuat; catatan Anda tidak hilang.");
         return;
      }
      grSetSaving(form, false);
      var fieldText = e.fields
         ? Object.keys(e.fields)
              .map(function (k) {
                 return String(e.fields[k]);
              })
              .join(" ")
         : "";
      var detail = fieldText || e.detail;
      grFormError(form, e.message + (detail ? " " + detail.slice(0, 400) : ""));
      if (e.status === 401 || e.status === 403) toast(e.message, "error");
   }
}

function grSetSaving(form, saving) {
   var page = form.closest(".page");
   var reload = page && page.querySelector('[data-gr-action="reload-detail"]');
   if (reload) reload.disabled = saving;
   var btn = form.querySelector(".gr-save");
   if (!btn) return;
   btn.disabled = saving;
   btn.innerHTML = saving ? '<i class="fas fa-spinner fa-spin"></i>Menyimpan...' : '<i class="fas fa-floppy-disk"></i>Simpan';
}

// Updates the sidebar count locally after a save, so a status change costs no extra summary read.
function grAdjustNewCount(kind, from, to) {
   if (from === to) return;
   var key = kind === "garansi" ? "newCount" : "newFeedbackCount";
   var n = gr.badge[key];
   if (typeof n !== "number") return;
   if (from === "new") n -= 1;
   if (to === "new") n += 1;
   gr.badge[key] = Math.max(0, n);
   grApplyBadges();
}

function grSetBadge(id, count) {
   var el = document.getElementById(id);
   if (!el) return;
   if (typeof count === "number" && count > 0) {
      el.textContent = count > 99 ? "99+" : String(count);
      el.setAttribute("aria-label", count + " baru");
      el.style.display = "";
   } else {
      el.textContent = "";
      el.removeAttribute("aria-label");
      el.style.display = "none";
   }
}

function grApplyBadges() {
   grSetBadge("garansiBadge", gr.badge.newCount);
   grSetBadge("masukanBadge", gr.badge.newFeedbackCount);
}

// Requirement 5.5: summary at login and on page changes, at most every 2 minutes, never while the tab is hidden.
function refreshWarrantyBadge(force) {
   var b = gr.badge;
   if (!grCanUse()) {
      b.newCount = null;
      b.newFeedbackCount = null;
      grApplyBadges();
      return;
   }
   if (document.hidden || b.inflight) return;
   if (!force && Date.now() - b.lastAt < GR_BADGE_MIN_MS) return;
   b.lastAt = Date.now();
   b.inflight = true;
   warrantyApi("/api/erp/garansi/ringkasan")
      .then(function (data) {
         b.newCount = typeof data.newCount === "number" ? data.newCount : null;
         b.newFeedbackCount = typeof data.newFeedbackCount === "number" ? data.newFeedbackCount : null;
      })
      .catch(function (e) {
         console.warn("[Garansi] ringkasan gagal:", e.status || 0);
         if (e.status === 401 || e.status === 403) {
            b.newCount = null;
            b.newFeedbackCount = null;
         }
      })
      .then(function () {
         b.inflight = false;
         grApplyBadges();
      });
}

function warrantyCleanup() {
   gr = grInitialState();
   grApplyBadges();
   grCloseLightbox();
   ["garansi", "masukan"].forEach(function (kind) {
      var el = grPage(kind);
      if (el) {
         el.innerHTML = "";
         delete el.dataset.grView;
      }
   });
}

function grOpenLightbox(kind, index) {
   var item = gr[kind].detail;
   if (!item) return;
   var photos = grPhotoList(item);
   if (!photos.length) return;
   var i = Math.max(0, Math.min(index, photos.length - 1));
   grCloseLightbox();
   var opener = document.activeElement;
   var box = document.createElement("div");
   box.className = "gr-lightbox";
   box.id = "grLightbox";
   box.setAttribute("role", "dialog");
   box.setAttribute("aria-modal", "true");
   box.setAttribute("aria-label", "Foto bukti ukuran penuh");
   box.innerHTML =
      '<div class="gr-lb-bar"><span class="gr-lb-count"></span>' +
      '<a class="gr-lb-btn gr-lb-open" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i>Tab baru</a>' +
      '<button type="button" class="gr-lb-btn" data-lb="prev" aria-label="Foto sebelumnya"><i class="fas fa-chevron-left"></i></button>' +
      '<button type="button" class="gr-lb-btn" data-lb="next" aria-label="Foto berikutnya"><i class="fas fa-chevron-right"></i></button>' +
      '<button type="button" class="gr-lb-btn" data-lb="close" aria-label="Tutup"><i class="fas fa-xmark"></i></button></div>' +
      '<div class="gr-lb-stage"><img alt="" referrerpolicy="no-referrer"></div>';
   var img = box.querySelector("img");
   var openLink = box.querySelector(".gr-lb-open");
   var count = box.querySelector(".gr-lb-count");
   function show() {
      img.src = photos[i].full;
      img.alt = "Foto bukti " + (i + 1) + " dari " + photos.length;
      openLink.href = photos[i].open;
      count.textContent = i + 1 + " / " + photos.length;
      box.querySelectorAll('[data-lb="prev"],[data-lb="next"]').forEach(function (b) {
         b.hidden = photos.length < 2;
      });
   }
   function step(d) {
      i = (i + d + photos.length) % photos.length;
      show();
   }
   box.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-lb]");
      if (btn) {
         var a = btn.getAttribute("data-lb");
         if (a === "close") grCloseLightbox();
         else step(a === "next" ? 1 : -1);
         return;
      }
      if (e.target === box || e.target.classList.contains("gr-lb-stage")) grCloseLightbox();
   });
   box._grKey = function (e) {
      if (e.key === "Escape") grCloseLightbox();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
   };
   box._grOpener = opener;
   document.addEventListener("keydown", box._grKey);
   document.body.appendChild(box);
   show();
   box.querySelector('[data-lb="close"]').focus();
}

function grCloseLightbox() {
   var box = document.getElementById("grLightbox");
   if (!box) return;
   document.removeEventListener("keydown", box._grKey);
   var opener = box._grOpener;
   box.remove();
   if (opener && opener.focus && document.body.contains(opener)) opener.focus();
}

function grBindPage(kind) {
   var el = grPage(kind);
   if (!el || el.dataset.grBound) return;
   el.dataset.grBound = "1";
   el.addEventListener("click", function (e) {
      var t = e.target;
      if (t.closest("a")) return;
      var action = t.closest("[data-gr-action]");
      if (action) {
         var a = action.getAttribute("data-gr-action");
         if (a === "reload") grLoadList(kind);
         else if (a === "back") grBackToList(kind);
         else if (a === "reload-detail") grLoadDetail(kind, grCaptureDraft(kind));
         return;
      }
      var photo = t.closest("[data-gr-photo]");
      if (photo) {
         grOpenLightbox(kind, parseInt(photo.getAttribute("data-gr-photo"), 10) || 0);
         return;
      }
      var open = t.closest("[data-gr-open]");
      if (open) grOpenDetail(kind, open.getAttribute("data-gr-open"));
   });
   el.addEventListener("change", function (e) {
      if (e.target.matches("[data-gr-filter]")) {
         var value = e.target.value;
         var allowed = GR_KINDS[kind].filters.some(function (f) {
            return f.value === value;
         });
         if (!allowed) return;
         gr[kind].filter = value;
         gr[kind].loaded = false;
         gr[kind].items = [];
         grLoadList(kind);
      } else if (e.target.name === "grTarget") {
         grSyncStatusForm(kind);
         var form = e.target.closest("[data-gr-form]");
         if (form) grFormError(form, "");
      }
   });
   el.addEventListener("submit", function (e) {
      var form = e.target.closest("[data-gr-form]");
      if (!form) return;
      e.preventDefault();
      grSave(kind, form);
   });
}

grBindPage("garansi");
grBindPage("masukan");

document.addEventListener("visibilitychange", function () {
   if (!document.hidden && typeof state !== "undefined" && state.user) refreshWarrantyBadge(false);
});

// The runtime may have signed in before this file finished loading; catch up with the menu, page and badge.
if (typeof state !== "undefined" && state.user) {
   updateNavigationAccess();
   if (state.currentPage === "garansi" || state.currentPage === "masukan") warrantyOnNavigate(state.currentPage);
   else refreshWarrantyBadge(false);
}
