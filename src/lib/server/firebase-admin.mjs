// Firebase Admin for ERP server routes (Node runtime only).
// Credential: FIREBASE_SERVICE_ACCOUNT = the service account JSON of the SAME project as
// NEXT_PUBLIC_FIREBASE_PROJECT_ID, either raw JSON or base64 of it. Production holds the database-inzta key,
// Preview holds the inzta-erp-staging key. A mismatch is refused so a preview can never write to production.
// Local tests only (never on Vercel): with FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST set, the Admin SDK
// talks to the Firebase emulators and needs no credential.
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
    this.code = "CONFIG";
  }
}

export function parseServiceAccount(raw) {
  if (!raw) throw new ConfigError("FIREBASE_SERVICE_ACCOUNT belum diisi di Vercel");
  let text = String(raw).trim();
  if (!text.startsWith("{")) text = Buffer.from(text, "base64").toString("utf8");
  let sa;
  try {
    sa = JSON.parse(text);
  } catch {
    throw new ConfigError("FIREBASE_SERVICE_ACCOUNT bukan JSON service account yang valid");
  }
  if (!sa.project_id || !sa.client_email || !sa.private_key) throw new ConfigError("FIREBASE_SERVICE_ACCOUNT tidak lengkap (project_id, client_email, private_key)");
  return sa;
}

export function checkSameProject(sa, publicProjectId) {
  if (!publicProjectId) throw new ConfigError("NEXT_PUBLIC_FIREBASE_PROJECT_ID kosong");
  if (sa.project_id !== publicProjectId) {
    throw new ConfigError("Service account untuk project " + sa.project_id + ", tetapi ERP ini memakai " + publicProjectId + ". Periksa env Vercel per lingkungan.");
  }
}

let cached = null;

export function adminApp() {
  if (cached) return cached;
  const name = "erp-server";
  const existing = getApps().find((a) => a.name === name);
  if (existing) return (cached = existing);
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!process.env.VERCEL && process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    if (!projectId) throw new ConfigError("NEXT_PUBLIC_FIREBASE_PROJECT_ID kosong");
    cached = initializeApp({ projectId }, name);
    return cached;
  }
  const sa = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  checkSameProject(sa, projectId);
  cached = initializeApp({ credential: cert(sa), projectId: sa.project_id }, name);
  return cached;
}

export const adminDb = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());
