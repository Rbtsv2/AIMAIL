// src/main/smtp/DraftService.ts
import MailComposer from 'nodemailer/lib/mail-composer'
import type { Draft } from '@shared/models/Draft'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { DraftRepo } from '../db/repositories/DraftRepo'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { SettingsRepo } from '../db/repositories/SettingsRepo'
import { SyncManager } from '../sync/SyncManager'
import { events } from '../sync/events'
import { buildMailOptions } from './MimeBuilder'
import { log } from '../utils/logger'

export const DraftService = {
  async removeRemote(draft: Draft): Promise<void> {
    if (!draft.imapFolderId || !draft.imapUid) return
    const folder = FolderRepo.get(draft.imapFolderId)
    if (!folder) return
    try {
      await SyncManager.engine(draft.accountId).delete(folder, [draft.imapUid])
      const local = MessageRepo.byUid(folder.id, draft.imapUid)
      if (local) MessageRepo.delete([local.id])
      FolderRepo.recount(folder.id)
    } catch (e: any) { log.warn('drafts', 'suppression distante', e?.message) }
  },

  async keep(draft: Draft): Promise<Draft> {
    const account = AccountRepo.get(draft.accountId)
    if (!account) throw new Error('compte introuvable')
    const folder = FolderRepo.byRole(account.id, 'drafts')
    const local = DraftRepo.save(draft)
    if (!folder) return local
    await this.removeRemote(draft)
    const sig = SettingsRepo.signatureFor(account.id, draft.signatureId, account.defaultSignatureId)
    const raw = await new MailComposer(buildMailOptions(draft, account, sig)).compile().build()
    const uid = await SyncManager.engine(account.id).append(folder, raw, ['\\Draft', '\\Seen'])
    const next = DraftRepo.save({ ...local, imapFolderId: folder.id, imapUid: uid })
    await SyncManager.engine(account.id).syncFolder(folder, { limit: 50 })
    events.emitEvent('mail:changed', { accountId: account.id, folderIds: [folder.id] })
    return next
  },

  fromMessage(messageId: string): Draft {
    const m = MessageRepo.get(messageId)
    if (!m) throw new Error('message introuvable')
    const account = AccountRepo.get(m.accountId)!
    const existing = DraftRepo.list(account.id).find((d) => d.imapUid === m.uid && d.imapFolderId === m.folderId)
    if (existing) return existing
    const html = (m.bodyHtml ?? `<p>${(m.bodyText ?? '').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).replace(/<div class="signature"[\s\S]*$/, '')
    return DraftRepo.save({
      id: crypto.randomUUID(), accountId: account.id, threadId: null, replyToMessageId: null, forwardOfMessageId: null, mode: 'new',
      to: m.to, cc: m.cc, bcc: m.bcc, subject: m.subject === '(sans objet)' ? '' : m.subject, html, text: m.bodyText ?? '',
      signatureId: account.defaultSignatureId, attachmentPaths: [], imapFolderId: m.folderId, imapUid: m.uid, updatedAt: Date.now()
    })
  }
}