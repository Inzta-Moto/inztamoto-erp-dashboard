// Who is calling an ERP server route. The browser sends the Firebase ID token of the signed-in ERP user
// (Authorization: Bearer <idToken>); the role comes from the `users` collection, looked up the same way as
// loadUserProfile() in public/legacy/app-runtime.js (doc id = uid, then doc id = email, then field email).
export class HttpError extends Error {
  constructor(status, message, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const INACTIVE = new Set(["nonaktif", "non-aktif", "tidak aktif", "inactive", "disabled", "suspended"]);

export function bearer(request) {
  const h = request.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : "";
}

export async function roleOf(db, { uid, email }) {
  const users = db.collection("users");
  let snap = uid ? await users.doc(uid).get() : null;
  if ((!snap || !snap.exists) && email) snap = await users.doc(email).get();
  if ((!snap || !snap.exists) && email && email !== email.toLowerCase()) snap = await users.doc(email.toLowerCase()).get();
  if ((!snap || !snap.exists) && email) {
    const q = await users.where("email", "==", email).limit(1).get();
    snap = q.empty ? null : q.docs[0];
  }
  const d = snap && snap.exists !== false && snap.data ? snap.data() || {} : {};
  return { role: String(d.role || "").toLowerCase(), status: String(d.status || "") };
}

// Throws HttpError(401/403). Returns { uid, email, role }.
export async function requireErpRole(request, { auth, db, roles }) {
  const token = bearer(request);
  if (!token) throw new HttpError(401, "Belum masuk", "UNAUTHENTICATED");
  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    throw new HttpError(401, "Sesi habis, silakan masuk lagi", "UNAUTHENTICATED");
  }
  const email = String(decoded.email || "");
  const { role, status } = await roleOf(db, { uid: decoded.uid, email });
  if (INACTIVE.has(status.toLowerCase())) throw new HttpError(403, "Akun tidak aktif", "FORBIDDEN");
  if (!roles.includes(role)) throw new HttpError(403, "Akun ini tidak punya akses", "FORBIDDEN");
  return { uid: decoded.uid, email, role };
}
