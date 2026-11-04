-- src/main/db/migrations/0004_category.sql
ALTER TABLE messages ADD COLUMN category TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_category ON messages(account_id, category);