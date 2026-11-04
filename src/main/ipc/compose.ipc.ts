// src/main/ipc/compose.ipc.ts
import { dialog } from 'electron'
import { readFileSync } from 'fs'
import { createComposeWindow } from '../window'
import { handle } from './index'
import { DraftRepo } from '../db/repositories/DraftRepo'
import { Outbox } from '../smtp/Outbox'
import { DraftService } from '../smtp/DraftService'

export function registerComposeIpc(): void {
  handle('drafts:list', (accountId) => DraftRepo.list(accountId))
  handle('drafts:save', (d) => DraftRepo.save(d))
  handle('drafts:delete', async (id) => { const d = DraftRepo.get(id); if (d) await DraftService.removeRemote(d); DraftRepo.delete(id) })
  handle('drafts:keep', (d) => DraftService.keep(d))
  handle('drafts:fromMessage', (id) => DraftService.fromMessage(id))
  handle('drafts:send', (d) => Outbox.schedule(d))
  handle('outbox:cancel', (id) => Outbox.cancel(id))
  handle('compose:open', (draftId) => { createComposeWindow(draftId) })
  handle('compose:pickImage', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }] })
    if (r.canceled || !r.filePaths[0]) return null
    const p = r.filePaths[0]
    const ext = p.split('.').pop()!.toLowerCase()
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
    return `data:${mime};base64,${readFileSync(p).toString('base64')}`
  })
  handle('compose:pickAttachments', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    return r.canceled ? [] : r.filePaths
  })
}