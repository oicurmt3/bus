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

function normalizeHostname(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  const withoutPort = trimmed.includes(":") ? trimmed.split(":")[0] : trimmed;
  return withoutPort;
}

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

function collectAllowedHostnames(request) {
  const hosts = new Set();
  const add = (value) => {
    const host = normalizeHostname(value);
    if (host) hosts.add(host);
  };

  try {
    add(new URL(request.url).hostname);
  } catch {
    /* ignore */
  }

  for (const header of [
    "host",
    "x-forwarded-host",
    "x-vercel-forwarded-host",
    "x-original-host",
  ]) {
    const raw = request.headers.get(header);
    if (!raw) continue;
    for (const part of raw.split(",")) {
      add(part);
    }
  }

  return hosts;
}

function urlHostnameAllowed(urlString, allowed) {
  try {
    const host = normalizeHostname(new URL(urlString).hostname);
    return host !== "" && allowed.has(host);
  } catch {
    return false;
  }
}

/**
 * Block cross-site POST forgery while allowing hosted apps where the `Host`
 * header may differ from the public URL the browser used (`request.url`).
 */
export function assertSameOrigin(request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "same-site") {
    return true;
  }

  const allowed = collectAllowedHostnames(request);
  if (allowed.size === 0) {
    return true;
  }

  const origin = request.headers.get("origin");
  if (origin) {
    return urlHostnameAllowed(origin, allowed);
  }

  const referer = request.headers.get("referer");
  if (referer) {
    return urlHostnameAllowed(referer, allowed);
  }

  return false;
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
