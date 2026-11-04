-- src/main/db/migrations/0008_contacts.sql
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  emails_json TEXT NOT NULL DEFAULT '[]',
  phones_json TEXT NOT NULL DEFAULT '[]',
  org TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  google_id TEXT,
  starred INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(display_name);
CREATE INDEX IF NOT EXISTS idx_contacts_google ON contacts(account_id, google_id);