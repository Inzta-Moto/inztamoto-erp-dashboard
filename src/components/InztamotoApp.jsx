"use client";

import { useEffect, useState } from "react";
import LegacyScripts from "./LegacyScripts";

export default function InztamotoApp() {
   const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
   const [canInstall, setCanInstall] = useState(false);

   useEffect(() => {
      if (typeof window === "undefined") return;

      if (
         "serviceWorker" in navigator &&
         process.env.NODE_ENV === "production"
      ) {
         navigator.serviceWorker.register("/sw.js").catch((error) => {
            console.error(
               "[INZTAMOTO PWA] Service worker registration failed:",
               error,
            );
         });
      }

      const isStandalone =
         window.matchMedia("(display-mode: standalone)").matches ||
         window.navigator.standalone === true;

      if (isStandalone) return;

      const handleBeforeInstallPrompt = (event) => {
         event.preventDefault();
         setDeferredInstallPrompt(event);
         setCanInstall(true);
      };

      const handleAppInstalled = () => {
         setDeferredInstallPrompt(null);
         setCanInstall(false);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
         window.removeEventListener(
            "beforeinstallprompt",
            handleBeforeInstallPrompt,
         );
         window.removeEventListener("appinstalled", handleAppInstalled);
      };
   }, []);

   const handleInstallClick = async () => {
      if (!deferredInstallPrompt) return;

      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      setCanInstall(false);
   };

   return (
      <>
         {/* ==================== AUTH LOADING ==================== */}
         <div id="authLoading">
            <div className="auth-loading-card">
               <div className="logo-wrap login-logo-icon">
                  <img
                     src="/logo.png"
                     alt="InztaMoto"
                     className="logo-img"
                     onError={(e) => {
                        e.currentTarget.style.display = "none";
                        if (e.currentTarget.nextElementSibling) {
                           e.currentTarget.nextElementSibling.style.display =
                              "flex";
                        }
                     }}
                  />
                  <span className="logo-text">INZ</span>
               </div>
               <span className="auth-spinner" aria-hidden="true"></span>
               <p>Memeriksa sesi...</p>
            </div>
         </div>

         {/* ==================== LOGIN ==================== */}
         <div id="loginPage" style={{ display: "none" }}>
            <div className="login-blob b1"></div>
            <div className="login-blob b2"></div>
            <div className="login-blob b3"></div>
            <div className="login-card">
               <div className="login-logo">
                  <div className="logo-wrap login-logo-icon">
                     <img
                        src="/logo.png"
                        alt="InztaMoto"
                        className="logo-img"
                        onError={(e) => {
                           e.currentTarget.style.display = "none";
                           if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display =
                                 "flex";
                           }
                        }}
                     />
                     <span className="logo-text">INZ</span>
                  </div>
                  <h1>INZTAMOTO</h1>
                  <p>Sistem Manajemen Produksi &amp; Penjualan</p>
               </div>
               <form id="loginForm">
                  <div className="form-group">
                     <label>Alamat Email</label>
                     <input
                        type="email"
                        className="form-input"
                        id="loginEmail"
                        placeholder="user@domain.com"
                        required
                     />
                  </div>
                  <div className="form-group">
                     <label>Kata Sandi</label>
                     <input
                        type="text"
                        className="form-input"
                        id="loginPassword"
                        placeholder="Masukkan kata sandi"
                        autoComplete="off"
                        required
                     />
                  </div>
                  <button
                     type="submit"
                     className="btn btn-primary btn-full"
                     id="loginBtn"
                  >
                     <span>Masuk ke Sistem</span>{" "}
                     <i className="fas fa-arrow-right"></i>
                  </button>
               </form>
               {canInstall && (
                  <button
                     type="button"
                     className="btn btn-outline btn-full pwa-install-btn"
                     onClick={handleInstallClick}
                  >
                     <i className="fas fa-download"></i>Install App
                  </button>
               )}
            </div>
         </div>

         {/* ==================== APP SHELL ==================== */}
         <div id="appShell" style={{ display: "none" }}>
            <div className="sidebar-overlay" id="sidebarOverlay"></div>

            <aside className="sidebar" id="sidebar">
               <div className="sidebar-header">
                  <div className="logo-wrap sidebar-logo-icon">
                     <img
                        src="/logo-mtg.png"
                        alt="InztaMoto"
                        className="logo-img"
                        onError={(e) => {
                           e.currentTarget.style.display = "none";
                           if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display =
                                 "flex";
                           }
                        }}
                     />
                     <span className="logo-text">INZ</span>
                  </div>
                  <div className="s-text">
                     <h2>INZTAMOTO</h2>
                     <span>Statistical Analysis System</span>
                  </div>
               </div>
               <nav className="sidebar-nav">
                  <div className="nav-label">Menu Utama</div>
                  <a href="#" className="nav-item active" data-page="dashboard">
                     <i className="fas fa-chart-line"></i>Dashboard
                  </a>
                  <a href="#" className="nav-item" data-page="penjualan">
                     <i className="fas fa-receipt"></i>Penjualan
                  </a>
                  <a href="#" className="nav-item" data-page="produk">
                     <i className="fas fa-box"></i>Produk
                  </a>
                  <a href="#" className="nav-item" data-page="kategori">
                     <i className="fas fa-tags"></i>Kategori
                  </a>
                  <a href="#" className="nav-item" data-page="reseller" id="menuReseller">
                     <i className="fas fa-user-tag"></i>Reseller
                  </a>
                  <a href="#" className="nav-item" data-page="produksi">
                     <i className="fas fa-industry"></i>Produksi
                  </a>
                  <a href="#" className="nav-item" data-page="belanjaProduksi">
                     <i className="fas fa-shopping-basket"></i>Belanja Produksi
                  </a>
                  <a
                     href="#"
                     className="nav-item"
                     data-page="gajiKaryawan"
                     id="menuTeamSalary"
                  >
                     <i className="fas fa-money-bill-wave"></i>Team Salary
                  </a>
                  <a
                     href="#"
                     className="nav-item"
                     data-page="salaryProduksi"
                     id="menuSalaryProduksi"
                  >
                     <i className="fas fa-money-check-dollar"></i>Salary
                     Produksi
                  </a>
                  <a
                     href="#"
                     className="nav-item"
                     data-page="sponsorship"
                     id="menuSponsorship"
                  >
                     <i className="fas fa-handshake-angle"></i>Support
                     Sponsorship
                  </a>
                  <a href="#" className="nav-item" data-page="inventaris">
                     <i className="fas fa-boxes-stacked"></i>Stock Control
                     <span
                        className="badge-dot"
                        id="criticalDot"
                        style={{ display: "none" }}
                     ></span>
                  </a>
                  <a href="#" className="nav-item" data-page="laporan">
                     <i className="fas fa-file-lines"></i>Laporan
                  </a>
                  <div className="nav-label">Sistem</div>
                  <a href="#" className="nav-item" data-page="pengguna">
                     <i className="fas fa-users"></i>Pengguna
                  </a>
                  <a href="#" className="nav-item" data-page="pengaturan">
                     <i className="fas fa-gear"></i>Pengaturan
                  </a>
               </nav>
               <div className="sidebar-footer">
                  <div className="sidebar-user">
                     <div className="avatar" id="userAvatar">
                        A
                     </div>
                     <div className="u-info">
                        <div className="name" id="userName">
                           Admin
                        </div>
                        <div className="role" id="userRole">
                           Owner
                        </div>
                     </div>
                     <button
                        className="logout-btn"
                        id="logoutBtn"
                        title="Keluar"
                     >
                        <i className="fas fa-right-from-bracket"></i>
                     </button>
                  </div>
               </div>
            </aside>

            <div className="main">
               <header className="topbar">
                  <div className="topbar-left">
                     <button className="hamburger" id="hamburgerBtn">
                        <i className="fas fa-bars"></i>
                     </button>
                     <h1 id="pageTitle">Dashboard</h1>
                  </div>
                  <div className="topbar-right">
                     <div className="topbar-search">
                        <i className="fas fa-search"></i>
                        <input
                           type="text"
                           placeholder="Cari produk, SKU..."
                           id="globalSearch"
                        />
                     </div>
                     <button className="topbar-icon" id="notifBtn">
                        <i className="fas fa-bell"></i>
                        <span
                           className="notif-dot"
                           id="notifDot"
                           style={{ display: "none" }}
                        ></span>
                     </button>
                  </div>
               </header>

               <div className="content">
                  {/* Dashboard */}
                  <div className="page active" id="pageDashboard">
                     <div className="stat-grid" id="dashStats"></div>
                     <div id="dashAlerts"></div>
                     <div className="grid-2">
                        <div className="card">
                           <div className="card-header">
                              <h3>Tren Penjualan</h3>
                              <div className="chart-header-actions">
                                 <div
                                    id="salesTrendFilters"
                                    className="chart-trend-filters"
                                 ></div>
                                 <div
                                    className="chart-tabs"
                                    id="salesTrendTabs"
                                 >
                                    <button
                                       className="chart-tab active"
                                       data-range="daily"
                                    >
                                       Harian
                                    </button>
                                    <button
                                       className="chart-tab"
                                       data-range="weekly"
                                    >
                                       Mingguan
                                    </button>
                                    <button
                                       className="chart-tab"
                                       data-range="monthly"
                                    >
                                       Bulanan
                                    </button>
                                 </div>
                              </div>
                           </div>
                           <div className="card-body">
                              <div className="chart-wrap">
                                 <canvas id="chartSalesTrend"></canvas>
                              </div>
                           </div>
                        </div>
                        <div className="card">
                           <div className="card-header">
                              <h3>Distribusi Channel</h3>
                           </div>
                           <div className="card-body">
                              <div className="chart-wrap">
                                 <canvas id="chartChannel"></canvas>
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="grid-2">
                        <div className="card">
                           <div className="card-header">
                              <h3>Pendapatan vs Biaya</h3>
                              <div className="chart-header-actions">
                                 <div
                                    id="revCostTrendFilters"
                                    className="chart-trend-filters"
                                 ></div>
                                 <div
                                    className="chart-tabs"
                                    id="revCostTrendTabs"
                                 >
                                    <button
                                       className="chart-tab"
                                       data-range="daily"
                                    >
                                       Harian
                                    </button>
                                    <button
                                       className="chart-tab"
                                       data-range="weekly"
                                    >
                                       Mingguan
                                    </button>
                                    <button
                                       className="chart-tab active"
                                       data-range="monthly"
                                    >
                                       Bulanan
                                    </button>
                                 </div>
                              </div>
                           </div>
                           <div className="card-body">
                              <div className="chart-wrap">
                                 <canvas id="chartRevenueCost"></canvas>
                              </div>
                           </div>
                        </div>
                        <div className="card">
                           <div className="card-header">
                              <h3>Tren Produksi</h3>
                              <div className="chart-header-actions">
                                 <div
                                    id="productionTrendFilters"
                                    className="chart-trend-filters"
                                 ></div>
                                 <div
                                    className="chart-tabs"
                                    id="productionTrendTabs"
                                 >
                                    <button
                                       className="chart-tab"
                                       data-range="daily"
                                    >
                                       Harian
                                    </button>
                                    <button
                                       className="chart-tab"
                                       data-range="weekly"
                                    >
                                       Mingguan
                                    </button>
                                    <button
                                       className="chart-tab active"
                                       data-range="monthly"
                                    >
                                       Bulanan
                                    </button>
                                 </div>
                              </div>
                           </div>
                           <div className="card-body">
                              <div className="chart-wrap">
                                 <canvas id="chartProduction"></canvas>
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="grid-3">
                        <div className="card">
                           <div className="card-header">
                              <h3>Produk Terlaris</h3>
                           </div>
                           <div className="card-body" id="topSellingList"></div>
                        </div>
                        <div className="card">
                           <div className="card-header">
                              <h3>Kategori Terlaris</h3>
                           </div>
                           <div className="card-body">
                              <div
                                 className="chart-wrap"
                                 style={{ maxHeight: "260px" }}
                              >
                                 <canvas id="chartCategory"></canvas>
                              </div>
                           </div>
                        </div>
                        <div className="card">
                           <div className="card-header">
                              <h3>Progress Produksi Hari Ini</h3>
                           </div>
                           <div
                              className="card-body"
                              id="prodProgressList"
                           ></div>
                        </div>
                     </div>
                  </div>

                  {/* Produk */}
                  <div className="page" id="pageProduk">
                     <div className="card">
                        <div className="table-toolbar">
                           <div className="table-search">
                              <i className="fas fa-search"></i>
                              <input
                                 type="text"
                                 placeholder="Cari SKU atau nama..."
                                 id="prodSearch"
                              />
                           </div>
                           <div className="table-filter">
                              <select id="prodFilter">
                                 <option value="all">Semua Status</option>
                                 <option value="active">Aktif</option>
                                 <option value="in_production">
                                    Dalam Produksi
                                 </option>
                                 <option value="pre_order">Pre Order</option>
                                 <option value="low_stock">Stok Rendah</option>
                                 <option value="out_of_stock">Habis</option>
                                 <option value="inactive">Nonaktif</option>
                              </select>
                           </div>
                           <div className="table-filter">
                              <select id="prodCatFilter">
                                 <option value="all">Semua Kategori</option>
                              </select>
                           </div>
                           <div
                              style={{
                                 marginLeft: "auto",
                                 display: "flex",
                                 gap: "8px",
                              }}
                           >
                              <button
                                 className="btn btn-outline btn-sm"
                                 id="exportProdBtn"
                              >
                                 <i className="fas fa-download"></i>Export
                              </button>
                              <button
                                 className="btn btn-primary btn-sm"
                                 id="addProdBtn"
                              >
                                 <i className="fas fa-plus"></i>Tambah Produk
                              </button>
                           </div>
                        </div>
                        <div className="table-scroll">
                           <table className="data-table" id="prodTable">
                              <thead>
                                 <tr>
                                    <th>Gambar</th>
                                    <th data-sort="name">
                                       Produk{" "}
                                       <i className="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th data-sort="sku">
                                       SKU{" "}
                                       <i className="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th data-sort="costPrice">
                                       Harga Modal{" "}
                                       <i className="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th data-sort="sellingPrice">
                                       Harga Jual{" "}
                                       <i className="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th data-sort="profit">
                                       Keuntungan{" "}
                                       <i className="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th data-sort="margin">
                                       Margin{" "}
                                       <i className="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th data-sort="stock">
                                       Stok{" "}
                                       <i className="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                 </tr>
                              </thead>
                              <tbody id="prodBody"></tbody>
                           </table>
                        </div>
                        <div className="table-footer">
                           <span id="prodInfo">Menampilkan 0 produk</span>
                           <div
                              className="pagination"
                              id="prodPagination"
                           ></div>
                        </div>
                     </div>
                  </div>

                  {/* Kategori */}
                  <div className="page" id="pageKategori">
                     <div className="cat-toolbar">
                        <h3 style={{ fontSize: "16px", fontWeight: "700" }}>
                           Daftar Kategori
                        </h3>
                        <button
                           className="btn btn-primary btn-sm"
                           id="addCatBtn"
                        >
                           <i className="fas fa-plus"></i>Tambah Kategori
                        </button>
                     </div>
                     <div className="cat-accordion" id="catAccordion"></div>
                  </div>

                  {/* Produksi */}
                  <div className="page" id="pageProduksi">
                     <div
                        className="stat-grid"
                        style={{
                           gridTemplateColumns: "repeat(3,1fr)",
                           marginBottom: "20px",
                        }}
                        id="prodStats"
                     ></div>
                     <div className="card">
                        <div className="table-toolbar">
                           <div className="table-search">
                              <i className="fas fa-search"></i>
                              <input
                                 type="text"
                                 placeholder="Cari..."
                                 id="prodProdSearch"
                              />
                           </div>
                           <div className="table-filter">
                              <select id="prodStatusFilter">
                                 <option value="all">Semua Status</option>
                                 <option value="pending">Pending</option>
                                 <option value="in_progress">
                                    Dalam Proses
                                 </option>
                                 <option value="qc">Quality Control</option>
                                 <option value="completed">Selesai</option>
                              </select>
                           </div>
                           <div className="table-filter">
                              <input
                                 type="date"
                                 className="form-input"
                                 id="prodDateFilter"
                                 style={{
                                    fontSize: "13px",
                                    padding: "8px 12px",
                                 }}
                                 title="Filter tanggal produksi"
                              />
                           </div>
                           <div
                              className="responsive-action-group"
                              style={{
                                 marginLeft: "auto",
                                 display: "flex",
                                 gap: "8px",
                              }}
                           >
                              <button
                                 className="btn btn-outline btn-sm"
                                 id="clearProdDateBtn"
                                 title="Tampilkan semua tanggal"
                              >
                                 <i className="fas fa-calendar-xmark"></i>Semua
                                 Tanggal
                              </button>
                              <button
                                 className="btn btn-primary btn-sm"
                                 id="addProdOrderBtn"
                              >
                                 <i className="fas fa-plus"></i>Tambah Produksi
                              </button>
                           </div>
                        </div>
                        <div className="table-scroll">
                           <table className="data-table">
                              <thead>
                                 <tr>
                                    <th>Gambar</th>
                                    <th>Produk</th>
                                    <th>SKU</th>
                                    <th>Target</th>
                                    <th>Selesai</th>
                                    <th>Progress</th>
                                    <th>Tanggal</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                 </tr>
                              </thead>
                              <tbody id="prodOrderBody"></tbody>
                           </table>
                        </div>
                        <div className="table-footer">
                           <span id="prodOrderInfo"></span>
                           <div className="pagination" id="prodOrderPag"></div>
                        </div>
                     </div>
                  </div>

                  {/* Belanja Produksi */}
                  <div className="page" id="pageBelanjaProduksi">
                     {/* Rendered dynamically by renderBelanjaProduksi() in app-runtime.js */}
                  </div>

                  {/* Gaji Karyawan */}
                  <div className="page" id="pageGajiKaryawan">
                     {/* Rendered dynamically by renderPayrolls() in app-runtime.js */}
                  </div>

                  {/* Salary Produksi */}
                  <div className="page" id="pageSalaryProduksi">
                     {/* Rendered dynamically by renderSalaryProduksi() in app-runtime.js */}
                  </div>

                  {/* Support Sponsorship */}
                  <div className="page" id="pageSponsorship">
                     {/* Rendered dynamically by renderSponsorship() in app-runtime.js */}
                  </div>

                  {/* Reseller Management */}
                  <div className="page" id="pageReseller">
                     {/* Rendered dynamically by renderResellers() in app-runtime.js */}
                  </div>

                  {/* Inventaris */}
                  <div className="page" id="pageInventaris">
                     <div
                        style={{
                           display: "flex",
                           gap: "10px",
                           marginBottom: "18px",
                           flexWrap: "wrap",
                        }}
                     >
                        <button
                           className="btn btn-primary btn-sm"
                           id="stockInBtn"
                        >
                           <i className="fas fa-arrow-down"></i>Stok Masuk
                        </button>
                        <button
                           className="btn btn-accent btn-sm"
                           id="stockOutBtn"
                        >
                           <i className="fas fa-arrow-up"></i>Stok Keluar
                        </button>
                        <button
                           className="btn btn-outline btn-sm"
                           id="stockAdjBtn"
                        >
                           <i className="fas fa-sliders"></i>Penyesuaian
                        </button>
                     </div>
                     <div className="card">
                        <div className="table-toolbar">
                           <div className="table-search">
                              <i className="fas fa-search"></i>
                              <input
                                 type="text"
                                 placeholder="Cari SKU atau produk..."
                                 id="invSearch"
                              />
                           </div>
                           <div className="table-filter">
                              <select id="invFilter">
                                 <option value="all">Semua</option>
                                 <option value="safe">Aman</option>
                                 <option value="low">Stok Rendah</option>
                                 <option value="out">Habis</option>
                              </select>
                           </div>
                        </div>
                        <div className="table-scroll">
                           <table className="data-table">
                              <thead>
                                 <tr>
                                    <th>Gambar</th>
                                    <th>SKU</th>
                                    <th>Produk</th>
                                    <th>Stok Awal</th>
                                    <th>Masuk</th>
                                    <th>Keluar</th>
                                    <th>Stok Saat Ini</th>
                                    <th>Status</th>
                                 </tr>
                              </thead>
                              <tbody id="invBody"></tbody>
                           </table>
                        </div>
                        <div className="table-footer">
                           <span id="invInfo"></span>
                        </div>
                     </div>
                     <div className="card" style={{ marginTop: "18px" }}>
                        <div className="card-header">
                           <h3>Riwayat Pergerakan Stok</h3>
                        </div>
                        <div id="invHistoryCard">
                           {/* Rendered dynamically by renderStockHistory() — includes toolbar, table, and pagination */}
                        </div>
                     </div>
                  </div>

                  {/* Penjualan */}
                  <div className="page" id="pagePenjualan">
                     <div
                        style={{
                           display: "flex",
                           gap: "10px",
                           marginBottom: "18px",
                           flexWrap: "wrap",
                        }}
                     >
                        <button
                           className="btn btn-primary btn-sm"
                           id="addSaleBtn"
                        >
                           <i className="fas fa-plus"></i>Catat Penjualan
                        </button>
                        <button
                           className="btn btn-outline btn-sm"
                           id="exportSaleBtn"
                        >
                           <i className="fas fa-download"></i>Export Excel
                        </button>
                     </div>
                     <div id="resellerAnalyticsContainer" style={{ display: "none", marginBottom: "18px" }}></div>
                     {/* Daily Performance Tracking Cards */}
                     <div className="stat-grid" id="dailySalesStats" style={{ marginBottom: "20px" }}></div>
                     <div className="card">
                        <div className="table-toolbar">
                           <div className="table-search">
                              <i className="fas fa-search"></i>
                              <input
                                 type="text"
                                 placeholder="Cari transaksi..."
                                 id="saleSearch"
                              />
                           </div>
                           <div className="table-filter">
                              <select id="saleChannelFilter">
                                 <option value="all">Semua Channel</option>
                                 <option value="Website">Website</option>
                                 <option value="Shopee">Shopee</option>
                                 <option value="Tokopedia">Tokopedia</option>
                                 <option value="Reseller">Reseller</option>
                                 <option value="Offline Store">
                                    Offline Store
                                 </option>
                              </select>
                           </div>
                           <div className="table-filter" id="saleResellerFilterGroup" style={{ display: "none" }}>
                              <select id="saleResellerFilter">
                                 <option value="all">Semua Reseller</option>
                              </select>
                           </div>
                           {/* Filter Harian & Quick Presets */}
                           <div className="table-filter date-preset-filter">
                              <div className="chart-tabs" id="saleQuickPresets">
                                 <button type="button" className="chart-tab active" data-preset="today">Hari Ini</button>
                                 <button type="button" className="chart-tab" data-preset="yesterday">Kemarin</button>
                                 <button type="button" className="chart-tab" data-preset="all">Semua</button>
                              </div>
                              <input
                                 type="date"
                                 id="saleDateFilter"
                              />
                           </div>
                           {/* Phase 6.2 — period filters (options populated by populateSalePeriodFilters()) */}
                           <div className="table-filter">
                              <select id="saleMonthFilter">
                                 <option value="all">Semua Bulan</option>
                              </select>
                           </div>
                           <div className="table-filter">
                              <select id="saleYearFilter">
                                 <option value="all">Semua Tahun</option>
                              </select>
                           </div>
                        </div>
                        <div className="table-scroll">
                           <table className="data-table">
                              <thead>
                                 <tr>
                                    <th>Gambar</th>
                                    <th>No. Transaksi</th>
                                    <th>Tanggal</th>
                                    <th>Produk</th>
                                    <th>Qty</th>
                                    <th>Channel</th>
                                    <th>Ekspedisi</th>
                                    <th>Alamat</th>
                                    <th>Pendapatan</th>
                                    <th>Keuntungan</th>
                                    <th>Aksi</th>
                                 </tr>
                              </thead>
                              <tbody id="saleBody"></tbody>
                           </table>
                        </div>
                        <div className="table-footer">
                           <span id="saleInfo"></span>
                           <div className="pagination" id="salePag"></div>
                        </div>
                     </div>
                  </div>

                  {/* Laporan */}
                  <div className="page" id="pageLaporan">
                     <div
                        className="report-toolbar"
                        style={{
                           display: "flex",
                           gap: "10px",
                           marginBottom: "18px",
                           flexWrap: "wrap",
                           alignItems: "center",
                        }}
                     >
                        <div className="table-filter">
                           <select id="reportType">
                              <option value="sales">Laporan Penjualan</option>
                              <option value="production">
                                 Laporan Produksi
                              </option>
                              <option value="inventory">
                                 Laporan Inventaris
                              </option>
                              <option value="profit">Laporan Keuntungan</option>
                              <option value="bestseller">
                                 Produk Terlaris
                              </option>
                           </select>
                        </div>
                        <div className="table-filter">
                           <select id="reportPeriod" defaultValue="monthly">
                              <option value="daily">Harian</option>
                              <option value="weekly">Mingguan</option>
                              <option value="monthly">
                                 Bulanan
                              </option>
                              <option value="yearly">Tahunan</option>
                           </select>
                        </div>
                        {/* Period filters (options and visibility managed dynamically) */}
                        <div className="table-filter" id="reportDateFilterGroup" style={{ display: "none" }}>
                           <input
                              type="date"
                              id="reportDateFilter"
                              className="form-input"
                              style={{ height: "38px", width: "auto", minWidth: "135px", boxSizing: "border-box" }}
                           />
                        </div>
                        <div className="table-filter" id="reportMonthFilterGroup">
                           <select id="reportMonthFilter">
                              <option value="all">Semua Bulan</option>
                           </select>
                        </div>
                        <div className="table-filter" id="reportYearFilterGroup">
                           <select id="reportYearFilter">
                              <option value="all">Semua Tahun</option>
                           </select>
                        </div>
                        <button
                           className="btn btn-outline btn-sm"
                           id="exportCsvBtn"
                        >
                           <i className="fas fa-file-excel"></i>Export Excel
                        </button>
                     </div>
                     <div
                        className="stat-grid"
                        id="reportStats"
                        style={{ gridTemplateColumns: "repeat(4,1fr)" }}
                     ></div>
                     <div className="grid-2">
                        <div className="card">
                           <div className="card-header">
                              <h3>Grafik Laporan</h3>
                           </div>
                           <div className="card-body">
                              <div className="chart-wrap">
                                 <canvas id="chartReport"></canvas>
                              </div>
                           </div>
                        </div>
                        <div className="card">
                           <div className="card-header">
                              <h3>Detail</h3>
                           </div>
                           <div className="card-body" id="reportDetail"></div>
                        </div>
                     </div>
                  </div>

                  {/* Pengguna */}
                  <div className="page" id="pagePengguna">
                     <div className="card">
                        <div className="table-toolbar">
                           <h3 style={{ fontSize: "15px", fontWeight: "700" }}>
                              Daftar Pengguna
                           </h3>
                        </div>
                        <div className="table-scroll">
                           <table className="data-table">
                              <thead>
                                 <tr>
                                    <th>Nama</th>
                                    <th>Email</th>
                                    <th>Peran</th>
                                    <th>Status</th>
                                 </tr>
                              </thead>
                              <tbody id="userBody"></tbody>
                           </table>
                        </div>
                     </div>
                  </div>

                  {/* Pengaturan */}
                  <div className="page" id="pagePengaturan">
                     <div className="grid-2">
                        <div className="card">
                           <div className="card-header">
                              <h3>Profil Pengguna</h3>
                           </div>
                           <div className="card-body">
                              <div
                                 style={{
                                    textAlign: "center",
                                    marginBottom: "20px",
                                 }}
                              >
                                 <div
                                    className="avatar"
                                    style={{
                                       width: "72px",
                                       height: "72px",
                                       fontSize: "28px",
                                       margin: "0 auto 12px",
                                       borderRadius: "18px",
                                    }}
                                    id="settingsAvatar"
                                 >
                                    A
                                 </div>
                                 <h3
                                    style={{
                                       fontSize: "18px",
                                       fontWeight: "700",
                                    }}
                                    id="settingsName"
                                 >
                                    Admin
                                 </h3>
                                 <p
                                    style={{
                                       fontSize: "13px",
                                       color: "var(--text-muted)",
                                    }}
                                    id="settingsEmail"
                                 >
                                    user@domain.com
                                 </p>
                              </div>
                              <div className="form-group">
                                 <label>Nama Lengkap</label>
                                 <input
                                    type="text"
                                    className="form-input"
                                    id="settingNameInput"
                                    defaultValue="Admin"
                                 />
                              </div>
                              <div className="form-group">
                                 <label>Email</label>
                                 <input
                                    type="email"
                                    className="form-input"
                                    id="settingEmailInput"
                                    defaultValue="user@domain.com"
                                    disabled
                                 />
                              </div>
                              <button
                                 className="btn btn-primary btn-sm btn-full"
                                 id="saveProfileBtn"
                              >
                                 <i className="fas fa-check"></i>Simpan
                                 Perubahan
                              </button>
                           </div>
                        </div>
                        <div className="card">
                           <div className="card-header">
                              <h3>Pengaturan Aplikasi</h3>
                           </div>
                           <div className="card-body">
                              <div className="settings-section">
                                 <h3>Notifikasi</h3>
                                 <div className="setting-row">
                                    <div className="setting-label">
                                       <h4>Alert Stok Habis</h4>
                                       <p>Notifikasi saat stok produk habis</p>
                                    </div>
                                    <div
                                       className="toggle active"
                                       data-setting="alertOut"
                                    ></div>
                                 </div>
                                 <div className="setting-row">
                                    <div className="setting-label">
                                       <h4>Alert Stok Rendah</h4>
                                       <p>Notifikasi saat stok menipis</p>
                                    </div>
                                    <div
                                       className="toggle active"
                                       data-setting="alertLow"
                                    ></div>
                                 </div>
                                 <div className="setting-row">
                                    <div className="setting-label">
                                       <h4>Notifikasi Produksi Selesai</h4>
                                       <p>Beritahu saat produksi selesai</p>
                                    </div>
                                    <div
                                       className="toggle active"
                                       data-setting="alertProdDone"
                                    ></div>
                                 </div>
                              </div>
                              <div className="settings-section">
                                 <h3>Tampilan</h3>
                                 <div className="setting-row">
                                    <div className="setting-label">
                                       <h4>Animasi Halaman</h4>
                                       <p>Aktifkan transisi antar halaman</p>
                                    </div>
                                    <div
                                       className="toggle active"
                                       data-setting="animations"
                                    ></div>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="card" style={{ marginTop: "18px" }}>
                        <div className="card-header">
                           <h3>Tentang Sistem</h3>
                        </div>
                        <div
                           className="card-body"
                           style={{
                              fontSize: "13px",
                              color: "var(--text-muted)",
                              lineHeight: "1.8",
                           }}
                        >
                           <strong style={{ color: "var(--text)" }}>
                              InztaMoto ERP v1.0.0
                           </strong>
                           <br />
                           Sistem ERP untuk InztaMoto — brand tas motor dan
                           riding gear. Mengelola produksi, inventaris,
                           penjualan, dan analitik keuntungan secara realtime
                           via Firebase.
                           <br />
                           <br />
                           <strong style={{ color: "var(--text)" }}>
                              Rumus Perhitungan:
                           </strong>
                           <br />
                           Keuntungan = Harga Jual - Harga Modal
                           <br />
                           Margin = (Keuntungan / Harga Jual) x 100%
                           <br />
                           Laba = Total Pendapatan - Total Biaya
                           <br />
                           Margin Laba = (Laba / Pendapatan) x 100%
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Modal */}
         <div className="modal-overlay" id="modalOverlay">
            <div className="modal" id="modalContent">
               <div className="modal-header">
                  <h3 id="modalTitle">Modal</h3>
                  <button className="modal-close" id="modalClose">
                     <i className="fas fa-xmark"></i>
                  </button>
               </div>
               <div className="modal-body" id="modalBody"></div>
               <div className="modal-footer" id="modalFooter"></div>
            </div>
         </div>

         {/* Toast */}
         <div id="toastContainer"></div>

         <LegacyScripts />
      </>
   );
}
