-- src/main/db/migrations/0016_blocked_senders.sql
CREATE TABLE IF NOT EXISTS blocked_senders (
  address TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);