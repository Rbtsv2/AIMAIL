// src/main/sync/Indexer.ts
// Télécharge en arrière-plan le texte des messages jamais ouverts pour une recherche plein texte complète.
import { getDb } from '../db'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { SettingsRepo } from '../db/repositories/SettingsRepo'
import { SyncManager } from './SyncManager'
import { log } from '../utils/logger'
import { convert } from 'html-to-text'
import { extractText, EXTRACTABLE } from '../attachments/extract'

let running = false
const BATCH = 150

export const Indexer = {
  pending(): number { return (getDb().prepare("SELECT COUNT(*) c FROM messages m JOIN folders f ON f.id = m.folder_id WHERE m.body_fetched = 0 AND f.role NOT IN ('trash','spam')").get() as any).c },
  async runOnce(): Promise<void> {
    if (running || SettingsRepo.app().fullTextIndex === false) return
    running = true
    const t0 = Date.now()
    let done = 0, failed = 0
    try {
      // rattrapage : messages déjà lus mais sans texte (HTML seul) → texte dérivé du HTML
      const fix = getDb().prepare("SELECT id, body_html FROM messages WHERE body_fetched = 1 AND (body_text IS NULL OR body_text = '') AND body_html IS NOT NULL LIMIT 300").all() as { id: string; body_html: string }[]
      for (const r of fix) { try { const t = convert(r.body_html, { wordwrap: false, selectors: [{ selector: 'a', options: { ignoreHref: true } }, { selector: 'img', format: 'skip' }, { selector: 'style', format: 'skip' }] }); MessageRepo.setBody(r.id, r.body_html, t) } catch {} }
      if (fix.length) log.info('index', `${fix.length} message(s) HTML réindexé(s)`)
      // pièces jointes lisibles jamais extraites (messages joints, PDF, Word…)
      const atts = getDb().prepare("SELECT id, filename, mime_type, local_path FROM attachments WHERE text IS NULL AND inline = 0 AND local_path IS NOT NULL LIMIT 120").all() as { id: string; filename: string; mime_type: string; local_path: string }[]
      let n = 0
      for (const a of atts) {
        if (!(EXTRACTABLE.test(a.filename) || /pdf|wordprocessingml|text\/|message\/rfc822/.test(a.mime_type))) { MessageRepo.setAttachmentText(a.id, ''); continue }
        try { const t = await extractText(a.local_path, a.mime_type); MessageRepo.setAttachmentText(a.id, t || ''); if (t) n++ } catch { MessageRepo.setAttachmentText(a.id, '') }
      }
      if (n) log.info('index', `${n} pièce(s) jointe(s) extraite(s)`)
      const rows = getDb().prepare("SELECT m.id, m.account_id FROM messages m JOIN folders f ON f.id = m.folder_id WHERE m.body_fetched = 0 AND f.role NOT IN ('trash','spam') ORDER BY m.date DESC LIMIT ?").all(BATCH) as { id: string; account_id: string }[]
      if (!rows.length) return
      for (const r of rows) {
        const m = MessageRepo.get(r.id)
        if (!m) continue
        try { await SyncManager.engine(m.accountId).fetchBody(m); done++ } catch (e: any) { failed++; if (failed > 10) break }
        await new Promise((res) => setTimeout(res, 40))
      }
      log.info('index', `${done} message(s) indexé(s) en ${Math.round((Date.now() - t0) / 1000)} s, reste ${this.pending()}`)
    } finally { running = false }
  }
}