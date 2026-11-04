-- src/main/db/migrations/0012_chats.sql
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  turns_json TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);