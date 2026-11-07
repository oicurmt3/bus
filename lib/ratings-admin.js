import { sql } from "./db.js";
import {
  sanitizePublicPayload,
  stripPrivateFieldsForStorage,
  validateAndSanitizeSubmission,
} from "./sanitize.js";

const MAX_ADMIN_ROWS = 500;

export async function listRatingsForAdmin() {
  const rows = await sql(
    `SELECT id, payload, created_at
     FROM bus_ratings
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [MAX_ADMIN_ROWS]
  );
  return rows.map((row) => ({
    id: Number(row.id),
    createdAt: row.created_at,
    payload: sanitizePublicPayload(row.payload) ?? {},
  }));
}

export async function updateRatingById(id, rawPayload) {
  const validated = validateAndSanitizeSubmission(rawPayload);
  if (!validated.ok) {
    return { ok: false, status: validated.status, message: validated.message };
  }
  const stored = stripPrivateFieldsForStorage(
    sanitizePublicPayload(validated.payload) || validated.payload
  );
  const rows = await sql(
    `UPDATE bus_ratings
     SET payload = $2::jsonb
     WHERE id = $1
     RETURNING id`,
    [id, JSON.stringify(stored)]
  );
  if (!rows.length) {
    return { ok: false, status: 404, message: "Rating not found." };
  }
  return { ok: true, status: 200, message: "Rating updated.", payload: stored };
}

export async function deleteRatingById(id) {
  const rows = await sql(`DELETE FROM bus_ratings WHERE id = $1 RETURNING id`, [id]);
  if (!rows.length) {
    return { ok: false, status: 404, message: "Rating not found." };
  }
  return { ok: true, status: 200, message: "Rating deleted." };
}
