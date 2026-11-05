-- src/main/db/migrations/0021_rules.sql
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  account_id TEXT,                      -- NULL = tous les comptes
  match TEXT NOT NULL DEFAULT 'all',    -- all | any
  conditions_json TEXT NOT NULL DEFAULT '[]',
  actions_json TEXT NOT NULL DEFAULT '[]',
  stop INTEGER NOT NULL DEFAULT 1,      -- ne pas évaluer les règles suivantes si celle-ci s'applique
  created_at INTEGER NOT NULL
);
-- rétention par dossier : suppression définitive des messages plus anciens que N jours (NULL = jamais)
ALTER TABLE folders ADD COLUMN purge_days INTEGER;