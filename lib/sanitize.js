const MAX_SUBMISSION_BYTES = 16_384;

const RATING_ARRAY_FIELDS = new Set([
  "overall_experience",
  "braking_quality",
  "acceleration_quality",
  "cornering_quality",
  "cleanliness",
  "crowdedness",
  "driver_conduct",
  "passenger_conduct",
  "spare_1",
  "spare_2",
  "spare_3",
  "spare_4",
]);

const STRING_FIELDS = {
  bus_number: 16,
  route_number: 16,
  destination: 120,
  start_point: 200,
  start_latitude: 24,
  start_longitude: 24,
  start_timestamp: 40,
  comments: 500,
  clientSubmissionTimestamp: 40,
};

const PUBLIC_PAYLOAD_KEYS = [
  "bus_number",
  "route_number",
  "destination",
  "start_point",
  "start_latitude",
  "start_longitude",
  "start_timestamp",
  "overall_experience",
  "braking_quality",
  "acceleration_quality",
  "cornering_quality",
  "cleanliness",
  "crowdedness",
  "driver_conduct",
  "passenger_conduct",
  "spare_1",
  "spare_2",
  "spare_3",
  "spare_4",
  "comments",
  "clientSubmissionTimestamp",
  "serverTimestamp",
];

export { MAX_SUBMISSION_BYTES };

function cleanString(value, maxLen) {
  if (value === undefined || value === null) return "";
  const text = String(value).replace(/[\0-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

function sanitizeRatingArray(field, raw) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (!Array.isArray(raw)) return { error: `Invalid rating field: ${field}` };
  if (raw.length > 4) return { error: `Too many ratings for ${field}` };
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return { error: `Invalid rating item in ${field}` };
    const value = cleanString(item.value, 3);
    const text = cleanString(item.text, 80);
    if (!/^\d{1,2}$/.test(value) || !text) {
      return { error: `Invalid rating values in ${field}` };
    }
    out.push({ value, text });
  }
  return { value: out };
}

export function validateAndSanitizeSubmission(input) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, status: 400, message: "Invalid submission payload." };
  }
  const keys = Object.keys(input);
  if (keys.length > 24) {
    return { ok: false, status: 400, message: "Submission contains too many fields." };
  }

  const allowed = new Set([
    ...Object.keys(STRING_FIELDS),
    ...RATING_ARRAY_FIELDS,
  ]);
  for (const key of keys) {
    if (!allowed.has(key)) {
      return { ok: false, status: 400, message: "Submission contains unsupported fields." };
    }
  }

  const payload = {};
  for (const [field, maxLen] of Object.entries(STRING_FIELDS)) {
    if (input[field] !== undefined && input[field] !== null && input[field] !== "") {
      payload[field] = cleanString(input[field], maxLen);
    }
  }

  if (payload.start_latitude && !/^-?\d{1,3}(\.\d{1,8})?$/.test(payload.start_latitude)) {
    return { ok: false, status: 400, message: "Invalid latitude." };
  }
  if (payload.start_longitude && !/^-?\d{1,3}(\.\d{1,8})?$/.test(payload.start_longitude)) {
    return { ok: false, status: 400, message: "Invalid longitude." };
  }

  for (const field of RATING_ARRAY_FIELDS) {
    if (input[field] === undefined) continue;
    const result = sanitizeRatingArray(field, input[field]);
    if (result.error) {
      return { ok: false, status: 400, message: result.error };
    }
    if (result.value?.length) payload[field] = result.value;
  }

  if (!payload.route_number || !payload.destination) {
    return { ok: false, status: 400, message: "Route and destination are required." };
  }
  if (!payload.overall_experience?.length) {
    return { ok: false, status: 400, message: "Overall experience rating is required." };
  }

  return { ok: true, payload };
}

function roundPublicCoordinate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return cleanString(value, 24);
  return num.toFixed(2);
}

export function sanitizePublicPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  for (const key of PUBLIC_PAYLOAD_KEYS) {
    if (raw[key] === undefined || raw[key] === null || raw[key] === "") continue;
    if (RATING_ARRAY_FIELDS.has(key)) {
      const result = sanitizeRatingArray(key, raw[key]);
      if (result.value?.length) out[key] = result.value;
      continue;
    }
    const max = STRING_FIELDS[key];
    if (!max) continue;
    if (key === "start_latitude" || key === "start_longitude") {
      out[key] = roundPublicCoordinate(raw[key]);
      continue;
    }
    out[key] = cleanString(raw[key], max);
  }
  return out;
}

export function stripPrivateFieldsForStorage(payload) {
  const copy = { ...payload };
  delete copy.ipAddress;
  delete copy.user_name;
  delete copy.user_phone;
  return copy;
}
