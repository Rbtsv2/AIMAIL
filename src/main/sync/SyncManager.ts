// src/main/sync/SyncManager.ts
import type { Account } from '@shared/models/Account'
import type { SyncStatus } from '@shared/ipc'
import { ImapSyncEngine } from './ImapSyncEngine'
import type { SyncEngine } from './SyncEngine'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { events } from './events'
import { log } from '../utils/logger'

interface Slot {
  account: Account
  engine: SyncEngine
  status: SyncStatus
  stopIdle?: () => void
  timer?: NodeJS.Timeout
  backoff: number
  running: boolean
}

class SyncManagerImpl {
  private slots = new Map<string, Slot>()

  async start(): Promise<void> {
    try { FolderRepo.recountAll() } catch (e: any) { log.warn('sync', 'recomptage', e?.message ?? e) }
    for (const a of AccountRepo.list()) this.attach(a)
  }

  attach(account: Account): void {
    if (this.slots.has(account.id)) return
    const slot: Slot = { account, engine: new ImapSyncEngine(account), status: { accountId: account.id, state: 'idle' }, backoff: 5000, running: false }
    this.slots.set(account.id, slot)
    void this.loop(slot)
  }

  async detach(accountId: string): Promise<void> {
    const s = this.slots.get(accountId)
    if (!s) return
    s.stopIdle?.(); if (s.timer) clearTimeout(s.timer)
    await s.engine.disconnect()
    this.slots.delete(accountId)
  }

  engine(accountId: string): SyncEngine {
    const s = this.slots.get(accountId)
    if (!s) throw new Error('account not attached')
    return s.engine
  }

  statuses(): SyncStatus[] { return [...this.slots.values()].map((s) => s.status) }

  async syncNow(accountId?: string): Promise<void> {
    const targets = accountId ? [this.slots.get(accountId)].filter(Boolean) as Slot[] : [...this.slots.values()]
    await Promise.all(targets.map((s) => this.syncOnce(s)))
  }

  private setStatus(s: Slot, patch: Partial<SyncStatus>): void {
    s.status = { ...s.status, ...patch }
    events.emitEvent('sync:status', s.status)
  }

  private async syncOnce(s: Slot): Promise<void> {
    if (s.running) return
    s.running = true
    this.setStatus(s, { state: 'syncing', error: undefined })
    try {
      const folders = await s.engine.listFolders()
      const order = ['inbox', 'sent', 'drafts', 'archive', 'starred', 'custom', 'trash', 'spam', 'all']
      folders.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
      let failed: string | undefined
      for (const f of folders) {
        if (f.role === 'all' || f.noselect) continue
        try {
          await s.engine.syncFolder(f, {})
          events.emitEvent('mail:changed', { accountId: s.account.id, folderIds: [f.id] })
        } catch (e: any) {
          failed = `${f.name} : ${e?.message ?? e}`
          log.warn('sync', s.account.email, f.path, e?.message ?? e)
        }
      }
      if (failed) throw new Error(failed)
      s.backoff = 5000
      this.setStatus(s, { state: 'idle', lastSync: Date.now() })
    } catch (e: any) {
      log.error('sync', s.account.email, e?.message ?? e)
      this.setStatus(s, { state: /ENOTFOUND|ECONN|ETIMEDOUT/.test(String(e?.code ?? e?.message)) ? 'offline' : 'error', error: e?.message })
      s.backoff = Math.min(s.backoff * 2, 5 * 60_000)
    } finally { s.running = false }
  }

  private inboxPending = new Set<string>()
  private async syncInbox(s: Slot): Promise<void> {
    if (this.inboxPending.has(s.account.id)) return
    this.inboxPending.add(s.account.id)
    try {
      const inbox = FolderRepo.byRole(s.account.id, 'inbox')
      if (!inbox) return
      await s.engine.syncFolder(inbox, {})
      events.emitEvent('mail:changed', { accountId: s.account.id, folderIds: [inbox.id] })
    } catch (e: any) { log.warn('sync', 'inbox', s.account.email, e?.message ?? e) }
    finally { this.inboxPending.delete(s.account.id) }
  }

  private async loop(s: Slot): Promise<void> {
    await this.syncOnce(s)
    try {
      const inbox = FolderRepo.byRole(s.account.id, 'inbox')
      if (inbox && !s.stopIdle) {
        s.stopIdle = await s.engine.idle(inbox, () => void this.syncInbox(s))
      }
    } catch (e: any) { log.warn('idle', s.account.email, e?.message) }
    s.timer = setTimeout(() => void this.loop(s), s.status.state === 'idle' ? 5 * 60_000 : s.backoff)
  }

  /** Après une mise en veille ou une coupure réseau : les sockets IMAP sont morts sans le savoir → tout reconnecter et resynchroniser. */
  async reconnectAll(reason: string): Promise<void> {
    log.info('sync', `reconnexion de tous les comptes (${reason})`)
    for (const s of this.slots.values()) {
      s.stopIdle?.(); s.stopIdle = undefined
      if (s.timer) { clearTimeout(s.timer); s.timer = undefined }
      try { await s.engine.disconnect() } catch {}
      s.backoff = 5000
      // relance décalée pour laisser le réseau revenir
      s.timer = setTimeout(() => void this.loop(s), 3000)
    }
  }

  async stopAll(): Promise<void> {
    for (const idKey of [...this.slots.keys()]) await this.detach(idKey)
  }
}

export const SyncManager = new SyncManagerImpl()