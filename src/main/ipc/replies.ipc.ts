// src/main/ipc/replies.ipc.ts
// Préparation en lot des réponses aux messages reçus : sélection des candidats, génération séquentielle en arrière-plan,
// conservation jusqu'à envoi ou rejet.
import { handle } from './index'
import { getDb } from '../db'
import { AiReplyRepo } from '../db/repositories/AiReplyRepo'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { SettingsRepo } from '../db/repositories/SettingsRepo'
import { AiService } from '../ai/AiService'
import { events } from '../sync/events'
import { log } from '../utils/logger'

const BATCH_LIMIT = 50
let running = false
let stopRequested = false
const NOREPLY = /no[-_.]?reply|ne[-_.]?pas[-_.]?repondre|donotreply|mailer-daemon|notification|newsletter|news@|info@|alert|bounce|postmaster/i

function changed(): void { events.emitEvent('replies:changed', AiReplyRepo.counts()) }

/** Derniers messages reçus auxquels il est pertinent de répondre : dernier message de son fil, pas de nous, pas automatique. */
function candidates(opts: { accountId?: string; limit: number; days: number }): { id: string; threadId: string; accountId: string }[] {
  const own = new Set(AccountRepo.list().map((a) => a.email.toLowerCase()))
  const muted = new Set((getDb().prepare('SELECT address FROM muted_senders').all() as any[]).map((r) => r.address))
  // days = 0 : tous les messages en attente, sans limite de date
  const since = opts.days > 0 ? Date.now() - opts.days * 86400_000 : 0
  const inboxIds = AccountRepo.list().filter((a) => !opts.accountId || a.id === opts.accountId).map((a) => FolderRepo.byRole(a.id, 'inbox')?.id).filter((x): x is string => !!x)
  if (!inboxIds.length) return []
  const rows = getDb().prepare(`SELECT m.id, m.thread_id, m.account_id, m.from_json, m.category, m.date FROM messages m
    WHERE m.folder_id IN (${inboxIds.map(() => '?').join(',')}) AND m.date >= ?
      AND m.id = (SELECT id FROM messages x WHERE x.thread_id = m.thread_id ORDER BY x.date DESC LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM ai_replies r WHERE r.message_id = m.id AND r.status IN ('ready','sent','dismissed','generating','pending'))
    ORDER BY m.date DESC LIMIT ?`).all(...inboxIds, since, Math.max(opts.limit * 6, 2000)) as any[]
  const out: { id: string; threadId: string; accountId: string }[] = []
  for (const r of rows) {
    const from = JSON.parse(r.from_json) as { name?: string; address: string }
    const addr = (from.address ?? '').toLowerCase()
    if (own.has(addr) || muted.has(addr) || NOREPLY.test(addr) || NOREPLY.test(from.name ?? '')) continue
    if (r.category === 'newsletter' || r.category === 'spam') continue
    out.push({ id: r.id, threadId: r.thread_id, accountId: r.account_id })
    if (out.length >= opts.limit) break
  }
  return out
}

const isNight = () => { const h = new Date().getHours(); return h >= 22 || h < 7 }
let nightTimer: NodeJS.Timeout | null = null
/** Attente imposée par le rythme choisi : 20 s entre deux réponses, ou jusqu'à 22 h en mode nuit (sauf lancement manuel). */
async function pace(manual: boolean): Promise<boolean> {
  const p = SettingsRepo.ai().pace ?? 'continuous'
  if (p === 'paced') { await new Promise((r) => setTimeout(r, 20_000)); return true }
  if (p === 'night' && !manual && !isNight()) {
    if (!nightTimer) { nightTimer = setTimeout(() => { nightTimer = null; void runBatch() }, 15 * 60_000) }   // on réessaie toutes les 15 min jusqu'à la nuit
    return false
  }
  return true
}

async function runBatch(manual = false): Promise<void> {
  if (running) return
  running = true; stopRequested = false
  try {
    let first = true
    for (;;) {
      if (stopRequested) break
      const next = AiReplyRepo.list(['pending'])[0]
      if (!next) break
      if (!first && !(await pace(manual))) break
      if (first && SettingsRepo.ai().pace === 'night' && !manual && !isNight()) { await pace(manual); break }
      first = false
      if (stopRequested) break
      AiReplyRepo.setStatus(next.messageId, 'generating'); changed()
      try {
        const text = await AiService.run({ task: 'reply', accountId: next.accountId, threadId: next.threadId }, `batch:${next.messageId}`)
        if (text.trim()) AiReplyRepo.setResult(next.messageId, text.trim())
        else AiReplyRepo.setStatus(next.messageId, 'error', 'réponse vide')
      } catch (e: any) {
        AiReplyRepo.setStatus(next.messageId, 'error', e?.message ?? String(e))
        log.warn('replies', next.messageId, e?.message ?? e)
      }
      changed()
    }
  } finally { running = false; changed() }
}

export function registerRepliesIpc(): void {
  handle('muted:list', () => getDb().prepare('SELECT address, created_at FROM muted_senders ORDER BY created_at DESC').all().map((r: any) => ({ address: r.address, createdAt: r.created_at })))
  handle('muted:toggle', (address) => {
    const a = address.toLowerCase().trim()
    const has = getDb().prepare('SELECT 1 FROM muted_senders WHERE address = ?').get(a)
    if (has) { getDb().prepare('DELETE FROM muted_senders WHERE address = ?').run(a); return false }
    getDb().prepare('INSERT INTO muted_senders(address, created_at) VALUES (?, ?)').run(a, Date.now())
    // réponses en attente de cet expéditeur : retirées
    for (const r of AiReplyRepo.list(['pending', 'generating', 'ready', 'error'])) { const m = MessageRepo.get(r.messageId); if (m && m.from.address.toLowerCase() === a) AiReplyRepo.setStatus(r.messageId, 'dismissed') }
    changed()
    return true
  })
  handle('muted:remove', (address) => { getDb().prepare('DELETE FROM muted_senders WHERE address = ?').run(address.toLowerCase()) })
  handle('replies:list', (statuses) => AiReplyRepo.list(statuses))
  handle('replies:restore', (messageId) => { const r = AiReplyRepo.byMessage(messageId); if (!r) return; AiReplyRepo.setStatus(messageId, r.text.trim() ? 'ready' : 'pending'); changed(); if (!r.text.trim()) void runBatch() })
  handle('replies:counts', () => AiReplyRepo.counts())
  handle('replies:candidates', (opts) => candidates({ accountId: opts?.accountId, limit: opts?.limit ?? BATCH_LIMIT, days: opts?.days ?? 0 }).length)
  handle('replies:forThread', (threadId) => AiReplyRepo.byThread(threadId) ?? null)
  handle('replies:generate', (opts) => {
    if (!SettingsRepo.ai().enabled) throw new Error('Activez l’assistant dans les Réglages')
    // lancement manuel : le mode « nuit » est ignoré (l'utilisateur l'a demandé maintenant)
    const list = candidates({ accountId: opts?.accountId, limit: opts?.limit ?? BATCH_LIMIT, days: opts?.days ?? 0 })
    for (const c of list) AiReplyRepo.upsert(c.id, c.threadId, c.accountId, 'pending')
    changed()
    void runBatch(true)
    return { queued: list.length }
  })
  handle('replies:retry', (messageId) => { const m = MessageRepo.get(messageId); if (!m) return; AiReplyRepo.upsert(m.id, m.threadId, m.accountId, 'pending'); changed(); void runBatch(true) })
  handle('replies:stop', () => { stopRequested = true; for (const r of AiReplyRepo.list(['pending'])) AiReplyRepo.setStatus(r.messageId, 'dismissed'); changed() })
  handle('replies:dismiss', (messageId) => { AiReplyRepo.setStatus(messageId, 'dismissed'); changed() })
  handle('replies:update', (messageId, text) => { AiReplyRepo.setText(messageId, text) })
  handle('replies:markSent', (threadId) => { AiReplyRepo.markThreadSent(threadId); changed() })
}