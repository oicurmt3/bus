import { createHash } from "node:crypto";

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/** Injected only by scripts/dev-server.mjs (not honored from clients on production). */
export const DEV_CLIENT_IP_HEADER = "x-ride-rate-dev-ip";

const EDGE_IP_HEADERS = ["cf-connecting-ip", "true-client-ip", "fly-client-ip"];

function normalizeIp(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^::ffff:/i, "");
  if (!/^[\da-f:.]+$/i.test(trimmed)) return null;
  return trimmed;
}

export function getClientIp(request) {
  for (const name of EDGE_IP_HEADERS) {
    const ip = normalizeIp(request.headers.get(name));
    if (ip) return ip;
  }
  const devIp = normalizeIp(request.headers.get(DEV_CLIENT_IP_HEADER));
  if (devIp) return devIp;
  return "unknown";
}

export function rateLimitPepper() {
  const fromEnv = process.env.RATE_LIMIT_PEPPER?.trim();
  if (fromEnv) return fromEnv;
  const db = process.env.DATABASE_URL?.trim();
  if (db) {
    return createHash("sha256").update(db).digest("hex");
  }
  return "ride-rate-local-dev";
}

export function hashClientKey(ip) {
  return createHash("sha256")
    .update(rateLimitPepper())
    .update("\0")
    .update(ip || "unknown")
    .digest("hex");
}
