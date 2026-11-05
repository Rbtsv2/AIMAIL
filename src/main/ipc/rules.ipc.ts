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
  // exécution sur l'existant : messages de la Réception des N derniers jours (défaut 30)
  handle('rules:run', async (opts) => {
    const since = Date.now() - (opts.days ?? 30) * 86400_000
    const accounts = AccountRepo.list().filter((a) => !opts.accountId || a.id === opts.accountId)
    let touched = 0, moved = 0
    for (const a of accounts) {
      const inbox = FolderRepo.byRole(a.id, 'inbox'); if (!inbox) continue
      const ids = (getDb().prepare('SELECT id FROM messages WHERE folder_id = ? AND date >= ? ORDER BY date DESC LIMIT 2000').all(inbox.id, since) as any[]).map((r) => r.id)
      const r = await applyRules(ids, { onlyRuleId: opts.ruleId })
      touched += r.touched; moved += r.moved.length
    }
    return { touched, moved }
  })
  handle('folders:setRetention', (folderId, days) => { FolderRepo.setPurgeDays(folderId, days) })
}