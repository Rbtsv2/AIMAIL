// src/main/ipc/contacts.ipc.ts
import { dialog, app } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { handle } from './index'
import { ContactRepo } from '../db/repositories/ContactRepo'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { importFile } from '../contacts/importers'
import { exportCsv, exportVcard } from '../contacts/exporters'
import { syncGoogleContacts } from '../contacts/GoogleContacts'

export function registerContactsIpc(): void {
  handle('contacts:list', (q) => ContactRepo.list(q ?? ''))
  handle('contacts:save', (c) => ContactRepo.save(c))
  handle('contacts:delete', (id) => ContactRepo.remove(id))
  handle('contacts:suggest', (q) => ContactRepo.suggest(q))
  handle('contacts:count', () => ContactRepo.count())
  handle('contacts:import', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [
      { name: 'Carnets d’adresses', extensions: ['csv', 'tsv', 'tab', 'vcf', 'vcard', 'ldif', 'sqlite', 'mab'] },
      { name: 'CSV / TSV', extensions: ['csv', 'tsv', 'tab'] }, { name: 'vCard', extensions: ['vcf', 'vcard'] }, { name: 'LDIF', extensions: ['ldif'] },
      { name: 'SQLite Thunderbird', extensions: ['sqlite'] }, { name: 'Mork Thunderbird', extensions: ['mab'] }
    ] })
    if (r.canceled) return { imported: 0, updated: 0, skipped: 0 }
    let imported = 0, updated = 0, skipped = 0
    for (const p of r.filePaths) {
      for (const c of importFile(p)) {
        try { const m = ContactRepo.merge(c); if (m.created) imported++; else updated++ } catch { skipped++ }
      }
    }
    return { imported, updated, skipped }
  })
  handle('contacts:export', async (format) => {
    const cs = ContactRepo.list('', 100000)
    const name = format === 'vcf' ? 'contacts.vcf' : 'contacts.csv'
    const r = await dialog.showSaveDialog({ defaultPath: join(app.getPath('documents'), name) })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, format === 'vcf' ? exportVcard(cs) : exportCsv(cs, ';'), 'utf8')
    return r.filePath
  })
  handle('contacts:syncGoogle', async (accountId) => {
    const a = AccountRepo.get(accountId)
    if (!a) throw new Error('compte introuvable')
    return syncGoogleContacts(a)
  })
}