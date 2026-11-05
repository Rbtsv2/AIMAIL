// src/main/sync/Rules.ts
// Règles de tri : évaluation des conditions sur un message, exécution des actions (déplacement serveur + local).
import type { Message } from '@shared/models/Message'
import type { Rule, RuleCondition } from '@shared/models/Rule'
import { RuleRepo } from '../db/repositories/RuleRepo'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { ThreadRepo } from '../db/repositories/ThreadRepo'
import { SyncManager } from './SyncManager'
import { ensureRoleFolder } from '../ipc/mail.ipc'
import { events } from './events'
import { log } from '../utils/logger'

const nz = (x: string) => (x ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function fieldValue(m: Message, c: RuleCondition): string {
  switch (c.field) {
    case 'from': return `${m.from.name ?? ''} <${m.from.address}>`
    case 'to': return [...(m.to ?? []), ...(m.cc ?? [])].map((a) => `${a.name ?? ''} <${a.address}>`).join(', ')
    case 'subject': return m.subject
    case 'body': return (m.bodyText || m.snippet || '').slice(0, 20000)
    case 'attachment': return (m.attachments ?? []).filter((a) => !a.inline).map((a) => a.filename).join(', ')
    case 'category': return m.category ?? ''
    case 'account': return m.accountId
  }
}

export function matches(m: Message, c: RuleCondition): boolean {
  const v = nz(fieldValue(m, c)); const t = nz(c.value)
  if (c.field === 'attachment' && (c.op === 'is' || c.op === 'isNot')) { const has = !!(m.attachments ?? []).some((a) => !a.inline); return c.op === 'is' ? has : !has }
  switch (c.op) {
    case 'contains': return !!t && v.includes(t)
    case 'notContains': return !t || !v.includes(t)
    case 'equals': case 'is': return v === t || (c.field === 'from' && v.includes(`<${t}>`))
    case 'isNot': return !(v === t || (c.field === 'from' && v.includes(`<${t}>`)))
    case 'startsWith': return v.startsWith(t)
    case 'endsWith': return v.endsWith(t)
  }
}

export function ruleMatches(m: Message, r: Rule): boolean {
  if (!r.enabled || !r.conditions.length) return false
  if (r.accountId && r.accountId !== m.accountId) return false
  const res = r.conditions.map((c) => matches(m, c))
  return r.match === 'any' ? res.some(Boolean) : res.every(Boolean)
}

/** Applique les règles à une liste de messages (du même dossier). Renvoie les ids des messages déplacés hors du dossier. */
export async function applyRules(messageIds: string[], opts: { rules?: Rule[]; onlyRuleId?: string } = {}): Promise<{ moved: string[]; touched: number }> {
  const rules = (opts.rules ?? RuleRepo.list()).filter((r) => r.enabled && (!opts.onlyRuleId || r.id === opts.onlyRuleId))
  const moved: string[] = []
  let touched = 0
  if (!rules.length) return { moved, touched }
  // regrouper les déplacements par (dossier source → cible) pour limiter les allers-retours IMAP
  const moves = new Map<string, { from: string; to: string; ids: string[] }>()
  const flags: { id: string; unread?: boolean; starred?: boolean }[] = []
  for (const mid of messageIds) {
    const m = MessageRepo.get(mid); if (!m) continue
    for (const r of rules) {
      if (!ruleMatches(m, r)) continue
      touched++
      let movedThis = false
      for (const a of r.actions) {
        if (a.type === 'move' || a.type === 'spam' || a.type === 'trash') {
          let target = a.type === 'move' ? FolderRepo.get(a.folderId) ?? undefined : undefined
          if (a.type !== 'move') target = await ensureRoleFolder(m.accountId, a.type) ?? undefined
          if (!target || target.accountId !== m.accountId || target.id === m.folderId) continue
          const key = `${m.folderId}>${target.id}`
          const g = moves.get(key) ?? { from: m.folderId, to: target.id, ids: [] }; g.ids.push(m.id); moves.set(key, g); movedThis = true
        } else if (a.type === 'markRead') flags.push({ id: m.id, unread: false })
        else if (a.type === 'star') flags.push({ id: m.id, starred: true })
        else if (a.type === 'category') MessageRepo.setCategory(m.id, a.value)
      }
      if (movedThis) moved.push(m.id)
      if (r.stop) break
    }
  }
  for (const f of flags) {
    const m = MessageRepo.get(f.id); if (!m) continue
    const folder = FolderRepo.get(m.folderId); if (!folder) continue
    try { await SyncManager.engine(m.accountId).setFlags(folder, [m.uid], { unread: f.unread, starred: f.starred }); MessageRepo.setFlags([m.id], { unread: f.unread, starred: f.starred }) } catch (e: any) { log.warn('rules', 'flags', e?.message ?? e) }
  }
  for (const g of moves.values()) {
    const from = FolderRepo.get(g.from); const to = FolderRepo.get(g.to); if (!from || !to) continue
    const msgs = g.ids.map((x) => MessageRepo.get(x)).filter((x): x is Message => !!x)
    try {
      const uidMap = await SyncManager.engine(from.accountId).move(from, msgs.map((x) => x.uid), to)
      const byId: Record<string, number> = {}; for (const x of msgs) byId[x.id] = uidMap[x.uid] ?? 0
      MessageRepo.moveToFolder(msgs.map((x) => x.id), to.id, byId)
      FolderRepo.recount(from.id); FolderRepo.recount(to.id)
      for (const t of new Set(msgs.map((x) => x.threadId))) ThreadRepo.recompute(t)
      log.info('rules', `${msgs.length} message(s) → ${to.path}`)
    } catch (e: any) { log.warn('rules', 'move', e?.message ?? e) }
  }
  if (touched) for (const acc of new Set(messageIds.map((x) => MessageRepo.get(x)?.accountId).filter((x): x is string => !!x))) events.emitEvent('mail:changed', { accountId: acc })
  return { moved, touched }
}