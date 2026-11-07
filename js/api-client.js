/**
 * Browser client for Ride Rate API routes on Cursor Apps hosting.
 */
export async function submitRating(payload) {
  const response = await fetch("/api/log_rating", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  return {
    ok: response.ok && body.status === "success",
    status: response.status,
    message:
      body.message ||
      (response.status === 429
        ? "Too many submissions. Please try again later."
        : response.status === 403
          ? "Submission was blocked. Please refresh and try again."
          : "Could not submit rating."),
  };
}

export async function loadRatings() {
  const response = await fetch("/api/ratings", {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error("Failed to load ratings");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}
