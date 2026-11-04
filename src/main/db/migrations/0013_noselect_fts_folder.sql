-- src/main/db/migrations/0013_noselect_fts_folder.sql
ALTER TABLE folders ADD COLUMN noselect INTEGER NOT NULL DEFAULT 0;
DROP TABLE IF EXISTS messages_fts;
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  id UNINDEXED, subject, from_text, to_text, body_text, folder_text, tokenize='unicode61 remove_diacritics 2'
);
INSERT INTO messages_fts(id, subject, from_text, to_text, body_text, folder_text)
  SELECT m.id, m.subject, m.from_json, m.to_json || ' ' || m.cc_json, COALESCE(m.body_text, m.snippet), replace(replace(f.path, '.', ' '), '/', ' ')
  FROM messages m JOIN folders f ON f.id = m.folder_id;