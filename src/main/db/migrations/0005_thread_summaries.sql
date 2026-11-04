-- src/main/db/migrations/0005_thread_summaries.sql
CREATE TABLE IF NOT EXISTS thread_summaries (
  thread_id TEXT PRIMARY KEY,
  upto_message_id TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  summary TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);