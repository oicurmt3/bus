import { assertSameOrigin, getClientIp, jsonResponse } from "../lib/http.js";
import { attachServerMetadata, insertRating } from "../lib/ratings.js";
import { MAX_SUBMISSION_BYTES, validateAndSanitizeSubmission } from "../lib/sanitize.js";

export async function POST(request) {
  if (request.method !== "POST") {
    return jsonResponse({ status: "error", message: "Invalid request method." }, 405);
  }
  if (!assertSameOrigin(request)) {
    return jsonResponse({ status: "error", message: "Invalid request origin." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_SUBMISSION_BYTES) {
    return jsonResponse({ status: "error", message: "Submission is too large." }, 413);
  }

  let parsed;
  try {
    const body = await request.text();
    if (body.length > MAX_SUBMISSION_BYTES) {
      return jsonResponse({ status: "error", message: "Submission is too large." }, 413);
    }
    if (!body.trim()) {
      return jsonResponse({ status: "error", message: "No data received." }, 400);
    }
    parsed = JSON.parse(body);
  } catch {
    return jsonResponse({ status: "error", message: "Invalid JSON data." }, 400);
  }

  const validated = validateAndSanitizeSubmission(parsed);
  if (!validated.ok) {
    return jsonResponse({ status: "error", message: validated.message }, validated.status);
  }

  const clientIp = getClientIp(request);
  const payload = attachServerMetadata(validated.payload);
  const result = await insertRating(payload, clientIp);

  if (!result.ok) {
    return jsonResponse({ status: "error", message: result.message }, result.status);
  }
  return jsonResponse({ status: "success", message: result.message }, 200);
}
