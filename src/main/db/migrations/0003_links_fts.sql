-- src/main/db/migrations/0003_links_fts.sql
CREATE TABLE IF NOT EXISTS message_links (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  parent_message_id TEXT NOT NULL,
  child_message_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  to_json TEXT NOT NULL DEFAULT '[]',
  date INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_parent ON message_links(account_id, parent_message_id);
CREATE INDEX IF NOT EXISTS idx_links_child ON message_links(account_id, child_message_id);

DROP TABLE IF EXISTS messages_fts;
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  id UNINDEXED, subject, from_text, to_text, body_text, tokenize='unicode61 remove_diacritics 2'
);
INSERT INTO messages_fts(id, subject, from_text, to_text, body_text)
  SELECT id, subject, from_json, to_json || ' ' || cc_json, COALESCE(body_text, snippet) FROM messages;