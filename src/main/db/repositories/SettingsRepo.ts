// src/main/db/repositories/SettingsRepo.ts
import { getDb, j, p, id } from '../index'
import type { Signature } from '@shared/models/Signature'
import type { AppSettings } from '@shared/ipc'
import { DEFAULT_AI_SETTINGS, type AiSettings } from '@shared/ai/AiSettings'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system', density: 'comfortable', loadRemoteImages: true, undoSendSeconds: 0, markReadDelayMs: 800, collectAddresses: true, fullTextIndex: true, confirmSend: true, autoUpdate: true, fontSize: 'normal', composeSurface: 'light', purgeSpamDays: 0, purgeTrashDays: 0
}

function read<T>(key: string, fallback: T): T {
  const r = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
  return { ...fallback, ...p<Partial<T>>(r?.value ?? null, {}) }
}
function write<T>(key: string, value: T): void {
  getDb().prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, j(value))
}

export const SettingsRepo = {
  app(): AppSettings { return read('app', DEFAULT_APP_SETTINGS) },
  setApp(patch: Partial<AppSettings>): AppSettings { const n = { ...this.app(), ...patch }; write('app', n); return n },
  ai(): AiSettings { return read('ai', DEFAULT_AI_SETTINGS) },
  setAi(patch: Partial<AiSettings>): AiSettings {
    const n = { ...this.ai(), ...patch, provider: { ...this.ai().provider, ...(patch.provider ?? {}) } }
    write('ai', n); return n
  },
  signatures(): Signature[] {
    return getDb().prepare('SELECT * FROM signatures ORDER BY name').all().map((r: any) => ({
      id: r.id, name: r.name, html: r.html, text: r.text, accountId: r.account_id
    }))
  },
  signature(sigId: string): Signature | undefined {
    return this.signatures().find((s) => s.id === sigId)
  },
  signatureFor(accountId: string, preferredId: string | null, defaultId: string | null): Signature | undefined {
    const all = this.signatures()
    if (preferredId) { const s = all.find((x) => x.id === preferredId); if (s) return s }
    if (defaultId) { const s = all.find((x) => x.id === defaultId); if (s) return s }
    const candidates = all.filter((x) => !x.accountId || x.accountId === accountId)
    return candidates.length === 1 ? candidates[0] : candidates.find((x) => x.accountId === accountId)
  },
  saveSignature(s: Signature): Signature {
    const next = { ...s, id: s.id || id() }
    getDb().prepare('INSERT INTO signatures(id,name,html,text,account_id) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, html=excluded.html, text=excluded.text, account_id=excluded.account_id')
      .run(next.id, next.name, next.html, next.text, next.accountId)
    return next
  },
  deleteSignature(sigId: string): void {
    getDb().prepare('DELETE FROM signatures WHERE id = ?').run(sigId)
  }
}