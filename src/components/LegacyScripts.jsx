"use client";

import { useEffect } from "react";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-legacy-src="${src}"]`);

    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.defer = false;
    script.dataset.legacySrc = src;

    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

    document.body.appendChild(script);
  });
}

export default function LegacyScripts() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__INZTAMOTO_LEGACY_LOADED__) return;

    window.__INZTAMOTO_LEGACY_LOADED__ = true;

    window.__INZTAMOTO_ENV__ = {
      firebase: {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      },
      cloudinary: {
        cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
      },
      // F-031: base URL of the inzta.id API that owns warranty claims and feedback (design.md section 6).
      warranty: {
        apiBase: process.env.NEXT_PUBLIC_WARRANTY_API_BASE || "",
      },
    };

    const run = async () => {
      try {
        await loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
        await loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js");
        await loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js");
        await loadScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js");
        await loadScript("https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js");
        await loadScript("/legacy/sales-window.js");
        await loadScript("/legacy/app-runtime.js");
        await loadScript("/legacy/faktur-calc.js");
        await loadScript("/legacy/faktur.js");
        await loadScript("/legacy/garansi.js");
        await loadScript("/legacy/marketplace.js");
      } catch (error) {
        console.error("[Inztamoto Legacy Runtime]", error);
      }
    };

    run();
  }, []);

  return null;
}
