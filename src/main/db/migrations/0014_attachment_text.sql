-- src/main/db/migrations/0014_attachment_text.sql
ALTER TABLE attachments ADD COLUMN text TEXT;
DROP TABLE IF EXISTS messages_fts;
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  id UNINDEXED, subject, from_text, to_text, body_text, folder_text, attachment_text, tokenize='unicode61 remove_diacritics 2'
);
INSERT INTO messages_fts(id, subject, from_text, to_text, body_text, folder_text, attachment_text)
  SELECT m.id, m.subject, m.from_json, m.to_json || ' ' || m.cc_json, COALESCE(m.body_text, m.snippet), replace(replace(f.path, '.', ' '), '/', ' '), ''
  FROM messages m JOIN folders f ON f.id = m.folder_id;