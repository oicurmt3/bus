import { jsonResponse } from "../lib/http.js";
import { listRatings } from "../lib/ratings.js";

export async function GET() {
  const ratings = await listRatings();
  return jsonResponse(ratings, 200);
}
