import { assertSameOrigin, getClientIp, jsonResponse } from "../lib/http.js";
import { attachServerMetadata, insertRating } from "../lib/ratings.js";

export async function POST(request) {
  if (request.method !== "POST") {
    return jsonResponse({ status: "error", message: "Invalid request method." }, 405);
  }
  if (!assertSameOrigin(request)) {
    return jsonResponse({ status: "error", message: "Invalid request origin." }, 403);
  }

  let newRatingData;
  try {
    const body = await request.text();
    if (!body.trim()) {
      return jsonResponse({ status: "error", message: "No data received." }, 400);
    }
    newRatingData = JSON.parse(body);
    if (typeof newRatingData !== "object" || newRatingData === null) {
      throw new Error("Invalid payload");
    }
  } catch {
    return jsonResponse({ status: "error", message: "Invalid JSON data." }, 400);
  }

  const clientIp = getClientIp(request);
  const payload = attachServerMetadata(newRatingData, clientIp);
  const result = await insertRating(payload, clientIp);

  if (!result.ok) {
    return jsonResponse({ status: "error", message: result.message }, result.status);
  }
  return jsonResponse({ status: "success", message: result.message }, 200);
}
