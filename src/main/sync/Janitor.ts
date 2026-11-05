// src/main/sync/Janitor.ts
// Nettoyage automatique : suppression définitive des messages anciens dans Indésirables (et Corbeille si activé).
import { getDb } from '../db'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { SettingsRepo } from '../db/repositories/SettingsRepo'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { SyncManager } from './SyncManager'
import { events } from './events'
import { log } from '../utils/logger'

let running = false

export const Janitor = {
  async runOnce(): Promise<void> {
    if (running) return
    running = true
    try {
      const app = SettingsRepo.app()
      let total = 0
      for (const a of AccountRepo.list()) {
        // par compte, sinon réglage général ; 0 = jamais
        const rules: { role: 'spam' | 'trash'; days: number }[] = []
        const spamDays = a.purgeSpamDays ?? app.purgeSpamDays ?? 0
        const trashDays = a.purgeTrashDays ?? app.purgeTrashDays ?? 0
        if (spamDays > 0) rules.push({ role: 'spam', days: spamDays })
        if (trashDays > 0) rules.push({ role: 'trash', days: trashDays })
        // dossiers avec rétention propre
        for (const f of FolderRepo.list(a.id)) if (f.purgeDays && f.purgeDays > 0 && f.role !== 'spam' && f.role !== 'trash') rules.push({ role: f.id as any, days: f.purgeDays })
        for (const rule of rules) {
        const f = FolderRepo.list(a.id).find((x) => x.role === rule.role) ?? FolderRepo.get(rule.role)
        if (!f) continue
        const cutoff = Date.now() - rule.days * 86400_000
        const rows = getDb().prepare('SELECT id, uid FROM messages WHERE folder_id = ? AND date < ? LIMIT 500').all(f.id, cutoff) as { id: string; uid: number }[]
        if (!rows.length) continue
        try {
          await SyncManager.engine(a.id).delete(f, rows.map((r) => r.uid))
          MessageRepo.delete(rows.map((r) => r.id))
          FolderRepo.recount(f.id)
          total += rows.length
          events.emitEvent('mail:changed', { accountId: a.id })
        } catch (e: any) { log.warn('janitor', `${a.email} ${f.path}: ${e?.message ?? e}`) }
        }
      }
      if (total) log.info('janitor', `${total} message(s) ancien(s) supprimé(s) définitivement`)
    } finally { running = false }
  }
}