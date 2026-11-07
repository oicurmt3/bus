export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/** Set only by our runtime or trusted edge infrastructure — never read client X-Forwarded-For. */
export const TRUSTED_CLIENT_IP_HEADER = "x-ride-rate-client-ip";

const INFRA_IP_HEADERS = [
  "x-ride-rate-client-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "fly-client-ip",
];

function normalizeIp(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^::ffff:/i, "");
  if (!/^[\da-f:.]+$/i.test(trimmed)) return null;
  return trimmed;
}

export function getClientIp(request) {
  for (const name of INFRA_IP_HEADERS) {
    const ip = normalizeIp(request.headers.get(name));
    if (ip) return ip;
  }
  return "unknown";
}

/** Reject cross-site POST when Origin/Referer does not match this host. */
export function assertSameOrigin(request) {
  const host = request.headers.get("host");
  if (!host) return true;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const o = new URL(origin);
      if (o.host === host) return true;
    } catch {
      return false;
    }
    return false;
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const r = new URL(referer);
      if (r.host === host) return true;
    } catch {
      return false;
    }
    return false;
  }
  return true;
}
