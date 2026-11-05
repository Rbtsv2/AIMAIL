-- src/main/db/migrations/0019_ai_replies.sql
-- Réponses préparées par l'assistant, conservées jusqu'à envoi ou rejet (évite de régénérer à chaque ouverture)
CREATE TABLE IF NOT EXISTS ai_replies (
  message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | generating | ready | sent | dismissed | error
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_replies_status ON ai_replies(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_ai_replies_thread ON ai_replies(thread_id);