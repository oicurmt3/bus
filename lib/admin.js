import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export function adminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

function adminSecret() {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

export function verifyAdminPassword(candidate) {
  const secret = adminSecret();
  if (!secret || typeof candidate !== "string") return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(candidate);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function issueAdminToken() {
  const secret = adminSecret();
  if (!secret) return null;
  const exp = Date.now() + TOKEN_TTL_MS;
  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", secret).update(`${exp}.${nonce}`).digest("hex");
  return `${exp}.${nonce}.${sig}`;
}

export function verifyAdminToken(token) {
  const secret = adminSecret();
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = createHmac("sha256", secret).update(`${expStr}.${nonce}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function requireAdmin(request) {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return verifyAdminToken(match[1].trim());
}
