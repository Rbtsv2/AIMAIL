-- src/main/db/migrations/0009_calendar.sql
CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  remote_id TEXT,
  url TEXT,
  ctag TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  read_only INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  uid TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  rrule TEXT,
  organizer TEXT,
  attendees_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'confirmed',
  remote_id TEXT,
  etag TEXT,
  ics TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_range ON events(calendar_id, start, "end");
CREATE INDEX IF NOT EXISTS idx_events_uid ON events(calendar_id, uid);
INSERT OR IGNORE INTO calendars(id, account_id, kind, name, color, enabled, is_default, created_at) VALUES ('local-default', NULL, 'local', 'Personnel', '#4f6bed', 1, 1, strftime('%s','now') * 1000);