/* =========================================================
   INZTAMOTO ERP — APPLICATION LOGIC
   Firebase (auto field) + Cloudinary (upload gambar)
   ========================================================= */

// ============================================
// 1. MASUKKAN KONFIGURASI FIREBASE ANDA DI SINI
// ============================================
const firebaseConfig = window.__INZTAMOTO_ENV__?.firebase || {
   apiKey: "",
   authDomain: "",
   projectId: "",
   storageBucket: "",
   messagingSenderId: "",
   appId: "",
};

// ============================================
// 2. MASUKKAN KONFIGURASI CLOUDINARY ANDA DI SINI
// ============================================
const CLOUDINARY_CLOUD_NAME =
   window.__INZTAMOTO_ENV__?.cloudinary?.cloudName || "";
const CLOUDINARY_UPLOAD_PRESET =
   window.__INZTAMOTO_ENV__?.cloudinary?.uploadPreset || "";

/* =========================================================
   INISIALISASI FIREBASE
   ========================================================= */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* =========================================================
   FLAG MENCEGAH DOBLE INIT
   ========================================================= */
let appInitialized = false;
let logoutToastPending = false;

/* =========================================================
   KONSTANTA
   ========================================================= */
const SKU_MAP = {
   "Tail Bag": "INZ-TAIL",
   "Side Bag": "INZ-SIDE",
   "Duffel Bag": "INZ-DUFF",
   "Tank Bag": "INZ-TANK",
   "Tool Bag": "INZ-TOOL",
   "Dry Bag": "INZ-DRY",
   "Pannier Bag": "INZ-PAN",
   Accessories: "INZ-ACC",
};

const CHANNELS = [
   "Website",
   "Shopee",
   "Tokopedia",
   "Reseller",
   "Offline Store",
];

const EXPEDITIONS = [
   "Shopee Express",
   "J&T",
   "JNE",
   "SiCepat",
   "Anteraja",
   "Ninja",
   "POS",
   "Lainnya",
];

const SEED_CATEGORIES = [
   {
      name: "Tail Bag",
      slug: "tail-bag",
      description: "Tas bagasi belakang motor",
   },
   { name: "Side Bag", slug: "side-bag", description: "Tas samping motor" },
   {
      name: "Duffel Bag",
      slug: "duffel-bag",
      description: "Tas duffel untuk touring",
   },
];

const SEED_PRODUCTS = [
   {
      name: "Tail Bag Urban X1",
      categoryName: "Tail Bag",
      description: "Tail bag premium untuk harian",
      costPrice: 85000,
      sellingPrice: 165000,
      stock: 45,
      status: "active",
      featured: true,
   },
   {
      name: "Side Bag Navigator",
      categoryName: "Side Bag",
      description: "Side bag waterproof dengan buckle premium",
      costPrice: 95000,
      sellingPrice: 195000,
      stock: 32,
      status: "active",
      featured: true,
   },
   {
      name: "Duffel Bag Expedition 40L",
      categoryName: "Duffel Bag",
      description: "Duffel bag 40L tahan air",
      costPrice: 150000,
      sellingPrice: 295000,
      stock: 18,
      status: "active",
      featured: true,
   },
];

const DEMO_USERS = [
   {
      name: "Rizky InztaMoto",
      email: "admin@inztamoto.com",
      role: "Owner",
      status: "Aktif",
   },
   {
      name: "Sari Admin",
      email: "sari@inztamoto.com",
      role: "Admin",
      status: "Aktif",
   },
   {
      name: "Budi Warehouse",
      email: "budi@inztamoto.com",
      role: "Warehouse",
      status: "Aktif",
   },
];

/* =========================================================
   STATE MANAGEMENT
   ========================================================= */
const state = {
   user: null,
   products: [],
   categories: [],
   sales: [],
   production: [],
   stockMovements: [],
   productionPurchases: [],
   payrolls: [],
   salaryProduksi: [],
   sponsorships: [],
   resellers: [],
   users: [],
   currentPage: "dashboard",
   prod: {
      search: "",
      filter: "all",
      catFilter: "all",
      sort: { field: "sku", dir: "asc" },
      page: 1,
      perPage: 8,
   },
   prodOrder: {
      search: "",
      filter: "all",
      page: 1,
      perPage: 8,
      dateFilter: "",
   },
   sale: {
      search: "",
      channel: "all",
      month: "all",
      year: "all",
      resellerId: "all",
      date: new Date().toISOString().split("T")[0],
      page: 1,
      perPage: 8,
   },
   reseller: {
      search: "",
      page: 1,
      perPage: 10,
   },
   investor: {
      agreement: null,
      agreementLoaded: false,
      payments: [],
      paymentsLoaded: false,
      listening: false,
      error: "",
      usageMonth: "",
      usagePage: 1,
      paymentsPage: 1,
      perPage: 10,
   },
   pp: { search: "", week: "", status: "all", month: "all", date: new Date().toISOString().split("T")[0], page: 1, perPage: 10 },
   payroll: { search: "", period: "", status: "all", page: 1, perPage: 10 },
   salaryProd: { search: "", month: "all", year: "all", page: 1, perPage: 8 },
   spons: { search: "", month: "all", year: "all", page: 1, perPage: 8 },
   stockHistory: { search: "", filter: "bulan_ini", page: 1, perPage: 15 },
   report: { period: "monthly", date: new Date().toISOString().split("T")[0], month: "all", year: String(new Date().getFullYear()) },
   charts: {},
   tempImageData: null,
   salesTrend: {
      range: "daily",
      date: new Date().toISOString().split("T")[0],
      month: String(new Date().getMonth() + 1).padStart(2, "0"),
      year: String(new Date().getFullYear()),
   },
   revCostTrend: {
      range: "monthly",
      date: new Date().toISOString().split("T")[0],
      month: String(new Date().getMonth() + 1).padStart(2, "0"),
      year: String(new Date().getFullYear()),
   },
   productionTrend: {
      range: "monthly",
      date: new Date().toISOString().split("T")[0],
      month: String(new Date().getMonth() + 1).padStart(2, "0"),
      year: String(new Date().getFullYear()),
   },
   listeners: [],
};

/* =========================================================
   UTILITAS
   ========================================================= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const today = new Date().toISOString().split("T")[0];
const getYesterdayDateStr = () => {
   const d = new Date();
   d.setDate(d.getDate() - 1);
   return d.toISOString().split("T")[0];
};
const formatDateIndo = (dateStr) => {
   if (!dateStr || dateStr === "all") return "Semua Tanggal";
   const parts = dateStr.split("-");
   if (parts.length !== 3) return dateStr;
   const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
   const mIdx = parseInt(parts[1], 10) - 1;
   return `${parseInt(parts[2], 10)} ${months[mIdx] || parts[1]} ${parts[0]}`;
};
const fmt = (n) => (n || 0).toLocaleString("id-ID");
const fmtRp = (n) => "Rp " + (n || 0).toLocaleString("id-ID");
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const calcProfit = (sp, cp) => (sp || 0) - (cp || 0);
const calcMargin = (sp, cp) =>
   sp > 0 ? Math.round(((sp - cp) / sp) * 100) : 0;
const getCatName = (id) => {
   const c = state.categories.find((x) => x.id === id);
   return c ? c.name : "-";
};
const findProduct = (id, name) =>
   state.products.find((x) => x.id === id) ||
   (name ? state.products.find((x) => x.name === name) : null);

const renderPaginationHTML = (currentPage, totalPages, onClickFuncName) => {
   let pag = `<button ${currentPage <= 1 ? "disabled" : ""} onclick="${onClickFuncName}(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
   for (let i = 1; i <= totalPages; i++) {
      if (
         totalPages > 7 &&
         i > 2 &&
         i < totalPages - 1 &&
         Math.abs(i - currentPage) > 1
      ) {
         if (i === 3 || i === totalPages - 2) {
            pag += "<button disabled>...</button>";
         }
         continue;
      }
      pag += `<button class="${i === currentPage ? "active" : ""}" onclick="${onClickFuncName}(${i})">${i}</button>`;
   }
   pag += `<button ${currentPage >= totalPages ? "disabled" : ""} onclick="${onClickFuncName}(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
   return pag;
};

/* parsePrice — konversi input harga ke angka bersih
   "250000"     -> 250000
   "Rp 250.000" -> 250000
   ""           -> 0  */
function parsePrice(val) {
   if (val === null || val === undefined) return 0;
   return parseInt(String(val).replace(/[^0-9]/g, ""), 10) || 0;
}

/* Format angka ke format Rupiah saat diketik (1200000 → 1.200.000).
   Digunakan pada input type="text" dengan oninput="formatRpInput(this)".
   parsePrice() sudah bisa membaca nilai berformat ini saat save. */
window.formatRpInput = function (el) {
   var digits = el.value.replace(/[^0-9]/g, "");
   if (!digits) {
      el.value = "";
      return;
   }
   // Simpan posisi kursor agar tidak loncat ke akhir
   var cursorFromEnd = el.value.length - (el.selectionEnd || el.value.length);
   var formatted = parseInt(digits, 10).toLocaleString("id-ID");
   el.value = formatted;
   // Kembalikan posisi kursor
   var newPos = formatted.length - cursorFromEnd;
   try {
      el.setSelectionRange(newPos, newPos);
   } catch (e) {}
};

/* Hapus semua undefined/null secara rekursif — aman untuk Firestore */
function sanitize(obj) {
   if (obj === null || obj === undefined) return "";
   if (typeof obj !== "object") return obj;
   if (Array.isArray(obj)) {
      return obj
         .map((item) => sanitize(item))
         .filter((item) => item !== undefined && item !== null);
   }
   const clean = {};
   for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined && val !== null) {
         clean[key] = sanitize(val);
      }
   }
   return clean;
}

function getCategorySkuCode(cat) {
   if (!cat) return "XX";
   if (cat.skuCode && cat.skuCode.trim()) {
      return cat.skuCode.trim().toUpperCase().slice(0, 2);
   }
   // Fallback dari nama: ambil inisial 2 kata pertama
   const words = cat.name.trim().split(/\s+/);
   if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
   return cat.name.slice(0, 2).toUpperCase();
}

function generateSKU(categoryId, excludeProductId) {
   const cat = state.categories.find((c) => c.id === categoryId);
   if (!cat) return "INZ-XX-01";

   // Priority: skuCode field → SKU_MAP lama → generate dari nama
   var prefix;
   if (cat.skuCode && cat.skuCode.trim()) {
      prefix = "INZ-" + cat.skuCode.trim().toUpperCase().slice(0, 2);
   } else if (SKU_MAP[cat.name]) {
      prefix = SKU_MAP[cat.name];
   } else {
      prefix = "INZ-" + getCategorySkuCode(cat);
   }

   // Cari sequence tertinggi yang pernah dipakai (termasuk produk yang sudah dihapus tidak dicek,
   // tapi produk aktif dijadikan batas bawah). Pakai max + 1 agar SKU tidak pernah reuse.
   var max = 0;
   state.products.forEach(function (p) {
      if (excludeProductId && p.id === excludeProductId) return;
      if (p.sku && p.sku.startsWith(prefix + "-")) {
         var parts = p.sku.split("-");
         var num = parseInt(parts[parts.length - 1]);
         if (!isNaN(num) && num > max) max = num;
      }
   });

   // max + 1: monotonic, SKU gaps are acceptable, prevents SKU reuse after delete
   return prefix + "-" + String(max + 1).padStart(2, "0");
}

function isSkuUnique(sku, excludeProductId) {
   return !state.products.some(function (p) {
      if (excludeProductId && p.id === excludeProductId) return false;
      return p.sku === sku;
   });
}

function prodImg(p, size = 40) {
   if (p && p.images && p.images.length > 0 && p.images[0].imageUrl) {
      return `<img src="${p.images[0].imageUrl}" alt="${p.name || ""}" class="prod-thumb" style="width:${size}px;height:${size}px">`;
   }
   return `<div class="prod-thumb-placeholder" style="width:${size}px;height:${size}px"><i class="fas fa-image"></i></div>`;
}

/* =========================================================
   TOAST & MODAL
   ========================================================= */
function toast(msg, type = "success") {
   const c = $("#toastContainer");
   const icons = {
      success: "fa-circle-check",
      error: "fa-circle-xmark",
      warning: "fa-triangle-exclamation",
   };
   const el = document.createElement("div");
   el.className = `toast ${type}`;
   el.innerHTML = `<i class="fas ${icons[type] || icons.success}"></i><span>${msg}</span>`;
   c.appendChild(el);
   setTimeout(() => {
      el.classList.add("removing");
      setTimeout(() => el.remove(), 300);
   }, 3000);
}

function openModal(title, body, footer = "") {
   $("#modalTitle").textContent = title;
   $("#modalBody").innerHTML = body;
   $("#modalFooter").innerHTML = footer;
   $("#modalOverlay").classList.add("show");
}

function closeModal() {
   $("#modalOverlay").classList.remove("show");
}
$("#modalClose").onclick = closeModal;
$("#modalOverlay").addEventListener("click", (e) => {
   if (e.target === $("#modalOverlay")) closeModal();
});
document.addEventListener("keydown", (e) => {
   if (e.key === "Escape") closeModal();
});

/* =========================================================
   CLOUDINARY — Upload langsung via API
   ========================================================= */
async function handleImageUpload(input) {
   const file = input.files[0];
   if (!file) return;

   const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
   if (!allowedTypes.includes(file.type)) {
      toast("Format gambar harus JPG, PNG, atau WebP", "warning");
      input.value = "";
      return;
   }
   if (file.size > 10 * 1024 * 1024) {
      toast("Ukuran gambar maksimal 10MB", "warning");
      input.value = "";
      return;
   }

   const formData = new FormData();
   formData.append("file", file);
   formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
   formData.append("folder", "inztamoto/products");

   const preview = $("#imagePreview");
   if (preview) {
      preview.innerHTML = `<div style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin" style="font-size:24px;color:var(--primary)"></i><p style="margin-top:8px;font-size:13px;color:var(--text-muted)">Mengupload & mengompres gambar...</p></div>`;
   }

   try {
      const res = await fetch(
         `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
         { method: "POST", body: formData },
      );
      const data = await res.json();

      if (data.error) {
         toast("Upload gagal: " + data.error.message, "error");
         if (preview) preview.innerHTML = "";
         input.value = "";
         return;
      }

      state.tempImageData = {
         publicId: data.public_id,
         imageUrl: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/q_auto,f_auto,w_800/${data.public_id}`,
         ...(data.delete_token ? { deleteToken: data.delete_token } : {}),
      };

      if (preview) {
         preview.innerHTML = `
        <img src="${state.tempImageData.imageUrl}" alt="Preview" style="max-width:100%;max-height:200px;border-radius:8px;object-fit:contain;margin-bottom:10px">
        <p style="font-size:11px;color:var(--success);margin-bottom:8px"><i class="fas fa-check-circle"></i> Gambar terkompres & dioptimasi otomatis oleh Cloudinary</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="removeImage()"><i class="fas fa-trash"></i> Hapus Gambar</button>`;
      }
      toast("Gambar berhasil diupload", "success");
   } catch (err) {
      toast("Gagal upload: " + err.message, "error");
      if (preview) preview.innerHTML = "";
      input.value = "";
   }
}

window.removeImage = function () {
   state.tempImageData = null;
   const preview = $("#imagePreview");
   if (preview) preview.innerHTML = "";
   const fileInput = document.getElementById("fImageFile");
   if (fileInput) fileInput.value = "";
};

async function deleteCloudinaryImage(images) {
   if (!images || !images.length) return;
   for (const img of images) {
      if (!img.deleteToken) continue;
      try {
         await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
            {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ delete_token: img.deleteToken }),
            },
         );
         console.log("Gambar dihapus dari Cloudinary:", img.publicId);
      } catch (e) {
         console.warn("Gagal hapus gambar dari Cloudinary:", img.publicId, e);
      }
   }
}

/* =========================================================
   BADGES
   ========================================================= */
function statusBadge(s) {
   const m = {
      active: "badge-active",
      in_production: "badge-in_production",
      pre_order: "badge-pre_order",
      low_stock: "badge-low_stock",
      out_of_stock: "badge-out_of_stock",
      inactive: "badge-inactive",
   };
   const l = {
      active: "Aktif",
      in_production: "Dalam Produksi",
      pre_order: "Pre Order",
      low_stock: "Stok Rendah",
      out_of_stock: "Habis",
      inactive: "Nonaktif",
   };
   return `<span class="badge ${m[s] || "badge-inactive"}">${l[s] || s}</span>`;
}

function prodStatusBadge(s) {
   const m = {
      pending: "badge-pending",
      in_progress: "badge-in_progress",
      qc: "badge-qc",
      completed: "badge-completed",
   };
   const l = {
      pending: "Pending",
      in_progress: "Dalam Proses",
      qc: "Quality Control",
      completed: "Selesai",
   };
   return `<span class="badge ${m[s] || "badge-pending"}">${l[s] || s}</span>`;
}

function channelBadge(ch) {
   if (!ch) return '<span class="badge badge-offline_store">-</span>';
   const displayChannel = normalizeChannelValue(ch);
   const key = displayChannel.toLowerCase().replace(/ /g, "_");
   const m = {
      website: "badge-website",
      shopee: "badge-shopee",
      tokopedia: "badge-tokopedia",
      reseller: "badge-whatsapp",
      offline_store: "badge-offline_store",
   };
   return `<span class="badge ${m[key] || "badge-offline_store"}">${displayChannel}</span>`;
}

function normalizeChannelValue(channel) {
   return channel === "WhatsApp" ? "Reseller" : channel;
}

function isChannelMatch(saleChannel, filterChannel) {
   if (filterChannel === "all") return true;
   if (filterChannel === "Reseller")
      return saleChannel === "Reseller" || saleChannel === "WhatsApp";
   return saleChannel === filterChannel;
}

function expeditionBadge(exp) {
   if (!exp) return "";
   const key = exp.toLowerCase().replace(/[^a-z0-9]/g, "_");
   const m = {
      shopee_express: "badge-shopee",
      j_t: "badge-tokopedia",
      jne: "badge-website",
      sicepat: "badge-in_progress",
      anteraja: "badge-qc",
      ninja: "badge-pre_order",
      pos: "badge-pending",
      lainnya: "badge-offline_store",
   };
   return `<span class="badge ${m[key] || "badge-offline_store"}">${exp}</span>`;
}

/* =========================================================
   AUTH
   ========================================================= */
function resetLoginButton() {
   if ($("#loginBtn")) {
      $("#loginBtn").innerHTML =
         '<span>Masuk ke Sistem</span><i class="fas fa-arrow-right"></i>';
      $("#loginBtn").disabled = false;
   }
}

function showAuthLoading() {
   if ($("#authLoading")) $("#authLoading").style.display = "flex";
   if ($("#loginPage")) $("#loginPage").style.display = "none";
   if ($("#appShell")) $("#appShell").style.display = "none";
}

function showLoginScreen() {
   if ($("#authLoading")) $("#authLoading").style.display = "none";
   if ($("#appShell")) $("#appShell").style.display = "none";
   if ($("#loginPage")) $("#loginPage").style.display = "flex";
   resetLoginButton();
}

function cleanupAppSession() {
   state.listeners.forEach((unsub) => {
      try {
         unsub();
      } catch (e) {}
   });
   state.listeners = [];
   state.investor.listening = false;
   appInitialized = false;
   state.user = null;
}

$("#loginForm").addEventListener("submit", async (e) => {
   e.preventDefault();
   const email = $("#loginEmail").value.trim();
   const pass = $("#loginPassword").value;
   const btn = $("#loginBtn");
   btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
   btn.disabled = true;

   try {
      await auth.signInWithEmailAndPassword(email, pass);
   } catch (err) {
      toast(err.message || "Login gagal", "error");
      resetLoginButton();
   }
});

$("#logoutBtn").addEventListener("click", async () => {
   cleanupAppSession();
   logoutToastPending = true;
   showAuthLoading();

   try {
      await auth.signOut();
   } catch (err) {
      logoutToastPending = false;
      console.error("logout error:", err);
      toast(err.message || "Gagal keluar", "error");
      showLoginScreen();
   }
});

function enterApp() {
   if (appInitialized) return;
   appInitialized = true;

   $("#loginPage").style.display = "none";
   if ($("#authLoading")) $("#authLoading").style.display = "none";
   $("#appShell").style.display = "block";
   resetLoginButton();
   updateUserDisplay(state.user);
   initFirebaseListeners();
   navigateTo("dashboard");
}

function getUserInitial(nameOrEmail) {
   const value = String(nameOrEmail || "User").trim();
   return value.charAt(0).toUpperCase() || "U";
}

function updateUserDisplay(user) {
   const u = user || {};
   const safeName = u.name || (u.email ? u.email.split("@")[0] : "User");
   const safeEmail = u.email || "-";
   const safeRole = u.role || "User";
   const initial = getUserInitial(safeName);

   if ($("#userName")) $("#userName").textContent = safeName;
   if ($("#userRole")) $("#userRole").textContent = safeRole;
   if ($("#settingsName")) $("#settingsName").textContent = safeName;
   if ($("#settingsEmail")) $("#settingsEmail").textContent = safeEmail;
   if ($("#settingNameInput")) $("#settingNameInput").value = safeName;
   if ($("#settingEmailInput")) $("#settingEmailInput").value = safeEmail;
   if ($("#userAvatar")) $("#userAvatar").textContent = initial;
   if ($("#settingsAvatar")) $("#settingsAvatar").textContent = initial;
   updateNavigationAccess();
}

function updateNavigationAccess() {
   const role = getCurrentUserRole();
   const isOwner = role === "owner";
   const isOwnerOrAdmin = role === "owner" || role === "admin";
   const teamSalaryMenu = $("#menuTeamSalary");
   if (teamSalaryMenu) teamSalaryMenu.style.display = isOwner ? "" : "none";
   const salaryProdMenu = $("#menuSalaryProduksi");
   if (salaryProdMenu)
      salaryProdMenu.style.display = isOwnerOrAdmin ? "" : "none";
   const sponsorshipMenu = $("#menuSponsorship");
   if (sponsorshipMenu)
      sponsorshipMenu.style.display = isOwnerOrAdmin ? "" : "none";
   const resellerMenu = $("#menuReseller");
   if (resellerMenu)
      resellerMenu.style.display = isOwnerOrAdmin ? "" : "none";
   const investorMenu = $("#menuInvestor");
   if (investorMenu)
      investorMenu.style.display = isOwnerOrAdmin ? "" : "none";
}

/* =========================================================
   FIREBASE REAL-TIME LISTENERS
   ========================================================= */
function initFirebaseListeners() {
   const unsubCat = db
      .collection("categories")
      .orderBy("name")
      .onSnapshot(
         (snap) => {
            state.categories = snap.docs.map((d) => ({
               id: d.id,
               ...d.data(),
            }));
            state.categories.forEach((c) => {
               c.productCount = state.products.filter(
                  (p) => p.categoryId === c.id,
               ).length;
            });
            if (state.currentPage === "kategori") renderCategories();
            populateCategoryFilter();
         },
         (err) => console.error("Kategori listener error:", err),
      );
   state.listeners.push(unsubCat);

   const unsubProd = db
      .collection("products")
      .orderBy("sku")
      .onSnapshot(
         (snap) => {
            state.products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            state.categories.forEach((c) => {
               c.productCount = state.products.filter(
                  (p) => p.categoryId === c.id,
               ).length;
            });
            renderCurrentPage();
         },
         (err) => console.error("Produk listener error:", err),
      );
   state.listeners.push(unsubProd);

   const unsubSale = db
      .collection("sales")
      .orderBy("date", "desc")
      .onSnapshot(
         (snap) => {
            state.sales = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            renderCurrentPage();
         },
         (err) => console.error("Sales listener error:", err),
      );
   state.listeners.push(unsubSale);

   const unsubProdOrder = db
      .collection("production")
      .orderBy("date", "desc")
      .onSnapshot(
         (snap) => {
            state.production = snap.docs.map((d) => ({
               id: d.id,
               ...d.data(),
            }));
            renderCurrentPage();
         },
         (err) => console.error("Production listener error:", err),
      );
   state.listeners.push(unsubProdOrder);

   const unsubSM = db
      .collection("stock_movements")
      .orderBy("date", "desc")
      .onSnapshot(
         (snap) => {
            state.stockMovements = snap.docs.map((d) => ({
               id: d.id,
               ...d.data(),
            }));
            renderCurrentPage();
         },
         (err) => console.error("Stock movements listener error:", err),
      );
   state.listeners.push(unsubSM);

   const unsubPP = db
      .collection("production_purchases")
      .orderBy("date", "desc")
      .onSnapshot(
         (snap) => {
            state.productionPurchases = snap.docs.map((d) => ({
               id: d.id,
               ...d.data(),
            }));
            renderCurrentPage();
         },
         (err) => console.error("Production purchases listener error:", err),
      );
   state.listeners.push(unsubPP);

   const unsubPayroll = db
      .collection("payrolls")
      .orderBy("paymentDate", "desc")
      .onSnapshot(
         (snap) => {
            state.payrolls = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (state.currentPage === "gajiKaryawan") renderPayrolls();
            if (state.currentPage === "dashboard") renderDashboard();
         },
         (err) => console.error("Payrolls listener error:", err),
      );
   state.listeners.push(unsubPayroll);

   // ---- Salary Produksi (Gaji Borongan) ----
   const unsubSalaryProd = db
      .collection("production_salaries")
      .orderBy("periodDate", "desc")
      .onSnapshot(
         (snap) => {
            state.salaryProduksi = snap.docs.map((d) => ({
               id: d.id,
               ...d.data(),
            }));
            if (state.currentPage === "salaryProduksi") renderSalaryProduksi();
            if (state.currentPage === "dashboard") renderDashboard();
         },
         (err) => console.error("Salary produksi listener error:", err),
      );
   state.listeners.push(unsubSalaryProd);

   // ---- Support Sponsorship ----
   const unsubSponsorship = db
      .collection("sponsorships")
      .orderBy("eventDate", "desc")
      .onSnapshot(
         function (snap) {
            state.sponsorships = snap.docs.map(function (d) {
               return Object.assign({ id: d.id }, d.data());
            });
            if (state.currentPage === "sponsorship") renderSponsorship();
         },
         function (err) {
            console.error("Sponsorship listener error:", err);
         },
      );
   state.listeners.push(unsubSponsorship);

   const unsubUsers = db.collection("users").onSnapshot(
      (snap) => {
         state.users = snap.docs.map((d) => {
            const data = d.data();
            // doc ID bisa berupa UID atau email — pastikan email tersedia
            return {
               id: d.id,
               name:
                  data.name || (data.email ? data.email.split("@")[0] : d.id),
               email: data.email || d.id,
               role: data.role || "User",
               status: data.status || "Aktif",
            };
         });
         if (state.currentPage === "pengguna") renderUsers();
      },
      (err) => console.error("Users listener error:", err),
   );
   state.listeners.push(unsubUsers);

   const unsubReseller = db
      .collection("resellers")
      .orderBy("name", "asc")
      .onSnapshot(
         (snap) => {
            state.resellers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (state.currentPage === "reseller") renderResellers();
            populateResellerFilters();
         },
         (err) => console.error("Resellers listener error:", err)
      );
   state.listeners.push(unsubReseller);

   seedIfEmpty();
}

function renderCurrentPage() {
   switch (state.currentPage) {
      case "dashboard":
         renderDashboard();
         break;
      case "produk":
         renderProducts();
         break;
      case "produksi":
         renderProduction();
         break;
      case "inventaris":
         renderInventory();
         break;
      case "penjualan":
         renderSales();
         break;
      case "laporan":
         renderReports();
         break;
      case "belanjaProduksi":
         renderBelanjaProduksi();
         break;
      case "gajiKaryawan":
         renderPayrolls();
         break;
      case "salaryProduksi":
         renderSalaryProduksi();
         break;
      case "sponsorship":
         renderSponsorship();
         break;
      case "reseller":
         renderResellers();
         break;
      case "investor":
         renderInvestor();
         break;
   }
}

/* =========================================================
   SEED DATA
   ========================================================= */
async function seedIfEmpty() {
   try {
      const catSnap = await db.collection("categories").limit(1).get();
      if (!catSnap.empty) return;

      toast("Mengisi data awal...", "warning");

      const catBatch = db.batch();
      const catIdMap = {};
      SEED_CATEGORIES.forEach((cat) => {
         const ref = db.collection("categories").doc();
         catIdMap[cat.name] = ref.id;
         catBatch.set(ref, {
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            productCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
         });
      });
      await catBatch.commit();

      const prodBatch = db.batch();
      SEED_PRODUCTS.forEach((prod, i) => {
         const ref = db.collection("products").doc();
         const catId = catIdMap[prod.categoryName];
         const cat = SEED_CATEGORIES.find((c) => c.name === prod.categoryName);
         const prefix = SKU_MAP[cat.name] || "INZ-XXX";
         const sku = prefix + "-" + String(i + 1).padStart(3, "0");

         prodBatch.set(ref, {
            name: prod.name,
            sku: sku,
            slug: prod.name.toLowerCase().replace(/\s+/g, "-"),
            categoryId: catId,
            description: prod.description,
            costPrice: prod.costPrice,
            sellingPrice: prod.sellingPrice,
            profit: calcProfit(prod.sellingPrice, prod.costPrice),
            margin: calcMargin(prod.sellingPrice, prod.costPrice),
            stock: prod.stock,
            status: prod.status,
            featured: prod.featured,
            images: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
         });
      });
      await prodBatch.commit();

      toast("Data awal berhasil diisi", "success");
   } catch (err) {
      console.error("Seed error:", err);
      toast("Gagal mengisi data awal", "error");
   }
}

/* =========================================================
   ROUTER
   ========================================================= */
const TITLES = {
   dashboard: "Dashboard",
   produk: "Produk",
   kategori: "Kategori",
   produksi: "Produksi",
   inventaris: "Stock Control",
   penjualan: "Penjualan",
   laporan: "Laporan",
   pengguna: "Pengguna",
   pengaturan: "Pengaturan",
   belanjaProduksi: "Belanja Produksi",
   gajiKaryawan: "Gaji Karyawan",
   salaryProduksi: "Salary Produksi",
   sponsorship: "Support Sponsorship",
   reseller: "Reseller Management",
   investor: "Investor",
};

function navigateTo(page) {
   if (page === "gajiKaryawan" && getCurrentUserRole() !== "owner") {
      toast("Akses Team Salary hanya untuk Owner", "error");
      page = "dashboard";
   }
   const _roleForSP = getCurrentUserRole();
   if (
      page === "salaryProduksi" &&
      _roleForSP !== "owner" &&
      _roleForSP !== "admin"
   ) {
      toast("Akses Salary Produksi hanya untuk Owner atau Admin", "error");
      page = "dashboard";
   }
   const _roleForSpons = getCurrentUserRole();
   if (
      page === "sponsorship" &&
      _roleForSpons !== "owner" &&
      _roleForSpons !== "admin"
   ) {
      toast("Akses Support Sponsorship hanya untuk Owner atau Admin", "error");
      page = "dashboard";
   }
   const _roleForReseller = getCurrentUserRole();
   if (
      page === "reseller" &&
      _roleForReseller !== "owner" &&
      _roleForReseller !== "admin"
   ) {
      toast("Akses Reseller Management hanya untuk Owner atau Admin", "error");
      page = "dashboard";
   }
   const _roleForInvestor = getCurrentUserRole();
   if (
      page === "investor" &&
      _roleForInvestor !== "owner" &&
      _roleForInvestor !== "admin"
   ) {
      toast("Akses Investor hanya untuk Owner atau Admin", "error");
      page = "dashboard";
   }
   updateNavigationAccess();
   state.currentPage = page;
   $$(".page").forEach((p) => p.classList.remove("active"));
   const el = $("#page" + page.charAt(0).toUpperCase() + page.slice(1));
   if (el) el.classList.add("active");
   $$(".nav-item").forEach((n) =>
      n.classList.toggle("active", n.dataset.page === page),
   );
   $("#pageTitle").textContent = TITLES[page] || page;
   renderCurrentPage();
   if (page === "kategori") renderCategories();
   if (page === "pengguna") renderUsers();
   if (page === "reseller") renderResellers();
   $("#sidebar").classList.remove("open");
   $("#sidebarOverlay").classList.remove("show");
}

$$(".nav-item").forEach((n) =>
   n.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(n.dataset.page);
   }),
);
$("#hamburgerBtn").addEventListener("click", () => {
   $("#sidebar").classList.toggle("open");
   $("#sidebarOverlay").classList.toggle("show");
});
$("#sidebarOverlay").addEventListener("click", () => {
   $("#sidebar").classList.remove("open");
   $("#sidebarOverlay").classList.remove("show");
});
$("#globalSearch").addEventListener("input", (e) => {
   if (state.currentPage !== "produk") navigateTo("produk");
   $("#prodSearch").value = e.target.value;
   state.prod.search = e.target.value;
   state.prod.page = 1;
   renderProductTable();
});

/* =========================================================
   AGREGASI DATA REAL UNTUK CHART
   ========================================================= */
function groupByPeriod(arr, period, valueField, isCost = false) {
   const grouped = {};
   arr.forEach((item) => {
      if (!item.date) return;
      let key = "";
      if (period === "daily") {
         key = item.date;
      } else if (period === "weekly") {
         const d = new Date(item.date);
         const dayNum = d.getDay();
         const startOfWeek = new Date(d);
         startOfWeek.setDate(d.getDate() - dayNum + (dayNum === 0 ? -6 : 1));
         key = startOfWeek.toISOString().split("T")[0];
      } else if (period === "monthly") {
         key = item.date.substring(0, 7);
      }

      let val = 0;
      if (isCost) val = (item.costPrice || 0) * (item.quantity || 0);
      else if (valueField === "targetQty" || valueField === "completedQty")
         val = item[valueField] || 0;
      else val = item[valueField] || 0;

      grouped[key] = (grouped[key] || 0) + val;
   });
   return grouped;
}

function formatChartPeriodData(groupedData, period, lookback) {
   const labels = [];
   const values = [];
   const now = new Date();

   for (let i = lookback - 1; i >= 0; i--) {
      const d = new Date(now);
      let key = "";
      let label = "";

      if (period === "daily") {
         d.setDate(d.getDate() - i);
         key = d.toISOString().split("T")[0];
         label = d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
         });
      } else if (period === "weekly") {
         d.setDate(d.getDate() - i * 7);
         const dayNum = d.getDay();
         const startOfWeek = new Date(d);
         startOfWeek.setDate(d.getDate() - dayNum + (dayNum === 0 ? -6 : 1));
         key = startOfWeek.toISOString().split("T")[0];
         label = startOfWeek.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
         });
      } else if (period === "monthly") {
         d.setMonth(d.getMonth() - i);
         key = d.toISOString().split("T")[0].substring(0, 7);
         label = d.toLocaleDateString("id-ID", {
            month: "short",
            year: "2-digit",
         });
      }

      if (!labels.includes(label)) {
         labels.push(label);
         values.push(groupedData[key] || 0);
      }
   }
   return { labels, values };
}

/* =========================================================
   KALKULASI HELPERS — Phase 5B
   ========================================================= */

/**
 * getSaleRevenue(sale) — ambil pendapatan per transaksi.
 * Prioritas: sale.revenue (sudah di-set saat save) → sellingPrice * qty → 0
 */
function getSaleRevenue(sale) {
   const rev = sale.revenue !== undefined ? sale.revenue : null;
   if (rev !== null && !isNaN(rev)) return rev;
   // fallback: sellingPrice * quantity
   return (sale.sellingPrice || 0) * (sale.quantity || 0) || 0;
}

/**
 * getSaleProfit(sale) — ambil profit per transaksi.
 * Prioritas: sale.profit (realProfit sudah di-set saat save) → (sellingPrice - costPrice) * qty → 0
 */
function getSaleProfit(sale) {
   const pr = sale.profit !== undefined ? sale.profit : null;
   if (pr !== null && !isNaN(pr)) return pr;
   // fallback: (sellingPrice - costPrice) * qty
   const sp = sale.sellingPrice || 0;
   const cp = sale.costPrice || 0;
   return Math.max(0, (sp - cp) * (sale.quantity || 0));
}

/**
 * getProductionExpenseTotal(monthPrefix) — total belanja produksi bulan tertentu.
 * monthPrefix: "YYYY-MM". Jika kosong, hitung semua.
 */
function getProductionExpenseTotal(monthPrefix) {
   const list = monthPrefix
      ? state.productionPurchases.filter(
           (p) => (p.date || "").substring(0, 7) === monthPrefix,
        )
      : state.productionPurchases;
   return list.reduce((s, p) => s + (Number(p.totalCost) || 0), 0);
}

/**
 * getPayrollExpenseTotal(monthPrefix) — total gaji bulan tertentu.
 * monthPrefix: "YYYY-MM". Jika kosong, hitung semua.
 */
function getPayrollExpenseTotal(monthPrefix) {
   const payrollsFiltered = monthPrefix
      ? state.payrolls.filter((p) => {
           const date = p.period || p.paymentDate || "";
           return date.substring(0, 7) === monthPrefix;
        })
      : state.payrolls;

   const salaryProdFiltered = monthPrefix
      ? (state.salaryProduksi || []).filter(
           (s) => (s.periodDate || "").substring(0, 7) === monthPrefix,
        )
      : (state.salaryProduksi || []);

   const payrollSum = payrollsFiltered.reduce((s, p) => s + (Number(p.totalPaid) || 0), 0);
   const salaryProdSum = salaryProdFiltered.reduce((s, sDoc) => s + (Number(sDoc.grandTotal) || 0), 0);

   return payrollSum + salaryProdSum;
}

/**
 * getNetProfit(salesProfit, monthPrefix) — laba bersih setelah expense.
 * Net = sales profit - belanja produksi - gaji karyawan
 */
function getNetProfit(salesProfit, monthPrefix) {
   const prodExpense = getProductionExpenseTotal(monthPrefix);
   const payrollExpense = getPayrollExpenseTotal(monthPrefix);
   return (salesProfit || 0) - prodExpense - payrollExpense;
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard() {
   // Ambil tahun dan bulan saat ini (Contoh: "2023-10")
   const currentMonth = new Date().toISOString().substring(0, 7);

   // Filter data untuk BULAN INI
   const tsMonth = state.sales.filter(
      (s) => (s.date || "").substring(0, 7) === currentMonth,
   );
   const prodMonth = state.production.filter(
      (p) => (p.date || "").substring(0, 7) === currentMonth,
   );

   const totalTarget = prodMonth.reduce((s, p) => s + (p.targetQty || 0), 0);
   const totalCompleted = prodMonth.reduce(
      (s, p) => s + (p.completedQty || 0),
      0,
   );

   // Revenue & profit pakai helpers — full backward compat
   const revenueMonth = tsMonth.reduce((s, x) => s + getSaleRevenue(x), 0);
   const costMonth = tsMonth.reduce(
      (s, x) => s + (x.costPrice || 0) * (x.quantity || 0),
      0,
   );
   const profitMonth = tsMonth.reduce((s, x) => s + getSaleProfit(x), 0);
   const marginMonth =
      revenueMonth > 0 ? Math.round((profitMonth / revenueMonth) * 100) : 0;

   // Expense: belanja produksi + gaji bulan ini
   const prodExpense = getProductionExpenseTotal(currentMonth);
   const payrollExpense = getPayrollExpenseTotal(currentMonth);
   const netProfit = getNetProfit(profitMonth, currentMonth);

   const activeStock = state.products
      .filter((p) => p.status === "active" || p.status === "in_production")
      .reduce((s, p) => s + (p.stock || 0), 0);
   const lowStock = state.products.filter(
      (p) => p.status === "low_stock",
   ).length;
   const outStock = state.products.filter(
      (p) => p.status === "out_of_stock",
   ).length;
   const best =
      tsMonth.length > 0
         ? tsMonth.reduce((a, b) =>
              getSaleRevenue(a) > getSaleRevenue(b) ? a : b,
           )
         : null;

   const cards = [
      {
         label: "Produksi Bulan Ini",
         value: totalCompleted,
         sub: "Target: " + totalTarget + " unit",
         icon: "fa-industry",
         cls: "gold",
      },
      {
         label: "Penjualan Bulan Ini",
         value: tsMonth.length,
         sub: "Transaksi",
         icon: "fa-receipt",
         cls: "green",
      },
      {
         label: "Pendapatan Real",
         value: revenueMonth,
         sub: fmtRp(revenueMonth),
         icon: "fa-money-bill-wave",
         cls: "gold",
         isRp: true,
      },
      {
         label: "Cost HPP Bulan Ini",
         value: costMonth,
         sub: fmtRp(costMonth),
         icon: "fa-coins",
         cls: "maroon",
         isRp: true,
      },
      {
         label: "Laba Penjualan",
         value: profitMonth,
         sub: fmtRp(profitMonth),
         icon: "fa-chart-pie",
         cls: "green",
         isRp: true,
      },
      {
         label: "Margin Penjualan",
         value: marginMonth,
         sub: marginMonth + "%",
         icon: "fa-percent",
         cls: "gold",
         isPct: true,
      },
      {
         label: "Belanja Produksi",
         value: prodExpense,
         sub: fmtRp(prodExpense),
         icon: "fa-shopping-basket",
         cls: "maroon",
         isRp: true,
      },
      {
         label: "Gaji Karyawan",
         value: payrollExpense,
         sub: fmtRp(payrollExpense),
         icon: "fa-money-bill-wave",
         cls: "maroon",
         isRp: true,
      },
      {
         label: "Laba Bersih",
         value: netProfit,
         sub: fmtRp(netProfit),
         icon: "fa-sack-dollar",
         cls: netProfit >= 0 ? "green" : "red",
         isRp: true,
      },
      {
         label: "Total Stok Aktif",
         value: activeStock,
         sub: "Unit tersedia",
         icon: "fa-boxes-stacked",
         cls: "green",
      },
      {
         label: "Stok Rendah",
         value: lowStock,
         sub: lowStock + " produk",
         icon: "fa-triangle-exclamation",
         cls: "maroon",
      },
      {
         label: "Stok Habis",
         value: outStock,
         sub: outStock + " produk",
         icon: "fa-circle-xmark",
         cls: "red",
      },
      {
         label: "Produk Terlaris",
         value: best ? best.productName : "-",
         sub: best ? fmtRp(getSaleRevenue(best)) : "Belum ada",
         icon: "fa-trophy",
         cls: "gold",
         isText: true,
      },
   ];

   $("#dashStats").innerHTML = cards
      .map((c) => {
         const display = c.isRp
            ? fmtRp(c.value)
            : c.isPct
              ? c.value + "%"
              : c.isText
                ? c.value
                : fmt(c.value);
         return `<div class="stat-card ${c.cls}"><div class="sc-top"><div class="sc-icon"><i class="fas ${c.icon}"></i></div><span class="sc-label">${c.label}</span></div><div class="sc-value" style="${c.isText ? "font-size:16px;word-break:break-word" : ""}">${display}</div><div class="sc-sub">${c.sub}</div></div>`;
      })
      .join("");

   // Alerts & Charts tetap dipanggil seperti biasa di bawah ini
   let alerts = "";
   if (outStock > 0)
      alerts += `<div class="alert-bar danger"><i class="fas fa-circle-exclamation"></i><span><span class="alert-count">${outStock}</span> produk dalam status <strong>Habis</strong> — segera lakukan restocking!</span></div>`;
   if (lowStock > 0)
      alerts += `<div class="alert-bar warning"><i class="fas fa-triangle-exclamation"></i><span><span class="alert-count">${lowStock}</span> produk dengan <strong>Stok Rendah</strong></span></div>`;
   $("#dashAlerts").innerHTML = alerts;
   $("#criticalDot").style.display = outStock + lowStock > 0 ? "block" : "none";
   $("#notifDot").style.display = outStock + lowStock > 0 ? "block" : "none";

   renderSalesTrendChart("daily");
   renderChannelChart();
   renderRevenueCostChart();
   renderProductionChart();
   renderCategoryChart();
   renderTopSellingList();
   renderProdProgressList();
}

/* =========================================================
   CHART — KONEK DATA REAL
   ========================================================= */
const chartFont = { family: "Plus Jakarta Sans", size: 11 };
const chartGrid = { color: "rgba(244,196,48,.06)" };

/* =========================================================
   TREN PENJUALAN — Phase 6.4 period-aware chart
   ========================================================= */

/** Revenue helper already defined above as getSaleRevenue(). */
function getTrendValue(sale) {
   if (sale.realRevenue !== undefined && !isNaN(sale.realRevenue))
      return Number(sale.realRevenue);
   if (sale.revenue !== undefined && !isNaN(sale.revenue))
      return Number(sale.revenue);
   return (Number(sale.sellingPrice) || 0) * (Number(sale.quantity) || 0);
}

function getDailySalesTrendData() {
   // 7 days ending on (and including) state.salesTrend.date
   const anchor = new Date(state.salesTrend.date);
   if (isNaN(anchor)) return { labels: [], values: [] };
   const labels = [],
      values = [];
   for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("id-ID", {
         day: "numeric",
         month: "short",
      });
      const total = state.sales
         .filter((s) => s.date === key)
         .reduce((sum, s) => sum + getTrendValue(s), 0);
      labels.push(label);
      values.push(total);
   }
   return { labels, values };
}

function getWeeklyTrendData() {
   const { month, year } = state.salesTrend;
   const filtered = state.sales.filter((s) =>
      matchesMonthYear(s.date, month, year),
   );
   // Group into week-of-month buckets (1-5)
   const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
   filtered.forEach((s) => {
      const day = parseInt((s.date || "").substring(8, 10), 10);
      if (!day) return;
      const week = Math.min(Math.ceil(day / 7), 5);
      buckets[week] += getTrendValue(s);
   });
   return {
      labels: ["Minggu 1", "Minggu 2", "Minggu 3", "Minggu 4", "Minggu 5"],
      values: [buckets[1], buckets[2], buckets[3], buckets[4], buckets[5]],
   };
}

function getMonthlyTrendData() {
   const { year } = state.salesTrend;
   const filtered = state.sales.filter((s) =>
      matchesMonthYear(s.date, "all", year),
   );
   const MONTH_LABELS_SHORT = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
   ];
   const buckets = Array(12).fill(0);
   filtered.forEach((s) => {
      const m = parseInt((s.date || "").substring(5, 7), 10);
      if (m >= 1 && m <= 12) buckets[m - 1] += getTrendValue(s);
   });
   return { labels: MONTH_LABELS_SHORT, values: buckets };
}

function renderSalesTrendFilters() {
   const el = $("#salesTrendFilters");
   if (!el) return;
   const { range, date, month, year } = state.salesTrend;
   const yearOpts = getYearOptionsFromSales()
      .map(
         (y) =>
            `<option value="${y}" ${state.salesTrend.year === y ? "selected" : ""}>${y}</option>`,
      )
      .join("");
   const monthOpts = MONTH_OPTIONS.map(
      (m) =>
         `<option value="${m.value}" ${state.salesTrend.month === m.value ? "selected" : ""}>${m.label}</option>`,
   ).join("");

   if (range === "daily") {
      el.innerHTML = `<input type="date" class="form-input" id="salesTrendDate" value="${date}"
      style="height:30px;font-size:12px;padding:4px 10px;" max="${today}">`;
      $("#salesTrendDate").addEventListener("change", (e) => {
         state.salesTrend.date = e.target.value || today;
         renderSalesTrendChart(state.salesTrend.range);
      });
   } else if (range === "weekly") {
      el.innerHTML = `
      <select class="form-input" id="salesTrendMonth" style="height:30px;font-size:12px;padding:4px 10px;">
        ${monthOpts}
      </select>
      <select class="form-input" id="salesTrendYear" style="height:30px;font-size:12px;padding:4px 10px;">
        ${yearOpts}
      </select>`;
      $("#salesTrendMonth").addEventListener("change", (e) => {
         state.salesTrend.month = e.target.value;
         renderSalesTrendChart(state.salesTrend.range);
      });
      $("#salesTrendYear").addEventListener("change", (e) => {
         state.salesTrend.year = e.target.value;
         renderSalesTrendChart(state.salesTrend.range);
      });
   } else if (range === "monthly") {
      el.innerHTML = `<select class="form-input" id="salesTrendYear" style="height:30px;font-size:12px;padding:4px 10px;">
      ${yearOpts}
    </select>`;
      $("#salesTrendYear").addEventListener("change", (e) => {
         state.salesTrend.year = e.target.value;
         renderSalesTrendChart(state.salesTrend.range);
      });
   } else {
      el.innerHTML = "";
   }
}

function renderSalesTrendChart(range) {
   // Sync state
   state.salesTrend.range = range || state.salesTrend.range;

   // Sync tab UI active state
   const tabsEl = $("#salesTrendTabs");
   if (tabsEl) {
      tabsEl.querySelectorAll(".chart-tab").forEach((t) => {
         if (t.dataset.range === state.salesTrend.range) {
            t.classList.add("active");
         } else {
            t.classList.remove("active");
         }
      });
   }

   // Compute period-aware data
   let data;
   if (state.salesTrend.range === "daily") data = getDailySalesTrendData();
   else if (state.salesTrend.range === "weekly") data = getWeeklyTrendData();
   else data = getMonthlyTrendData();

   // Ensure values array is always numbers (safe for Chart.js)
   const safeValues = (data.values || []).map((v) => (isNaN(v) ? 0 : v));

   if (state.charts.salesTrend) state.charts.salesTrend.destroy();

   state.charts.salesTrend = new Chart($("#chartSalesTrend").getContext("2d"), {
      type: "line",
      data: {
         labels: data.labels,
         datasets: [
            {
               label: "Penjualan",
               data: safeValues,
               borderColor: "#D4A017",
               backgroundColor: "rgba(244,196,48,.1)",
               fill: true,
               tension: 0.4,
               pointRadius: 4,
               pointBackgroundColor: "#fff",
               pointBorderColor: "#D4A017",
               pointBorderWidth: 2,
               borderWidth: 2.5,
            },
         ],
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => fmtRp(c.raw) } },
         },
         scales: {
            x: { grid: { display: false }, ticks: { font: chartFont } },
            y: {
               grid: chartGrid,
               ticks: {
                  font: chartFont,
                  callback: (v) => (v / 1000000).toFixed(1) + "jt",
               },
            },
         },
      },
   });

   // Render appropriate filter controls for current tab
   renderSalesTrendFilters();
}

document.addEventListener("click", (e) => {
   if (
      e.target.classList.contains("chart-tab") &&
      e.target.closest("#salesTrendTabs")
   ) {
      e.target
         .closest(".chart-tabs")
         .querySelectorAll(".chart-tab")
         .forEach((t) => t.classList.remove("active"));
      e.target.classList.add("active");
      // Persist range and re-render
      state.salesTrend.range = e.target.dataset.range;
      renderSalesTrendChart(state.salesTrend.range);
   }
   if (
      e.target.classList.contains("chart-tab") &&
      e.target.closest("#revCostTrendTabs")
   ) {
      e.target
         .closest(".chart-tabs")
         .querySelectorAll(".chart-tab")
         .forEach((t) => t.classList.remove("active"));
      e.target.classList.add("active");
      // Persist range and re-render
      state.revCostTrend.range = e.target.dataset.range;
      renderRevenueCostChart(state.revCostTrend.range);
   }
   if (
      e.target.classList.contains("chart-tab") &&
      e.target.closest("#productionTrendTabs")
   ) {
      e.target
         .closest(".chart-tabs")
         .querySelectorAll(".chart-tab")
         .forEach((t) => t.classList.remove("active"));
      e.target.classList.add("active");
      // Persist range and re-render
      state.productionTrend.range = e.target.dataset.range;
      renderProductionChart(state.productionTrend.range);
   }
});

function renderChannelChart() {
   if (state.charts.channel) state.charts.channel.destroy();
   const ch = {};
   state.sales.forEach((s) => {
      const channel = normalizeChannelValue(s.channel || "-");
      ch[channel] = (ch[channel] || 0) + (s.revenue || 0);
   });
   const colors = ["#7A1F1F", "#EE4D2D", "#2E7D32", "#128C7E", "#4B5563"];
   state.charts.channel = new Chart($("#chartChannel").getContext("2d"), {
      type: "doughnut",
      data: {
         labels: Object.keys(ch),
         datasets: [
            {
               data: Object.values(ch),
               backgroundColor: colors,
               borderWidth: 0,
               hoverOffset: 8,
            },
         ],
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         cutout: "65%",
         plugins: {
            legend: {
               position: "bottom",
               labels: {
                  font: { ...chartFont, weight: "500" },
                  usePointStyle: true,
                  pointStyle: "circle",
                  padding: 14,
               },
            },
            tooltip: {
               callbacks: { label: (c) => c.label + ": " + fmtRp(c.raw) },
            },
         },
      },
   });
}

function getYearOptionsFromAllData() {
   const years = new Set();
   state.sales.forEach((s) => {
      const y = (s.date || "").substring(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
   });
   state.production.forEach((p) => {
      const y = (p.date || "").substring(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
   });
   years.add(String(new Date().getFullYear()));
   return [...years].sort((a, b) => b.localeCompare(a));
}

function getDailyRevCostData() {
   const anchor = new Date(state.revCostTrend.date);
   if (isNaN(anchor)) return { labels: [], valuesRev: [], valuesCost: [] };
   const labels = [],
      valuesRev = [],
      valuesCost = [];
   for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("id-ID", {
         day: "numeric",
         month: "short",
      });
      const daySales = state.sales.filter((s) => s.date === key);
      const totalRev = daySales.reduce((sum, s) => sum + getTrendValue(s), 0);
      const totalCost = daySales.reduce(
         (sum, s) =>
            sum + (Number(s.costPrice) || 0) * (Number(s.quantity) || 0),
         0,
      );
      labels.push(label);
      valuesRev.push(totalRev);
      valuesCost.push(totalCost);
   }
   return { labels, valuesRev, valuesCost };
}

function getWeeklyRevCostData() {
   const { month, year } = state.revCostTrend;
   const filtered = state.sales.filter((s) =>
      matchesMonthYear(s.date, month, year),
   );
   const bucketsRev = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
   const bucketsCost = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
   filtered.forEach((s) => {
      const day = parseInt((s.date || "").substring(8, 10), 10);
      if (!day) return;
      const week = Math.min(Math.ceil(day / 7), 5);
      bucketsRev[week] += getTrendValue(s);
      bucketsCost[week] +=
         (Number(s.costPrice) || 0) * (Number(s.quantity) || 0);
   });
   return {
      labels: ["Minggu 1", "Minggu 2", "Minggu 3", "Minggu 4", "Minggu 5"],
      valuesRev: [
         bucketsRev[1],
         bucketsRev[2],
         bucketsRev[3],
         bucketsRev[4],
         bucketsRev[5],
      ],
      valuesCost: [
         bucketsCost[1],
         bucketsCost[2],
         bucketsCost[3],
         bucketsCost[4],
         bucketsCost[5],
      ],
   };
}

function getMonthlyRevCostData() {
   const { year } = state.revCostTrend;
   const filtered = state.sales.filter((s) =>
      matchesMonthYear(s.date, "all", year),
   );
   const MONTH_LABELS_SHORT = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
   ];
   const bucketsRev = Array(12).fill(0);
   const bucketsCost = Array(12).fill(0);
   filtered.forEach((s) => {
      const m = parseInt((s.date || "").substring(5, 7), 10);
      if (m >= 1 && m <= 12) {
         bucketsRev[m - 1] += getTrendValue(s);
         bucketsCost[m - 1] +=
            (Number(s.costPrice) || 0) * (Number(s.quantity) || 0);
      }
   });
   return {
      labels: MONTH_LABELS_SHORT,
      valuesRev: bucketsRev,
      valuesCost: bucketsCost,
   };
}

function getDailyProductionData() {
   const anchor = new Date(state.productionTrend.date);
   if (isNaN(anchor)) return { labels: [], values: [] };
   const labels = [],
      values = [];
   for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("id-ID", {
         day: "numeric",
         month: "short",
      });
      const total = state.production
         .filter((p) => p.date === key)
         .reduce((sum, p) => sum + (Number(p.completedQty) || 0), 0);
      labels.push(label);
      values.push(total);
   }
   return { labels, values };
}

function getWeeklyProductionData() {
   const { month, year } = state.productionTrend;
   const filtered = state.production.filter((p) =>
      matchesMonthYear(p.date, month, year),
   );
   const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
   filtered.forEach((p) => {
      const day = parseInt((p.date || "").substring(8, 10), 10);
      if (!day) return;
      const week = Math.min(Math.ceil(day / 7), 5);
      buckets[week] += Number(p.completedQty) || 0;
   });
   return {
      labels: ["Minggu 1", "Minggu 2", "Minggu 3", "Minggu 4", "Minggu 5"],
      values: [buckets[1], buckets[2], buckets[3], buckets[4], buckets[5]],
   };
}

function getMonthlyProductionData() {
   const { year } = state.productionTrend;
   const filtered = state.production.filter((p) =>
      matchesMonthYear(p.date, "all", year),
   );
   const MONTH_LABELS_SHORT = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
   ];
   const buckets = Array(12).fill(0);
   filtered.forEach((p) => {
      const m = parseInt((p.date || "").substring(5, 7), 10);
      if (m >= 1 && m <= 12) buckets[m - 1] += Number(p.completedQty) || 0;
   });
   return { labels: MONTH_LABELS_SHORT, values: buckets };
}

function renderRevCostFilters() {
   const el = $("#revCostTrendFilters");
   if (!el) return;
   const { range, date, month, year } = state.revCostTrend;
   const yearOpts = getYearOptionsFromAllData()
      .map(
         (y) =>
            `<option value="${y}" ${state.revCostTrend.year === y ? "selected" : ""}>${y}</option>`,
      )
      .join("");
   const monthOpts = MONTH_OPTIONS.map(
      (m) =>
         `<option value="${m.value}" ${state.revCostTrend.month === m.value ? "selected" : ""}>${m.label}</option>`,
   ).join("");

   if (range === "daily") {
      el.innerHTML = `<input type="date" class="form-input" id="revCostTrendDate" value="${date}"
      style="height:30px;font-size:12px;padding:4px 10px;" max="${today}">`;
      $("#revCostTrendDate").addEventListener("change", (e) => {
         state.revCostTrend.date = e.target.value || today;
         renderRevenueCostChart(state.revCostTrend.range);
      });
   } else if (range === "weekly") {
      el.innerHTML = `
      <select class="form-input" id="revCostTrendMonth" style="height:30px;font-size:12px;padding:4px 10px;">
        ${monthOpts}
      </select>
      <select class="form-input" id="revCostTrendYear" style="height:30px;font-size:12px;padding:4px 10px;">
        ${yearOpts}
      </select>`;
      $("#revCostTrendMonth").addEventListener("change", (e) => {
         state.revCostTrend.month = e.target.value;
         renderRevenueCostChart(state.revCostTrend.range);
      });
      $("#revCostTrendYear").addEventListener("change", (e) => {
         state.revCostTrend.year = e.target.value;
         renderRevenueCostChart(state.revCostTrend.range);
      });
   } else if (range === "monthly") {
      el.innerHTML = `<select class="form-input" id="revCostTrendYear" style="height:30px;font-size:12px;padding:4px 10px;">
      ${yearOpts}
    </select>`;
      $("#revCostTrendYear").addEventListener("change", (e) => {
         state.revCostTrend.year = e.target.value;
         renderRevenueCostChart(state.revCostTrend.range);
      });
   } else {
      el.innerHTML = "";
   }
}

function renderProductionFilters() {
   const el = $("#productionTrendFilters");
   if (!el) return;
   const { range, date, month, year } = state.productionTrend;
   const yearOpts = getYearOptionsFromAllData()
      .map(
         (y) =>
            `<option value="${y}" ${state.productionTrend.year === y ? "selected" : ""}>${y}</option>`,
      )
      .join("");
   const monthOpts = MONTH_OPTIONS.map(
      (m) =>
         `<option value="${m.value}" ${state.productionTrend.month === m.value ? "selected" : ""}>${m.label}</option>`,
   ).join("");

   if (range === "daily") {
      el.innerHTML = `<input type="date" class="form-input" id="productionTrendDate" value="${date}"
      style="height:30px;font-size:12px;padding:4px 10px;" max="${today}">`;
      $("#productionTrendDate").addEventListener("change", (e) => {
         state.productionTrend.date = e.target.value || today;
         renderProductionChart(state.productionTrend.range);
      });
   } else if (range === "weekly") {
      el.innerHTML = `
      <select class="form-input" id="productionTrendMonth" style="height:30px;font-size:12px;padding:4px 10px;">
        ${monthOpts}
      </select>
      <select class="form-input" id="productionTrendYear" style="height:30px;font-size:12px;padding:4px 10px;">
        ${yearOpts}
      </select>`;
      $("#productionTrendMonth").addEventListener("change", (e) => {
         state.productionTrend.month = e.target.value;
         renderProductionChart(state.productionTrend.range);
      });
      $("#productionTrendYear").addEventListener("change", (e) => {
         state.productionTrend.year = e.target.value;
         renderProductionChart(state.productionTrend.range);
      });
   } else if (range === "monthly") {
      el.innerHTML = `<select class="form-input" id="productionTrendYear" style="height:30px;font-size:12px;padding:4px 10px;">
      ${yearOpts}
    </select>`;
      $("#productionTrendYear").addEventListener("change", (e) => {
         state.productionTrend.year = e.target.value;
         renderProductionChart(state.productionTrend.range);
      });
   } else {
      el.innerHTML = "";
   }
}

function renderRevenueCostChart(range) {
   state.revCostTrend.range = range || state.revCostTrend.range;

   // Sync tab UI active state
   const tabsEl = $("#revCostTrendTabs");
   if (tabsEl) {
      tabsEl.querySelectorAll(".chart-tab").forEach((t) => {
         if (t.dataset.range === state.revCostTrend.range) {
            t.classList.add("active");
         } else {
            t.classList.remove("active");
         }
      });
   }

   let labels = [];
   let valuesRev = [];
   let valuesCost = [];

   if (state.revCostTrend.range === "daily") {
      const data = getDailyRevCostData();
      labels = data.labels;
      valuesRev = data.valuesRev;
      valuesCost = data.valuesCost;
   } else if (state.revCostTrend.range === "weekly") {
      const data = getWeeklyRevCostData();
      labels = data.labels;
      valuesRev = data.valuesRev;
      valuesCost = data.valuesCost;
   } else {
      const data = getMonthlyRevCostData();
      labels = data.labels;
      valuesRev = data.valuesRev;
      valuesCost = data.valuesCost;
   }

   // Ensure values array is always numbers (safe for Chart.js)
   const safeRev = (valuesRev || []).map((v) => (isNaN(v) ? 0 : v));
   const safeCost = (valuesCost || []).map((v) => (isNaN(v) ? 0 : v));

   if (state.charts.revCost) state.charts.revCost.destroy();

   state.charts.revCost = new Chart($("#chartRevenueCost").getContext("2d"), {
      type: "bar",
      data: {
         labels: labels,
         datasets: [
            {
               label: "Pendapatan",
               data: safeRev,
               backgroundColor: "rgba(244,196,48,.75)",
               borderRadius: 6,
               barPercentage: 0.55,
               categoryPercentage: 0.6,
            },
            {
               label: "Biaya",
               data: safeCost,
               backgroundColor: "rgba(122,31,31,.55)",
               borderRadius: 6,
               barPercentage: 0.55,
               categoryPercentage: 0.6,
            },
         ],
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: {
            legend: {
               position: "top",
               labels: {
                  font: { ...chartFont, weight: "500" },
                  usePointStyle: true,
                  pointStyle: "circle",
                  padding: 14,
               },
            },
            tooltip: {
               callbacks: {
                  label: (c) => c.dataset.label + ": " + fmtRp(c.raw),
               },
            },
         },
         scales: {
            x: { grid: { display: false }, ticks: { font: chartFont } },
            y: {
               grid: chartGrid,
               ticks: {
                  font: chartFont,
                  callback: (v) => (v / 1000000).toFixed(1) + "jt",
               },
            },
         },
      },
   });

   renderRevCostFilters();
}

function renderProductionChart(range) {
   state.productionTrend.range = range || state.productionTrend.range;

   // Sync tab UI active state
   const tabsEl = $("#productionTrendTabs");
   if (tabsEl) {
      tabsEl.querySelectorAll(".chart-tab").forEach((t) => {
         if (t.dataset.range === state.productionTrend.range) {
            t.classList.add("active");
         } else {
            t.classList.remove("active");
         }
      });
   }

   let labels = [];
   let values = [];

   if (state.productionTrend.range === "daily") {
      const data = getDailyProductionData();
      labels = data.labels;
      values = data.values;
   } else if (state.productionTrend.range === "weekly") {
      const data = getWeeklyProductionData();
      labels = data.labels;
      values = data.values;
   } else {
      const data = getMonthlyProductionData();
      labels = data.labels;
      values = data.values;
   }

   // Ensure values array is always numbers (safe for Chart.js)
   const safeValues = (values || []).map((v) => (isNaN(v) ? 0 : v));

   if (state.charts.production) state.charts.production.destroy();

   state.charts.production = new Chart($("#chartProduction").getContext("2d"), {
      type: "bar",
      data: {
         labels: labels,
         datasets: [
            {
               label: "Unit Diproduksi",
               data: safeValues,
               backgroundColor: "rgba(22,163,74,.65)",
               borderRadius: 6,
               barPercentage: 0.5,
               categoryPercentage: 0.6,
            },
         ],
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: { legend: { display: false } },
         scales: {
            x: { grid: { display: false }, ticks: { font: chartFont } },
            y: { grid: chartGrid, ticks: { font: chartFont } },
         },
      },
   });

   renderProductionFilters();
}

function renderCategoryChart() {
   if (state.charts.category) state.charts.category.destroy();
   const cs = {};
   state.sales.forEach((s) => {
      const p = state.products.find((x) => x.id === s.productId);
      if (p) {
         const cn = getCatName(p.categoryId);
         cs[cn] = (cs[cn] || 0) + (s.revenue || 0);
      }
   });
   const colors = [
      "#F4C430",
      "#D4A017",
      "#7A1F1F",
      "#16A34A",
      "#0EA5E9",
      "#D97706",
      "#DC2626",
      "#6B7280",
   ];
   state.charts.category = new Chart($("#chartCategory").getContext("2d"), {
      type: "doughnut",
      data: {
         labels: Object.keys(cs),
         datasets: [
            {
               data: Object.values(cs),
               backgroundColor: colors,
               borderWidth: 0,
               hoverOffset: 6,
            },
         ],
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         cutout: "55%",
         plugins: {
            legend: {
               position: "bottom",
               labels: {
                  font: { size: 10, weight: "500" },
                  usePointStyle: true,
                  pointStyle: "circle",
                  padding: 10,
               },
            },
            tooltip: {
               callbacks: { label: (c) => c.label + ": " + fmtRp(c.raw) },
            },
         },
      },
   });
}

function renderTopSellingList() {
   const ps = {};
   state.sales.forEach((s) => {
      ps[s.productId] = (ps[s.productId] || 0) + (s.revenue || 0);
   });
   const sorted = Object.entries(ps)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
   const total = sorted.reduce((s, x) => s + x[1], 0);
   $("#topSellingList").innerHTML = sorted.length
      ? sorted
           .map(([pid, rev], i) => {
              const p = state.products.find((x) => x.id === pid);
              const cls = i === 0 ? "g" : i === 1 ? "s" : i === 2 ? "b" : "n";
              return `<div class="rank-item">${prodImg(p, 32)}<div class="rank-num ${cls}">${i + 1}</div><div class="rank-info"><div class="name">${p ? p.name : "-"}</div><div class="sub">${p ? p.sku : ""} — ${pct(rev, total)}%</div><div class="progress-bar" style="width:120px"><div class="fill fill-gold" style="width:${pct(rev, total)}%"></div></div></div><div class="rank-val">${fmtRp(rev)}<small>${pct(rev, total)}%</small></div></div>`;
           })
           .join("")
      : '<div class="empty-state"><i class="fas fa-trophy"></i><h4>Belum ada data</h4></div>';
}

function renderProdProgressList() {
   const tp = state.production.filter((p) => p.date === today);
   if (!tp.length) {
      $("#prodProgressList").innerHTML =
         '<div class="empty-state"><i class="fas fa-industry"></i><h4>Tidak ada produksi hari ini</h4></div>';
      return;
   }
   $("#prodProgressList").innerHTML = tp
      .map((pr) => {
         const pctDone =
            pr.targetQty > 0
               ? Math.round(((pr.completedQty || 0) / pr.targetQty) * 100)
               : 0;
         const fillCls =
            pctDone >= 100
               ? "fill-green"
               : pctDone >= 50
                 ? "fill-gold"
                 : "fill-red";
         const p = findProduct(pr.productId, pr.productName);
         return `<div class="prod-card">${prodImg(p, 36)}<div class="pc-info"><h4>${pr.productName}</h4><p>${pr.sku} — ${prodStatusBadge(pr.status)}</p><div class="progress-bar" style="width:100%;margin-top:8px"><div class="fill ${fillCls}" style="width:${pctDone}%"></div></div></div><div class="pc-stats"><div class="val">${pr.completedQty || 0}/${pr.targetQty}</div><div class="lbl">${pctDone}%</div></div></div>`;
      })
      .join("");
}

/* =========================================================
   PRODUK — CRUD + CLOUDINARY + AUTO SKU
   ========================================================= */
function getFilteredProducts() {
   let list = [...state.products];
   if (state.prod.search) {
      const q = state.prod.search.toLowerCase();
      list = list.filter(
         (p) =>
            (p.name || "").toLowerCase().includes(q) ||
            (p.sku || "").toLowerCase().includes(q),
      );
   }
   if (state.prod.filter !== "all")
      list = list.filter((p) => p.status === state.prod.filter);
   if (state.prod.catFilter !== "all")
      list = list.filter((p) => p.categoryId === state.prod.catFilter);
   const { field, dir } = state.prod.sort;
   list.sort((a, b) => {
      let va = a[field],
         vb = b[field];
      if (typeof va === "string")
         return dir === "asc"
            ? (va || "").localeCompare(vb || "")
            : (vb || "").localeCompare(va || "");
      return dir === "asc" ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
   });
   return list;
}

function populateCategoryFilter() {
   const sel = $("#prodCatFilter");
   const current = sel.value;
   sel.innerHTML = '<option value="all">Semua Kategori</option>';
   state.categories.forEach((c) => {
      sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
   });
   sel.value = current;
}

function renderProducts() {
   populateCategoryFilter();
   renderProductTable();
}

function renderProductTable() {
   const filtered = getFilteredProducts();
   const { page, perPage } = state.prod;
   const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
   if (page > totalPages) state.prod.page = totalPages;
   const start = (state.prod.page - 1) * perPage;
   const items = filtered.slice(start, start + perPage);
   const tbody = $("#prodBody");

   if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="fas fa-box-open"></i><h4>Tidak ada produk</h4><p>Tambahkan produk pertama Anda</p></div></td></tr>`;
   } else {
      tbody.innerHTML = items
         .map((p) => {
            // Backward compat: produk lama mungkin tidak punya profit/margin tersimpan
            const displayProfit =
               p.profit !== undefined && p.profit !== null
                  ? p.profit
                  : calcProfit(p.sellingPrice, p.costPrice);
            const displayMargin =
               p.margin !== undefined && p.margin !== null
                  ? p.margin
                  : calcMargin(p.sellingPrice, p.costPrice);
            return `<tr>
      <td>${prodImg(p)}</td>
      <td><div style="display:flex;align-items:center;gap:8px">${p.featured ? '<i class="fas fa-star" style="color:var(--primary);font-size:11px" title="Unggulan"></i>' : ""}<div><strong style="font-size:13px">${p.name}</strong><br><small style="color:var(--text-muted)">${getCatName(p.categoryId)}</small></div></div></td>
      <td><strong style="color:var(--primary-dark)">${p.sku}</strong></td>
      <td>${fmtRp(p.costPrice)}</td><td>${fmtRp(p.sellingPrice)}</td>
      <td style="color:var(--success);font-weight:600">${fmtRp(displayProfit)}</td>
      <td><span style="font-weight:600;color:${displayMargin >= 40 ? "var(--success)" : displayMargin >= 25 ? "var(--warning)" : "var(--danger)"}">${displayMargin}%</span></td>
      <td><strong>${fmt(p.stock)}</strong></td>
      <td>${statusBadge(p.status)}</td>
      <td><div class="action-btns"><button class="action-btn" title="Edit" onclick="editProduct('${p.id}')"><i class="fas fa-pen"></i></button><button class="action-btn del" title="Hapus" onclick="confirmDeleteProduct('${p.id}','${(p.name || "").replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button></div></td>
    </tr>`;
         })
         .join("");
   }

   const end = Math.min(start + perPage, filtered.length);
   $("#prodInfo").textContent =
      filtered.length > 0
         ? `Menampilkan ${start + 1}–${end} dari ${filtered.length} produk`
         : "Tidak ada data";

   $("#prodPagination").innerHTML = renderPaginationHTML(state.prod.page, totalPages, "goProdPage");
}

window.goProdPage = function (n) {
   state.prod.page = n;
   renderProductTable();
};

let prodSearchTimeout;
$("#prodSearch").addEventListener("input", (e) => {
   clearTimeout(prodSearchTimeout);
   prodSearchTimeout = setTimeout(() => {
      state.prod.search = e.target.value;
      state.prod.page = 1;
      renderProductTable();
   }, 200);
});
$("#prodFilter").addEventListener("change", (e) => {
   state.prod.filter = e.target.value;
   state.prod.page = 1;
   renderProductTable();
});
$("#prodCatFilter").addEventListener("change", (e) => {
   state.prod.catFilter = e.target.value;
   state.prod.page = 1;
   renderProductTable();
});
$("#prodTable").addEventListener("click", (e) => {
   const th = e.target.closest("th");
   if (!th || !th.dataset.sort) return;
   const f = th.dataset.sort;
   if (state.prod.sort.field === f)
      state.prod.sort.dir = state.prod.sort.dir === "asc" ? "desc" : "asc";
   else {
      state.prod.sort.field = f;
      state.prod.sort.dir = "asc";
   }
   state.prod.page = 1;
   renderProductTable();
});

$("#exportProdBtn").addEventListener("click", () => {
   if (!state.products || state.products.length === 0) {
      toast("Tidak ada data produk untuk di-export", "warning");
      return;
   }

   // Initialize ExcelJS Workbook
   const workbook = new ExcelJS.Workbook();
   const worksheet = workbook.addWorksheet("Produk");

   worksheet.columns = [
      { header: "SKU", key: "sku", width: 16 },
      { header: "Nama", key: "name", width: 28 },
      { header: "Kategori", key: "kategori", width: 20 },
      { header: "Harga Modal", key: "costPrice", width: 16 },
      { header: "Harga Jual", key: "sellingPrice", width: 16 },
      { header: "Keuntungan", key: "profit", width: 16 },
      { header: "Margin", key: "margin", width: 12 },
      { header: "Stok", key: "stock", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Gambar", key: "gambar", width: 32 }
   ];

   // Style Header Row
   const headerRow = worksheet.getRow(1);
   headerRow.height = 26;
   headerRow.eachCell((cell) => {
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFF2C94C" } // Yellow color #f2c94c
      };
      cell.font = {
         name: "Arial",
         size: 10,
         bold: true
      };
      cell.border = {
         top: { style: "thin" },
         left: { style: "thin" },
         bottom: { style: "thin" },
         right: { style: "thin" }
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
   });

   let totalStock = 0;

   state.products.forEach((p) => {
      totalStock += p.stock || 0;

      const row = worksheet.addRow({
         sku: p.sku || "",
         name: p.name || "",
         kategori: getCatName(p.categoryId),
         costPrice: p.costPrice || 0,
         sellingPrice: p.sellingPrice || 0,
         profit: p.profit || 0,
         margin: (p.margin || 0) / 100, // Excel expects fractional decimal for percentage formatting
         stock: p.stock || 0,
         status: p.status || "",
         gambar: p.images && p.images[0] ? p.images[0].imageUrl : ""
      });

      row.eachCell((cell, colNumber) => {
         cell.font = { name: "Arial", size: 10 };
         cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
         };

         if (colNumber === 1 || colNumber === 8 || colNumber === 9) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
         } else if (colNumber === 2 || colNumber === 3 || colNumber === 10) {
            cell.alignment = { vertical: "middle", horizontal: "left" };
         } else if (colNumber === 4 || colNumber === 5 || colNumber === 6) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "#,##0";
         } else if (colNumber === 7) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "0%";
         }
      });
   });

   // Add Total Row at the bottom
   const totalRow = worksheet.addRow({
      sku: "TOTAL",
      name: "",
      kategori: "",
      costPrice: "",
      sellingPrice: "",
      profit: "",
      margin: "",
      stock: totalStock,
      status: "",
      gambar: ""
   });
   totalRow.height = 24;
   totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFFFE57F" } // Light amber accent
      };
      cell.border = {
         top: { style: "double" },
         bottom: { style: "double" },
         left: { style: "thin" },
         right: { style: "thin" }
      };

      if (colNumber === 8) {
         cell.alignment = { vertical: "middle", horizontal: "center" };
         cell.numFmt = "#,##0";
      } else {
         cell.alignment = { vertical: "middle", horizontal: "left" };
      }
   });

   workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `produk_${today}.xlsx`;
      a.click();
      toast("Data produk di-export ke Excel", "success");
   });
});

/* --- Product Form --- */
function productFormHTML(p = null) {
   const v = p || {
      name: "",
      categoryId: state.categories[0]?.id || "",
      description: "",
      costPrice: 0,
      sellingPrice: 0,
      stock: 0,
      featured: false,
      status: "active",
   };
   const catOpts = state.categories
      .map(
         (c) =>
            `<option value="${c.id}" ${v.categoryId === c.id ? "selected" : ""}>${c.name}</option>`,
      )
      .join("");
   const existingImg =
      p && p.images && p.images.length > 0 ? p.images[0].imageUrl : "";
   const previewHTML = state.tempImageData
      ? `<img src="${state.tempImageData.imageUrl}" alt="Preview"><br><button type="button" class="btn btn-outline btn-sm" style="margin-top:8px" onclick="removeImage()"><i class="fas fa-trash"></i> Hapus Gambar</button>`
      : existingImg
        ? `<img src="${existingImg}" alt="Preview"><br><button type="button" class="btn btn-outline btn-sm" style="margin-top:8px" onclick="removeImage()"><i class="fas fa-trash"></i> Hapus Gambar</button>`
        : "";

   // Detect if this is an imported product (has sourceProductId, importedFrom, or non-standard SKU prefix)
   const isImported = p && !!(p.sourceProductId || p.importedFrom);
   // Default regenerate: checked for imported, unchecked for native
   const regenDefault = isImported ? "checked" : "";

   return `
    <input type="hidden" id="fOriginalCatId" value="${p ? v.categoryId || "" : ""}">
    <div class="form-row"><div class="form-group full"><label>Nama Produk</label><input type="text" class="form-input" id="fName" value="${v.name || ""}" required></div></div>
    <div class="form-row">
      <div class="form-group"><label>Kategori</label><select class="form-input" id="fCat" onchange="onCategoryChange()">${catOpts}</select></div>
      <div class="form-group"><label>SKU (otomatis)</label><input type="text" class="form-input" id="fSku" value="${p ? p.sku : generateSKU(v.categoryId)}" readonly></div>
    </div>
    <div id="fRegenSkuRow" style="display:none;margin:-8px 0 12px 0;padding:10px 14px;background:var(--primary-light);border-radius:var(--radius-sm)">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="fRegenSku" ${regenDefault} onchange="onRegenSkuChange()">
        Regenerate SKU sesuai kategori baru
      </label>
      <div id="fRegenSkuPreview" style="font-size:12px;color:var(--text-muted);margin-top:4px"></div>
    </div>
    <div class="form-group"><label>Deskripsi</label><textarea class="form-input" id="fDesc" rows="2">${v.description || ""}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Harga Modal (Rp)</label><input type="number" class="form-input" id="fCost" value="${v.costPrice}" min="0" oninput="calcFormProfit()"></div>
      <div class="form-group"><label>Harga Jual (Rp)</label><input type="number" class="form-input" id="fSell" value="${v.sellingPrice}" min="0" oninput="calcFormProfit()"></div>
    </div>
    <div style="padding:10px 14px;background:var(--primary-light);border-radius:var(--radius-sm);font-size:13px;margin-bottom:16px;display:flex;gap:20px">
      <span>Keuntungan: <strong id="fProfitDisplay">${fmtRp(calcProfit(v.sellingPrice, v.costPrice))}</strong></span>
      <span>Margin: <strong id="fMarginDisplay">${calcMargin(v.sellingPrice, v.costPrice)}%</strong></span>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Stok Awal</label><input type="number" class="form-input" id="fStock" value="${v.stock}" min="0"></div>
      <div class="form-group"><label>Status</label><select class="form-input" id="fStatus"><option value="active" ${v.status === "active" ? "selected" : ""}>Aktif</option><option value="in_production" ${v.status === "in_production" ? "selected" : ""}>Dalam Produksi</option><option value="pre_order" ${v.status === "pre_order" ? "selected" : ""}>Pre Order</option><option value="low_stock" ${v.status === "low_stock" ? "selected" : ""}>Stok Rendah</option><option value="inactive" ${v.status === "inactive" ? "selected" : ""}>Nonaktif</option></select></div>
    </div>
    <div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="fFeatured" ${v.featured ? "checked" : ""}> Produk Unggulan</label></div>
    <div class="form-group">
      <label>Gambar Produk</label>
      <div class="image-upload-area" id="imagePreview" style="cursor:pointer" onclick="document.getElementById('fImageFile').click()">
        ${previewHTML || `<div style="padding:24px;text-align:center;color:var(--text-muted)"><i class="fas fa-cloud-upload-alt" style="font-size:32px;display:block;margin-bottom:10px;opacity:.4"></i><p style="font-size:13px">Klik untuk pilih gambar</p><p style="font-size:11px;opacity:.7">JPG, PNG, WebP — Maks 10MB</p><p style="font-size:11px;opacity:.7;margin-top:4px">Otomatis dikompres Cloudinary</p></div>`}
      </div>
      <input type="file" id="fImageFile" accept="image/jpeg,image/png,image/webp,image/jpg" style="display:none" onchange="handleImageUpload(this)">
    </div>`;
}

window.onCategoryChange = function () {
   const catId = $("#fCat").value;
   const originalCatEl = document.getElementById("fOriginalCatId");

   // New product form (no hidden original cat field) — always regenerate SKU
   if (!originalCatEl || originalCatEl.value === "") {
      $("#fSku").value = generateSKU(catId);
      return;
   }

   // Edit product form — show/hide regenerate option when category differs
   const originalCatId = originalCatEl.value;
   const regenRow = document.getElementById("fRegenSkuRow");
   const regenCheckbox = document.getElementById("fRegenSku");
   const editingId = state._editingProductId || null;

   if (catId !== originalCatId) {
      // Category has changed — show the regenerate option
      regenRow.style.display = "";
      // Update SKU field and preview based on current checkbox state
      onRegenSkuChange();
   } else {
      // Category restored to original — hide regenerate option, restore original SKU
      regenRow.style.display = "none";
      const p = editingId
         ? state.products.find((x) => x.id === editingId)
         : null;
      if (p) $("#fSku").value = p.sku;
   }
};

window.onRegenSkuChange = function () {
   const catId = $("#fCat").value;
   const regenCheckbox = document.getElementById("fRegenSku");
   const editingId = state._editingProductId || null;
   const p = editingId ? state.products.find((x) => x.id === editingId) : null;
   const preview = document.getElementById("fRegenSkuPreview");

   if (regenCheckbox && regenCheckbox.checked) {
      const newSku = generateSKU(catId, editingId || undefined);
      $("#fSku").value = newSku;
      if (preview) preview.textContent = "SKU baru: " + newSku;
   } else {
      // Keep old SKU
      if (p) $("#fSku").value = p.sku;
      if (preview)
         preview.textContent = "SKU lama dipertahankan: " + (p ? p.sku : "");
   }
};
window.calcFormProfit = function () {
   const cp = parsePrice($("#fCost").value),
      sp = parsePrice($("#fSell").value);
   $("#fProfitDisplay").textContent = fmtRp(calcProfit(sp, cp));
   $("#fMarginDisplay").textContent = calcMargin(sp, cp) + "%";
};

$("#addProdBtn").addEventListener("click", () => {
   state.tempImageData = null;
   state._editingProductId = null;
   openModal(
      "Tambah Produk Baru",
      productFormHTML(),
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-primary btn-sm" onclick="saveNewProduct()"><i class="fas fa-check"></i>Simpan</button>`,
   );
});

/* =========================================================
   PRODUK — SAVE (FIXED: no duplicate, no const reassign)
   ========================================================= */
function getFormVal(id, fallback = "") {
   const el = document.getElementById(id);
   return el ? el.value : fallback;
}

window.saveNewProduct = async function () {
   const name = getFormVal("fName").trim();
   if (!name) {
      toast("Nama produk wajib diisi", "warning");
      return;
   }
   const cp = parsePrice(getFormVal("fCost", "0"));
   const sp = parsePrice(getFormVal("fSell", "0"));
   const catId = getFormVal("fCat", "");

   if (cp < 0 || sp < 0) {
      toast("Harga tidak boleh negatif", "warning");
      return;
   }
   if (sp < cp)
      toast(
         "Harga jual lebih rendah dari harga modal — margin negatif",
         "warning",
      );

   // Ambil SKU dari form; jika sudah dipakai regenerate (generateSKU sudah skip ke sequence unik)
   let sku = getFormVal("fSku", generateSKU(catId));
   if (!isSkuUnique(sku)) {
      sku = generateSKU(catId);
      if (!isSkuUnique(sku)) {
         toast("Tidak dapat membuat SKU unik untuk kategori ini.", "error");
         return;
      }
      $("#fSku").value = sku;
   }

   const productData = sanitize({
      name: name,
      sku: sku,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      categoryId: getFormVal("fCat", ""),
      description: getFormVal("fDesc", ""),
      costPrice: cp,
      sellingPrice: sp,
      profit: calcProfit(sp, cp),
      margin: calcMargin(sp, cp),
      stock: parseInt(getFormVal("fStock", "0")) || 0,
      status: getFormVal("fStatus", "active"),
      featured: !!document.getElementById("fFeatured")?.checked,
      images: state.tempImageData ? [state.tempImageData] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
   });

   try {
      await db.collection("products").add(productData);
      state.tempImageData = null;
      toast("Produk berhasil ditambahkan", "success");
      closeModal();
   } catch (err) {
      console.error("Save new product error:", err);
      toast("Gagal menambahkan produk: " + err.message, "error");
   }
};

window.editProduct = function (id) {
   const p = state.products.find((x) => x.id === id);
   if (!p) {
      toast("Produk tidak ditemukan", "error");
      return;
   }
   state.tempImageData = null;
   state._editingProductId = id;
   openModal(
      "Edit Produk",
      productFormHTML(p),
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-primary btn-sm" onclick="saveEditProduct('${id}')"><i class="fas fa-check"></i>Update</button>`,
   );
};

window.saveEditProduct = async function (id) {
   const name = getFormVal("fName").trim();
   if (!name) {
      toast("Nama produk wajib diisi", "warning");
      return;
   }
   const cp = parsePrice(getFormVal("fCost", "0"));
   const sp = parsePrice(getFormVal("fSell", "0"));

   if (cp < 0 || sp < 0) {
      toast("Harga tidak boleh negatif", "warning");
      return;
   }
   if (sp < cp)
      toast(
         "Harga jual lebih rendah dari harga modal — margin negatif",
         "warning",
      );

   const p = state.products.find((x) => x.id === id);
   const images = state.tempImageData
      ? [state.tempImageData]
      : p && p.images
        ? p.images
        : [];

   const newCatId = getFormVal("fCat", p ? p.categoryId : "");
   const originalCatId = getFormVal("fOriginalCatId", p ? p.categoryId : "");
   const categoryChanged = newCatId !== originalCatId;
   const regenCheckbox = document.getElementById("fRegenSku");
   const shouldRegen =
      categoryChanged && regenCheckbox && regenCheckbox.checked;

   // Determine final SKU
   let finalSku = p ? p.sku : getFormVal("fSku", "");
   if (shouldRegen) {
      // Use the SKU already previewed in the form field (generated by onRegenSkuChange)
      const formSku = getFormVal("fSku", "");
      if (formSku && isSkuUnique(formSku, id)) {
         finalSku = formSku;
      } else {
         // Fallback: regenerate fresh
         finalSku = generateSKU(newCatId, id);
         if (!isSkuUnique(finalSku, id)) {
            toast(
               "Gagal membuat SKU unik untuk kategori ini. SKU lama dipertahankan.",
               "warning",
            );
            finalSku = p ? p.sku : getFormVal("fSku", "");
         }
      }
   }

   const productData = sanitize({
      name: name,
      sku: finalSku,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      categoryId: newCatId,
      description: getFormVal("fDesc", ""),
      costPrice: cp,
      sellingPrice: sp,
      profit: calcProfit(sp, cp),
      margin: calcMargin(sp, cp),
      stock: parseInt(getFormVal("fStock", "0")) || 0,
      status: getFormVal("fStatus", p ? p.status : "active"),
      featured: !!document.getElementById("fFeatured")?.checked,
      images: images,
      updatedAt: new Date().toISOString(),
   });

   try {
      await db.collection("products").doc(id).update(productData);
      state.tempImageData = null;
      state._editingProductId = null;
      if (categoryChanged) {
         toast(
            shouldRegen
               ? "Produk diupdate — kategori dan SKU diperbarui"
               : "Produk diupdate — kategori diperbarui, SKU lama dipertahankan",
            "success",
         );
      } else {
         toast("Produk berhasil diupdate", "success");
      }
      closeModal();
   } catch (err) {
      console.error("Save edit product error:", err);
      toast("Gagal update produk: " + err.message, "error");
   }
};

window.confirmDeleteProduct = function (id, name) {
   openModal(
      "Konfirmasi Hapus",
      `<div style="text-align:center;padding:10px 0"><i class="fas fa-trash" style="font-size:40px;color:var(--danger);opacity:.6;margin-bottom:14px;display:block"></i><p style="font-size:15px;font-weight:600">Hapus produk ini?</p><p style="font-size:13px;color:var(--text-muted);margin-top:6px">"${name}" akan dihapus permanen.</p></div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-danger btn-sm" onclick="doDeleteProduct('${id}')"><i class="fas fa-trash"></i>Hapus</button>`,
   );
};

window.doDeleteProduct = async function (id) {
   const product = state.products.find((x) => x.id === id);
   const imagesToDelete = product && product.images ? [...product.images] : [];

   try {
      await db.collection("products").doc(id).delete();
      if (imagesToDelete.length > 0) {
         deleteCloudinaryImage(imagesToDelete).then(() => {
            console.log("Semua gambar produk dihapus dari Cloudinary");
         });
      }
      toast("Produk dihapus", "success");
      closeModal();
   } catch (err) {
      toast("Gagal menghapus: " + err.message, "error");
   }
};

/* =========================================================
   KATEGORI
   ========================================================= */
function renderCategories() {
   state.categories.forEach((c) => {
      c.productCount = state.products.filter(
         (p) => p.categoryId === c.id,
      ).length;
   });

   if (!state.categories.length) {
      $("#catAccordion").innerHTML =
         '<div class="empty-state"><i class="fas fa-tags"></i><h4>Belum ada kategori</h4><p>Tambahkan kategori pertama Anda</p></div>';
      return;
   }

   $("#catAccordion").innerHTML = state.categories
      .map((c) => {
         const products = state.products.filter((p) => p.categoryId === c.id);
         const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
         const totalValue = products.reduce(
            (s, p) => s + (p.stock || 0) * (p.sellingPrice || 0),
            0,
         );

         let tableRows = "";
         if (products.length) {
            tableRows = products
               .map(
                  (p) => `<tr>
        <td>${prodImg(p, 32)}</td>
        <td><strong style="font-size:13px">${p.name}</strong></td>
        <td style="color:var(--primary-dark);font-weight:600;font-size:12px">${p.sku}</td>
        <td>${fmtRp(p.sellingPrice)}</td>
        <td style="font-weight:600">${fmt(p.stock)}</td>
        <td>${statusBadge(p.status)}</td>
      </tr>`,
               )
               .join("");
         } else {
            tableRows = `<tr><td colspan="6"><div class="cat-acc-empty"><i class="fas fa-box-open"></i>Belum ada produk di kategori ini</div></td></tr>`;
         }

         return `
    <div class="cat-accordion-item" id="cat-${c.id}">
      <div class="cat-accordion-header" onclick="toggleCategory('${c.id}')">
        <div class="cat-acc-icon"><i class="fas fa-tag"></i></div>
        <div class="cat-acc-info">
          <h4>${c.name}</h4>
          <p>${c.description || "Tanpa deskripsi"} — ${totalStock} unit stok · Nilai: ${fmtRp(totalValue)}</p>
        </div>
        <span class="cat-acc-count">${c.productCount} Produk</span>
        <div class="cat-acc-actions" onclick="event.stopPropagation()">
          <button class="action-btn" title="Edit" onclick="editCategory('${c.id}')"><i class="fas fa-pen"></i></button>
          <button class="action-btn del" title="Hapus" onclick="confirmDeleteCategory('${c.id}','${(c.name || "").replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
        </div>
        <i class="fas fa-chevron-down cat-chevron"></i>
      </div>
      <div class="cat-accordion-body">
        <div class="cat-acc-inner">
          <table class="cat-acc-inner-table">
            <thead><tr>
              <th>Gambar</th><th>Produk</th><th>SKU</th><th>Harga Jual</th><th>Stok</th><th>Status</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
      })
      .join("");
}

window.toggleCategory = function (id) {
   const item = document.getElementById("cat-" + id);
   if (item) item.classList.toggle("open");
};

$("#addCatBtn").addEventListener("click", () => {
   openModal(
      "Tambah Kategori",
      `<div class="form-group"><label>Nama Kategori</label><input type="text" class="form-input" id="fCatName" placeholder="Contoh: Helmet Bag"></div><div class="form-group"><label>Kode SKU <small style="color:var(--text-muted);font-weight:400">(2 huruf, contoh: TB, SB, HB)</small></label><input type="text" class="form-input" id="fCatSku" placeholder="Contoh: HB" maxlength="2" oninput="this.value=this.value.toUpperCase().replace(/[^A-Z]/g,'')"></div><div class="form-group"><label>Deskripsi</label><input type="text" class="form-input" id="fCatDesc" placeholder="Deskripsi singkat"></div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-primary btn-sm" onclick="saveNewCategory()"><i class="fas fa-check"></i>Simpan</button>`,
   );
});
window.saveNewCategory = async function () {
   const n = $("#fCatName").value.trim();
   if (!n) {
      toast("Nama wajib diisi", "warning");
      return;
   }

   const rawSku = ($("#fCatSku") ? $("#fCatSku").value : "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 2);
   if (!rawSku) {
      toast("Kode SKU wajib diisi (2 huruf)", "warning");
      return;
   }

   // Validasi uniqueness skuCode
   const duplicate = state.categories.find(
      (c) => c.skuCode && c.skuCode.toUpperCase() === rawSku,
   );
   if (duplicate) {
      toast(
         'Kode SKU "' +
            rawSku +
            '" sudah dipakai oleh kategori "' +
            duplicate.name +
            '"',
         "error",
      );
      return;
   }

   try {
      await db.collection("categories").add({
         name: n,
         slug: n.toLowerCase().replace(/\s+/g, "-"),
         description: $("#fCatDesc").value,
         skuCode: rawSku,
         productCount: 0,
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString(),
      });
      toast("Kategori ditambahkan", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};
window.editCategory = function (id) {
   const c = state.categories.find((x) => x.id === id);
   if (!c) return;
   openModal(
      "Edit Kategori",
      `<div class="form-group"><label>Nama Kategori</label><input type="text" class="form-input" id="fCatName" value="${c.name}"></div><div class="form-group"><label>Kode SKU <small style="color:var(--text-muted);font-weight:400">(2 huruf, contoh: TB, SB)</small></label><input type="text" class="form-input" id="fCatSku" value="${c.skuCode || ""}" maxlength="2" oninput="this.value=this.value.toUpperCase().replace(/[^A-Z]/g,'')"></div><div class="form-group"><label>Deskripsi</label><input type="text" class="form-input" id="fCatDesc" value="${c.description || ""}"></div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-primary btn-sm" onclick="saveEditCategory('${id}')"><i class="fas fa-check"></i>Update</button>`,
   );
};
window.saveEditCategory = async function (id) {
   const n = $("#fCatName").value.trim();
   if (!n) {
      toast("Nama wajib diisi", "warning");
      return;
   }

   const rawSku = ($("#fCatSku") ? $("#fCatSku").value : "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 2);
   if (!rawSku) {
      toast("Kode SKU wajib diisi (2 huruf)", "warning");
      return;
   }

   // Validasi uniqueness — exclude kategori yang sedang diedit
   const duplicate = state.categories.find(
      (c) => c.id !== id && c.skuCode && c.skuCode.toUpperCase() === rawSku,
   );
   if (duplicate) {
      toast(
         'Kode SKU "' +
            rawSku +
            '" sudah dipakai oleh kategori "' +
            duplicate.name +
            '"',
         "error",
      );
      return;
   }

   try {
      await db
         .collection("categories")
         .doc(id)
         .update({
            name: n,
            slug: n.toLowerCase().replace(/\s+/g, "-"),
            description: $("#fCatDesc").value,
            skuCode: rawSku,
            updatedAt: new Date().toISOString(),
         });
      toast("Kategori diupdate", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};
window.confirmDeleteCategory = function (id, name) {
   openModal(
      "Konfirmasi Hapus",
      `<div style="text-align:center;padding:10px 0"><i class="fas fa-trash" style="font-size:40px;color:var(--danger);opacity:.6;margin-bottom:14px;display:block"></i><p style="font-size:15px;font-weight:600">Hapus kategori "${name}"?</p></div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-danger btn-sm" onclick="doDeleteCategory('${id}')"><i class="fas fa-trash"></i>Hapus</button>`,
   );
};
window.doDeleteCategory = async function (id) {
   try {
      await db.collection("categories").doc(id).delete();
      toast("Kategori dihapus", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

/* =========================================================
   PRODUKSI
   ========================================================= */
function renderProduction() {
   // Summary uses selected date filter, default to today
   const summaryDate = state.prodOrder.dateFilter || today;
   const tp = state.production.filter((p) => (p.date || "") === summaryDate);
   const totalTarget = tp.reduce((s, p) => s + (p.targetQty || 0), 0);
   const totalCompleted = tp.reduce((s, p) => s + (p.completedQty || 0), 0);
   const pctDone =
      totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
   const summaryLabel = summaryDate === today ? "Hari Ini" : summaryDate;
   $("#prodStats").innerHTML = [
      {
         label: "Target Produksi",
         value: totalTarget,
         sub: summaryLabel,
         icon: "fa-bullseye",
         cls: "gold",
      },
      {
         label: "Selesai",
         value: totalCompleted,
         sub: "Unit selesai",
         icon: "fa-check-circle",
         cls: "green",
      },
      {
         label: "Persentase",
         value: pctDone + "%",
         sub: "penyelesaian",
         icon: "fa-percent",
         cls: pctDone >= 80 ? "green" : "gold",
      },
   ]
      .map(
         (c) =>
            `<div class="stat-card ${c.cls}"><div class="sc-top"><div class="sc-icon"><i class="fas ${c.icon}"></i></div><span class="sc-label">${c.label}</span></div><div class="sc-value">${c.value}</div><div class="sc-sub">${c.sub}</div></div>`,
      )
      .join("");

   // Sync date filter input if rendered
   const dateEl = $("#prodDateFilter");
   if (dateEl && !dateEl.value) dateEl.value = today;

   renderProductionTable();
}

function renderProductionTable() {
   let list = [...state.production];

   // Date filter
   if (state.prodOrder.dateFilter) {
      list = list.filter((p) => (p.date || "") === state.prodOrder.dateFilter);
   }
   // Search
   if (state.prodOrder.search) {
      const q = state.prodOrder.search.toLowerCase();
      list = list.filter(
         (p) =>
            (p.productName || "").toLowerCase().includes(q) ||
            (p.sku || "").toLowerCase().includes(q),
      );
   }
   // Status filter
   if (state.prodOrder.filter !== "all")
      list = list.filter((p) => p.status === state.prodOrder.filter);

   list.sort((a, b) => {
      const aPct = a.targetQty > 0 ? (a.completedQty || 0) / a.targetQty : 0;
      const bPct = b.targetQty > 0 ? (b.completedQty || 0) / b.targetQty : 0;
      const aDone = aPct >= 1 ? 1 : 0;
      const bDone = bPct >= 1 ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return (b.date || "").localeCompare(a.date || "");
   });

   const { page, perPage } = state.prodOrder;
   const total = Math.max(1, Math.ceil(list.length / perPage));
   if (page > total) state.prodOrder.page = total;
   const start = (state.prodOrder.page - 1) * perPage;
   const items = list.slice(start, start + perPage);

   $("#prodOrderBody").innerHTML = items.length
      ? items
           .map((p) => {
              const pctDone =
                 p.targetQty > 0
                    ? Math.round(((p.completedQty || 0) / p.targetQty) * 100)
                    : 0;
              const fillCls =
                 pctDone >= 100
                    ? "fill-green"
                    : pctDone >= 50
                      ? "fill-gold"
                      : "fill-red";
              const prod = findProduct(p.productId, p.productName);
              const dateDisplay =
                 p.date || '<span style="color:var(--text-muted)">—</span>';
              const isToday = p.date === today;
              return `<tr>
      <td>${prodImg(prod, 32)}</td>
      <td><strong>${p.productName}</strong></td>
      <td>${p.sku || "—"}</td>
      <td>${p.targetQty || 0}</td>
      <td>${p.completedQty || 0}</td>
      <td style="min-width:100px"><div style="display:flex;align-items:center;gap:8px"><div class="progress-bar" style="flex:1"><div class="fill ${fillCls}" style="width:${pctDone}%"></div></div><span style="font-size:12px;font-weight:600">${pctDone}%</span></div></td>
      <td><strong style="color:${isToday ? "var(--success)" : "var(--text)"}">${dateDisplay}</strong>${isToday ? ' <small style="color:var(--success);font-size:10px">Hari ini</small>' : ""}</td>
      <td>${prodStatusBadge(p.status)}</td>
      <td><div class="action-btns"><button class="action-btn" title="Update" onclick="updateProdStatus('${p.id}')"><i class="fas fa-pen"></i></button><button class="action-btn del" title="Hapus" onclick="deleteProductionOrder('${p.id}')"><i class="fas fa-trash"></i></button></div></td>
    </tr>`;
           })
           .join("")
      : `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-industry"></i><h4>Tidak ada data produksi</h4>${state.prodOrder.dateFilter ? `<p>Tidak ada produksi pada ${state.prodOrder.dateFilter}</p>` : ""}</div></td></tr>`;

   const end = Math.min(start + perPage, list.length);
   $("#prodOrderInfo").textContent =
      list.length > 0
         ? `Menampilkan ${start + 1}–${end} dari ${list.length}`
         : "";
   $("#prodOrderPag").innerHTML = renderPaginationHTML(state.prodOrder.page, total, "goProdOrderPage");
}

window.goProdOrderPage = function (n) {
   state.prodOrder.page = n;
   renderProductionTable();
};
let poSearchTimeout;
$("#prodProdSearch").addEventListener("input", (e) => {
   clearTimeout(poSearchTimeout);
   poSearchTimeout = setTimeout(() => {
      state.prodOrder.search = e.target.value;
      state.prodOrder.page = 1;
      renderProductionTable();
   }, 200);
});
$("#prodStatusFilter").addEventListener("change", (e) => {
   state.prodOrder.filter = e.target.value;
   state.prodOrder.page = 1;
   renderProductionTable();
});

// Date filter — rerender both summary + table
const prodDateFilterEl = $("#prodDateFilter");
if (prodDateFilterEl) {
   prodDateFilterEl.value = today;
   prodDateFilterEl.addEventListener("change", (e) => {
      state.prodOrder.dateFilter = e.target.value;
      state.prodOrder.page = 1;
      renderProduction();
   });
}
window.clearProdDateFilter = function () {
   state.prodOrder.dateFilter = "";
   state.prodOrder.page = 1;
   const el = $("#prodDateFilter");
   if (el) el.value = "";
   renderProduction();
};
const clearProdDateBtn = $("#clearProdDateBtn");
if (clearProdDateBtn) {
   clearProdDateBtn.addEventListener("click", window.clearProdDateFilter);
}

$("#addProdOrderBtn").addEventListener("click", () => {
   const opts = state.products
      .map((p) => `<option value="${p.id}">${p.name} (${p.sku})</option>`)
      .join("");
   openModal(
      "Tambah Order Produksi",
      `<div class="form-group"><label>Produk</label><select class="form-input" id="fPOProd">${opts}</select></div><div class="form-row"><div class="form-group"><label>Target Quantity</label><input type="number" class="form-input" id="fPOTarget" value="10" min="1"></div><div class="form-group"><label>Tanggal</label><input type="date" class="form-input" id="fPODate" value="${today}"></div></div><div class="form-group"><label>Catatan</label><input type="text" class="form-input" id="fPONotes" placeholder="Opsional"></div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-primary btn-sm" onclick="saveProdOrder()"><i class="fas fa-check"></i>Simpan</button>`,
   );
});
window.saveProdOrder = async function () {
   const pid = $("#fPOProd").value,
      p = state.products.find((x) => x.id === pid);
   if (!p) return;
   try {
      await db.collection("production").add({
         productId: pid,
         productName: p.name,
         sku: p.sku,
         targetQty: parseInt($("#fPOTarget").value) || 0,
         completedQty: 0,
         date: $("#fPODate").value,
         status: "pending",
         notes: $("#fPONotes").value,
      });
      toast("Order produksi ditambahkan", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};
window.updateProdStatus = function (id) {
   const p = state.production.find((x) => x.id === id);
   if (!p) return;
   openModal(
      "Update Status Produksi",
      `<div style="margin-bottom:16px"><strong>${p.productName}</strong> — ${p.sku}</div><div class="form-row"><div class="form-group"><label>Selesai (unit)</label><input type="number" class="form-input" id="fUPCompleted" value="${p.completedQty || 0}" min="0" max="${p.targetQty}"></div><div class="form-group"><label>Status</label><select class="form-input" id="fUPStatus"><option value="pending" ${p.status === "pending" ? "selected" : ""}>Pending</option><option value="in_progress" ${p.status === "in_progress" ? "selected" : ""}>Dalam Proses</option><option value="qc" ${p.status === "qc" ? "selected" : ""}>Quality Control</option><option value="completed" ${p.status === "completed" ? "selected" : ""}>Selesai</option></select></div></div><div class="form-group"><label>Catatan</label><input type="text" class="form-input" id="fUPNotes" value="${p.notes || ""}"></div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-primary btn-sm" onclick="doUpdateProdStatus('${id}')"><i class="fas fa-check"></i>Update</button>`,
   );
};
window.doUpdateProdStatus = async function (id) {
   const completed = parseInt($("#fUPCompleted").value) || 0;
   const newStatusVal = $("#fUPStatus").value;
   const p = state.production.find((x) => x.id === id);
   try {
      await db
         .collection("production")
         .doc(id)
         .update({
            completedQty: completed,
            status: newStatusVal,
            notes: $("#fUPNotes").value,
         });
      if (newStatusVal === "completed" && p) {
         const oldCompleted = p.completedQty || 0;
         const diff = completed - oldCompleted;
         if (diff > 0) {
            const prod = state.products.find((x) => x.id === p.productId);
            if (prod) {
               const newStock = (prod.stock || 0) + diff;
               const prodNewStatus =
                  newStock <= 0
                     ? "out_of_stock"
                     : newStock <= 5
                       ? "low_stock"
                       : "active";
               await db.collection("products").doc(p.productId).update({
                  stock: newStock,
                  status: prodNewStatus,
                  updatedAt: new Date().toISOString(),
               });
            }
         }
      }
      toast("Status produksi diupdate", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

window.deleteProductionOrder = async function (docId) {
   if (!confirm("Yakin ingin menghapus data produksi ini?")) return;

   try {
      const prodRef = db.collection("production").doc(docId);
      const snap = await prodRef.get();
      if (!snap.exists) {
         toast("Data produksi tidak ditemukan", "error");
         return;
      }

      const data = snap.data() || {};
      const isCompleted =
         data.status === "completed" || data.status === "Selesai";
      const completedQty = Number(data.completedQty || data.quantity || 0);

      if (isCompleted && data.productId && completedQty > 0) {
         await db
            .collection("products")
            .doc(data.productId)
            .update({
               stock: firebase.firestore.FieldValue.increment(-completedQty),
               updatedAt: new Date().toISOString(),
            });
      }

      await prodRef.delete();
      toast("Data berhasil dihapus", "success");
      renderProduction();
   } catch (err) {
      toast("Gagal menghapus produksi: " + err.message, "error");
   }
};

/* =========================================================
   INVENTARIS / STOCK CONTROL
   ========================================================= */

// Helper: apakah suatu date lebih dari 1 bulan lalu?
function isOlderThanOneMonth(dateStr) {
   if (!dateStr) return false;
   const d = new Date(dateStr);
   if (isNaN(d)) return false;
   const cutoff = new Date();
   cutoff.setMonth(cutoff.getMonth() - 1);
   return d < cutoff;
}

function renderInventory() {
   const q = ($("#invSearch") ? $("#invSearch").value : "").toLowerCase();
   const filterVal = $("#invFilter") ? $("#invFilter").value : "all";
   let list = [...state.products];
   if (q)
      list = list.filter(
         (p) =>
            (p.name || "").toLowerCase().includes(q) ||
            (p.sku || "").toLowerCase().includes(q),
      );
   if (filterVal === "safe") list = list.filter((p) => p.stock > 5);
   else if (filterVal === "low")
      list = list.filter((p) => p.stock > 0 && p.stock <= 5);
   else if (filterVal === "out") list = list.filter((p) => p.stock <= 0);

   const todayIn = {},
      todayOut = {};
   state.stockMovements
      .filter((m) => m.date === today && !m.deleted)
      .forEach((m) => {
         if (m.type === "in")
            todayIn[m.productId] = (todayIn[m.productId] || 0) + m.qty;
         else todayOut[m.productId] = (todayOut[m.productId] || 0) + m.qty;
      });

   $("#invBody").innerHTML = list.length
      ? list
           .map((p) => {
              const sIn = todayIn[p.id] || 0,
                 sOut = todayOut[p.id] || 0;
              const opening = p.stock - sIn + sOut;
              const st =
                 p.stock > 5 ? "Aman" : p.stock > 0 ? "Stok Rendah" : "Habis";
              const stCls =
                 p.stock > 5
                    ? "badge-active"
                    : p.stock > 0
                      ? "badge-low_stock"
                      : "badge-out_of_stock";
              return `<tr><td>${prodImg(p, 32)}</td><td><strong style="color:var(--primary-dark)">${p.sku}</strong></td><td>${p.name}</td><td>${opening}</td><td style="color:var(--success);font-weight:600">+${sIn}</td><td style="color:var(--danger);font-weight:600">-${sOut}</td><td><strong>${p.stock}</strong></td><td><span class="badge ${stCls}">${st}</span></td></tr>`;
           })
           .join("")
      : `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-boxes-stacked"></i><h4>Tidak ada data</h4></div></td></tr>`;
   $("#invInfo").textContent = `Menampilkan ${list.length} produk`;

   renderStockHistory();
}

function renderStockHistory() {
   const { search, filter, page, perPage } = state.stockHistory;

   // Base: exclude soft-deleted
   let movements = state.stockMovements.filter((m) => !m.deleted);

   // Apply history filter
   if (filter === "bulan_ini") {
      // Show only: within last month AND not manually archived
      movements = movements.filter(
         (m) => m.date && !isOlderThanOneMonth(m.date) && !m.archived,
      );
   } else if (filter === "arsip") {
      // Show: manually archived OR date older than 1 month OR missing date
      movements = movements.filter(
         (m) => m.archived === true || !m.date || isOlderThanOneMonth(m.date),
      );
   }
   // 'semua' = no additional filter

   // Search within SKU, productName, note
   if (search) {
      const q = search.toLowerCase();
      movements = movements.filter(
         (m) =>
            (m.sku || "").toLowerCase().includes(q) ||
            (m.productName || "").toLowerCase().includes(q) ||
            (m.note || "").toLowerCase().includes(q),
      );
   }

   // Sort newest first
   movements = [...movements].sort((a, b) =>
      (b.date || "").localeCompare(a.date || ""),
   );

   const total = Math.max(1, Math.ceil(movements.length / perPage));
   if (page > total) state.stockHistory.page = 1;
   const start = (state.stockHistory.page - 1) * perPage;
   const items = movements.slice(start, start + perPage);

   // ---- Render filter toolbar ----
   const filterLabel = {
      bulan_ini: "Bulan Ini",
      arsip: "Arsip",
      semua: "Semua",
   };
   const filterBtns = Object.entries(filterLabel)
      .map(
         ([val, lbl]) =>
            `<button class="btn btn-sm ${filter === val ? "btn-primary" : "btn-outline"}" onclick="onStockHistoryFilter('${val}')">${lbl}</button>`,
      )
      .join("");

   const historyToolbar = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--border-light)">
      <div class="table-search" style="flex:1;min-width:180px;max-width:260px">
        <i class="fas fa-search"></i>
        <input type="text" placeholder="Cari SKU, produk, catatan..." value="${search}" oninput="onStockHistorySearch(this.value)" style="width:100%;padding:8px 14px 8px 36px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:13px">
      </div>
      <div style="display:flex;gap:6px">${filterBtns}</div>
      <span style="margin-left:auto;font-size:12px;color:var(--text-muted)">${movements.length} pergerakan</span>
    </div>`;

   // ---- Render rows ----
   const rows = items.length
      ? items
           .map((m) => {
              const typeBadge = `<span class="badge ${m.type === "in" ? "badge-active" : "badge-out_of_stock"}">${m.type === "in" ? "Masuk" : "Keluar"}</span>`;
              let actions;
              if (m.archived) {
                 // Already archived — show disabled label, hide edit/delete
                 actions = `<span style="font-size:11px;color:var(--text-muted);padding:4px 8px;border:1px solid var(--border);border-radius:6px">Diarsipkan</span>`;
              } else {
                 actions = `<div class="action-btns">
        <button class="action-btn" title="Edit" onclick="editStockMovement('${m.id}')"><i class="fas fa-pen"></i></button>
        <button class="action-btn" title="Arsipkan" onclick="confirmArchiveMovement('${m.id}')"><i class="fas fa-archive"></i></button>
        <button class="action-btn del" title="Hapus" onclick="confirmDeleteMovement('${m.id}')"><i class="fas fa-trash"></i></button>
      </div>`;
              }
              const dateDisplay =
                 m.date || '<span style="color:var(--text-muted)">—</span>';
              return `<tr><td>${dateDisplay}</td><td><strong style="color:var(--primary-dark)">${m.sku || "—"}</strong></td><td>${m.productName || "—"}</td><td>${typeBadge}</td><td style="font-weight:600;color:${m.type === "in" ? "var(--success)" : "var(--danger)"}">${m.type === "in" ? "+" : "-"}${m.qty}</td><td style="color:var(--text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${m.note || "-"}">${m.note || "-"}</td><td>${actions}</td></tr>`;
           })
           .join("")
      : `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-clock-rotate-left"></i><h4>Belum ada riwayat</h4><p>${filter === "bulan_ini" ? "Tidak ada pergerakan stok bulan ini" : filter === "arsip" ? "Tidak ada data yang diarsip" : "Belum ada riwayat stok"}</p></div></td></tr>`;

   // ---- Render pagination ----
   let pag = renderPaginationHTML(state.stockHistory.page, total, "goStockHistoryPage");

   // ---- Inject into history card ----
   const histCard = $("#invHistoryCard");
   if (histCard) {
      histCard.innerHTML = `
      ${historyToolbar}
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Tanggal</th><th>SKU</th><th>Produk</th><th>Tipe</th><th>Jumlah</th><th>Catatan</th><th>Aksi</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <span>${movements.length > 0 ? `Menampilkan ${start + 1}–${Math.min(start + perPage, movements.length)} dari ${movements.length}` : ""}</span>
        <div class="pagination">${pag}</div>
      </div>`;
   } else {
      // fallback: inject directly to tbody + pagination containers
      $("#invHistoryBody").innerHTML = rows;
   }
}

window.onStockHistorySearch = function (val) {
   state.stockHistory.search = val;
   state.stockHistory.page = 1;
   renderStockHistory();
};
window.onStockHistoryFilter = function (val) {
   state.stockHistory.filter = val;
   state.stockHistory.page = 1;
   renderStockHistory();
};
window.goStockHistoryPage = function (n) {
   state.stockHistory.page = n;
   renderStockHistory();
};

window.confirmArchiveMovement = function (id) {
   const m = state.stockMovements.find((x) => x.id === id);
   if (!m) return;
   if (m.archived) {
      toast("Sudah diarsipkan", "warning");
      return;
   }
   openModal(
      "Arsipkan Riwayat Stok",
      `<div style="text-align:center;padding:10px 0">
       <i class="fas fa-archive" style="font-size:40px;color:var(--warning);opacity:.7;margin-bottom:14px;display:block"></i>
       <p style="font-size:15px;font-weight:600">Arsipkan pergerakan stok ini?</p>
       <div style="margin-top:12px;padding:12px 14px;background:var(--primary-light);border-radius:var(--radius-sm);text-align:left;font-size:13px;line-height:1.8">
         <strong>${m.productName || "-"}</strong> · ${m.sku || "-"}<br>
         Tipe: <span class="badge ${m.type === "in" ? "badge-active" : "badge-out_of_stock"}">${m.type === "in" ? "Masuk" : "Keluar"}</span>
         Jumlah: <strong>${m.type === "in" ? "+" : "-"}${m.qty}</strong> · ${m.date || "-"}
       </div>
       <p style="font-size:12px;color:var(--text-muted);margin-top:12px">Data tidak dihapus. Akan tersembunyi di filter Bulan Ini.</p>
     </div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>
     <button class="btn btn-accent btn-sm" onclick="doArchiveMovement('${id}')"><i class="fas fa-archive"></i>Arsipkan</button>`,
   );
};

window.doArchiveMovement = async function (id) {
   const m = state.stockMovements.find((x) => x.id === id);
   if (!m || m.archived) {
      closeModal();
      return;
   }
   try {
      await db.collection("stock_movements").doc(id).update({
         archived: true,
         archivedAt: new Date().toISOString(),
      });
      toast("Riwayat diarsipkan", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

let invSearchTimeout;
$("#invSearch").addEventListener("input", (e) => {
   clearTimeout(invSearchTimeout);
   invSearchTimeout = setTimeout(renderInventory, 200);
});
$("#invFilter").addEventListener("change", renderInventory);

function stockModal(title, type) {
   const opts = state.products
      .map(
         (p) =>
            `<option value="${p.id}">${p.name} (${p.sku}) — Stok: ${p.stock}</option>`,
      )
      .join("");
   openModal(
      title,
      `<div class="form-group"><label>Produk</label><select class="form-input" id="fSMProd">${opts}</select></div><div class="form-row"><div class="form-group"><label>Jumlah</label><input type="number" class="form-input" id="fSMQty" value="1" min="1"></div><div class="form-group"><label>Tanggal</label><input type="date" class="form-input" id="fSMDate" value="${today}"></div></div><div class="form-group"><label>Catatan</label><input type="text" class="form-input" id="fSMNote" placeholder="Alasan pergerakan stok"></div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-primary btn-sm" onclick="doStockMove('${type}')"><i class="fas fa-check"></i>Simpan</button>`,
   );
}
$("#stockInBtn").addEventListener("click", () =>
   stockModal("Stok Masuk", "in"),
);
$("#stockOutBtn").addEventListener("click", () =>
   stockModal("Stok Keluar", "out"),
);
$("#stockAdjBtn").addEventListener("click", () =>
   stockModal("Penyesuaian Stok", "adjust"),
);

window.doStockMove = async function (type) {
   const pid = $("#fSMProd").value,
      qty = parseInt($("#fSMQty").value) || 0;
   const p = state.products.find((x) => x.id === pid);
   if (!p || qty <= 0) {
      toast("Pilih produk dan jumlah valid", "warning");
      return;
   }
   if (type === "out" && p.stock < qty) {
      toast("Stok tidak mencukupi", "error");
      return;
   }

   try {
      let newStock, moveType;
      if (type === "in") {
         newStock = p.stock + qty;
         moveType = "in";
      } else if (type === "out") {
         newStock = p.stock - qty;
         moveType = "out";
      } else {
         newStock = qty;
         moveType = qty > p.stock ? "in" : "out";
      }

      const newStatus =
         newStock <= 0
            ? "out_of_stock"
            : newStock <= 5
              ? "low_stock"
              : "active";
      await db
         .collection("products")
         .doc(pid)
         .update({
            stock: Math.max(0, newStock),
            status: newStatus,
            updatedAt: new Date().toISOString(),
         });
      await db.collection("stock_movements").add({
         date: $("#fSMDate").value,
         productId: pid,
         productName: p.name,
         sku: p.sku,
         type: moveType,
         qty: type === "adjust" ? Math.abs(newStock - p.stock) : qty,
         note: $("#fSMNote").value || "-",
         createdAt: new Date().toISOString(),
      });
      toast("Pergerakan stok dicatat", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

/* ===== HAPUS pergerakan stok ===== */
window.confirmDeleteMovement = function (id) {
   const m = state.stockMovements.find((x) => x.id === id);
   if (!m) return;
   openModal(
      "Konfirmasi Hapus",
      `
    <div style="text-align:center;padding:10px 0">
      <i class="fas fa-trash" style="font-size:40px;color:var(--danger);opacity:.6;margin-bottom:14px;display:block"></i>
      <p style="font-size:15px;font-weight:600">Hapus pergerakan stok ini?</p>
      <div style="margin-top:14px;padding:14px;background:var(--primary-light);border-radius:var(--radius-sm);text-align:left;font-size:13px;line-height:1.8">
        <strong>${m.productName}</strong> · ${m.sku}<br>
        Tipe: <span class="badge ${m.type === "in" ? "badge-active" : "badge-out_of_stock"}">${m.type === "in" ? "Masuk" : "Keluar"}</span>
        Jumlah: <strong>${m.type === "in" ? "+" : "-"}${m.qty}</strong><br>
        Catatan: ${m.note || "-"}
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:12px">
        Stok <strong>${m.productName}</strong> akan ${m.type === "in" ? "berkurang" : "bertambah"} <strong>${m.qty}</strong> unit.
      </p>
    </div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>
     <button class="btn btn-danger btn-sm" onclick="doDeleteMovement('${id}')"><i class="fas fa-trash"></i>Hapus</button>`,
   );
};

window.doDeleteMovement = async function (id) {
   const m = state.stockMovements.find((x) => x.id === id);
   if (!m || m.deleted) {
      toast("Sudah dihapus", "warning");
      return;
   }
   const product = state.products.find((p) => p.id === m.productId);
   if (!product) {
      toast("Produk tidak ditemukan", "error");
      return;
   }

   try {
      let newStock;
      if (m.type === "in") newStock = product.stock - m.qty;
      else newStock = product.stock + m.qty;
      const newStatus =
         newStock <= 0
            ? "out_of_stock"
            : newStock <= 5
              ? "low_stock"
              : "active";

      await db
         .collection("products")
         .doc(m.productId)
         .update({
            stock: Math.max(0, newStock),
            status: newStatus,
            updatedAt: new Date().toISOString(),
         });
      await db.collection("stock_movements").doc(id).delete();

      toast("Pergerakan stok dihapus & stok dikembalikan", "success");
      closeModal();
   } catch (err) {
      toast("Gagal menghapus: " + err.message, "error");
   }
};

/* ===== EDIT pergerakan stok ===== */
window.editStockMovement = function (id) {
   const m = state.stockMovements.find((x) => x.id === id);
   if (!m || m.deleted) {
      toast("Tidak bisa di-edit", "warning");
      return;
   }

   const product = state.products.find((p) => p.id === m.productId);
   const stockAfterEdit =
      m.type === "in"
         ? (product ? product.stock - m.qty : 0) + m.qty
         : (product ? product.stock + m.qty : 0) - m.qty;

   openModal(
      "Edit Pergerakan Stok",
      `
    <div style="margin-bottom:16px;padding:14px;background:var(--primary-light);border-radius:var(--radius-sm);font-size:13px;line-height:1.8">
      <strong>${m.productName}</strong> · ${m.sku}<br>
      <span class="badge ${m.type === "in" ? "badge-active" : "badge-out_of_stock"}">${m.type === "in" ? "Masuk" : "Keluar"}</span>
      Jumlah saat ini: <strong>${m.qty}</strong> unit<br>
      Stok produk sekarang: <strong>${product ? product.stock : "?"}</strong> unit
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Jumlah Baru</label>
        <input type="number" class="form-input" id="fEditSMQty" value="${m.qty}" min="1" oninput="previewEditStock('${id}')">
      </div>
      <div class="form-group">
        <label>Tanggal</label>
        <input type="date" class="form-input" id="fEditSMDate" value="${m.date}">
      </div>
    </div>
    <div class="form-group">
      <label>Catatan</label>
      <input type="text" class="form-input" id="fEditSMNote" value="${m.note || ""}">
    </div>
    <div id="editStockPreview" style="margin-top:10px;padding:10px 14px;background:rgba(0,0,0,.03);border-radius:var(--radius-sm);font-size:13px">
      Stok setelah edit: <strong id="editStockVal">${stockAfterEdit}</strong> unit
    </div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>
     <button class="btn btn-primary btn-sm" onclick="doEditStockMovement('${id}')"><i class="fas fa-check"></i>Simpan</button>`,
   );
};

window.previewEditStock = function (id) {
   const m = state.stockMovements.find((x) => x.id === id);
   if (!m) return;
   const product = state.products.find((p) => p.id === m.productId);
   const newQty = parseInt($("#fEditSMQty").value) || 0;
   const diff = newQty - m.qty;
   let newStock;
   if (m.type === "in") newStock = (product ? product.stock : 0) + diff;
   else newStock = (product ? product.stock : 0) - diff;
   const el = $("#editStockVal");
   if (el) {
      el.textContent = Math.max(0, newStock);
      el.style.color =
         newStock < 0
            ? "var(--danger)"
            : newStock <= 5
              ? "var(--warning)"
              : "var(--success)";
   }
};

window.doEditStockMovement = async function (id) {
   const m = state.stockMovements.find((x) => x.id === id);
   if (!m) return;
   const newQty = parseInt($("#fEditSMQty").value) || 0;
   if (newQty <= 0) {
      toast("Jumlah harus lebih dari 0", "warning");
      return;
   }
   const product = state.products.find((p) => p.id === m.productId);
   if (!product) {
      toast("Produk tidak ditemukan", "error");
      return;
   }

   const diff = newQty - m.qty;
   let newStock;
   if (m.type === "in") newStock = product.stock + diff;
   else newStock = product.stock - diff;
   if (newStock < 0) {
      toast("Stok tidak boleh negatif (akan jadi " + newStock + ")", "error");
      return;
   }

   try {
      const newStatus =
         newStock <= 0
            ? "out_of_stock"
            : newStock <= 5
              ? "low_stock"
              : "active";
      await db.collection("products").doc(m.productId).update({
         stock: newStock,
         status: newStatus,
         updatedAt: new Date().toISOString(),
      });
      await db
         .collection("stock_movements")
         .doc(id)
         .update({
            qty: newQty,
            date: $("#fEditSMDate").value,
            note: $("#fEditSMNote").value || "-",
         });
      toast("Pergerakan stok diperbarui", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

/* =========================================================
   PENJUALAN
   ========================================================= */
function renderSales() {
   const resellerGroup = $("#saleResellerFilterGroup");
   if (resellerGroup) {
      if (state.sale.channel === "Reseller") {
         resellerGroup.style.display = "block";
      } else {
         resellerGroup.style.display = "none";
      }
   }

   let list = [...state.sales].sort((a, b) =>
      (b.date || "").localeCompare(a.date || ""),
   );
   if (state.sale.search) {
      const q = state.sale.search.toLowerCase();
      list = list.filter(
         (s) =>
            (s.txNumber || "").toLowerCase().includes(q) ||
            (s.productName || "").toLowerCase().includes(q) ||
            (s.customer || "").toLowerCase().includes(q) ||
            (normalizeChannelValue(s.channel) || "")
               .toLowerCase()
               .includes(q) ||
            (s.resellerName || "").toLowerCase().includes(q) ||
            (s.city || "").toLowerCase().includes(q) ||
            (s.district || "").toLowerCase().includes(q) ||
            (s.expedition || "").toLowerCase().includes(q),
      );
   }
   if (state.sale.channel !== "all") {
      list = list.filter((s) => isChannelMatch(s.channel, state.sale.channel));
      if (state.sale.channel === "Reseller" && state.sale.resellerId !== "all") {
         list = list.filter((s) => s.resellerId === state.sale.resellerId);
      }
   }
   // Phase 6.2 — month/year filter
   if (state.sale.month !== "all" || state.sale.year !== "all")
      list = list.filter((s) =>
         matchesMonthYear(s.date, state.sale.month, state.sale.year),
      );
   if (state.sale.date && state.sale.date !== "all") {
      list = list.filter((s) => s.date === state.sale.date);
   }
   // Repopulate period dropdowns so year list stays fresh
   populateSalePeriodFilters();
   const { page, perPage } = state.sale;
   const total = Math.max(1, Math.ceil(list.length / perPage));
   if (page > total) state.sale.page = total;
   const start = (state.sale.page - 1) * perPage,
      items = list.slice(start, start + perPage);

   $("#saleBody").innerHTML = items.length
      ? items
           .map((s) => {
              const p = state.products.find((x) => x.id === s.productId);
              // Use realRevenue/realProfit for new sales, fallback to revenue/profit for old
              const displayRevenue =
                 s.realRevenue !== undefined ? s.realRevenue : s.revenue || 0;
              const displayProfit =
                 s.realProfit !== undefined ? s.realProfit : s.profit || 0;
              const addressStr =
                 [s.district, s.city].filter(Boolean).join(", ") || "-";
              const normalizedCh = normalizeChannelValue(s.channel || "");
              let chBadgeHtml = channelBadge(s.channel || "");
              if (normalizedCh === "Reseller" && s.resellerName) {
                 chBadgeHtml += `<br><small style="color:var(--text-muted);font-weight:500;margin-top:2px;display:inline-block">${s.resellerName}</small>`;
              }
              return `<tr>
      <td>${prodImg(p, 32)}</td>
      <td><strong style="color:var(--primary-dark)">${s.txNumber}</strong></td>
      <td>${s.date}</td>
      <td>${s.productName}<br><small style="color:var(--text-muted)">${s.sku}</small></td>
      <td>${s.quantity}</td>
      <td>${chBadgeHtml}</td>
      <td>${s.expedition ? expeditionBadge(s.expedition) : '<span style="color:var(--text-muted);font-size:12px">—</span>'}</td>
      <td style="font-size:12px;color:var(--text-muted)">${addressStr}</td>
      <td style="font-weight:600">${fmtRp(displayRevenue)}</td>
      <td style="color:var(--success);font-weight:600">${fmtRp(displayProfit)}</td>
      <td><div class="action-btns"><button class="action-btn" title="Edit" onclick="editSalesOrder('${s.id}')"><i class="fas fa-pen"></i></button><button class="action-btn del" title="Hapus" onclick="deleteSale('${s.id}')"><i class="fas fa-trash"></i></button></div></td>
    </tr>`;
           })
           .join("")
      : state.sales.length === 0
         ? `<tr><td colspan="11"><div class="empty-state"><i class="fas fa-receipt"></i><h4>Belum ada data penjualan</h4></div></td></tr>`
         : `<tr><td colspan="11"><div class="empty-state"><i class="fas fa-search"></i><h4>Tidak ada transaksi ditemukan</h4><p>Coba ubah filter atau kata kunci pencarian.</p></div></td></tr>`;

   const end = Math.min(start + perPage, list.length);
   $("#saleInfo").textContent =
      list.length > 0
         ? `Menampilkan ${start + 1}–${end} dari ${list.length} transaksi`
         : "";
   $("#salePag").innerHTML = renderPaginationHTML(state.sale.page, total, "goSalePage");
   renderResellerAnalytics(list);
   renderDailySalesStats(state.sale.date);
   syncSaleDateFilterUI();
}

function renderDailySalesStats(dateStr) {
   const container = $("#dailySalesStats");
   if (!container) return;

   const activeDate = dateStr !== undefined ? dateStr : state.sale.date;
   const isAll = !activeDate || activeDate === "all";

   const daySales = isAll
      ? state.sales
      : state.sales.filter((s) => s.date === activeDate);

   const totalRevenue = daySales.reduce((acc, s) => {
      const val = s.realRevenue !== undefined ? s.realRevenue : s.revenue || 0;
      return acc + val;
   }, 0);

   const totalProfit = daySales.reduce((acc, s) => {
      const val = s.realProfit !== undefined ? s.realProfit : s.profit || 0;
      return acc + val;
   }, 0);

   const totalOrders = daySales.length;
   const totalQty = daySales.reduce((acc, s) => acc + (s.quantity || 0), 0);

   const dateLabel = isAll
      ? "Semua Periode"
      : activeDate === today
        ? `Hari Ini (${formatDateIndo(today)})`
        : activeDate === getYesterdayDateStr()
          ? `Kemarin (${formatDateIndo(activeDate)})`
          : formatDateIndo(activeDate);

   container.innerHTML = `
      <div class="stat-card gold">
         <div class="sc-top">
            <div class="sc-icon"><i class="fas fa-coins"></i></div>
            <span class="sc-label">Pendapatan Harian</span>
         </div>
         <div class="sc-value">${fmtRp(totalRevenue)}</div>
         <div class="sc-sub">${dateLabel}</div>
      </div>
      <div class="stat-card green">
         <div class="sc-top">
            <div class="sc-icon"><i class="fas fa-chart-line"></i></div>
            <span class="sc-label">Estimasi Laba Harian</span>
         </div>
         <div class="sc-value">${fmtRp(totalProfit)}</div>
         <div class="sc-sub">Margin Laba Terkalkulasi</div>
      </div>
      <div class="stat-card maroon">
         <div class="sc-top">
            <div class="sc-icon"><i class="fas fa-box-open"></i></div>
            <span class="sc-label">Volume Terjual</span>
         </div>
         <div class="sc-value">${totalOrders} <span style="font-size:14px;font-weight:500;">Order</span> <small style="font-size:13px;color:var(--text-muted);">(${totalQty} pcs)</small></div>
         <div class="sc-sub">Total Item Terjual</div>
      </div>
   `;
}

function syncSaleDateFilterUI() {
   const input = $("#saleDateFilter");
   if (input) {
      input.value = state.sale.date && state.sale.date !== "all" ? state.sale.date : "";
   }
   const presets = $("#saleQuickPresets");
   if (presets) {
      presets.querySelectorAll(".chart-tab").forEach((btn) => {
         const p = btn.dataset.preset;
         const isActive =
            (p === "today" && state.sale.date === today) ||
            (p === "yesterday" && state.sale.date === getYesterdayDateStr()) ||
            (p === "all" && (!state.sale.date || state.sale.date === "all"));
         if (isActive) btn.classList.add("active");
         else btn.classList.remove("active");
      });
   }
}

window.goSalePage = function (n) {
   state.sale.page = n;
   renderSales();
};
let saleSearchTimeout;
$("#saleSearch").addEventListener("input", (e) => {
   clearTimeout(saleSearchTimeout);
   saleSearchTimeout = setTimeout(() => {
      state.sale.search = e.target.value;
      state.sale.page = 1;
      renderSales();
   }, 200);
});
$("#saleChannelFilter").addEventListener("change", (e) => {
   state.sale.channel = e.target.value;
   state.sale.page = 1;
   const resellerGroup = $("#saleResellerFilterGroup");
   if (resellerGroup) {
      if (e.target.value === "Reseller") {
         resellerGroup.style.display = "block";
         populateResellerFilters();
      } else {
         resellerGroup.style.display = "none";
         state.sale.resellerId = "all";
         const filterSelect = $("#saleResellerFilter");
         if (filterSelect) filterSelect.value = "all";
      }
   }
   renderSales();
});
if ($("#saleResellerFilter")) {
   $("#saleResellerFilter").addEventListener("change", (e) => {
      state.sale.resellerId = e.target.value;
      state.sale.page = 1;
      renderSales();
   });
}
if ($("#saleDateFilter")) {
   $("#saleDateFilter").addEventListener("change", (e) => {
      state.sale.date = e.target.value || "all";
      state.sale.page = 1;
      renderSales();
   });
}
if ($("#saleQuickPresets")) {
   $("#saleQuickPresets").addEventListener("click", (e) => {
      const btn = e.target.closest(".chart-tab");
      if (!btn) return;
      const preset = btn.dataset.preset;
      if (preset === "today") {
         state.sale.date = today;
      } else if (preset === "yesterday") {
         state.sale.date = getYesterdayDateStr();
      } else if (preset === "all") {
         state.sale.date = "all";
      }
      state.sale.page = 1;
      renderSales();
   });
}
// Phase 6.2 — period filter listeners (elements added in InztamotoApp.jsx)
$("#saleMonthFilter").addEventListener("change", (e) => {
   state.sale.month = e.target.value;
   state.sale.page = 1;
   renderSales();
});
$("#saleYearFilter").addEventListener("change", (e) => {
   state.sale.year = e.target.value;
   state.sale.page = 1;
   renderSales();
});

$("#addSaleBtn").addEventListener("click", () => {
   const opts = state.products
      .filter((p) => p.stock > 0)
      .map(
         (p) =>
            `<option value="${p.id}">${p.name} (${p.sku}) — ${fmtRp(p.sellingPrice)}</option>`,
      )
      .join("");
   const chOpts = CHANNELS.map(
      (c) => `<option value="${c}">${c}</option>`,
   ).join("");
   const expOpts = EXPEDITIONS.map(
      (e) => `<option value="${e}">${e}</option>`,
   ).join("");
   openModal(
      "Catat Penjualan",
      `
    <div class="form-group"><label>Produk</label><select class="form-input" id="fSaleProd" onchange="updateSaleForm()">${opts}</select></div>
    <div class="form-row">
      <div class="form-group"><label>Jumlah</label><input type="number" class="form-input" id="fSaleQty" value="1" min="1" oninput="updateSaleForm()"></div>
      <div class="form-group"><label>Channel</label><select class="form-input" id="fSaleChannel" onchange="toggleResellerDropdown(false)">${chOpts}</select></div>
    </div>
    <div class="form-group" id="fSaleResellerGroup" style="display:none">
      <label>Reseller <span style="color:red">*</span></label>
      <select class="form-input" id="fSaleReseller">
        <option value="">— Pilih Reseller —</option>
      </select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Harga Default <small style="color:var(--text-muted);font-weight:400">(per unit)</small></label><input type="text" class="form-input" id="fSaleDefaultPrice" readonly style="background:var(--primary-light)"></div>
      <div class="form-group"><label>Harga Real Marketplace <small style="color:var(--text-muted);font-weight:400">(per unit)</small></label><input type="number" class="form-input" id="fSaleRealPrice" min="0" oninput="updateSaleForm()" placeholder="Kosongkan = pakai harga default"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Kecamatan</label><input type="text" class="form-input" id="fSaleDistrict" placeholder="Kecamatan tujuan"></div>
      <div class="form-group"><label>Kota</label><input type="text" class="form-input" id="fSaleCity" placeholder="Kota tujuan"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Ekspedisi</label><select class="form-input" id="fSaleExpedition"><option value="">— Pilih Ekspedisi —</option>${expOpts}</select></div>
      <div class="form-group"><label>Pelanggan</label><input type="text" class="form-input" id="fSaleCustomer" placeholder="Nama pelanggan"></div>
    </div>
    <div class="form-group"><label>Tanggal</label><input type="date" class="form-input" id="fSaleDate" value="${today}"></div>
    <div style="padding:12px 14px;background:var(--primary-light);border-radius:var(--radius-sm);font-size:13px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr;gap:6px 20px">
      <span>Pendapatan Standar: <strong id="fSaleStdRev">Rp 0</strong></span>
      <span>Pendapatan Real: <strong id="fSaleRev">Rp 0</strong></span>
      <span>Modal (HPP): <strong id="fSaleModal">Rp 0</strong></span>
      <span>Keuntungan Real: <strong id="fSaleProfit" style="color:var(--success)">Rp 0</strong></span>
      <span style="grid-column:1/-1">Selisih Marketplace: <strong id="fSaleDiff">Rp 0</strong></span>
    </div>
    <div class="form-group"><label>Catatan</label><input type="text" class="form-input" id="fSaleNotes" placeholder="Opsional"></div>
  `,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-primary btn-sm" onclick="saveSale()"><i class="fas fa-check"></i>Simpan</button>`,
   );
   setTimeout(updateSaleForm, 50);
});

window.updateSaleForm = function () {
   const pid = $("#fSaleProd").value,
      p = state.products.find((x) => x.id === pid);
   if (!p) return;
   const qty = parseInt($("#fSaleQty").value) || 1;

   // Isi harga default
   const defPriceEl = $("#fSaleDefaultPrice");
   if (defPriceEl) defPriceEl.value = fmtRp(p.sellingPrice);

   // Harga real: ambil dari input, jika kosong pakai sellingPrice
   const realPriceInput = $("#fSaleRealPrice");
   const realUnitPrice =
      realPriceInput && realPriceInput.value !== ""
         ? parsePrice(realPriceInput.value) || p.sellingPrice
         : p.sellingPrice;
   if (realPriceInput && realPriceInput.value === "")
      realPriceInput.placeholder = fmtRp(p.sellingPrice);

   const standardRevenue = p.sellingPrice * qty;
   const realRevenue = realUnitPrice * qty;
   const modal = (p.costPrice || 0) * qty;
   const realProfit = realRevenue - modal;
   const diff = realRevenue - standardRevenue;

   const set = (id, val) => {
      const el = $(id);
      if (el) el.textContent = fmtRp(val);
   };
   set("#fSaleStdRev", standardRevenue);
   set("#fSaleRev", realRevenue);
   set("#fSaleModal", modal);
   set("#fSaleProfit", realProfit);
   const diffEl = $("#fSaleDiff");
   if (diffEl) {
      diffEl.textContent = fmtRp(diff);
      diffEl.style.color =
         diff < 0 ? "var(--danger)" : diff > 0 ? "var(--success)" : "";
   }
};

function getProductStatusByStock(stock) {
   if (stock <= 0) return "out_of_stock";
   if (stock <= 5) return "low_stock";
   return "active";
}

window.editSalesOrder = async function (docId) {
   try {
      let sale = state.sales.find((x) => x.id === docId);
      if (!sale) {
         const snap = await db.collection("sales").doc(docId).get();
         if (!snap.exists) {
            toast("Transaksi tidak ditemukan", "error");
            return;
         }
         sale = { id: snap.id, ...snap.data() };
      }

      const attr = (val) => String(val || "").replace(/"/g, "&quot;");
      const oldQty = Number(sale.quantity || 1);
      const oldRealUnitPrice = Number(
         sale.realUnitPrice ||
            (sale.realRevenue && oldQty
               ? sale.realRevenue / oldQty
               : sale.sellingPrice) ||
            0,
      );
      const selectedChannel = normalizeChannelValue(sale.channel || "Reseller");
      const productOpts = state.products
         .map(
            (p) =>
               `<option value="${p.id}" ${p.id === sale.productId ? "selected" : ""}>${p.name} (${p.sku})</option>`,
         )
         .join("");
      const chOpts = CHANNELS.map(
         (c) =>
            `<option value="${c}" ${c === selectedChannel ? "selected" : ""}>${c}</option>`,
      ).join("");
      const expOpts = EXPEDITIONS.map(
         (e) =>
            `<option value="${e}" ${e === sale.expedition ? "selected" : ""}>${e}</option>`,
      ).join("");

      openModal(
         "Edit Penjualan",
         `
      <div class="form-group"><label>Produk</label><select class="form-input" id="fEditSaleProd" onchange="updateEditSaleForm()">${productOpts}</select></div>
      <div class="form-row">
        <div class="form-group"><label>Jumlah</label><input type="number" class="form-input" id="fEditSaleQty" value="${oldQty}" min="1" oninput="updateEditSaleForm()"></div>
        <div class="form-group"><label>Channel</label><select class="form-input" id="fEditSaleChannel" onchange="toggleResellerDropdown(true)">${chOpts}</select></div>
      </div>
      <div class="form-group" id="fEditSaleResellerGroup" style="display:none">
        <label>Reseller <span style="color:red">*</span></label>
        <select class="form-input" id="fEditSaleReseller">
          <option value="">— Pilih Reseller —</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Harga Default <small style="color:var(--text-muted);font-weight:400">(per unit)</small></label><input type="text" class="form-input" id="fEditSaleDefaultPrice" readonly style="background:var(--primary-light)"></div>
        <div class="form-group"><label>Harga Real <small style="color:var(--text-muted);font-weight:400">(per unit)</small></label><input type="number" class="form-input" id="fEditSaleRealPrice" value="${oldRealUnitPrice}" min="0" oninput="updateEditSaleForm()"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Ekspedisi</label><select class="form-input" id="fEditSaleExpedition"><option value="">— Pilih Ekspedisi —</option>${expOpts}</select></div>
        <div class="form-group"><label>Tanggal</label><input type="date" class="form-input" id="fEditSaleDate" value="${attr(sale.date || today)}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Kecamatan</label><input type="text" class="form-input" id="fEditSaleDistrict" value="${attr(sale.district)}"></div>
        <div class="form-group"><label>Kota</label><input type="text" class="form-input" id="fEditSaleCity" value="${attr(sale.city)}"></div>
      </div>
      <div class="form-group"><label>Pelanggan</label><input type="text" class="form-input" id="fEditSaleCustomer" value="${attr(sale.customer)}"></div>
      <div style="padding:12px 14px;background:var(--primary-light);border-radius:var(--radius-sm);font-size:13px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr;gap:6px 20px">
        <span>Pendapatan Real: <strong id="fEditSaleRev">Rp 0</strong></span>
        <span>Modal (HPP): <strong id="fEditSaleModal">Rp 0</strong></span>
        <span>Keuntungan: <strong id="fEditSaleProfit" style="color:var(--success)">Rp 0</strong></span>
        <span>Margin: <strong id="fEditSaleMargin">0%</strong></span>
      </div>
      <div class="form-group"><label>Catatan</label><input type="text" class="form-input" id="fEditSaleNotes" value="${attr(sale.notes)}"></div>
    `,
         `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-primary btn-sm" onclick="saveEditSalesOrder('${docId}')"><i class="fas fa-check"></i>Update</button>`,
      );
      setTimeout(function () {
         toggleResellerDropdown(true, sale.resellerId);
         updateEditSaleForm();
      }, 50);
   } catch (err) {
      toast("Gagal membuka edit penjualan: " + err.message, "error");
   }
};

window.updateEditSaleForm = function () {
   const pid = $("#fEditSaleProd") ? $("#fEditSaleProd").value : "";
   const product = state.products.find((x) => x.id === pid);
   if (!product) return;

   const qty = parseInt($("#fEditSaleQty").value, 10) || 1;
   const realPriceInput = $("#fEditSaleRealPrice");
   const realUnitPrice =
      realPriceInput && realPriceInput.value !== ""
         ? parsePrice(realPriceInput.value) || product.sellingPrice || 0
         : product.sellingPrice || 0;
   const revenue = realUnitPrice * qty;
   const modal = (Number(product.costPrice) || 0) * qty;
   const profit = revenue - modal;
   const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

   if ($("#fEditSaleDefaultPrice"))
      $("#fEditSaleDefaultPrice").value = fmtRp(product.sellingPrice || 0);
   if ($("#fEditSaleRev")) $("#fEditSaleRev").textContent = fmtRp(revenue);
   if ($("#fEditSaleModal")) $("#fEditSaleModal").textContent = fmtRp(modal);
   if ($("#fEditSaleProfit")) $("#fEditSaleProfit").textContent = fmtRp(profit);
   if ($("#fEditSaleMargin")) $("#fEditSaleMargin").textContent = margin + "%";
};

window.saveEditSalesOrder = async function (docId) {
   try {
      const saleRef = db.collection("sales").doc(docId);
      const saleSnap = await saleRef.get();
      if (!saleSnap.exists) {
         toast("Transaksi tidak ditemukan", "error");
         return;
      }

      const oldSale = { id: saleSnap.id, ...saleSnap.data() };
      const oldProduct = state.products.find((x) => x.id === oldSale.productId);
      const newProductId = $("#fEditSaleProd").value;
      const newProduct = state.products.find((x) => x.id === newProductId);
      if (!newProduct) {
         toast("Produk tidak ditemukan", "error");
         return;
      }

      const oldQty = Number(oldSale.quantity || 0);
      const newQty = parseInt($("#fEditSaleQty").value, 10) || 1;
      if (newQty < 1) {
         toast("Jumlah minimal 1", "warning");
         return;
      }

      const sameProduct = oldSale.productId === newProductId;
      const availableStock = sameProduct
         ? (Number(newProduct.stock) || 0) + oldQty
         : Number(newProduct.stock) || 0;
      if (newQty > availableStock) {
         toast(
            "Stok tidak mencukupi (tersedia: " + availableStock + ")",
            "error",
         );
         return;
      }

      const batch = db.batch();
      const now = new Date().toISOString();

      if (sameProduct) {
         const stockDelta = oldQty - newQty;
         const nextStock = (Number(newProduct.stock) || 0) + stockDelta;
         batch.update(db.collection("products").doc(newProductId), {
            stock: firebase.firestore.FieldValue.increment(stockDelta),
            status: getProductStatusByStock(nextStock),
            updatedAt: now,
         });
      } else {
         if (oldProduct) {
            const oldNextStock = (Number(oldProduct.stock) || 0) + oldQty;
            batch.update(db.collection("products").doc(oldSale.productId), {
               stock: firebase.firestore.FieldValue.increment(oldQty),
               status: getProductStatusByStock(oldNextStock),
               updatedAt: now,
            });
         }
         const newNextStock = (Number(newProduct.stock) || 0) - newQty;
         batch.update(db.collection("products").doc(newProductId), {
            stock: firebase.firestore.FieldValue.increment(-newQty),
            status: getProductStatusByStock(newNextStock),
            updatedAt: now,
         });
      }

      const realUnitPrice =
         $("#fEditSaleRealPrice") && $("#fEditSaleRealPrice").value !== ""
            ? parsePrice($("#fEditSaleRealPrice").value) ||
              Number(newProduct.sellingPrice) ||
              0
            : Number(newProduct.sellingPrice) || 0;
      const sellingPrice = Number(newProduct.sellingPrice) || 0;
      const costPrice = Number(newProduct.costPrice) || 0;
      const standardRevenue = sellingPrice * newQty;
      const realRevenue = realUnitPrice * newQty;
      const modal = costPrice * newQty;
      const realProfit = realRevenue - modal;
      const margin =
         realRevenue > 0 ? Math.round((realProfit / realRevenue) * 100) : 0;

      const channel = $("#fEditSaleChannel").value;
      let resellerId = "";
      let resellerName = "";
      if (channel === "Reseller") {
         resellerId = $("#fEditSaleReseller").value;
         if (!resellerId) {
            toast("Pilih reseller", "warning");
            return;
         }
         const resellerObj = state.resellers.find((r) => r.id === resellerId);
         resellerName = resellerObj ? resellerObj.name : "";
      }

      batch.update(
         saleRef,
         sanitize({
            productId: newProductId,
            productName: newProduct.name,
            sku: newProduct.sku,
            quantity: newQty,
            costPrice,
            sellingPrice,
            realUnitPrice,
            standardRevenue,
            realRevenue,
            revenue: realRevenue,
            modal,
            realProfit,
            profit: realProfit,
            margin,
            marketplaceDifference: realRevenue - standardRevenue,
            channel,
            resellerId,
            resellerName,
            expedition:
               ($("#fEditSaleExpedition")
                  ? $("#fEditSaleExpedition").value
                  : "") || "",
            district: ($("#fEditSaleDistrict")
               ? $("#fEditSaleDistrict").value
               : ""
            ).trim(),
            city: ($("#fEditSaleCity") ? $("#fEditSaleCity").value : "").trim(),
            customer:
               ($("#fEditSaleCustomer")
                  ? $("#fEditSaleCustomer").value
                  : ""
               ).trim() || "-",
            date: $("#fEditSaleDate").value,
            notes: ($("#fEditSaleNotes")
               ? $("#fEditSaleNotes").value
               : ""
            ).trim(),
            updatedAt: now,
         }),
      );

      await batch.commit();
      toast("Penjualan berhasil diupdate", "success");
      closeModal();
      renderSales();
   } catch (err) {
      toast("Gagal update penjualan: " + err.message, "error");
   }
};

window.saveSale = async function () {
   const pid = $("#fSaleProd").value,
      p = state.products.find((x) => x.id === pid);
   if (!p) {
      toast("Pilih produk", "warning");
      return;
   }
   const qty = parseInt($("#fSaleQty").value) || 1;
   if (p.stock < qty) {
      toast("Stok tidak mencukupi (tersedia: " + p.stock + ")", "error");
      return;
   }

   const realPriceInput = $("#fSaleRealPrice");
   const realUnitPrice =
      realPriceInput && realPriceInput.value !== ""
         ? parsePrice(realPriceInput.value) || p.sellingPrice
         : p.sellingPrice;

   const standardRevenue = p.sellingPrice * qty;
   const realRevenue = realUnitPrice * qty;
   const modal = (p.costPrice || 0) * qty;
   const realProfit = realRevenue - modal;
   const marketplaceDifference = realRevenue - standardRevenue;

   const channel = $("#fSaleChannel").value;
   let resellerId = "";
   let resellerName = "";
   if (channel === "Reseller") {
      resellerId = $("#fSaleReseller").value;
      if (!resellerId) {
         toast("Pilih reseller", "warning");
         return;
      }
      const resellerObj = state.resellers.find((r) => r.id === resellerId);
      resellerName = resellerObj ? resellerObj.name : "";
   }
   const expedition =
      ($("#fSaleExpedition") ? $("#fSaleExpedition").value : "") || "";
   const district = (
      $("#fSaleDistrict") ? $("#fSaleDistrict").value : ""
   ).trim();
   const city = ($("#fSaleCity") ? $("#fSaleCity").value : "").trim();
   const saleDate = $("#fSaleDate").value;

   try {
      const txNum =
         state.sales.length > 0
            ? parseInt((state.sales[0].txNumber || "TXN-00100").split("-")[1]) +
              1
            : 1001;

      const newStock = p.stock - qty;
      const newStatus =
         newStock <= 0
            ? "out_of_stock"
            : newStock <= 5
              ? "low_stock"
              : "active";
      await db.collection("products").doc(pid).update({
         stock: newStock,
         status: newStatus,
         updatedAt: new Date().toISOString(),
      });

      const saleDoc = {
         txNumber: "TXN-" + String(txNum).padStart(5, "0"),
         date: saleDate,
         productId: pid,
         productName: p.name,
         sku: p.sku,
         quantity: qty,
         costPrice: p.costPrice,
         sellingPrice: p.sellingPrice,
         realUnitPrice: realUnitPrice,
         standardRevenue: standardRevenue,
         realRevenue: realRevenue,
         revenue: realRevenue, // compat: use realRevenue for new sales
         modal: modal,
         realProfit: realProfit,
         profit: realProfit, // compat: use realProfit for new sales
         marketplaceDifference: marketplaceDifference,
         channel: channel,
         resellerId: resellerId,
         resellerName: resellerName,
         expedition: expedition,
         district: district,
         city: city,
         customer: $("#fSaleCustomer").value || "-",
         notes: $("#fSaleNotes").value,
         createdAt: new Date().toISOString(),
      };
      await db.collection("sales").add(sanitize(saleDoc));

      const moveNote = expedition
         ? "Penjualan " + channel + " - " + expedition
         : "Penjualan " + channel;
      await db.collection("stock_movements").add({
         date: saleDate,
         productId: pid,
         productName: p.name,
         sku: p.sku,
         type: "out",
         qty: qty,
         note: moveNote,
         createdAt: new Date().toISOString(),
      });

      toast("Penjualan berhasil dicatat", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

window.deleteSale = async function (id) {
   try {
      await db.collection("sales").doc(id).delete();
      toast("Transaksi dihapus", "success");
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

/* =========================================================
   BELANJA PRODUKSI — Phase 4A
   ========================================================= */

function getWeekKey(dateStr) {
   const d = new Date(dateStr || today);
   const day = d.getDate();
   const month = String(d.getMonth() + 1).padStart(2, "0");
   const year = d.getFullYear();
   // W1=1-7, W2=8-14, W3=15-21, W4=22-28, W5=29-end
   const weekNum =
      day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5;
   return year + "-" + month + "-W" + weekNum;
}

function weekKeyLabel(wk) {
   // "2026-06-W2" => "Juni 2026 - Minggu 2"
   if (!wk) return wk;
   const parts = wk.split("-");
   if (parts.length < 3) return wk;
   const year = parts[0];
   const monthNum = parseInt(parts[1], 10);
   const weekPart = parts[2]; // "W2"
   const MONTHS_ID = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
   ];
   const monthName = MONTHS_ID[monthNum - 1] || parts[1];
   return monthName + " " + year + " — Minggu " + weekPart.replace("W", "");
}

function getAvailableWeeks() {
   const { month } = state.pp;
   const weeks = new Set();
   const currentWeek = getWeekKey(today);
   if (month === "all" || currentWeek.substring(5, 7) === month) {
      weeks.add(currentWeek);
   }
   state.productionPurchases.forEach((p) => {
      if (p.weekKey) {
         if (month === "all" || p.weekKey.substring(5, 7) === month) {
            weeks.add(p.weekKey);
         }
      }
   });
   return [...weeks].sort().reverse();
}

function renderBelanjaProduksi() {
   const container = $("#pageBelanjaProduksi");
   if (!container) return;

   const { search, week, status, month, page, perPage } = state.pp;
   const selectedWeek = week || getWeekKey(today);

   let list = [...state.productionPurchases];
   if (search) {
      const q = search.toLowerCase();
      list = list.filter(
         (p) =>
            (p.itemName || "").toLowerCase().includes(q) ||
            (p.category || "").toLowerCase().includes(q) ||
            (p.note || "").toLowerCase().includes(q),
      );
   }
   if (month && month !== "all") {
      list = list.filter((p) => {
         if (!p.date) return false;
         return p.date.substring(5, 7) === month;
      });
   }
   if (week) list = list.filter((p) => p.weekKey === week);
   if (status !== "all") list = list.filter((p) => p.status === status);
   if (state.pp.date && state.pp.date !== "all") {
      list = list.filter((p) => p.date === state.pp.date);
   }

   const weeklyTotal = week
      ? state.productionPurchases
           .filter((p) => p.weekKey === selectedWeek)
           .reduce((s, p) => s + (p.totalCost || 0), 0)
      : list.reduce((s, p) => s + (p.totalCost || 0), 0);

   const total = Math.max(1, Math.ceil(list.length / perPage));
   if (page > total) state.pp.page = 1;
   const start = (state.pp.page - 1) * perPage;
   const items = list.slice(start, start + perPage);

   const monthOpts = MONTH_OPTIONS.map(
      (m) =>
         `<option value="${m.value}" ${month === m.value ? "selected" : ""}>${m.label}</option>`,
   ).join("");

   const weekOpts = getAvailableWeeks()
      .map(
         (w) =>
            `<option value="${w}" ${w === week ? "selected" : ""}>${weekKeyLabel(w)}</option>`,
      )
      .join("");

   // ---- Toolbar ----
   const isTodayActive = state.pp.date === today;
   const isYesterdayActive = state.pp.date === getYesterdayDateStr();
   const isAllActive = !state.pp.date || state.pp.date === "all";
   const dateInputVal = state.pp.date && state.pp.date !== "all" ? state.pp.date : "";

   const toolbar = `
    <div class="table-toolbar">
      <div class="table-search"><i class="fas fa-search"></i><input type="text" id="ppSearch" class="form-input" placeholder="Cari barang..." value="${search}" oninput="onPPSearch(this.value)"></div>
      <div class="table-filter date-preset-filter">
        <div class="chart-tabs" id="ppQuickPresets">
          <button type="button" class="chart-tab ${isTodayActive ? "active" : ""}" onclick="onPPDatePreset('today')">Hari Ini</button>
          <button type="button" class="chart-tab ${isYesterdayActive ? "active" : ""}" onclick="onPPDatePreset('yesterday')">Kemarin</button>
          <button type="button" class="chart-tab ${isAllActive ? "active" : ""}" onclick="onPPDatePreset('all')">Semua</button>
        </div>
        <input type="date" id="ppDateFilter" value="${dateInputVal}" onchange="onPPDate(this.value)">
      </div>
      <div class="table-filter">
        <select class="form-input" onchange="onPPMonth(this.value)">
          <option value="all" ${month === "all" ? "selected" : ""}>Semua Bulan</option>${monthOpts}
        </select>
      </div>
      <div class="table-filter">
        <select class="form-input" onchange="onPPWeek(this.value)" style="min-width:130px">
          <option value="">Semua Minggu</option>${weekOpts}
        </select>
      </div>
      <div class="table-filter">
        <select class="form-input" onchange="onPPStatus(this.value)">
          <option value="all" ${status === "all" ? "selected" : ""}>Semua Status</option>
          <option value="open" ${status === "open" ? "selected" : ""}>Open</option>
          <option value="closed" ${status === "closed" ? "selected" : ""}>Closed</option>
        </select>
      </div>
      <div class="responsive-action-group" style="margin-left:auto;display:flex;gap:8px;align-items:center">
        <span style="font-size:13px;color:var(--text-muted)">${week ? `Total ${weekKeyLabel(selectedWeek)}` : "Total Belanja"}: <strong style="color:var(--text)">${fmtRp(weeklyTotal)}</strong></span>
        <button class="btn btn-outline btn-sm" onclick="exportBelanjaProduksi()"><i class="fas fa-download"></i>Export</button>
        ${week ? `<button class="btn btn-outline btn-sm" onclick="closeWeek('${selectedWeek}')"><i class="fas fa-lock"></i>Tutup Minggu</button>` : ""}
        <button class="btn btn-primary btn-sm" onclick="openAddPurchaseModal()"><i class="fas fa-plus"></i>Tambah Belanja</button>
      </div>
    </div>`;

   // ---- Table rows ----
   const rows = items.length
      ? items
           .map((p) => {
              const isClosed = p.status === "closed";
              const statusBadgeStr = isClosed
                  ? `<span class="badge badge-inactive">Closed</span>`
                  : `<span class="badge badge-active">Open</span>`;
              const actions = isClosed
                  ? `<span style="font-size:12px;color:var(--text-muted)">—</span>`
                  : `<div class="action-btns">
                <button class="action-btn" title="Edit" onclick="editPurchase('${p.id}')"><i class="fas fa-pen"></i></button>
                <button class="action-btn del" title="Hapus" onclick="confirmDeletePurchase('${p.id}')"><i class="fas fa-trash"></i></button>
              </div>`;
              return `<tr>
          <td>${p.date}</td>
          <td><small style="color:var(--text-muted)">${p.weekKey || ""}</small></td>
          <td><strong>${p.itemName}</strong>${p.investorAgreementId ? ' <span class="badge badge-active" style="margin-left:6px;font-size:11px">Dana investasi</span>' : ""}</td>
          <td>${p.category || "-"}</td>
          <td>${fmt(p.quantity)} ${p.unit || ""}</td>
          <td>${fmtRp(p.unitPrice)}</td>
          <td style="font-weight:600">${fmtRp(p.totalCost)}</td>
          <td>${statusBadgeStr}</td>
          <td style="color:var(--text-muted);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.note || ""}">${p.note || "-"}</td>
          <td>${actions}</td>
        </tr>`;
           })
           .join("")
      : `<tr><td colspan="10"><div class="empty-state"><i class="fas fa-shopping-basket"></i><h4>Belum ada data belanja</h4><p>Coba ubah tanggal filter atau tambahkan belanja produksi baru.</p></div></td></tr>`;

   // ---- Pagination ----
   let pag = renderPaginationHTML(state.pp.page, total, "goPPPage");

   const dailyCardsHTML = renderDailyPurchasesCardsHTML(state.pp.date);

   container.innerHTML = `
    <div class="stat-grid" id="dailyPurchasesStats" style="margin-bottom: 20px;">
      ${dailyCardsHTML}
    </div>
    <div class="card">
      ${toolbar}
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>Tanggal</th><th>Minggu</th><th>Nama Barang</th><th>Kategori</th>
            <th>Qty</th><th>Harga Satuan</th><th>Total</th><th>Status</th><th>Catatan</th><th>Aksi</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <span>${list.length > 0 ? `Menampilkan ${start + 1}–${Math.min(start + perPage, list.length)} dari ${list.length}` : ""}</span>
        <div class="pagination">${pag}</div>
      </div>
    </div>`;
}

function renderDailyPurchasesCardsHTML(dateStr) {
   const activeDate = dateStr !== undefined ? dateStr : state.pp.date;
   const isAll = !activeDate || activeDate === "all";

   const dayPurchases = isAll
      ? state.productionPurchases
      : state.productionPurchases.filter((p) => p.date === activeDate);

   const totalCost = dayPurchases.reduce((acc, p) => acc + (p.totalCost || 0), 0);
   const totalItems = dayPurchases.length;
   const totalQty = dayPurchases.reduce((acc, p) => acc + (p.quantity || 0), 0);

   const dateLabel = isAll
      ? "Semua Periode"
      : activeDate === today
        ? `Hari Ini (${formatDateIndo(today)})`
        : activeDate === getYesterdayDateStr()
          ? `Kemarin (${formatDateIndo(activeDate)})`
          : formatDateIndo(activeDate);

   return `
      <div class="stat-card red">
         <div class="sc-top">
            <div class="sc-icon"><i class="fas fa-wallet"></i></div>
            <span class="sc-label">Total Belanja Harian</span>
         </div>
         <div class="sc-value">${fmtRp(totalCost)}</div>
         <div class="sc-sub">${dateLabel}</div>
      </div>
      <div class="stat-card gold">
         <div class="sc-top">
            <div class="sc-icon"><i class="fas fa-receipt"></i></div>
            <span class="sc-label">Item Pengadaan</span>
         </div>
         <div class="sc-value">${totalItems} <span style="font-size:14px;font-weight:500;">Transaksi</span> <small style="font-size:13px;color:var(--text-muted);">(${fmt(totalQty)} item)</small></div>
         <div class="sc-sub">Bahan Baku & Penunjang</div>
      </div>
   `;
}

// ---- Search/filter handlers ----
window.onPPSearch = function (val) {
   state.pp.search = val;
   state.pp.page = 1;
   renderBelanjaProduksi();
   const input = document.getElementById("ppSearch");
   if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
   }
};
window.onPPDate = function (val) {
   state.pp.date = val || "all";
   state.pp.page = 1;
   renderBelanjaProduksi();
};
window.onPPDatePreset = function (preset) {
   if (preset === "today") {
      state.pp.date = today;
   } else if (preset === "yesterday") {
      state.pp.date = getYesterdayDateStr();
   } else if (preset === "all") {
      state.pp.date = "all";
   }
   state.pp.page = 1;
   renderBelanjaProduksi();
};
window.onPPMonth = function (val) {
   state.pp.month = val;
   if (val !== "all" && state.pp.week && state.pp.week.substring(5, 7) !== val) {
      state.pp.week = "";
   }
   state.pp.page = 1;
   renderBelanjaProduksi();
};
window.onPPWeek = function (val) {
   state.pp.week = val;
   if (val) {
      state.pp.month = val.substring(5, 7);
   }
   state.pp.page = 1;
   renderBelanjaProduksi();
};
window.onPPStatus = function (val) {
   state.pp.status = val;
   state.pp.page = 1;
   renderBelanjaProduksi();
};
window.goPPPage = function (n) {
   state.pp.page = n;
   renderBelanjaProduksi();
};

window.exportBelanjaProduksi = function () {
   var list = [...(state.productionPurchases || [])];

   // Filter following active states: search, month, week, status
   if (state.pp.search) {
      var q = state.pp.search.toLowerCase();
      list = list.filter(function (p) {
         return (p.itemName || "").toLowerCase().indexOf(q) !== -1 ||
            (p.category || "").toLowerCase().indexOf(q) !== -1 ||
            (p.note || "").toLowerCase().indexOf(q) !== -1;
      });
   }
   if (state.pp.month && state.pp.month !== "all") {
      list = list.filter(function (p) {
         if (!p.date) return false;
         return p.date.substring(5, 7) === state.pp.month;
      });
   }
   if (state.pp.week) {
      list = list.filter(function (p) {
         return p.weekKey === state.pp.week;
      });
   }
   if (state.pp.status && state.pp.status !== "all") {
      list = list.filter(function (p) {
         return p.status === state.pp.status;
      });
   }
   if (state.pp.date && state.pp.date !== "all") {
      list = list.filter(function (p) {
         return p.date === state.pp.date;
      });
   }

   if (list.length === 0) {
      toast("Tidak ada data belanja produksi untuk di-export", "warning");
      return;
   }

   // Sort list by date ascending for chronologically ordered reports
   list.sort(function (a, b) {
      return (a.date || "").localeCompare(b.date || "");
   });

   // Initialize ExcelJS Workbook
   var workbook = new ExcelJS.Workbook();
   var worksheet = workbook.addWorksheet("Belanja Produksi");

   worksheet.columns = [
      { header: "Tanggal", key: "tanggal", width: 15 },
      { header: "Week", key: "week", width: 15 },
      { header: "Nama Item", key: "item_name", width: 28 },
      { header: "Kategori", key: "category", width: 20 },
      { header: "Quantity", key: "qty", width: 12 },
      { header: "Unit", key: "unit", width: 12 },
      { header: "Harga Satuan", key: "harga", width: 16 },
      { header: "Total Biaya", key: "total", width: 18 },
      { header: "Status", key: "status", width: 12 },
      { header: "Catatan", key: "note", width: 32 }
   ];

   // Style Header Row
   var headerRow = worksheet.getRow(1);
   headerRow.height = 26;
   headerRow.eachCell(function (cell) {
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFF2C94C" } // Yellow color #f2c94c
      };
      cell.font = {
         name: "Arial",
         size: 10,
         bold: true
      };
      cell.border = {
         top: { style: "thin" },
         left: { style: "thin" },
         bottom: { style: "thin" },
         right: { style: "thin" }
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
   });

   // Helper styling function
   function applyPPRowStyles(row) {
      row.eachCell(function (cell, colNumber) {
         cell.font = { name: "Arial", size: 10 };
         cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
         };

         if (colNumber === 1 || colNumber === 2 || colNumber === 9) { // Tanggal, Week, Status
            cell.alignment = { vertical: "middle", horizontal: "center" };
         } else if (colNumber === 5) { // Quantity
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "#,##0.##";
         } else if (colNumber === 7 || colNumber === 8) { // Harga Satuan, Total Biaya
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "#,##0";
         } else { // Nama Item, Kategori, Unit, Catatan
            cell.alignment = { vertical: "middle", horizontal: "left" };
         }
      });
   }

   var totalCostSum = 0;
   list.forEach(function (p) {
      totalCostSum += p.totalCost || 0;
      var row = worksheet.addRow({
         tanggal: p.date || "",
         week: p.weekKey || "",
         item_name: p.itemName || "",
         category: p.category || "",
         qty: p.quantity || 0,
         unit: p.unit || "",
         harga: p.unitPrice || 0,
         total: p.totalCost || 0,
         status: p.status || "",
         note: p.note || ""
      });
      applyPPRowStyles(row);
   });

   // Add Grand Total Row
   var totalRow = worksheet.addRow({
      tanggal: "TOTAL BIAYA",
      week: "",
      item_name: "",
      category: "",
      qty: "",
      unit: "",
      harga: "",
      total: totalCostSum,
      status: "",
      note: ""
   });
   totalRow.height = 24;
   totalRow.eachCell(function (cell, colNumber) {
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFFFE57F" } // Light amber accent
      };
      cell.border = {
         top: { style: "double" },
         bottom: { style: "double" },
         left: { style: "thin" },
         right: { style: "thin" }
      };

      if (colNumber === 8) {
         cell.alignment = { vertical: "middle", horizontal: "right" };
         cell.numFmt = "#,##0";
      } else {
         cell.alignment = { vertical: "middle", horizontal: "left" };
      }
   });

   // Write Buffer and Download
   workbook.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var a = document.createElement("a");
      var dateStr = (state.pp.date && state.pp.date !== "all" ? state.pp.date : new Date().toISOString().split("T")[0]).replace(/-/g, "_");
      a.href = URL.createObjectURL(blob);
      a.download = "production_purchase_report_" + dateStr + ".xlsx";
      a.click();
      toast("Data belanja produksi di-export ke Excel", "success");
   });
};

// ---- Purchase modal helpers ----
function purchaseFormHTML(p) {
   const v = p || {
      date: today,
      weekKey: getWeekKey(today),
      itemName: "",
      category: "",
      quantity: 1,
      unit: "pcs",
      unitPrice: 0,
      totalCost: 0,
      note: "",
   };
   return `
    <div class="form-row">
      <div class="form-group"><label>Tanggal</label><input type="date" class="form-input" id="fPPDate" value="${v.date}" oninput="updatePPWeekKey()"></div>
      <div class="form-group"><label>Kode Minggu</label><input type="text" class="form-input" id="fPPWeekKey" value="${v.weekKey}" readonly style="background:var(--primary-light)"></div>
    </div>
    <div class="form-row">
      <div class="form-group full"><label>Nama Barang</label><input type="text" class="form-input" id="fPPItemName" value="${v.itemName || ""}" placeholder="Contoh: Kain Canvas" required></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Kategori Belanja</label><input type="text" class="form-input" id="fPPCategory" value="${v.category || ""}" placeholder="Contoh: Bahan Baku"></div>
      <div class="form-group"><label>Satuan</label><input type="text" class="form-input" id="fPPUnit" value="${v.unit || "pcs"}" placeholder="pcs / meter / kg"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Jumlah</label><input type="number" class="form-input" id="fPPQty" value="${v.quantity}" min="0.01" step="0.01" oninput="calcPPTotal()"></div>
      <div class="form-group"><label>Harga Satuan (Rp)</label><input type="number" class="form-input" id="fPPUnitPrice" value="${v.unitPrice}" min="0" oninput="calcPPTotal()"></div>
    </div>
    <div style="padding:10px 14px;background:var(--primary-light);border-radius:var(--radius-sm);font-size:13px;margin-bottom:16px">
      Total: <strong id="fPPTotalDisplay">${fmtRp(v.totalCost)}</strong>
    </div>
    <div class="form-group"><label>Catatan</label><input type="text" class="form-input" id="fPPNote" value="${v.note || ""}" placeholder="Opsional"></div>
    ${isInvestorEditor() ? investorFundCheckboxHTML(!!v.investorAgreementId) : ""}`;
}

window.updatePPWeekKey = function () {
   const dateEl = $("#fPPDate"),
      wkEl = $("#fPPWeekKey");
   if (dateEl && wkEl) wkEl.value = getWeekKey(dateEl.value);
};
window.calcPPTotal = function () {
   const qty = parseFloat($("#fPPQty").value) || 0;
   const up = parsePrice($("#fPPUnitPrice").value);
   const total = Math.round(qty * up);
   const el = $("#fPPTotalDisplay");
   if (el) el.textContent = fmtRp(total);
};

// ---- Open Add Modal ----
window.openAddPurchaseModal = function () {
   if (isInvestorEditor()) startInvestorListeners();
   openModal(
      "Tambah Belanja Produksi",
      purchaseFormHTML(),
      `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>
    <button class="btn btn-primary btn-sm" onclick="savePurchase()"><i class="fas fa-check"></i>Simpan</button>`,
   );
};

// ---- Save new purchase ----
window.savePurchase = async function () {
   const itemName = ($("#fPPItemName") ? $("#fPPItemName").value : "").trim();
   if (!itemName) {
      toast("Nama barang wajib diisi", "warning");
      return;
   }
   const qty = parseFloat($("#fPPQty").value) || 0;
   const up = parsePrice($("#fPPUnitPrice").value);
   const date = $("#fPPDate").value || today;
   const doc = sanitize({
      date: date,
      weekKey: $("#fPPWeekKey").value || getWeekKey(date),
      itemName: itemName,
      category: $("#fPPCategory") ? $("#fPPCategory").value.trim() : "",
      quantity: qty,
      unit: $("#fPPUnit") ? $("#fPPUnit").value.trim() : "pcs",
      unitPrice: up,
      totalCost: Math.round(qty * up),
      note: $("#fPPNote") ? $("#fPPNote").value.trim() : "",
      status: "open",
      closedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
   });
   const investorBox = $("#fPPInvestor");
   const markInvestor = !!(investorBox && investorBox.checked);
   if (markInvestor) Object.assign(doc, investorMarkFields());
   try {
      await db.collection("production_purchases").add(doc);
      toast("Belanja dicatat", "success");
      if (markInvestor) warnIfBeforeEffective(date);
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

// ---- Edit purchase ----
window.editPurchase = function (id) {
   const p = state.productionPurchases.find((x) => x.id === id);
   if (!p) {
      toast("Data tidak ditemukan", "error");
      return;
   }
   if (p.status === "closed") {
      toast("Belanja yang sudah ditutup tidak bisa diedit", "warning");
      return;
   }
   if (isInvestorEditor()) startInvestorListeners();
   openModal(
      "Edit Belanja Produksi",
      purchaseFormHTML(p),
      `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>
    <button class="btn btn-primary btn-sm" onclick="saveEditPurchase('${id}')"><i class="fas fa-check"></i>Update</button>`,
   );
};

window.saveEditPurchase = async function (id) {
   const p = state.productionPurchases.find((x) => x.id === id);
   if (!p || p.status === "closed") {
      toast("Tidak bisa mengedit pembelian yang sudah ditutup", "warning");
      return;
   }
   const itemName = ($("#fPPItemName") ? $("#fPPItemName").value : "").trim();
   if (!itemName) {
      toast("Nama barang wajib diisi", "warning");
      return;
   }
   const qty = parseFloat($("#fPPQty").value) || 0;
   const up = parsePrice($("#fPPUnitPrice").value);
   const date = $("#fPPDate").value || today;
   const updates = sanitize({
      date: date,
      weekKey: $("#fPPWeekKey").value || getWeekKey(date),
      itemName: itemName,
      category: $("#fPPCategory") ? $("#fPPCategory").value.trim() : "",
      quantity: qty,
      unit: $("#fPPUnit") ? $("#fPPUnit").value.trim() : "pcs",
      unitPrice: up,
      totalCost: Math.round(qty * up),
      note: $("#fPPNote") ? $("#fPPNote").value.trim() : "",
      updatedAt: new Date().toISOString(),
   });
   const investorBox = $("#fPPInvestor");
   const markInvestor = !!(investorBox && investorBox.checked && !p.investorAgreementId);
   if (markInvestor) Object.assign(updates, investorMarkFields());
   if (investorBox && !investorBox.checked && p.investorAgreementId) Object.assign(updates, investorUnmarkFields());
   try {
      await db.collection("production_purchases").doc(id).update(updates);
      toast("Belanja diupdate", "success");
      if (investorBox && investorBox.checked) warnIfBeforeEffective(date);
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

// ---- Delete purchase ----
window.confirmDeletePurchase = function (id) {
   const p = state.productionPurchases.find((x) => x.id === id);
   if (!p) return;
   if (p.status === "closed") {
      toast("Belanja yang sudah ditutup tidak bisa dihapus", "warning");
      return;
   }
   openModal(
      "Konfirmasi Hapus",
      `<div style="text-align:center;padding:10px 0">
       <i class="fas fa-trash" style="font-size:40px;color:var(--danger);opacity:.6;margin-bottom:14px;display:block"></i>
       <p style="font-size:15px;font-weight:600">Hapus "${p.itemName}"?</p>
       <p style="font-size:13px;color:var(--text-muted);margin-top:6px">Total: ${fmtRp(p.totalCost)}</p>
       ${p.investorAgreementId ? '<p style="font-size:13px;color:var(--warning);margin-top:10px;line-height:1.5">Belanja ini tampil di portal investor sebagai penggunaan dana investasi. Setelah dihapus, belanja ini juga hilang dari portal.</p>' : ""}
     </div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>
     <button class="btn btn-danger btn-sm" onclick="doDeletePurchase('${id}')"><i class="fas fa-trash"></i>Hapus</button>`,
   );
};

window.doDeletePurchase = async function (id) {
   try {
      await db.collection("production_purchases").doc(id).delete();
      toast("Belanja dihapus", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

// ---- Close week ----
window.closeWeek = function (weekKey) {
   if (!weekKey) {
      toast("Pilih minggu yang ingin ditutup", "warning");
      return;
   }
   const openItems = state.productionPurchases.filter(
      (p) => p.weekKey === weekKey && p.status === "open",
   );
   if (!openItems.length) {
      toast("Tidak ada pembelian open di minggu " + weekKey, "warning");
      return;
   }
   const weekTotal = state.productionPurchases
      .filter((p) => p.weekKey === weekKey)
      .reduce((s, p) => s + (p.totalCost || 0), 0);
   openModal(
      "Tutup Minggu " + weekKeyLabel(weekKey),
      `<div style="text-align:center;padding:10px 0">
       <i class="fas fa-lock" style="font-size:40px;color:var(--warning);opacity:.7;margin-bottom:14px;display:block"></i>
       <p style="font-size:15px;font-weight:600">Tutup ${weekKeyLabel(weekKey)}?</p>
       <p style="font-size:13px;color:var(--text-muted);margin-top:8px">${openItems.length} pembelian akan ditandai <strong>closed</strong></p>
       <p style="font-size:14px;font-weight:700;margin-top:10px">Total minggu: ${fmtRp(weekTotal)}</p>
     </div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>
     <button class="btn btn-accent btn-sm" onclick="doCloseWeek('${weekKey}')"><i class="fas fa-lock"></i>Tutup Minggu</button>`,
   );
};

window.doCloseWeek = async function (weekKey) {
   const openItems = state.productionPurchases.filter(
      (p) => p.weekKey === weekKey && p.status === "open",
   );
   if (!openItems.length) {
      toast("Tidak ada item open", "warning");
      closeModal();
      return;
   }
   try {
      const batch = db.batch();
      const now = new Date().toISOString();
      openItems.forEach((p) => {
         batch.update(db.collection("production_purchases").doc(p.id), {
            status: "closed",
            closedAt: now,
            updatedAt: now,
         });
      });
      await batch.commit();
      toast(
         weekKeyLabel(weekKey) +
            " berhasil ditutup (" +
            openItems.length +
            " item)",
         "success",
      );
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

/* =========================================================
   GAJI KARYAWAN — Phase 4B
   ========================================================= */

// ---- Role helpers ----
function getCurrentUserRole() {
   return (state.user && state.user.role ? state.user.role : "").toLowerCase();
}

function canAccessPayrollRecord(record) {
   const role = getCurrentUserRole();
   if (role === "owner") return true;
   // Admin can only see employee/staff — treat missing employeeRole as 'employee'
   const empRole = (record.employeeRole || "employee").toLowerCase();
   return empRole === "employee" || empRole === "staff";
}

function getPayrollPeriods() {
   const periods = new Set();
   state.payrolls.forEach((p) => {
      if (p.period) periods.add(p.period);
   });
   return [...periods].sort().reverse();
}

function payrollRoleBadge(empRole) {
   const r = (empRole || "employee").toLowerCase();
   const m = {
      owner: "badge-website",
      admin: "badge-in_progress",
      employee: "badge-active",
      staff: "badge-qc",
   };
   const l = {
      owner: "Owner",
      admin: "Admin",
      employee: "Karyawan",
      staff: "Staff",
   };
   return `<span class="badge ${m[r] || "badge-active"}">${l[r] || empRole}</span>`;
}

function payrollStatusBadge(s) {
   return s === "paid"
      ? `<span class="badge badge-active">Lunas</span>`
      : `<span class="badge badge-pending">Belum Lunas</span>`;
}

function renderPayrolls() {
   const container = $("#pageGajiKaryawan");
   if (!container) return;

   const userRole = getCurrentUserRole();
   if (userRole !== "owner") {
      container.innerHTML = `<div class="empty-state"><i class="fas fa-lock"></i><h4>Akses ditolak</h4><p>Halaman ini hanya untuk Owner</p></div>`;
      return;
   }

   const { search, period, status, page, perPage } = state.payroll;

   let list = state.payrolls.filter(canAccessPayrollRecord);

   if (search) {
      const q = search.toLowerCase();
      list = list.filter(
         (p) =>
            (p.employeeName || "").toLowerCase().includes(q) ||
            (p.note || "").toLowerCase().includes(q) ||
            (p.period || "").toLowerCase().includes(q),
      );
   }
   if (period) list = list.filter((p) => p.period === period);
   if (status !== "all") list = list.filter((p) => p.status === status);

   const total = Math.max(1, Math.ceil(list.length / perPage));
   if (page > total) state.payroll.page = 1;
   const start = (state.payroll.page - 1) * perPage;
   const items = list.slice(start, start + perPage);

   const periodOpts = getPayrollPeriods()
      .map(
         (p) =>
            `<option value="${p}" ${p === period ? "selected" : ""}>${p}</option>`,
      )
      .join("");

   const toolbar = `
    <div class="table-toolbar">
      <div class="table-search"><i class="fas fa-search"></i><input type="text" id="payrollSearch" class="form-input" placeholder="Cari nama karyawan..." value="${search}" oninput="onPayrollSearch(this.value)"></div>
      <div class="table-filter">
        <select class="form-input" onchange="onPayrollPeriod(this.value)">
          <option value="">Semua Periode</option>${periodOpts}
        </select>
      </div>
      <div class="table-filter">
        <select class="form-input" onchange="onPayrollStatus(this.value)">
          <option value="all" ${status === "all" ? "selected" : ""}>Semua Status</option>
          <option value="unpaid" ${status === "unpaid" ? "selected" : ""}>Belum Lunas</option>
          <option value="paid" ${status === "paid" ? "selected" : ""}>Lunas</option>
        </select>
      </div>
      <div class="responsive-action-group" style="margin-left:auto;display:flex;gap:8px;align-items:center">
        <button class="btn btn-outline btn-sm" onclick="exportPayroll()"><i class="fas fa-download"></i>Export</button>
        <button class="btn btn-primary btn-sm" onclick="openAddPayrollModal()"><i class="fas fa-plus"></i>Tambah Gaji</button>
      </div>
    </div>`;

   const rows = items.length
      ? items
           .map((p) => {
              const actions = `<div class="action-btns">
          <button class="action-btn" title="Edit" onclick="editPayroll('${p.id}')"><i class="fas fa-pen"></i></button>
          <button class="action-btn del" title="Hapus" onclick="confirmDeletePayroll('${p.id}')"><i class="fas fa-trash"></i></button>
        </div>`;
              return `<tr>
          <td><strong>${p.employeeName || "-"}</strong></td>
          <td>${payrollRoleBadge(p.employeeRole)}</td>
          <td>${p.period || "-"}</td>
          <td>${p.paymentDate || "-"}</td>
          <td>${fmtRp(p.baseSalary)}</td>
          <td style="color:var(--success)">${fmtRp(p.bonus || 0)}</td>
          <td style="color:var(--danger)">${fmtRp(p.deduction || 0)}</td>
          <td style="font-weight:700">${fmtRp(p.totalPaid)}</td>
          <td>${payrollStatusBadge(p.status)}</td>
          <td style="color:var(--text-muted);font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.note || ""}">${p.note || "-"}</td>
          <td>${actions}</td>
        </tr>`;
           })
           .join("")
      : `<tr><td colspan="11"><div class="empty-state"><i class="fas fa-money-bill-wave"></i><h4>Belum ada data gaji</h4><p>Tambahkan data penggajian</p></div></td></tr>`;

   let pag = renderPaginationHTML(state.payroll.page, total, "goPayrollPage");

   container.innerHTML = `
    <div class="card">
      ${toolbar}
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>
            <th>Nama Karyawan</th><th>Jabatan</th><th>Periode</th><th>Tgl Bayar</th>
            <th>Gaji Pokok</th><th>Bonus</th><th>Potongan</th><th>Total</th>
            <th>Status</th><th>Catatan</th><th>Aksi</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="table-footer">
        <span>${list.length > 0 ? `Menampilkan ${start + 1}–${Math.min(start + perPage, list.length)} dari ${list.length}` : ""}</span>
        <div class="pagination">${pag}</div>
      </div>
    </div>`;
}

window.onPayrollSearch = function (val) {
   state.payroll.search = val;
   state.payroll.page = 1;
   renderPayrolls();
   const input = document.getElementById("payrollSearch");
   if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
   }
};
window.onPayrollPeriod = function (val) {
   state.payroll.period = val;
   state.payroll.page = 1;
   renderPayrolls();
};
window.onPayrollStatus = function (val) {
   state.payroll.status = val;
   state.payroll.page = 1;
   renderPayrolls();
};
window.goPayrollPage = function (n) {
   state.payroll.page = n;
   renderPayrolls();
};

window.exportPayroll = function () {
   var list = state.payrolls.filter(canAccessPayrollRecord);

   // Filter following active states: search, period, status
   if (state.payroll.search) {
      var q = state.payroll.search.toLowerCase();
      list = list.filter(function (p) {
         return (p.employeeName || "").toLowerCase().indexOf(q) !== -1 ||
            (p.note || "").toLowerCase().indexOf(q) !== -1 ||
            (p.period || "").toLowerCase().indexOf(q) !== -1;
      });
   }
   if (state.payroll.period) {
      list = list.filter(function (p) {
         return p.period === state.payroll.period;
      });
   }
   if (state.payroll.status && state.payroll.status !== "all") {
      list = list.filter(function (p) {
         return p.status === state.payroll.status;
      });
   }

   if (list.length === 0) {
      toast("Tidak ada data gaji untuk di-export", "warning");
      return;
   }

   // Sort list by Employee Name ascending
   list.sort(function (a, b) {
      return (a.employeeName || "").localeCompare(b.employeeName || "");
   });

   // Initialize ExcelJS Workbook
   var workbook = new ExcelJS.Workbook();
   var worksheet = workbook.addWorksheet("Payroll Karyawan");

   worksheet.columns = [
      { header: "Nama Karyawan", key: "nama", width: 25 },
      { header: "Jabatan", key: "jabatan", width: 16 },
      { header: "Periode", key: "periode", width: 15 },
      { header: "Tgl Bayar", key: "tgl_bayar", width: 15 },
      { header: "Gaji Pokok", key: "gaji_pokok", width: 16 },
      { header: "Bonus", key: "bonus", width: 16 },
      { header: "Potongan", key: "potongan", width: 16 },
      { header: "Total Diterima", key: "total", width: 18 },
      { header: "Status", key: "status", width: 14 },
      { header: "Catatan", key: "catatan", width: 32 }
   ];

   // Style Header Row
   var headerRow = worksheet.getRow(1);
   headerRow.height = 26;
   headerRow.eachCell(function (cell) {
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFF2C94C" } // Yellow color #f2c94c
      };
      cell.font = {
         name: "Arial",
         size: 10,
         bold: true
      };
      cell.border = {
         top: { style: "thin" },
         left: { style: "thin" },
         bottom: { style: "thin" },
         right: { style: "thin" }
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
   });

   // Helper styling function
   function applyPayrollRowStyles(row) {
      row.eachCell(function (cell, colNumber) {
         cell.font = { name: "Arial", size: 10 };
         cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
         };

         if (colNumber === 3 || colNumber === 4 || colNumber === 9) { // Periode, Tgl Bayar, Status
            cell.alignment = { vertical: "middle", horizontal: "center" };
         } else if (colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 8) { // Currency columns
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "#,##0";
         } else { // Nama Karyawan, Jabatan, Catatan
            cell.alignment = { vertical: "middle", horizontal: "left" };
         }
      });
   }

   var totalBase = 0;
   var totalBonus = 0;
   var totalDeduction = 0;
   var totalPaidSum = 0;

   list.forEach(function (p) {
      totalBase += p.baseSalary || 0;
      totalBonus += p.bonus || 0;
      totalDeduction += p.deduction || 0;
      totalPaidSum += p.totalPaid || 0;

      var statusText = p.status === "paid" ? "Lunas" : "Belum Lunas";
      var roleText = p.employeeRole === "owner" ? "Owner" : p.employeeRole === "admin" ? "Admin" : p.employeeRole === "staff" ? "Staff" : "Karyawan";

      var row = worksheet.addRow({
         nama: p.employeeName || "",
         jabatan: roleText,
         periode: p.period || "",
         tgl_bayar: p.paymentDate || "",
         gaji_pokok: p.baseSalary || 0,
         bonus: p.bonus || 0,
         potongan: p.deduction || 0,
         total: p.totalPaid || 0,
         status: statusText,
         catatan: p.note || ""
      });
      applyPayrollRowStyles(row);
   });

   // Add Grand Total Row
   var totalRow = worksheet.addRow({
      nama: "TOTAL PAYROLL",
      jabatan: "",
      periode: "",
      tgl_bayar: "",
      gaji_pokok: totalBase,
      bonus: totalBonus,
      potongan: totalDeduction,
      total: totalPaidSum,
      status: "",
      catatan: ""
   });
   totalRow.height = 24;
   totalRow.eachCell(function (cell, colNumber) {
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFFFE57F" } // Light amber accent
      };
      cell.border = {
         top: { style: "double" },
         bottom: { style: "double" },
         left: { style: "thin" },
         right: { style: "thin" }
      };

      if (colNumber === 5 || colNumber === 6 || colNumber === 7 || colNumber === 8) {
         cell.alignment = { vertical: "middle", horizontal: "right" };
         cell.numFmt = "#,##0";
      } else {
         cell.alignment = { vertical: "middle", horizontal: "left" };
      }
   });

   // Write Buffer and Download
   workbook.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var a = document.createElement("a");
      var dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "_");
      a.href = URL.createObjectURL(blob);
      a.download = "payroll_report_" + dateStr + ".xlsx";
      a.click();
      toast("Data payroll di-export ke Excel", "success");
   });
};

// ---- Payroll form HTML ----
function payrollFormHTML(p) {
   const userRole = getCurrentUserRole();
   const v = p || {
      employeeName: "",
      employeeRole: "employee",
      period: new Date().toISOString().substring(0, 7),
      paymentDate: today,
      baseSalary: 0,
      bonus: 0,
      deduction: 0,
      totalPaid: 0,
      status: "unpaid",
      note: "",
   };

   // Role options depend on current user's access
   const allRoleOpts = [
      { val: "owner", label: "Owner" },
      { val: "admin", label: "Admin" },
      { val: "employee", label: "Karyawan" },
      { val: "staff", label: "Staff" },
   ];
   const visibleRoles =
      userRole === "owner"
         ? allRoleOpts
         : allRoleOpts.filter((r) => r.val === "employee" || r.val === "staff");
   const roleOpts = visibleRoles
      .map(
         (r) =>
            `<option value="${r.val}" ${v.employeeRole === r.val ? "selected" : ""}>${r.label}</option>`,
      )
      .join("");

   return `
    <div class="form-row">
      <div class="form-group"><label>Nama Karyawan</label><input type="text" class="form-input" id="fPayrollName" value="${v.employeeName || ""}" placeholder="Nama lengkap" required></div>
      <div class="form-group"><label>Jabatan</label><select class="form-input" id="fPayrollRole">${roleOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Periode <small style="color:var(--text-muted);font-weight:400">(YYYY-MM)</small></label><input type="month" class="form-input" id="fPayrollPeriod" value="${v.period || ""}"></div>
      <div class="form-group"><label>Tanggal Bayar</label><input type="date" class="form-input" id="fPayrollDate" value="${v.paymentDate || today}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Gaji Pokok (Rp)</label><input type="number" class="form-input" id="fPayrollBase" value="${v.baseSalary || 0}" min="0" oninput="calcPayrollTotal()"></div>
      <div class="form-group"><label>Bonus (Rp)</label><input type="number" class="form-input" id="fPayrollBonus" value="${v.bonus || 0}" min="0" oninput="calcPayrollTotal()"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Potongan (Rp)</label><input type="number" class="form-input" id="fPayrollDeduction" value="${v.deduction || 0}" min="0" oninput="calcPayrollTotal()"></div>
      <div class="form-group"><label>Status</label><select class="form-input" id="fPayrollStatus"><option value="unpaid" ${v.status === "unpaid" ? "selected" : ""}>Belum Lunas</option><option value="paid" ${v.status === "paid" ? "selected" : ""}>Lunas</option></select></div>
    </div>
    <div style="padding:10px 14px;background:var(--primary-light);border-radius:var(--radius-sm);font-size:13px;margin-bottom:16px">
      Total Dibayar: <strong id="fPayrollTotalDisplay">${fmtRp(v.totalPaid || 0)}</strong>
    </div>
    <div class="form-group"><label>Catatan</label><input type="text" class="form-input" id="fPayrollNote" value="${v.note || ""}" placeholder="Opsional"></div>`;
}

window.calcPayrollTotal = function () {
   const base = parsePrice($("#fPayrollBase").value);
   const bonus = parsePrice($("#fPayrollBonus").value);
   const ded = parsePrice($("#fPayrollDeduction").value);
   const el = $("#fPayrollTotalDisplay");
   if (el) el.textContent = fmtRp(base + bonus - ded);
};

// ---- Role guard helper ----
function isPayrollRoleBlocked(empRole) {
   const userRole = getCurrentUserRole();
   if (userRole === "owner") return false;
   const r = (empRole || "").toLowerCase();
   return r === "owner" || r === "admin";
}

// ---- Add payroll ----
window.openAddPayrollModal = function () {
   openModal(
      "Tambah Data Gaji",
      payrollFormHTML(),
      `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>
    <button class="btn btn-primary btn-sm" onclick="savePayroll()"><i class="fas fa-check"></i>Simpan</button>`,
   );
};

window.savePayroll = async function () {
   const name = ($("#fPayrollName") ? $("#fPayrollName").value : "").trim();
   if (!name) {
      toast("Nama karyawan wajib diisi", "warning");
      return;
   }
   const empRole = $("#fPayrollRole") ? $("#fPayrollRole").value : "employee";
   if (isPayrollRoleBlocked(empRole)) {
      toast(
         "Admin tidak dapat membuat data gaji untuk peran Owner atau Admin",
         "error",
      );
      return;
   }
   const base = parsePrice($("#fPayrollBase").value);
   const bonus = parsePrice($("#fPayrollBonus").value);
   const ded = parsePrice($("#fPayrollDeduction").value);
   const doc = sanitize({
      employeeName: name,
      employeeRole: empRole,
      period: $("#fPayrollPeriod") ? $("#fPayrollPeriod").value : "",
      paymentDate: $("#fPayrollDate") ? $("#fPayrollDate").value : today,
      baseSalary: base,
      bonus: bonus,
      deduction: ded,
      totalPaid: base + bonus - ded,
      status: $("#fPayrollStatus") ? $("#fPayrollStatus").value : "unpaid",
      note: $("#fPayrollNote") ? $("#fPayrollNote").value.trim() : "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
   });
   try {
      await db.collection("payrolls").add(doc);
      toast("Data gaji disimpan", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

// ---- Edit payroll ----
window.editPayroll = function (id) {
   const p = state.payrolls.find((x) => x.id === id);
   if (!p) {
      toast("Data tidak ditemukan", "error");
      return;
   }
   if (!canAccessPayrollRecord(p)) {
      toast("Anda tidak punya akses untuk mengedit data ini", "error");
      return;
   }
   openModal(
      "Edit Data Gaji",
      payrollFormHTML(p),
      `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>
    <button class="btn btn-primary btn-sm" onclick="saveEditPayroll('${id}')"><i class="fas fa-check"></i>Update</button>`,
   );
};

window.saveEditPayroll = async function (id) {
   const p = state.payrolls.find((x) => x.id === id);
   if (!p || !canAccessPayrollRecord(p)) {
      toast("Akses ditolak", "error");
      return;
   }
   const name = ($("#fPayrollName") ? $("#fPayrollName").value : "").trim();
   if (!name) {
      toast("Nama karyawan wajib diisi", "warning");
      return;
   }
   const empRole = $("#fPayrollRole") ? $("#fPayrollRole").value : "employee";
   if (isPayrollRoleBlocked(empRole)) {
      toast(
         "Admin tidak dapat menyimpan data gaji untuk peran Owner atau Admin",
         "error",
      );
      return;
   }
   const base = parsePrice($("#fPayrollBase").value);
   const bonus = parsePrice($("#fPayrollBonus").value);
   const ded = parsePrice($("#fPayrollDeduction").value);
   const updates = sanitize({
      employeeName: name,
      employeeRole: empRole,
      period: $("#fPayrollPeriod") ? $("#fPayrollPeriod").value : "",
      paymentDate: $("#fPayrollDate") ? $("#fPayrollDate").value : today,
      baseSalary: base,
      bonus: bonus,
      deduction: ded,
      totalPaid: base + bonus - ded,
      status: $("#fPayrollStatus") ? $("#fPayrollStatus").value : "unpaid",
      note: $("#fPayrollNote") ? $("#fPayrollNote").value.trim() : "",
      updatedAt: new Date().toISOString(),
   });
   try {
      await db.collection("payrolls").doc(id).update(updates);
      toast("Data gaji diupdate", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

// ---- Delete payroll ----
window.confirmDeletePayroll = function (id) {
   const p = state.payrolls.find((x) => x.id === id);
   if (!p) return;
   if (!canAccessPayrollRecord(p)) {
      toast("Anda tidak punya akses untuk menghapus data ini", "error");
      return;
   }
   openModal(
      "Konfirmasi Hapus",
      `<div style="text-align:center;padding:10px 0">
       <i class="fas fa-trash" style="font-size:40px;color:var(--danger);opacity:.6;margin-bottom:14px;display:block"></i>
       <p style="font-size:15px;font-weight:600">Hapus data gaji "${p.employeeName}"?</p>
       <p style="font-size:13px;color:var(--text-muted);margin-top:6px">Periode: ${p.period} — ${fmtRp(p.totalPaid)}</p>
     </div>`,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>
     <button class="btn btn-danger btn-sm" onclick="doDeletePayroll('${id}')"><i class="fas fa-trash"></i>Hapus</button>`,
   );
};

window.doDeletePayroll = async function (id) {
   try {
      await db.collection("payrolls").doc(id).delete();
      toast("Data gaji dihapus", "success");
      closeModal();
   } catch (err) {
      toast("Gagal: " + err.message, "error");
   }
};

/* =========================================================
   SALARY PRODUKSI (GAJI BORONGAN)
   Collection: production_salaries
   Struktur dokumen: { workerName, periodDate, items: [{productId, productName, qty, upah, subtotal}], grandTotal, createdAt, updatedAt }
   ========================================================= */

// ---- Render halaman (Accordion) ----
function renderSalaryProduksi() {
   var container = $("#pageSalaryProduksi");
   if (!container) return;

   const _spRole = getCurrentUserRole();
   if (_spRole !== "owner" && _spRole !== "admin") {
      container.innerHTML =
         '<div class="empty-state"><i class="fas fa-lock"></i><h4>Akses ditolak</h4><p>Halaman ini hanya untuk Owner atau Admin</p></div>';
      return;
   }

   var list = state.salaryProduksi || [];

   // --- Filtering: search ---
   if (state.salaryProd.search) {
      var q = state.salaryProd.search.toLowerCase();
      list = list.filter(function (d) {
         var names = d.workers && d.workers.length > 0 ? d.workers.join(" ") : (d.workerName || "");
         var itemNames = (d.items || []).map(function (i) { return i.productName || ""; }).join(" ");
         return names.toLowerCase().indexOf(q) !== -1 || itemNames.toLowerCase().indexOf(q) !== -1;
      });
   }

   // --- Filtering: month/year ---
   if (state.salaryProd.month !== "all" || state.salaryProd.year !== "all") {
      list = list.filter(function (d) {
         return matchesMonthYear(d.periodDate, state.salaryProd.month, state.salaryProd.year);
      });
   }

   // --- Period total ---
   var periodTotal = list.reduce(function (sum, d) { return sum + (d.grandTotal || 0); }, 0);

   var spPerPage = state.salaryProd.perPage;
   var spTotal = Math.max(1, Math.ceil(list.length / spPerPage));
   if (state.salaryProd.page > spTotal) state.salaryProd.page = 1;
   var spStart = (state.salaryProd.page - 1) * spPerPage;
   var items = list.slice(spStart, spStart + spPerPage);

   var accordionItems = list.length
      ? items
           .map(function (doc) {
              var itemRows = (doc.items || [])
                 .map(function (item) {
                    return (
                       "<tr>" +
                       "<td>" +
                       (item.productName || "-") +
                       "</td>" +
                       '<td style="text-align:center">' +
                       fmt(item.qty) +
                       " pcs</td>" +
                       "<td>" +
                       fmtRp(item.upah) +
                       "</td>" +
                       '<td style="font-weight:600;color:var(--primary)">' +
                       fmtRp(item.subtotal) +
                       "</td>" +
                       "</tr>"
                    );
                 })
                 .join("");

              var itemTableHTML =
                 (doc.items || []).length > 0
                    ? '<table class="cat-acc-inner-table">' +
                      "<thead><tr>" +
                      "<th>Nama Item / Produk</th>" +
                      '<th style="text-align:center">Qty</th>' +
                      "<th>Upah/pcs</th>" +
                      "<th>Subtotal</th>" +
                      "</tr></thead>" +
                      "<tbody>" +
                      itemRows +
                      "</tbody>" +
                      "</table>" +
                      '<div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;padding-top:12px;border-top:1px solid var(--border);margin-top:8px">' +
                      '<span style="font-size:13px;color:var(--text-muted)">Total Gaji Borongan:</span>' +
                      '<span style="font-size:16px;font-weight:700;color:var(--primary)">' +
                      fmtRp(doc.grandTotal) +
                      "</span>" +
                      "</div>"
                    : '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Tidak ada item jahitan.</p>';

              return (
                 '<div class="cat-accordion-item" id="sp-' +
                 doc.id +
                 '">' +
                 '<div class="cat-accordion-header" onclick="toggleSalaryProduksiAccordion(\'' +
                 doc.id +
                 "')\">" +
                 '<div class="cat-acc-icon"><i class="fas fa-user-tie"></i></div>' +
                 '<div class="cat-acc-info">' +
                 "<h4>" +
                 (doc.workers && doc.workers.length > 0
                    ? doc.workers.join(", ")
                    : doc.workerName || "-") +
                 "</h4>" +
                 '<p><span class="badge badge-in_progress">' +
                 (doc.periodDate || "-") +
                 "</span>" +
                 " &nbsp;" +
                 (doc.items || []).length +
                 " item jahitan</p>" +
                 "</div>" +
                 '<div style="margin-left:auto;font-weight:700;font-size:15px;color:var(--primary);padding-right:12px;white-space:nowrap">' +
                 fmtRp(doc.grandTotal) +
                 "</div>" +
                 '<div class="cat-acc-actions" onclick="event.stopPropagation()">' +
                 '<button class="action-btn" title="Edit" onclick="openSalaryProduksiModal(\'' +
                 doc.id +
                 '\')"><i class="fas fa-pen"></i></button>' +
                 '<button class="action-btn del" title="Hapus" onclick="deleteSalaryProduksi(\'' +
                 doc.id +
                 '\')"><i class="fas fa-trash"></i></button>' +
                 "</div>" +
                 '<i class="fas fa-chevron-down cat-chevron"></i>' +
                 "</div>" +
                 '<div class="cat-accordion-body" id="sp-body-' +
                 doc.id +
                 '" style="display:none">' +
                 '<div class="cat-acc-inner">' +
                 itemTableHTML +
                 "</div>" +
                 "</div>" +
                 "</div>"
              );
           })
           .join("")
      : '<div class="empty-state"><i class="fas fa-money-check-dollar"></i><h4>Belum ada data salary produksi</h4><p>Klik "+ Tambah Data" untuk menambahkan</p></div>';

   var spPag = renderPaginationHTML(state.salaryProd.page, spTotal, "goSalaryProduksiPage");

   // --- Build month/year filter options ---
   var spMonthOpts = '<option value="all"' + (state.salaryProd.month === "all" ? " selected" : "") + '>Semua Bulan</option>';
   MONTH_OPTIONS.forEach(function (m) {
      spMonthOpts += '<option value="' + m.value + '"' + (state.salaryProd.month === m.value ? " selected" : "") + '>' + m.label + '</option>';
   });
   var spYears = new Set();
   (state.salaryProduksi || []).forEach(function (d) {
      var y = (d.periodDate || "").substring(0, 4);
      if (/^\d{4}$/.test(y)) spYears.add(y);
   });
   spYears.add(String(new Date().getFullYear()));
   var spSortedYears = Array.from(spYears).sort(function (a, b) { return b.localeCompare(a); });
   var spYearOpts = '<option value="all"' + (state.salaryProd.year === "all" ? " selected" : "") + '>Semua Tahun</option>';
   spSortedYears.forEach(function (y) {
      spYearOpts += '<option value="' + y + '"' + (state.salaryProd.year === y ? " selected" : "") + '>' + y + '</option>';
   });

   container.innerHTML =
      '<div class="cat-toolbar">' +
      "<div>" +
      '<h3 style="font-size:16px;font-weight:700">Daftar Gaji Borongan</h3>' +
      '<p style="font-size:13px;color:var(--text-muted);margin-top:4px">' +
      list.length +
      " data tersimpan</p>" +
      "</div>" +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-outline btn-sm" onclick="exportSalaryProduksi()">' +
      '<i class="fas fa-download"></i>Export' +
      '</button>' +
      '<button class="btn btn-primary btn-sm" onclick="openSalaryProduksiModal()">' +
      '<i class="fas fa-plus"></i>Tambah Data' +
      '</button>' +
      '</div>' +
      "</div>" +
      // --- Toolbar: search + filters ---
      '<div class="table-toolbar" style="margin-bottom:14px">' +
      '<div class="table-search">' +
      '<i class="fas fa-search"></i>' +
      '<input type="text" placeholder="Cari nama pekerja / item..." id="spSearch" value="' + (state.salaryProd.search || "").replace(/"/g, "&quot;") + '" oninput="onSpSearch(this.value)">' +
      '</div>' +
      '<div class="table-filter">' +
      '<select id="spMonthFilter" onchange="onSpMonthChange(this.value)">' + spMonthOpts + '</select>' +
      '</div>' +
      '<div class="table-filter">' +
      '<select id="spYearFilter" onchange="onSpYearChange(this.value)">' + spYearOpts + '</select>' +
      '</div>' +
      '</div>' +
      // --- Period total summary ---
      '<div class="stat-grid" style="margin-bottom:14px">' +
      '<div class="stat-card green">' +
      '<div class="sc-top"><div class="sc-icon"><i class="fas fa-money-bill-wave"></i></div><span class="sc-label">Total Gaji (Periode)</span></div>' +
      '<div class="sc-value" style="font-size:clamp(16px,4vw,22px);word-break:break-word">' + fmtRp(periodTotal) + '</div>' +
      '<div class="sc-sub">gaji borongan terbayar</div>' +
      '</div>' +
      '<div class="stat-card gold">' +
      '<div class="sc-top"><div class="sc-icon"><i class="fas fa-list-check"></i></div><span class="sc-label">Jumlah Data</span></div>' +
      '<div class="sc-value" style="font-size:clamp(16px,4vw,22px)">' + list.length + '</div>' +
      '<div class="sc-sub">entri salary produksi</div>' +
      '</div>' +
      '</div>' +
      '<div class="cat-accordion" id="salaryProduksiList">' +
      accordionItems +
      "</div>" +
      '<div class="table-footer" style="margin-top:16px">' +
      "<span>" +
      (list.length > 0
         ? "Menampilkan " +
           (spStart + 1) +
           "\u2013" +
           Math.min(spStart + spPerPage, list.length) +
           " dari " +
           list.length +
           " data"
         : "") +
      "</span>" +
      '<div class="pagination">' +
      spPag +
      "</div>" +
      "</div>";
}

window.exportSalaryProduksi = function () {
   var list = state.salaryProduksi || [];

   if (state.salaryProd.search) {
      var q = state.salaryProd.search.toLowerCase();
      list = list.filter(function (d) {
         var names = d.workers && d.workers.length > 0 ? d.workers.join(" ") : (d.workerName || "");
         var itemNames = (d.items || []).map(function (i) { return i.productName || ""; }).join(" ");
         return names.toLowerCase().indexOf(q) !== -1 || itemNames.toLowerCase().indexOf(q) !== -1;
      });
   }

   if (state.salaryProd.month !== "all" || state.salaryProd.year !== "all") {
      list = list.filter(function (d) {
         return matchesMonthYear(d.periodDate, state.salaryProd.month, state.salaryProd.year);
       });
   }

   if (list.length === 0) {
      toast("Tidak ada data untuk di-export", "warning");
      return;
   }

   // Initialize ExcelJS Workbook
   var workbook = new ExcelJS.Workbook();
   var worksheet = workbook.addWorksheet("Salary Produksi");

   worksheet.columns = [
      { header: "Tgl", key: "tanggal", width: 15 },
      { header: "Nama", key: "nama", width: 25 },
      { header: "Item", key: "item", width: 28 },
      { header: "jumlah Produksi", key: "jumlah", width: 16 },
      { header: "Harga jahit", key: "harga", width: 16 },
      { header: "total tukang", key: "total_tukang", width: 16 },
      { header: "totalminggu", key: "total_minggu", width: 18 }
   ];

   // Style Header Row
   var headerRow = worksheet.getRow(1);
   headerRow.height = 26;
   headerRow.eachCell(function (cell) {
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFF2C94C" } // Yellow color #f2c94c
      };
      cell.font = {
         name: "Arial",
         size: 10,
         bold: true
      };
      cell.border = {
         top: { style: "thin" },
         left: { style: "thin" },
         bottom: { style: "thin" },
         right: { style: "thin" }
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
   });

   var totalQty = 0;
   var totalSubtotal = 0;
   var totalGrand = 0;

   // Helper styling function
   function applyRowStyles(row) {
      row.eachCell(function (cell, colNumber) {
         cell.font = { name: "Arial", size: 10 };
         cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
         };

         if (colNumber === 1 || colNumber === 2 || colNumber === 3) {
            cell.alignment = { vertical: "middle", horizontal: "left" };
         } else if (colNumber === 4) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.numFmt = "#,##0";
         } else if (colNumber === 5 || colNumber === 6 || colNumber === 7) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "#,##0";
         }
      });
   }

   list.forEach(function (doc) {
      var workerNames = doc.workers && doc.workers.length > 0 ? doc.workers.join(", ") : (doc.workerName || "-");
      var items = doc.items || [];
      totalGrand += doc.grandTotal || 0;

      if (items.length === 0) {
         var row = worksheet.addRow({
            tanggal: doc.periodDate || "",
            nama: workerNames,
            item: "-",
            jumlah: 0,
            harga: 0,
            total_tukang: 0,
            total_minggu: doc.grandTotal || 0
         });
         applyRowStyles(row);
      } else {
         items.forEach(function (item, index) {
            totalQty += item.qty || 0;
            totalSubtotal += item.subtotal || 0;

            var rowData = {
               tanggal: index === 0 ? doc.periodDate || "" : "",
               nama: index === 0 ? workerNames : "",
               item: item.productName || "-",
               jumlah: item.qty || 0,
               harga: item.upah || 0,
               total_tukang: item.subtotal || 0,
               total_minggu: index === 0 ? doc.grandTotal || 0 : ""
            };
            var row = worksheet.addRow(rowData);
            applyRowStyles(row);
         });
         // Add separator row
         var separatorRow = worksheet.addRow({});
         separatorRow.height = 12;
         separatorRow.eachCell(function (cell) {
            cell.border = {
               top: { style: "thin" },
               left: { style: "thin" },
               bottom: { style: "thin" },
               right: { style: "thin" }
            };
         });
      }
   });

   // Add Grand Total Row
   var totalRow = worksheet.addRow({
      tanggal: "TOTAL",
      nama: "",
      item: "",
      jumlah: totalQty,
      harga: "",
      total_tukang: totalSubtotal,
      total_minggu: totalGrand
   });
   totalRow.height = 24;
   totalRow.eachCell(function (cell, colNumber) {
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFFFE57F" } // Light amber accent
      };
      cell.border = {
         top: { style: "double" },
         bottom: { style: "double" },
         left: { style: "thin" },
         right: { style: "thin" }
      };

      if (colNumber === 4) {
         cell.alignment = { vertical: "middle", horizontal: "center" };
         cell.numFmt = "#,##0";
      } else if (colNumber === 6 || colNumber === 7) {
         cell.alignment = { vertical: "middle", horizontal: "right" };
         cell.numFmt = "#,##0";
      } else {
         cell.alignment = { vertical: "middle", horizontal: "left" };
      }
   });

   workbook.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var a = document.createElement("a");
      var dateStr = new Date().toISOString().split("T")[0];
      a.href = URL.createObjectURL(blob);
      a.download = "salary_produksi_" + dateStr + ".xlsx";
      a.click();
      toast("Salary Produksi di-export ke Excel", "success");
   });
};

window.onSpSearch = function (val) {
   state.salaryProd.search = val;
   state.salaryProd.page = 1;
   renderSalaryProduksi();
   // Restore focus + cursor to end
   var el = document.getElementById("spSearch");
   if (el) { el.focus(); var len = el.value.length; el.setSelectionRange(len, len); }
};
window.onSpMonthChange = function (val) {
   state.salaryProd.month = val;
   state.salaryProd.page = 1;
   renderSalaryProduksi();
};
window.onSpYearChange = function (val) {
   state.salaryProd.year = val;
   state.salaryProd.page = 1;
   renderSalaryProduksi();
};

window.goSalaryProduksiPage = function (n) {
   state.salaryProd.page = n;
   renderSalaryProduksi();
};

// ---- Toggle accordion item ----
window.toggleSalaryProduksiAccordion = function (id) {
   var body = document.getElementById("sp-body-" + id);
   var item = document.getElementById("sp-" + id);
   if (!body) return;
   var isOpen = body.style.display !== "none";
   body.style.display = isOpen ? "none" : "block";
   if (item) item.classList.toggle("open", !isOpen);
};

// ---- Buka modal tambah / edit ----
window.openSalaryProduksiModal = async function (docId) {
   var isEdit = !!docId;
   var existing = null;

   if (isEdit) {
      existing =
         (state.salaryProduksi || []).find(function (x) {
            return x.id === docId;
         }) || null;
      if (!existing) {
         try {
            var snap = await db
               .collection("production_salaries")
               .doc(docId)
               .get();
            if (snap.exists)
               existing = Object.assign({ id: snap.id }, snap.data());
         } catch (e) {
            toast("Gagal memuat data: " + e.message, "error");
            return;
         }
      }
      if (!existing) {
         toast("Data tidak ditemukan", "error");
         return;
      }
   }

   var v = existing || { workerName: "", periodDate: today };

   var body =
      '<div class="form-group">' +
      "<label>Nama Pekerja</label>" +
      '<div id="spWorkerList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px"></div>' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="addSalaryWorkerRow()">' +
      '<i class="fas fa-plus"></i>Tambah Nama' +
      "</button>" +
      "</div>" +
      '<div class="form-group">' +
      "<label>Periode / Tanggal</label>" +
      '<input type="date" class="form-input" id="fSpDate" value="' +
      (v.periodDate || today) +
      '">' +
      "</div>" +
      '<div class="form-group">' +
      "<label>Daftar Item Jahitan</label>" +
      '<div id="salaryProduksiItems" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="addSalaryProduksiRow()">' +
      '<i class="fas fa-tag"></i>+ Produk' +
      "</button>" +
      '<button type="button" class="btn btn-outline btn-sm" onclick="addSalaryProduksiCustomRow()">' +
      '<i class="fas fa-pencil"></i>+ Item Manual' +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div style="padding:12px 16px;background:var(--primary-light);border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center;margin-top:10px">' +
      '<span style="font-size:14px;font-weight:600">Total Gaji:</span>' +
      '<h3 id="salaryGrandTotal" style="margin:0;font-size:18px;color:var(--primary)">Rp 0</h3>' +
      "</div>";

   var footer =
      '<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>' +
      '<button class="btn btn-primary btn-sm" onclick="saveSalaryProduksi(' +
      (isEdit ? "'" + docId + "'" : "") +
      ')">' +
      '<i class="fas fa-check"></i>' +
      (isEdit ? "Update" : "Simpan") +
      "</button>";

   openModal(
      isEdit ? "Edit Salary Produksi" : "Tambah Salary Produksi",
      body,
      footer,
   );

   // Populate workers
   var initWorkers =
      isEdit && existing
         ? existing.workers && existing.workers.length > 0
            ? existing.workers
            : existing.workerName
              ? [existing.workerName]
              : []
         : [];
   if (initWorkers.length > 0) {
      initWorkers.forEach(function (n) {
         addSalaryWorkerRow(n);
      });
   } else {
      addSalaryWorkerRow();
   }

   // Populate items (dispatch ke product row atau custom row berdasar field type)
   if (isEdit && existing && existing.items && existing.items.length > 0) {
      existing.items.forEach(function (item) {
         if (item.type === "custom") {
            addSalaryProduksiCustomRow(item);
         } else {
            addSalaryProduksiRow(item);
         }
      });
   } else {
      addSalaryProduksiRow();
   }
   calcSalaryGrandTotal();
};

// ---- Tambah satu baris item ke dalam form ----
window.addSalaryProduksiRow = function (itemData) {
   var container = document.getElementById("salaryProduksiItems");
   if (!container) return;

   // Build product options dari state.products
   var productOpts = '<option value="">-- Pilih Produk --</option>';
   (state.products || []).forEach(function (p) {
      var safeName = (p.name || "").replace(/"/g, "&quot;");
      var selected = itemData && itemData.productId === p.id ? " selected" : "";
      productOpts +=
         '<option value="' +
         p.id +
         '" data-name="' +
         safeName +
         '"' +
         selected +
         ">" +
         (p.name || "-") +
         " (" +
         (p.sku || "") +
         ")</option>";
   });

   var qty = itemData ? itemData.qty || 1 : 1;
   var upah = itemData ? itemData.upah || 0 : 0;
   var subv = itemData ? itemData.subtotal || qty * upah : 0;

   var row = document.createElement("div");
   row.className = "sp-item-row";
   row.style.cssText =
      "display:grid;grid-template-columns:2fr minmax(56px,72px) minmax(80px,110px) minmax(80px,100px) 28px;gap:4px;align-items:center";
   row.innerHTML =
      '<select class="form-input sp-product" style="font-size:12px;padding:6px 8px" onchange="calcSalaryGrandTotal()">' +
      productOpts +
      "</select>" +
      '<input type="number" class="form-input sp-qty" value="' +
      qty +
      '" min="1" placeholder="Qty"' +
      ' style="font-size:12px;padding:6px 8px;text-align:center" oninput="calcSalaryGrandTotal()">' +
      '<input type="number" class="form-input sp-upah" value="' +
      upah +
      '" min="0" placeholder="Upah/pcs"' +
      ' style="font-size:12px;padding:6px 8px" oninput="calcSalaryGrandTotal()">' +
      '<div class="sp-subtotal" style="font-size:12px;font-weight:600;color:var(--primary);padding:6px 8px;' +
      'background:var(--bg-secondary);border-radius:var(--radius-sm);text-align:right">' +
      fmtRp(subv) +
      "</div>" +
      '<button type="button" title="Hapus baris"' +
      " onclick=\"this.closest('.sp-item-row').remove(); calcSalaryGrandTotal();\"" +
      ' style="width:28px;height:28px;border:none;background:var(--danger);color:#fff;' +
      "border-radius:var(--radius-sm);cursor:pointer;font-size:13px;" +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
      '<i class="fas fa-xmark"></i>' +
      "</button>";

   container.appendChild(row);
   calcSalaryGrandTotal();
};

// ---- Tambah baris nama pekerja ----
window.addSalaryWorkerRow = function (nameValue) {
   var container = document.getElementById("spWorkerList");
   if (!container) return;
   var row = document.createElement("div");
   row.className = "sp-worker-row";
   row.style.cssText = "display:flex;gap:6px;align-items:center";
   row.innerHTML =
      '<input type="text" class="form-input sp-worker-name" value="' +
      ((nameValue || "").replace(/"/g, "&quot;")) +
      '" placeholder="Nama pekerja" style="flex:1;font-size:13px;padding:7px 10px">' +
      '<button type="button" title="Hapus"' +
      " onclick=\"this.closest('.sp-worker-row').remove()\"" +
      ' style="width:28px;height:28px;border:none;background:var(--danger);color:#fff;' +
      "border-radius:var(--radius-sm);cursor:pointer;font-size:13px;" +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
      '<i class="fas fa-xmark"></i>' +
      "</button>";
   container.appendChild(row);
};

// ---- Tambah baris item custom (manual input nama item) ----
window.addSalaryProduksiCustomRow = function (itemData) {
   var container = document.getElementById("salaryProduksiItems");
   if (!container) return;

   var itemName = itemData ? itemData.productName || "" : "";
   var qty = itemData ? itemData.qty || 1 : 1;
   var upah = itemData ? itemData.upah || 0 : 0;
   var subv = itemData ? itemData.subtotal || qty * upah : 0;

   var row = document.createElement("div");
   row.className = "sp-item-row sp-custom-row";
   row.style.cssText =
      "display:grid;grid-template-columns:2fr minmax(56px,72px) minmax(80px,110px) minmax(80px,100px) 28px;gap:4px;align-items:center";
   row.innerHTML =
      '<input type="text" class="form-input sp-custom-name" value="' +
      (itemName.replace(/"/g, "&quot;")) +
      '" placeholder="Nama item (manual)" style="font-size:12px;padding:6px 8px">' +
      '<input type="number" class="form-input sp-qty" value="' +
      qty +
      '" min="1" placeholder="Qty"' +
      ' style="font-size:12px;padding:6px 8px;text-align:center" oninput="calcSalaryGrandTotal()">' +
      '<input type="number" class="form-input sp-upah" value="' +
      upah +
      '" min="0" placeholder="Upah/pcs"' +
      ' style="font-size:12px;padding:6px 8px" oninput="calcSalaryGrandTotal()">' +
      '<div class="sp-subtotal" style="font-size:12px;font-weight:600;color:var(--primary);padding:6px 8px;' +
      'background:var(--bg-secondary);border-radius:var(--radius-sm);text-align:right">' +
      fmtRp(subv) +
      "</div>" +
      '<button type="button" title="Hapus baris"' +
      " onclick=\"this.closest('.sp-item-row').remove(); calcSalaryGrandTotal();\"" +
      ' style="width:28px;height:28px;border:none;background:var(--danger);color:#fff;' +
      "border-radius:var(--radius-sm);cursor:pointer;font-size:13px;" +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
      '<i class="fas fa-xmark"></i>' +
      "</button>";

   container.appendChild(row);
   calcSalaryGrandTotal();
};

// ---- Hitung ulang subtotal tiap baris & grand total ----
window.calcSalaryGrandTotal = function () {
   var rows = document.querySelectorAll("#salaryProduksiItems .sp-item-row");
   var grand = 0;
   rows.forEach(function (row) {
      var qty = parseFloat(row.querySelector(".sp-qty").value) || 0;
      var upah = parseFloat(row.querySelector(".sp-upah").value) || 0;
      var sub = qty * upah;
      grand += sub;
      var subEl = row.querySelector(".sp-subtotal");
      if (subEl) subEl.textContent = fmtRp(sub);
   });
   var grandEl = document.getElementById("salaryGrandTotal");
   if (grandEl) grandEl.textContent = fmtRp(grand);
};

// ---- Simpan (Tambah / Update) ----
window.saveSalaryProduksi = async function (docId) {
   // Collect worker names from spWorkerList
   var workerRows = document.querySelectorAll("#spWorkerList .sp-worker-row");
   var workers = [];
   workerRows.forEach(function (row) {
      var input = row.querySelector(".sp-worker-name");
      var name = input ? input.value.trim() : "";
      if (name) workers.push(name);
   });
   if (workers.length === 0) {
      toast("Nama pekerja wajib diisi minimal 1", "warning");
      return;
   }

   // Backward-compatible workerName (first name)
   var workerName = workers[0];

   var dateEl = document.getElementById("fSpDate");
   var periodDate = dateEl ? dateEl.value : today;

   var rows = document.querySelectorAll("#salaryProduksiItems .sp-item-row");
   var items = [];
   var grandTotal = 0;

   rows.forEach(function (row) {
      var isCustom = row.classList.contains("sp-custom-row");
      var productId = "";
      var productName = "";

      if (isCustom) {
         // Custom item — read from text input
         var nameInput = row.querySelector(".sp-custom-name");
         productName = nameInput ? nameInput.value.trim() : "";
      } else {
         // Product item — read from select
         var selectEl = row.querySelector(".sp-product");
         productId = selectEl ? selectEl.value : "";
         var selectedOpt = selectEl
            ? selectEl.options[selectEl.selectedIndex]
            : null;
         productName = selectedOpt
            ? selectedOpt.dataset.name || selectedOpt.text
            : "";
      }

      var qty = parseFloat(row.querySelector(".sp-qty").value) || 0;
      var upah = parseFloat(row.querySelector(".sp-upah").value) || 0;
      var subtotal = qty * upah;
      grandTotal += subtotal;
      // Simpan baris meskipun produk belum dipilih, asal ada qty/upah
      if (qty > 0 || upah > 0) {
         items.push(
            sanitize({
               type: isCustom ? "custom" : "product",
               productId: productId,
               productName: productName,
               qty: qty,
               upah: upah,
               subtotal: subtotal,
            }),
         );
      }
   });

   if (items.length === 0) {
      toast("Tambahkan minimal 1 item jahitan", "warning");
      return;
   }

   var docData = sanitize({
      workerName: workerName,
      workers: workers,
      periodDate: periodDate,
      items: items,
      grandTotal: grandTotal,
      updatedAt: new Date().toISOString(),
   });

   try {
      if (docId) {
         await db.collection("production_salaries").doc(docId).update(docData);
         toast("Data salary produksi diperbarui", "success");
      } else {
         docData.createdAt = new Date().toISOString();
         await db.collection("production_salaries").add(docData);
         toast("Data salary produksi disimpan", "success");
      }
      closeModal();
   } catch (err) {
      toast("Gagal menyimpan: " + err.message, "error");
   }
};

// ---- Hapus — tampilkan konfirmasi ----
window.deleteSalaryProduksi = function (docId) {
   var doc = (state.salaryProduksi || []).find(function (x) {
      return x.id === docId;
   });
   if (!doc) {
      toast("Data tidak ditemukan", "error");
      return;
   }

   openModal(
      "Konfirmasi Hapus",
      '<div style="text-align:center;padding:10px 0">' +
         '<i class="fas fa-trash" style="font-size:40px;color:var(--danger);opacity:.6;margin-bottom:14px;display:block"></i>' +
         '<p style="font-size:15px;font-weight:600">Hapus data gaji "' +
         (doc.workerName || "-") +
         '"?</p>' +
         '<p style="font-size:13px;color:var(--text-muted);margin-top:6px">Periode: ' +
         (doc.periodDate || "-") +
         " — " +
         fmtRp(doc.grandTotal) +
         "</p>" +
         "</div>",
      '<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>' +
         '<button class="btn btn-danger btn-sm" onclick="doDeleteSalaryProduksi(\'' +
         docId +
         '\')"><i class="fas fa-trash"></i>Hapus</button>',
   );
};

window.doDeleteSalaryProduksi = async function (docId) {
   try {
      await db.collection("production_salaries").doc(docId).delete();
      toast("Data salary produksi dihapus", "success");
      closeModal();
   } catch (err) {
      toast("Gagal menghapus: " + err.message, "error");
   }
};

/* =========================================================
   SUPPORT SPONSORSHIP (Dukungan Event / Promosi)
   Collection: sponsorships
   Struktur dokumen: { eventName, eventDate, location, supportDetails, estimatedCost, createdAt, updatedAt }
   Hanya pencatatan — TIDAK ada logika potong stok.
   ========================================================= */

// ---- Render halaman (Accordion) ----
function renderSponsorship() {
   var container = $("#pageSponsorship");
   if (!container) return;

   var _role = getCurrentUserRole();
   if (_role !== "owner" && _role !== "admin") {
      container.innerHTML =
         '<div class="empty-state"><i class="fas fa-lock"></i><h4>Akses ditolak</h4><p>Halaman ini hanya untuk Owner atau Admin</p></div>';
      return;
   }

   var list = state.sponsorships || [];

   // --- Filtering: search ---
   if (state.spons.search) {
      var q = state.spons.search.toLowerCase();
      list = list.filter(function (d) {
         return (d.eventName || "").toLowerCase().indexOf(q) !== -1 ||
            (d.location || "").toLowerCase().indexOf(q) !== -1 ||
            (d.supportDetails || "").toLowerCase().indexOf(q) !== -1 ||
            ((d.supportItems || []).map(function (si) { return si.itemName || ""; }).join(" ")).toLowerCase().indexOf(q) !== -1;
      });
   }

   // --- Filtering: month/year ---
   if (state.spons.month !== "all" || state.spons.year !== "all") {
      list = list.filter(function (d) {
         return matchesMonthYear(d.eventDate, state.spons.month, state.spons.year);
      });
   }

   // --- Period total ---
   var sponsPeriodTotal = list.reduce(function (sum, d) { return sum + (d.estimatedCost || 0); }, 0);

   var sPerPage = state.spons.perPage;
   var sTotal = Math.max(1, Math.ceil(list.length / sPerPage));
   if (state.spons.page > sTotal) state.spons.page = 1;
   var sStart = (state.spons.page - 1) * sPerPage;
   var sItems = list.slice(sStart, sStart + sPerPage);

   var accordionItems = list.length
      ? sItems
           .map(function (doc) {
              var dateFormatted = doc.eventDate
                 ? new Date(doc.eventDate).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                   })
                 : "-";

              var locationBadge = doc.location
                 ? ' &nbsp;<span style="font-size:12px;color:var(--text-muted)">' +
                   '<i class="fas fa-location-dot"></i> ' +
                   doc.location +
                   "</span>"
                 : "";

              return (
                 '<div class="cat-accordion-item" id="spons-' +
                 doc.id +
                 '">' +
                 '<div class="cat-accordion-header" onclick="toggleSponsorshipAccordion(\'' +
                 doc.id +
                 "')\">" +
                 '<div class="cat-acc-icon"><i class="fas fa-handshake-angle"></i></div>' +
                 '<div class="cat-acc-info">' +
                 "<h4>" +
                 (doc.eventName || "-") +
                 "</h4>" +
                 '<p><span class="badge badge-in_progress">' +
                 (doc.eventDate || "-") +
                 "</span>" +
                 locationBadge +
                 "</p>" +
                 "</div>" +
                 '<div style="margin-left:auto;font-weight:700;font-size:15px;color:var(--primary);padding-right:12px;white-space:nowrap">' +
                 fmtRp(doc.estimatedCost || 0) +
                 "</div>" +
                 '<div class="cat-acc-actions" onclick="event.stopPropagation()">' +
                 '<button class="action-btn" title="Edit" onclick="openSponsorshipModal(\'' +
                 doc.id +
                 '\')"><i class="fas fa-pen"></i></button>' +
                 '<button class="action-btn del" title="Hapus" onclick="deleteSponsorship(\'' +
                 doc.id +
                 '\')"><i class="fas fa-trash"></i></button>' +
                 "</div>" +
                 '<i class="fas fa-chevron-down cat-chevron"></i>' +
                 "</div>" +
                 '<div class="cat-accordion-body" id="spons-body-' +
                 doc.id +
                 '" style="display:none">' +
                 '<div class="cat-acc-inner">' +
                 '<div style="display:flex;flex-direction:column;gap:14px;padding:4px 0">' +
                 "<div>" +
                 '<p style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Rincian Support</p>' +
                 (doc.supportItems && doc.supportItems.length > 0
                    ? '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">' +
                      doc.supportItems.map(function (si) {
                         var qtyVal = parseFloat(si.qty) || 0;
                         var nominalVal = parseFloat(si.nominal) || 0;
                         var itemText = '<div style="font-size:13px;line-height:1.6"><i class="fas fa-box" style="color:var(--primary);margin-right:6px;font-size:11px"></i><strong>' +
                            (si.itemName || "-") + '</strong>';
                         if (qtyVal > 0 && nominalVal > 0) {
                            var subtotal = qtyVal * nominalVal;
                            itemText += ' — <span style="color:var(--text-muted)">' + qtyVal + ' x ' + fmtRp(nominalVal) + ' = ' + fmtRp(subtotal) + '</span>';
                         } else if (si.qty) {
                            itemText += ' — <span style="color:var(--text-muted)">' + si.qty + '</span>';
                         }
                         itemText += '</div>';
                         return itemText;
                      }).join("") +
                      "</div>"
                    : "") +
                 (doc.supportDetails
                    ? '<p style="font-size:13px;line-height:1.7;white-space:pre-wrap;color:var(--text-muted)">' + doc.supportDetails + "</p>"
                    : (!(doc.supportItems && doc.supportItems.length > 0) ? '<p style="font-size:13px;color:var(--text-muted)">-</p>' : "")) +
                 "</div>" +
                 '<div style="display:flex;gap:20px;flex-wrap:wrap;padding:10px 14px;background:var(--primary-light);border-radius:var(--radius-sm);font-size:13px">' +
                 '<span><i class="fas fa-location-dot" style="color:var(--primary);margin-right:6px"></i><strong>Lokasi:</strong> ' +
                 (doc.location || "-") +
                 "</span>" +
                 '<span><i class="fas fa-calendar" style="color:var(--primary);margin-right:6px"></i><strong>Tanggal:</strong> ' +
                 dateFormatted +
                 "</span>" +
                 '<span><i class="fas fa-coins" style="color:var(--primary);margin-right:6px"></i><strong>Perkiraan Biaya:</strong> ' +
                 fmtRp(doc.estimatedCost || 0) +
                 "</span>" +
                 "</div>" +
                 "</div>" +
                 "</div>" +
                 "</div>" +
                 "</div>"
              );
           })
           .join("")
      : '<div class="empty-state"><i class="fas fa-handshake-angle"></i><h4>Belum ada data sponsorship</h4><p>Klik "+ Tambah Data" untuk menambahkan</p></div>';

   var sPag = renderPaginationHTML(state.spons.page, sTotal, "goSponsorshipPage");

   // --- Build month/year filter options ---
   var sponsMonthOpts = '<option value="all"' + (state.spons.month === "all" ? " selected" : "") + '>Semua Bulan</option>';
   MONTH_OPTIONS.forEach(function (m) {
      sponsMonthOpts += '<option value="' + m.value + '"' + (state.spons.month === m.value ? " selected" : "") + '>' + m.label + '</option>';
   });
   var sponsYears = new Set();
   (state.sponsorships || []).forEach(function (d) {
      var y = (d.eventDate || "").substring(0, 4);
      if (/^\d{4}$/.test(y)) sponsYears.add(y);
   });
   sponsYears.add(String(new Date().getFullYear()));
   var sponsSortedYears = Array.from(sponsYears).sort(function (a, b) { return b.localeCompare(a); });
   var sponsYearOpts = '<option value="all"' + (state.spons.year === "all" ? " selected" : "") + '>Semua Tahun</option>';
   sponsSortedYears.forEach(function (y) {
      sponsYearOpts += '<option value="' + y + '"' + (state.spons.year === y ? " selected" : "") + '>' + y + '</option>';
   });

   container.innerHTML =
      '<div class="cat-toolbar">' +
      "<div>" +
      '<h3 style="font-size:16px;font-weight:700">Riwayat Support & Sponsorship</h3>' +
      '<p style="font-size:13px;color:var(--text-muted);margin-top:4px">' +
      list.length +
      " event tersimpan</p>" +
      "</div>" +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-outline btn-sm" onclick="exportSponsorship()">' +
      '<i class="fas fa-download"></i>Export' +
      '</button>' +
      '<button class="btn btn-primary btn-sm" onclick="openSponsorshipModal()">' +
      '<i class="fas fa-plus"></i>Tambah Data' +
      '</button>' +
      '</div>' +
      "</div>" +
      // --- Toolbar: search + filters ---
      '<div class="table-toolbar" style="margin-bottom:14px">' +
      '<div class="table-search">' +
      '<i class="fas fa-search"></i>' +
      '<input type="text" placeholder="Cari event, lokasi, item..." id="sponsSearch" value="' + (state.spons.search || "").replace(/"/g, "&quot;") + '" oninput="onSponsSearch(this.value)">' +
      '</div>' +
      '<div class="table-filter">' +
      '<select id="sponsMonthFilter" onchange="onSponsMonthChange(this.value)">' + sponsMonthOpts + '</select>' +
      '</div>' +
      '<div class="table-filter">' +
      '<select id="sponsYearFilter" onchange="onSponsYearChange(this.value)">' + sponsYearOpts + '</select>' +
      '</div>' +
      '</div>' +
      // --- Period total summary ---
      '<div class="stat-grid" style="margin-bottom:14px">' +
      '<div class="stat-card green">' +
      '<div class="sc-top"><div class="sc-icon"><i class="fas fa-handshake-angle"></i></div><span class="sc-label">Total Biaya (Periode)</span></div>' +
      '<div class="sc-value" style="font-size:clamp(16px,4vw,22px);word-break:break-word">' + fmtRp(sponsPeriodTotal) + '</div>' +
      '<div class="sc-sub">perkiraan biaya sponsorship</div>' +
      '</div>' +
      '<div class="stat-card gold">' +
      '<div class="sc-top"><div class="sc-icon"><i class="fas fa-calendar-check"></i></div><span class="sc-label">Jumlah Event</span></div>' +
      '<div class="sc-value" style="font-size:clamp(16px,4vw,22px)">' + list.length + '</div>' +
      '<div class="sc-sub">event tersimpan</div>' +
      '</div>' +
      '</div>' +
      '<div class="cat-accordion" id="sponsorshipList">' +
      accordionItems +
      "</div>" +
      '<div class="table-footer" style="margin-top:16px">' +
      "<span>" +
      (list.length > 0
         ? "Menampilkan " +
           (sStart + 1) +
           "\u2013" +
           Math.min(sStart + sPerPage, list.length) +
           " dari " +
           list.length +
           " event"
         : "") +
      "</span>" +
      '<div class="pagination">' +
      sPag +
      "</div>" +
      "</div>";
}

window.exportSponsorship = function () {
   var list = state.sponsorships || [];

   if (state.spons.search) {
      var q = state.spons.search.toLowerCase();
      list = list.filter(function (d) {
         return (d.eventName || "").toLowerCase().indexOf(q) !== -1 ||
            (d.location || "").toLowerCase().indexOf(q) !== -1 ||
            (d.supportDetails || "").toLowerCase().indexOf(q) !== -1 ||
            ((d.supportItems || []).map(function (si) { return si.itemName || ""; }).join(" ")).toLowerCase().indexOf(q) !== -1;
      });
   }

   if (state.spons.month !== "all" || state.spons.year !== "all") {
      list = list.filter(function (d) {
         return matchesMonthYear(d.eventDate, state.spons.month, state.spons.year);
      });
   }

   if (list.length === 0) {
      toast("Tidak ada data untuk di-export", "warning");
      return;
   }

   // Initialize ExcelJS Workbook
   var workbook = new ExcelJS.Workbook();
   var worksheet = workbook.addWorksheet("Sponsorship");

   worksheet.columns = [
      { header: "Tanggal", key: "tanggal", width: 15 },
      { header: "Nama Event", key: "event", width: 28 },
      { header: "Lokasi", key: "lokasi", width: 20 },
      { header: "Rincian Support", key: "support", width: 28 },
      { header: "Qty", key: "qty", width: 12 },
      { header: "Nominal", key: "nominal", width: 16 },
      { header: "Subtotal", key: "subtotal", width: 18 },
      { header: "Catatan/Deskripsi", key: "deskripsi", width: 32 },
      { header: "Perkiraan Biaya", key: "biaya", width: 18 }
   ];

   // Style Header Row
   var headerRow = worksheet.getRow(1);
   headerRow.height = 26;
   headerRow.eachCell(function (cell) {
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFF2C94C" } // Yellow color #f2c94c
      };
      cell.font = {
         name: "Arial",
         size: 10,
         bold: true
      };
      cell.border = {
         top: { style: "thin" },
         left: { style: "thin" },
         bottom: { style: "thin" },
         right: { style: "thin" }
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
   });

   var totalCost = 0;

   // Helper styling function
   function applySponsRowStyles(row) {
      row.eachCell(function (cell, colNumber) {
         cell.font = { name: "Arial", size: 10 };
         cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
         };

         if (colNumber === 5) { // Qty
            cell.alignment = { vertical: "middle", horizontal: "center" };
         } else if (colNumber === 6 || colNumber === 7 || colNumber === 9) { // Nominal, Subtotal, Cost
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "#,##0";
         } else {
            cell.alignment = { vertical: "middle", horizontal: "left" };
         }
      });
   }

   list.forEach(function (doc) {
      var supportItems = doc.supportItems || [];
      var details = doc.supportDetails || "";
      totalCost += doc.estimatedCost || 0;

      if (supportItems.length === 0) {
         var row = worksheet.addRow({
            tanggal: doc.eventDate || "",
            event: doc.eventName || "",
            lokasi: doc.location || "",
            support: "-",
            qty: "-",
            nominal: "",
            subtotal: "",
            deskripsi: details,
            biaya: doc.estimatedCost || 0
         });
         applySponsRowStyles(row);
      } else {
         supportItems.forEach(function (item, index) {
            var qtyVal = parseFloat(item.qty) || 0;
            var nominalVal = parseFloat(item.nominal) || 0;
            var subtotalVal = qtyVal * nominalVal;

            var rowData = {
               tanggal: index === 0 ? doc.eventDate || "" : "",
               event: index === 0 ? doc.eventName || "" : "",
               lokasi: index === 0 ? doc.location || "" : "",
               support: item.itemName || "-",
               qty: item.qty || "",
               nominal: nominalVal || "",
               subtotal: subtotalVal || "",
               deskripsi: index === 0 ? details : "",
               biaya: index === 0 ? doc.estimatedCost || 0 : ""
            };
            var row = worksheet.addRow(rowData);
            applySponsRowStyles(row);
         });
         // Add separator row
         var separatorRow = worksheet.addRow({});
         separatorRow.height = 12;
         separatorRow.eachCell(function (cell) {
            cell.border = {
               top: { style: "thin" },
               left: { style: "thin" },
               bottom: { style: "thin" },
               right: { style: "thin" }
            };
         });
      }
   });

   // Add Grand Total Row
   var totalRow = worksheet.addRow({
      tanggal: "TOTAL BIAYA",
      event: "",
      lokasi: "",
      support: "",
      qty: "",
      nominal: "",
      subtotal: "",
      deskripsi: "",
      biaya: totalCost
   });
   totalRow.height = 24;
   totalRow.eachCell(function (cell, colNumber) {
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFFFE57F" } // Light amber accent
      };
      cell.border = {
         top: { style: "double" },
         bottom: { style: "double" },
         left: { style: "thin" },
         right: { style: "thin" }
      };

      if (colNumber === 9) {
         cell.alignment = { vertical: "middle", horizontal: "right" };
         cell.numFmt = "#,##0";
      } else {
         cell.alignment = { vertical: "middle", horizontal: "left" };
      }
   });

   workbook.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var a = document.createElement("a");
      var dateStr = new Date().toISOString().split("T")[0];
      a.href = URL.createObjectURL(blob);
      a.download = "sponsorship_" + dateStr + ".xlsx";
      a.click();
      toast("Sponsorship di-export ke Excel", "success");
   });
};

window.onSponsSearch = function (val) {
   state.spons.search = val;
   state.spons.page = 1;
   renderSponsorship();
   var el = document.getElementById("sponsSearch");
   if (el) { el.focus(); var len = el.value.length; el.setSelectionRange(len, len); }
};
window.onSponsMonthChange = function (val) {
   state.spons.month = val;
   state.spons.page = 1;
   renderSponsorship();
};
window.onSponsYearChange = function (val) {
   state.spons.year = val;
   state.spons.page = 1;
   renderSponsorship();
};

window.goSponsorshipPage = function (n) {
   state.spons.page = n;
   renderSponsorship();
};

// ---- Toggle accordion ----
window.toggleSponsorshipAccordion = function (id) {
   var body = document.getElementById("spons-body-" + id);
   var item = document.getElementById("spons-" + id);
   if (!body) return;
   var isOpen = body.style.display !== "none";
   body.style.display = isOpen ? "none" : "block";
   if (item) item.classList.toggle("open", !isOpen);
};

// ---- Buka modal tambah / edit ----
window.openSponsorshipModal = async function (docId) {
   var isEdit = !!docId;
   var existing = null;

   if (isEdit) {
      existing =
         (state.sponsorships || []).find(function (x) {
            return x.id === docId;
         }) || null;
      if (!existing) {
         try {
            var snap = await db.collection("sponsorships").doc(docId).get();
            if (snap.exists)
               existing = Object.assign({ id: snap.id }, snap.data());
         } catch (e) {
            toast("Gagal memuat data: " + e.message, "error");
            return;
         }
      }
      if (!existing) {
         toast("Data tidak ditemukan", "error");
         return;
      }
   }

   var v = existing || {
      eventName: "",
      eventDate: today,
      location: "",
      supportDetails: "",
      estimatedCost: 0,
   };

   var body =
      '<div class="form-group">' +
      '<label>Nama Event <span style="color:var(--danger)">*</span></label>' +
      '<input type="text" class="form-input" id="fSponsEventName" value="' +
      (v.eventName || "").replace(/"/g, "&quot;") +
      '" placeholder="Contoh: Anniversary Club Motor X" required>' +
      "</div>" +
      '<div class="form-row">' +
      '<div class="form-group">' +
      "<label>Tanggal Event</label>" +
      '<input type="date" class="form-input" id="fSponsEventDate" value="' +
      (v.eventDate || today) +
      '">' +
      "</div>" +
      '<div class="form-group">' +
      "<label>Lokasi</label>" +
      '<input type="text" class="form-input" id="fSponsLocation" value="' +
      (v.location || "").replace(/"/g, "&quot;") +
      '" placeholder="Contoh: Bandung">' +
      "</div>" +
      "</div>" +
      '<div class="form-group">' +
      '<label>Rincian Support (Opsional)</label>' +
      '<div id="sponsSupportItems" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">' +
      '<button type="button" class="btn btn-outline btn-sm" onclick="addSponsorshipProductRow()">' +
      '<i class="fas fa-tag"></i>+ Produk' +
      "</button>" +
      '<button type="button" class="btn btn-outline btn-sm" onclick="addSponsorshipItemRow()">' +
      '<i class="fas fa-pencil"></i>+ Item Manual' +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div class="form-group">' +
      '<label>Deskripsi / Catatan (Opsional)</label>' +
      '<textarea class="form-input" id="fSponsSupportDetails" rows="2" placeholder="Catatan tambahan...">' +
      (v.supportDetails || "") +
      "</textarea>" +
      "</div>" +
      '<div class="form-group">' +
      "<label>Perkiraan Biaya (Rp)</label>" +
      '<input type="text" inputmode="numeric" class="form-input" id="fSponsEstimatedCost" value="' +
      (v.estimatedCost ? fmt(v.estimatedCost) : "") +
      '" placeholder="Contoh: 300.000" oninput="formatRpInput(this)">' +
      "</div>";

   var footer =
      '<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>' +
      '<button class="btn btn-primary btn-sm" onclick="saveSponsorship(' +
      (isEdit ? "'" + docId + "'" : "") +
      ')">' +
      '<i class="fas fa-check"></i>' +
      (isEdit ? "Update" : "Simpan") +
      "</button>";

   openModal(
      isEdit ? "Edit Support Sponsorship" : "Tambah Support Sponsorship",
      body,
      footer,
   );

   // Populate support items if editing
   if (isEdit && existing && existing.supportItems && existing.supportItems.length > 0) {
      existing.supportItems.forEach(function (si) {
         if (si.type === "product") {
            addSponsorshipProductRow(si);
         } else {
            addSponsorshipItemRow(si);
         }
      });
   }
};

// ---- Tambah baris item produk (dari dropdown produk) ----
// ---- Hitung Otomatis Perkiraan Biaya Sponsorship ----
window.calcSponsEstimatedCost = function () {
   var total = 0;
   var rows = document.querySelectorAll("#sponsSupportItems .spons-item-row");
   rows.forEach(function (row) {
      var qtyEl = row.querySelector(".spons-item-qty");
      var nominalEl = row.querySelector(".spons-item-nominal");
      var qty = qtyEl ? parseFloat(qtyEl.value) || 0 : 0;
      var nominal = nominalEl ? parseFloat(nominalEl.value) || 0 : 0;
      total += qty * nominal;
   });
   var costEl = document.getElementById("fSponsEstimatedCost");
   if (costEl) {
      costEl.value = total > 0 ? fmt(total) : "";
   }
};

// ---- Tambah baris item produk (dari dropdown produk) ----
window.addSponsorshipProductRow = function (itemData) {
   var container = document.getElementById("sponsSupportItems");
   if (!container) return;

   var productOpts = '<option value="">-- Pilih Produk --</option>';
   (state.products || []).forEach(function (p) {
      var safeName = (p.name || "").replace(/"/g, "&quot;");
      var selected = itemData && itemData.productId === p.id ? " selected" : "";
      productOpts +=
         '<option value="' + p.id + '" data-name="' + safeName + '"' + selected + ">" +
         (p.name || "-") + " (" + (p.sku || "") + ")</option>";
   });

   var qty = itemData ? parseFloat(itemData.qty) || 1 : 1;
   var nominal = itemData ? parseFloat(itemData.nominal) || 0 : 0;

   var row = document.createElement("div");
   row.className = "spons-item-row spons-product-row";
   row.style.cssText = "display:grid;grid-template-columns:2fr 70px 100px 28px;gap:6px;align-items:center";
   row.innerHTML =
      '<select class="form-input spons-product-select" style="font-size:12px;padding:6px 8px" onchange="calcSponsEstimatedCost()">' +
      productOpts +
      "</select>" +
      '<input type="number" class="form-input spons-item-qty" value="' + qty + '" min="1" placeholder="Qty" style="font-size:12px;padding:6px 8px;text-align:center" oninput="calcSponsEstimatedCost()">' +
      '<input type="number" class="form-input spons-item-nominal" value="' + nominal + '" min="0" placeholder="Nominal" style="font-size:12px;padding:6px 8px" oninput="calcSponsEstimatedCost()">' +
      '<button type="button" title="Hapus"' +
      " onclick=\"this.closest('.spons-item-row').remove(); calcSponsEstimatedCost();\"" +
      ' style="width:28px;height:28px;border:none;background:var(--danger);color:#fff;' +
      "border-radius:var(--radius-sm);cursor:pointer;font-size:13px;" +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
      '<i class="fas fa-xmark"></i>' +
      "</button>";
   container.appendChild(row);
   calcSponsEstimatedCost();
};

// ---- Tambah baris item manual (text input) ----
window.addSponsorshipItemRow = function (itemData) {
   var container = document.getElementById("sponsSupportItems");
   if (!container) return;

   var itemName = itemData ? itemData.itemName || "" : "";
   var qty = itemData ? parseFloat(itemData.qty) || 1 : 1;
   var nominal = itemData ? parseFloat(itemData.nominal) || 0 : 0;

   var row = document.createElement("div");
   row.className = "spons-item-row spons-manual-row";
   row.style.cssText = "display:grid;grid-template-columns:2fr 70px 100px 28px;gap:6px;align-items:center";
   row.innerHTML =
      '<input type="text" class="form-input spons-item-name" value="' + (itemName.replace(/"/g, "&quot;")) + '" placeholder="Nama item (manual)" style="font-size:12px;padding:6px 8px">' +
      '<input type="number" class="form-input spons-item-qty" value="' + qty + '" min="1" placeholder="Qty" style="font-size:12px;padding:6px 8px;text-align:center" oninput="calcSponsEstimatedCost()">' +
      '<input type="number" class="form-input spons-item-nominal" value="' + nominal + '" min="0" placeholder="Nominal" style="font-size:12px;padding:6px 8px" oninput="calcSponsEstimatedCost()">' +
      '<button type="button" title="Hapus"' +
      " onclick=\"this.closest('.spons-item-row').remove(); calcSponsEstimatedCost();\"" +
      ' style="width:28px;height:28px;border:none;background:var(--danger);color:#fff;' +
      "border-radius:var(--radius-sm);cursor:pointer;font-size:13px;" +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
      '<i class="fas fa-xmark"></i>' +
      "</button>";
   container.appendChild(row);
   calcSponsEstimatedCost();
};

// ---- Simpan (Tambah / Update) ----
window.saveSponsorship = async function (docId) {
   var eventNameEl = document.getElementById("fSponsEventName");
   var eventName = eventNameEl ? eventNameEl.value.trim() : "";
   if (!eventName) {
      toast("Nama event wajib diisi", "warning");
      return;
   }

   var supportEl = document.getElementById("fSponsSupportDetails");
   var supportDetails = supportEl ? supportEl.value.trim() : "";

   // Collect support items — both product rows and manual rows
   var supportItemRows = document.querySelectorAll("#sponsSupportItems .spons-item-row");
   var supportItems = [];
   supportItemRows.forEach(function (row) {
      var isProduct = row.classList.contains("spons-product-row");
      var qtyInput = row.querySelector(".spons-item-qty");
      var qty = qtyInput ? qtyInput.value.trim() : "";
      var nominalInput = row.querySelector(".spons-item-nominal");
      var nominal = nominalInput ? parseFloat(nominalInput.value) || 0 : 0;

      if (isProduct) {
         var selectEl = row.querySelector(".spons-product-select");
         var productId = selectEl ? selectEl.value : "";
         var selectedOpt = selectEl ? selectEl.options[selectEl.selectedIndex] : null;
         var productName = selectedOpt ? selectedOpt.dataset.name || selectedOpt.text : "";
         if (productId || productName) {
            supportItems.push(sanitize({ type: "product", productId: productId, itemName: productName, qty: qty, nominal: nominal }));
         }
      } else {
         var nameInput = row.querySelector(".spons-item-name");
         var itemName = nameInput ? nameInput.value.trim() : "";
         if (itemName) {
            supportItems.push(sanitize({ type: "manual", itemName: itemName, qty: qty, nominal: nominal }));
         }
      }
   });

   var eventDateEl = document.getElementById("fSponsEventDate");
   var locationEl = document.getElementById("fSponsLocation");
   var costEl = document.getElementById("fSponsEstimatedCost");

   var docData = sanitize({
      eventName: eventName,
      eventDate: eventDateEl ? eventDateEl.value : today,
      location: locationEl ? locationEl.value.trim() : "",
      supportDetails: supportDetails,
      supportItems: supportItems,
      estimatedCost: parsePrice(costEl ? costEl.value : "0"),
      updatedAt: new Date().toISOString(),
   });

   try {
      if (docId) {
         await db.collection("sponsorships").doc(docId).update(docData);
         toast("Data sponsorship diperbarui", "success");
      } else {
         docData.createdAt = new Date().toISOString();
         await db.collection("sponsorships").add(docData);
         toast("Data sponsorship disimpan", "success");
      }
      closeModal();
   } catch (err) {
      toast("Gagal menyimpan: " + err.message, "error");
   }
};

// ---- Hapus — konfirmasi ----
window.deleteSponsorship = function (docId) {
   var doc = (state.sponsorships || []).find(function (x) {
      return x.id === docId;
   });
   if (!doc) {
      toast("Data tidak ditemukan", "error");
      return;
   }

   openModal(
      "Konfirmasi Hapus",
      '<div style="text-align:center;padding:10px 0">' +
         '<i class="fas fa-trash" style="font-size:40px;color:var(--danger);opacity:.6;margin-bottom:14px;display:block"></i>' +
         '<p style="font-size:15px;font-weight:600">Hapus sponsorship "' +
         (doc.eventName || "-") +
         '"?</p>' +
         '<p style="font-size:13px;color:var(--text-muted);margin-top:6px">Tanggal: ' +
         (doc.eventDate || "-") +
         " — " +
         fmtRp(doc.estimatedCost || 0) +
         "</p>" +
         "</div>",
      '<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>' +
         '<button class="btn btn-danger btn-sm" onclick="doDeleteSponsorship(\'' +
         docId +
         '\')"><i class="fas fa-trash"></i>Hapus</button>',
   );
};

window.doDeleteSponsorship = async function (docId) {
   try {
      await db.collection("sponsorships").doc(docId).delete();
      toast("Data sponsorship dihapus", "success");
      closeModal();
   } catch (err) {
      toast("Gagal menghapus: " + err.message, "error");
   }
};

/* =========================================================
   LAPORAN
   ========================================================= */
function renderReports() {
   const type = $("#reportType").value;
   const period = $("#reportPeriod") ? $("#reportPeriod").value : (state.report.period || "monthly");
   state.report.period = period;
   const dateInput = $("#reportDateFilter");
   if (dateInput && dateInput.value) {
      state.report.date = dateInput.value;
   }
   const { month, year, date } = state.report;

   syncReportPeriodVisibility();

   const rSales = state.sales.filter((s) =>
      filterByReportPeriod(s.date, period, month, year, date),
   );
   const rPurchases = state.productionPurchases.filter((p) =>
      filterByReportPeriod(p.date, period, month, year, date),
   );
   const rPayrolls = state.payrolls.filter((p) => {
      const periodDate = p.period ? `${p.period}-01` : p.paymentDate || "";
      return filterByReportPeriod(periodDate, period, month, year, date);
   });
   const rSalaryProduksi = (state.salaryProduksi || []).filter((s) =>
      filterByReportPeriod(s.periodDate, period, month, year, date),
   );

   const totalRev = rSales.reduce((s, x) => s + getSaleRevenue(x), 0);
   const totalCost = rSales.reduce(
      (s, x) => s + (x.costPrice || 0) * (x.quantity || 0),
      0,
   );
   const totalProfit = rSales.reduce((s, x) => s + getSaleProfit(x), 0);
   const totalProdExp = rPurchases.reduce(
      (s, p) => s + (Number(p.totalCost) || 0),
      0,
   );
   const totalPayrollExp =
      rPayrolls.reduce((s, p) => s + (Number(p.totalPaid) || 0), 0) +
      rSalaryProduksi.reduce((s, sDoc) => s + (Number(sDoc.grandTotal) || 0), 0);
   const totalNetProfit = totalProfit - totalProdExp - totalPayrollExp;
   const marginPct =
      totalRev > 0 ? Math.round((totalProfit / totalRev) * 100) : 0;

   const getTopChannel = () => {
      const ch = {};
      rSales.forEach((s) => {
         const channel = normalizeChannelValue(s.channel || "-");
         ch[channel] = (ch[channel] || 0) + 1;
      });
      const e = Object.entries(ch).sort((a, b) => b[1] - a[1]);
      return e.length ? e[0][0] : "-";
   };
   const getBestSeller = () => {
      const ps = {};
      rSales.forEach((s) => {
         ps[s.productId] = (ps[s.productId] || 0) + getSaleRevenue(s);
      });
      const e = Object.entries(ps).sort((a, b) => b[1] - a[1]);
      return e.length
         ? (state.products.find((p) => p.id === e[0][0]) || {}).name || "-"
         : "-";
   };
   const getTopCategory = () => {
      const cs = {};
      rSales.forEach((s) => {
         const p = state.products.find((x) => x.id === s.productId);
         if (p) {
            const cn = getCatName(p.categoryId);
            cs[cn] = (cs[cn] || 0) + getSaleRevenue(s);
         }
      });
      const e = Object.entries(cs).sort((a, b) => b[1] - a[1]);
      return e.length ? e[0][0] : "-";
   };

   const statsMap = {
      sales: [
         { label: "Total Transaksi", value: rSales.length, cls: "gold" },
         { label: "Total Pendapatan", value: fmtRp(totalRev), cls: "green" },
         {
            label: "Rata-rata/Transaksi",
            value: fmtRp(
               rSales.length > 0 ? Math.round(totalRev / rSales.length) : 0,
            ),
            cls: "maroon",
         },
         { label: "Channel Terbanyak", value: getTopChannel(), cls: "gold" },
      ],
      profit: [
         { label: "Total Pendapatan", value: fmtRp(totalRev), cls: "gold" },
         { label: "Total Biaya HPP", value: fmtRp(totalCost), cls: "maroon" },
         { label: "Laba Penjualan", value: fmtRp(totalProfit), cls: "green" },
         {
            label: "Belanja Produksi",
            value: fmtRp(totalProdExp),
            cls: "maroon",
         },
         {
            label: "Gaji Karyawan",
            value: fmtRp(totalPayrollExp),
            cls: "maroon",
         },
         {
            label: "Laba Bersih",
            value: fmtRp(totalNetProfit),
            cls: totalNetProfit >= 0 ? "green" : "red",
         },
         {
            label: "Margin Laba",
            value: marginPct + "%",
            cls: marginPct >= 30 ? "green" : marginPct >= 15 ? "gold" : "red",
         },
      ],
      production: [
         { label: "Total Order", value: state.production.length, cls: "gold" },
         {
            label: "Total Target",
            value: state.production.reduce((s, p) => s + (p.targetQty || 0), 0),
            cls: "maroon",
         },
         {
            label: "Total Selesai",
            value: state.production.reduce(
               (s, p) => s + (p.completedQty || 0),
               0,
            ),
            cls: "green",
         },
         {
            label: "Completion",
            value:
               (state.production.reduce((s, p) => s + (p.targetQty || 0), 0) > 0
                  ? Math.round(
                       (state.production.reduce(
                          (s, p) => s + (p.completedQty || 0),
                          0,
                       ) /
                          state.production.reduce(
                             (s, p) => s + (p.targetQty || 0),
                             0,
                          )) *
                          100,
                    )
                  : 0) + "%",
            cls: "gold",
         },
      ],
      inventory: [
         { label: "Total Produk", value: state.products.length, cls: "gold" },
         {
            label: "Total Stok",
            value: state.products.reduce((s, p) => s + (p.stock || 0), 0),
            cls: "green",
         },
         {
            label: "Stok Rendah",
            value: state.products.filter((p) => p.status === "low_stock")
               .length,
            cls: "maroon",
         },
         {
            label: "Stok Habis",
            value: state.products.filter((p) => p.status === "out_of_stock")
               .length,
            cls: "red",
         },
      ],
      bestseller: [
         {
            label: "Total Terjual",
            value: rSales.reduce((s, x) => s + (x.quantity || 0), 0) + " unit",
            cls: "gold",
         },
         { label: "Produk Terlaris", value: getBestSeller(), cls: "green" },
         { label: "Kategori Terlaris", value: getTopCategory(), cls: "maroon" },
         { label: "Total Pendapatan", value: fmtRp(totalRev), cls: "gold" },
      ],
   };

   $("#reportStats").innerHTML = (statsMap[type] || statsMap.sales)
      .map(
         (s) =>
            `<div class="stat-card ${s.cls}"><div class="sc-label">${s.label}</div><div class="sc-value" style="font-size:17px;margin-top:8px;word-break:break-word">${s.value}</div></div>`,
      )
      .join("");

   // Refresh filter dropdowns so year list stays current
   populateReportPeriodFilters();

   renderReportChart(type, rSales);
   renderReportDetail(type, rSales);
}

function renderReportChart(type, rSales) {
   // rSales: period-filtered sales list passed from renderReports()
   const filteredSales = rSales || state.sales;
   if (state.charts.report) state.charts.report.destroy();
   const ctx = $("#chartReport").getContext("2d");
   let config;

   if (type === "sales" || type === "bestseller") {
      const ps = {};
      filteredSales.forEach((s) => {
         ps[s.productName] = (ps[s.productName] || 0) + getSaleRevenue(s);
      });
      const sorted = Object.entries(ps)
         .sort((a, b) => b[1] - a[1])
         .slice(0, 8);
      config = {
         type: "bar",
         data: {
            labels: sorted.map((x) =>
               x[0].length > 18 ? x[0].substring(0, 18) + "..." : x[0],
            ),
            datasets: [
               {
                  label: "Pendapatan",
                  data: sorted.map((x) => x[1]),
                  backgroundColor: "rgba(244,196,48,.75)",
                  borderRadius: 5,
                  barPercentage: 0.6,
               },
            ],
         },
         options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
               legend: { display: false },
               tooltip: { callbacks: { label: (c) => fmtRp(c.raw) } },
            },
            scales: {
               x: {
                  grid: chartGrid,
                  ticks: {
                     font: chartFont,
                     callback: (v) => (v / 1000000).toFixed(1) + "jt",
                  },
               },
               y: { grid: { display: false }, ticks: { font: { size: 10 } } },
            },
         },
      };
   } else if (type === "profit") {
      const groupedRev = groupByPeriod(filteredSales, "monthly", "revenue");
      const groupedCost = groupByPeriod(
         filteredSales,
         "monthly",
         "costPrice",
         true,
      );
      const dataRev = formatChartPeriodData(groupedRev, "monthly", 6);
      const dataCost = formatChartPeriodData(groupedCost, "monthly", 6);
      const profitValues = dataRev.values.map(
         (rev, i) => rev - (dataCost.values[i] || 0),
      );
      config = {
         type: "bar",
         data: {
            labels: dataRev.labels,
            datasets: [
               {
                  label: "Pendapatan",
                  data: dataRev.values,
                  backgroundColor: "rgba(244,196,48,.75)",
                  borderRadius: 5,
                  barPercentage: 0.55,
               },
               {
                  label: "Biaya",
                  data: dataCost.values,
                  backgroundColor: "rgba(122,31,31,.55)",
                  borderRadius: 5,
                  barPercentage: 0.55,
               },
               {
                  label: "Laba",
                  data: profitValues,
                  backgroundColor: "rgba(22,163,74,.55)",
                  borderRadius: 5,
                  barPercentage: 0.55,
               },
            ],
         },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
               legend: {
                  position: "top",
                  labels: {
                     font: { size: 11 },
                     usePointStyle: true,
                     pointStyle: "circle",
                  },
               },
            },
            scales: {
               x: { grid: { display: false }, ticks: { font: chartFont } },
               y: {
                  grid: chartGrid,
                  ticks: {
                     font: chartFont,
                     callback: (v) => (v / 1000000).toFixed(0) + "jt",
                  },
               },
            },
         },
      };
   } else if (type === "production") {
      const ps = {};
      state.production.forEach((p) => {
         ps[p.productName] = (ps[p.productName] || 0) + (p.completedQty || 0);
      });
      const sorted = Object.entries(ps)
         .sort((a, b) => b[1] - a[1])
         .slice(0, 8);
      config = {
         type: "bar",
         data: {
            labels: sorted.map((x) =>
               x[0].length > 18 ? x[0].substring(0, 18) + "..." : x[0],
            ),
            datasets: [
               {
                  label: "Unit Selesai",
                  data: sorted.map((x) => x[1]),
                  backgroundColor: "rgba(22,163,74,.65)",
                  borderRadius: 5,
                  barPercentage: 0.6,
               },
            ],
         },
         options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
               x: { grid: chartGrid },
               y: { grid: { display: false }, ticks: { font: { size: 10 } } },
            },
         },
      };
   } else {
      const data = state.categories.map((c) => ({
         name: c.name,
         count: state.products
            .filter((p) => p.categoryId === c.id)
            .reduce((s, p) => s + (p.stock || 0), 0),
      }));
      const colors = [
         "#F4C430",
         "#D4A017",
         "#7A1F1F",
         "#16A34A",
         "#0EA5E9",
         "#D97706",
         "#DC2626",
         "#6B7280",
      ];
      config = {
         type: "doughnut",
         data: {
            labels: data.map((d) => d.name),
            datasets: [
               {
                  data: data.map((d) => d.count),
                  backgroundColor: colors,
                  borderWidth: 0,
                  hoverOffset: 6,
               },
            ],
         },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "55%",
            plugins: {
               legend: {
                  position: "bottom",
                  labels: {
                     font: { size: 11 },
                     usePointStyle: true,
                     pointStyle: "circle",
                     padding: 12,
                  },
               },
            },
         },
      };
   }
   state.charts.report = new Chart(ctx, config);
}

function renderReportDetail(type, rSales) {
   // rSales: period-filtered sales list passed from renderReports()
   const filteredSales = rSales || state.sales;
   if (type === "sales" || type === "bestseller") {
      const ps = {};
      filteredSales.forEach((s) => {
         if (!ps[s.productId])
            ps[s.productId] = {
               name: s.productName,
               productId: s.productId,
               qty: 0,
               rev: 0,
            };
         ps[s.productId].qty += s.quantity || 0;
         ps[s.productId].rev += getSaleRevenue(s);
      });
      const sorted = Object.values(ps)
         .sort((a, b) => b.rev - a.rev)
         .slice(0, 10);
      const totalRev = sorted.reduce((s, x) => s + x.rev, 0);
      $("#reportDetail").innerHTML =
         sorted
            .map((p, i) => {
               const prod = state.products.find((x) => x.id === p.productId);
               return `<div class="rank-item">${prodImg(prod, 32)}<div class="rank-num ${i === 0 ? "g" : i === 1 ? "s" : i === 2 ? "b" : "n"}">${i + 1}</div><div class="rank-info"><div class="name">${p.name}</div><div class="sub">${p.qty} unit</div><div class="progress-bar" style="width:110px"><div class="fill fill-gold" style="width:${pct(p.rev, totalRev)}%"></div></div></div><div class="rank-val">${fmtRp(p.rev)}<small>${pct(p.rev, totalRev)}%</small></div></div>`;
            })
            .join("") ||
         '<div class="empty-state"><i class="fas fa-chart-bar"></i><h4>Belum ada data</h4></div>';
   } else if (type === "profit") {
      const ps = {};
      filteredSales.forEach((s) => {
         if (!ps[s.productId])
            ps[s.productId] = {
               name: s.productName,
               productId: s.productId,
               rev: 0,
               cost: 0,
               profit: 0,
            };
         ps[s.productId].rev += getSaleRevenue(s);
         ps[s.productId].cost += (s.costPrice || 0) * (s.quantity || 0);
         ps[s.productId].profit += getSaleProfit(s);
      });
      const sorted = Object.values(ps)
         .sort((a, b) => b.profit - a.profit)
         .slice(0, 10);
      $("#reportDetail").innerHTML =
         sorted
            .map((p) => {
               const prod = state.products.find((x) => x.id === p.productId);
               return `<div class="rank-item">${prodImg(prod, 32)}<div class="rank-num n"><i class="fas fa-chart-pie" style="font-size:11px"></i></div><div class="rank-info"><div class="name">${p.name}</div><div class="sub">Rev: ${fmtRp(p.rev)} | Cost: ${fmtRp(p.cost)}</div></div><div class="rank-val" style="color:var(--success)">${fmtRp(p.profit)}<small>Laba</small></div></div>`;
            })
            .join("") ||
         '<div class="empty-state"><i class="fas fa-chart-pie"></i><h4>Belum ada data</h4></div>';
   } else if (type === "production") {
      const sorted = [...state.production].sort(
         (a, b) =>
            (b.completedQty || 0) / (b.targetQty || 1) -
            (a.completedQty || 0) / (a.targetQty || 1),
      );
      $("#reportDetail").innerHTML =
         sorted
            .map((p) => {
               const pctDone =
                  p.targetQty > 0
                     ? Math.round(((p.completedQty || 0) / p.targetQty) * 100)
                     : 0;
               const prod = state.products.find((x) => x.id === p.productId);
               return `<div class="rank-item">${prodImg(prod, 32)}<div class="rank-num n"><i class="fas fa-industry" style="font-size:11px"></i></div><div class="rank-info"><div class="name">${p.productName}</div><div class="sub">${p.sku} — ${prodStatusBadge(p.status)}</div><div class="progress-bar" style="width:110px"><div class="fill ${pctDone >= 100 ? "fill-green" : "fill-gold"}" style="width:${pctDone}%"></div></div></div><div class="rank-val">${p.completedQty || 0}/${p.targetQty}<small>${pctDone}%</small></div></div>`;
            })
            .join("") ||
         '<div class="empty-state"><i class="fas fa-industry"></i><h4>Belum ada data</h4></div>';
   } else {
      const sorted = [...state.products].sort(
         (a, b) => (b.stock || 0) - (a.stock || 0),
      );
      $("#reportDetail").innerHTML =
         sorted
            .map(
               (p) =>
                  `<div class="rank-item">${prodImg(p, 32)}<div class="rank-num ${p.stock > 20 ? "g" : p.stock > 5 ? "s" : p.stock > 0 ? "b" : "n"}">${p.stock}</div><div class="rank-info"><div class="name">${p.name}</div><div class="sub">${p.sku} — ${getCatName(p.categoryId)}</div></div><div class="rank-val">${statusBadge(p.status)}</div></div>`,
            )
            .join("") ||
         '<div class="empty-state"><i class="fas fa-boxes-stacked"></i><h4>Belum ada data</h4></div>';
   }
}

$("#reportType").addEventListener("change", renderReports);
$("#reportPeriod").addEventListener("change", renderReports);
if ($("#reportDateFilter")) {
   $("#reportDateFilter").addEventListener("change", (e) => {
      state.report.date = e.target.value;
      renderReports();
   });
}
$("#reportMonthFilter").addEventListener("change", (e) => {
   state.report.month = e.target.value;
   renderReports();
});
$("#reportYearFilter").addEventListener("change", (e) => {
   state.report.year = e.target.value;
   renderReports();
});

const REPORT_TITLES = {
   sales: "LAPORAN PENJUALAN",
   profit: "LAPORAN KEUNTUNGAN",
   production: "LAPORAN PRODUKSI",
   inventory: "LAPORAN INVENTARIS",
   bestseller: "LAPORAN PRODUK TERLARIS",
};

const REPORT_STATUS_LABELS = {
   active: "Aktif",
   in_production: "Dalam Produksi",
   pre_order: "Pre Order",
   low_stock: "Stok Rendah",
   out_of_stock: "Habis",
   inactive: "Nonaktif",
   pending: "Pending",
   in_progress: "Dalam Proses",
   qc: "Quality Control",
   completed: "Selesai",
};

function getReportPeriodText(period, month, year, date) {
   const fmtDate = (d) =>
      new Date(d).toLocaleDateString("id-ID", {
         day: "numeric",
         month: "long",
         year: "numeric",
      });
   if (period === "daily") return fmtDate(date || today);
   if (period === "weekly") {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return `${fmtDate(start)} - ${fmtDate(today)}`;
   }
   if (period === "yearly") return year === "all" ? "Semua Tahun" : `Tahun ${year}`;
   const monthLabel =
      month === "all"
         ? "Semua Bulan"
         : (MONTH_OPTIONS.find((m) => m.value === month) || {}).label || month;
   return year === "all" ? `${monthLabel} (Semua Tahun)` : `${monthLabel} ${year}`;
}

// Kolom: { header, fmt: "text" | "int" | "rp" | "pct", align }. Baris total opsional.
function buildReportWorksheet(worksheet, { title, info, summary, columns, rows, totals }) {
   const thin = { style: "thin" };
   const fullBorder = { top: thin, left: thin, bottom: thin, right: thin };
   const numFmtOf = (fmt) =>
      fmt === "rp" ? "\"Rp\" #,##0" : fmt === "int" ? "#,##0" : fmt === "pct" ? "0%" : undefined;
   const alignOf = (col) =>
      col.align || (col.fmt === "rp" ? "right" : col.fmt === "text" ? "left" : "center");

   worksheet.getCell("A1").value = title;
   worksheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF2B2B2B" } };

   let r = 3;
   info.forEach(([label, value]) => {
      worksheet.getCell(`A${r}`).value = label;
      worksheet.getCell(`A${r}`).font = { name: "Arial", size: 10, bold: true };
      worksheet.getCell(`B${r}`).value = ": " + value;
      r++;
   });

   if (summary && summary.length) {
      r++;
      worksheet.getCell(`A${r}`).value = "RINGKASAN";
      worksheet.getCell(`A${r}`).font = { name: "Arial", size: 11, bold: true };
      r++;
      const headRow = worksheet.getRow(r);
      const valRow = worksheet.getRow(r + 1);
      headRow.values = summary.map((s) => s.label);
      valRow.values = summary.map((s) => s.value);
      headRow.height = 20;
      valRow.height = 22;
      headRow.eachCell((cell) => {
         cell.font = { name: "Arial", size: 10, bold: true };
         cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
         cell.border = fullBorder;
         cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });
      valRow.eachCell((cell, colNum) => {
         const fmt = summary[colNum - 1].fmt;
         cell.font = { name: "Arial", size: 10, bold: true };
         cell.border = fullBorder;
         cell.alignment = { horizontal: fmt === "rp" ? "right" : "center", vertical: "middle" };
         if (numFmtOf(fmt)) cell.numFmt = numFmtOf(fmt);
      });
      r += 2;
   }

   r++;
   const headerRowNum = r;
   const header = worksheet.getRow(headerRowNum);
   header.values = columns.map((c) => c.header);
   header.height = 26;
   header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2C94C" } };
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.border = fullBorder;
      cell.alignment = { vertical: "middle", horizontal: "center" };
   });

   rows.forEach((values) => {
      const row = worksheet.addRow(values);
      row.height = 20;
      columns.forEach((col, i) => {
         const cell = row.getCell(i + 1);
         cell.font = { name: "Arial", size: 10 };
         cell.border = fullBorder;
         cell.alignment = { vertical: "middle", horizontal: alignOf(col) };
         if (numFmtOf(col.fmt)) cell.numFmt = numFmtOf(col.fmt);
      });
   });

   if (totals) {
      const totalRow = worksheet.addRow(totals);
      totalRow.height = 24;
      columns.forEach((col, i) => {
         const cell = totalRow.getCell(i + 1);
         cell.font = { name: "Arial", size: 10, bold: true };
         cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE57F" } };
         cell.border = { top: { style: "double" }, bottom: { style: "double" }, left: thin, right: thin };
         cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : alignOf(col) };
         if (i > 0 && numFmtOf(col.fmt)) cell.numFmt = numFmtOf(col.fmt);
      });
   }

   worksheet.views = [{ state: "frozen", ySplit: headerRowNum }];
   // Lebar kolom dihitung dari tabel saja, supaya judul panjang di A1 tidak melebarkan kolom A.
   columns.forEach((col, i) => {
      const column = worksheet.getColumn(i + 1);
      let maxLen = String(col.header).length;
      column.eachCell({ includeEmpty: false }, (cell) => {
         if (cell.row < headerRowNum) return;
         let len = cell.value == null ? 0 : String(cell.value).length;
         if (col.fmt === "rp") len += 6;
         if (len > maxLen) maxLen = len;
      });
      column.width = Math.min(Math.max(maxLen + 4, 12), 60);
   });
}

$("#exportCsvBtn").addEventListener("click", () => {
   if (typeof ExcelJS === "undefined") {
      toast("Library Excel belum termuat, coba lagi sebentar", "error");
      return;
   }
   const type = $("#reportType").value;
   const period = $("#reportPeriod") ? $("#reportPeriod").value : (state.report.period || "monthly");
   state.report.period = period;
   const { month, year, date } = state.report;
   const rSales = state.sales
      .filter((s) => filterByReportPeriod(s.date, period, month, year, date))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
   const periodLabel =
      period === "daily"
         ? `harian_${date || today}`
         : period === "weekly"
         ? "mingguan"
         : period === "yearly"
         ? (year === "all" ? "tahunan-semua" : `tahunan-${year}`)
         : year === "all"
         ? "semua"
         : month !== "all"
         ? `${year}-${month}`
         : year;
   const periodText = getReportPeriodText(period, month, year, date);
   const exportDateStr = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
   });
   const sum = (list, fn) => list.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);

   let columns;
   let rows;
   let totals = null;
   let summary = [];
   // Laporan produksi & inventaris memakai snapshot data terkini (sama seperti tampilan di layar).
   let periodInfo = periodText;

   if (type === "sales") {
      columns = [
         { header: "Tanggal", fmt: "text", align: "center" },
         { header: "No. Transaksi", fmt: "text", align: "center" },
         { header: "Produk", fmt: "text" },
         { header: "SKU", fmt: "text" },
         { header: "Qty", fmt: "int" },
         { header: "Channel", fmt: "text" },
         { header: "Pendapatan", fmt: "rp" },
         { header: "Keuntungan", fmt: "rp" },
      ];
      rows = rSales.map((s) => [
         s.date || "",
         s.txNumber || "",
         s.productName || "",
         s.sku || "",
         Number(s.quantity || 0),
         normalizeChannelValue(s.channel) || "-",
         getSaleRevenue(s),
         getSaleProfit(s),
      ]);
      const totalQty = sum(rSales, (s) => s.quantity);
      const totalRev = sum(rSales, getSaleRevenue);
      const totalProfit = sum(rSales, getSaleProfit);
      totals = ["TOTAL", "", "", "", totalQty, "", totalRev, totalProfit];
      summary = [
         { label: "Total Transaksi", value: rSales.length, fmt: "int" },
         { label: "Total Qty", value: totalQty, fmt: "int" },
         { label: "Total Pendapatan", value: totalRev, fmt: "rp" },
         { label: "Total Keuntungan", value: totalProfit, fmt: "rp" },
      ];
   } else if (type === "profit") {
      const ps = {};
      rSales.forEach((s) => {
         if (!ps[s.productId])
            ps[s.productId] = { name: s.productName, sku: s.sku, rev: 0, cost: 0, profit: 0 };
         ps[s.productId].rev += getSaleRevenue(s);
         ps[s.productId].cost += (s.costPrice || 0) * (s.quantity || 0);
         ps[s.productId].profit += getSaleProfit(s);
      });
      const list = Object.values(ps).sort((a, b) => b.profit - a.profit);
      columns = [
         { header: "Produk", fmt: "text" },
         { header: "SKU", fmt: "text" },
         { header: "Pendapatan", fmt: "rp" },
         { header: "Biaya HPP", fmt: "rp" },
         { header: "Laba", fmt: "rp" },
         { header: "Margin", fmt: "pct" },
      ];
      rows = list.map((p) => [
         p.name || "",
         p.sku || "",
         p.rev,
         p.cost,
         p.profit,
         p.rev > 0 ? p.profit / p.rev : 0,
      ]);
      const totalRev = sum(list, (p) => p.rev);
      const totalCost = sum(list, (p) => p.cost);
      const totalProfit = sum(list, (p) => p.profit);
      totals = ["TOTAL", "", totalRev, totalCost, totalProfit, totalRev > 0 ? totalProfit / totalRev : 0];

      // Sama dengan perhitungan kartu statistik di renderReports().
      const totalProdExp = sum(
         state.productionPurchases.filter((p) => filterByReportPeriod(p.date, period, month, year, date)),
         (p) => p.totalCost,
      );
      const totalPayrollExp =
         sum(
            state.payrolls.filter((p) => {
               const periodDate = p.period ? `${p.period}-01` : p.paymentDate || "";
               return filterByReportPeriod(periodDate, period, month, year, date);
            }),
            (p) => p.totalPaid,
         ) +
         sum(
            (state.salaryProduksi || []).filter((s) =>
               filterByReportPeriod(s.periodDate, period, month, year, date),
            ),
            (s) => s.grandTotal,
         );
      summary = [
         { label: "Total Pendapatan", value: totalRev, fmt: "rp" },
         { label: "Total Biaya HPP", value: totalCost, fmt: "rp" },
         { label: "Laba Penjualan", value: totalProfit, fmt: "rp" },
         { label: "Belanja Produksi", value: totalProdExp, fmt: "rp" },
         { label: "Gaji Karyawan", value: totalPayrollExp, fmt: "rp" },
         { label: "Laba Bersih", value: totalProfit - totalProdExp - totalPayrollExp, fmt: "rp" },
      ];
   } else if (type === "production") {
      periodInfo = "Semua data produksi (tidak difilter periode)";
      columns = [
         { header: "Produk", fmt: "text" },
         { header: "SKU", fmt: "text" },
         { header: "Target", fmt: "int" },
         { header: "Selesai", fmt: "int" },
         { header: "Status", fmt: "text", align: "center" },
         { header: "Tanggal", fmt: "text", align: "center" },
      ];
      rows = state.production.map((p) => [
         p.productName || "",
         p.sku || "",
         Number(p.targetQty || 0),
         Number(p.completedQty || 0),
         REPORT_STATUS_LABELS[p.status] || p.status || "-",
         p.date || "",
      ]);
      const totalTarget = sum(state.production, (p) => p.targetQty);
      const totalDone = sum(state.production, (p) => p.completedQty);
      totals = ["TOTAL", "", totalTarget, totalDone, "", ""];
      summary = [
         { label: "Total Order", value: state.production.length, fmt: "int" },
         { label: "Total Target", value: totalTarget, fmt: "int" },
         { label: "Total Selesai", value: totalDone, fmt: "int" },
         { label: "Completion", value: totalTarget > 0 ? totalDone / totalTarget : 0, fmt: "pct" },
      ];
   } else if (type === "inventory") {
      periodInfo = `Stok per ${exportDateStr}`;
      columns = [
         { header: "SKU", fmt: "text" },
         { header: "Produk", fmt: "text" },
         { header: "Stok", fmt: "int" },
         { header: "Status", fmt: "text", align: "center" },
         { header: "Gambar", fmt: "text" },
      ];
      rows = state.products.map((p) => [
         p.sku || "",
         p.name || "",
         Number(p.stock || 0),
         REPORT_STATUS_LABELS[p.status] || p.status || "-",
         p.images && p.images[0] ? p.images[0].imageUrl : "",
      ]);
      const totalStock = sum(state.products, (p) => p.stock);
      totals = ["TOTAL", "", totalStock, "", ""];
      summary = [
         { label: "Total Produk", value: state.products.length, fmt: "int" },
         { label: "Total Stok", value: totalStock, fmt: "int" },
         { label: "Stok Rendah", value: state.products.filter((p) => p.status === "low_stock").length, fmt: "int" },
         { label: "Stok Habis", value: state.products.filter((p) => p.status === "out_of_stock").length, fmt: "int" },
      ];
   } else {
      const ps = {};
      rSales.forEach((s) => {
         if (!ps[s.productId]) ps[s.productId] = { name: s.productName, sku: s.sku, qty: 0, rev: 0 };
         ps[s.productId].qty += s.quantity || 0;
         ps[s.productId].rev += getSaleRevenue(s);
      });
      const list = Object.values(ps).sort((a, b) => b.rev - a.rev);
      columns = [
         { header: "Peringkat", fmt: "int" },
         { header: "Produk", fmt: "text" },
         { header: "SKU", fmt: "text" },
         { header: "Total Terjual", fmt: "int" },
         { header: "Pendapatan", fmt: "rp" },
      ];
      rows = list.map((p, i) => [i + 1, p.name || "", p.sku || "", p.qty, p.rev]);
      const totalQty = sum(list, (p) => p.qty);
      const totalRev = sum(list, (p) => p.rev);
      totals = ["TOTAL", "", "", totalQty, totalRev];
      summary = [
         { label: "Jumlah Produk", value: list.length, fmt: "int" },
         { label: "Total Terjual", value: totalQty, fmt: "int" },
         { label: "Total Pendapatan", value: totalRev, fmt: "rp" },
      ];
   }

   if (!rows.length) {
      toast("Tidak ada data laporan untuk di-export pada periode ini", "warning");
      return;
   }

   const workbook = new ExcelJS.Workbook();
   const worksheet = workbook.addWorksheet((REPORT_TITLES[type] || "Laporan").slice(0, 31));
   buildReportWorksheet(worksheet, {
      title: REPORT_TITLES[type] || "LAPORAN",
      info: [
         ["Periode", periodInfo],
         ["Tanggal Export", exportDateStr],
         ["Jumlah Baris", rows.length],
      ],
      summary,
      columns,
      rows,
      totals,
   });

   workbook.xlsx
      .writeBuffer()
      .then((buffer) => {
         const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
         });
         const a = document.createElement("a");
         a.href = URL.createObjectURL(blob);
         a.download = `laporan_${type}_${periodLabel}_${today}.xlsx`;
         a.click();
         setTimeout(() => URL.revokeObjectURL(a.href), 1000);
         toast("Laporan di-export ke Excel", "success");
      })
      .catch((err) => {
         console.error("Export laporan gagal:", err);
         toast("Gagal export laporan", "error");
      });
});

/* =========================================================
   PENGGUNA
   ========================================================= */
const SECONDARY_REGISTER_APP_NAME = "secondary-register-app";

function isCurrentUserOwner() {
   return getCurrentUserRole() === "owner";
}

function renderUserRegisterAction() {
   const toolbar = $("#pagePengguna .table-toolbar");
   if (!toolbar) return;

   const existingBtn = $("#registerUserBtn");
   if (existingBtn) existingBtn.remove();

   if (!isCurrentUserOwner()) return;

   toolbar.insertAdjacentHTML(
      "beforeend",
      `
    <button class="btn btn-primary btn-sm" id="registerUserBtn" style="margin-left:auto" onclick="openRegisterUserModal()">
      <i class="fas fa-user-plus"></i>Tambah Pengguna
    </button>
  `,
   );
}

function getSecondaryRegisterAuth() {
   let secondaryApp;
   try {
      secondaryApp = firebase.app(SECONDARY_REGISTER_APP_NAME);
   } catch (err) {
      secondaryApp = firebase.initializeApp(
         firebaseConfig,
         SECONDARY_REGISTER_APP_NAME,
      );
   }
   return secondaryApp.auth();
}

function isValidRegisterEmail(email) {
   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function registerErrorMessage(err) {
   const code = err && err.code ? err.code : "";
   if (code === "auth/email-already-in-use") return "Email sudah terdaftar";
   if (code === "auth/invalid-email") return "Format email tidak valid";
   if (code === "auth/weak-password") return "Password minimal 6 karakter";
   if (code === "permission-denied")
      return "Tidak punya izin menyimpan profil user";
   return (err && err.message) || "Gagal membuat akun";
}

window.openRegisterUserModal = function () {
   if (!isCurrentUserOwner()) {
      toast("Hanya Owner yang dapat menambah pengguna", "error");
      return;
   }

   openModal(
      "Register Akun",
      `
    <div class="form-group">
      <label>Nama</label>
      <input type="text" class="form-input" id="fRegName" placeholder="Nama lengkap">
    </div>
    <div class="form-group">
      <label>Email</label>
      <input type="email" class="form-input" id="fRegEmail" placeholder="user@domain.com">
    </div>
    <div class="form-group">
      <label>Password Sementara</label>
      <input type="password" class="form-input" id="fRegPassword" placeholder="Minimal 6 karakter" autocomplete="new-password">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Role</label>
        <select class="form-input" id="fRegRole">
          <option value="Owner">Owner</option>
          <option value="Admin" selected>Admin</option>
          <option value="Staff">Staff</option>
          <option value="User">User</option>
        </select>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select class="form-input" id="fRegStatus">
          <option value="Aktif" selected>Aktif</option>
          <option value="Nonaktif">Nonaktif</option>
        </select>
      </div>
    </div>
  `,
      `<button class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button><button class="btn btn-primary btn-sm" id="saveRegisterUserBtn" onclick="saveRegisterUser()"><i class="fas fa-check"></i>Simpan</button>`,
   );
};

window.saveRegisterUser = async function () {
   if (!isCurrentUserOwner()) {
      toast("Hanya Owner yang dapat menambah pengguna", "error");
      return;
   }

   const name = ($("#fRegName")?.value || "").trim();
   const email = ($("#fRegEmail")?.value || "").trim().toLowerCase();
   const password = $("#fRegPassword")?.value || "";
   const role = $("#fRegRole")?.value || "";
   const status = $("#fRegStatus")?.value || "";

   if (!name) {
      toast("Nama wajib diisi", "warning");
      return;
   }
   if (!email || !isValidRegisterEmail(email)) {
      toast("Email tidak valid", "warning");
      return;
   }
   if (password.length < 6) {
      toast("Password minimal 6 karakter", "warning");
      return;
   }
   if (!role) {
      toast("Role wajib dipilih", "warning");
      return;
   }
   if (!status) {
      toast("Status wajib dipilih", "warning");
      return;
   }

   const btn = $("#saveRegisterUserBtn");
   const originalHtml = btn ? btn.innerHTML : "";
   let secondaryAuth = null;
   let secondarySignedOut = false;

   if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Menyimpan...';
   }

   try {
      secondaryAuth = getSecondaryRegisterAuth();
      const cred = await secondaryAuth.createUserWithEmailAndPassword(
         email,
         password,
      );
      const uid = cred.user.uid;
      const now = new Date().toISOString();

      await db.collection("users").doc(uid).set({
         name,
         email,
         role,
         status,
         createdAt: now,
         updatedAt: now,
      });

      await secondaryAuth.signOut();
      secondarySignedOut = true;
      closeModal();
      toast("Akun pengguna berhasil dibuat", "success");
   } catch (err) {
      console.error("saveRegisterUser error:", err);
      toast(registerErrorMessage(err), "error");
   } finally {
      if (secondaryAuth && !secondarySignedOut) {
         try {
            await secondaryAuth.signOut();
         } catch (err) {
            console.warn("secondary signOut error:", err);
         }
      }
      if (btn) {
         btn.disabled = false;
         btn.innerHTML = originalHtml;
      }
   }
};

function renderUsers() {
   renderUserRegisterAction();

   const roleBadge = (r) => {
      const role = r || "User";
      const m = {
         Owner: "badge-website",
         Admin: "badge-in_production",
         Staff: "badge-qc",
         Warehouse: "badge-in_progress",
         "Production Team": "badge-qc",
         User: "badge-offline_store",
      };
      return `<span class="badge ${m[role] || "badge-offline_store"}">${role}</span>`;
   };

   if (!state.users.length) {
      $("#userBody").innerHTML =
         `<tr><td colspan="4"><div class="empty-state"><i class="fas fa-users"></i><h4>Belum ada data pengguna</h4><p>Tambahkan user di Firestore collection "users"</p></div></td></tr>`;
      return;
   }

   $("#userBody").innerHTML = state.users
      .map((u) => {
         const name = u.name || (u.email ? u.email.split("@")[0] : "-");
         const email = u.email || "-";
         const role = u.role || "User";
         const status = u.status || "Aktif";
         const initial = name.charAt(0).toUpperCase() || "?";
         return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div class="avatar" style="width:32px;height:32px;border-radius:8px;font-size:13px">${initial}</div>
        <strong>${name}</strong>
      </div></td>
      <td style="color:var(--text-muted)">${email}</td>
      <td>${roleBadge(role)}</td>
      <td><span class="badge ${status === "Aktif" ? "badge-active" : "badge-inactive"}">${status}</span></td>
    </tr>`;
      })
      .join("");
}

/* =========================================================
   PENGATURAN
   ========================================================= */
document.addEventListener("click", (e) => {
   if (e.target.classList.contains("toggle")) {
      e.target.classList.toggle("active");
      toast(
         `Pengaturan "${e.target.dataset.setting}" ${e.target.classList.contains("active") ? "diaktifkan" : "dinonaktifkan"}`,
         "success",
      );
   }
});

$("#saveProfileBtn").addEventListener("click", async () => {
   const name = $("#settingNameInput").value.trim();
   if (!name) {
      toast("Nama tidak boleh kosong", "warning");
      return;
   }

   const btn = $("#saveProfileBtn");
   const originalHtml = btn ? btn.innerHTML : "";
   if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Menyimpan...';
   }

   try {
      const target = await findCurrentUserProfileRef();
      if (!target || !target.ref) {
         toast("Profil user tidak ditemukan", "error");
         return;
      }

      const current = auth.currentUser;
      const existing = target.data || {};
      const currentStateUser = state.user || {};
      const email =
         existing.email || currentStateUser.email || current?.email || "";
      const role = existing.role || currentStateUser.role || "User";
      const status = existing.status || currentStateUser.status || "Aktif";
      const updatedAt = new Date().toISOString();

      const profilePayload = { name, email, role, status, updatedAt };
      await target.ref.set(profilePayload, { merge: true });

      state.user = {
         ...currentStateUser,
         name,
         email,
         role,
         status,
         updatedAt,
      };
      updateUserDisplay(state.user);
      toast("Profil disimpan", "success");
   } catch (err) {
      console.error("saveProfile error:", err);
      toast(err.message || "Gagal menyimpan profil", "error");
   } finally {
      if (btn) {
         btn.disabled = false;
         btn.innerHTML = originalHtml;
      }
   }
});

/* =========================================================
   NOTIFIKASI
   ========================================================= */
$("#notifBtn").addEventListener("click", () => {
   const outP = state.products.filter((p) => p.status === "out_of_stock");
   const lowP = state.products.filter((p) => p.status === "low_stock");
   const doneProd = state.production.filter(
      (p) => p.date === today && p.status === "completed",
   );
   let html = '<div style="max-height:400px;overflow-y:auto">';

   if (!outP.length && !lowP.length && !doneProd.length) {
      html +=
         '<div class="empty-state" style="padding:30px 10px"><i class="fas fa-bell-slash"></i><h4>Tidak ada notifikasi</h4><p>Semua dalam kondisi aman</p></div>';
   } else {
      if (outP.length) {
         html += `<div style="margin-bottom:14px"><p style="font-size:11px;font-weight:700;color:var(--danger);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px"><i class="fas fa-circle-exclamation"></i> Stok Habis (${outP.length})</p>`;
         outP.forEach((p) => {
            html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(244,196,48,.05);font-size:13px">${prodImg(p, 28)}<span class="badge badge-out_of_stock">0 unit</span><span style="flex:1">${p.name}</span><span style="color:var(--text-muted);font-size:12px">${p.sku}</span></div>`;
         });
         html += "</div>";
      }
      if (lowP.length) {
         html += `<div style="margin-bottom:14px"><p style="font-size:11px;font-weight:700;color:var(--warning);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px"><i class="fas fa-triangle-exclamation"></i> Stok Rendah (${lowP.length})</p>`;
         lowP.forEach((p) => {
            html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(244,196,48,.05);font-size:13px">${prodImg(p, 28)}<span class="badge badge-low_stock">${p.stock} unit</span><span style="flex:1">${p.name}</span><span style="color:var(--text-muted);font-size:12px">${p.sku}</span></div>`;
         });
         html += "</div>";
      }
      if (doneProd.length) {
         html += `<div><p style="font-size:11px;font-weight:700;color:var(--success);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px"><i class="fas fa-circle-check"></i> Produksi Selesai (${doneProd.length})</p>`;
         doneProd.forEach((p) => {
            html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(244,196,48,.05);font-size:13px"><span class="badge badge-completed">${p.completedQty || 0}/${p.targetQty}</span><span style="flex:1">${p.productName}</span><span style="color:var(--text-muted);font-size:12px">${p.sku}</span></div>`;
         });
         html += "</div>";
      }
   }
   html += "</div>";
   openModal(
      "Notifikasi",
      html,
      '<button class="btn btn-primary btn-sm" onclick="closeModal()">Tutup</button>',
   );
});

/* =========================================================
   PHASE 6 HELPERS — FINAL CLIENT UPDATES
   ========================================================= */

const MONTH_OPTIONS = [
   { value: "01", label: "Januari" },
   { value: "02", label: "Februari" },
   { value: "03", label: "Maret" },
   { value: "04", label: "April" },
   { value: "05", label: "Mei" },
   { value: "06", label: "Juni" },
   { value: "07", label: "Juli" },
   { value: "08", label: "Agustus" },
   { value: "09", label: "September" },
   { value: "10", label: "Oktober" },
   { value: "11", label: "November" },
   { value: "12", label: "Desember" },
];

function getYearOptionsFromSales() {
   const years = new Set();
   state.sales.forEach((s) => {
      const y = (s.date || "").substring(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
   });
   years.add(String(new Date().getFullYear()));
   return [...years].sort((a, b) => b.localeCompare(a));
}

function matchesMonthYear(dateStr, month, year) {
   if (!dateStr || typeof dateStr !== "string")
      return month === "all" && year === "all";
   const y = dateStr.substring(0, 4);
   const m = dateStr.substring(5, 7);
   if (year !== "all" && y !== year) return false;
   if (month !== "all" && m !== month) return false;
   return true;
}

function filterByReportPeriod(dateStr, period, month, year, selectedDate) {
   if (!dateStr || typeof dateStr !== "string") return false;
   const itemDate = dateStr.substring(0, 10);
   const curToday = new Date().toISOString().split("T")[0];
   if (period === "daily") {
      const target = selectedDate || state.report.date || curToday;
      return itemDate === target;
   }
   if (period === "weekly") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      const weekStart = d.toISOString().split("T")[0];
      return itemDate >= weekStart && itemDate <= curToday;
   }
   if (period === "yearly") return year === "all" || itemDate.substring(0, 4) === year;
   return matchesMonthYear(itemDate, month, year);
}

function populateSalePeriodFilters() {
   const monthSel = $("#saleMonthFilter");
   const yearSel = $("#saleYearFilter");
   if (!monthSel || !yearSel) return;
   const monthOpts = MONTH_OPTIONS.map(
      (m) =>
         `<option value="${m.value}" ${state.sale.month === m.value ? "selected" : ""}>${m.label}</option>`,
   ).join("");
   monthSel.innerHTML = `<option value="all" ${state.sale.month === "all" ? "selected" : ""}>Semua Bulan</option>${monthOpts}`;
   const yearOpts = getYearOptionsFromSales()
      .map(
         (y) =>
            `<option value="${y}" ${state.sale.year === y ? "selected" : ""}>${y}</option>`,
      )
      .join("");
   yearSel.innerHTML = `<option value="all" ${state.sale.year === "all" ? "selected" : ""}>Semua Tahun</option>${yearOpts}`;
}

function populateReportPeriodFilters() {
   const periodSel = $("#reportPeriod");
   if (periodSel && state.report.period) {
      periodSel.value = state.report.period;
   }
   const monthSel = $("#reportMonthFilter");
   const yearSel = $("#reportYearFilter");
   if (!monthSel || !yearSel) return;
   const monthOpts = MONTH_OPTIONS.map(
      (m) =>
         `<option value="${m.value}" ${state.report.month === m.value ? "selected" : ""}>${m.label}</option>`,
   ).join("");
   monthSel.innerHTML = `<option value="all" ${state.report.month === "all" ? "selected" : ""}>Semua Bulan</option>${monthOpts}`;
   // Year list drawn from all data sources
   const years = new Set();
   state.sales.forEach((s) => {
      const y = (s.date || "").substring(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
   });
   state.productionPurchases.forEach((p) => {
      const y = (p.date || "").substring(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
   });
   state.payrolls.forEach((p) => {
      const y = (p.period || p.paymentDate || "").substring(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
   });
   years.add(String(new Date().getFullYear()));
   const sortedYears = [...years].sort((a, b) => b.localeCompare(a));
   const yearOpts = sortedYears
      .map(
         (y) =>
            `<option value="${y}" ${state.report.year === y ? "selected" : ""}>${y}</option>`,
      )
      .join("");
   yearSel.innerHTML = `<option value="all" ${state.report.year === "all" ? "selected" : ""}>Semua Tahun</option>${yearOpts}`;
   syncReportPeriodVisibility();
}

function syncReportPeriodVisibility() {
   const period = state.report.period || ($("#reportPeriod") ? $("#reportPeriod").value : "monthly");
   const dateGroup = $("#reportDateFilterGroup");
   const monthGroup = $("#reportMonthFilterGroup");
   const yearGroup = $("#reportYearFilterGroup");
   const dateInput = $("#reportDateFilter");

   if (dateInput) {
      if (!dateInput.value || (state.report.date && dateInput.value !== state.report.date)) {
         dateInput.value = state.report.date || today;
      }
   }

   if (period === "daily") {
      if (dateGroup) dateGroup.style.display = "block";
      if (monthGroup) monthGroup.style.display = "none";
      if (yearGroup) yearGroup.style.display = "none";
   } else if (period === "weekly") {
      if (dateGroup) dateGroup.style.display = "none";
      if (monthGroup) monthGroup.style.display = "none";
      if (yearGroup) yearGroup.style.display = "none";
   } else if (period === "monthly") {
      if (dateGroup) dateGroup.style.display = "none";
      if (monthGroup) monthGroup.style.display = "block";
      if (yearGroup) yearGroup.style.display = "block";
   } else if (period === "yearly") {
      if (dateGroup) dateGroup.style.display = "none";
      if (monthGroup) monthGroup.style.display = "none";
      if (yearGroup) yearGroup.style.display = "block";
   }
}

/* =========================================================
   INISIALISASI APLIKASI
   ========================================================= */

/**
 * loadUserProfile — cari profil user di Firestore.
 * Urutan: by uid → by email as doc ID → query by email field → fallback default.
 * @param {object} firebaseUser — firebase.auth().currentUser
 * @returns {Promise<object>} state.user shape { name, email, role, status }
 */
async function findCurrentUserProfileRef() {
   const current = auth.currentUser;
   const email = (state.user && state.user.email) || current?.email || "";
   let uidRef = null;

   if (current?.uid) {
      uidRef = db.collection("users").doc(current.uid);
      const uidSnap = await uidRef.get();
      if (uidSnap.exists) {
         return { ref: uidRef, data: uidSnap.data() || {} };
      }
   }

   if (email) {
      const emailRef = db.collection("users").doc(email);
      const emailSnap = await emailRef.get();
      if (emailSnap.exists) {
         return { ref: emailRef, data: emailSnap.data() || {} };
      }

      const emailQuery = await db
         .collection("users")
         .where("email", "==", email)
         .limit(1)
         .get();
      if (!emailQuery.empty) {
         const doc = emailQuery.docs[0];
         return { ref: doc.ref, data: doc.data() || {} };
      }

      return { ref: uidRef || emailRef, data: {} };
   }

   if (uidRef) {
      return { ref: uidRef, data: {} };
   }

   return null;
}

async function loadUserProfile(firebaseUser) {
   const fallback = {
      name: firebaseUser.displayName || firebaseUser.email.split("@")[0],
      email: firebaseUser.email,
      role: "User",
      status: "Aktif",
   };

   try {
      // 1. Lookup by UID (doc id = uid — standard Firebase pattern)
      const byUid = await db.collection("users").doc(firebaseUser.uid).get();
      if (byUid.exists) {
         return { ...fallback, ...byUid.data(), email: firebaseUser.email };
      }

      // 2. Lookup by email as doc ID (some apps store user docs keyed by email)
      const byEmailDocId = await db
         .collection("users")
         .doc(firebaseUser.email)
         .get();
      if (byEmailDocId.exists) {
         return {
            ...fallback,
            ...byEmailDocId.data(),
            email: firebaseUser.email,
         };
      }

      // 3. Query by email field (email stored as a field, not as doc ID)
      const byEmailQuery = await db
         .collection("users")
         .where("email", "==", firebaseUser.email)
         .limit(1)
         .get();
      if (!byEmailQuery.empty) {
         return {
            ...fallback,
            ...byEmailQuery.docs[0].data(),
            email: firebaseUser.email,
         };
      }
   } catch (err) {
      console.warn("loadUserProfile error:", err);
   }

   // 4. No Firestore profile found — use fallback (role: User)
   return fallback;
}

/* =========================================================
   RESELLER MANAGEMENT
   ========================================================= */
window.renderResellers = function () {
   var container = $("#pageReseller");
   if (!container) return;

   var _role = getCurrentUserRole();
   if (_role !== "owner" && _role !== "admin") {
      container.innerHTML =
         '<div class="empty-state"><i class="fas fa-lock"></i><h4>Akses ditolak</h4><p>Halaman ini hanya untuk Owner atau Admin</p></div>';
      return;
   }

   var list = state.resellers || [];

   // --- Filtering: search ---
   if (state.reseller.search) {
      var q = state.reseller.search.toLowerCase().trim();
      list = list.filter(function (d) {
         return (d.name || "").toLowerCase().indexOf(q) !== -1;
      });
   }

   var rPerPage = state.reseller.perPage;
   var rTotal = Math.max(1, Math.ceil(list.length / rPerPage));
   if (state.reseller.page > rTotal) state.reseller.page = 1;
   var rStart = (state.reseller.page - 1) * rPerPage;
   var rItems = list.slice(rStart, rStart + rPerPage);

   var tableRows = list.length
      ? rItems
           .map(function (doc) {
              var dateFormatted = doc.createdAt
                 ? new Date(doc.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                   })
                 : "-";

              var statusText = doc.status === "active" ? "Aktif" : "Nonaktif";
              var statusBadgeClass = doc.status === "active" ? "badge-active" : "badge-inactive";
              var statusIcon = doc.status === "active" ? "fa-toggle-on" : "fa-toggle-off";
              var statusTitle = doc.status === "active" ? "Nonaktifkan" : "Aktifkan";

              return (
                 '<tr>' +
                 '<td><strong>' + (doc.name || "-") + '</strong></td>' +
                 '<td style="color:var(--text-muted)">' + dateFormatted + '</td>' +
                 '<td><span class="badge ' + statusBadgeClass + '">' + statusText + '</span></td>' +
                 '<td>' +
                 '<div style="display:flex;gap:6px">' +
                 '<button class="action-btn" title="Edit Nama" onclick="openResellerModal(\'' + doc.id + '\', true)"><i class="fas fa-pen"></i></button>' +
                 '<button class="action-btn" title="' + statusTitle + '" onclick="toggleResellerStatus(\'' + doc.id + '\')"><i class="fas ' + statusIcon + '"></i></button>' +
                 '<button class="action-btn del" title="Hapus" onclick="confirmDeleteReseller(\'' + doc.id + '\')"><i class="fas fa-trash"></i></button>' +
                 '</div>' +
                 '</td>' +
                 '</tr>'
              );
           })
           .join("")
      : '<tr><td colspan="4"><div class="empty-state"><i class="fas fa-user-tag"></i><h4>Belum ada data reseller</h4><p>Klik "+ Tambah Reseller" untuk menambahkan</p></div></td></tr>';

   var rPag = renderPaginationHTML(state.reseller.page, rTotal, "goResellerPage");

   container.innerHTML =
      '<div class="cat-toolbar">' +
      "<div>" +
      '<h3 style="font-size:16px;font-weight:700">Reseller Management</h3>' +
      '<p style="font-size:13px;color:var(--text-muted);margin-top:4px">' +
      list.length +
      " reseller terdaftar</p>" +
      "</div>" +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-primary btn-sm" onclick="openResellerModal()">' +
      '<i class="fas fa-plus"></i>Tambah Reseller' +
      '</button>' +
      '</div>' +
      "</div>" +
      // --- Search Bar ---
      '<div class="table-toolbar" style="margin-bottom:14px">' +
      '<div class="table-search">' +
      '<i class="fas fa-search"></i>' +
      '<input type="text" placeholder="Cari reseller..." id="resellerSearch" value="' + (state.reseller.search || "").replace(/"/g, "&quot;") + '" oninput="onResellerSearch(this.value)">' +
      '</div>' +
      "</div>" +
      // --- Table ---
      '<div class="card">' +
      '<div class="table-scroll">' +
      '<table class="data-table">' +
      '<thead>' +
      '<tr>' +
      '<th>Nama Reseller</th>' +
      '<th>Tanggal Dibuat</th>' +
      '<th>Status</th>' +
      '<th>Aksi</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody id="resellerBody">' +
      tableRows +
      '</tbody>' +
      '</table>' +
      '</div>' +
      '<div class="table-footer" style="margin-top:16px">' +
      "<span>" +
      (list.length > 0
         ? "Menampilkan " +
           (rStart + 1) +
           "\u2013" +
           Math.min(rStart + rPerPage, list.length) +
           " dari " +
           list.length +
           " reseller"
         : "0 reseller") +
      "</span>" +
      '<div class="pagination">' +
      rPag +
      "</div>" +
      "</div>" +
      "</div>";
};

window.onResellerSearch = function (val) {
   state.reseller.search = val;
   state.reseller.page = 1;
   renderResellers();
   const input = document.getElementById("resellerSearch");
   if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
   }
};

window.goResellerPage = function (p) {
   state.reseller.page = p;
   renderResellers();
};

window.openResellerModal = function (docId, isEdit) {
   var existing = null;
   if (isEdit && docId) {
      existing = state.resellers.find(function (r) { return r.id === docId; });
   }

   var title = existing ? "Edit Reseller" : "Tambah Reseller";
   var nameVal = existing ? existing.name : "";
   var statusVal = existing ? existing.status : "active";

   var body =
      '<form id="resellerForm" onsubmit="event.preventDefault(); saveReseller(' + (docId ? "'" + docId + "'" : "null") + ')">' +
      '<div class="form-group" style="margin-bottom:14px">' +
      '<label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px">Nama Reseller <span style="color:red">*</span></label>' +
      '<input type="text" id="resellerNameInput" class="form-control" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm)" placeholder="Masukkan nama reseller..." value="' + nameVal.replace(/"/g, "&quot;") + '" required>' +
      '</div>' +
      (existing
         ? '<div class="form-group" style="margin-bottom:14px">' +
           '<label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px">Status</label>' +
           '<select id="resellerStatusInput" class="form-control" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-sm)">' +
           '<option value="active"' + (statusVal === "active" ? " selected" : "") + '>Aktif</option>' +
           '<option value="inactive"' + (statusVal === "inactive" ? " selected" : "") + '>Nonaktif (Inactive)</option>' +
           '</select>' +
           '</div>'
         : "") +
      '</form>';

   var footer =
      '<button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>' +
      '<button type="button" class="btn btn-primary btn-sm" onclick="$(\'#resellerForm\').dispatchEvent(new Event(\'submit\'))">Simpan</button>';

   openModal(title, body, footer);
};

window.saveReseller = async function (docId) {
   var nameInput = $("#resellerNameInput");
   var name = nameInput ? nameInput.value.trim() : "";
   if (!name) {
      toast("Nama reseller wajib diisi", "warning");
      return;
   }

   var nameExists = state.resellers.some(function (r) {
      if (docId && r.id === docId) return false;
      return (r.name || "").toLowerCase() === name.toLowerCase();
   });

   if (nameExists) {
      toast("Nama reseller sudah terdaftar", "warning");
      return;
   }

   var statusInput = $("#resellerStatusInput");
   var status = statusInput ? statusInput.value : "active";

   var docData = {
      name: name,
      status: status,
      updatedAt: new Date().toISOString()
   };

   var saveBtn = $("#modalFooter .btn-primary");
   var originalHtml = saveBtn.innerHTML;
   saveBtn.disabled = true;
   saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

   try {
      if (docId) {
         await db.collection("resellers").doc(docId).update(sanitize(docData));
         toast("Reseller berhasil diperbarui", "success");
      } else {
         docData.createdAt = new Date().toISOString();
         await db.collection("resellers").add(sanitize(docData));
         toast("Reseller berhasil ditambahkan", "success");
      }
      closeModal();
   } catch (err) {
      console.error("Gagal menyimpan reseller:", err);
      toast("Gagal menyimpan: " + err.message, "error");
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHtml;
   }
};

window.toggleResellerStatus = async function (docId) {
   var r = state.resellers.find(function (x) { return x.id === docId; });
   if (!r) return;
   var newStatus = r.status === "active" ? "inactive" : "active";

   try {
      await db.collection("resellers").doc(docId).update({
         status: newStatus,
         updatedAt: new Date().toISOString()
      });
      toast("Status reseller berhasil diubah", "success");
   } catch (err) {
      console.error("Gagal mengubah status reseller:", err);
      toast("Gagal mengubah status: " + err.message, "error");
   }
};

window.confirmDeleteReseller = function (docId) {
   var r = state.resellers.find(function (x) { return x.id === docId; });
   if (!r) return;

   var isReferenced = (state.sales || []).some(function (s) {
      return s.resellerId === docId;
   });

   if (isReferenced) {
      var title = "Tidak Dapat Menghapus Reseller";
      var body =
         '<div style="text-align:center;padding:10px 0">' +
         '<i class="fas fa-exclamation-triangle" style="font-size:40px;color:var(--warning);margin-bottom:14px"></i>' +
         '<p style="font-size:14px;line-height:1.6;margin-bottom:10px">' +
         'Reseller <strong>' + r.name + '</strong> tidak dapat dihapus karena sudah digunakan dalam histori transaksi penjualan.' +
         '</p>' +
         '<p style="font-size:13px;color:var(--text-muted)">' +
         'Untuk menonaktifkan reseller ini tanpa menghapus histori penjualan, ubah statusnya menjadi <strong>Nonaktif</strong>.' +
         '</p>' +
         '</div>';
      var footer =
         '<button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Tutup</button>' +
         '<button type="button" class="btn btn-primary btn-sm" onclick="closeModal(); toggleResellerStatus(\'' + docId + '\')">Ubah Jadi Nonaktif</button>';
      openModal(title, body, footer);
   } else {
      var title = "Hapus Reseller";
      var body = '<p>Apakah Anda yakin ingin menghapus reseller <strong>' + r.name + '</strong> secara permanen?</p>';
      var footer =
         '<button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>' +
         '<button type="button" class="btn btn-danger btn-sm" onclick="closeModal(); deleteReseller(\'' + docId + '\')">Hapus Permanen</button>';
      openModal(title, body, footer);
   }
};

window.deleteReseller = async function (docId) {
   try {
      await db.collection("resellers").doc(docId).delete();
      toast("Reseller berhasil dihapus permanen", "success");
   } catch (err) {
      console.error("Gagal menghapus reseller:", err);
      toast("Gagal menghapus: " + err.message, "error");
   }
};

window.populateResellerFilters = function () {
   var filter = $("#saleResellerFilter");
   if (!filter) return;
   var currentVal = state.sale.resellerId || "all";

   var options = '<option value="all">Semua Reseller</option>';
   (state.resellers || []).forEach(function (r) {
      if (r.status === "active" || r.id === currentVal) {
         options += '<option value="' + r.id + '"' + (r.id === currentVal ? " selected" : "") + '>' + r.name + (r.status === "inactive" ? " (Nonaktif)" : "") + '</option>';
      }
   });
   filter.innerHTML = options;
};

window.toggleResellerDropdown = function (isEdit, selectedResellerId) {
   var prefix = isEdit ? "fEdit" : "f";
   var channelSelect = $("#" + prefix + "SaleChannel");
   var resellerGroup = $("#" + prefix + "SaleResellerGroup");
   var resellerSelect = $("#" + prefix + "SaleReseller");

   if (!channelSelect || !resellerGroup || !resellerSelect) return;

   var channel = channelSelect.value;
   if (channel === "Reseller") {
      resellerGroup.style.display = "block";
      var options = '<option value="">— Pilih Reseller —</option>';
      (state.resellers || []).forEach(function (r) {
         if (r.status === "active" || r.id === selectedResellerId) {
            var selectedAttr = r.id === selectedResellerId ? " selected" : "";
            options += '<option value="' + r.id + '"' + selectedAttr + '>' + r.name + (r.status === "inactive" ? " (Nonaktif)" : "") + '</option>';
         }
      });
      resellerSelect.innerHTML = options;
   } else {
      resellerGroup.style.display = "none";
      resellerSelect.value = "";
   }
};

window.exportResellerSales = function () {
   let list = [...state.sales].sort((a, b) =>
      (b.date || "").localeCompare(a.date || "")
   );
   if (state.sale.search) {
      const q = state.sale.search.toLowerCase().trim();
      list = list.filter((s) =>
         (s.txNumber || "").toLowerCase().includes(q) ||
         (s.productName || "").toLowerCase().includes(q) ||
         (s.customer || "").toLowerCase().includes(q) ||
         (normalizeChannelValue(s.channel) || "").toLowerCase().includes(q) ||
         (s.resellerName || "").toLowerCase().includes(q) ||
         (s.city || "").toLowerCase().includes(q) ||
         (s.district || "").toLowerCase().includes(q) ||
         (s.expedition || "").toLowerCase().includes(q)
      );
   }
   if (state.sale.channel !== "all") {
      list = list.filter((s) => isChannelMatch(s.channel, state.sale.channel));
      if (state.sale.channel === "Reseller" && state.sale.resellerId !== "all") {
         list = list.filter((s) => s.resellerId === state.sale.resellerId);
      }
   }
   if (state.sale.month !== "all" || state.sale.year !== "all") {
      list = list.filter((s) =>
         matchesMonthYear(s.date, state.sale.month, state.sale.year)
      );
   }
   if (state.sale.date && state.sale.date !== "all") {
      list = list.filter((s) => s.date === state.sale.date);
   }

   if (list.length === 0) {
      toast("Tidak ada data penjualan untuk di-export", "warning");
      return;
   }

   var workbook = new ExcelJS.Workbook();
   var worksheet = workbook.addWorksheet("Laporan Penjualan");

   var resellerNameStr = "Semua Reseller";
   if (state.sale.channel === "Reseller" && state.sale.resellerId !== "all") {
      var resObj = state.resellers.find(function (r) { return r.id === state.sale.resellerId; });
      if (resObj) resellerNameStr = resObj.name;
   } else if (state.sale.channel !== "all") {
      resellerNameStr = "Semua Reseller (Filter Channel: " + state.sale.channel + ")";
   }

   var exportDateStr = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
   });

   var periodStr = "Semua Periode";
   if (list.length > 0) {
      var dates = list.map(function (s) { return s.date; }).filter(Boolean).sort();
      if (dates.length > 0) {
         var minDate = new Date(dates[0]).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
         var maxDate = new Date(dates[dates.length - 1]).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
         if (dates[0] === dates[dates.length - 1]) {
            periodStr = minDate;
         } else {
            periodStr = minDate + " - " + maxDate;
         }
      }
   }

   worksheet.getCell("A1").value = "LAPORAN PENJUALAN RESELLER";
   worksheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FF2B2B2B" } };

   worksheet.getCell("A3").value = "Nama Reseller";
   worksheet.getCell("B3").value = ": " + resellerNameStr;
   worksheet.getCell("A4").value = "Periode";
   worksheet.getCell("B4").value = ": " + periodStr;
   worksheet.getCell("A5").value = "Tanggal Export";
   worksheet.getCell("B5").value = ": " + exportDateStr;
   worksheet.getCell("A6").value = "Jumlah Transaksi";
   worksheet.getCell("B6").value = ": " + list.length;

   ["A3", "A4", "A5", "A6"].forEach(function (cellId) {
      worksheet.getCell(cellId).font = { name: "Arial", size: 10, bold: true };
   });

   var totalQty = 0;
   var totalRevenue = 0;
   var totalProfit = 0;
   list.forEach(function (s) {
      totalQty += Number(s.quantity || 0);
      var displayRev = s.realRevenue !== undefined ? s.realRevenue : s.revenue || 0;
      var displayProf = s.realProfit !== undefined ? s.realProfit : s.profit || 0;
      totalRevenue += displayRev;
      totalProfit += displayProf;
   });

   worksheet.getCell("A8").value = "RINGKASAN PENJUALAN";
   worksheet.getCell("A8").font = { name: "Arial", size: 11, bold: true };

   worksheet.getRow(9).values = ["Total Transaksi", "Total Qty", "Total Revenue", "Total Profit"];
   worksheet.getRow(9).font = { name: "Arial", size: 10, bold: true };
   worksheet.getRow(9).height = 20;
   worksheet.getRow(9).eachCell(function (cell) {
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFE0E0E0" }
      };
      cell.border = {
         top: { style: "thin" },
         left: { style: "thin" },
         bottom: { style: "thin" },
         right: { style: "thin" }
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
   });

   worksheet.getRow(10).values = [list.length, totalQty, totalRevenue, totalProfit];
   worksheet.getRow(10).height = 22;
   worksheet.getRow(10).eachCell(function (cell, colNum) {
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.border = {
         top: { style: "thin" },
         left: { style: "thin" },
         bottom: { style: "thin" },
         right: { style: "thin" }
      };
      if (colNum === 1 || colNum === 2) {
         cell.alignment = { horizontal: "center", vertical: "middle" };
         cell.numFmt = "#,##0";
      } else {
         cell.alignment = { horizontal: "right", vertical: "middle" };
         cell.numFmt = "\"Rp\" #,##0";
      }
   });

   worksheet.getRow(12).values = [
      "Tanggal",
      "No. Transaksi",
      "Produk",
      "Qty",
      "Harga Satuan",
      "Pendapatan",
      "Keuntungan",
      "Pelanggan",
      "Kota",
      "Ekspedisi"
   ];
   worksheet.getRow(12).height = 26;
   worksheet.getRow(12).eachCell(function (cell) {
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFF2C94C" }
      };
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.border = {
         top: { style: "thin" },
         left: { style: "thin" },
         bottom: { style: "thin" },
         right: { style: "thin" }
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
   });

   list.forEach(function (s) {
      var displayRev = s.realRevenue !== undefined ? s.realRevenue : s.revenue || 0;
      var displayProf = s.realProfit !== undefined ? s.realProfit : s.profit || 0;
      var unitPrice = s.realUnitPrice !== undefined ? s.realUnitPrice : (s.quantity ? displayRev / s.quantity : s.sellingPrice) || 0;

      var row = worksheet.addRow([
         s.date || "",
         s.txNumber || "",
         s.productName || "",
         Number(s.quantity || 0),
         Number(unitPrice),
         Number(displayRev),
         Number(displayProf),
         s.customer || "-",
         s.city || "-",
         s.expedition || "-"
      ]);

      row.height = 20;
      row.eachCell(function (cell, colNumber) {
         cell.font = { name: "Arial", size: 10 };
         cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
         };

         if (colNumber === 4) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.numFmt = "#,##0";
         } else if (colNumber === 5 || colNumber === 6 || colNumber === 7) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "\"Rp\" #,##0";
         } else if (colNumber === 1 || colNumber === 2) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
         } else {
            cell.alignment = { vertical: "middle", horizontal: "left" };
         }
      });
   });

   var totalRow = worksheet.addRow([
      "TOTAL BIAYA",
      "",
      "",
      totalQty,
      "",
      totalRevenue,
      totalProfit,
      "",
      "",
      ""
   ]);
   totalRow.height = 24;
   totalRow.eachCell(function (cell, colNumber) {
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.fill = {
         type: "pattern",
         pattern: "solid",
         fgColor: { argb: "FFFFE57F" }
      };
      cell.border = {
         top: { style: "double" },
         bottom: { style: "double" },
         left: { style: "thin" },
         right: { style: "thin" }
      };

      if (colNumber === 4) {
         cell.alignment = { vertical: "middle", horizontal: "center" };
         cell.numFmt = "#,##0";
      } else if (colNumber === 6 || colNumber === 7) {
         cell.alignment = { vertical: "middle", horizontal: "right" };
         cell.numFmt = "\"Rp\" #,##0";
      } else {
         cell.alignment = { vertical: "middle", horizontal: "left" };
      }
   });

   worksheet.views = [
      { state: 'frozen', ySplit: 12 }
   ];

   worksheet.columns.forEach(function (column) {
      var maxLen = 0;
      column.eachCell({ includeEmpty: true }, function (cell) {
         if (cell.row > 11) {
            var valStr = cell.value ? String(cell.value) : "";
            if (cell.numFmt && cell.numFmt.indexOf("Rp") !== -1) {
               valStr = "Rp " + valStr;
            }
            if (valStr.length > maxLen) {
               maxLen = valStr.length;
            }
         }
      });
      column.width = Math.max(maxLen + 4, 12);
   });

   var resellerSlug = "semua_reseller";
   if (state.sale.channel === "Reseller" && state.sale.resellerId !== "all") {
      var resObj = state.resellers.find(function (r) { return r.id === state.sale.resellerId; });
      if (resObj && resObj.name) {
         resellerSlug = resObj.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");
      }
   }
   var yyyy = String(new Date().getFullYear());
   var mm = String(new Date().getMonth() + 1).padStart(2, "0");
   var dd = String(new Date().getDate()).padStart(2, "0");
   var dateStr = state.sale.date && state.sale.date !== "all" ? state.sale.date.replace(/-/g, "_") : yyyy + "_" + mm + "_" + dd;

   workbook.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "sales_" + resellerSlug + "_" + dateStr + ".xlsx";
      a.click();
      toast("Data penjualan reseller berhasil di-export ke Excel", "success");
   });
};

// Event delegation for export button
document.addEventListener("click", function (e) {
   var btn = e.target.closest("#exportSaleBtn");
   if (btn) {
      e.preventDefault();
      exportResellerSales();
   }
});

// Investor portal data (capital.inzta.id). The portal reads investor_agreement/current and investor_payments and
// ignores any field that is not in its shape, so dates stay "YYYY-MM-DD" and amounts stay whole Rupiah numbers.
// Belanja Produksi paid from the investment carries the agreement id, not true, so a second investor only changes the value.
var INVESTOR_AGREEMENT_ID = "current";

function isInvestorEditor() {
   var role = getCurrentUserRole();
   return role === "owner" || role === "admin";
}

function investorMarkFields() {
   return {
      investorAgreementId: INVESTOR_AGREEMENT_ID,
      investorMarkedAt: new Date().toISOString(),
      investorMarkedBy: auth.currentUser ? auth.currentUser.uid : "",
   };
}

function investorUnmarkFields() {
   var del = firebase.firestore.FieldValue.delete();
   return { investorAgreementId: del, investorMarkedAt: del, investorMarkedBy: del };
}

function investorFundCheckboxHTML(checked) {
   return (
      '<label style="display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;cursor:pointer">' +
      '<input type="checkbox" id="fPPInvestor"' + (checked ? " checked" : "") + ' style="margin-top:2px">' +
      "<span><strong>Dibayar dari dana investasi</strong><br>" +
      '<span style="color:var(--text-muted)">Belanja ini tampil di halaman Penggunaan Dana portal investor.</span></span>' +
      "</label>"
   );
}

// Marking an earlier purchase is allowed: the investor may have funded it before the agreement took effect.
function warnIfBeforeEffective(date) {
   var effective = state.investor.agreementLoaded ? investorTerms().effectiveDate : null;
   if (effective && date && date < effective) {
      toast("Belanja ini bertanggal sebelum Tanggal Efektif (" + investorFmtDate(effective) + "), tetap ditandai.", "warning");
   }
}

var INVESTOR_DEFAULTS = {
   termMonths: 24,
   totalInvestment: 200000000,
   commissionRateBasisPoints: 320,
   repaymentDueMonths: [16, 20, 24],
};

function investorEsc(value) {
   return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
}

function investorLocalToday() {
   var d = new Date();
   return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function investorFmtDate(iso) {
   if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "-";
   var p = iso.split("-").map(Number);
   return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// Agreement month n is the n-th calendar month after the month of the Effective Date, as the portal counts it.
function investorMonthLabel(effectiveDate, n) {
   if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return "";
   var p = effectiveDate.split("-").map(Number);
   return new Date(p[0], p[1] - 1 + n, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

// Terms from the agreement document when the admin filled them, otherwise the contract values the portal also uses.
function investorTerms() {
   var a = state.investor.agreement || {};
   var termMonths = Number.isInteger(a.termMonths) && a.termMonths > 0 ? a.termMonths : INVESTOR_DEFAULTS.termMonths;
   var total = Number.isSafeInteger(a.totalInvestment) && a.totalInvestment > 0 ? a.totalInvestment : INVESTOR_DEFAULTS.totalInvestment;
   var rate = Number.isInteger(a.commissionRateBasisPoints) ? a.commissionRateBasisPoints : INVESTOR_DEFAULTS.commissionRateBasisPoints;
   var repayments = Array.isArray(a.repayments) && a.repayments.length === 3 ? a.repayments : null;
   return {
      effectiveDate: typeof a.effectiveDate === "string" && a.effectiveDate ? a.effectiveDate : null,
      termMonths: termMonths,
      totalInvestment: total,
      commission: Math.round((total * rate) / 10000),
      dueMonths: repayments
         ? repayments.map(function (r, i) { return (r && r.dueMonth) || INVESTOR_DEFAULTS.repaymentDueMonths[i]; })
         : INVESTOR_DEFAULTS.repaymentDueMonths,
      repaymentAmounts: repayments
         ? repayments.map(function (r) {
              return r && Number.isInteger(r.percentBasisPoints) ? Math.round((total * r.percentBasisPoints) / 10000) : null;
           })
         : [null, null, null],
   };
}

// Started on the first visit by an owner or admin, so other roles never read these collections.
function startInvestorListeners() {
   if (state.investor.listening) return;
   state.investor.listening = true;
   state.investor.error = "";
   var onError = function (err) {
      console.error("Investor listener error:", err);
      state.investor.listening = false;
      state.investor.error =
         err && err.code === "resource-exhausted"
            ? "Kuota baca harian database sudah habis. Data bisa dimuat lagi setelah kuota direset, sekitar pukul 14.00 sampai 15.00 WIB."
            : "Gagal memuat data investor: " + (err && err.message ? err.message : err);
      if (state.currentPage === "investor") renderInvestor();
   };
   var unsubAgreement = db
      .collection("investor_agreement")
      .doc("current")
      .onSnapshot(function (snap) {
         state.investor.agreement = snap.exists ? snap.data() : null;
         state.investor.agreementLoaded = true;
         if (state.currentPage === "investor") renderInvestor();
      }, onError);
   var unsubPayments = db.collection("investor_payments").onSnapshot(function (snap) {
      state.investor.payments = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      state.investor.paymentsLoaded = true;
      if (state.currentPage === "investor") renderInvestor();
   }, onError);
   state.listeners.push(unsubAgreement, unsubPayments);
}

function investorPageSlice(list, page) {
   var perPage = state.investor.perPage;
   var totalPages = Math.max(1, Math.ceil(list.length / perPage));
   var current = Math.min(Math.max(page || 1, 1), totalPages);
   var start = (current - 1) * perPage;
   return { items: list.slice(start, start + perPage), page: current, totalPages: totalPages, start: start };
}

function investorTableFooterHTML(slice, total, noun, onClickFuncName) {
   if (!total) return "";
   return (
      '<div class="table-footer">' +
      "<span>Menampilkan " + (slice.start + 1) + "\u2013" + Math.min(slice.start + state.investor.perPage, total) + " dari " + total + " " + noun + "</span>" +
      '<div class="pagination">' + renderPaginationHTML(slice.page, slice.totalPages, onClickFuncName) + "</div>" +
      "</div>"
   );
}

window.goInvestorPaymentsPage = function (page) {
   state.investor.paymentsPage = page;
   renderInvestor();
};

window.goInvestorUsagePage = function (page) {
   state.investor.usagePage = page;
   renderInvestor();
};

window.retryInvestorData = function () {
   state.investor.error = "";
   renderInvestor();
};

window.renderInvestor = function () {
   var container = $("#pageInvestor");
   if (!container) return;

   var _role = getCurrentUserRole();
   if (_role !== "owner" && _role !== "admin") {
      container.innerHTML =
         '<div class="empty-state"><i class="fas fa-lock"></i><h4>Akses ditolak</h4><p>Halaman ini hanya untuk Owner atau Admin</p></div>';
      return;
   }

   var header =
      '<div class="cat-toolbar">' +
      "<div>" +
      '<h3 style="font-size:16px;font-weight:700">Investor</h3>' +
      '<p style="font-size:13px;color:var(--text-muted);margin-top:4px">Tanggal Efektif dan pembayaran di halaman ini tampil di portal investor (capital.inzta.id).</p>' +
      "</div>" +
      '<button class="btn btn-primary btn-sm" onclick="openInvestorPaymentModal()"' +
      (state.investor.agreementLoaded && state.investor.paymentsLoaded ? "" : " disabled") +
      '><i class="fas fa-plus"></i>Catat Pembayaran</button>' +
      "</div>";

   if (state.investor.error) {
      container.innerHTML =
         header +
         '<div class="card"><div class="empty-state"><i class="fas fa-triangle-exclamation"></i><h4>Data investor belum bisa dimuat</h4><p>' +
         investorEsc(state.investor.error) +
         '</p><button class="btn btn-outline btn-sm" style="margin-top:12px" onclick="retryInvestorData()">Coba lagi</button></div></div>';
      return;
   }

   startInvestorListeners();
   if (!state.investor.agreementLoaded || !state.investor.paymentsLoaded) {
      container.innerHTML =
         header + '<div class="card"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><h4>Memuat data investor...</h4></div></div>';
      return;
   }

   var t = investorTerms();
   var info = function (label, value) {
      return (
         "<div>" +
         '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">' + label + "</div>" +
         '<div style="font-size:15px;font-weight:700">' + value + "</div>" +
         "</div>"
      );
   };
   var periodText = t.effectiveDate
      ? investorMonthLabel(t.effectiveDate, 1) + " sampai " + investorMonthLabel(t.effectiveDate, t.termMonths)
      : '<span class="badge badge-pending">Menunggu Tanggal Efektif</span>';

   var agreementCard =
      '<div class="card" style="height:auto;margin-bottom:18px">' +
      '<div class="card-header"><h3>Perjanjian</h3>' +
      '<button class="btn btn-outline btn-sm" onclick="openInvestorEffectiveModal()"><i class="fas fa-calendar-check"></i>' +
      (t.effectiveDate ? "Ubah Tanggal Efektif" : "Isi Tanggal Efektif") +
      "</button></div>" +
      '<div class="card-body"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:18px">' +
      info("Tanggal Efektif", t.effectiveDate ? investorFmtDate(t.effectiveDate) : '<span class="badge badge-pending">Belum diisi</span>') +
      info("Masa perjanjian (" + t.termMonths + " bulan)", periodText) +
      info("Komisi per bulan", '<span style="font-family:monospace">' + fmtRp(t.commission) + "</span>") +
      info("Dana investasi", '<span style="font-family:monospace">' + fmtRp(t.totalInvestment) + "</span>") +
      "</div></div></div>";

   var payments = state.investor.payments.slice().sort(function (a, b) {
      return (a.periodMonth || 0) - (b.periodMonth || 0) || String(a.paidDate || "").localeCompare(String(b.paidDate || ""));
   });
   var paymentsSlice = investorPageSlice(payments, state.investor.paymentsPage);
   state.investor.paymentsPage = paymentsSlice.page;
   var rows = payments.length
      ? paymentsSlice.items
           .map(function (p) {
              var kind = p.kind === "repayment" ? "Pengembalian ke-" + (p.repaymentNumber || "?") : "Komisi";
              var badge = p.kind === "repayment" ? "badge-active" : "badge-pending";
              var month = investorMonthLabel(t.effectiveDate, p.periodMonth);
              return (
                 "<tr>" +
                 '<td><span class="badge ' + badge + '">' + kind + "</span></td>" +
                 "<td>Bulan ke-" + investorEsc(p.periodMonth) +
                 (month ? '<div style="font-size:12px;color:var(--text-muted)">' + month + "</div>" : "") +
                 "</td>" +
                 '<td style="font-family:monospace;font-weight:600">' + fmtRp(p.amount) + "</td>" +
                 "<td>" + investorFmtDate(p.paidDate) + "</td>" +
                 '<td style="color:var(--text-muted);max-width:240px">' + (p.note ? investorEsc(p.note) : "-") + "</td>" +
                 '<td><div style="display:flex;gap:6px">' +
                 '<button class="action-btn" title="Ubah" onclick="openInvestorPaymentModal(\'' + p.id + "')\"><i class=\"fas fa-pen\"></i></button>" +
                 '<button class="action-btn del" title="Hapus" onclick="confirmDeleteInvestorPayment(\'' + p.id + "')\"><i class=\"fas fa-trash\"></i></button>" +
                 "</div></td>" +
                 "</tr>"
              );
           })
           .join("")
      : '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-hand-holding-dollar"></i><h4>Belum ada pembayaran tercatat</h4><p>Klik "Catat Pembayaran" setelah Komisi atau pengembalian ditransfer ke investor</p></div></td></tr>';

   var paidTotal = payments.reduce(function (sum, p) { return sum + (Number(p.amount) || 0); }, 0);
   var paymentsCard =
      '<div class="card" style="height:auto">' +
      '<div class="card-header"><h3>Pembayaran ke Investor</h3>' +
      '<span style="font-size:13px;color:var(--text-muted)">' + payments.length + " catatan · total " +
      '<span style="font-family:monospace">' + fmtRp(paidTotal) + "</span></span></div>" +
      '<div class="table-scroll"><table class="data-table">' +
      "<thead><tr><th>Jenis</th><th>Periode</th><th>Nominal</th><th>Tanggal Transfer</th><th>Catatan</th><th>Aksi</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>" +
      investorTableFooterHTML(paymentsSlice, payments.length, "catatan", "goInvestorPaymentsPage") +
      "</div>";

   container.innerHTML = header + agreementCard + paymentsCard + investorUsageCardHTML();
};

function investorUsageCardHTML() {
   var purchases = state.productionPurchases || [];
   var month = state.investor.usageMonth || investorLocalToday().slice(0, 7);
   var months = {};
   months[investorLocalToday().slice(0, 7)] = true;
   purchases.forEach(function (p) {
      if (typeof p.date === "string" && p.date.length >= 7) months[p.date.slice(0, 7)] = true;
   });
   var options = Object.keys(months)
      .sort()
      .reverse()
      .map(function (m) {
         var label = investorMonthLabel(m + "-01", 0);
         return '<option value="' + m + '"' + (m === month ? " selected" : "") + ">" + label + "</option>";
      })
      .join("");
   var list = purchases
      .filter(function (p) { return typeof p.date === "string" && p.date.slice(0, 7) === month; })
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
   var marked = list.filter(function (p) { return p.investorAgreementId; }).length;
   var usageSlice = investorPageSlice(list, state.investor.usagePage);
   state.investor.usagePage = usageSlice.page;
   var rows = list.length
      ? usageSlice.items
           .map(function (p) {
              return (
                 "<tr>" +
                 '<td><input type="checkbox" aria-label="Dibayar dari dana investasi: ' + investorEsc(p.itemName) + '"' +
                 (p.investorAgreementId ? " checked" : "") +
                 " onchange=\"toggleInvestorPurchase('" + p.id + "', this.checked)\" style=\"width:18px;height:18px;cursor:pointer\"></td>" +
                 "<td>" + investorFmtDate(p.date) + "</td>" +
                 "<td><strong>" + investorEsc(p.itemName) + "</strong></td>" +
                 "<td>" + (p.category ? investorEsc(p.category) : "-") + "</td>" +
                 "<td>" + fmt(p.quantity) + " " + investorEsc(p.unit || "") + "</td>" +
                 '<td style="font-family:monospace;font-weight:600">' + fmtRp(p.totalCost) + "</td>" +
                 "</tr>"
              );
           })
           .join("")
      : '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-shopping-basket"></i><h4>Belum ada belanja di bulan ini</h4><p>Belanja dicatat di menu Belanja Produksi</p></div></td></tr>';

   return (
      '<div class="card" style="height:auto;margin-top:18px">' +
      '<div class="card-header"><div><h3>Penggunaan Dana Investasi</h3>' +
      '<p style="font-size:12px;color:var(--text-muted);margin-top:4px">Centang belanja yang dibayar dari dana investasi. Yang dicentang tampil di portal investor sebagai daftar, tanpa total.</p></div>' +
      '<div style="display:flex;gap:10px;align-items:center">' +
      '<span style="font-size:13px;color:var(--text-muted)">' + marked + " ditandai</span>" +
      '<select class="form-input" style="width:auto;min-width:160px" onchange="onInvestorUsageMonth(this.value)">' + options + "</select>" +
      "</div></div>" +
      '<div class="table-scroll"><table class="data-table">' +
      "<thead><tr><th>Dana investasi</th><th>Tanggal</th><th>Nama Barang</th><th>Kategori</th><th>Qty</th><th>Total</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>" +
      investorTableFooterHTML(usageSlice, list.length, "belanja", "goInvestorUsagePage") +
      "</div>"
   );
}

window.onInvestorUsageMonth = function (month) {
   state.investor.usageMonth = month;
   state.investor.usagePage = 1;
   renderInvestor();
};

// Only the marker fields change, so a closed week stays locked while the admin can still mark what it funded.
window.toggleInvestorPurchase = async function (id, checked) {
   var p = (state.productionPurchases || []).find(function (x) { return x.id === id; });
   if (!p) return;
   try {
      await db.collection("production_purchases").doc(id).update(checked ? investorMarkFields() : investorUnmarkFields());
      toast(checked ? "Ditandai dibayar dana investasi" : "Tanda dana investasi dibatalkan", "success");
      if (checked) warnIfBeforeEffective(p.date);
   } catch (err) {
      console.error("Gagal menandai belanja investor:", err);
      toast("Gagal menyimpan: " + err.message, "error");
      renderInvestor();
   }
};

window.openInvestorEffectiveModal = function () {
   var t = investorTerms();
   var body =
      '<div class="form-group">' +
      "<label>Tanggal Efektif</label>" +
      '<input type="date" class="form-input" id="fInvEffective" value="' + (t.effectiveDate || "") + '">' +
      '<p style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.5">Tanggal Dana Investasi Tahap I diterima penuh. ' +
      "Bulan ke-1 perjanjian adalah bulan setelah bulan Tanggal Efektif. Kosongkan bila perjanjian belum berjalan; portal lalu menampilkan " +
      "&quot;Perjanjian belum aktif&quot;.</p>" +
      "</div>";
   var footer =
      '<button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>' +
      '<button type="button" class="btn btn-primary btn-sm" onclick="saveInvestorEffectiveDate()">Simpan</button>';
   openModal("Tanggal Efektif Perjanjian", body, footer);
};

window.saveInvestorEffectiveDate = async function () {
   var value = ($("#fInvEffective") && $("#fInvEffective").value) || "";
   if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      toast("Format tanggal tidak valid", "warning");
      return;
   }
   var saveBtn = $("#modalFooter .btn-primary");
   saveBtn.disabled = true;
   saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
   try {
      await db.collection("investor_agreement").doc("current").set(
         {
            effectiveDate: value || null,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.currentUser ? auth.currentUser.uid : "",
         },
         { merge: true },
      );
      toast(value ? "Tanggal Efektif disimpan" : "Tanggal Efektif dikosongkan", "success");
      closeModal();
   } catch (err) {
      console.error("Gagal menyimpan Tanggal Efektif:", err);
      toast("Gagal menyimpan: " + err.message, "error");
      saveBtn.disabled = false;
      saveBtn.innerHTML = "Simpan";
   }
};

window.openInvestorPaymentModal = function (docId) {
   var existing = docId
      ? state.investor.payments.find(function (p) { return p.id === docId; })
      : null;
   if (docId && !existing) {
      toast("Data pembayaran tidak ditemukan", "error");
      return;
   }
   var t = investorTerms();
   var v = existing || { kind: "commission", periodMonth: 1, repaymentNumber: 1, amount: t.commission, paidDate: investorLocalToday(), note: "" };
   var repNo = v.repaymentNumber || 1;
   var repOptions = [1, 2, 3]
      .map(function (n) {
         return '<option value="' + n + '"' + (n === repNo ? " selected" : "") + ">Pengembalian ke-" + n + " (bulan ke-" + t.dueMonths[n - 1] + ")</option>";
      })
      .join("");

   var body =
      '<form id="investorPaymentForm" onsubmit="event.preventDefault(); saveInvestorPayment(' + (docId ? "'" + docId + "'" : "null") + ')">' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Jenis</label>' +
      '<select class="form-input" id="fInvKind" onchange="onInvestorKindChange()">' +
      '<option value="commission"' + (v.kind === "commission" ? " selected" : "") + ">Komisi bulanan</option>" +
      '<option value="repayment"' + (v.kind === "repayment" ? " selected" : "") + ">Pengembalian dana investasi</option>" +
      "</select></div>" +
      '<div class="form-group" id="fInvRepNoGroup"' + (v.kind === "repayment" ? "" : ' style="display:none"') + "><label>Pengembalian</label>" +
      '<select class="form-input" id="fInvRepNo" onchange="onInvestorRepNoChange()">' + repOptions + "</select></div>" +
      "</div>" +
      '<div class="form-row">' +
      '<div class="form-group"><label>Bulan ke- (1 sampai ' + t.termMonths + ') <span style="color:var(--danger)">*</span></label>' +
      '<input type="number" class="form-input" id="fInvPeriod" min="1" max="' + t.termMonths + '" step="1" value="' + investorEsc(v.periodMonth) + '"' +
      (v.kind === "repayment" ? " readonly" : "") + ' oninput="onInvestorPeriodInput()">' +
      '<div id="fInvPeriodHint" style="font-size:12px;color:var(--text-muted);margin-top:6px"></div></div>' +
      '<div class="form-group"><label>Nominal (Rp) <span style="color:var(--danger)">*</span></label>' +
      '<input type="number" class="form-input" id="fInvAmount" min="1" step="1" value="' + investorEsc(v.amount == null ? "" : v.amount) + '" style="font-family:monospace"></div>' +
      "</div>" +
      '<div class="form-group"><label>Tanggal Transfer <span style="color:var(--danger)">*</span></label>' +
      '<input type="date" class="form-input" id="fInvPaidDate" value="' + investorEsc(v.paidDate) + '"></div>' +
      '<div class="form-group"><label>Catatan (opsional)</label>' +
      '<input type="text" class="form-input" id="fInvNote" maxlength="300" placeholder="Contoh: dibayar sebagian. Jangan tulis nomor rekening." value="' + investorEsc(v.note) + '"></div>' +
      "</form>";
   var footer =
      '<button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>' +
      '<button type="button" class="btn btn-primary btn-sm" onclick="$(\'#investorPaymentForm\').dispatchEvent(new Event(\'submit\'))">Simpan</button>';
   openModal(existing ? "Ubah Pembayaran" : "Catat Pembayaran", body, footer);
   onInvestorPeriodInput();
};

window.onInvestorKindChange = function () {
   var t = investorTerms();
   var isRepayment = $("#fInvKind").value === "repayment";
   $("#fInvRepNoGroup").style.display = isRepayment ? "" : "none";
   $("#fInvPeriod").readOnly = isRepayment;
   if (isRepayment) onInvestorRepNoChange();
   else {
      $("#fInvAmount").value = t.commission;
      onInvestorPeriodInput();
   }
};

window.onInvestorRepNoChange = function () {
   var t = investorTerms();
   var n = Number($("#fInvRepNo").value);
   $("#fInvPeriod").value = t.dueMonths[n - 1];
   var amount = t.repaymentAmounts[n - 1];
   $("#fInvAmount").value = amount == null ? "" : amount;
   onInvestorPeriodInput();
};

window.onInvestorPeriodInput = function () {
   var hint = $("#fInvPeriodHint");
   if (!hint) return;
   var t = investorTerms();
   var n = Number($("#fInvPeriod").value);
   var label = Number.isInteger(n) && n >= 1 ? investorMonthLabel(t.effectiveDate, n) : "";
   hint.textContent = t.effectiveDate ? (label ? "Jatuh tempo 25 sampai 26 " + label : "") : "Tanggal Efektif belum diisi";
};

window.saveInvestorPayment = async function (docId) {
   var t = investorTerms();
   var kind = $("#fInvKind").value;
   var periodMonth = Number($("#fInvPeriod").value);
   var repaymentNumber = kind === "repayment" ? Number($("#fInvRepNo").value) : null;
   var amount = Number($("#fInvAmount").value);
   var paidDate = $("#fInvPaidDate").value;
   var note = $("#fInvNote").value.trim();

   if (kind !== "commission" && kind !== "repayment") return toast("Pilih jenis pembayaran", "warning");
   if (!Number.isInteger(periodMonth) || periodMonth < 1 || periodMonth > t.termMonths)
      return toast("Bulan ke- harus 1 sampai " + t.termMonths, "warning");
   if (kind === "repayment" && [1, 2, 3].indexOf(repaymentNumber) === -1) return toast("Pilih pengembalian ke-1, 2, atau 3", "warning");
   if (!Number.isSafeInteger(amount) || amount <= 0) return toast("Nominal harus angka Rupiah bulat lebih dari 0", "warning");
   if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) return toast("Tanggal transfer wajib diisi", "warning");

   // The portal adds up every record of the same month (or the same repayment), so a second record would double the amount.
   var duplicate = state.investor.payments.find(function (p) {
      if (p.id === docId || p.kind !== kind) return false;
      return kind === "repayment" ? p.repaymentNumber === repaymentNumber : p.periodMonth === periodMonth;
   });
   if (duplicate) {
      return toast(
         (kind === "repayment" ? "Pengembalian ke-" + repaymentNumber : "Komisi bulan ke-" + periodMonth) +
            " sudah tercatat. Ubah catatan yang ada bila nominalnya berubah.",
         "warning",
      );
   }

   var uid = auth.currentUser ? auth.currentUser.uid : "";
   var now = new Date().toISOString();
   var data = { kind: kind, periodMonth: periodMonth, amount: amount, paidDate: paidDate };
   var deleteField = firebase.firestore.FieldValue.delete();

   var saveBtn = $("#modalFooter .btn-primary");
   saveBtn.disabled = true;
   saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
   try {
      if (docId) {
         data.repaymentNumber = repaymentNumber || deleteField;
         data.note = note || deleteField;
         data.updatedAt = now;
         data.updatedBy = uid;
         await db.collection("investor_payments").doc(docId).update(data);
         toast("Pembayaran diperbarui", "success");
      } else {
         if (repaymentNumber) data.repaymentNumber = repaymentNumber;
         if (note) data.note = note;
         data.recordedAt = now;
         data.recordedBy = uid;
         await db.collection("investor_payments").add(data);
         toast("Pembayaran dicatat", "success");
      }
      closeModal();
   } catch (err) {
      console.error("Gagal menyimpan pembayaran investor:", err);
      toast("Gagal menyimpan: " + err.message, "error");
      saveBtn.disabled = false;
      saveBtn.innerHTML = "Simpan";
   }
};

window.confirmDeleteInvestorPayment = function (docId) {
   var p = state.investor.payments.find(function (x) { return x.id === docId; });
   if (!p) return;
   var label = p.kind === "repayment" ? "pengembalian ke-" + p.repaymentNumber : "Komisi bulan ke-" + p.periodMonth;
   var body =
      "<p>Hapus catatan " + label + " sebesar <strong>" + fmtRp(p.amount) + "</strong> (" + investorFmtDate(p.paidDate) + ")?</p>" +
      '<p style="font-size:13px;color:var(--text-muted);margin-top:8px">Portal investor langsung menampilkan pembayaran ini sebagai belum dibayar.</p>';
   var footer =
      '<button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Batal</button>' +
      '<button type="button" class="btn btn-danger btn-sm" onclick="deleteInvestorPayment(\'' + docId + "')\">Hapus</button>";
   openModal("Hapus Pembayaran", body, footer);
};

window.deleteInvestorPayment = async function (docId) {
   try {
      await db.collection("investor_payments").doc(docId).delete();
      toast("Catatan pembayaran dihapus", "success");
      closeModal();
   } catch (err) {
      console.error("Gagal menghapus pembayaran investor:", err);
      toast("Gagal menghapus: " + err.message, "error");
   }
};

/* =========================================================
   RESELLER ANALYTICS & DASHBOARD
   ========================================================= */
window.renderResellerAnalytics = function (list) {
   var container = $("#resellerAnalyticsContainer");
   if (!container) return;

   var channel = state.sale.channel;
   if (channel !== "Reseller") {
      container.style.display = "none";
      return;
   }

   container.style.display = "block";

   if (!list || list.length === 0) {
      container.innerHTML =
         '<div class="card" style="padding: 24px; text-align: center; border: 1px dashed var(--border); border-radius: var(--radius-md);">' +
         '<i class="fas fa-chart-line" style="font-size: 32px; color: var(--text-muted); margin-bottom: 12px;"></i>' +
         '<h4 style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">Belum ada data reseller yang dapat dianalisis</h4>' +
         '<p style="font-size: 13px; color: var(--text-muted); margin: 0;">Silakan tambahkan transaksi reseller terlebih dahulu.</p>' +
         '</div>';
      return;
   }

   var resellerIdFilter = state.sale.resellerId || "all";

   if (resellerIdFilter !== "all") {
      // 1. Reseller Summary Cards (Specific Reseller selected)
      var totalTx = list.length;
      var totalQty = 0;
      var totalRev = 0;
      var totalProf = 0;
      list.forEach(function (s) {
         totalQty += Number(s.quantity || 0);
         totalRev += s.realRevenue !== undefined ? s.realRevenue : s.revenue || 0;
         totalProf += s.realProfit !== undefined ? s.realProfit : s.profit || 0;
      });

      var selectedResellerObj = state.resellers.find(function (r) { return r.id === resellerIdFilter; });
      var resellerName = selectedResellerObj ? selectedResellerObj.name : "Reseller";

      container.innerHTML =
         '<div style="margin-bottom:12px;"><h4 style="font-size:14px;font-weight:700;color:var(--text-main);"><i class="fas fa-user-tag" style="margin-right:6px;color:var(--primary);"></i>Performa: ' + resellerName + '</h4></div>' +
         '<div class="stat-grid" style="margin-bottom: 0;">' +
         '<div class="stat-card green">' +
         '<div class="sc-top"><div class="sc-icon"><i class="fas fa-shopping-bag"></i></div><span class="sc-label">Total Transaksi</span></div>' +
         '<div class="sc-value">' + fmt(totalTx) + '</div>' +
         '<div class="sc-sub">transaksi penjualan</div>' +
         '</div>' +
         '<div class="stat-card gold">' +
         '<div class="sc-top"><div class="sc-icon"><i class="fas fa-boxes-stacked"></i></div><span class="sc-label">Total Quantity</span></div>' +
         '<div class="sc-value">' + fmt(totalQty) + '</div>' +
         '<div class="sc-sub">produk terjual</div>' +
         '</div>' +
         '<div class="stat-card blue" style="background:var(--primary-light); color:var(--primary-dark);">' +
         '<div class="sc-top"><div class="sc-icon" style="background:var(--white); color:var(--primary);"><i class="fas fa-coins"></i></div><span class="sc-label" style="color:var(--text-muted);">Total Revenue</span></div>' +
         '<div class="sc-value" style="color:var(--primary-dark);">' + fmtRp(totalRev) + '</div>' +
         '<div class="sc-sub" style="color:var(--text-muted);">total pendapatan kotor</div>' +
         '</div>' +
         '<div class="stat-card green" style="background:#E6F4EA; color:#137333;">' +
         '<div class="sc-top"><div class="sc-icon" style="background:var(--white); color:#137333;"><i class="fas fa-chart-line"></i></div><span class="sc-label" style="color:var(--text-muted);">Total Profit</span></div>' +
         '<div class="sc-value" style="color:#137333;">' + fmtRp(totalProf) + '</div>' +
         '<div class="sc-sub" style="color:var(--text-muted);">keuntungan bersih</div>' +
         '</div>' +
         '</div>';
   } else {
      // 2. Overall Reseller Statistics (Semua Reseller selected)
      var activeResellersCount = (state.resellers || []).filter(function (r) { return r.status === "active"; }).length;
      
      var overallTx = list.length;
      var overallQty = 0;
      var overallRev = 0;
      var overallProf = 0;
      
      var resellerData = {};
      list.forEach(function (s) {
         var rId = s.resellerId || "unknown";
         var rName = s.resellerName || "Tanpa Nama";
         
         overallQty += Number(s.quantity || 0);
         var displayRev = s.realRevenue !== undefined ? s.realRevenue : s.revenue || 0;
         var displayProf = s.realProfit !== undefined ? s.realProfit : s.profit || 0;
         overallRev += displayRev;
         overallProf += displayProf;
         
         if (!resellerData[rId]) {
            resellerData[rId] = {
               id: rId,
               name: rName,
               transactions: 0,
               qty: 0,
               revenue: 0,
               profit: 0
            };
         }
         resellerData[rId].transactions += 1;
         resellerData[rId].qty += Number(s.quantity || 0);
         resellerData[rId].revenue += displayRev;
         resellerData[rId].profit += displayProf;
      });

      var resellerList = Object.values(resellerData);

      var topRevenue = [...resellerList].sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, 5);
      var topProfit = [...resellerList].sort(function (a, b) { return b.profit - a.profit; }).slice(0, 5);
      var topTransactions = [...resellerList].sort(function (a, b) { return b.transactions - a.transactions; }).slice(0, 5);

      var distributionList = [...resellerList].sort(function (a, b) { return b.revenue - a.revenue; });

      var rankingWidget = function (title, icon, listData, formatter) {
         var itemsHtml = listData.length
            ? listData.map(function (item, idx) {
                 return (
                    '<li style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border)">' +
                    '<span><span style="font-weight:700; color:var(--primary); margin-right:8px">#' + (idx + 1) + '</span>' + item.name + '</span>' +
                    '<strong style="color:var(--text-main)">' + formatter(item) + '</strong>' +
                    '</li>'
                 );
              }).join("")
            : '<li style="padding:8px 0; color:var(--text-muted); font-size:12px; text-align:center;">Tidak ada data</li>';

         return (
            '<div class="card" style="flex: 1; min-width: 260px; margin-bottom: 0;">' +
            '<div class="card-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px;">' +
            '<i class="' + icon + '" style="color: var(--primary);"></i>' +
            '<h4 style="font-size: 13px; font-weight: 700; color: var(--text-main); margin: 0;">' + title + '</h4>' +
            '</div>' +
            '<div class="card-body" style="padding: 12px 16px;">' +
            '<ul style="list-style: none; padding: 0; margin: 0; font-size: 13px;">' +
            itemsHtml +
            '</ul>' +
            '</div>' +
            '</div>'
         );
      };

      var distributionRows = distributionList.length
         ? distributionList.map(function (row) {
              return (
                 '<tr>' +
                 '<td><strong>' + row.name + '</strong></td>' +
                 '<td style="text-align:center;">' + fmt(row.transactions) + '</td>' +
                 '<td style="text-align:center;">' + fmt(row.qty) + '</td>' +
                 '<td style="text-align:right;font-weight:600;">' + fmtRp(row.revenue) + '</td>' +
                 '<td style="text-align:right;color:var(--success);font-weight:600;">' + fmtRp(row.profit) + '</td>' +
                 '</tr>'
              );
           }).join("")
         : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);">Tidak ada data reseller</td></tr>';

      container.innerHTML =
         '<div class="stat-grid" style="margin-bottom: 16px;">' +
         '<div class="stat-card maroon">' +
         '<div class="sc-top"><div class="sc-icon"><i class="fas fa-users"></i></div><span class="sc-label">Reseller Aktif</span></div>' +
         '<div class="sc-value">' + fmt(activeResellersCount) + '</div>' +
         '<div class="sc-sub">reseller berstatus aktif</div>' +
         '</div>' +
         '<div class="stat-card green">' +
         '<div class="sc-top"><div class="sc-icon"><i class="fas fa-shopping-bag"></i></div><span class="sc-label">Total Transaksi</span></div>' +
         '<div class="sc-value">' + fmt(overallTx) + '</div>' +
         '<div class="sc-sub">transaksi dari semua reseller</div>' +
         '</div>' +
         '<div class="stat-card blue" style="background:var(--primary-light); color:var(--primary-dark);">' +
         '<div class="sc-top"><div class="sc-icon" style="background:var(--white); color:var(--primary);"><i class="fas fa-coins"></i></div><span class="sc-label" style="color:var(--text-muted);">Total Revenue</span></div>' +
         '<div class="sc-value" style="color:var(--primary-dark);">' + fmtRp(overallRev) + '</div>' +
         '<div class="sc-sub" style="color:var(--text-muted);">pendapatan semua reseller</div>' +
         '</div>' +
         '<div class="stat-card green" style="background:#E6F4EA; color:#137333;">' +
         '<div class="sc-top"><div class="sc-icon" style="background:var(--white); color:#137333;"><i class="fas fa-chart-line"></i></div><span class="sc-label" style="color:var(--text-muted);">Total Profit</span></div>' +
         '<div class="sc-value" style="color:#137333;">' + fmtRp(overallProf) + '</div>' +
         '<div class="sc-sub" style="color:var(--text-muted);">keuntungan bersih semua reseller</div>' +
         '</div>' +
         '</div>' +

         '<div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:16px;">' +
         rankingWidget("Top 5 Revenue", "fas fa-trophy", topRevenue, function (i) { return fmtRp(i.revenue); }) +
         rankingWidget("Top 5 Profit", "fas fa-chart-line", topProfit, function (i) { return "Profit " + fmtRp(i.profit); }) +
         rankingWidget("Top 5 Transaksi", "fas fa-shopping-bag", topTransactions, function (i) { return fmt(i.transactions) + " transaksi"; }) +
         '</div>' +

         '<div class="card" style="margin-bottom:0;">' +
         '<div class="card-header" style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px;">' +
         '<i class="fas fa-table" style="color: var(--primary);"></i>' +
         '<h4 style="font-size: 13px; font-weight: 700; color: var(--text-main); margin: 0;">Performance Distribution</h4>' +
         '</div>' +
         '<div class="table-scroll">' +
         '<table class="data-table" style="font-size:13px;">' +
         '<thead>' +
         '<tr>' +
         '<th>Nama Reseller</th>' +
         '<th style="text-align:center;width:120px;">Total Transaksi</th>' +
         '<th style="text-align:center;width:100px;">Total Qty</th>' +
         '<th style="text-align:right;width:180px;">Revenue</th>' +
         '<th style="text-align:right;width:180px;">Profit</th>' +
         '</tr>' +
         '</thead>' +
         '<tbody>' +
         distributionRows +
         '</tbody>' +
         '</table>' +
         '</div>' +
         '</div>';
   }
};

showAuthLoading();

auth.onAuthStateChanged(async (user) => {
   if (!user) {
      if (appInitialized) {
         cleanupAppSession();
      }
      showLoginScreen();
      if (logoutToastPending) {
         toast("Berhasil keluar", "success");
         logoutToastPending = false;
      }
      return;
   }

   // enterApp() sudah punya guard if (appInitialized) return — aman dipanggil ulang
   if (!appInitialized) showAuthLoading();
   try {
      const profile = await loadUserProfile(user);
      state.user = profile;
      if (appInitialized) {
         updateUserDisplay(state.user);
      } else {
         enterApp();
      }
   } catch (err) {
      console.error("auth state profile error:", err);
      cleanupAppSession();
      showLoginScreen();
      toast(err.message || "Gagal memuat profil user", "error");
   }
});
