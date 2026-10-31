CREATE TABLE reading_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX reading_sessions_expiry ON reading_sessions (expires_at);

CREATE TABLE reading_progress (
  account_id TEXT NOT NULL,
  path TEXT NOT NULL,
  progress INTEGER NOT NULL CHECK (progress BETWEEN 1 AND 100),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, path)
);
