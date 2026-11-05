-- src/main/db/migrations/0020_muted_senders.sql
-- Expéditeurs pour lesquels l'assistant ne prépare jamais de réponse
CREATE TABLE IF NOT EXISTS muted_senders (
  address TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);