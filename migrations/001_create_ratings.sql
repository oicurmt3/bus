CREATE TABLE IF NOT EXISTS bus_ratings (
  id BIGSERIAL PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bus_ratings_created_at_idx ON bus_ratings (created_at DESC);

CREATE TABLE IF NOT EXISTS rating_rate_limit (
  ip_hash TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rating_rate_limit_ip_submitted_idx
  ON rating_rate_limit (ip_hash, submitted_at DESC);
