// src/main/ipc/sources.ipc.ts
import { dialog } from 'electron'
import { handle } from './index'
import { SourceRepo } from '../db/repositories/SourceRepo'
import { SourceService } from '../ai/SourceService'

export function registerSourcesIpc(): void {
  handle('sources:list', () => SourceRepo.list())
  handle('sources:save', (s) => SourceRepo.save(s))
  handle('sources:delete', (id) => SourceRepo.remove(id))
  handle('sources:test', (id) => SourceService.test(id))
  handle('sources:pickFile', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'md', 'csv', 'json', 'docx', 'html'] }] })
    return r.canceled ? null : r.filePaths[0]
  })
}