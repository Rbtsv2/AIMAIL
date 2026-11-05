// src/main/ipc/rules.ipc.ts
import { handle } from './index'
import { getDb } from '../db'
import { RuleRepo } from '../db/repositories/RuleRepo'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { applyRules } from '../sync/Rules'

export function registerRulesIpc(): void {
  handle('rules:list', () => RuleRepo.list())
  handle('rules:save', (rule) => RuleRepo.save(rule))
  handle('rules:delete', (ruleId) => RuleRepo.delete(ruleId))
  handle('rules:reorder', (ids) => RuleRepo.reorder(ids))
  // exécution sur l'existant : toute la Réception (et Indésirables), 5 000 messages max par dossier, du plus récent au plus ancien
  handle('rules:run', async (opts) => {
    const since = opts.days ? Date.now() - opts.days * 86400_000 : 0
    const accounts = AccountRepo.list().filter((a) => !opts.accountId || a.id === opts.accountId)
    let touched = 0, moved = 0
    for (const a of accounts) {
      for (const role of ['inbox', 'spam'] as const) {
        const f = FolderRepo.byRole(a.id, role); if (!f) continue
        const ids = (getDb().prepare('SELECT id FROM messages WHERE folder_id = ? AND date >= ? ORDER BY date DESC LIMIT 5000').all(f.id, since) as any[]).map((r) => r.id)
        if (!ids.length) continue
        const r = await applyRules(ids, { onlyRuleId: opts.ruleId, folderRole: role })
        touched += r.touched; moved += r.moved.length
      }
    }
    return { touched, moved }
  })
  handle('folders:setRetention', (folderId, days) => { FolderRepo.setPurgeDays(folderId, days) })
}