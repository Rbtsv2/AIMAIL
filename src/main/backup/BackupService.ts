// src/main/backup/BackupService.ts
import { app, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getDb } from '../db'
import { AccountRepo } from '../db/repositories/AccountRepo'
import { SettingsRepo } from '../db/repositories/SettingsRepo'
import { SourceRepo } from '../db/repositories/SourceRepo'
import { ContactRepo } from '../db/repositories/ContactRepo'
import { CalendarRepo } from '../db/repositories/CalendarRepo'
import { FolderRepo } from '../db/repositories/FolderRepo'
import { Credentials } from '../auth/Credentials'
import { SyncManager } from '../sync/SyncManager'
import { encrypt, decrypt } from './crypto'
import { events } from '../sync/events'

const VERSION = 1

export const BackupService = {
  build(): any {
    const accounts = AccountRepo.list().map((a) => ({ ...a, credentials: Credentials.getAccount(a.id), folderOrder: FolderRepo.list(a.id).filter((f) => f.sortOrder !== null).map((f) => ({ path: f.path, sortOrder: f.sortOrder })) }))
    const ai = SettingsRepo.ai()
    return {
      version: VERSION, exportedAt: new Date().toISOString(),
      app: SettingsRepo.app(), ai, aiKeys: { anthropic: Credentials.getAiKey('anthropic') ?? null, openai: Credentials.getAiKey('openai') ?? null },
      accounts, signatures: SettingsRepo.signatures(),
      sources: SourceRepo.list().map((s) => ({ ...s, secret: (() => { const v = Credentials.get(`source:${s.id}`); return v ? JSON.parse(v) : null })() })),
      contacts: ContactRepo.list('', 100000),
      calendars: CalendarRepo.calendars().filter((c) => c.kind !== 'google' && c.kind !== 'microsoft').map((c) => ({ ...c, credentials: (() => { const v = Credentials.get(`caldav:${c.id}`); return v ? JSON.parse(v) : null })(), events: c.kind === 'local' ? CalendarRepo.allInCalendar(c.id) : [] }))
    }
  },
  async exportToFile(passphrase: string): Promise<string | null> {
    const r = await dialog.showSaveDialog({ defaultPath: join(app.getPath('documents'), `aimail-sauvegarde-${new Date().toISOString().slice(0, 10)}.mailbackup`), filters: [{ name: 'Sauvegarde AIMAIL', extensions: ['mailbackup'] }] })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, encrypt(JSON.stringify(this.build()), passphrase), 'utf8')
    return r.filePath
  },
  async importFromFile(passphrase: string): Promise<{ accounts: number; contacts: number; signatures: number; sources: number; events: number }> {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Sauvegarde AIMAIL', extensions: ['mailbackup', 'json'] }] })
    if (r.canceled || !r.filePaths[0]) return { accounts: 0, contacts: 0, signatures: 0, sources: 0, events: 0 }
    const data = JSON.parse(decrypt(readFileSync(r.filePaths[0], 'utf8'), passphrase))
    if (data.version !== VERSION) throw new Error('version de sauvegarde non prise en charge')
    const res = { accounts: 0, contacts: 0, signatures: 0, sources: 0, events: 0 }
    const db = getDb()
    SettingsRepo.setApp(data.app ?? {})
    SettingsRepo.setAi(data.ai ?? {})
    if (data.aiKeys?.anthropic) Credentials.setAiKey('anthropic', data.aiKeys.anthropic)
    if (data.aiKeys?.openai) Credentials.setAiKey('openai', data.aiKeys.openai)
    const sigMap = new Map<string, string>()
    for (const s of data.signatures ?? []) { const existing = SettingsRepo.signatures().find((x) => x.name === s.name && x.html === s.html); const saved = existing ?? SettingsRepo.saveSignature({ ...s, id: '' }); sigMap.set(s.id, saved.id); if (!existing) res.signatures++ }
    const accMap = new Map<string, string>()
    for (const a of data.accounts ?? []) {
      const existing = AccountRepo.list().find((x) => x.email.toLowerCase() === a.email.toLowerCase())
      if (existing) { accMap.set(a.id, existing.id); continue }
      const created = AccountRepo.create({ email: a.email, name: a.name, provider: a.provider, auth: a.auth, imap: a.imap, smtp: a.smtp, credentials: a.credentials ?? {} })
      Credentials.setAccount(created.id, a.credentials ?? {})
      AccountRepo.update(created.id, { aiInstructions: a.aiInstructions ?? '', defaultSignatureId: a.defaultSignatureId ? sigMap.get(a.defaultSignatureId) ?? null : null, color: a.color, purgeSpamDays: a.purgeSpamDays ?? null, purgeTrashDays: a.purgeTrashDays ?? null })
      accMap.set(a.id, created.id)
      SyncManager.attach(AccountRepo.get(created.id)!)
      res.accounts++
      // ordre des dossiers : appliqué une fois les dossiers synchronisés
      if (a.folderOrder?.length) setTimeout(() => { for (const fo of a.folderOrder) { const f = FolderRepo.list(created.id).find((x) => x.path === fo.path); if (f) db.prepare('UPDATE folders SET sort_order = ? WHERE id = ?').run(fo.sortOrder, f.id) } events.emitEvent('mail:changed', { accountId: created.id }) }, 30000)
    }
    for (const s of data.sources ?? []) { const existing = SourceRepo.list().find((x) => x.name === s.name && x.filePath === s.filePath); if (existing) continue; SourceRepo.save({ ...s, id: '', urls: s.urls ?? (s.url ? [s.url] : []), accountIds: (s.accountIds ?? (s.accountId ? [s.accountId] : [])).map((id: string) => accMap.get(id)).filter(Boolean) as string[], secret: s.secret ?? undefined }); res.sources++ }
    for (const c of data.contacts ?? []) { const m = ContactRepo.merge({ ...c, id: undefined, accountId: c.accountId ? accMap.get(c.accountId) ?? null : null }); if (m.created) res.contacts++ }
    for (const c of data.calendars ?? []) {
      const existing = CalendarRepo.calendars().find((x) => (c.kind === 'local' && x.kind === 'local' && x.name === c.name) || (c.kind === 'caldav' && x.url === c.url))
      const cal = existing ?? CalendarRepo.saveCalendar({ kind: c.kind, name: c.name, color: c.color, url: c.url, accountId: c.accountId ? accMap.get(c.accountId) ?? null : null, enabled: c.enabled, isDefault: false, readOnly: false })
      if (c.kind === 'caldav' && c.credentials) Credentials.set(`caldav:${cal.id}`, JSON.stringify(c.credentials))
      for (const e of c.events ?? []) { if (CalendarRepo.byUid(e.uid, cal.id)) continue; CalendarRepo.saveEvent({ ...e, id: undefined, calendarId: cal.id }); res.events++ }
    }
    events.emitEvent('calendar:changed', {})
    events.emitEvent('mail:changed', { accountId: '' })
    return res
  }
}