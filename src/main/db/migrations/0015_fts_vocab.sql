-- src/main/db/migrations/0015_fts_vocab.sql
CREATE VIRTUAL TABLE IF NOT EXISTS messages_vocab USING fts5vocab(messages_fts, 'row');