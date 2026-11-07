import { requireAdmin, adminPasswordConfigured } from "../lib/admin.js";
import { jsonResponse } from "../lib/http.js";
import {
  deleteRatingById,
  listRatingsForAdmin,
  updateRatingById,
} from "../lib/ratings-admin.js";

function unauthorized() {
  return jsonResponse({ status: "error", message: "Unauthorized." }, 401);
}

function notConfigured() {
  return jsonResponse(
    { status: "error", message: "Admin access is not configured on this deployment." },
    503
  );
}

export async function GET(request) {
  if (!adminPasswordConfigured()) return notConfigured();
  if (!requireAdmin(request)) return unauthorized();
  const rows = await listRatingsForAdmin();
  return jsonResponse({ status: "success", ratings: rows }, 200);
}

export async function PATCH(request) {
  if (!adminPasswordConfigured()) return notConfigured();
  if (!requireAdmin(request)) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ status: "error", message: "Invalid JSON body." }, 400);
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) {
    return jsonResponse({ status: "error", message: "Valid rating id is required." }, 400);
  }

  const payload = body.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse({ status: "error", message: "Payload object is required." }, 400);
  }

  const result = await updateRatingById(id, payload);
  return jsonResponse(
    { status: result.ok ? "success" : "error", message: result.message, payload: result.payload },
    result.status
  );
}

export async function DELETE(request) {
  if (!adminPasswordConfigured()) return notConfigured();
  if (!requireAdmin(request)) return unauthorized();

  let id;
  const url = new URL(request.url);
  const q = url.searchParams.get("id");
  if (q) {
    id = Number(q);
  } else {
    try {
      const body = await request.json();
      id = Number(body.id);
    } catch {
      return jsonResponse({ status: "error", message: "Rating id is required." }, 400);
    }
  }

  if (!Number.isInteger(id) || id < 1) {
    return jsonResponse({ status: "error", message: "Valid rating id is required." }, 400);
  }

  const result = await deleteRatingById(id);
  return jsonResponse(
    { status: result.ok ? "success" : "error", message: result.message },
    result.status
  );
}
