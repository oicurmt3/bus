export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
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
