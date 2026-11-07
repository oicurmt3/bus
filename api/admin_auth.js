import {
  adminPasswordConfigured,
  issueAdminToken,
  verifyAdminPassword,
} from "../lib/admin.js";
import { jsonResponse } from "../lib/http.js";

export async function POST(request) {
  if (!adminPasswordConfigured()) {
    return jsonResponse(
      { status: "error", message: "Admin access is not configured on this deployment." },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ status: "error", message: "Invalid JSON body." }, 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!verifyAdminPassword(password)) {
    return jsonResponse({ status: "error", message: "Invalid password." }, 401);
  }

  const token = issueAdminToken();
  if (!token) {
    return jsonResponse({ status: "error", message: "Could not create session." }, 500);
  }

  return jsonResponse({ status: "success", token }, 200);
}
