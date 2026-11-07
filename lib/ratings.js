import { createHash } from "node:crypto";
import { sql } from "./db.js";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 30;

function hashIp(ip) {
  return createHash("sha256").update(ip).digest("hex");
}

export async function listRatings() {
  const rows = await sql(
    `SELECT payload FROM bus_ratings ORDER BY created_at DESC, id DESC`
  );
  return rows.map((row) => row.payload);
}

export async function insertRating(payload, clientIp) {
  const ipHash = hashIp(clientIp);
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const recent = await sql(
    `SELECT COUNT(*)::int AS count
     FROM rating_rate_limit
     WHERE ip_hash = $1 AND submitted_at > $2::timestamptz`,
    [ipHash, windowStart]
  );
  if ((recent[0]?.count ?? 0) >= RATE_LIMIT_MAX) {
    return { ok: false, status: 429, message: "Too many submissions. Try again later." };
  }

  await sql(`INSERT INTO bus_ratings (payload) VALUES ($1::jsonb)`, [
    JSON.stringify(payload),
  ]);
  await sql(`INSERT INTO rating_rate_limit (ip_hash) VALUES ($1)`, [ipHash]);

  return { ok: true, status: 200, message: "Rating logged successfully." };
}

export function attachServerMetadata(payload, clientIp) {
  const enriched = { ...payload };
  const dateTime = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Perth",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  enriched.serverTimestamp = dateTime;
  enriched.ipAddress = clientIp;
  delete enriched.user_name;
  delete enriched.user_phone;
  return enriched;
}
