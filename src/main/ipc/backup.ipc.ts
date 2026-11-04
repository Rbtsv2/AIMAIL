// src/main/ipc/backup.ipc.ts
import { dialog } from 'electron'
import { handle } from './index'
import { BackupService } from '../backup/BackupService'
import { findProfiles, readProfile } from '../backup/Thunderbird'
import { importFile } from '../contacts/importers'
import { ContactRepo } from '../db/repositories/ContactRepo'

export function registerBackupIpc(): void {
  handle('backup:export', (passphrase) => BackupService.exportToFile(passphrase))
  handle('backup:import', (passphrase) => BackupService.importFromFile(passphrase))
  handle('thunderbird:profiles', () => findProfiles())
  handle('thunderbird:read', (path) => readProfile(path))
  handle('thunderbird:pick', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Dossier du profil Thunderbird (contient prefs.js)' })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('thunderbird:importBooks', (paths) => {
    let imported = 0, updated = 0
    for (const p of paths) for (const c of importFile(p)) { try { const m = ContactRepo.merge(c); if (m.created) imported++; else updated++ } catch {} }
    return { imported, updated }
  })
}