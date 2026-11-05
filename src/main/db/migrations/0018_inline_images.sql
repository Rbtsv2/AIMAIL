-- src/main/db/migrations/0018_inline_images.sql
-- Images de signature / incorporées (avec Content-ID, ou image non marquée « attachment ») : ne comptent plus comme pièces jointes.
UPDATE attachments SET inline = 1 WHERE mime_type LIKE 'image/%' AND content_id IS NOT NULL;
UPDATE messages SET has_attachments = CASE WHEN EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = messages.id AND a.inline = 0) THEN 1 ELSE 0 END;
UPDATE threads SET has_attachments = CASE WHEN EXISTS (SELECT 1 FROM messages m WHERE m.thread_id = threads.id AND m.has_attachments = 1) THEN 1 ELSE 0 END;