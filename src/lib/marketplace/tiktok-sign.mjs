// Request signing for TikTok Shop Open API (versioned APIs such as /order/202309/...).
// Steps, as in the TikTok Shop partner docs "Sign your API request":
//   1. take every query parameter except `sign` and `access_token`, sorted by key;
//   2. join them as key + value with no separator;
//   3. put the API path in front;
//   4. append the raw request body when the request is not multipart/form-data;
//   5. wrap the whole string with the app secret on both sides;
//   6. HMAC-SHA256 with the app secret as key, lowercase hex.
// Pure function: no network, no env. Tested in scripts/marketplace-tiktok.test.mjs.
import { createHmac } from "node:crypto";

const EXCLUDED = new Set(["sign", "access_token"]);

export function signString({ path, query = {}, body = "", multipart = false, appSecret }) {
  const keys = Object.keys(query)
    .filter((k) => !EXCLUDED.has(k) && query[k] !== undefined && query[k] !== null)
    .sort();
  let s = path;
  for (const k of keys) s += k + String(query[k]);
  if (!multipart && body) s += body;
  return appSecret + s + appSecret;
}

export function sign({ path, query = {}, body = "", multipart = false, appSecret }) {
  if (!appSecret) throw new Error("appSecret is required to sign a TikTok Shop request");
  const base = signString({ path, query, body, multipart, appSecret });
  return createHmac("sha256", appSecret).update(base).digest("hex");
}
