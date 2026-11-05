-- src/main/db/migrations/0022_rules_scope.sql
ALTER TABLE rules ADD COLUMN scope TEXT NOT NULL DEFAULT 'inbox';