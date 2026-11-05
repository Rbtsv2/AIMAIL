// src/main/sync/BodyPrefetcher.ts
// Préchargement des corps de messages en arrière-plan (connexion dédiée) : les mails récents s'ouvrent sans attente.
import { getDb } from '../db'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { SyncManager } from './SyncManager'
import { log } from '../utils/logger'

const RECENT_DAYS = 60
const PER_RUN = 150

class Prefetcher {
  private queues = new Map<string, string[]>()   // accountId → ids (priorité en tête)
  private running = new Set<string>()
  private queued = new Set<string>()

  /** Messages récents sans corps dans un dossier (après une synchro). */
  enqueueRecent(accountId: string, folderId: string): void {
    const f = FolderRepo.get(folderId); if (!f || f.role === 'trash' || f.role === 'spam' || f.role === 'drafts') return
    const since = Date.now() - RECENT_DAYS * 86400_000
    const ids = (getDb().prepare('SELECT id FROM messages WHERE folder_id = ? AND body_fetched = 0 AND date >= ? ORDER BY date DESC LIMIT ?').all(folderId, since, PER_RUN) as any[]).map((r) => r.id)
    this.push(accountId, ids, false)
  }

  /** Fil que l'utilisateur survole ou sélectionne : passe devant tout le reste. */
  enqueueThread(threadId: string): void {
    const msgs = MessageRepo.byThread(threadId).filter((m) => !m.bodyFetched)
    if (!msgs.length) return
    this.push(msgs[0].accountId, msgs.map((m) => m.id), true)
  }

  private push(accountId: string, ids: string[], front: boolean): void {
    const fresh = ids.filter((x) => !this.queued.has(x))
    if (!fresh.length) return
    for (const x of fresh) this.queued.add(x)
    const q = this.queues.get(accountId) ?? []
    this.queues.set(accountId, front ? [...fresh, ...q] : [...q, ...fresh])
    void this.run(accountId)
  }

  private async run(accountId: string): Promise<void> {
    if (this.running.has(accountId)) return
    this.running.add(accountId)
    try {
      for (;;) {
        const q = this.queues.get(accountId); const id = q?.shift(); if (!id) break
        this.queued.delete(id)
        const m = MessageRepo.get(id); if (!m || m.bodyFetched) continue
        try { await SyncManager.engine(accountId).fetchBody(m) } catch (e: any) { const msg = e?.message ?? String(e); if (!/introuvable/.test(msg)) log.warn('prefetch', msg); await new Promise((r) => setTimeout(r, /introuvable/.test(msg) ? 0 : 2000)) }
        await new Promise((r) => setTimeout(r, 60))   // laisser respirer la connexion
      }
    } finally { this.running.delete(accountId) }
  }
}

export const BodyPrefetcher = new Prefetcher()