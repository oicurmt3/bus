import { hashClientKey } from "./http.js";
import { sql } from "./db.js";
import { sanitizePublicPayload, stripPrivateFieldsForStorage } from "./sanitize.js";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_LIST_ROWS = 500;

export async function listRatings() {
  const rows = await sql(
    `SELECT payload FROM bus_ratings
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [MAX_LIST_ROWS]
  );
  return rows
    .map((row) => sanitizePublicPayload(row.payload))
    .filter(Boolean);
}

export async function insertRating(payload, clientIp) {
  const ipHash = hashClientKey(clientIp);
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const purgeBefore = new Date(Date.now() - RATE_LIMIT_RETENTION_MS).toISOString();

  await sql(`DELETE FROM rating_rate_limit WHERE submitted_at < $1::timestamptz`, [
    purgeBefore,
  ]);

  const recent = await sql(
    `SELECT COUNT(*)::int AS count
     FROM rating_rate_limit
     WHERE ip_hash = $1 AND submitted_at > $2::timestamptz`,
    [ipHash, windowStart]
  );
  if ((recent[0]?.count ?? 0) >= RATE_LIMIT_MAX) {
    return { ok: false, status: 429, message: "Too many submissions. Try again later." };
  }

  const stored = stripPrivateFieldsForStorage(sanitizePublicPayload(payload) || payload);
  await sql(`INSERT INTO bus_ratings (payload) VALUES ($1::jsonb)`, [
    JSON.stringify(stored),
  ]);
  await sql(`INSERT INTO rating_rate_limit (ip_hash) VALUES ($1)`, [ipHash]);

  return { ok: true, status: 200, message: "Rating logged successfully." };
}

export function attachServerMetadata(payload) {
  const enriched = stripPrivateFieldsForStorage({ ...payload });
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
  return enriched;
}
