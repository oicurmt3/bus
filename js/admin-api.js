const TOKEN_KEY = "ride-rate-admin-token";

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setAdminToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getAdminToken();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function adminLogin(password) {
  const response = await fetch("/api/admin_auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status !== "success" || !body.token) {
    throw new Error(body.message || "Login failed.");
  }
  setAdminToken(body.token);
  return body.token;
}

export function adminLogout() {
  setAdminToken("");
}

export async function adminListRatings() {
  const response = await fetch("/api/admin_ratings", {
    headers: authHeaders(),
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    adminLogout();
    throw new Error("Session expired. Sign in again.");
  }
  if (!response.ok) throw new Error(body.message || "Could not load ratings.");
  return body.ratings || [];
}

export async function adminUpdateRating(id, payload) {
  const response = await fetch("/api/admin_ratings", {
    method: "PATCH",
    headers: authHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ id, payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    adminLogout();
    throw new Error("Session expired. Sign in again.");
  }
  if (!response.ok) throw new Error(body.message || "Could not update rating.");
  return body;
}

export async function adminDeleteRating(id) {
  const response = await fetch("/api/admin_ratings", {
    method: "DELETE",
    headers: authHeaders(),
    credentials: "same-origin",
    body: JSON.stringify({ id }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    adminLogout();
    throw new Error("Session expired. Sign in again.");
  }
  if (!response.ok) throw new Error(body.message || "Could not delete rating.");
  return body;
}
