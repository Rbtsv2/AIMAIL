-- src/main/db/migrations/0017_account_purge.sql
ALTER TABLE accounts ADD COLUMN purge_spam_days INTEGER;   -- NULL = réglage général
ALTER TABLE accounts ADD COLUMN purge_trash_days INTEGER;  -- NULL = réglage général