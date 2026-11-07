import { sql } from "./db.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const RETENTION_MS = 24 * 60 * 60 * 1000;
export const LOGIN_FAILURE_DELAY_MS = 750;

export async function adminLoginAllowed(clientKey) {
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();
  const purgeBefore = new Date(Date.now() - RETENTION_MS).toISOString();
  await sql(`DELETE FROM admin_login_attempts WHERE attempted_at < $1::timestamptz`, [
    purgeBefore,
  ]);
  const rows = await sql(
    `SELECT COUNT(*)::int AS count
     FROM admin_login_attempts
     WHERE client_key = $1 AND attempted_at > $2::timestamptz`,
    [clientKey, windowStart]
  );
  return (rows[0]?.count ?? 0) < MAX_ATTEMPTS;
}

export async function recordAdminLoginAttempt(clientKey) {
  await sql(`INSERT INTO admin_login_attempts (client_key) VALUES ($1)`, [clientKey]);
}

export function loginDelay() {
  const jitter = Math.floor(Math.random() * 200);
  return new Promise((resolve) => setTimeout(resolve, LOGIN_FAILURE_DELAY_MS + jitter));
}
