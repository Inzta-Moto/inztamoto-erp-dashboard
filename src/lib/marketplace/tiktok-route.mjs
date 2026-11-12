// Shared plumbing for the /api/marketplace/tiktok/* route handlers: env, dependencies, JSON answers, errors.
// Env (Vercel, per environment):
//   TIKTOK_APP_KEY, TIKTOK_APP_SECRET   Partner Center > app "Inzta ERP" (Sensitive)
//   TIKTOK_SERVICE_ID                   optional, the app/service ID used in the authorization link
//   FIREBASE_SERVICE_ACCOUNT            service account JSON of the project in NEXT_PUBLIC_FIREBASE_PROJECT_ID
//   CRON_SECRET                         random string; Vercel Cron sends it as "Authorization: Bearer <CRON_SECRET>"
//   TIKTOK_AUTH_BASE, TIKTOK_API_BASE   local mock only; ignored in production
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createTikTokClient } from "./tiktok-api.mjs";
import { adminDb, adminAuth } from "../server/firebase-admin.mjs";
import { HttpError } from "../server/erp-auth.mjs";

export const DEFAULT_SERVICE_ID = "7706703201979336469";

export function isProduction() {
  return process.env.VERCEL_ENV === "production";
}

export function tiktokSecret() {
  const s = process.env.TIKTOK_APP_SECRET;
  if (!s) throw new HttpError(503, "TIKTOK_APP_SECRET belum diisi di Vercel", "CONFIG");
  return s;
}

export function serviceId() {
  return process.env.TIKTOK_SERVICE_ID || DEFAULT_SERVICE_ID;
}

export function tiktokClient() {
  if (!process.env.TIKTOK_APP_KEY || !process.env.TIKTOK_APP_SECRET) throw new HttpError(503, "TIKTOK_APP_KEY dan TIKTOK_APP_SECRET belum diisi di Vercel", "CONFIG");
  return createTikTokClient({
    appKey: process.env.TIKTOK_APP_KEY,
    appSecret: process.env.TIKTOK_APP_SECRET,
    authBase: isProduction() ? undefined : process.env.TIKTOK_AUTH_BASE,
    apiBase: isProduction() ? undefined : process.env.TIKTOK_API_BASE,
  });
}

export function deps() {
  return { db: adminDb(), auth: adminAuth() };
}

export function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(err) {
  const status = err && err.status ? err.status : err && err.code === "CONFIG" ? 503 : 500;
  const message = status >= 500 && !(err && err.code === "CONFIG") ? "Terjadi kesalahan di server ERP" : String((err && err.message) || "Gagal");
  if (status >= 500) console.error("[marketplace/tiktok]", err && err.code, err && err.message);
  return json({ error: message, code: (err && err.code) || "" }, status);
}

export function cronAuthorized(request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") || "");
  const want = Buffer.from("Bearer " + secret);
  return got.length === want.length && timingSafeEqual(got, want);
}
