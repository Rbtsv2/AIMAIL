// src/main/attachments/AttachmentStore.ts
import { app, shell, dialog } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from 'fs'
import { MessageRepo } from '../db/repositories/MessageRepo'
import { SyncManager } from '../sync/SyncManager'

const dir = () => { const d = join(app.getPath('userData'), 'attachments'); mkdirSync(d, { recursive: true }); return d }

export const AttachmentStore = {
  async ensureLocal(attachmentId: string): Promise<string> {
    const att = MessageRepo.attachment(attachmentId)
    if (!att) throw new Error('pièce jointe introuvable')
    if (att.localPath && existsSync(att.localPath)) return att.localPath
    const msg = MessageRepo.get(att.messageId)!
    const buf = await SyncManager.engine(msg.accountId).fetchAttachment(msg, att.partId)
    const safe = att.filename.replace(/[\\/:*?"<>|]/g, '_')
    const path = join(dir(), `${att.id}-${safe}`)
    writeFileSync(path, buf)
    MessageRepo.setAttachmentPath(att.id, path)
    return path
  },
  async open(attachmentId: string): Promise<void> {
    await shell.openPath(await this.ensureLocal(attachmentId))
  },
  async save(attachmentId: string): Promise<string | null> {
    const att = MessageRepo.attachment(attachmentId)!
    const src = await this.ensureLocal(attachmentId)
    const r = await dialog.showSaveDialog({ defaultPath: join(app.getPath('downloads'), att.filename) })
    if (r.canceled || !r.filePath) return null
    copyFileSync(src, r.filePath)
    return r.filePath
  },
  async inlineDataUrls(messageId: string): Promise<Record<string, string>> {
    const map: Record<string, string> = {}
    for (const att of MessageRepo.attachments(messageId)) {
      if (!att.contentId) continue
      try {
        const p = await this.ensureLocal(att.id)
        map[att.contentId] = `data:${att.mimeType};base64,${require('fs').readFileSync(p).toString('base64')}`
      } catch {}
    }
    return map
  }
}