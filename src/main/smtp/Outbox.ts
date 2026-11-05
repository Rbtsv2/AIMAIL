// src/main/smtp/Outbox.ts
import type { Draft, OutboxItem } from '@shared/models/Draft'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { SettingsRepo } from '../db/repositories/SettingsRepo'
import { DraftRepo } from '../db/repositories/DraftRepo'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { buildMailOptions } from './MimeBuilder'
import { sendMail } from './Sender'
import { SyncManager } from '../sync/SyncManager'
import { events } from '../sync/events'
import { id } from '../db'
import { log } from '../utils/logger'
import { AiReplyRepo } from '../db/repositories/AiReplyRepo'
import { DraftService } from './DraftService'
import { ContactRepo } from '../db/repositories/ContactRepo'

const items = new Map<string, OutboxItem & { timer: NodeJS.Timeout }>()

function publish(item: OutboxItem): void {
  events.emitEvent('outbox:changed', { id: item.id, draft: item.draft, sendAt: item.sendAt, status: item.status, error: item.error })
}

export const Outbox = {
  schedule(draft: Draft): OutboxItem {
    const delay = SettingsRepo.app().undoSendSeconds * 1000
    const item: OutboxItem = { id: id(), draft, sendAt: Date.now() + delay, status: 'scheduled' }
    const timer = setTimeout(() => void this.flush(item.id), delay)
    items.set(item.id, { ...item, timer })
    DraftRepo.delete(draft.id)
    publish(item)
    return item
  },
  cancel(outboxId: string): boolean {
    const it = items.get(outboxId)
    if (!it || it.status !== 'scheduled') return false
    clearTimeout(it.timer)
    items.delete(outboxId)
    DraftRepo.save(it.draft)
    publish({ ...it, status: 'failed', error: 'annulé' })
    return true
  },
  async flush(outboxId: string): Promise<void> {
    const it = items.get(outboxId)
    if (!it) return
    it.status = 'sending'; publish(it)
    try {
      const account = AccountRepo.get(it.draft.accountId)
      if (!account) throw new Error('compte introuvable')
      const sig = SettingsRepo.signatureFor(account.id, it.draft.signatureId, account.defaultSignatureId)
      const parent = it.draft.replyToMessageId ? MessageRepo.get(it.draft.replyToMessageId) : undefined
      const opts = buildMailOptions(it.draft, account, sig, parent ? { messageId: parent.messageId, references: parent.references } : undefined)
      const { raw, messageId } = await sendMail(account, opts)
      const parentId = it.draft.replyToMessageId ?? it.draft.forwardOfMessageId
      if (parentId) {
        const parentMsg = MessageRepo.get(parentId)
        if (parentMsg) MessageRepo.addLink({ accountId: account.id, parentMessageId: parentMsg.messageId, childMessageId: messageId, kind: it.draft.mode === 'forward' ? 'forward' : 'reply', to: [...it.draft.to, ...it.draft.cc], date: Date.now() })
      }
      const sent = FolderRepo.byRole(account.id, 'sent')
      if (sent && account.provider !== 'gmail') {
        try { await SyncManager.engine(account.id).append(sent, raw, ['\\Seen']) } catch (e: any) { log.warn('outbox', 'append sent', e?.message) }
      }
      it.status = 'sent'; publish(it)
      if (it.draft.threadId) { try { if (AiReplyRepo.markThreadSent(it.draft.threadId)) events.emitEvent('replies:changed', AiReplyRepo.counts()) } catch {} }
      items.delete(outboxId)
      await DraftService.removeRemote(it.draft)
      for (const a of [...it.draft.to, ...it.draft.cc]) { try { if (!ContactRepo.byEmail(a.address)) ContactRepo.save({ accountId: null, firstName: '', lastName: '', displayName: a.name || '', emails: [a.address], phones: [], org: '', title: '', notes: '', source: 'auto', googleId: null, starred: false }) } catch {} }
      if (sent) { await SyncManager.engine(account.id).syncFolder(sent, { limit: 50 }); events.emitEvent('mail:changed', { accountId: account.id, folderIds: [sent.id] }) }
    } catch (e: any) {
      it.status = 'failed'; it.error = e?.message ?? String(e); publish(it)
      DraftRepo.save(it.draft)
      items.delete(outboxId)
    }
  }
}