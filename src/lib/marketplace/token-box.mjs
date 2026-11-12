// Seals marketplace OAuth tokens before they are written to Firestore.
// Why: the ERP Firestore rules let every signed-in ERP user read every document, so a token stored in plain text
// could be copied by any staff account. Tokens are encrypted with AES-256-GCM using a key derived (HKDF-SHA256)
// from a server-only secret (the platform app secret), which never reaches the browser.
// Format: "v1.<iv>.<tag>.<ciphertext>", each part base64url.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const VERSION = "v1";

function keyFrom(secret, purpose) {
  if (!secret || typeof secret !== "string") throw new Error("token-box: secret is required");
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), Buffer.from("inzta-erp:" + purpose, "utf8"), 32));
}

export function seal(plain, secret, purpose = "marketplace-token") {
  if (typeof plain !== "string" || !plain) throw new Error("token-box: nothing to seal");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret, purpose), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function open(sealed, secret, purpose = "marketplace-token") {
  const parts = typeof sealed === "string" ? sealed.split(".") : [];
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("token-box: unknown format");
  const [, iv, tag, ct] = parts;
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret, purpose), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
