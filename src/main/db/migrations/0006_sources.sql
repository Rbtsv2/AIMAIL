-- src/main/db/migrations/0006_sources.sql
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'GET',
  body_template TEXT NOT NULL DEFAULT '',
  auth_kind TEXT NOT NULL DEFAULT 'none',
  file_path TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  cached_text TEXT,
  cached_at INTEGER,
  created_at INTEGER NOT NULL
);