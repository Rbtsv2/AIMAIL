-- src/main/db/migrations/0011_sources_multi.sql
ALTER TABLE sources ADD COLUMN account_ids_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE sources ADD COLUMN urls_json TEXT NOT NULL DEFAULT '[]';
UPDATE sources SET account_ids_json = CASE WHEN account_id IS NULL THEN '[]' ELSE '["' || account_id || '"]' END;
UPDATE sources SET urls_json = CASE WHEN url = '' THEN '[]' ELSE '["' || replace(url, '"', '\"') || '"]' END;